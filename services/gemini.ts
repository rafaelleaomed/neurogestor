import { GoogleGenAI, Type } from "@google/genai";
import { OCRResult, Surgery, Category, Status } from "../types";
import { calculatePrice, getCategoryFromText, normalizeDateToISO } from "../utils";
import { getSurgeries, getDoctors, getHospitals } from "./storage";
import { SEED_PROCEDURES, HOSPITAL_ALIASES, SEED_DOCTORS, SEED_HOSPITALS } from "../constants";

const PRIMARY_MODEL = "gemini-2.5-flash";
const FALLBACK_MODEL = "gemini-2.0-flash";

/**
 * CONTROLADOR DE FILA GLOBAL SEGURO (MUTEX COM TIMEOUT E PREVENÇÃO DE DEADLOCK)
 */
class GeminiQueue {
  private queue: Promise<any> = Promise.resolve();

  async add<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      // Sempre encadeamos com .catch(() => {}) para que rejeições prévias nunca travem a fila
      this.queue = this.queue
        .catch(() => {})
        .then(async () => {
          try {
            const result = await this.executeWithRetry(task);
            resolve(result);
          } catch (error) {
            reject(error);
          }
        });
    });
  }

  private async executeWithRetry<T>(task: () => Promise<T>, retries = 2): Promise<T> {
    let lastError: any;
    for (let i = 0; i <= retries; i++) {
      try {
        // Timeout rígido de 25 segundos para cada tentativa
        return await Promise.race([
          task(),
          new Promise<never>((_, rej) =>
            setTimeout(() => rej(new Error("Tempo limite de comunicação com a IA excedido (45s).")), 45000)
          )
        ]);
      } catch (error: any) {
        lastError = error;
        const errorMsg = (error?.message || JSON.stringify(error) || '').toUpperCase();
        const isQuotaOrSpike =
          errorMsg.includes("429") ||
          errorMsg.includes("RESOURCE_EXHAUSTED") ||
          errorMsg.includes("503") ||
          errorMsg.includes("UNAVAILABLE");

        if (isQuotaOrSpike && i < retries) {
          const wait = (i + 1) * 1500;
          await new Promise(r => setTimeout(r, wait));
          continue;
        }
        throw error;
      }
    }
    throw lastError || new Error("Erro de conexão com IA.");
  }
}

const aiQueue = new GeminiQueue();

/**
 * Executa generateContent com fallback de modelo caso o primário esteja indisponível.
 */
async function callGeminiWithFallback(ai: GoogleGenAI, requestPayload: any): Promise<any> {
  try {
    return await ai.models.generateContent({
      ...requestPayload,
      model: PRIMARY_MODEL
    });
  } catch (err: any) {
    const errStr = (err?.message || JSON.stringify(err) || '').toUpperCase();
    const isModelIssue =
      errStr.includes("404") ||
      errStr.includes("503") ||
      errStr.includes("NOT_FOUND") ||
      errStr.includes("UNAVAILABLE");

    if (isModelIssue) {
      console.warn(`[NeuroGestor] Fallback acionado: ${PRIMARY_MODEL} -> ${FALLBACK_MODEL}`, err?.message);
      return await ai.models.generateContent({
        ...requestPayload,
        model: FALLBACK_MODEL
      });
    }
    throw err;
  }
}

// ============================================================
// CONTEXTO INTELIGENTE PARA OCR
// ============================================================

/**
 * Monta uma string de contexto com hospitais, médicos e procedimentos
 * conhecidos, para injetar no prompt do OCR.
 */
const buildOCRContext = (): string => {
  const customHospitals = getHospitals();
  const allHospitals = [...new Set([...SEED_HOSPITALS, ...customHospitals])];

  const customDoctors = getDoctors();
  const allDoctors = [...new Set([...SEED_DOCTORS, ...customDoctors])];

  const existingSurgeries = getSurgeries();
  const existingProcs = [...new Set(existingSurgeries.map(s => s.procedimento?.toUpperCase()).filter(Boolean))];
  const allProcs = [...new Set([...SEED_PROCEDURES, ...existingProcs])].slice(0, 80);

  return `
CONTEXTO DE REFERÊNCIA - Utilize para validar e padronizar nomes:
HOSPITAIS CONHECIDOS: ${allHospitals.join(', ')}
MÉDICOS CIRURGIÕES CONHECIDOS: ${allDoctors.join(', ')}
PROCEDIMENTOS COMUNS: ${allProcs.slice(0, 40).join(', ')}

DIRETRIZES DE EXTRAÇÃO:
- PACIENTE: Extraia o nome completo do paciente.
- CIRURGIÃO / MÉDICO: Identifique o médico cirurgião principal (frequentemente precedido por "Dr.", "Dra.", "Cirurgião", "Médico", "Operador" ou com CRM). Ignore instrumentadores ou anestesistas se houver cirurgião identificado. Expanda abreviações com base na lista de médicos conhecidos.
- HOSPITAL: Identifique o hospital da cirurgia. Ex: "HMT" ou "MT" = "HOSPITAL MADRE TERESA"; identifique unidades Mater Dei (Contorno, Betim, Santo Agostinho, Nova Lima), Unimed (Contorno, Betim), etc.
- PROCEDIMENTO: Nome da cirurgia (ex: "ARTRODESE CERVICAL C4-C6", "MICRODISCECTOMIA", "CRANIOTOMIA PARA MENINGIOMA", etc.).
- DATA: Extraia a data no formato YYYY-MM-DD. Se estiver no formato brasileiro DD/MM/AAAA, converta para YYYY-MM-DD.
- Retorne apenas campos com dados reais lidos. Se não encontrar um dado, retorne string vazia "".`;
};

/**
 * Pós-processamento: normaliza datas, hospitais e médicos usando aliases e fuzzy matching.
 */
const postProcessOCRResult = (result: OCRResult): OCRResult => {
  const cleanField = (val: string | undefined | null): string => {
    if (!val || val === 'null' || val === 'undefined') return '';
    const trimmed = val.trim();
    if (trimmed.toLowerCase() === 'não identificado' || trimmed.toLowerCase() === 'nao identificado') return '';
    return trimmed;
  };

  const paciente = cleanField(result.paciente);
  const procedimento = cleanField(result.procedimento);
  let medico = cleanField(result.medico).toUpperCase();
  let hospital = cleanField(result.hospital).toUpperCase();
  const rawDate = cleanField(result.data);
  const data = normalizeDateToISO(rawDate) || (rawDate.includes('-') ? rawDate : '');

  // Fuzzy matching de hospitais via aliases
  if (hospital) {
    const alias = HOSPITAL_ALIASES[hospital];
    if (alias) {
      hospital = alias;
    } else {
      for (const [key, value] of Object.entries(HOSPITAL_ALIASES)) {
        if (hospital.includes(key) || key.includes(hospital)) {
          hospital = value;
          break;
        }
      }
      if (!SEED_HOSPITALS.includes(hospital)) {
        const match = SEED_HOSPITALS.find(h =>
          hospital.includes(h) || h.includes(hospital) ||
          levenshteinSimilarity(hospital, h) > 0.7
        );
        if (match) hospital = match;
      }
    }
  }

  // Fuzzy matching de médicos
  if (medico) {
    const matchDoc = SEED_DOCTORS.find(d => {
      const dUp = d.toUpperCase();
      return medico === dUp || medico.includes(dUp) || dUp.includes(medico) ||
        levenshteinSimilarity(medico, dUp) > 0.75;
    });
    if (matchDoc) medico = matchDoc;
  }

  const rawConvenio = cleanField(result.convenio);
  const convenio = rawConvenio ? rawConvenio.toUpperCase() : undefined;

  return {
    paciente: paciente || undefined,
    procedimento: procedimento || undefined,
    medico: medico || undefined,
    hospital: hospital || undefined,
    data: data || undefined,
    convenio: convenio || undefined
  };
};

/**
 * Similaridade simples baseada em Levenshtein normalizada.
 */
const levenshteinSimilarity = (a: string, b: string): number => {
  const la = a.length, lb = b.length;
  if (la === 0 || lb === 0) return 0;
  const shorter = la < lb ? a : b;
  const longer = la < lb ? b : a;
  if (longer.includes(shorter)) return shorter.length / longer.length + 0.3;

  let matches = 0;
  const words = shorter.split(/\s+/);
  for (const word of words) {
    if (word.length > 2 && longer.includes(word)) matches++;
  }
  return matches / words.length;
};

// ============================================================
// OCR INDIVIDUAL
// ============================================================

export const performOCR = async (base64Image: string): Promise<OCRResult> => {
  return aiQueue.add(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const context = buildOCRContext();

    const response = await callGeminiWithFallback(ai, {
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image.split(',')[1] || base64Image,
            },
          },
          {
            text: `Examine com máxima atenção esta imagem de etiqueta cirúrgica e extraia os dados em JSON estruturado:
- paciente: Nome completo do paciente
- procedimento: Procedimento cirúrgico realizado (inclua níveis vertebrais se constar)
- medico: Cirurgião responsável (priorize nomes de cirurgiões)
- hospital: Nome ou sigla da unidade hospitalar
- data: Data da cirurgia (formato YYYY-MM-DD)
- convenio: Nome do convênio / plano de saúde (ex: UNIMED, BRADESCO, SULAMERICA) ou 'PARTICULAR' se indicado

${context}
Retorne estritamente o JSON com as chaves indicadas. Se algum campo não estiver visível na imagem, retorne "".`,
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            paciente: { type: Type.STRING },
            procedimento: { type: Type.STRING },
            medico: { type: Type.STRING },
            hospital: { type: Type.STRING },
            data: { type: Type.STRING },
            convenio: { type: Type.STRING },
          },
        },
      },
    });

    const raw = JSON.parse(response.text || "{}");
    return postProcessOCRResult(raw);
  });
};

// ============================================================
// OCR DE LAUDOS
// ============================================================

export const performReportOCR = async (base64Image: string): Promise<string> => {
  return aiQueue.add(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await callGeminiWithFallback(ai, {
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image.split(',')[1] || base64Image,
            },
          },
          {
            text: "Transcreva o texto deste relatório médico de forma organizada e clara.",
          },
        ],
      },
    });
    return response.text || "";
  });
};

// ============================================================
// EXTRAÇÃO DE EVENTOS DO GOOGLE CALENDAR
// ============================================================

export const extractSurgeriesFromCalendarEvents = async (events: any[]): Promise<Surgery[]> => {
  if (events.length === 0) return [];

  return aiQueue.add(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const context = buildOCRContext();
    const prompt = `Analise estes eventos da agenda médica e extraia cirurgias reais (ignore consultórios/feriados). Converta a data para YYYY-MM-DD.
${context}
Eventos: ${JSON.stringify(events.slice(0, 30))}`;

    const response = await callGeminiWithFallback(ai, {
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              paciente: { type: Type.STRING },
              procedimento: { type: Type.STRING },
              medico: { type: Type.STRING },
              hospital: { type: Type.STRING },
              data: { type: Type.STRING }
            }
          }
        }
      }
    });

    const results = JSON.parse(response.text || "[]");
    return results.map((item: any) => {
      const processed = postProcessOCRResult(item);
      const proc = processed.procedimento || "Cirurgia";
      return {
        id: crypto.randomUUID(),
        paciente: processed.paciente || "Paciente não identificado",
        procedimento: proc,
        medico: processed.medico || "Não informado",
        hospital: processed.hospital || "Não informado",
        data: processed.data || new Date().toISOString().split('T')[0],
        categoria: getCategoryFromText(proc),
        valor_estimado: calculatePrice(proc),
        status: Status.AGENDADO,
        created_at: Date.now()
      };
    });
  }).catch(() => []);
};

// ============================================================
// OCR EM LOTE (BATCH) — OTIMIZADO COM CONTEXTO
// ============================================================

export const performBatchLabelsOCR = async (
  base64Images: string[],
  onProgress?: (processed: number, total: number) => void
): Promise<Surgery[]> => {
  const BATCH_SIZE = 3; // Lote reduzido para estabilidade de memória e máxima precisão
  const allResults: Surgery[] = [];
  let processed = 0;
  const context = buildOCRContext();

  for (let i = 0; i < base64Images.length; i += BATCH_SIZE) {
    const batch = base64Images.slice(i, i + BATCH_SIZE);

    const batchResults = await aiQueue.add(async () => {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      // Montar parts com todas as imagens do lote
      const parts: any[] = [];
      batch.forEach((base64, idx) => {
        parts.push({
          inlineData: {
            mimeType: "image/jpeg",
            data: base64.split(',')[1] || base64,
          },
        });
        parts.push({ text: `[Etiqueta ${idx + 1} de ${batch.length}]` });
      });

      parts.push({
        text: `Você recebeu ${batch.length} imagem(ns) de etiquetas cirúrgicas de um serviço de neurocirurgia.
Para CADA etiqueta, extraia com MÁXIMA PRECISÃO:
1. Nome COMPLETO do Paciente
2. Procedimento cirúrgico realizado (incluindo níveis vertebrais se houver, ex: ARTRODESE C5-C6)
3. Nome COMPLETO do Cirurgião/Médico (priorize cirurgião responsável)
4. Nome COMPLETO do Hospital
5. Data da cirurgia no formato YYYY-MM-DD

${context}

REGRAS:
- Retorne um ARRAY JSON com EXATAMENTE ${batch.length} objeto(s).
- Se não conseguir identificar um campo, retorne string vazia "".
- Se duas etiquetas forem semelhantes, extraia os dados de cada uma separadamente.`,
      });

      const response = await callGeminiWithFallback(ai, {
        contents: { parts },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                paciente: { type: Type.STRING },
                procedimento: { type: Type.STRING },
                medico: { type: Type.STRING },
                hospital: { type: Type.STRING },
                data: { type: Type.STRING },
              },
            },
          },
        },
      });

      return JSON.parse(response.text || "[]") as OCRResult[];
    }).catch((err) => {
      console.error(`[NeuroGestor] Erro no batch OCR (imagens ${i + 1}-${i + batch.length}):`, err);
      return [] as OCRResult[];
    });

    // Converter resultados OCR em Surgery + pós-processamento inteligente
    batchResults.forEach((data: OCRResult, idx: number) => {
      const processed_data = postProcessOCRResult(data);
      if (processed_data.paciente && processed_data.paciente.trim() !== '') {
        const proc = processed_data.procedimento || "Não especificado";
        allResults.push({
          id: crypto.randomUUID(),
          paciente: processed_data.paciente,
          procedimento: proc,
          medico: processed_data.medico || "Médico não informado",
          hospital: processed_data.hospital || "Hospital não informado",
          data: processed_data.data || new Date().toISOString().split('T')[0],
          categoria: getCategoryFromText(proc),
          valor_estimado: calculatePrice(proc),
          status: Status.REALIZADO,
          created_at: Date.now(),
          label_images: [batch[idx] || '']
        });
      }
    });

    processed += batch.length;
    onProgress?.(Math.min(processed, base64Images.length), base64Images.length);
  }

  return allResults;
};

// ============================================================
// MAPEAMENTO DE PLANILHA COM IA
// ============================================================

export const mapSpreadsheetWithAI = async (rawData: any[]): Promise<Surgery[]> => {
  return aiQueue.add(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const context = buildOCRContext();
    const sample = rawData.slice(0, 100);
    const prompt = `
      ATENÇÃO: Mapeie os dados desta planilha para o formato NeuroGestor.
      REGRAS CRÍTICAS:
      1. Campo 'data': Deve ser retornado estritamente no formato YYYY-MM-DD. Se encontrar DD/MM/YYYY, converta.
      2. Categorias permitidas: 'Coluna', 'Crânio', 'Nervo Periférico'. NUNCA use 'Outros'. Se o procedimento for Artrodese ou envolver coluna, use 'Coluna'.
      3. Se o procedimento for indefinido, use 'Coluna'.
      4. Campos vazios devem ser preenchidos como "".
      ${context}
      
      Dados da Planilha: ${JSON.stringify(sample)}
    `;

    const response = await callGeminiWithFallback(ai, {
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              paciente: { type: Type.STRING },
              procedimento: { type: Type.STRING },
              medico: { type: Type.STRING },
              hospital: { type: Type.STRING },
              data: { type: Type.STRING },
              status: { type: Type.STRING }
            }
          }
        }
      }
    });

    const mappedData = JSON.parse(response.text || "[]");
    return mappedData.map((item: any) => {
      const processed = postProcessOCRResult(item);
      const proc = processed.procedimento || "Não especificado";
      return {
        id: crypto.randomUUID(),
        paciente: processed.paciente || "Paciente Desconhecido",
        procedimento: proc,
        medico: processed.medico || "Médico não informado",
        hospital: processed.hospital || "Hospital não informado",
        data: processed.data && processed.data.includes('-') ? processed.data : new Date().toISOString().split('T')[0],
        categoria: getCategoryFromText(proc),
        valor_estimado: calculatePrice(proc),
        status: (Object.values(Status).includes(item.status as Status) ? item.status : Status.REALIZADO) as Status,
        created_at: Date.now()
      };
    });
  });
};

// ============================================================
// GERAÇÃO DE LAUDO MNIO (FASE 2)
// ============================================================

export const generateMnioReport = async (surgery: Partial<Surgery>, existingNotes: string): Promise<string> => {
  return aiQueue.add(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    let alarmeStr = "Não houve alterações significativas ou alarmes intraoperatórios.";
    if (surgery.houve_alarme) {
      alarmeStr = `Houve alarme/alteração intraoperatória. Condutas adotadas: ${(surgery.condutas_alarme || []).join(', ') || 'Nenhuma informada'}.`;
    }

    const prompt = `Você é um médico neurofisiologista experiente elaborando um laudo de Monitorização Neurofisiológica Intraoperatória (MNIO).
Escreva o laudo de forma profissional, direta e técnica, em um único parágrafo fluido (ou dois no máximo), relatando o transcorrer do procedimento.

DADOS DA CIRURGIA:
- Paciente: ${surgery.paciente || 'Não informado'}
- Procedimento: ${surgery.procedimento || 'Não informado'} (Subtipo: ${surgery.subtipo || ''}, Níveis: ${surgery.niveis_operados || 'N/A'})
- Cirurgião: ${surgery.medico || 'Não informado'}
- Hospital: ${surgery.hospital || 'Não informado'}
- Técnicas Utilizadas: ${(surgery.tecnicas_mnio || []).join(', ') || 'Nenhuma técnica informada'}
- Status de Alarme: ${alarmeStr}
- Notas adicionais (use para incrementar o laudo): ${existingNotes || 'Nenhuma'}

Não inclua cabeçalho, saudação ou rodapé. Entregue apenas o texto do laudo.`;

    const response = await callGeminiWithFallback(ai, {
      contents: prompt,
    });
    
    return response.text || "";
  });
};

// ============================================================
// RESUMO CLÍNICO INTELIGENTE PARA PORTFÓLIO (IA)
// ============================================================

export const generateCaseClinicalSummary = async (surgery: Partial<Surgery>): Promise<string> => {
  try {
    return await aiQueue.add(async () => {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      let alarmeContext = "Procedimento transcorreu sem alterações ou alarmes neurofisiológicos críticos.";
      if (surgery.houve_alarme) {
        alarmeContext = `Houve alarme/alteração neurofisiológica intraoperatória. Condutas executadas: ${(surgery.condutas_alarme || []).join(', ') || 'Manobras corretivas aplicadas'}.`;
      }

      const tags = (surgery.portfolio_tags || []).join(', ');
      const notes = surgery.portfolio_notes || surgery.observacoes || '';

      const prompt = `Você é um médico especialista em neurofisiologia clínica e monitorização neurofisiológica intraoperatória (MNIO).
Crie um RESUMO CLÍNICO E TÉCNICO (de 2 a 4 frases, em português do Brasil) para ser exibido em um portfólio médico de casos de destaque e apresentações clínicas.

DADOS DO CASO:
- Procedimento: ${surgery.procedimento || 'Não especificado'}
- Subtipo: ${surgery.subtipo || 'Geral'}
- Níveis Operados: ${surgery.niveis_operados || 'Não aplicável'}
- Categoria: ${surgery.categoria || 'Geral'}
- Complexidade: ${surgery.complexity_level || 'Padrão'}
- Técnicas de Monitorização: ${(surgery.tecnicas_mnio || []).join(', ') || 'PEM, PESS, EMG contínua/estimulada'}
- Situação de Alarme / Intercorrência: ${alarmeContext}
- Destaques / Tags: ${tags || 'Nenhum'}
- Notas Clínicas do Especialista: ${notes || 'Nenhuma'}

DIRETRIZES:
- Escreva em linguagem médica culta, precisa e objetiva.
- Destaque o procedimento cirúrgico, os níveis abordados, a relevância da monitorização neurofisiológica para a preservação funcional e o desfecho intraoperatório.
- Não inclua saudações, introduções ("Segue o resumo:"), marcadores em tópicos nem assinatura.
- Retorne estritamente o texto corrido do parágrafo de resumo.`;

      const response = await callGeminiWithFallback(ai, {
        contents: prompt,
      });

      const text = (response.text || "").trim();
      if (text) return text;
      throw new Error("Resposta vazia da IA");
    });
  } catch (err) {
    console.warn("[NeuroGestor] Fallback de resumo clínico do caso acionado:", err);
    // Fallback estruturado de alta qualidade clínica
    const niveis = surgery.niveis_operados ? ` em níveis ${surgery.niveis_operados}` : '';
    const subtipo = surgery.subtipo ? ` (${surgery.subtipo})` : '';
    const alarme = surgery.houve_alarme
      ? ' Durante o ato cirúrgico, houve registro de alerta neurofisiológico com imediata comunicação à equipe e adoção de condutas protetoras.'
      : ' O ato cirúrgico transcorreu com estabilidade dos potenciais evocados e segurança neurológica preservada.';
    const notas = surgery.portfolio_notes ? ` Observações clínicas relevantes: ${surgery.portfolio_notes}` : '';
    return `Caso cirúrgico de ${surgery.procedimento || 'Procedimento Cirúrgico'}${subtipo}${niveis}. Realizada monitorização neurofisiológica intraoperatória multimodal para salvaguarda de vias neurais críticas.${alarme}${notas}`;
  }
};

// ============================================================
// SUGESTÃO DE MODELO DE RELATÓRIO / LAUDO MNIO COM IA
// ============================================================

export const generateReportTemplateFromProcedure = async (procedureName: string): Promise<string> => {
  try {
    return await aiQueue.add(async () => {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `Você é um médico especialista em neurofisiologia clínica e monitorização neurofisiológica intraoperatória (MNIO).
Crie um MODELO DE LAUDO / RELATÓRIO OPERATÓRIO PADRÃO estruturado para a cirurgia: "${procedureName}".

ESTRUTURA DO MODELO DE LAUDO:
- Procedimento / Indicação
- Metodologia e Modalidades Empregadas (PEM, PESS, EMG, etc.)
- Parâmetros e Evolução Transoperatória
- Estimulação de Parafusos Pediculares / Mapeamento (se aplicável)
- Conclusão / Desfecho Neurofisiológico

DIRETRIZES:
- Escreva em linguagem médica padrão culta em Português do Brasil.
- Use texto fluido ou tópicos claros, pronto para uso em prontuário.
- Retorne apenas o texto do laudo, pronto para ser copiado e editado livremente pelo neurofisiologista. Sem introduções nem saudações.`;

      const response = await callGeminiWithFallback(ai, { contents: prompt });
      const text = (response.text || "").trim();
      if (text) return text;
      throw new Error("Resposta vazia da IA");
    });
  } catch (err) {
    console.warn("[NeuroGestor] Erro ao sugerir modelo com IA:", err);
    return `RELATÓRIO DE MONITORIZAÇÃO NEUROFISIOLÓGICA INTRAOPERATÓRIA (MNIO)\n\nProcedimento: ${procedureName}\nModalidades: Potenciais Evocados Somatossensoriais (PESS), Motores (PEM) e Eletromiografia Contínua e Estimulada (EMG).\n\nEvolução Intraoperatória:\nO procedimento cirúrgico transcorreu sob monitorização neurofisiológica multimodal contínua. Os potenciais evocados mantiveram-se estáveis em relação aos registros basais de controle, sem evidências de alterações críticas ou lesão neural iatrogênica.\n\nConclusão:\nProcedimento cirúrgico finalizado com estabilidade neurofisiológica e integridade funcional preservada das vias neurais monitorizadas.`;
  }
};


