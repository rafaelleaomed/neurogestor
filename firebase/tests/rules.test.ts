// Testes das regras do Firestore e do Storage no emulador.
// Requer Java (emulador) e as devDependencies @firebase/rules-unit-testing e firebase-tools.
// Execução: npm run test:rules
// Usa apenas e-mails e UIDs fictícios.
import { test, before, after, beforeEach } from 'node:test';
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
  env = await initializeTestEnvironment({
    projectId: 'neurogestor-rules-test',
    firestore: { rules: readFileSync('firebase/firestore.rules', 'utf8') },
    storage: { rules: readFileSync('firebase/storage.rules', 'utf8') },
  });
});

after(async () => { await env.cleanup(); });

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
