import { Status, type Surgery } from '../types.ts';

export type SurgeryExportRow = {
  Data: string;
  Paciente: string;
  Procedimento: string;
  Categoria: string;
  Médico: string;
  Hospital: string;
  Convênio: string;
  'Código TUSS': string;
  'CID-10': string;
  'Nº Guia': string;
  Status: string;
  'Valor Estimado': number;
  Etiqueta: string;
  Relatório: string;
};

const formatExportDate = (date: string): string => {
  const parts = date.split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : date;
};

export const buildSurgeryExportRows = (surgeries: Surgery[]): SurgeryExportRow[] =>
  [...surgeries]
    .sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime())
    .map(surgery => {
      const cancelled = surgery.status === Status.CANCELADO;
      return {
        Data: formatExportDate(surgery.data),
        Paciente: surgery.paciente,
        Procedimento: surgery.procedimento,
        Categoria: surgery.categoria,
        Médico: surgery.medico,
        Hospital: surgery.hospital,
        Convênio: surgery.convenio || 'Particular',
        'Código TUSS': surgery.codigo_tuss || '',
        'CID-10': surgery.cid_10 || '',
        'Nº Guia': surgery.numero_guia || '',
        Status: surgery.status || 'Não informado',
        'Valor Estimado': cancelled ? 0 : surgery.valor_estimado,
        Etiqueta: Array.isArray(surgery.label_images) && surgery.label_images.length > 0 ? '✅ SIM' : '❌ NÃO',
        Relatório: Array.isArray(surgery.report_images) && surgery.report_images.length > 0 ? '✅ SIM' : '❌ NÃO'
      };
    });