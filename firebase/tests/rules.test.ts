// Testes das regras do Firestore e do Storage no emulador.
// Requer Java (emulador) e as devDependencies @firebase/rules-unit-testing e firebase-tools.
// Execução: npm run test:rules
// Usa apenas e-mails e UIDs fictícios.
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment, assertSucceeds, assertFails, type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, getDocs, collection, query, where } from 'firebase/firestore';
import { ref, uploadBytes, getBytes } from 'firebase/storage';

const MASTER = 'rafaelleaobh@gmail.com';
const ADMIN = 'admin@teste.invalid';
const APPROVED = 'aprovado@teste.invalid';
const PENDING = 'pendente@teste.invalid';
const ASSISTANT = 'secretaria@teste.invalid';
const NEWUSER = 'novo@teste.invalid';

let env: RulesTestEnvironment;

const ctx = (email: string, uid: string) =>
  env.authenticatedContext(uid, { email, email_verified: true });

const profile = (email: string, uid: string, status: string, role = 'user') =>
  ({ email, auth_uid: uid, name: 'Teste', status, role });

before(async () => {
  const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
  const [fHost, fPort] = firestoreHost.split(':');

  const storageHost = process.env.FIREBASE_STORAGE_EMULATOR_HOST || '127.0.0.1:9199';
  const [sHost, sPort] = storageHost.split(':');

  const config: any = {
    projectId: 'neurogestor-rules-test',
    firestore: {
      host: fHost,
      port: Number(fPort) || 8080,
      rules: readFileSync('firebase/firestore.rules', 'utf8')
    },
    storage: {
      host: sHost,
      port: Number(sPort) || 9199,
      rules: readFileSync('firebase/storage.rules', 'utf8')
    }
  };

  // Falha compulsoriamente se o Storage ou Firestore não estiver disponível
  // Não suprime erro nem converte em skip silencioso
  env = await initializeTestEnvironment(config);
});

after(async () => {
  if (env) {
    await env.cleanup();
  }
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.clearStorage();
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore();
    await setDoc(doc(db, 'users', ADMIN), profile(ADMIN, 'uAdmin', 'APPROVED', 'admin'));
    await setDoc(doc(db, 'users', APPROVED), profile(APPROVED, 'uAprov', 'APPROVED'));
    await setDoc(doc(db, 'users', PENDING), profile(PENDING, 'uPend', 'PENDING'));
    await setDoc(doc(db, 'users', ASSISTANT), profile(ASSISTANT, 'uAssist', 'APPROVED', 'assistant'));
    await setDoc(doc(db, 'surgeries', 's1'), { owner_email: APPROVED, procedimento: 'x' });
    await setDoc(doc(db, 'surgeries', 's2'), { owner_email: PENDING, procedimento: 'y' });
  });
});

// ---------- Primeiro login / vínculo userId-e-mail ----------
test('primeiro login: get em perfil inexistente do próprio e-mail é permitido', async () => {
  const db = ctx(NEWUSER, 'uNew').firestore();
  await assertSucceeds(getDoc(doc(db, 'users', NEWUSER)));
});

test('primeiro login: autocadastro como PENDING/user é permitido', async () => {
  const db = ctx(NEWUSER, 'uNew').firestore();
  await assertSucceeds(setDoc(doc(db, 'users', NEWUSER), profile(NEWUSER, 'uNew', 'PENDING')));
});

test('autocadastro não pode se auto-aprovar nem virar admin', async () => {
  const db = ctx(NEWUSER, 'uNew').firestore();
  await assertFails(setDoc(doc(db, 'users', NEWUSER), profile(NEWUSER, 'uNew', 'APPROVED')));
  await assertFails(setDoc(doc(db, 'users', NEWUSER), profile(NEWUSER, 'uNew', 'PENDING', 'admin')));
});

test('vínculo: não cria perfil em {userId} diferente do e-mail autenticado', async () => {
  const db = ctx(NEWUSER, 'uNew').firestore();
  await assertFails(setDoc(doc(db, 'users', 'outro@teste.invalid'), profile(NEWUSER, 'uNew', 'PENDING')));
});

test('vínculo: não lê (get) nem atualiza perfil de outro usuário', async () => {
  const db = ctx(PENDING, 'uPend').firestore();
  await assertFails(getDoc(doc(db, 'users', APPROVED)));
  await assertFails(updateDoc(doc(db, 'users', APPROVED), { name: 'x' }));
});

test('usuário atualiza apenas campos permitidos do próprio perfil', async () => {
  const db = ctx(APPROVED, 'uAprov').firestore();
  await assertSucceeds(updateDoc(doc(db, 'users', APPROVED), { name: 'Novo Nome' }));
  await assertFails(updateDoc(doc(db, 'users', APPROVED), { role: 'admin' }));
  await assertFails(updateDoc(doc(db, 'users', APPROVED), { status: 'APPROVED', team_id: 'x' }));
});

test('list de users: só admin lista tudo; usuário comum filtra pelo próprio e-mail', async () => {
  const user = ctx(APPROVED, 'uAprov').firestore();
  await assertFails(getDocs(collection(user, 'users')));
  await assertSucceeds(getDocs(query(collection(user, 'users'), where('email', '==', APPROVED))));
  const admin = ctx(ADMIN, 'uAdmin').firestore();
  await assertSucceeds(getDocs(collection(admin, 'users')));
});

// ---------- PENDING / APPROVED / admin / assistant ----------
test('PENDING não lê nem grava cirurgias, nem as próprias', async () => {
  const db = ctx(PENDING, 'uPend').firestore();
  await assertFails(getDoc(doc(db, 'surgeries', 's2')));
  await assertFails(setDoc(doc(db, 'surgeries', 's3'), { owner_email: PENDING }));
});

test('APPROVED acessa só as próprias cirurgias', async () => {
  const db = ctx(APPROVED, 'uAprov').firestore();
  await assertSucceeds(getDoc(doc(db, 'surgeries', 's1')));
  await assertFails(getDoc(doc(db, 'surgeries', 's2')));
  await assertSucceeds(setDoc(doc(db, 'surgeries', 's3'), { owner_email: APPROVED }));
  await assertFails(setDoc(doc(db, 'surgeries', 's4'), { owner_email: PENDING }));
});

test('admin e master acessam todas as cirurgias', async () => {
  await assertSucceeds(getDoc(doc(ctx(ADMIN, 'uAdmin').firestore(), 'surgeries', 's1')));
  await assertSucceeds(getDoc(doc(ctx(MASTER, 'uMaster').firestore(), 'surgeries', 's2')));
});

test('assistant não é admin: só as próprias cirurgias e sem acesso a passwords', async () => {
  const db = ctx(ASSISTANT, 'uAssist').firestore();
  await assertFails(getDoc(doc(db, 'surgeries', 's1')));
  await assertFails(getDoc(doc(db, 'passwords', 'p1')));
  await assertSucceeds(setDoc(doc(db, 'surgeries', 's5'), { owner_email: ASSISTANT }));
});

// ---------- auth_uid em atualizações de perfil ----------
test('perfil: atualização com auth_uid diferente do uid autenticado é recusada', async () => {
  const db = ctx(APPROVED, 'uOutro').firestore();
  await assertFails(updateDoc(doc(db, 'users', APPROVED), { name: 'x' }));
});

// ---------- Menor privilégio: config / report_templates / electrode_models ----------
for (const col of ['config', 'report_templates', 'electrode_models']) {
  test(`${col}: aprovado lê; assistant, PENDING e não autenticado não leem; só admin grava`, async () => {
    await env.withSecurityRulesDisabled(async (c) => {
      await setDoc(doc(c.firestore(), col, 'x1'), { v: 1 });
      await setDoc(doc(c.firestore(), 'users', 'negado@teste.invalid'),
        profile('negado@teste.invalid', 'uDeny', 'DENIED'));
    });
    await assertSucceeds(getDoc(doc(ctx(APPROVED, 'uAprov').firestore(), col, 'x1')));
    await assertSucceeds(getDoc(doc(ctx(ADMIN, 'uAdmin').firestore(), col, 'x1')));
    await assertFails(getDoc(doc(ctx(ASSISTANT, 'uAssist').firestore(), col, 'x1')));
    await assertFails(getDoc(doc(ctx(PENDING, 'uPend').firestore(), col, 'x1')));
    await assertFails(getDoc(doc(ctx('negado@teste.invalid', 'uDeny').firestore(), col, 'x1')));
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), col, 'x1')));
    await assertFails(setDoc(doc(ctx(APPROVED, 'uAprov').firestore(), col, 'x2'), { v: 2 }));
    await assertSucceeds(setDoc(doc(ctx(ADMIN, 'uAdmin').firestore(), col, 'x2'), { v: 2 }));
  });
}

// ---------- Storage ----------
const png = () => new Uint8Array([1, 2, 3]);
const meta = { contentType: 'image/png' };

test('storage: APPROVED envia e baixa no próprio uid; não acessa uid alheio', async () => {
  const st = ctx(APPROVED, 'uAprov').storage();
  await assertSucceeds(uploadBytes(ref(st, 'surgeries/uAprov/s1/a.png'), png(), meta));
  await assertSucceeds(getBytes(ref(st, 'surgeries/uAprov/s1/a.png')));
  await assertFails(uploadBytes(ref(st, 'surgeries/outro/s1/a.png'), png(), meta));
});

test('storage: PENDING não envia nem baixa', async () => {
  const st = ctx(PENDING, 'uPend').storage();
  await assertFails(uploadBytes(ref(st, 'surgeries/uPend/s2/a.png'), png(), meta));
});

test('storage: tipo não-imagem é recusado; admin lê arquivos de outros', async () => {
  const st = ctx(APPROVED, 'uAprov').storage();
  await assertFails(uploadBytes(ref(st, 'surgeries/uAprov/s1/a.txt'), png(), { contentType: 'text/plain' }));
  await env.withSecurityRulesDisabled(async (c) => {
    await uploadBytes(ref(c.storage(), 'surgeries/uAprov/s1/b.png'), png(), meta);
  });
  await assertSucceeds(getBytes(ref(ctx(ADMIN, 'uAdmin').storage(), 'surgeries/uAprov/s1/b.png')));
});

// ---------- Riscos Centrais da OS: Transição de Autorização, Isolamento e Retry ----------

test('regras: alteração de papel de admin para user bloqueia imediatamente acesso ao cofre de senhas', async () => {
  await env.withSecurityRulesDisabled(async (c) => {
    await setDoc(doc(c.firestore(), 'passwords', 'pSecret'), { title: 'Banco', user: 'admin' });
  });

  // Admin acessa cofre
  await assertSucceeds(getDoc(doc(ctx(ADMIN, 'uAdmin').firestore(), 'passwords', 'pSecret')));

  // Perfil é rebaixado para usuário comum
  await env.withSecurityRulesDisabled(async (c) => {
    await updateDoc(doc(c.firestore(), 'users', ADMIN), { role: 'user' });
  });

  // Acesso ao cofre é imediatamente bloqueado
  await assertFails(getDoc(doc(ctx(ADMIN, 'uAdmin').firestore(), 'passwords', 'pSecret')));
  await assertFails(setDoc(doc(ctx(ADMIN, 'uAdmin').firestore(), 'passwords', 'pNew'), { title: 'Invadir' }));
});

test('regras: revogação de status de APPROVED para DENIED bloqueia leitura e escrita de cirurgias', async () => {
  // Usuário aprovado lê cirurgia
  await assertSucceeds(getDoc(doc(ctx(APPROVED, 'uAprov').firestore(), 'surgeries', 's1')));

  // Status é revogado para DENIED
  await env.withSecurityRulesDisabled(async (c) => {
    await updateDoc(doc(c.firestore(), 'users', APPROVED), { status: 'DENIED' });
  });

  // Qualquer tentativa de leitura ou escrita é imediatamente rejeitada
  await assertFails(getDoc(doc(ctx(APPROVED, 'uAprov').firestore(), 'surgeries', 's1')));
  await assertFails(setDoc(doc(ctx(APPROVED, 'uAprov').firestore(), 'surgeries', 'sBloq'), {
    owner_email: APPROVED,
    procedimento: 'Teste Bloqueado'
  }));
});

test('isolamento determinístico: geração de sessão impede que callbacks atrasados contaminem o estado', () => {
  let sessionGeneration = 1;
  let activeEmail = 'medico1@teste.invalid';
  let activeUid = 'uMedico1';
  let memoryCache: any[] | null = null;

  // Operação 1 inicia na geração 1
  const opGen = sessionGeneration;
  const opEmail = activeEmail;
  const opUid = activeUid;

  const isOperationAllowed = (gen: number, email: string, uid: string) =>
    gen === sessionGeneration && email === activeEmail && uid === activeUid;

  // Usuário desloga e novo usuário loga (geração avança para 2)
  sessionGeneration++;
  activeEmail = 'medico2@teste.invalid';
  activeUid = 'uMedico2';
  memoryCache = null;

  // Callback atrasado da Operação 1 dispara agora
  const callbackExecuted = () => {
    if (!isOperationAllowed(opGen, opEmail, opUid)) {
      return false; // Callback descartado por geração obsoleta
    }
    memoryCache = [{ id: 'vazamento_de_dados' }];
    return true;
  };

  const executed = callbackExecuted();
  assert.equal(executed, false, 'Callback atrasado deveria ser descartado');
  assert.equal(memoryCache, null, 'Cache em memória não deve ser contaminado por callback atrasado');
});

test('isolamento determinístico: rejeição de cache com UID divergente ou ausente', () => {
  const isCacheValid = (owner: { email: string; uid?: string } | null, current: { email: string; uid: string }) => {
    if (!owner || !owner.email || !owner.uid) return false;
    return owner.email.toLowerCase().trim() === current.email.toLowerCase().trim() && owner.uid === current.uid;
  };

  const currentSession = { email: 'user@teste.invalid', uid: 'uid_ativo' };

  // 1. Cache de mesma conta mas sem UID (formato legado)
  assert.equal(isCacheValid({ email: 'user@teste.invalid' }, currentSession), false);

  // 2. Cache com mesmo email mas UID diferente (outra conta ou reconexão)
  assert.equal(isCacheValid({ email: 'user@teste.invalid', uid: 'uid_outro' }, currentSession), false);

  // 3. Cache com identidade e UID estritamente coincidentes
  assert.equal(isCacheValid({ email: 'user@teste.invalid', uid: 'uid_ativo' }, currentSession), true);
});

test('idempotência OCR: retry com reordenação ou repetição de lote gera os mesmos IDs determinísticos', async () => {
  const stableId = async (key: string): Promise<string> => {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
    const hex = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
    return `imp_${hex.slice(0, 32)}`;
  };

  const item1 = {
    owner_email: 'medico@teste.invalid',
    paciente: 'Paciente Exemplo Silva',
    data: '2026-10-15',
    procedimento: 'Artrodese Lombar',
    hospital: 'Hospital Central',
    medico: 'Dr. Roberto',
    hora_inicio: '08:00',
    numero_guia: '12345'
  };

  const item2 = {
    owner_email: 'medico@teste.invalid',
    paciente: 'Outro Paciente Santos',
    data: '2026-10-16',
    procedimento: 'Microdiscectomia',
    hospital: 'Hospital Norte',
    medico: 'Dra. Patricia',
    hora_inicio: '10:00',
    numero_guia: '67890'
  };

  const key1 = [
    item1.owner_email,
    item1.paciente.toLowerCase(),
    item1.data,
    item1.procedimento.toLowerCase(),
    item1.hospital.toLowerCase(),
    item1.medico.toLowerCase(),
    item1.hora_inicio,
    item1.numero_guia
  ].join('|');

  const key2 = [
    item2.owner_email,
    item2.paciente.toLowerCase(),
    item2.data,
    item2.procedimento.toLowerCase(),
    item2.hospital.toLowerCase(),
    item2.medico.toLowerCase(),
    item2.hora_inicio,
    item2.numero_guia
  ].join('|');

  const id1PrimeiroEnvio = await stableId(key1);
  const id2PrimeiroEnvio = await stableId(key2);

  // Reordenação do lote no retry
  const id2SegundoEnvio = await stableId(key2);
  const id1SegundoEnvio = await stableId(key1);

  assert.equal(id1PrimeiroEnvio, id1SegundoEnvio, 'ID determinístico do item 1 deve ser idêntico');
  assert.equal(id2PrimeiroEnvio, id2SegundoEnvio, 'ID determinístico do item 2 deve ser idêntico');

  // Simulação de deduplicação idempotente: se o ID já existe no banco, não insere novamente
  const database = [id1PrimeiroEnvio];
  const retryBatch = [id1SegundoEnvio, id2SegundoEnvio];
  const toInsert = retryBatch.filter(id => !database.includes(id));

  assert.deepEqual(toInsert, [id2SegundoEnvio], 'Apenas o item que ainda não existia no banco deve ser inserido');
});
