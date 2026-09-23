import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import * as firestore from "@google-cloud/firestore";

admin.initializeApp();

const db = admin.firestore();

// Notifica administradores quando um novo usuário se cadastra
export const notifyAdminOnNewUser = functions.firestore
    .document("users/{userId}")
    .onCreate(async (snap, context) => {
        const newUser = snap.data();
        if (!newUser) {
            console.log("Sem dados do usuário.");
            return null;
        }

        // Buscar todos os usuários com role === 'admin' que tenham um fcmToken
        const adminsSnapshot = await db.collection("users")
            .where("role", "==", "admin")
            .get();

        if (adminsSnapshot.empty) {
            console.log("Nenhum admin encontrado para notificar");
            return null;
        }

        const tokens: string[] = [];
        adminsSnapshot.forEach(doc => {
            const adminData = doc.data();
            if (adminData.fcmToken) {
                tokens.push(adminData.fcmToken);
            }
        });

        if (tokens.length === 0) {
            console.log("Nenhum admin possui token FCM registrado");
            return null;
        }

        const payload = {
            notification: {
                title: "Novo Cadastro no NeuroGestor",
                body: `O usuário ${newUser.name || newUser.email} acabou de se cadastrar e está aguardando aprovação.`,
            }
        };

        try {
            const response = await admin.messaging().sendToDevice(tokens, payload);
            console.log("Notificações enviadas para admins com sucesso:", response.successCount);
            return response;
        } catch (error) {
            console.error("Erro ao enviar notificação FCM", error);
            return null;
        }
    });

// Notifica todos os usuários aprovados diariamente às 20h
export const notifyDaily20h = functions.pubsub.schedule("0 20 * * *")
    .timeZone("America/Sao_Paulo")
    .onRun(async (context) => {
        const usersSnapshot = await db.collection("users").where("status", "==", "APPROVED").get();
        if (usersSnapshot.empty) return null;

        const tokens: string[] = [];
        usersSnapshot.forEach(doc => {
            const userData = doc.data();
            if (userData.fcmToken) tokens.push(userData.fcmToken);
        });

        if (tokens.length === 0) {
            console.log("Nenhum usuário aprovado possui token FCM para recebimento diário.");
            return null;
        }

        const payload = {
            notification: {
                title: "Lembrete Diário - NeuroGestor",
                body: "Não se esqueça de registrar suas cirurgias e procedimentos de hoje no NeuroGestor.",
            }
        };

        try {
            const response = await admin.messaging().sendToDevice(tokens, payload);
            console.log("Notificação diária (20h) enviada para", response.successCount, "usuários.");
            return response;
        } catch (error) {
            console.error("Erro ao enviar notificação diária 20h FCM", error);
            return null;
        }
    });

// Notifica todos os usuários aprovados todo dia 20 às 10h da manhã
export const notifyDay20 = functions.pubsub.schedule("0 10 20 * *")
    .timeZone("America/Sao_Paulo")
    .onRun(async (context) => {
        const usersSnapshot = await db.collection("users").where("status", "==", "APPROVED").get();
        if (usersSnapshot.empty) return null;

        const tokens: string[] = [];
        usersSnapshot.forEach(doc => {
            const userData = doc.data();
            if (userData.fcmToken) tokens.push(userData.fcmToken);
        });

        if (tokens.length === 0) {
            console.log("Nenhum usuário aprovado possui token FCM para envio dia 20.");
            return null;
        }

        const payload = {
            notification: {
                title: "Lembrete: Fechamento de Planilha",
                body: "Hoje é dia 20! Não se esqueça de preparar e enviar sua planilha do NeuroGestor.",
            }
        };

        try {
            const response = await admin.messaging().sendToDevice(tokens, payload);
            console.log("Notificação Dia 20 enviada para", response.successCount, "usuários.");
            return response;
        } catch (error) {
            console.error("Erro ao enviar notificação dia 20 FCM", error);
            return null;
        }
    });

// ============================================================
// BACKUP AUTOMATIZADO (Exportação do Firestore)
// ============================================================

const client = new firestore.v1.FirestoreAdminClient();

// A Default Service Account do App Engine ou Firebase Admin precisa de permissões de Storage Admin
export const scheduledFirestoreExport = functions.pubsub
    .schedule("0 3 * * *") // Executa diariamente às 03:00 da manhã
    .timeZone("America/Sao_Paulo")
    .onRun(async (context) => {
        const projectId = process.env.GCP_PROJECT || process.env.GCLOUD_PROJECT;
        if (!projectId) {
            console.error("[Backup] Nenhum ID de projeto encontrado.");
            return null;
        }
        const databaseName = client.databasePath(projectId, "(default)");
        // Bucket de destino padrão do Cloud Storage para backups
        const bucketName = `gs://${projectId}.appspot.com/backups`;

        try {
            console.log(`[Backup] Iniciando exportação do Firestore para ${bucketName}`);
            const responses = await client.exportDocuments({
                name: databaseName,
                outputUriPrefix: bucketName,
                collectionIds: [] // Lista vazia exporta todas as coleções
            });
            console.log(`[Backup] Operação em andamento... Verifique o GCP:`, responses[0].name);
            return null;
        } catch (err) {
            console.error("[Backup] Erro ao disparar exportação do Firestore:", err);
            throw new Error("Falha na automação de backup.");
        }
    });
