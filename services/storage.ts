
import { db } from './firebase';
import {
  collection, doc, getDocs, setDoc, deleteDoc,
  getDoc, writeBatch, query, where, onSnapshot, Unsubscribe
} from 'firebase/firestore';
import { firebaseStorage } from './firebase';
import { auth } from './auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Surgery, Category, User, PasswordEntry, ReportTemplate, ElectrodeModel, LearnedCategory } from '../types';
import { SEED_DOCTORS, SEED_HOSPITALS, isDemoUser, DEMO_USER, isMasterAdmin, isAdminUser } from '../constants';
import { getDemoMockSurgeries, saveDemoMockSurgery, DEMO_FICTITIOUS_PASSWORDS } from './mockDemoData';

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

    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('Sessão de autenticação ausente para upload.');
    const folderSegments = folder.split('/').filter(segment => segment && segment !== '.' && segment !== '..');
    if (folderSegments[0] === 'surgeries') folderSegments.shift();
    const safeFolder = folderSegments.join('/');
    const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storageRef = ref(firebaseStorage, `surgeries/${uid}/${safeFolder}/${safeFilename}`);
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
  GOOGLE_CLIENT_ID: 'neurogestor_google_client_id',
  MIGRATED: 'neurogestor_firestore_migrated',
  PASSWORDS: 'neurogestor_passwords',
  REPORT_TEMPLATES: 'neurogestor_report_templates',
  ELECTRODE_MODELS: 'neurogestor_electrode_models',
  LEARNED_CATEGORIES: 'neuro_learned_categories',
  CACHE_OWNER: 'neurogestor_cache_owner'
};

const normalizeEmail = (email?: string | null) => (email || '').toLowerCase().trim();

export const isPrivilegedUser = (u?: User | null) =>
  Boolean(u && u.status === 'APPROVED' && (isMasterAdmin(u.email) || isAdminUser(u.email) || u.role === 'owner' || u.role === 'admin'));

export const canAccessReferenceData = (u?: User | null) => {
  if (!u) return false;
  if (isPrivilegedUser(u)) return true;
  return u.status === 'APPROVED' && u.role !== 'assistant';
};

// O cache do localStorage só vale para a identidade que o gravou (evita vazamento entre contas no mesmo navegador).
const isCacheOwnedBy = (email?: string | null) => {
  try {
    const owner = localStorage.getItem(LOCAL_KEYS.CACHE_OWNER);
    return !!owner && owner === normalizeEmail(email);
  } catch {
    return false;
  }
};

const clearLocalCaches = () => {
  try {
    localStorage.removeItem(LOCAL_KEYS.SURGERIES);
    localStorage.removeItem(LOCAL_KEYS.USERS);
    localStorage.removeItem(LOCAL_KEYS.DOCTORS);
    localStorage.removeItem(LOCAL_KEYS.HOSPITALS);
    localStorage.removeItem(LOCAL_KEYS.PASSWORDS);
    localStorage.removeItem(LOCAL_KEYS.REPORT_TEMPLATES);
    localStorage.removeItem(LOCAL_KEYS.ELECTRODE_MODELS);
    localStorage.removeItem(LOCAL_KEYS.LEARNED_CATEGORIES);
    localStorage.removeItem(LOCAL_KEYS.CACHE_OWNER);
  } catch (e) {}
};

// ============================================================
// CACHE EM MEMÓRIA (atualizado por listeners em tempo real)
// ============================================================
let surgeriesCache: Surgery[] | null = null;
let usersCache: User[] | null = null;
let usersCacheOwner: { email: string; uid?: string } | null = null;
let memoryCacheOwner: { email: string; uid?: string } | null = null;
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
let currentListenerEmail: string | null = null;
let sessionMemory: User | null = null;

const syncMemoryCacheOwner = () => {
  const session = getSession();
  if (session?.email) {
    memoryCacheOwner = {
      email: normalizeEmail(session.email),
      uid: session.auth_uid
    };
  } else {
    memoryCacheOwner = null;
  }
  usersCacheOwner = memoryCacheOwner;
};

const syncUsersCacheOwner = () => {
  syncMemoryCacheOwner();
};

const isMemoryCacheValidForActiveSession = (): boolean => {
  const session = getSession();
  if (!session?.email || !memoryCacheOwner) return false;
  const currentEmail = normalizeEmail(session.email);
  const currentUid = session.auth_uid;
  return memoryCacheOwner.email === currentEmail &&
    (!currentUid || !memoryCacheOwner.uid || memoryCacheOwner.uid === currentUid);
};

/**
 * Encerra todas as conexões em tempo real e limpa os dados em memória/disco
 * ao deslogar ou trocar de usuário, garantindo isolamento total (LGPD/HIPAA).
 */
export const cleanupStorageSession = () => {
  if (surgeriesUnsub) {
    try { surgeriesUnsub(); } catch (e) {}
    surgeriesUnsub = null;
  }
  if (usersUnsub) {
    try { usersUnsub(); } catch (e) {}
    usersUnsub = null;
  }
  if (passwordsUnsub) {
    try { passwordsUnsub(); } catch (e) {}
    passwordsUnsub = null;
  }
  if (reportTemplatesUnsub) {
    try { reportTemplatesUnsub(); } catch (e) {}
    reportTemplatesUnsub = null;
  }
  if (electrodeModelsUnsub) {
    try { electrodeModelsUnsub(); } catch (e) {}
    electrodeModelsUnsub = null;
  }
  if (learnedCategoriesUnsub) {
    try { learnedCategoriesUnsub(); } catch (e) {}
    learnedCategoriesUnsub = null;
  }
  surgeriesCache = null;
  usersCache = null;
  usersCacheOwner = null;
  passwordsCache = null;
  reportTemplatesCache = null;
  electrodeModelsCache = null;
  learnedCategoriesCache = null;
  memoryCacheOwner = null;
  currentListenerEmail = null;

  clearLocalCaches();
};

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
  const user = getSession();
  if (user && (user.is_demo || isDemoUser(user))) {
    cb(DEMO_FICTITIOUS_PASSWORDS);
    return () => {};
  }
  if (!user || !isPrivilegedUser(user)) {
    cb([]);
    return () => {};
  }
  listeners.passwords.push(cb);
  if (passwordsCache) cb(passwordsCache);
  return () => { listeners.passwords = listeners.passwords.filter(l => l !== cb); };
};

export const subscribeToReports = (cb: DataCallback<ReportTemplate>) => {
  const user = getSession();
  if (user && (user.is_demo || isDemoUser(user))) {
    cb([]);
    return () => {};
  }
  if (!user || !canAccessReferenceData(user)) {
    cb([]);
    return () => {};
  }
  listeners.reports.push(cb);
  if (reportTemplatesCache) cb(reportTemplatesCache);
  return () => { listeners.reports = listeners.reports.filter(l => l !== cb); };
};

export const subscribeToElectrodes = (cb: DataCallback<ElectrodeModel>) => {
  const user = getSession();
  if (user && (user.is_demo || isDemoUser(user))) {
    cb([]);
    return () => {};
  }
  if (!user || !canAccessReferenceData(user)) {
    cb([]);
    return () => {};
  }
  listeners.electrodes.push(cb);
  if (electrodeModelsCache) cb(electrodeModelsCache);
  return () => { listeners.electrodes = listeners.electrodes.filter(l => l !== cb); };
};

// ============================================================
// INICIALIZAÇÃO E MIGRAÇÃO
// ============================================================

/**
 * Deve ser chamado uma vez ao carregar o app ou ao trocar de sessão.
 * - Configura listeners em tempo real do Firestore com isolamento por usuário.
 * - Migra dados antigos do localStorage se existirem.
 */
export const initStorage = async () => {
  const currentSession = getSession();
  if (currentSession && (currentSession.is_demo || isDemoUser(currentSession))) {
    console.log('[NeuroGestor] Modo Demonstração: Listeners do Firestore desativados para isolamento total de dados reais.');
    return;
  }

  const sessionEmail = currentSession?.email?.toLowerCase().trim() || null;

  // Se o usuário mudou (ex: logout de Rafael e login de Michel), reinicia listeners
  if (currentListenerEmail !== null && currentListenerEmail !== sessionEmail) {
    cleanupStorageSession();
  }

  // Cache de outra identidade (ou sem dono, de versões anteriores) é descartado ANTES de iniciar os listeners.
  if (!sessionEmail || !isCacheOwnedBy(sessionEmail)) {
    clearLocalCaches();
  }
  if (sessionEmail) {
    try { localStorage.setItem(LOCAL_KEYS.CACHE_OWNER, sessionEmail); } catch (e) {}
  }

  if (surgeriesUnsub) return;
  currentListenerEmail = sessionEmail;
  const listenerSessionEmail = sessionEmail;
  const listenerSessionUid = currentSession?.auth_uid;

  const isListenerActiveForCurrentSession = (): boolean => {
    const active = getSession();
    if (!active?.email) return false;
    const activeEmail = normalizeEmail(active.email);
    if (activeEmail !== listenerSessionEmail) return false;
    if (listenerSessionUid && active.auth_uid && active.auth_uid !== listenerSessionUid) return false;
    return true;
  };

  const isOwnerOrAdmin = isPrivilegedUser(currentSession);

  // Consulta do Firestore com isolamento estrito:
  // Se for Master Admin / Admin / Owner (aprovado): escuta coleção inteira para gestão da equipe
  // O papel 'assistant' NÃO entra aqui: as regras do Firestore só liberam as próprias cirurgias para ele
  // Se for médico / usuário comum: escuta ESTRITAMENTE as cirurgias onde owner_email == seu email
  const surgeriesQuery = (isOwnerOrAdmin || !sessionEmail)
    ? collection(db, COLLECTIONS.SURGERIES)
    : query(collection(db, COLLECTIONS.SURGERIES), where('owner_email', '==', sessionEmail));

  // Listener de cirurgias em tempo real
  surgeriesUnsub = onSnapshot(
    surgeriesQuery,
    (snapshot) => {
      if (!isListenerActiveForCurrentSession()) return;
      surgeriesCache = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Surgery));
      syncMemoryCacheOwner();
      // Atualiza localStorage como cache offline (silencioso se falhar por falta de espaço)
      try {
        if (sessionEmail && isCacheOwnedBy(sessionEmail)) {
          localStorage.setItem(LOCAL_KEYS.SURGERIES, JSON.stringify(surgeriesCache));
        }
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
  const usersQuery = isOwnerOrAdmin
    ? collection(db, COLLECTIONS.USERS)
    : query(collection(db, COLLECTIONS.USERS), where('email', '==', sessionEmail));

  usersUnsub = onSnapshot(
    usersQuery,
    (snapshot) => {
      if (!isListenerActiveForCurrentSession()) return;
      usersCache = snapshot.docs.map(d => d.data() as User);
      syncMemoryCacheOwner();
      if (sessionEmail && isCacheOwnedBy(sessionEmail)) {
        localStorage.setItem(LOCAL_KEYS.USERS, JSON.stringify(usersCache));
      }
    },
    (error) => {
      console.warn('[NeuroGestor] Firestore users listener error:', error);
    }
  );

  // listeners de documentos e senhas: não iniciar em coleções negadas
  if (isOwnerOrAdmin) {
    passwordsUnsub = onSnapshot(collection(db, COLLECTIONS.PASSWORDS), (snap) => {
      if (!isListenerActiveForCurrentSession()) return;
      // Credential records are intentionally kept in memory only.
      passwordsCache = snap.docs.map(d => d.data() as PasswordEntry);
      syncMemoryCacheOwner();
      listeners.passwords.forEach(cb => cb(passwordsCache!));
    }, (error) => {
      console.warn('[NeuroGestor] Não foi possível carregar o cofre de credenciais:', error.code);
    });
  }

  if (canAccessReferenceData(currentSession)) {
    reportTemplatesUnsub = onSnapshot(collection(db, COLLECTIONS.REPORT_TEMPLATES), (snap) => {
      if (!isListenerActiveForCurrentSession()) return;
      reportTemplatesCache = snap.docs.map(d => d.data() as ReportTemplate);
      syncMemoryCacheOwner();
      if (sessionEmail && isCacheOwnedBy(sessionEmail)) {
        localStorage.setItem(LOCAL_KEYS.REPORT_TEMPLATES, JSON.stringify(reportTemplatesCache));
      }
      listeners.reports.forEach(cb => cb(reportTemplatesCache!));
    }, (error) => {
      console.warn('[NeuroGestor] Modelos de relatório indisponíveis para este perfil:', error.code);
    });

    electrodeModelsUnsub = onSnapshot(collection(db, COLLECTIONS.ELECTRODE_MODELS), (snap) => {
      if (!isListenerActiveForCurrentSession()) return;
      electrodeModelsCache = snap.docs.map(d => d.data() as ElectrodeModel);
      syncMemoryCacheOwner();
      if (sessionEmail && isCacheOwnedBy(sessionEmail)) {
        localStorage.setItem(LOCAL_KEYS.ELECTRODE_MODELS, JSON.stringify(electrodeModelsCache));
      }
      listeners.electrodes.forEach(cb => cb(electrodeModelsCache!));
    }, (error) => {
      console.warn('[NeuroGestor] Modelos de eletrodo indisponíveis para este perfil:', error.code);
    });
  }

  // Listener de categorias aprendidas
  learnedCategoriesUnsub = onSnapshot(collection(db, COLLECTIONS.LEARNED_CATEGORIES), (snap) => {
    if (!isListenerActiveForCurrentSession()) return;
    const fresh: Record<string, Category> = {};
    snap.docs.forEach(d => {
      const data = d.data() as LearnedCategory;
      fresh[d.id] = data.category;
    });
    learnedCategoriesCache = fresh;
    syncMemoryCacheOwner();
    localStorage.setItem(LOCAL_KEYS.LEARNED_CATEGORIES, JSON.stringify(fresh));
  });

  // Migrar dados do localStorage para Firestore (apenas uma vez)
  // IMPORTANTE: Verificamos o Firestore PRIMEIRO para evitar duplicatas em hot-reloads.
  // O localStorage sozinho não é confiável pois pode ser limpo a qualquer momento.
  const alreadyMigrated = localStorage.getItem(LOCAL_KEYS.MIGRATED);
  if (!alreadyMigrated) {
    try {
      // Verificação primária: O Firestore já tem dados? Se sim, não há nada para migrar.
      const firestoreCount = await getDocs(surgeriesQuery);
      if (!firestoreCount.empty) {
        console.log('[NeuroGestor] Firestore já possui dados — migração ignorada para evitar duplicatas.');
        // Marca como migrado para não verificar novamente (otimização de performance)
        localStorage.setItem(LOCAL_KEYS.MIGRATED, 'true');
        // Remove os dados antigos do localStorage que foram já migrados em sessão anterior
        localStorage.removeItem(LOCAL_KEYS.SURGERIES);
        localStorage.removeItem(LOCAL_KEYS.USERS);
      } else {
        // Firestore está vazio: pode ser um usuário novo — migrar os dados locais
        await migrateLocalToFirestore(sessionEmail, Boolean(isOwnerOrAdmin));
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
};

/**
 * Migra dados existentes do localStorage para o Firestore.
 */
const migrateLocalToFirestore = async (sessionEmail: string | null, isOwnerOrAdmin: boolean) => {
  try {
    // Migrar cirurgias
    const localSurgeries = localStorage.getItem(LOCAL_KEYS.SURGERIES);
    if (localSurgeries) {
      const surgeries: Surgery[] = JSON.parse(localSurgeries);
      const scopedSurgeries = isOwnerOrAdmin
        ? surgeries
        : surgeries.filter(s => s.owner_email === sessionEmail);
      if (scopedSurgeries.length > 0) {
        // Usar batches para eficiência (máx 500 por batch)
        const batchSize = 450;
        for (let i = 0; i < scopedSurgeries.length; i += batchSize) {
          const batch = writeBatch(db);
          const chunk = scopedSurgeries.slice(i, i + batchSize);
          chunk.forEach(s => {
            const ref = doc(db, COLLECTIONS.SURGERIES, s.id);
            batch.set(ref, s, { merge: true });
          });
          await batch.commit();
        }
        console.log(`[NeuroGestor] Migradas ${scopedSurgeries.length} cirurgias para Firestore.`);
      }
    }

    // Migrar usuários
    const localUsers = isOwnerOrAdmin ? localStorage.getItem(LOCAL_KEYS.USERS) : null;
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
    const localDoctors = isOwnerOrAdmin && isCacheOwnedBy(sessionEmail) ? localStorage.getItem(LOCAL_KEYS.DOCTORS) : null;
    if (localDoctors) {
      await setDoc(doc(db, COLLECTIONS.CONFIG, 'doctors'), { list: JSON.parse(localDoctors) }, { merge: true });
    }
    const localHospitals = isOwnerOrAdmin && isCacheOwnedBy(sessionEmail) ? localStorage.getItem(LOCAL_KEYS.HOSPITALS) : null;
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
  const user = getSession();
  if (user && (user.is_demo || isDemoUser(user))) {
    return getDemoMockSurgeries();
  }
  if (!user) return [];
  const scope = (items: Surgery[]) =>
    isPrivilegedUser(user)
      ? items
      : items.filter(s => normalizeEmail(s.owner_email) === normalizeEmail(user.email));
  if (surgeriesCache !== null) {
    if (isMemoryCacheValidForActiveSession()) {
      return scope(surgeriesCache);
    }
    surgeriesCache = null;
  }
  // Fallback para localStorage (offline ou antes do listener conectar), apenas se o cache for desta identidade
  if (!isCacheOwnedBy(user.email)) return [];
  const data = localStorage.getItem(LOCAL_KEYS.SURGERIES);
  if (!data) return [];
  try {
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? scope(parsed) : [];
  } catch {
    localStorage.removeItem(LOCAL_KEYS.SURGERIES);
    return [];
  }
};

export const saveSurgery = async (surgery: Surgery) => {
  const user = getSession();
  if (user && (user.is_demo || isDemoUser(user))) {
    saveDemoMockSurgery(surgery);
    return;
  }
  if (!user) throw new Error('Sessão de autenticação ausente.');
  const surgeryWithOwner = cleanUndefined({
    ...surgery,
    owner_email: surgery.owner_email || user.email
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
    surgeriesCache = surgeries;
    syncMemoryCacheOwner();
    localStorage.setItem(LOCAL_KEYS.SURGERIES, JSON.stringify(surgeries));
  } catch (e) {
    console.warn('[NeuroGestor] Falha ao atualizar cache local (Quota?). Firestore já salvo com sucesso.');
  }
};

const stableSurgeryId = async (key: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
  const hex = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
  return `imp_${hex.slice(0, 32)}`;
};

export const saveSurgeriesBatch = async (newSurgeries: Array<Omit<Surgery, 'id'> & { id?: string }>): Promise<number> => {
  if (!newSurgeries || newSurgeries.length === 0) return 0;

  const user = getSession();
  if (user && (user.is_demo || isDemoUser(user))) {
    newSurgeries.forEach(s => saveDemoMockSurgery(s as Surgery));
    return newSurgeries.length;
  }
  if (!user) throw new Error('Sessão de autenticação ausente.');
  const existing = getSurgeries();
  const toAdd: Surgery[] = [];

  const normalize = (v: any) =>
    typeof v === 'string'
      ? v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
      : '';

  // Filtra cirurgias existentes pertencentes ao usuário logado para evitar falsos positivos com outras contas
  const userExisting = user?.email
    ? existing.filter(s => s.owner_email === user.email)
    : existing;

  // IDs derivados do conteúdo: o mesmo lote reenviado após falha parcial gera os mesmos IDs (set idempotente).
  const occurrences = new Map<string, number>();
  const withIds: Surgery[] = [];
  for (const newItem of newSurgeries) {
    const owner = newItem.owner_email || user.email;
    let id = newItem.id?.trim();
    if (!id) {
      const key = [owner, normalize(newItem.paciente), (newItem.data || '').trim(), normalize(newItem.procedimento)]
        .map(p => normalizeEmail(p)).join('|');
      const n = (occurrences.get(key) || 0) + 1;
      occurrences.set(key, n);
      id = await stableSurgeryId(`${key}#${n}`);
    }
    withIds.push({ ...newItem, id, owner_email: owner } as Surgery);
  }

  withIds.forEach(itemWithId => {

    const isDuplicate = userExisting.some(old => {
      const oldPat = normalize(old.paciente);
      const newPat = normalize(itemWithId.paciente);
      const oldDate = (old.data || '').trim();
      const newDate = (itemWithId.data || '').trim();
      const oldProc = normalize(old.procedimento);
      const newProc = normalize(itemWithId.procedimento);

      // Não descarta se o nome for genérico ou vazio (o usuário pode estar importando para revisar)
      if (!oldPat || !newPat || newPat === 'paciente nao identificado' || newPat === 'nao informado') {
        return false;
      }

      // Duplicata idêntica: mesmo paciente, mesma data e mesmo procedimento
      return oldPat === newPat && oldDate === newDate && oldProc === newProc;
    });

    if (!isDuplicate) {
      toAdd.push(itemWithId);
    }
  });

  if (toAdd.length === 0) {
    console.warn('[NeuroGestor] saveSurgeriesBatch: Todas as cirurgias do lote já existem para este usuário.');
    return 0;
  }

  // Salva no Firestore em lotes seguros
  const batchSize = 400;
  let committed = 0;
  try {
    for (let i = 0; i < toAdd.length; i += batchSize) {
      const batch = writeBatch(db);
      const chunk = toAdd.slice(i, i + batchSize);
      chunk.forEach(s => {
        const surgeryWithOwner = cleanUndefined({
          ...s,
          owner_email: s.owner_email || user.email
        });
        batch.set(doc(db, COLLECTIONS.SURGERIES, s.id), surgeryWithOwner);
      });
      await batch.commit();
      committed += chunk.length;
    }
  } catch (error) {
    console.error('[NeuroGestor] Erro ao salvar batch no Firestore:', error);
    if (committed === 0) throw error;
    // Lotes anteriores já foram gravados: mantém o cache coerente e informa o processamento parcial.
    const partial = [...existing, ...toAdd.slice(0, committed)];
    if (surgeriesCache !== null) surgeriesCache = partial;
    try {
      localStorage.setItem(LOCAL_KEYS.SURGERIES, JSON.stringify(partial));
    } catch (e) {
      console.warn('[NeuroGestor] LocalStorage cheio ao salvar batch parcial.');
    }
    throw new Error(
      `Importação parcial: ${committed} de ${toAdd.length} cirurgias foram salvas antes da falha. ` +
      'Repita a importação para concluir; as já salvas serão ignoradas como duplicadas.'
    );
  }

  // Atualiza cache em memória e localStorage sempre
  const combined = [...existing, ...toAdd];
  if (surgeriesCache !== null) {
    surgeriesCache = combined;
    syncMemoryCacheOwner();
  }
  try {
    localStorage.setItem(LOCAL_KEYS.SURGERIES, JSON.stringify(combined));
  } catch (e) {
    console.warn('[NeuroGestor] LocalStorage cheio ao salvar batch.');
  }

  return toAdd.length;
};

export const updateSurgeriesBatch = async (updatedSurgeries: Surgery[]) => {
  if (updatedSurgeries.length === 0) return;
  const user = getSession();
  if (user && (user.is_demo || isDemoUser(user))) {
    updatedSurgeries.forEach(s => saveDemoMockSurgery(s));
    return;
  }
  if (!user) throw new Error('Sessão de autenticação ausente.');

  // Salva no Firestore em batches (Update/Set com merge)
  try {
    const batchSize = 450;
    for (let i = 0; i < updatedSurgeries.length; i += batchSize) {
      const batch = writeBatch(db);
      const chunk = updatedSurgeries.slice(i, i + batchSize);
      chunk.forEach(s => {
        const surgeryWithOwner = cleanUndefined({
          ...s,
          owner_email: s.owner_email || user.email
        });
        batch.set(doc(db, COLLECTIONS.SURGERIES, s.id), surgeryWithOwner, { merge: true });
      });
      await batch.commit();
    }
  } catch (error) {
    console.error('[NeuroGestor] Erro ao atualizar batch no Firestore:', error);
    throw error;
  }

  const existing = getSurgeries();
  const map = new Map(existing.map(s => [s.id, s]));
  updatedSurgeries.forEach(s => map.set(s.id, s));
  const newArray = Array.from(map.values());

  if (surgeriesCache !== null) {
    surgeriesCache = newArray;
    syncMemoryCacheOwner();
  }
  try {
    localStorage.setItem(LOCAL_KEYS.SURGERIES, JSON.stringify(newArray));
  } catch (e) {
    console.warn('[NeuroGestor] Erro ao atualizar cache no localStorage.');
  }
};

export const deleteSurgery = async (id: string) => {
  if (!id) return;
  const user = getSession();
  if (user && (user.is_demo || isDemoUser(user))) {
    return;
  }
  try {
    await deleteDoc(doc(db, COLLECTIONS.SURGERIES, id));
  } catch (err) {
    console.warn('[NeuroGestor] Erro ao excluir do Firestore:', err);
  }

  if (surgeriesCache !== null) {
    surgeriesCache = surgeriesCache.filter(s => s.id !== id);
    syncMemoryCacheOwner();
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
  const user = getSession();
  if (user && (user.is_demo || isDemoUser(user))) {
    return;
  }

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
    syncMemoryCacheOwner();
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
// Helper para remover campos undefined que causam erro fatal no Firestore
const cleanUndefinedForFirestore = (obj: any): any => {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) return obj.map(cleanUndefinedForFirestore);
  if (typeof obj === 'object') {
    const res: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v !== undefined) {
        res[k] = cleanUndefinedForFirestore(v);
      }
    }
    return res;
  }
  return obj;
};

export const getUsers = (): User[] => {
  const user = getSession();
  if (user && (user.is_demo || isDemoUser(user))) {
    return [DEMO_USER];
  }
  if (!user) return [];

  const currentEmail = normalizeEmail(user.email);
  const currentUid = user.auth_uid;

  const scopeUsers = (items: User[]): User[] => {
    if (isPrivilegedUser(user)) {
      return [...items];
    }
    return items.filter(u => normalizeEmail(u.email) === currentEmail);
  };

  if (usersCache !== null) {
    const isOwnerMatch = usersCacheOwner &&
      usersCacheOwner.email === currentEmail &&
      (!currentUid || !usersCacheOwner.uid || usersCacheOwner.uid === currentUid);

    if (isOwnerMatch) {
      return scopeUsers(usersCache);
    }
    usersCache = null;
    usersCacheOwner = null;
  }

  if (!isCacheOwnedBy(user.email)) return [];
  const data = localStorage.getItem(LOCAL_KEYS.USERS);
  if (!data) return [];
  try {
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) return [];
    return scopeUsers(parsed);
  } catch {
    localStorage.removeItem(LOCAL_KEYS.USERS);
    return [];
  }
};

export const saveUser = async (user: User) => {
  const currentSession = getSession();
  if (currentSession && (currentSession.is_demo || isDemoUser(currentSession))) {
    return;
  }
  const cleanEmail = user.email.toLowerCase();
  const cleanUser = cleanUndefinedForFirestore({ ...user, email: cleanEmail });

  try {
    await setDoc(doc(db, COLLECTIONS.USERS, cleanEmail), cleanUser, { merge: true });
  } catch (error) {
    console.error('[NeuroGestor] Erro ao salvar usuário no Firestore:', error);
  }

  const users = getUsers();
  const index = users.findIndex(u => u.email.toLowerCase() === cleanEmail);
  if (index >= 0) {
    users[index] = { ...users[index], ...user, email: cleanEmail };
  } else {
    users.push({ ...user, email: cleanEmail });
  }

  usersCache = users.map(u => ({ ...u }));
  syncUsersCacheOwner();

  try {
    localStorage.setItem(LOCAL_KEYS.USERS, JSON.stringify(users));
  } catch (e) {
    console.warn('[NeuroGestor] Falha ao persistir usuários localmente.');
  }
};

/** Obtém ou cria o perfil associado ao usuário autenticado pelo Firebase. */
export const getOrCreateUserProfile = async (firebaseUser: {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}): Promise<User> => {
  const email = firebaseUser.email?.toLowerCase().trim();
  if (!email) throw new Error('A conta autenticada não possui e-mail.');

  const profileRef = doc(db, COLLECTIONS.USERS, email);
  const existing = await getDoc(profileRef);
  if (existing.exists()) return { ...existing.data(), email } as User;

  const isOwnerAdmin = isAdminUser(email);
  const safeName = (firebaseUser.displayName || email.split('@')[0])
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
  const profile: User = {
    email,
    name: safeName || 'Usuário NeuroGestor',
    picture: firebaseUser.photoURL || undefined,
    status: isOwnerAdmin ? 'APPROVED' : 'PENDING',
    role: isOwnerAdmin ? 'owner' : 'user',
    onboarding_completed: isOwnerAdmin,
    financial_config: isOwnerAdmin ? { pricing_model: 'legacy_camarinha' } : undefined,
    team_id: isOwnerAdmin ? 'camarinha' : undefined,
    team_name: isOwnerAdmin ? 'Equipe Camarinha' : undefined,
    auth_uid: firebaseUser.uid
  };

  await setDoc(profileRef, cleanUndefinedForFirestore(profile));
  return profile;
};

export const updateUserStatus = async (email: string, status: 'APPROVED' | 'DENIED' | 'PENDING') => {
  const cleanEmail = email.toLowerCase();
  const users = getUsers();
  const index = users.findIndex(u => u.email.toLowerCase() === cleanEmail);
  if (index >= 0) {
    users[index] = { ...users[index], status };
    usersCache = users.map(u => ({ ...u }));
    syncUsersCacheOwner();
    localStorage.setItem(LOCAL_KEYS.USERS, JSON.stringify(users));

    const session = getSession();
    if (session && session.email.toLowerCase() === cleanEmail) {
      setSession({ ...session, status });
    }

    try {
      await setDoc(doc(db, COLLECTIONS.USERS, cleanEmail), { status }, { merge: true });
    } catch (error) {
      console.error('[NeuroGestor] Erro ao atualizar status no Firestore:', error);
    }
  }
};

export const updateUserRole = async (email: string, role: User['role']) => {
  const cleanEmail = email.toLowerCase();
  const users = getUsers();
  const index = users.findIndex(u => u.email.toLowerCase() === cleanEmail);
  if (index >= 0) {
    users[index] = { ...users[index], role };
    usersCache = users.map(u => ({ ...u }));
    syncUsersCacheOwner();
    localStorage.setItem(LOCAL_KEYS.USERS, JSON.stringify(users));

    const session = getSession();
    if (session && session.email.toLowerCase() === cleanEmail) {
      setSession({ ...session, role });
    }

    try {
      await setDoc(doc(db, COLLECTIONS.USERS, cleanEmail), { role }, { merge: true });
    } catch (error) {
      console.error('[NeuroGestor] Erro ao atualizar role no Firestore:', error);
    }
  }
};

/**
 * Atualiza especificamente a equipe de um usuário com salvamento imediato e reatividade garantida.
 */
export const updateUserTeam = async (email: string, teamId: string, teamName?: string) => {
  const cleanEmail = email.toLowerCase();
  const cleanTeamId = teamId || '';
  const cleanTeamName = teamName || '';

  const users = getUsers();
  const index = users.findIndex(u => u.email.toLowerCase() === cleanEmail);
  if (index >= 0) {
    users[index] = {
      ...users[index],
      team_id: cleanTeamId || undefined,
      team_name: cleanTeamName || undefined
    };
  }

  // Força atualização da referência de cache na memória
  usersCache = users.map(u => ({ ...u }));
  syncUsersCacheOwner();

  try {
    localStorage.setItem(LOCAL_KEYS.USERS, JSON.stringify(users));
  } catch (e) {
    console.warn('[NeuroGestor] Falha ao persistir usuários localmente:', e);
  }

  const session = getSession();
  if (session && session.email.toLowerCase() === cleanEmail) {
    setSession({
      ...session,
      team_id: cleanTeamId || undefined,
      team_name: cleanTeamName || undefined
    });
  }

  try {
    await setDoc(doc(db, COLLECTIONS.USERS, cleanEmail), {
      team_id: cleanTeamId,
      team_name: cleanTeamName,
      updated_at: new Date().toISOString()
    }, { merge: true });
    console.log(`[NeuroGestor] ✅ Equipe de ${cleanEmail} salva no Firestore: ${cleanTeamName || 'Sem Equipe'}`);
  } catch (error) {
    console.error('[NeuroGestor] Erro ao atualizar equipe no Firestore:', error);
  }
};

export const updateUserFcmToken = async (email: string, token: string) => {
  const cleanEmail = email.toLowerCase();
  const users = getUsers();
  const user = users.find(u => u.email.toLowerCase() === cleanEmail);
  if (user) {
    user.fcmToken = token;
    try {
      await setDoc(doc(db, COLLECTIONS.USERS, cleanEmail), { fcmToken: token }, { merge: true });
    } catch (error) {
      console.error('[NeuroGestor] Erro ao atualizar FCM Token no Firestore:', error);
    }
    localStorage.setItem(LOCAL_KEYS.USERS, JSON.stringify(users));

    const session = getSession();
    if (session && session.email.toLowerCase() === cleanEmail) {
      setSession({ ...session, fcmToken: token });
    }
  }
};

export const deleteUser = async (email: string) => {
  const session = getSession();
  if (session && (session.is_demo || isDemoUser(session))) return;
  if (!session || !isPrivilegedUser(session)) return;

  const cleanEmail = email.toLowerCase();
  try {
    await deleteDoc(doc(db, COLLECTIONS.USERS, cleanEmail));
  } catch (error) {
    console.error('[NeuroGestor] Erro ao deletar usuário do Firestore:', error);
  }
  const users = getUsers();
  const filtered = users.filter(u => u.email.toLowerCase() !== cleanEmail);
  usersCache = filtered.map(u => ({ ...u }));
  syncUsersCacheOwner();
  try {
    localStorage.setItem(LOCAL_KEYS.USERS, JSON.stringify(filtered));
  } catch (e) {
    console.warn('[NeuroGestor] Falha ao persistir usuários localmente:', e);
  }
};

// ============================================================
// SESSÃO (somente em memória; a persistência da identidade é gerida pelo Firebase Auth)
// ============================================================

export const getSession = (): User | null => sessionMemory;

export const setSession = (user: User | null) => {
  sessionMemory = user;
  if (!user) {
    cleanupStorageSession();
  } else {
    const nextEmail = normalizeEmail(user.email);
    const nextUid = user.auth_uid;
    if (memoryCacheOwner && (memoryCacheOwner.email !== nextEmail || (nextUid && memoryCacheOwner.uid && memoryCacheOwner.uid !== nextUid))) {
      cleanupStorageSession();
    }
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
  const user = getSession();
  if (user && (user.is_demo || isDemoUser(user))) {
    return [...SEED_DOCTORS].sort();
  }
  if (!user || !canAccessReferenceData(user) || !isCacheOwnedBy(user.email)) {
    return [...SEED_DOCTORS].sort();
  }
  const data = localStorage.getItem(LOCAL_KEYS.DOCTORS);
  try {
    const stored: string[] = data ? JSON.parse(data) : [];
    return Array.from(new Set([...SEED_DOCTORS, ...(Array.isArray(stored) ? stored : [])])).sort();
  } catch {
    localStorage.removeItem(LOCAL_KEYS.DOCTORS);
    return [...SEED_DOCTORS].sort();
  }
};

export const addDoctor = async (name: string) => {
  const user = getSession();
  if (!user || user.is_demo || isDemoUser(user) || !canAccessReferenceData(user)) return;
  const doctors = getDoctors();
  if (!doctors.includes(name)) {
    doctors.push(name);
    if (isCacheOwnedBy(user.email)) {
      localStorage.setItem(LOCAL_KEYS.DOCTORS, JSON.stringify(doctors));
    }
    if (isPrivilegedUser(user)) {
      try {
        await setDoc(doc(db, COLLECTIONS.CONFIG, 'doctors'), { list: doctors }, { merge: true });
      } catch (error) {
        console.error('[NeuroGestor] Erro ao salvar médico no Firestore:', error);
      }
    }
  }
};

export const getHospitals = (): string[] => {
  const user = getSession();
  if (user && (user.is_demo || isDemoUser(user))) {
    return [...SEED_HOSPITALS].sort();
  }
  if (!user || !canAccessReferenceData(user) || !isCacheOwnedBy(user.email)) {
    return [...SEED_HOSPITALS].sort();
  }
  const data = localStorage.getItem(LOCAL_KEYS.HOSPITALS);
  try {
    const stored: string[] = data ? JSON.parse(data) : [];
    return Array.from(new Set([...SEED_HOSPITALS, ...(Array.isArray(stored) ? stored : [])])).sort();
  } catch {
    localStorage.removeItem(LOCAL_KEYS.HOSPITALS);
    return [...SEED_HOSPITALS].sort();
  }
};

export const addHospital = async (name: string) => {
  const user = getSession();
  if (!user || user.is_demo || isDemoUser(user) || !canAccessReferenceData(user)) return;
  const hospitals = getHospitals();
  if (!hospitals.includes(name)) {
    hospitals.push(name);
    if (isCacheOwnedBy(user.email)) {
      localStorage.setItem(LOCAL_KEYS.HOSPITALS, JSON.stringify(hospitals));
    }
    if (isPrivilegedUser(user)) {
      try {
        await setDoc(doc(db, COLLECTIONS.CONFIG, 'hospitals'), { list: hospitals }, { merge: true });
      } catch (error) {
        console.error('[NeuroGestor] Erro ao salvar hospital no Firestore:', error);
      }
    }
  }
};

// ============================================================
// DOCUMENTOS E SENHAS (COMPARTILHADOS NO FIRESTORE)
// ============================================================

export const getPasswords = (): PasswordEntry[] => {
  const user = getSession();
  if (user && (user.is_demo || isDemoUser(user))) {
    return DEMO_FICTITIOUS_PASSWORDS;
  }
  if (!user || !isPrivilegedUser(user)) return [];
  if (passwordsCache) {
    if (isMemoryCacheValidForActiveSession()) {
      return [...passwordsCache];
    }
    passwordsCache = null;
  }
  return [];
};

export const savePassword = async (pw: PasswordEntry) => {
  const user = getSession();
  if (user && (user.is_demo || isDemoUser(user))) {
    console.warn('[NeuroGestor] Salvar senha bloqueado em modo demonstração.');
    return;
  }
  if (!user || !isPrivilegedUser(user)) {
    throw new Error('Acesso não autorizado ao cofre de credenciais.');
  }
  await setDoc(doc(db, COLLECTIONS.PASSWORDS, pw.id), pw);
};

export const deletePassword = async (id: string) => {
  const user = getSession();
  if (user && (user.is_demo || isDemoUser(user))) {
    console.warn('[NeuroGestor] Excluir senha bloqueado em modo demonstração.');
    return;
  }
  if (!user || !isPrivilegedUser(user)) {
    throw new Error('Acesso não autorizado ao cofre de credenciais.');
  }
  await deleteDoc(doc(db, COLLECTIONS.PASSWORDS, id));
};

export const getReportTemplates = (): ReportTemplate[] => {
  const user = getSession();
  if (user && (user.is_demo || isDemoUser(user))) {
    return [];
  }
  if (!user || !canAccessReferenceData(user)) {
    return [];
  }
  if (reportTemplatesCache) {
    if (isMemoryCacheValidForActiveSession()) {
      return [...reportTemplatesCache];
    }
    reportTemplatesCache = null;
  }
  if (!isCacheOwnedBy(user.email)) return [];
  const data = localStorage.getItem(LOCAL_KEYS.REPORT_TEMPLATES);
  try {
    const parsed = data ? JSON.parse(data) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    localStorage.removeItem(LOCAL_KEYS.REPORT_TEMPLATES);
    return [];
  }
};

export const saveReportTemplates = async (templates: ReportTemplate[]) => {
  const user = getSession();
  if (user && (user.is_demo || isDemoUser(user))) {
    return;
  }
  if (!user || !isPrivilegedUser(user)) {
    throw new Error('Apenas administradores podem salvar modelos de relatório.');
  }
  for (const t of templates) {
    await setDoc(doc(db, COLLECTIONS.REPORT_TEMPLATES, t.id), t);
  }
};

export const deleteReportTemplate = async (id: string) => {
  const user = getSession();
  if (user && (user.is_demo || isDemoUser(user))) {
    return;
  }
  if (!user || !isPrivilegedUser(user)) {
    throw new Error('Apenas administradores podem excluir modelos de relatório.');
  }
  await deleteDoc(doc(db, COLLECTIONS.REPORT_TEMPLATES, id));
};

export const getElectrodeModels = (): ElectrodeModel[] => {
  const user = getSession();
  if (user && (user.is_demo || isDemoUser(user))) {
    return [];
  }
  if (!user || !canAccessReferenceData(user)) {
    return [];
  }
  if (electrodeModelsCache) {
    if (isMemoryCacheValidForActiveSession()) {
      return [...electrodeModelsCache];
    }
    electrodeModelsCache = null;
  }
  if (!isCacheOwnedBy(user.email)) return [];
  const data = localStorage.getItem(LOCAL_KEYS.ELECTRODE_MODELS);
  try {
    const parsed = data ? JSON.parse(data) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    localStorage.removeItem(LOCAL_KEYS.ELECTRODE_MODELS);
    return [];
  }
};

export const saveElectrodeModels = async (models: ElectrodeModel[]) => {
  const user = getSession();
  if (user && (user.is_demo || isDemoUser(user))) {
    return;
  }
  if (!user || !isPrivilegedUser(user)) {
    throw new Error('Apenas administradores podem salvar modelos de eletrodo.');
  }
  for (const m of models) {
    await setDoc(doc(db, COLLECTIONS.ELECTRODE_MODELS, m.id), m);
  }
};

export const deleteElectrodeModel = async (id: string) => {
  const user = getSession();
  if (user && (user.is_demo || isDemoUser(user))) {
    return;
  }
  if (!user || !isPrivilegedUser(user)) {
    throw new Error('Apenas administradores podem excluir modelos de eletrodo.');
  }
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
  const user = getSession();
  if (!user || !isPrivilegedUser(user)) {
    throw new Error('Ação permitida apenas para administradores.');
  }

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
    if (isCacheOwnedBy(user.email)) {
      localStorage.setItem(LOCAL_KEYS.DOCTORS, JSON.stringify(doctors));
    }
    await setDoc(doc(db, COLLECTIONS.CONFIG, 'doctors'), { list: doctors }, { merge: true });
  } else {
    const hospitals = getHospitals().filter(h => !namesToReplace.includes(h));
    if (!hospitals.includes(canonicalName)) hospitals.push(canonicalName);
    if (isCacheOwnedBy(user.email)) {
      localStorage.setItem(LOCAL_KEYS.HOSPITALS, JSON.stringify(hospitals));
    }
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
  if (learnedCategoriesCache) {
    if (isMemoryCacheValidForActiveSession()) {
      return learnedCategoriesCache;
    }
    learnedCategoriesCache = null;
  }
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
  syncMemoryCacheOwner();
};
// ============================================================
// BACKUP (Exportação Completa)
// ============================================================

export const exportFullBackup = async () => {
  const user = getSession();
  if (user && (user.is_demo || isDemoUser(user))) {
    console.warn('[NeuroGestor] Backup bloqueado em modo demonstração.');
    return false;
  }
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
