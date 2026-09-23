
import { db } from './firebase';
import {
  collection, doc, getDocs, setDoc, deleteDoc,
  writeBatch, query, onSnapshot, Unsubscribe
} from 'firebase/firestore';
import { firebaseStorage } from './firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Surgery, Category, User, PasswordEntry, ReportTemplate, ElectrodeModel, LearnedCategory } from '../types';
import { SEED_DOCTORS, SEED_HOSPITALS } from '../constants';

// ============================================================
// FIREBASE STORAGE — Upload de imagens
// ============================================================

/**
 * Faz upload de uma imagem (base64 data URI) para o Firebase Storage
 * e retorna a URL pública para download.
 * Se a string JÁ for uma URL (https://), retorna sem fazer upload.
 */
export const uploadImage = async (base64: string, folder: string, filename: string): Promise<string> => {
  // Se já for URL, retorna diretamente (imagem já migrada)
  if (base64.startsWith('http://') || base64.startsWith('https://')) {
    return base64;
  }

  try {
    // Converte base64 data URI para Blob
    const response = await fetch(base64);
    const blob = await response.blob();

    const storageRef = ref(firebaseStorage, `${folder}/${filename}`);
    await uploadBytes(storageRef, blob);

    const url = await getDownloadURL(storageRef);
    return url;
  } catch (err) {
    console.warn('[NeuroGestor] Falha no upload da imagem. Mantendo base64 para upload futuro.', err);
    // Retorna o base64 original — a cirurgia será salva com a imagem embutida
    // e o upload pode ser tentado novamente ao editar o registro
    return base64;
  }
};

// ============================================================
// COLEÇÕES FIRESTORE
// ============================================================
const COLLECTIONS = {
  SURGERIES: 'surgeries',
  USERS: 'users',
  CONFIG: 'config',
  PASSWORDS: 'passwords',
  REPORT_TEMPLATES: 'report_templates',
  ELECTRODE_MODELS: 'electrode_models',
  LEARNED_CATEGORIES: 'learned_categories'
};

const LOCAL_KEYS = {
  SURGERIES: 'neurogestor_surgeries',
  USERS: 'neurogestor_users',
  DOCTORS: 'neurogestor_doctors',
  HOSPITALS: 'neurogestor_hospitals',
  SESSION: 'neurogestor_session',
  GOOGLE_CLIENT_ID: 'neurogestor_google_client_id',
  MIGRATED: 'neurogestor_firestore_migrated',
  PASSWORDS: 'neurogestor_passwords',
  REPORT_TEMPLATES: 'neurogestor_report_templates',
  ELECTRODE_MODELS: 'neurogestor_electrode_models',
  LEARNED_CATEGORIES: 'neuro_learned_categories'
};

// ============================================================
// CACHE EM MEMÓRIA (atualizado por listeners em tempo real)
// ============================================================
let surgeriesCache: Surgery[] | null = null;
let usersCache: User[] | null = null;
let surgeriesUnsub: Unsubscribe | null = null;
let usersUnsub: Unsubscribe | null = null;
let passwordsCache: PasswordEntry[] | null = null;
let reportTemplatesCache: ReportTemplate[] | null = null;
let electrodeModelsCache: ElectrodeModel[] | null = null;
let passwordsUnsub: Unsubscribe | null = null;
let reportTemplatesUnsub: Unsubscribe | null = null;
let electrodeModelsUnsub: Unsubscribe | null = null;
let learnedCategoriesUnsub: Unsubscribe | null = null;
let learnedCategoriesCache: Record<string, Category> | null = null;

// ============================================================
// SISTEMA DE LISTENERS (OBSERVERS)
// ============================================================
type DataCallback<T> = (data: T[]) => void;
const listeners = {
  passwords: [] as DataCallback<PasswordEntry>[],
  reports: [] as DataCallback<ReportTemplate>[],
  electrodes: [] as DataCallback<ElectrodeModel>[]
};

export const subscribeToPasswords = (cb: DataCallback<PasswordEntry>) => {
  listeners.passwords.push(cb);
  if (passwordsCache) cb(passwordsCache);
  return () => { listeners.passwords = listeners.passwords.filter(l => l !== cb); };
};

export const subscribeToReports = (cb: DataCallback<ReportTemplate>) => {
  listeners.reports.push(cb);
  if (reportTemplatesCache) cb(reportTemplatesCache);
  return () => { listeners.reports = listeners.reports.filter(l => l !== cb); };
};

export const subscribeToElectrodes = (cb: DataCallback<ElectrodeModel>) => {
  listeners.electrodes.push(cb);
  if (electrodeModelsCache) cb(electrodeModelsCache);
  return () => { listeners.electrodes = listeners.electrodes.filter(l => l !== cb); };
};

// ============================================================
// INICIALIZAÇÃO E MIGRAÇÃO
// ============================================================

/**
 * Deve ser chamado uma vez ao carregar o app.
 * - Configura listeners em tempo real do Firestore.
 * - Migra dados antigos do localStorage se existirem.
 */
export const initStorage = async () => {
  if (surgeriesUnsub) return;

  // Listener de cirurgias em tempo real
  surgeriesUnsub = onSnapshot(
    collection(db, COLLECTIONS.SURGERIES),
    (snapshot) => {
      surgeriesCache = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Surgery));
      // Atualiza localStorage como cache offline (silencioso se falhar por falta de espaço)
      try {
        localStorage.setItem(LOCAL_KEYS.SURGERIES, JSON.stringify(surgeriesCache));
      } catch (e) {
        if (e instanceof DOMException && e.name === 'QuotaExceededError') {
          console.warn('[NeuroGestor] LocalStorage cheio. Usando apenas Firestore para cirurgias.');
        }
      }
    },
    (error) => {
      console.warn('[NeuroGestor] Firestore surgeries listener error:', error);
    }
  );

  // Listener de usuários em tempo real
  usersUnsub = onSnapshot(
    collection(db, COLLECTIONS.USERS),
    (snapshot) => {
      usersCache = snapshot.docs.map(d => d.data() as User);
      localStorage.setItem(LOCAL_KEYS.USERS, JSON.stringify(usersCache));
    },
    (error) => {
      console.warn('[NeuroGestor] Firestore users listener error:', error);
    }
  );

  // listeners de documentos e senhas
  passwordsUnsub = onSnapshot(collection(db, COLLECTIONS.PASSWORDS), (snap) => {
    passwordsCache = snap.docs.map(d => d.data() as PasswordEntry);
    localStorage.setItem(LOCAL_KEYS.PASSWORDS, JSON.stringify(passwordsCache));
    listeners.passwords.forEach(cb => cb(passwordsCache!));
  });

  reportTemplatesUnsub = onSnapshot(collection(db, COLLECTIONS.REPORT_TEMPLATES), (snap) => {
    reportTemplatesCache = snap.docs.map(d => d.data() as ReportTemplate);
    localStorage.setItem(LOCAL_KEYS.REPORT_TEMPLATES, JSON.stringify(reportTemplatesCache));
    listeners.reports.forEach(cb => cb(reportTemplatesCache!));
  });

  electrodeModelsUnsub = onSnapshot(collection(db, COLLECTIONS.ELECTRODE_MODELS), (snap) => {
    electrodeModelsCache = snap.docs.map(d => d.data() as ElectrodeModel);
    localStorage.setItem(LOCAL_KEYS.ELECTRODE_MODELS, JSON.stringify(electrodeModelsCache));
    listeners.electrodes.forEach(cb => cb(electrodeModelsCache!));
  });

  // Listener de categorias aprendidas
  learnedCategoriesUnsub = onSnapshot(collection(db, COLLECTIONS.LEARNED_CATEGORIES), (snap) => {
    const fresh: Record<string, Category> = {};
    snap.docs.forEach(d => {
      const data = d.data() as LearnedCategory;
      fresh[d.id] = data.category;
    });
    learnedCategoriesCache = fresh;
    localStorage.setItem(LOCAL_KEYS.LEARNED_CATEGORIES, JSON.stringify(fresh));
  });

  // Migrar dados do localStorage para Firestore (apenas uma vez)
  // IMPORTANTE: Verificamos o Firestore PRIMEIRO para evitar duplicatas em hot-reloads.
  // O localStorage sozinho não é confiável pois pode ser limpo a qualquer momento.
  const alreadyMigrated = localStorage.getItem(LOCAL_KEYS.MIGRATED);
  if (!alreadyMigrated) {
    try {
      // Verificação primária: O Firestore já tem dados? Se sim, não há nada para migrar.
      const firestoreCount = await getDocs(query(collection(db, COLLECTIONS.SURGERIES)));
      if (!firestoreCount.empty) {
        console.log('[NeuroGestor] Firestore já possui dados — migração ignorada para evitar duplicatas.');
        // Marca como migrado para não verificar novamente (otimização de performance)
        localStorage.setItem(LOCAL_KEYS.MIGRATED, 'true');
        // Remove os dados antigos do localStorage que foram já migrados em sessão anterior
        localStorage.removeItem(LOCAL_KEYS.SURGERIES);
        localStorage.removeItem(LOCAL_KEYS.USERS);
      } else {
        // Firestore está vazio: pode ser um usuário novo — migrar os dados locais
        await migrateLocalToFirestore();
        localStorage.setItem(LOCAL_KEYS.MIGRATED, 'true');
        // Após migração bem-sucedida, limpa os dados brutos do localStorage
        // para que nunca sejam reimportados, mesmo que a flag some
        localStorage.removeItem(LOCAL_KEYS.SURGERIES);
        localStorage.removeItem(LOCAL_KEYS.USERS);
      }
    } catch (err) {
      console.error('[NeuroGestor] Erro durante a verificação/migração:', err);
    }
  }

  // Garantir seeding das senhas caso a coleção esteja vazia
  await seedInitialPasswords();
};

const seedInitialPasswords = async () => {
  const existing = await getDocs(collection(db, COLLECTIONS.PASSWORDS));
  if (existing.empty) {
    const initial: PasswordEntry[] = [
      { id: 'madre-teresa', hospital: 'Madre Teresa', system: 'Sistema', login: 'marcos.camarinha', pass: 'MFcda178299' },
      { id: 'felicio-rocho', hospital: 'Felício Rocho', system: 'Sistema', login: 'M047468', pass: 'm#178299' },
      { id: 'mater-dei', hospital: 'MaterDei', system: 'Sistema', login: '07310288645', pass: 'Mfca#178299Jgc@' },
      { id: 'unimed-mv', hospital: 'Unimed', system: 'Sistema MV', login: 'CRM47468 (CPF: 07310288645)', pass: 'Nuvem#01sol' },
      { id: 'unimed-pc', hospital: 'Unimed', system: 'Login PC', login: 'CRM47468', pass: 'Nuvem#01sol' },
      { id: 'unimed-ass', hospital: 'Unimed', system: 'Assinatura Eletrônica', login: 'CRM47468', pass: 'Mfca178299#' }
    ];
    for (const p of initial) {
      await setDoc(doc(db, COLLECTIONS.PASSWORDS, p.id), p);
    }
  }
};

/**
 * Migra dados existentes do localStorage para o Firestore.
 */
const migrateLocalToFirestore = async () => {
  try {
    // Migrar cirurgias
    const localSurgeries = localStorage.getItem(LOCAL_KEYS.SURGERIES);
    if (localSurgeries) {
      const surgeries: Surgery[] = JSON.parse(localSurgeries);
      if (surgeries.length > 0) {
        // Usar batches para eficiência (máx 500 por batch)
        const batchSize = 450;
        for (let i = 0; i < surgeries.length; i += batchSize) {
          const batch = writeBatch(db);
          const chunk = surgeries.slice(i, i + batchSize);
          chunk.forEach(s => {
            const ref = doc(db, COLLECTIONS.SURGERIES, s.id);
            batch.set(ref, s, { merge: true });
          });
          await batch.commit();
        }
        console.log(`[NeuroGestor] Migradas ${surgeries.length} cirurgias para Firestore.`);
      }
    }

    // Migrar usuários
    const localUsers = localStorage.getItem(LOCAL_KEYS.USERS);
    if (localUsers) {
      const users: User[] = JSON.parse(localUsers);
      if (users.length > 0) {
        const batch = writeBatch(db);
        users.forEach(u => {
          const ref = doc(db, COLLECTIONS.USERS, u.email);
          batch.set(ref, u, { merge: true });
        });
        await batch.commit();
        console.log(`[NeuroGestor] Migrados ${users.length} usuários para Firestore.`);
      }
    }

    // Migrar médicos e hospitais para config
    const localDoctors = localStorage.getItem(LOCAL_KEYS.DOCTORS);
    if (localDoctors) {
      await setDoc(doc(db, COLLECTIONS.CONFIG, 'doctors'), { list: JSON.parse(localDoctors) }, { merge: true });
    }
    const localHospitals = localStorage.getItem(LOCAL_KEYS.HOSPITALS);
    if (localHospitals) {
      await setDoc(doc(db, COLLECTIONS.CONFIG, 'hospitals'), { list: JSON.parse(localHospitals) }, { merge: true });
    }

    // Migrar categorias aprendidas
    const localLearned = localStorage.getItem(LOCAL_KEYS.LEARNED_CATEGORIES);
    if (localLearned) {
      const learned: Record<string, Category> = JSON.parse(localLearned);
      const batch = writeBatch(db);
      Object.entries(learned).forEach(([proc, cat]) => {
        const id = proc.trim().toLowerCase();
        if (id) {
          const ref = doc(db, COLLECTIONS.LEARNED_CATEGORIES, id);
          batch.set(ref, { id, category: cat, updated_at: Date.now() }, { merge: true });
        }
      });
      await batch.commit();
      console.log(`[NeuroGestor] Migradas ${Object.keys(learned).length} categorias aprendidas.`);
    }
  } catch (error) {
    console.error('[NeuroGestor] Erro na migração:', error);
  }
};

// ============================================================
// UTILIDADE: Limpa valores undefined (Firestore rejeita undefined)
// ============================================================

/**
 * Remove todas as propriedades com valor `undefined` de um objeto.
 * O Firestore SDK v9+ lança erro se encontrar valores undefined no setDoc.
 */
const cleanUndefined = <T extends Record<string, any>>(obj: T): T => {
  const cleaned = { ...obj };
  Object.keys(cleaned).forEach(key => {
    if (cleaned[key] === undefined) {
      delete cleaned[key];
    }
  });
  return cleaned;
};

// ============================================================
// CIRURGIAS (CRUD)
// ============================================================

export const getSurgeries = (): Surgery[] => {
  if (surgeriesCache !== null) return surgeriesCache;
  // Fallback para localStorage (offline ou antes do listener conectar)
  const data = localStorage.getItem(LOCAL_KEYS.SURGERIES);
  return data ? JSON.parse(data) : [];
};

export const saveSurgery = async (surgery: Surgery) => {
  const user = getSession();
  const surgeryWithOwner = cleanUndefined({
    ...surgery,
    owner_email: surgery.owner_email || user?.email || 'legacy'
  });

  // Atualiza Firestore (fonte primária)
  await setDoc(doc(db, COLLECTIONS.SURGERIES, surgery.id), surgeryWithOwner);

  // Atualiza localStorage como backup (silencioso se falhar por falta de espaço)
  try {
    const surgeries = getSurgeries();
    const index = surgeries.findIndex(s => s.id === surgery.id);
    if (index >= 0) {
      surgeries[index] = surgeryWithOwner;
    } else {
      surgeries.push(surgeryWithOwner);
    }
    localStorage.setItem(LOCAL_KEYS.SURGERIES, JSON.stringify(surgeries));
  } catch (e) {
    console.warn('[NeuroGestor] Falha ao atualizar cache local (Quota?). Firestore já salvo com sucesso.');
  }
};

export const saveSurgeriesBatch = async (newSurgeries: Surgery[]) => {
  const existing = getSurgeries();
  const toAdd: Surgery[] = [];

  newSurgeries.forEach(newItem => {
    const itemWithId = {
      ...newItem,
      id: newItem.id || crypto.randomUUID()
    };
    const isDuplicate = existing.some(old =>
      old.paciente.trim().toLowerCase() === itemWithId.paciente.trim().toLowerCase() &&
      old.data === itemWithId.data &&
      old.procedimento.trim().toLowerCase() === itemWithId.procedimento.trim().toLowerCase()
    );
    if (!isDuplicate) {
      toAdd.push(itemWithId);
    }
  });

  if (toAdd.length === 0) return;

  // Salva no Firestore em batches
  try {
    const user = getSession();
    const batchSize = 450;
    for (let i = 0; i < toAdd.length; i += batchSize) {
      const batch = writeBatch(db);
      const chunk = toAdd.slice(i, i + batchSize);
      chunk.forEach(s => {
        const surgeryWithOwner = cleanUndefined({
          ...s,
          owner_email: s.owner_email || user?.email || 'legacy'
        });
        batch.set(doc(db, COLLECTIONS.SURGERIES, s.id), surgeryWithOwner);
      });
      await batch.commit();
    }
  } catch (error) {
    console.error('[NeuroGestor] Erro ao salvar batch no Firestore:', error);
  }

  // Atualiza cache em memória e localStorage
  const combined = [...existing, ...toAdd];
  if (surgeriesCache !== null) {
    surgeriesCache = combined;
  }
  try {
    localStorage.setItem(LOCAL_KEYS.SURGERIES, JSON.stringify(combined));
  } catch (e) {
    console.warn('[NeuroGestor] LocalStorage cheio ao salvar batch.');
  }
};

export const updateSurgeriesBatch = async (updatedSurgeries: Surgery[]) => {
  if (updatedSurgeries.length === 0) return;

  // Salva no Firestore em batches (Update/Set com merge)
  try {
    const user = getSession();
    const batchSize = 450;
    for (let i = 0; i < updatedSurgeries.length; i += batchSize) {
      const batch = writeBatch(db);
      const chunk = updatedSurgeries.slice(i, i + batchSize);
      chunk.forEach(s => {
        const surgeryWithOwner = cleanUndefined({
          ...s,
          owner_email: s.owner_email || user?.email || 'legacy'
        });
        batch.set(doc(db, COLLECTIONS.SURGERIES, s.id), surgeryWithOwner, { merge: true });
      });
      await batch.commit();
    }
  } catch (error) {
    console.error('[NeuroGestor] Erro ao atualizar batch no Firestore:', error);
  }

  const existing = getSurgeries();
  const map = new Map(existing.map(s => [s.id, s]));
  updatedSurgeries.forEach(s => map.set(s.id, s));
  const newArray = Array.from(map.values());

  if (surgeriesCache !== null) {
    surgeriesCache = newArray;
  }
  try {
    localStorage.setItem(LOCAL_KEYS.SURGERIES, JSON.stringify(newArray));
  } catch (e) {
    console.warn('[NeuroGestor] Erro ao atualizar cache no localStorage.');
  }
};

export const deleteSurgery = async (id: string) => {
  if (!id) return;
  try {
    await deleteDoc(doc(db, COLLECTIONS.SURGERIES, id));
  } catch (err) {
    console.warn('[NeuroGestor] Erro ao excluir do Firestore:', err);
  }

  if (surgeriesCache !== null) {
    surgeriesCache = surgeriesCache.filter(s => s.id !== id);
  }

  // Atualiza localStorage como backup
  try {
    const surgeries = getSurgeries();
    const filtered = surgeries.filter(s => s.id !== id);
    localStorage.setItem(LOCAL_KEYS.SURGERIES, JSON.stringify(filtered));
  } catch (e) {
    console.warn('[NeuroGestor] Falha ao atualizar cache local após exclusão.');
  }
};

export const deleteSurgeriesBatch = async (ids: string[], onProgress?: (progress: number) => void) => {
  if (!ids || ids.length === 0) return;

  // Filtrar e deduplicar IDs válidos
  const validIds = Array.from(new Set(ids.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)));
  if (validIds.length === 0) return;

  // Deleção no Firestore em lotes
  try {
    const batchSize = 450;
    const totalBatches = Math.ceil(validIds.length / batchSize);

    for (let i = 0; i < validIds.length; i += batchSize) {
      const chunk = validIds.slice(i, i + batchSize);
      try {
        const batch = writeBatch(db);
        chunk.forEach(id => {
          const cleanId = id.trim();
          if (cleanId && !cleanId.includes('/')) {
            batch.delete(doc(db, COLLECTIONS.SURGERIES, cleanId));
          }
        });
        await batch.commit();
      } catch (batchErr) {
        console.warn('[NeuroGestor] Batch delete falhou, tentando deleção individual no Firestore:', batchErr);
        for (const id of chunk) {
          const cleanId = id.trim();
          if (cleanId && !cleanId.includes('/')) {
            try {
              await deleteDoc(doc(db, COLLECTIONS.SURGERIES, cleanId));
            } catch (e) {
              console.warn(`[NeuroGestor] Erro ao deletar doc ${cleanId}:`, e);
            }
          }
        }
      }

      if (onProgress) {
        const currentBatch = Math.floor(i / batchSize) + 1;
        onProgress((currentBatch / totalBatches) * 100);
      }
    }
  } catch (error) {
    console.error('[NeuroGestor] Erro durante deleteSurgeriesBatch:', error);
  }

  // Atualizar cache em memória e LocalStorage
  if (surgeriesCache !== null) {
    surgeriesCache = surgeriesCache.filter(s => !validIds.includes(s.id));
  }

  try {
    const surgeries = getSurgeries();
    const filtered = surgeries.filter(s => !validIds.includes(s.id));
    localStorage.setItem(LOCAL_KEYS.SURGERIES, JSON.stringify(filtered));
  } catch (e) {
    console.warn('[NeuroGestor] Erro ao atualizar cache no LocalStorage.');
  }
};

/**
 * Detecta e remove cirurgias duplicadas no Firestore.
 * Considera duplicata quando: mesmo owner_email + paciente + data + procedimento.
 * Mantém apenas o registro com o menor ID (normalmente o primeiro inserido).
 * Retorna a quantidade de duplicatas removidas.
 */
export const deduplicateSurgeries = async (): Promise<number> => {
  const snap = await getDocs(collection(db, COLLECTIONS.SURGERIES));
  const all: Surgery[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as Surgery));

  const seen = new Map<string, string>(); // key -> id do registro mantido
  const toDeleteSet = new Set<string>(); // Usar Set para evitar IDs duplicados

  const normalize = (str: string = '') =>
    str.normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ');

  for (const s of all) {
    if (!s.id) continue;

    // VOLTANDO ATRÁS: Adicionando owner_email na chave de unicidade para ser MAIS SEGURO.
    // Só consideramos duplicata se for o MESMO usuário, mesmo paciente e mesma data.
    const key = [
      s.owner_email || 'anonymous',
      normalize(s.paciente),
      (s.data || '').trim()
    ].join('|');

    if (seen.has(key)) {
      toDeleteSet.add(s.id);
    } else {
      seen.set(key, s.id);
    }
  }

  const toDelete = Array.from(toDeleteSet);

  if (toDelete.length > 0) {
    console.log(`[NeuroGestor] Iniciando exclusão de ${toDelete.length} duplicatas...`);
    await deleteSurgeriesBatch(toDelete);
  }

  return toDelete.length;
};

/**
 * Importa um array de cirurgias para o Firestore em lotes.
 * Usa a sessão autenticada do browser — funciona sem credenciais externas.
 * @param surgeries    Array de cirurgias a importar
 * @param onProgress   Callback com % de progresso
 * @returns            Quantidade de cirurgias importadas com sucesso
 */
export const importSurgeriesFromJSON = async (
  surgeries: Surgery[],
  onProgress?: (progress: number, count: number, total: number) => void
): Promise<number> => {
  if (surgeries.length === 0) return 0;

  const batchSize = 400;
  let imported = 0;
  const total = surgeries.length;

  for (let i = 0; i < total; i += batchSize) {
    const chunk = surgeries.slice(i, i + batchSize);
    const batch = writeBatch(db);

    chunk.forEach(surgery => {
      const ref = doc(db, COLLECTIONS.SURGERIES, surgery.id);
      batch.set(ref, surgery);
    });

    await batch.commit();
    imported += chunk.length;

    if (onProgress) {
      onProgress(Math.round((imported / total) * 100), imported, total);
    }
  }

  console.log(`[NeuroGestor] ${imported} cirurgias importadas com sucesso.`);
  return imported;
};

/**
 * Recalcula o preço e categoria de todas as cirurgias no Firestore.
 * Útil para corrigir dados importados com regras antigas.
 * @param onProgress Callback de progresso
 * @returns Quantidade de cirurgias alteradas
 */
export const reprocessSurgeriesPrices = async (
  onProgress?: (progress: number, count: number, total: number) => void
): Promise<number> => {
  const { calculatePrice, getCategoryFromText } = await import('../utils');
  const snap = await getDocs(collection(db, COLLECTIONS.SURGERIES));
  const surgeries = snap.docs.map(d => ({ id: d.id, ...d.data() } as Surgery));
  const total = surgeries.length;
  let updatedCount = 0;
  const batchSize = 450;

  for (let i = 0; i < total; i += batchSize) {
    const chunk = surgeries.slice(i, i + batchSize);
    const batch = writeBatch(db);
    let chunkUpdated = false;

    chunk.forEach(s => {
      const newCategory = getCategoryFromText(s.procedimento);
      const newPrice = calculatePrice(s.procedimento, newCategory);

      if (s.valor_estimado !== newPrice || s.categoria !== newCategory) {
        batch.update(doc(db, COLLECTIONS.SURGERIES, s.id), {
          valor_estimado: newPrice,
          categoria: newCategory
        });
        chunkUpdated = true;
        updatedCount++;
      }
    });

    if (chunkUpdated) {
      await batch.commit();
    }

    if (onProgress) {
      onProgress(Math.round(((i + chunk.length) / total) * 100), i + chunk.length, total);
    }
  }

  return updatedCount;
};

// ============================================================
// USUÁRIOS
// ============================================================

export const getUsers = (): User[] => {
  if (usersCache !== null && usersCache.length > 0) return usersCache;
  const data = localStorage.getItem(LOCAL_KEYS.USERS);
  return data ? JSON.parse(data) : [];
};

export const saveUser = async (user: User) => {
  try {
    await setDoc(doc(db, COLLECTIONS.USERS, user.email), user, { merge: true });
  } catch (error) {
    console.error('[NeuroGestor] Erro ao salvar usuário no Firestore:', error);
  }
  const users = getUsers();
  const index = users.findIndex(u => u.email === user.email);
  if (index >= 0) {
    users[index] = { ...users[index], ...user };
  } else {
    users.push(user);
  }

  try {
    localStorage.setItem(LOCAL_KEYS.USERS, JSON.stringify(users));
  } catch (e) {
    console.warn('[NeuroGestor] Falha ao persistir usuários localmente.');
  }
};

export const updateUserStatus = async (email: string, status: 'APPROVED' | 'DENIED' | 'PENDING') => {
  const users = getUsers();
  const user = users.find(u => u.email === email);
  if (user) {
    user.status = status;
    try {
      await setDoc(doc(db, COLLECTIONS.USERS, email), { status }, { merge: true });
    } catch (error) {
      console.error('[NeuroGestor] Erro ao atualizar status no Firestore:', error);
    }
    localStorage.setItem(LOCAL_KEYS.USERS, JSON.stringify(users));

    const session = getSession();
    if (session && session.email === email) {
      setSession({ ...session, status });
    }
  }
};

export const updateUserRole = async (email: string, role: User['role']) => {
  const users = getUsers();
  const user = users.find(u => u.email === email);
  if (user) {
    user.role = role;
    try {
      await setDoc(doc(db, COLLECTIONS.USERS, email), { role }, { merge: true });
    } catch (error) {
      console.error('[NeuroGestor] Erro ao atualizar role no Firestore:', error);
    }
    localStorage.setItem(LOCAL_KEYS.USERS, JSON.stringify(users));

    const session = getSession();
    if (session && session.email === email) {
      setSession({ ...session, role });
    }
  }
};

export const updateUserFcmToken = async (email: string, token: string) => {
  const users = getUsers();
  const user = users.find(u => u.email === email);
  if (user) {
    user.fcmToken = token;
    try {
      await setDoc(doc(db, COLLECTIONS.USERS, email), { fcmToken: token }, { merge: true });
    } catch (error) {
      console.error('[NeuroGestor] Erro ao atualizar FCM Token no Firestore:', error);
    }
    localStorage.setItem(LOCAL_KEYS.USERS, JSON.stringify(users));

    const session = getSession();
    if (session && session.email === email) {
      setSession({ ...session, fcmToken: token });
    }
  }
};

export const deleteUser = async (email: string) => {
  try {
    await deleteDoc(doc(db, COLLECTIONS.USERS, email));
  } catch (error) {
    console.error('[NeuroGestor] Erro ao deletar usuário do Firestore:', error);
  }
  const users = getUsers();
  const filtered = users.filter(u => u.email !== email);
  localStorage.setItem(LOCAL_KEYS.USERS, JSON.stringify(filtered));
};

// ============================================================
// SESSÃO (apenas local — cada dispositivo mantém sua sessão)
// ============================================================

export const getSession = (): User | null => {
  const data = localStorage.getItem(LOCAL_KEYS.SESSION);
  if (!data) return null;

  const sessionUser = JSON.parse(data) as User;

  // Se ainda não carregamos do Firestore, confiamos no que está no localStorage/Sessão
  if (usersCache === null) {
    const localUsersData = localStorage.getItem(LOCAL_KEYS.USERS);
    if (!localUsersData) return sessionUser; // Primeira vez, confiamos na sessão

    const localUsers = JSON.parse(localUsersData) as User[];
    const match = localUsers.find(u => u.email === sessionUser.email);
    return match || sessionUser;
  }

  const freshUser = usersCache.find(u => u.email === sessionUser.email);

  if (!freshUser) {
    // Só removemos se tivermos certeza que o usuário não existe mais no banco
    localStorage.removeItem(LOCAL_KEYS.SESSION);
    return null;
  }

  return freshUser;
};

export const setSession = (user: User | null) => {
  if (user) {
    try {
      localStorage.setItem(LOCAL_KEYS.SESSION, JSON.stringify(user));
    } catch (e) {
      console.warn('[NeuroGestor] Erro ao salvar sessão no localStorage (Quota?).');
    }
  } else {
    localStorage.removeItem(LOCAL_KEYS.SESSION);
  }
};

// ============================================================
// CONFIG (Google Client ID, Médicos, Hospitais)
// ============================================================

export const getGoogleClientId = (): string => {
  return localStorage.getItem(LOCAL_KEYS.GOOGLE_CLIENT_ID) || '';
};

export const saveGoogleClientId = (id: string) => {
  localStorage.setItem(LOCAL_KEYS.GOOGLE_CLIENT_ID, id);
};

export const getDoctors = (): string[] => {
  const data = localStorage.getItem(LOCAL_KEYS.DOCTORS);
  const stored: string[] = data ? JSON.parse(data) : [];
  return Array.from(new Set([...SEED_DOCTORS, ...stored])).sort();
};

export const addDoctor = async (name: string) => {
  const doctors = getDoctors();
  if (!doctors.includes(name)) {
    doctors.push(name);
    localStorage.setItem(LOCAL_KEYS.DOCTORS, JSON.stringify(doctors));
    try {
      await setDoc(doc(db, COLLECTIONS.CONFIG, 'doctors'), { list: doctors }, { merge: true });
    } catch (error) {
      console.error('[NeuroGestor] Erro ao salvar médico no Firestore:', error);
    }
  }
};

export const getHospitals = (): string[] => {
  const data = localStorage.getItem(LOCAL_KEYS.HOSPITALS);
  const stored: string[] = data ? JSON.parse(data) : [];
  return Array.from(new Set([...SEED_HOSPITALS, ...stored])).sort();
};

export const addHospital = async (name: string) => {
  const hospitals = getHospitals();
  if (!hospitals.includes(name)) {
    hospitals.push(name);
    localStorage.setItem(LOCAL_KEYS.HOSPITALS, JSON.stringify(hospitals));
    try {
      await setDoc(doc(db, COLLECTIONS.CONFIG, 'hospitals'), { list: hospitals }, { merge: true });
    } catch (error) {
      console.error('[NeuroGestor] Erro ao salvar hospital no Firestore:', error);
    }
  }
};

// ============================================================
// DOCUMENTOS E SENHAS (COMPARTILHADOS NO FIRESTORE)
// ============================================================

export const getPasswords = (): PasswordEntry[] => {
  if (passwordsCache) return passwordsCache;
  const data = localStorage.getItem(LOCAL_KEYS.PASSWORDS);
  return data ? JSON.parse(data) : [];
};

export const savePassword = async (pw: PasswordEntry) => {
  await setDoc(doc(db, COLLECTIONS.PASSWORDS, pw.id), pw);
};

export const deletePassword = async (id: string) => {
  await deleteDoc(doc(db, COLLECTIONS.PASSWORDS, id));
};

export const getReportTemplates = (): ReportTemplate[] => {
  if (reportTemplatesCache) return reportTemplatesCache;
  const data = localStorage.getItem(LOCAL_KEYS.REPORT_TEMPLATES);
  return data ? JSON.parse(data) : [];
};

export const saveReportTemplates = async (templates: ReportTemplate[]) => {
  for (const t of templates) {
    await setDoc(doc(db, COLLECTIONS.REPORT_TEMPLATES, t.id), t);
  }
};

export const deleteReportTemplate = async (id: string) => {
  await deleteDoc(doc(db, COLLECTIONS.REPORT_TEMPLATES, id));
};

export const getElectrodeModels = (): ElectrodeModel[] => {
  if (electrodeModelsCache) return electrodeModelsCache;
  const data = localStorage.getItem(LOCAL_KEYS.ELECTRODE_MODELS);
  return data ? JSON.parse(data) : [];
};

export const saveElectrodeModels = async (models: ElectrodeModel[]) => {
  for (const m of models) {
    await setDoc(doc(db, COLLECTIONS.ELECTRODE_MODELS, m.id), m);
  }
};

export const deleteElectrodeModel = async (id: string) => {
  await deleteDoc(doc(db, COLLECTIONS.ELECTRODE_MODELS, id));
};

// ============================================================
// ADICIONAL: LIMPEZA DE ENTIDADES (MÉDICOS E HOSPITAIS)
// ============================================================

const normalizeEntity = (str: string = '') =>
  str.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/^(dr|dra)\.?\s+/i, '') // Remove Dr. ou Dra. para agrupamento
    .replace(/\s+/g, ' ');

/**
 * Agrupa nomes similares de médicos ou hospitais
 */
export const getEntityClusters = (type: 'medico' | 'hospital'): Record<string, string[]> => {
  const surgeries = getSurgeries();
  const clusters: Record<string, string[]> = {};

  surgeries.forEach(s => {
    const rawName = s[type];
    if (!rawName) return;

    const norm = normalizeEntity(rawName);
    if (!clusters[norm]) {
      clusters[norm] = [];
    }
    if (!clusters[norm].includes(rawName)) {
      clusters[norm].push(rawName);
    }
  });

  // Filtra apenas grupos que tenham mais de um nome (possíveis duplicatas)
  const result: Record<string, string[]> = {};
  Object.keys(clusters).forEach(key => {
    if (clusters[key].length > 1) {
      result[key] = clusters[key];
    }
  });

  return result;
};

/**
 * Substitui todos os nomes de uma lista por um nome canônico
 * Suporta > 500 registros via múltiplos batches
 */
export const mergeEntities = async (type: 'medico' | 'hospital', canonicalName: string, namesToReplace: string[]): Promise<number> => {
  const surgeries = getSurgeries();
  const toUpdate: Surgery[] = [];

  for (const s of surgeries) {
    if (s.id && namesToReplace.includes(s[type] || '')) {
      toUpdate.push(s);
    }
  }

  // Firestore batch limit: 500 operations per batch
  const BATCH_SIZE = 450;
  let count = 0;

  for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
    const chunk = toUpdate.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);
    for (const s of chunk) {
      const docRef = doc(db, COLLECTIONS.SURGERIES, s.id);
      batch.update(docRef, { [type]: canonicalName });
      count++;
    }
    await batch.commit();
  }

  // Atualiza também a lista pré-definida de médicos/hospitals se necessário
  if (type === 'medico') {
    const doctors = getDoctors().filter(d => !namesToReplace.includes(d));
    if (!doctors.includes(canonicalName)) doctors.push(canonicalName);
    localStorage.setItem(LOCAL_KEYS.DOCTORS, JSON.stringify(doctors));
    await setDoc(doc(db, COLLECTIONS.CONFIG, 'doctors'), { list: doctors }, { merge: true });
  } else {
    const hospitals = getHospitals().filter(h => !namesToReplace.includes(h));
    if (!hospitals.includes(canonicalName)) hospitals.push(canonicalName);
    localStorage.setItem(LOCAL_KEYS.HOSPITALS, JSON.stringify(hospitals));
    await setDoc(doc(db, COLLECTIONS.CONFIG, 'hospitals'), { list: hospitals }, { merge: true });
  }

  return count;
};

/**
 * Auto-padroniza TODOS os nomes de médicos e hospitais:
 * - MAIÚSCULAS, sem acentos, espaços compactados
 * - Hospitais: resolve aliases conhecidos
 * Retorna quantidade de registros atualizados.
 */
export const autoNormalizeAllNames = async (onProgress?: (pct: number, count: number, total: number) => void): Promise<number> => {
  // Importações dinâmicas para evitar dependência circular
  const { normalizeName, normalizeHospitalName } = await import('../utils');

  const surgeries = getSurgeries();
  const toUpdate: { id: string; medico: string; hospital: string }[] = [];

  for (const s of surgeries) {
    if (!s.id) continue;
    const normalizedMedico = normalizeName(s.medico || '');
    const normalizedHospital = normalizeHospitalName(s.hospital || '');

    if (normalizedMedico !== (s.medico || '') || normalizedHospital !== (s.hospital || '')) {
      toUpdate.push({
        id: s.id,
        medico: normalizedMedico,
        hospital: normalizedHospital
      });
    }
  }

  if (toUpdate.length === 0) return 0;

  const BATCH_SIZE = 450;
  let processed = 0;

  for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
    const chunk = toUpdate.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);

    for (const item of chunk) {
      const docRef = doc(db, COLLECTIONS.SURGERIES, item.id);
      batch.update(docRef, {
        medico: item.medico,
        hospital: item.hospital
      });
      processed++;
    }

    await batch.commit();

    if (onProgress) {
      const pct = Math.round((processed / toUpdate.length) * 100);
      onProgress(pct, processed, toUpdate.length);
    }
  }

  return processed;
};

// ============================================================
// CATEGORIAS APRENDIDAS (GLOBAL)
// ============================================================

export const getGlobalLearnedCategories = (): Record<string, Category> => {
  if (learnedCategoriesCache) return learnedCategoriesCache;
  const data = localStorage.getItem(LOCAL_KEYS.LEARNED_CATEGORIES);
  return data ? JSON.parse(data) : {};
};

export const saveLearnedCategoryGlobal = async (procedureName: string, category: Category) => {
  const id = procedureName.trim().toLowerCase();
  if (!id) return;

  // Atualiza Firestore
  try {
    const data: LearnedCategory = {
      id,
      category,
      updated_at: Date.now()
    };
    await setDoc(doc(db, COLLECTIONS.LEARNED_CATEGORIES, id), data);
  } catch (error) {
    console.error('[NeuroGestor] Erro ao salvar categoria aprendida globalmente:', error);
  }

  // Atualiza local (o listener do Firestore também fará isso, mas fazemos aqui para feedback imediato)
  const current = getGlobalLearnedCategories();
  current[id] = category;
  localStorage.setItem(LOCAL_KEYS.LEARNED_CATEGORIES, JSON.stringify(current));
  learnedCategoriesCache = current;
};
// ============================================================
// BACKUP (Exportação Completa)
// ============================================================

export const exportFullBackup = async () => {
  try {
    const backup: any = {
      timestamp: new Date().toISOString(),
      version: '1.0',
      data: {
        surgeries: [],
        users: [],
        config: {},
        passwords: [],
        learned_categories: []
      }
    };

    // Cirurgias
    const surgsSnap = await getDocs(collection(db, COLLECTIONS.SURGERIES));
    surgsSnap.forEach(d => backup.data.surgeries.push(d.data()));

    // Usuários
    const usersSnap = await getDocs(collection(db, COLLECTIONS.USERS));
    usersSnap.forEach(d => backup.data.users.push(d.data()));

    // Config (Doctors/Hospitals)
    const configSnap = await getDocs(collection(db, COLLECTIONS.CONFIG));
    configSnap.forEach(d => {
      backup.data.config[d.id] = d.data();
    });

    // Passwords
    const passSnap = await getDocs(collection(db, COLLECTIONS.PASSWORDS));
    passSnap.forEach(d => backup.data.passwords.push(d.data()));

    // Categorias Aprendidas
    const catSnap = await getDocs(collection(db, COLLECTIONS.LEARNED_CATEGORIES));
    catSnap.forEach(d => backup.data.learned_categories.push(d.data()));

    // Trigger Download
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backup, null, 2));
    const dt = new Date();
    const fileName = `neurogestor_backup_${dt.getFullYear()}${(dt.getMonth() + 1).toString().padStart(2, '0')}${dt.getDate().toString().padStart(2, '0')}_${dt.getTime()}.json`;

    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", fileName);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();

    return true;
  } catch (error) {
    console.error("[NeuroGestor] Erro ao exportar backup:", error);
    return false;
  }
};
