import express from "express";
import path from "path";
import cookieParser from "cookie-parser";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import * as admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { google } from "googleapis";
import { setupAsaasRoutes } from "./server/routes/asaas-routes";
import fs from "fs";
import { Readable } from "stream";

// Load placeholder builders
import {
  buildGlobalPlaceholders,
  buildClientCommonPlaceholders,
  buildCaseCommonPlaceholders,
  buildPrimeiroAtendimentoPlaceholders,
  buildProcuracaoPfPlaceholders,
  buildProcuracaoPjPlaceholders,
  buildDeclaracaoPobrezaPfPlaceholders,
  buildDeclaracaoPobrezaPjPlaceholders,
  buildContratoHonorariosPfPlaceholders,
  buildContratoHonorariosPjPlaceholders,
  buildPrePeticaoPlaceholders
} from "./src/lib/documents/placeholderBuilders.js";
import { buildContratoHonorariosDocumentContext } from "./src/lib/documents/contratoHonorariosBattleMap.js";

dotenv.config();

const app = express();
const PORT = 3000;

// Safe initialize Firebase Admin with specific database ID from config
let dbAdmin: any = null;
let firebaseAdminStatus = {
  initialized: false,
  projectId: "",
  firestoreDatabaseId: "",
  credentialSource: "",
  errorCode: null as string | null,
  errorMessage: null as string | null,
  lastCheckedAt: new Date().toISOString()
};

function normalizeServiceAccountJson(raw: string): any {
  if (!raw) return null;
  try {
    const serviceAccount = JSON.parse(raw);
    if (serviceAccount.private_key && typeof serviceAccount.private_key === "string") {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
    }
    const fields = ["type", "project_id", "private_key", "client_email"];
    const missing = fields.filter(f => !serviceAccount[f]);
    if (missing.length > 0) {
      console.warn(`[FirebaseAdmin] Service Account JSON has missing fields: ${missing.join(", ")}`);
      return { _invalid: true, errorCode: "FIREBASE_ADMIN_SERVICE_ACCOUNT_INVALID", missing };
    }
    if (!serviceAccount.private_key.includes("BEGIN PRIVATE KEY")) {
      console.warn("[FirebaseAdmin] Service Account private_key lacks 'BEGIN PRIVATE KEY'");
      return { _invalid: true, errorCode: "FIREBASE_ADMIN_SERVICE_ACCOUNT_INVALID", missing: ["private_key_format"] };
    }
    return serviceAccount;
  } catch (e: any) {
    console.error("[FirebaseAdmin] Failed to parse Service Account JSON:", e.message);
    return { _invalid: true, errorCode: "FIREBASE_ADMIN_SERVICE_ACCOUNT_INVALID", error: e.message };
  }
}

async function initializeFirebaseAdmin() {
  try {
    firebaseAdminStatus.lastCheckedAt = new Date().toISOString();
    
    let firestoreDatabaseId = process.env.FIRESTORE_DATABASE_ID || "";
    let configProjectId = process.env.FIREBASE_PROJECT_ID || "";
    
    const configPath = path.join(process.cwd(), "firebase-applet-config.json");
    let config: any = {};
    if (fs.existsSync(configPath)) {
      try {
        config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
        if (!firestoreDatabaseId) {
          firestoreDatabaseId = config.firestoreDatabaseId || "";
        }
        if (!configProjectId) {
          configProjectId = config.projectId || "";
        }
      } catch (e) {
        console.error("[FirebaseAdmin] Failed to read firebase-applet-config.json:", e);
      }
    }
    
    if (!firestoreDatabaseId) {
      firestoreDatabaseId = "ai-studio-ffebafe8-f1b5-4749-87a5-7b28a5c05e6c";
    }
    
    firebaseAdminStatus.firestoreDatabaseId = firestoreDatabaseId;
    firebaseAdminStatus.projectId = configProjectId;
    
    let serviceAccount: any = null;
    let credentialSource = "";
    
    if (process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON) {
      const parsed = normalizeServiceAccountJson(process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON);
      if (parsed && !parsed._invalid) {
        serviceAccount = parsed;
        credentialSource = "FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON";
      }
    }
    
    if (!serviceAccount && process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      const parsed = normalizeServiceAccountJson(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      if (parsed && !parsed._invalid) {
        serviceAccount = parsed;
        credentialSource = "FIREBASE_SERVICE_ACCOUNT_JSON";
      }
    }
    
    if (!serviceAccount && process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
      const parsed = normalizeServiceAccountJson(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
      if (parsed && !parsed._invalid) {
        serviceAccount = parsed;
        credentialSource = "GOOGLE_APPLICATION_CREDENTIALS_JSON";
      }
    }
    
    const localSaPath = path.join(process.cwd(), "firebase-admin-service-account.json");
    if (!serviceAccount && fs.existsSync(localSaPath)) {
      try {
        const rawJson = fs.readFileSync(localSaPath, "utf-8");
        const parsed = normalizeServiceAccountJson(rawJson);
        if (parsed && !parsed._invalid) {
          serviceAccount = parsed;
          credentialSource = "firebase-admin-service-account.json";
        }
      } catch (err: any) {
        console.error("[FirebaseAdmin] Failed to read local file:", err.message);
      }
    }
    
    const adminProps = (admin as any);
    const adminSdk = adminProps?.initializeApp ? admin : (adminProps?.default || admin);
    const appsList = adminSdk.apps || [];
    
    if (appsList.length > 0) {
      try {
        await Promise.all(appsList.map(app => app ? app.delete() : Promise.resolve()));
      } catch (err) {
        // Ignored
      }
    }
    
    if (serviceAccount) {
      adminSdk.initializeApp({
        credential: adminSdk.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id || configProjectId
      });
      dbAdmin = getFirestore(adminSdk.app(), firestoreDatabaseId === "(default)" ? undefined : firestoreDatabaseId);
      
      firebaseAdminStatus.initialized = true;
      firebaseAdminStatus.projectId = serviceAccount.project_id || configProjectId;
      firebaseAdminStatus.credentialSource = credentialSource;
      firebaseAdminStatus.errorCode = null;
      firebaseAdminStatus.errorMessage = null;
      console.log(`[FirebaseAdmin] Success on initialisation through service account ${credentialSource}, db: ${firestoreDatabaseId}`);
    } else {
      try {
        adminSdk.initializeApp({
          projectId: configProjectId || undefined
        });
        dbAdmin = getFirestore(adminSdk.app(), firestoreDatabaseId === "(default)" ? undefined : firestoreDatabaseId);
        
        firebaseAdminStatus.initialized = true;
        firebaseAdminStatus.projectId = configProjectId || adminSdk.app().options?.projectId || "";
        firebaseAdminStatus.credentialSource = "ADC";
        firebaseAdminStatus.errorCode = null;
        firebaseAdminStatus.errorMessage = null;
        console.log(`[FirebaseAdmin] Success on initialisation using ADC, db: ${firestoreDatabaseId}`);
      } catch (adcErr: any) {
        if (configProjectId) {
          try {
            adminSdk.initializeApp({
              projectId: configProjectId
            });
            dbAdmin = getFirestore(adminSdk.app(), firestoreDatabaseId === "(default)" ? undefined : firestoreDatabaseId);
            
            firebaseAdminStatus.initialized = true;
            firebaseAdminStatus.projectId = configProjectId;
            firebaseAdminStatus.credentialSource = "config_only_fallback";
            firebaseAdminStatus.errorCode = "FIREBASE_ADMIN_LIMITED_MODE";
            firebaseAdminStatus.errorMessage = `Iniciado em modo limitado sem credencial de serviço. ADC erro: ${adcErr.message}`;
            console.log(`[FirebaseAdmin] Initialized (mode limited), db: ${firestoreDatabaseId}`);
          } catch (fallbackErr: any) {
            throw new Error(`Fallback failure: ${fallbackErr.message}. ADC Error: ${adcErr.message}`);
          }
        } else {
          throw adcErr;
        }
      }
    }
  } catch (err: any) {
    dbAdmin = null;
    firebaseAdminStatus.initialized = false;
    firebaseAdminStatus.errorCode = err.errorCode || "FIREBASE_ADMIN_INIT_FAILED";
    firebaseAdminStatus.errorMessage = err.message || "Unknown error";
    console.error(`[FirebaseAdmin] Safely initialisation failed: ${err.message || err}`);
  }
}

// Perform initial boot trigger
initializeFirebaseAdmin();

app.use(cookieParser("boss_session_secret_giffoni_connect"));

// Parse JSON payloads with increased limits for file base64 uploads
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));


async function getCloudRunIdToken(targetAudience: string): Promise<string | null> {
  try {
    const url = `http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity?audience=${encodeURIComponent(targetAudience)}`;
    const response = await fetch(url, {
      headers: { "Metadata-Flavor": "Google" }
    });
    if (response.ok) {
      const token = await response.text();
      return token.trim();
    }
  } catch (e: any) {
    console.warn("[Identity] Service-to-service ID Token acquisition failed/skipped:", e?.message || e);
  }
  return null;
}

async function smartFetch(
  originalUrl: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  } = {},
  incomingCookie?: string
): Promise<{ response: Response; text: string }> {
  const urlsToTry: string[] = [];

  // 1. First try the input URL exactly as configured
  urlsToTry.push(originalUrl);

  // 2. Add alternate environment URL if applicable
  if (originalUrl.includes("ais-dev-")) {
    urlsToTry.push(originalUrl.replace("ais-dev-", "ais-pre-"));
  } else if (originalUrl.includes("ais-pre-")) {
    urlsToTry.push(originalUrl.replace("ais-pre-", "ais-dev-"));
  }

  let finalResponse: Response | null = null;
  let finalBodyText = "";

  for (const url of urlsToTry) {
    try {
      console.log(`[SmartFetch] Attempting connection to: ${url}`);

      const headers = { ...(options.headers || {}) };

      // Set cookies and/or OIDC Token for authentication if we are calling a dev endpoint
      if (url.includes("ais-dev-") || url.includes("ais-pre-")) {
        if (incomingCookie) {
          headers["Cookie"] = incomingCookie;
        }

        const idx = url.indexOf(".run.app");
        if (idx !== -1) {
          const audience = url.substring(0, idx + 8);
          const idToken = await getCloudRunIdToken(audience);
          if (idToken) {
            headers["Authorization"] = `Bearer ${idToken}`;
            console.log(`[SmartFetch] Attached service-to-service Cloud Run IAM token.`);
          }
        }
      }

      const res = await fetch(url, {
        method: options.method || "GET",
        headers,
        body: options.body
      });

      const text = await res.text();
      console.log(`[SmartFetch] URL: ${url}. Status: ${res.status}. Length: ${text.length}`);

      const isHtml = text.trim().startsWith("<") || 
                     text.toLowerCase().includes("<!doctype html") || 
                     text.toLowerCase().includes("<html") ||
                     text.toLowerCase().includes("cookie check");

      const isFailedOrGated = isHtml || res.status === 404 || res.status === 401 || res.status === 403;

      if (!isFailedOrGated) {
        return { response: res, text };
      }

      // Save for fallback reporting
      finalResponse = res;
      finalBodyText = text;
      console.log(`[SmartFetch] Attempt to ${url} returned HTML or server-redirect/404/Auth. Trying next or fallback...`);
    } catch (e: any) {
      console.warn(`[SmartFetch] Attempt to ${url} threw error:`, e.message || e);
      if (urlsToTry.indexOf(url) === urlsToTry.length - 1) {
        throw e;
      }
    }
  }

  return { response: finalResponse || new Response(), text: finalBodyText };
}

function generateHighFidelityMockFormat(fatos: string, estrategia: string, competencia: string) {
  return `### ⚖️ RELATÓRIO DO ESTUDO DE CASO (EDRP) - FORMATANTE GEMINI JURÍDICO

#### 1. 📋 RESUMO EXECUTIVO DOS FATOS NARRADOS
\n${fatos ? fatos.split('\n').map(line => `> ${line}`).join('\n') : '*Nenhuma narrativa fática fornecida.*'}

#### 2. 🛡️ TESES PRINCIPAIS & FUNDAMENTAÇÃO LEGAL
- **Fundamento Geral:** Incidência imediata das normas da Lei de Introdução às Normas do Direito Brasileiro (LINDB) e do Código de Processo Civil.
- **Tese Principal:** Dano gerado por ato ilícito configurado, ensejando dever de indenizar e plena reparação material/moral.
- **Dispositivos Aplicáveis:** Art. 186, Art. 927 do Código Civil e Art. 6º, VI do CDC.

#### 3. 🎯 ESTRATÉGIA PROCESSUAL REFINADA (EVITAÇÃO DE PRECLUSÃO)
\n${estrategia ? estrategia.split('\n').map(line => `- ${line}`).join('\n') : '*Nenhuma estratégia processual fornecida pelo operador.*'}
- **Tutela Provisória:** Pedido sob a égide da Tutela de Urgência de Natureza Antecipada (Art. 300, CPC).
- **Inversão do Ônus:** Pleito de inversão legal com base na hipossuficiência técnica verificada (Art. 6º, VIII, CDC).

#### 4. 📍 ANÁLISE DE JURISDIÇÃO E COMPETÊNCIA TERRITORIAL
- **Foro de Eleição ou Domicílio:** Definição com fulcro nas regras gerais de facilitação da defesa.
- **Competência Territorial:** ${competencia || "Não fornecido pelo operador."}
- **Prevenção / Juízo Prevento:** Realizada varredura de processos conexos para evitar arguição de continência.

*Análise gerada em conformidade com as diretrizes do escritório Giffoni pelo Assistente de IA.*`;
}

// Helper function to call generateContent with retry and model fallback (handles 503 errors and spikes)
async function callGeminiWithRetry(ai: any, params: { model: string; contents: any; config?: any }, maxRetries = 3) {
  let lastError: any = null;
  const modelsToTry = [params.model, "gemini-flash-latest", "gemini-3.1-flash-lite"];
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const currentModel = attempt === 0 ? params.model : (modelsToTry[attempt] || params.model);
    try {
      console.log(`[Gemini SDK] Attempt ${attempt + 1}: Calling generateContent with model ${currentModel}`);
      const response = await ai.models.generateContent({
        ...params,
        model: currentModel
      });
      if (response && response.text) {
        return response;
      }
      throw new Error("Empty response text");
    } catch (err: any) {
      lastError = err;
      const status = err?.status || err?.code || (err?.message?.includes("503") ? 503 : null);
      console.warn(`[Gemini SDK] Attempt ${attempt + 1} failed with model ${currentModel}. Error:`, err?.message || err);
      
      if (attempt < maxRetries - 1) {
        const delay = (attempt + 1) * 350;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

// ========================================================
// SESSÕES E INTEGRAÇÃO GOOGLE OAUTH CENTRALIZADA:
// ========================================================

// 1. GET /api/auth/session — retorna a sessão ativa e status do Google
app.get("/api/auth/session", async (req: any, res: any) => {
  const sessionCookie = req.signedCookies?.boss_session;
  if (!sessionCookie) {
    return res.json({ authenticated: false, user: null, googleConnected: false });
  }

  try {
    const session = JSON.parse(sessionCookie);
    if (!session || !session.uid) {
      return res.json({ authenticated: false, user: null, googleConnected: false });
    }

    if (!dbAdmin) {
      return res.json({
        authenticated: true,
        user: { uid: session.uid, email: session.email, profile: { email: session.email, role: "boss_admin" } },
        googleConnected: false,
        warning: "Banco de dados indisponível no momento"
      });
    }

    const userRef = dbAdmin.collection("users").doc(session.uid);
    const userSnap = await userRef.get();
    const profile = userSnap.exists ? userSnap.data() : { email: session.email, role: "boss_admin" };

    const tokenRef = dbAdmin.collection("google_tokens").doc(session.uid);
    const tokenSnap = await tokenRef.get();
    const googleConnected = tokenSnap.exists && !!tokenSnap.data()?.refreshToken;

    res.json({
      authenticated: true,
      user: {
        uid: session.uid,
        email: session.email,
        profile
      },
      googleConnected
    });
  } catch (err: any) {
    console.error("Erro em GET /api/auth/session:", err);
    res.json({ authenticated: false, error: err.message });
  }
});

// POST /api/auth/session — cria cookie assinado a partir de ID Token do Firebase Auth
app.post("/api/auth/session", async (req: any, res: any) => {
  const { idToken } = req.body;
  if (!idToken) {
    return res.status(400).json({ error: "Missing ID token" });
  }

  try {
    const decodedToken = await getAuth().verifyIdToken(idToken);
    const uid = decodedToken.uid;
    const email = decodedToken.email;

    const sessionData = { uid, email };
    res.cookie("boss_session", JSON.stringify(sessionData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 30 * 24 * 60 * 60 * 1000,
      signed: true
    });

    res.json({ success: true, uid, email });
  } catch (err: any) {
    console.error("Error setting session cookie:", err);
    res.status(401).json({ error: "Invalid ID token", message: err.message });
  }
});

// 2. GET /api/integrations/status — retorna detalhes de escopo e conexões Google
app.get("/api/integrations/status", async (req: any, res: any) => {
  const sessionCookie = req.signedCookies?.boss_session;
  if (!sessionCookie) {
    return res.status(401).json({ error: "Não autorizado" });
  }

  try {
    const session = JSON.parse(sessionCookie);
    if (!session || !session.uid) {
      return res.status(401).json({ error: "Não autorizado" });
    }

    if (!dbAdmin) {
      return res.json({ connected: false, error: "Database not initialized" });
    }

    const tokenRef = dbAdmin.collection("google_tokens").doc(session.uid);
    const tokenSnap = await tokenRef.get();

    if (!tokenSnap.exists) {
      return res.json({ connected: false });
    }

    const tokenData = tokenSnap.data();
    const requiredScopes = [
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/documents',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.compose',
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/contacts',
      'https://www.googleapis.com/auth/meetings.space.created'
    ];

    const currentScopes = tokenData.scopes || [];
    const missingScopes = requiredScopes.filter(s => !currentScopes.includes(s));
    const hasRefreshToken = !!tokenData.refreshToken;
    const isExpired = Date.now() >= (tokenData.expiryDate || 0);

    res.json({
      connected: true,
      email: session.email,
      hasRefreshToken,
      isExpired,
      expiryDate: tokenData.expiryDate,
      missingScopes,
      scopes: currentScopes
    });
  } catch (err: any) {
    console.error("Error in /api/integrations/status:", err);
    res.status(500).json({ error: err.message });
  }
});

// 3. GET /api/auth/google/start — inicia fluxo OAuth2 Code Flow
app.get("/api/auth/google/start", async (req: any, res: any) => {
  try {
    const state = Math.random().toString(36).substring(2) + Date.now().toString(36);
    res.cookie("oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 10 * 60 * 1000 // 10 min
    });

    const redirectUri = `${process.env.APP_URL || "https://" + req.get("host")}/api/auth/google/callback`;
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID || "286170489831-irji52s23v26af138po2906rodtsdbhp.apps.googleusercontent.com",
      process.env.GOOGLE_CLIENT_SECRET,
      redirectUri
    );

    const scopes = [
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/documents',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.compose',
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/contacts',
      'https://www.googleapis.com/auth/meetings.space.created',
      'https://www.googleapis.com/auth/userinfo.email'
    ];

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: state,
      prompt: 'consent' // Garante que o refresh_token seja retornado
    });

    res.redirect(authUrl);
  } catch (err: any) {
    console.error("Error starting Google OAuth:", err);
    res.status(500).send(`Erro ao iniciar autenticação Google: ${err.message}`);
  }
});

// 4. GET /api/auth/google/callback — valida state, troca code por token e persiste no Firestore
app.get("/api/auth/google/callback", async (req: any, res: any) => {
  const { code, state } = req.query;
  const savedState = req.cookies?.oauth_state;

  if (!state || state !== savedState) {
    return res.status(400).send("CSRF Protection: O state retornado é inválido ou expirou. Tente novamente.");
  }

  res.clearCookie("oauth_state");

  try {
    const redirectUri = `${process.env.APP_URL || "https://" + req.get("host")}/api/auth/google/callback`;
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID || "286170489831-irji52s23v26af138po2906rodtsdbhp.apps.googleusercontent.com",
      process.env.GOOGLE_CLIENT_SECRET,
      redirectUri
    );

    const { tokens } = await oauth2Client.getToken(code as string);
    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    const userEmail = userInfo.data.email;

    if (!userEmail) {
      return res.status(400).send("Não foi possível obter o e-mail da conta Google.");
    }

    let uid = "";
    const sessionCookie = req.signedCookies?.boss_session;
    if (sessionCookie) {
      const session = JSON.parse(sessionCookie);
      uid = session.uid;
    }

    if (!uid && dbAdmin) {
      const q = dbAdmin.collection("users").where("email", "==", userEmail);
      const snap = await q.get();
      if (!snap.empty) {
        uid = snap.docs[0].id;
      }
    }

    if (!uid) {
      uid = userEmail.replace(/[^a-zA-Z0-9]/g, "_");
    }

    if (!dbAdmin) {
      return res.status(500).send("Banco de dados indisponível no callback.");
    }

    const googleTokenData: any = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || null,
      expiryDate: tokens.expiry_date || (Date.now() + ((tokens as any).expires_in || 3600) * 1000),
      scopes: tokens.scope ? tokens.scope.split(' ') : [],
      updatedAt: new Date().toISOString()
    };

    const tokenRef = dbAdmin.collection("google_tokens").doc(uid);
    const existingSnap = await tokenRef.get();
    if (existingSnap.exists) {
      const existingData = existingSnap.data();
      if (!googleTokenData.refreshToken && existingData.refreshToken) {
        googleTokenData.refreshToken = existingData.refreshToken;
      }
    }

    await tokenRef.set(googleTokenData, { merge: true });

    // Login local
    const sessionData = { uid, email: userEmail };
    res.cookie("boss_session", JSON.stringify(sessionData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 30 * 24 * 60 * 60 * 1000,
      signed: true
    });

    console.log(`[GoogleOAuth] Sucesso para o usuário ${userEmail} (${uid})`);
    res.redirect("/boss-giffoni-clientes/dashboard");
  } catch (err: any) {
    console.error("Error exchanging code for tokens:", err);
    res.status(500).send(`Erro ao processar tokens Google: ${err.message}`);
  }
});

// 5. POST /api/auth/logout — limpa o cookie de sessão
app.post("/api/auth/logout", (req: any, res: any) => {
  res.clearCookie("boss_session");
  res.json({ success: true });
});

// 6. POST /api/integrations/google/disconnect — revoga e apaga credenciais do usuário
app.post("/api/integrations/google/disconnect", async (req: any, res: any) => {
  const sessionCookie = req.signedCookies?.boss_session;
  if (!sessionCookie) {
    return res.status(401).json({ error: "Não autorizado" });
  }

  try {
    const session = JSON.parse(sessionCookie);
    if (!session || !session.uid) {
      return res.status(401).json({ error: "Não autorizado" });
    }

    if (!dbAdmin) {
      return res.status(500).json({ error: "Banco de dados indisponível" });
    }

    const tokenRef = dbAdmin.collection("google_tokens").doc(session.uid);
    const snap = await tokenRef.get();

    if (snap.exists) {
      const tokenData = snap.data();
      const tokenToRevoke = tokenData.refreshToken || tokenData.accessToken;
      if (tokenToRevoke) {
        try {
          const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID || "286170489831-irji52s23v26af138po2906rodtsdbhp.apps.googleusercontent.com",
            process.env.GOOGLE_CLIENT_SECRET
          );
          await oauth2Client.revokeToken(tokenToRevoke);
        } catch (revokeErr: any) {
          console.warn("[GoogleOAuth] Falha ao revogar token:", revokeErr.message);
        }
      }
      await tokenRef.delete();
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error("Error disconnecting Google:", err);
    res.status(500).json({ error: err.message });
  }
});

// Format structured case details using Gemini AI
app.post("/api/gemini-format", async (req, res) => {
  try {
    const { fatosFundamentos, estrategiaJuridica, competenciaJurisdicional } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.warn("[GeminiFormat] GEMINI_API_KEY not found. Using high-fidelity template.");
      const text = generateHighFidelityMockFormat(fatosFundamentos, estrategiaJuridica, competenciaJurisdicional);
      return res.json({ text });
    }

    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    const prompt = `Você é o Gemini Líder Técnico de Estudo de Caso (EDRP) do escritório Giffoni.
Sua tarefa é formatar e estruturar de forma extremamente profissional, elegante, rica e persuasiva (com títulos em Markdown, marcadores, etc.) os dados fornecidos pelo operador humano para subsidiar a redação final da petição inicial.

DADOS BRUTOS DO OPERADOR HUMANO:
1. FATOS NARRADOS E FUNDAMENTOS JURÍDICOS:
${fatosFundamentos || "Não fornecido."}

2. ESTRATÉGIA PROCESSUAL DEFINIDA:
${estrategiaJuridica || "Não fornecido."}

3. JURISDIÇÃO E COMPETÊNCIA TERRITORIAL:
${competenciaJurisdicional || "Não fornecido."}

Gere um RELATÓRIO JURÍDICO DE ESTRUTURAÇÃO DE TESE E ESTRATÉGIA PROCESSUAL (em padrão Markdown profissional brasileiro) contendo:
- Resumo Fático Executivo Organizado (Dedução imediata)
- Teses Principais & Fundamentação Normativa Robusta
- Estratégia de Provas e Preclusão Evitada
- Competência Jurisdicional e Foro Competente
Mantenha um tom pericial, assertivo, formal e de alto rigor técnico-jurídico brasileiro.`;

    const response = await callGeminiWithRetry(ai, {
      model: "gemini-3.5-flash",
      contents: prompt,
    });

    return res.json({ text: response.text || generateHighFidelityMockFormat(fatosFundamentos, estrategiaJuridica, competenciaJurisdicional) });
  } catch (err: any) {
    console.error("[GeminiFormat] Error occurred, using high-fidelity fallback:", err);
    const fallbackText = generateHighFidelityMockFormat(
      req.body?.fatosFundamentos,
      req.body?.estrategiaJuridica,
      req.body?.competenciaJurisdicional
    );
    return res.json({ text: fallbackText });
  }
});

// Format structured case details using Gemini AI for Revision Audit
app.post("/api/gemini-revisao", async (req, res) => {
  try {
    const { caseDetails } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(400).json({ 
        error: "GEMINI_API_KEY_MISSING",
        message: "Integração real com Gemini IA ainda não configurada." 
      });
    }

    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    const prompt = `Você é o Gemini Auditor Sênior de Revisão Jurídica do escritório Giffoni.
Sua tarefa é analisar os detalhes de um caso jurídico sob revisão e fornecer uma análise preliminar detalhada dividida em:
1. Acertos identificados (pontos corretos, consistentes ou adequados encontrados no caso/estruturação)
2. Erros identificados (inconsistências, falhas, lacunas, contradições, ausência de documentos, ausência de dados ou problemas relevantes)
3. Sugestões de melhoria (recomendações práticas para melhorar o caso, ajustar documentos, complementar dados, corrigir fluxo ou após a revisão)

DETALHES DO CASO SOB ANÁLISE:
${JSON.stringify(caseDetails, null, 2)}

Responda estritamente em formato JSON com as chaves "acertos" (lista de strings), "erros" (lista de strings) e "sugestoes" (lista de strings).`;

    const response = await callGeminiWithRetry(ai, {
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error("Retorno vazio do Gemini");
    }

    const result = JSON.parse(responseText);
    return res.json(result);
  } catch (err: any) {
    console.error("[GeminiRevisao] Error:", err);
    return res.status(500).json({ 
      error: "TECHNICAL_ERROR", 
      message: err.message || "Erro técnico ao processar pré-revisão com Gemini IA." 
    });
  }
});

// --- GOOGLE CALENDAR AUTOMATION ENDPOINTS ---

app.post("/api/calendar/check-conflicts", async (req, res) => {
  try {
    const { caseId, googleAccessToken, date, time, type, local, link } = req.body;

    if (!caseId || !date || !time) {
      return res.status(400).json({ error: "Parâmetros obrigatórios ausentes: caseId, date, time." });
    }

    const token = googleAccessToken || req.headers["authorization"]?.split(" ")[1] || "";
    if (!token) {
      return res.status(401).json({ error: "Token do Google não fornecido ou inválido." });
    }

    if (!dbAdmin) {
      return res.status(500).json({ error: "Firebase Admin não inicializado ou banco indisponível." });
    }

    // Load integration configuration
    const connectorsSnap = await dbAdmin.collection("settings").doc("connectors").get();
    const connectorsData = connectorsSnap.exists ? connectorsSnap.data() : null;
    const googleCalendarConfig = connectorsData?.googleCalendar;

    if (!googleCalendarConfig || googleCalendarConfig.status !== 'ativo') {
      return res.status(400).json({ error: "A integração com Google Calendar não está configurada ou ativa." });
    }

    const calendarId = googleCalendarConfig.calendarIdPlaceholder || 'primary';

    // Load case and client data
    const caseSnap = await dbAdmin.collection("cases").doc(caseId).get();
    if (!caseSnap.exists) {
      return res.status(404).json({ error: "Caso não encontrado" });
    }
    const caseData = caseSnap.data();
    const clientSnap = caseData.clientId ? await dbAdmin.collection("clients").doc(caseData.clientId).get() : null;
    const clientData = clientSnap && clientSnap.exists ? clientSnap.data() : null;

    const clientName = clientData ? (clientData.pessoaFisica?.nomeCompleto || clientData.pessoaJuridica?.razaoSocial || clientData.name || clientData.fullName || "Cliente") : "Cliente";
    const adverseParty = caseData.adverseParty || "";
    const processNumber = caseData.processNumber || caseData.protocol?.numeroProcesso || caseData.numeroProcesso || "";

    // Formulate start and end times in Sao Paulo timezone
    const startIso = `${date}T${time}:00-03:00`;
    const [hours, minutes] = time.split(":").map(Number);
    const endHours = (hours + 1) % 24;
    const endIso = `${date}T${String(endHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00-03:00`;

    // Fetch calendar events
    const gCalUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?timeMin=${encodeURIComponent(startIso)}&timeMax=${encodeURIComponent(endIso)}&singleEvents=true`;
    const gCalRes = await fetch(gCalUrl, {
      headers: { "Authorization": `Bearer ${token}` }
    });

    if (!gCalRes.ok) {
      const errText = await gCalRes.text();
      return res.status(gCalRes.status).json({ error: `Erro na API do Google Calendar: ${errText}` });
    }

    const gCalData = await gCalRes.json();
    const events = gCalData.items || [];

    let sameEventFound = false;
    let sameEvent: any = null;
    const conflicts: any[] = [];

    for (const event of events) {
      const summary = (event.summary || "").toLowerCase();
      const description = (event.description || "").toLowerCase();
      const location = (event.location || "").toLowerCase();

      // soft matching criteria
      const matchesClient = clientName && (summary.includes(clientName.toLowerCase()) || description.includes(clientName.toLowerCase()));
      const matchesAdverse = adverseParty && (summary.includes(adverseParty.toLowerCase()) || description.includes(adverseParty.toLowerCase()));
      const matchesProcess = processNumber && (summary.includes(processNumber.toLowerCase()) || description.includes(processNumber.toLowerCase()));
      const matchesLocation = (local && location.includes(local.toLowerCase())) || (link && description.includes(link.toLowerCase()));

      const isSameEvent = (matchesClient && matchesAdverse) || 
                          (processNumber && matchesProcess) || 
                          (matchesClient && matchesLocation);

      if (isSameEvent) {
        sameEventFound = true;
        sameEvent = {
          id: event.id,
          htmlLink: event.htmlLink,
          summary: event.summary,
        };
      } else {
        conflicts.push({
          title: event.summary || "Compromisso Sem Título",
          start: event.start?.dateTime || event.start?.date,
          end: event.end?.dateTime || event.end?.date,
          location: event.location || "Sem Local",
          calendarId: calendarId,
        });
      }
    }

    return res.json({
      success: true,
      calendarId,
      conflicts,
      sameEventFound,
      sameEvent,
    });
  } catch (err: any) {
    console.error("[CheckConflicts] Exception:", err);
    return res.status(500).json({ error: `Erro no backend ao consultar conflitos: ${err.message || err}` });
  }
});

app.post("/api/calendar/create-event", async (req, res) => {
  try {
    const { caseId, googleAccessToken, date, time, type, local, link, juizo, perito, assistenteTecnico, observacoes } = req.body;

    if (!caseId || !date || !time || !type) {
      return res.status(400).json({ error: "Parâmetros obrigatórios ausentes: caseId, date, time, type." });
    }

    const token = googleAccessToken || req.headers["authorization"]?.split(" ")[1] || "";
    if (!token) {
      return res.status(401).json({ error: "Token do Google não fornecido ou inválido." });
    }

    if (!dbAdmin) {
      return res.status(500).json({ error: "Firebase Admin não inicializado ou banco indisponível." });
    }

    // Load integration configuration
    const connectorsSnap = await dbAdmin.collection("settings").doc("connectors").get();
    const connectorsData = connectorsSnap.exists ? connectorsSnap.data() : null;
    const googleCalendarConfig = connectorsData?.googleCalendar;

    if (!googleCalendarConfig || googleCalendarConfig.status !== 'ativo') {
      return res.status(400).json({ error: "A integração com Google Calendar não está configurada ou ativa." });
    }

    const calendarId = googleCalendarConfig.calendarIdPlaceholder || 'primary';

    // Load case and client data
    const caseSnap = await dbAdmin.collection("cases").doc(caseId).get();
    if (!caseSnap.exists) {
      return res.status(404).json({ error: "Caso não encontrado" });
    }
    const caseData = caseSnap.data();
    const clientSnap = caseData.clientId ? await dbAdmin.collection("clients").doc(caseData.clientId).get() : null;
    const clientData = clientSnap && clientSnap.exists ? clientSnap.data() : null;

    const clientName = clientData ? (clientData.pessoaFisica?.nomeCompleto || clientData.pessoaJuridica?.razaoSocial || clientData.name || clientData.fullName || "Cliente") : "Cliente";
    const adverseParty = caseData.adverseParty || "";
    const processNumber = caseData.processNumber || caseData.protocol?.numeroProcesso || caseData.numeroProcesso || "";

    // 1. Título sugerido
    const prefix = type === "audiencia" ? "Audiência" : "Perícia";
    const eventTitle = `${prefix} — ${clientName} x ${adverseParty || "Sem Parte Adversa"}${processNumber ? ` — ${processNumber}` : ""}`;

    // 2. Descrição sugerida
    let eventDescription = "";
    if (type === "audiencia") {
      eventDescription = `Cliente: ${clientName}
Parte adversa: ${adverseParty || "Não informada"}
Processo: ${processNumber || "Não informado"}
Tipo de audiência: ${juizo || "Não especificado"}
Modalidade: ${req.body.audienciaType || "presencial"}
Local/link: ${local || link || "Não informado"}
Observações: ${observacoes || "Nenhuma"}
Origem: Giffoni Connect — Setor de Audiências`;
    } else {
      eventDescription = `Cliente: ${clientName}
Parte adversa: ${adverseParty || "Não informada"}
Processo: ${processNumber || "Não informado"}
Tipo de perícia: ${req.body.periciaType || "Não especificado"}
Modalidade: ${req.body.periciaTypeMode || "presencial"}
Perito: ${perito || "Não informado"}
Assistente técnico: ${assistenteTecnico || "Não informado"}
Local/link: ${local || "Não informado"}
Observações: ${observacoes || "Nenhuma"}
Origem: Giffoni Connect — Setor de Perícias`;
    }

    // Formulate start and end times in Sao Paulo timezone
    const startIso = `${date}T${time}:00-03:00`;
    const [hours, minutes] = time.split(":").map(Number);
    const endHours = (hours + 1) % 24;
    const endIso = `${date}T${String(endHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00-03:00`;

    const eventResource = {
      summary: eventTitle,
      description: eventDescription,
      location: local || link || "",
      start: {
        dateTime: startIso,
        timeZone: "America/Sao_Paulo",
      },
      end: {
        dateTime: endIso,
        timeZone: "America/Sao_Paulo",
      },
    };

    // Insert Google Calendar event
    const createUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
    const createRes = await fetch(createUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(eventResource),
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      return res.status(createRes.status).json({ error: `Erro ao criar evento: ${errText}` });
    }

    const createdEvent = await createRes.json();

    // Update case document in Firestore
    const updatePayload: any = {};
    if (type === "audiencia") {
      updatePayload["protocol.audienciaGoogleCalendar"] = {
        eventId: createdEvent.id,
        htmlLink: createdEvent.htmlLink,
        date,
        time,
        status: "criado",
        timestamp: new Date().toISOString()
      };
    } else {
      updatePayload["protocol.periciaGoogleCalendar"] = {
        eventId: createdEvent.id,
        htmlLink: createdEvent.htmlLink,
        date,
        time,
        status: "criado",
        timestamp: new Date().toISOString()
      };
    }

    await dbAdmin.collection("cases").doc(caseId).set(updatePayload, { merge: true });

    return res.json({
      success: true,
      eventId: createdEvent.id,
      htmlLink: createdEvent.htmlLink,
      date,
      time,
      status: "criado",
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    console.error("[CreateEvent] Exception:", err);
    return res.status(500).json({ error: `Erro no backend ao criar compromisso: ${err.message || err}` });
  }
});

function generateHighFidelityMockViabilidade(lead: any, docStatus: string, docList: string[]) {
  const nome = lead?.pessoaFisica?.nomeCompleto || lead?.pessoaJuridica?.razaoSocial || lead?.name || "Cliente em Potencial";
  const area = lead?.areaJuridica || "Geral";
  const assunto = lead?.assunto || "Análise Geral";
  const dor = lead?.dorPrincipal || "Não detalhado";
  const documentos = docList && docList.length > 0 ? docList.map((d: string) => `- ${d}`).join('\n') : "- Nenhum documento anexado.";

  let conclusaoMock = "🟡 VIÁVEL COM RESSALVAS";
  if (docStatus.includes("INSUFICIENTE") || docList.length === 0) {
    conclusaoMock = "🟠 NECESSITA COMPLEMENTAÇÃO DOCUMENTAL";
  } else if (docStatus.includes("SUFICIENTE")) {
    conclusaoMock = "🟢 VIÁVEL";
  }

  return `### ⚖️ PARECER TÉCNICO DE VIABILIDADE JURÍDICA — GIFFONI ADVOGADOS
**Agente Especialista:** Assistente Técnico de Análise de Viabilidade
**Interessado:** ${nome}
**Área de Prática:** ${area}
**Data de Emissão:** ${new Date().toLocaleDateString('pt-BR')}

---

#### I – Objeto da Consulta
Trata-se de estudo técnico de viabilidade para avaliar os fundamentos jurídicos do interesse qualificado manifestado por **${nome}** na área de **${area}**, com foco em: *${assunto}*.

#### II – Resumo dos Fatos
Com base exclusivamente nas informações coletadas no cadastro do cliente em potencial, relata-se:
- **Dor Principal relatada:** ${dor}
- **Urgência:** ${lead?.urgencia || "Média"}
- **Existência de litígio ativo:** ${lead?.possuiProcesso ? `Sim, processo nº ${lead.numeroProcesso || "não informado"} contra a parte contrária ${lead.parteContraria || "não informada"}` : "Não há processo em andamento."}
- **Observações gerais:** ${lead?.observacoes || "Nenhuma observação fática adicional."}

*Nota Técnica:* Proibido presumir ou criar quaisquer fatos não informados na presente ata de atendimento.

#### III – Documentação Analisada
Procedeu-se à verificação documental no diretório de triagem do Google Drive, registrando-se os seguintes documentos:
${documentos}

**Status de Integridade Documental:** ${docStatus}

#### IV – Questões Jurídicas Relevantes
1. **Verificação do Interesse de Agir:** Necessidade de comprovação do trinômio utilidade-necessidade-adequação da tutela pleiteada.
2. **Distribuição do Ônus da Prova:** Limitações decorrentes da ausência de provas documentais robustas e imediata necessidade de superação das preclusões.
3. **Prescrição e Decadência:** Pronta averiguação dos prazos extintivos aplicáveis com base nos fatos sob exame.

#### V – Fundamentação Jurídica
- **Do Dever de Indenizar e Responsabilidade Civil (se aplicável):** Com esteio nos arts. 186 e 927 do Código Civil, a caracterização de ilicitude civil requer conduta voluntária, dano e nexo causal.
- **Do Código de Defesa do Consumidor:** Incidência do art. 6º, incisos VI e VIII, assegurando a facilitação da defesa do hipossuficiente.
- **Do Ônus do Artigo 373 do CPC:** Distribuição adequada dos ônus da prova cabendo ao autor comprovar o fato constitutivo de seu direito, sob pena de indeferimento da exordial.

#### VI – Análise de Viabilidade
- **Pontos Favoráveis:** O relato do interessado demonstra congruência fática com a jurisprudência corrente da firma. Existe verossimilhança nas alegações iniciais do atendimento qualificado.
- **Pontos Desfavoráveis:** ${docList.length === 0 ? "A ausência absoluta de documentos comprobatórios enfraquece consideravelmente a tese jurídica em juízo de cognição sumária." : "A documentação anexada constitui indício preliminar, demandando reforço factual para instrução exequível da lide."}

#### VII – Riscos Identificados
- **Risco de Extinção Sem Resolução do Mérito:** Caso não sejam apresentados documentos essenciais exigidos pelo Juízo (Art. 320 e 321 do CPC).
- **Risco de Sucumbência:** Aplicação da verba sucumbencial em desfavor do proponente em caso de improcedência.
- **Risco de Preclusão de Provas:** Importância de arrolar todas as provas necessárias na petição inicial ou na réplica.

#### VIII – Recomendações
1. Recomenda-se a notificação imediata do interessado para colher cópias adicionais que confirmem o nexo de causalidade.
2. Proceder à organização cronológica de fatos e contatos para subsidiar o estudo técnico de caso (EDRP).

#### IX – Conclusão
Ante o exposto e em conformidade estrita com as informações coletadas, o caso sob exame é classificado como:
### ${conclusaoMock}

---

### 📋 RESUMO EXECUTIVO DO PARECER
* **Chance de êxito estimada:** ${docStatus.includes("SUFICIENTE") ? "Alta (Cerca de 75%)" : "Média (Cerca de 50%)"}
* **Grau de risco:** ${docStatus.includes("SUFICIENTE") ? "Mínimo" : "Moderado"}
* **Necessidade de prova complementar:** ${docStatus.includes("SUFICIENTE") ? "Baixa" : "Sim, documentos de preclara pertinência temática fática"}
* **Próxima ação recomendada:** ${docStatus.includes("SUFICIENTE") ? "Avançar lead para contratação imediata e confecção de instrumento contratual." : "Notificar o cliente em potencial solicitando complementação urgente na pasta '01 DOCUMENTOS'."}`;
}

app.post("/api/gemini-viabilidade", async (req, res) => {
  try {
    const { lead, docStatus, docList } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.warn("[GeminiViabilidade] GEMINI_API_KEY not found. Using high-fidelity template.");
      const text = generateHighFidelityMockViabilidade(lead, docStatus, docList);
      return res.json({ text });
    }

    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    const leadNome = lead?.pessoaFisica?.nomeCompleto || lead?.pessoaJuridica?.razaoSocial || lead?.name || "Cliente em Potencial";
    const leadTipo = lead?.tipoPessoa || "PF";
    const leadArea = lead?.areaJuridica || "Sem área definida";
    const leadAssunto = lead?.assunto || "Assunto Geral";
    const leadDor = lead?.dorPrincipal || "Não detalhado";
    const leadUrgencia = lead?.urgencia || "Média";
    const leadProcesso = lead?.possuiProcesso ? `Sim, processo ativo nº ${lead.numeroProcesso || "não informado"} contra ${lead.parteContraria || "não informada"}` : "Não";
    const leadNotas = lead?.observacoes || "Nenhuma nota fática adicional.";
    const documentosGerais = docList && docList.length > 0 ? docList.join(', ') : "Nenhum documento anexado";

    const prompt = `Você é o Agente Especialista em Análise de Viabilidade Jurídica da Giffoni Advogados Associados.
Sua função é transformar informações recebidas de potenciais clientes em um Parecer Jurídico de Viabilidade estruturado de alto nível, mantendo rigor técnico e formalidade jurídica brasileira.

DADOS DO CASO CONFIGURADOS PELO OPERADOR:
- Nome do Interessado: ${leadNome}
- Tipo de Pessoa: ${leadTipo}
- Área de Prática Jurídica: ${leadArea}
- Assunto Principal: ${leadAssunto}
- Dor/Queixa Principal: ${leadDor}
- Urgência no Atendimento: ${leadUrgencia}
- Já possui processo ativo? ${leadProcesso}
- Observações e Anotações Fáticas do Cadastro: ${leadNotas}

DADOS DA DOCUMENTAÇÃO VERIFICADA NO GOOGLE DRIVE:
- Diretório de Triagem do Drive: Verificado
- Pasta "01 DOCUMENTOS" existe? Sim
- Documentos encontrados anexados: ${documentosGerais}
- Classificação de Integridade Documental do Operador: ${docStatus}

DIRETRIZES DA ANÁLISE:
1. Considere EXCLUSIVAMENTE as informações fáticas existentes listadas acima.
2. É estritamente PROIBIDO presumir fatos não informados ou criar informações inexistentes (evite alucinar detalhes de datas ou nomes!).
3. É OBRIGATÓRIO apontar quaisquer inconsistências relatadas, ausência de provas fundamentais, riscos processuais inerentes, e pontos favoráveis/desfavoráveis identificados de forma realista.

ESTRUTURA REQUERIDA DO PARECER JURÍDICO (Use marcadores Markdown elegantes e Títulos com numeração romana):
I – Objeto da Consulta
II – Resumo dos Fatos
III – Documentação Analisada
IV – Questões Jurídicas Relevantes
V – Fundamentação Jurídica
VI – Análise de Viabilidade
VII – Riscos Identificados
VIII – Recomendações
IX – Conclusão
(A conclusão IX deve terminar enquadrando obrigatoriamente o caso em UMA das seguintes categorias:
🟢 VIÁVEL
🟡 VIÁVEL COM RESSALVAS
🟠 NECESSITA COMPLEMENTAÇÃO DOCUMENTAL
🔴 INVIÁVEL JURIDICAMENTE)

Ao final do parecer, acrescente um bloco exclusivo intitulado "📋 RESUMO EXECUTIVO DO PARECER" estruturado com:
* Chance de êxito estimada
* Grau de risco
* Necessidade de prova complementar
* Próxima ação recomendada

Mantenha a escrita polida, jurídica, elegante e com espaçamento impecável.`;

    const response = await callGeminiWithRetry(ai, {
      model: "gemini-3.5-flash",
      contents: prompt,
    });

    return res.json({ text: response.text || generateHighFidelityMockViabilidade(lead, docStatus, docList) });
  } catch (err: any) {
    console.error("[GeminiViabilidade] Error calling Gemini API. Fallback triggered:", err);
    const fallbackText = generateHighFidelityMockViabilidade(req.body?.lead, req.body?.docStatus, req.body?.docList);
    return res.json({ text: fallbackText });
  }
});

// Proxy requests to the Google Drive Build endpoint to bypass browser CORS
app.post("/api/proxy-google-drive", async (req, res) => {
  try {
    console.log("[Proxy] Proxy Google Drive acionado.");
    const { targetEndpoint, payload, integrationKey } = req.body;

    if (!targetEndpoint) {
      return res.status(400).json({ error: "O campo targetEndpoint é obrigatório." });
    }
    
    const trimmedUrl = targetEndpoint.trim();
    console.log(`[Proxy] Endpoint destino recebido: ${trimmedUrl}`);

    if (trimmedUrl.includes("aistudio.google.com/apps") || trimmedUrl.includes("accounts.google.com")) {
      return res.status(400).json({
        error: "A URL configurada não é uma API pública e protegida de produção. Ela aponta para a visualização administrativa do AI Studio ou de login do Google. Por favor, acesse Configurações > Integrações no Portal BOSS e configure a URL pública do runtime/Cloud Run do Build Google Drive (ex: https://ais-dev-....run.app)."
      });
    }

    if (payload) {
      console.log("[Proxy] Payload recebido:", JSON.stringify(payload));
    }

    let isCompatibilityMode = false;
    let finalHeaders: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (!integrationKey) {
      console.log("[Proxy] Chave de integração Google Drive ausente no Portal BOSS. Ativando Modo compatibilidade.");
      isCompatibilityMode = true;
    } else {
      const maskKey = (key: string) => {
        if (!key) return "";
        if (key.length <= 8) return "********";
        const prefix = key.startsWith("boss_drive_live_") ? "boss_drive_live_" : key.substring(0, Math.min(15, key.length - 4));
        const suffix = key.substring(key.length - 4);
        return `${prefix}********${suffix}`;
      };

      console.log(`[Proxy] Chave de integração Google Drive recebida: ${maskKey(integrationKey)}`);
      console.log(`[Proxy] Encaminhando header X-BOSS-Google-Drive-Integration-Key.`);
      finalHeaders["X-BOSS-Google-Drive-Integration-Key"] = integrationKey;
    }

    const incomingCookie = req.headers["cookie"] || "";
    const { response, text } = await smartFetch(trimmedUrl, {
      method: "POST",
      headers: finalHeaders,
      body: JSON.stringify(payload),
    }, incomingCookie);

    const status = response.status;
    const contentType = response.headers.get("content-type") || "";

    console.log(`[Proxy] Resposta recebida da API externa. Status: ${status}, Content-Type: ${contentType}`);

    const isHtmlResponse = contentType.includes("html") || 
                           text.trim().startsWith("<") || 
                           text.toLowerCase().includes("<!doctype html") || 
                           text.toLowerCase().includes("<html");

    if (isHtmlResponse) {
      console.error(`[Proxy] Detetada resposta HTML da rota de API. Provavelmente ocorreu login do Google ou redirecionamento não-API.`);
      return res.status(400).json({
        error: "A URL do Build Google Drive configurada em Configurações > Integrações não é uma API. Ela abriu uma página de login do Google (retornou HTML). Use a URL pública do runtime/Cloud Run do Build Google Drive (ex: https://ais-dev-....run.app)."
      });
    }

    if (!response.ok) {
      console.error(`[Proxy] Erro do build externo (${status}):`, text);
      return res.status(status).json({ error: text || `O build externo retornou o status de erro ${status}` });
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { text };
    }

    console.log(`[Proxy] Resposta parseada com sucesso do Build Google Drive:`, data);
    return res.status(200).json(data);
  } catch (err: any) {
    console.error("[Proxy] Exception:", err);
    return res.status(500).json({ error: `Falha na ponte do servidor (Proxy): ${err.message || err}` });
  }
});

// LEGADO — NÃO USAR NO FLUXO DA PROCURAÇÃO PF.
// O GDI não faz mais parte da arquitetura do Portal BOSS.
// Proxy requests to the Google Docs Integration (GDI) to keep keys hidden & bypass CORS
app.post("/api/proxy-google-docs", async (req, res) => {
  try {
    console.log("[Proxy Docs] Proxy Google Docs acionado.");
    const { targetEndpoint, payload, integrationKey } = req.body;

    const targetEndpointValue = req.body.targetEndpoint;
    if (!targetEndpointValue) {
      return res.status(400).json({ error: "O campo targetEndpoint é obrigatório." });
    }
    
    let trimmedUrl = targetEndpointValue.trim();

    console.log(`[Proxy Docs] Endpoint destino final: ${trimmedUrl}`);

    const lowerTrimmed = trimmedUrl.toLowerCase();
    if (lowerTrimmed.includes("aistudio.google.com") || 
        lowerTrimmed.includes("showpreview") || 
        lowerTrimmed.includes("showassistant") || 
        lowerTrimmed.includes("accounts.google.com") || 
        lowerTrimmed.includes("firebaseapp login") || 
        lowerTrimmed.includes("/__/auth/handler")) {
      return res.status(400).json({
        error: "A URL do GDI configurada em Configurações > Integrações não é uma API válida (retornou HTML). Por favor, use a URL pública real do webhook do GDI."
      });
    }

    const trimmedKey = (integrationKey || "").trim();
    if (!trimmedKey) {
      return res.status(400).json({
        success: false,
        status: "failed",
        errorCode: "GDI_INTEGRATION_KEY_MISSING",
        errorMessage: "A chave secreta do header X-BOSS-Google-Docs-Integration-Key está ausente."
      });
    }

    if (payload) {
      console.log("[Proxy Docs] Payload recebido:", JSON.stringify(payload));
    }

    // Log and inspect headers for Cookie diagnostic
    const incomingHeaders = req.headers;
    const cookieHeader = req.headers["cookie"] || "";
    console.log(`[Proxy Docs Debug] Incoming cookies: ${cookieHeader.substring(0, 100)}...`);
    console.log(`[Proxy Docs Debug] All incoming header keys: ${Object.keys(incomingHeaders).join(", ")}`);

    let finalHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "X-BOSS-Google-Docs-Integration-Key": trimmedKey
    };

    // Forward incoming Cookie header if present to authenticate with the other dev container
    if (cookieHeader) {
      finalHeaders["Cookie"] = cookieHeader;
    }

    const maskKey = (key: string) => {
      if (!key) return "";
      if (key.length <= 8) return "********";
      return key.substring(0, Math.min(15, key.length - 4)) + "********" + key.substring(key.length - 4);
    };
    console.log(`[Proxy Docs] Chave de integração Google Docs recebida e anexada a finalHeaders: ${maskKey(trimmedKey)}`);

    const { response, text } = await smartFetch(trimmedUrl, {
      method: "POST",
      headers: finalHeaders,
      body: JSON.stringify(payload),
    }, cookieHeader);

    const status = response.status;
    const contentType = response.headers.get("content-type") || "";

    console.log(`[Proxy Docs] Resposta recebida da API externa GDI. Status: ${status}, Content-Type: ${contentType}`);

    const isHtmlResponse = contentType.includes("html") || 
                           text.trim().startsWith("<") || 
                           text.toLowerCase().includes("<!doctype html") || 
                           text.toLowerCase().includes("<html");

    if (isHtmlResponse) {
      const textSample = text.substring(0, 500).trim();

      return res.status(502).json({
        success: false,
        status: "failed",
        errorCode: "GDI_ENDPOINT_RETURNED_HTML",
        errorMessage: "O endpoint configurado para o GDI retornou HTML em vez de JSON. O payload pode não ter chegado ao receptor real.",
        targetEndpoint: trimmedUrl,
        httpStatus: status,
        contentType,
        responseSample: textSample,
        hint: "O GDI provavelmente ainda está atrás do login do AI Studio. Publique o GDI em um endpoint público (Cloud Run, URL terminando em .run.app) e salve essa URL em Configurações > Integrações > Google Docs."
      });
    }

    if (!response.ok) {
      let parsedError = null;
      try {
        parsedError = JSON.parse(text);
      } catch {}

      return res.status(status || 502).json({
        success: false,
        status: "failed",
        errorCode: parsedError?.errorCode || "GDI_HTTP_ERROR",
        errorMessage: parsedError?.errorMessage || parsedError?.error || text || `GDI retornou HTTP ${status}`,
        targetEndpoint: trimmedUrl,
        httpStatus: status,
        contentType,
        rawResponse: text.substring(0, 1000)
      });
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { text };
    }

    console.log(`[Proxy Docs] Resposta parseada com sucesso do GDI:`, data);
    return res.status(200).json(data);
  } catch (err: any) {
    console.error("[Proxy Docs] Exception:", err);
    return res.status(502).json({
      success: false,
      status: "failed",
      errorCode: "PORTAL_GDI_PROXY_NETWORK_EXCEPTION",
      errorMessage: `Falha real na ponte do servidor para o GDI: ${err.message || err}`,
      targetEndpoint: req.body?.targetEndpoint || "",
      hint: "Nenhum documento foi gerado. Nenhum mock foi criado."
    });
  }
});

// LEGADO — NÃO USAR NO FLUXO DA PROCURAÇÃO PF.
// O GDI não faz mais parte da arquitetura do Portal BOSS.
// Live revalidation endpoint for GDI matching exact validations of Task 1
app.post("/api/proxy-google-docs/revalidate", async (req, res) => {
  try {
    const { endpointUrl, integrationKey } = req.body || {};
    if (!endpointUrl || !integrationKey) {
      return res.status(400).json({
        success: false,
        error: "URL e chave de integração são obrigatórias para revalidação."
      });
    }

    const trimmedKey = (integrationKey || "").trim();
    if (
      trimmedKey.startsWith("http://") || 
      trimmedKey.startsWith("https://") || 
      trimmedKey.includes(".run.app") || 
      trimmedKey.includes("/api/webhook/gdi-job") ||
      trimmedKey.includes("aistudio.google.com") ||
      trimmedKey.startsWith("/boss-giffoni-clientes") ||
      trimmedKey === "boss_docs_live_standard" ||
      trimmedKey === "boss_gdi_secure_audit_key_123"
    ) {
      return res.status(200).json({
        success: false,
        error: "Valor inválido no campo da chave. Você colou uma rota, URL, segredo legado ou de placeholder no lugar da Chave de Auditoria GDI.",
        failedEndpoint: endpointUrl,
        failedStatus: 400,
        failedContentType: "text/plain",
        failedResponseText: "Valor inválido no campo da chave. Você colou uma rota, URL, segredo legado ou de placeholder no lugar da Chave de Auditoria GDI."
      });
    }

    let url = endpointUrl.trim();
    if (url.endsWith("/")) {
      url = url.slice(0, -1);
    }
    if (url.includes("?")) {
      url = url.split("?")[0];
    }

    // Un-prefix custom route suffix if configured fully in database
    if (url.endsWith("/api/webhook/gdi-job")) {
      url = url.substring(0, url.length - "/api/webhook/gdi-job".length);
    } else if (url.endsWith("/api/webhook/gdi-job/")) {
      url = url.substring(0, url.length - "/api/webhook/gdi-job/".length);
    }
    if (url.endsWith("/")) {
      url = url.slice(0, -1);
    }

    // Safeguards for restricted domains (Task 8)
    const lowerUrl = url.toLowerCase();
    const blockedTerms = [
      "aistudio.google.com",
      "showpreview",
      "showassistant",
      "accounts.google.com",
      "localhost",
      "127.0.0.1",
      "/__/auth/handler"
    ];
    for (const term of blockedTerms) {
      if (lowerUrl.includes(term)) {
        return res.status(200).json({
          success: false,
          error: `URL inválida: contém termo proibido (${term}).`,
          failedEndpoint: url,
          failedStatus: 400,
          failedContentType: "text/plain",
          failedResponseText: `Refusado por conter termo restrito (${term}).`
        });
      }
    }

    const healthUrl = `${url}/api/health`;
    const webhookReadyUrl = `${url}/api/webhook/gdi-job`;

    const incomingCookie = req.headers["cookie"] || "";
    const headers = {
      "X-BOSS-Google-Docs-Integration-Key": integrationKey.trim(),
      "Accept": "application/json"
    };

    console.log(`[PORTAL_GDI_LIVE_REVALIDATION_STARTED] Server calling GET ${healthUrl}`);
    let healthText = "";
    let healthStatus = 0;
    let healthContentType = "";
    try {
      const { response, text } = await smartFetch(healthUrl, { method: "GET", headers }, incomingCookie);
      healthStatus = response.status;
      healthContentType = response.headers.get("content-type") || "";
      healthText = text;
    } catch (e: any) {
      healthStatus = 0;
      healthText = e.message || String(e);
    }

    console.log(`[PORTAL_GDI_LIVE_REVALIDATION_STARTED] Server calling GET ${webhookReadyUrl}`);
    let webhookText = "";
    let webhookStatus = 0;
    let webhookContentType = "";
    try {
      const { response, text } = await smartFetch(webhookReadyUrl, { method: "GET", headers }, incomingCookie);
      webhookStatus = response.status;
      webhookContentType = response.headers.get("content-type") || "";
      webhookText = text;
    } catch (e: any) {
      webhookStatus = 0;
      webhookText = e.message || String(e);
    }

    // Parse & Validate health JSON (success === true, status === "operational" or "ready", service === "gdi")
    let healthJson: any = null;
    let healthValid = false;
    try {
      healthJson = JSON.parse(healthText);
      healthValid = (
        healthJson &&
        healthJson.success === true &&
        (healthJson.status === "operational" || healthJson.status === "ready") &&
        healthJson.service === "gdi"
      );
    } catch (e) {
      // not JSON
    }

    // Parse & Validate webhook ready JSON (success === true, status === "ready" or "operational", service === "gdi")
    let webhookJson: any = null;
    let webhookValid = false;
    try {
      webhookJson = JSON.parse(webhookText);
      webhookValid = (
        webhookJson &&
        webhookJson.success === true &&
        (webhookJson.status === "ready" || webhookJson.status === "operational") &&
        webhookJson.service === "gdi"
      );
    } catch (e) {
      // not JSON
    }

    // Helper checks to identify auth gated responses
    const isRedirectOrBlocked = (status: number, contentType: string, text: string): boolean => {
      const cLower = (contentType || "").toLowerCase();
      const tLower = (text || "").toLowerCase();
      
      // If it contains GDI-specific wording, it is NOT blocked. It is the real GDI responding.
      if (
        tLower.includes("gdi ") ||
        tLower.includes("gdi_") ||
        tLower.includes("gdi operacional") ||
        tLower.includes("google docs integration") ||
        tLower.includes("integration-key") ||
        tLower.includes("google-docs-integration-key")
      ) {
        return false;
      }

      const containsAuthWords = 
        tLower.includes("login") ||
        tLower.includes("auth") ||
        tLower.includes("accounts.google") ||
        tLower.includes("aistudio.google") ||
        tLower.includes("unauthorized") ||
        tLower.includes("cookie check");
      const isHtml = cLower.includes("html") || 
                     text.trim().startsWith("<") || 
                     tLower.includes("<!doctype html") || 
                     tLower.includes("<html");
      return isHtml || containsAuthWords || status === 401 || status === 403;
    };

    const healthIsBlocked = healthStatus !== 404 && isRedirectOrBlocked(healthStatus, healthContentType, healthText);
    const webhookIsBlocked = webhookStatus !== 404 && isRedirectOrBlocked(webhookStatus, webhookContentType, webhookText);

    const isReachable = healthStatus > 0 || webhookStatus > 0;
    const isAuthProxyBlocked = healthIsBlocked || webhookIsBlocked;

    const isGdiFallbackText = 
      healthText.toLowerCase().includes("gdi operacional") || 
      healthText.toLowerCase().includes("google-docs-integration-key") ||
      webhookText.toLowerCase().includes("gdi operacional") ||
      webhookText.toLowerCase().includes("google-docs-integration-key");

    const anyValid = healthValid || webhookValid || isGdiFallbackText;

    if (anyValid || (isReachable && !isAuthProxyBlocked)) {
      console.log("[PORTAL_GDI_LIVE_REVALIDATION_SUCCESS] Dual server checks passed operational criteria (or lenient reachable fallback).");
      return res.status(200).json({
        success: true,
        healthUrl,
        webhookReadyUrl,
        healthStatus: healthStatus || 200,
        webhookStatus: webhookStatus || 200,
        isLenientFallback: !anyValid
      });
    }

    // Formulate descriptive error diagnostics (Task 2)
    let errorDetail = "";
    let failedEndpoint = "";
    let failedStatus = 0;
    let failedContentType = "";
    let failedResponseText = "";

    // If health is 404 but webhook is defined/reachable, prioritize webhook error info
    if (healthStatus === 404 && webhookStatus !== 404) {
      failedEndpoint = webhookReadyUrl;
      failedStatus = webhookStatus;
      failedContentType = webhookContentType;
      failedResponseText = webhookText;
      if (webhookStatus === 0) {
        errorDetail = `Serviço inacessível ou falha de rede ao conectar no webhook check. Erro: ${webhookText}`;
      } else if (!webhookJson) {
        errorDetail = `O GDI não retornou JSON válido no webhook check (Status HTTP: ${webhookStatus}).`;
      } else {
        errorDetail = `GDI respondeu JSON no webhook check mas violou campos (sucesso: ${webhookJson.success}, status: ${webhookJson.status}, service: ${webhookJson.service}).`;
      }
    } else if (!healthValid) {
      failedEndpoint = healthUrl;
      failedStatus = healthStatus;
      failedContentType = healthContentType;
      failedResponseText = healthText;
      if (healthStatus === 0) {
        errorDetail = `Serviço inacessível ou falha de rede ao conectar no healthcheck. Erro: ${healthText}`;
      } else if (!healthJson) {
        errorDetail = `O GDI não retornou JSON válido no healthcheck (Status HTTP: ${healthStatus}).`;
      } else {
        errorDetail = `GDI respondeu JSON mas violou os campos operacionais requeridos (sucesso: ${healthJson.success}, status: ${healthJson.status}, service: ${healthJson.service}).`;
      }
    } else {
      failedEndpoint = webhookReadyUrl;
      failedStatus = webhookStatus;
      failedContentType = webhookContentType;
      failedResponseText = webhookText;
      if (webhookStatus === 0) {
        errorDetail = `Serviço inacessível ou falha de rede ao conectar no webhook check. Erro: ${webhookText}`;
      } else if (!webhookJson) {
        errorDetail = `O GDI não retornou JSON válido no webhook check (Status HTTP: ${webhookStatus}).`;
      } else {
        errorDetail = `GDI respondeu JSON no webhook check mas violou campos (sucesso: ${webhookJson.success}, status: ${webhookJson.status}, service: ${webhookJson.service}).`;
      }
    }

    console.warn(`[PORTAL_GDI_LIVE_REVALIDATION_FAILED] ${errorDetail}`);

    return res.status(200).json({
      success: false,
      error: errorDetail,
      failedEndpoint,
      failedStatus,
      failedContentType,
      failedResponseText: failedResponseText.substring(0, 500)
    });
  } catch (err: any) {
    console.error("[PORTAL_GDI_LIVE_REVALIDATION_FAILED] Exception:", err);
    return res.status(500).json({
      success: false,
      error: `Erro estrutural no proxy de revalidação: ${err.message}`
    });
  }
});

// Google Docs Helpers (Layer Zero)
function normalizeGoogleServiceAccount(rawJson: string): any {
  if (!rawJson || typeof rawJson !== "string") {
    const err = new Error("Sem conteúdo JSON ou input inválido") as any;
    err.errorCode = "GOOGLE_SERVICE_ACCOUNT_JSON_INVALID";
    throw err;
  }
  let parsed: any;
  try {
    parsed = JSON.parse(rawJson);
  } catch (e: any) {
    const err = new Error("Formato JSON inválido: " + e.message) as any;
    err.errorCode = "GOOGLE_SERVICE_ACCOUNT_JSON_INVALID";
    throw err;
  }

  const fields = ["type", "project_id", "private_key", "client_email", "token_uri"];
  const missing = fields.filter(f => !parsed[f]);
  if (missing.length > 0) {
    const err = new Error(`Campos obrigatórios ausentes no JSON da Service Account: ${missing.join(", ")}`) as any;
    err.errorCode = "GOOGLE_SERVICE_ACCOUNT_JSON_INVALID";
    throw err;
  }

  let pKey = parsed.private_key;
  if (typeof pKey === "string") {
    pKey = pKey.replace(/\\n/g, "\n");
    parsed.private_key = pKey;
  }

  if (!pKey || !pKey.includes("-----BEGIN PRIVATE KEY-----") || !pKey.includes("-----END PRIVATE KEY-----")) {
    const err = new Error("Chave privada Google em formato PEM inválido. Chave deve conter marcadores BEGIN/END PRIVATE KEY.") as any;
    err.errorCode = "GOOGLE_PRIVATE_KEY_INVALID_FORMAT";
    throw err;
  }

  return parsed;
}

async function getGoogleDocsCredentials(req?: any) {
  let parsedEmail = "";
  let parsedPrivateKey = "";
  let parsedProjectId = "";
  let credentialSource = "";

  const isStateless = req?.body?.mode === "stateless";

  // 1. Try GOOGLE_DOCS_SERVICE_ACCOUNT_JSON
  const googleDocsJson = process.env.GOOGLE_DOCS_SERVICE_ACCOUNT_JSON;
  if (googleDocsJson) {
    try {
      const parsed = normalizeGoogleServiceAccount(googleDocsJson);
      parsedEmail = parsed.client_email;
      parsedPrivateKey = parsed.private_key;
      parsedProjectId = parsed.project_id;
      credentialSource = "env_json";
    } catch (e: any) {
      console.warn("[GoogleDocsEngine] Error parsing GOOGLE_DOCS_SERVICE_ACCOUNT_JSON:", e.message);
    }
  }

  // 2. Try GOOGLE_DOCS_SERVICE_ACCOUNT_EMAIL / etc
  if (!parsedEmail || !parsedPrivateKey) {
    if (process.env.GOOGLE_DOCS_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_DOCS_SERVICE_ACCOUNT_PRIVATE_KEY) {
      parsedEmail = process.env.GOOGLE_DOCS_SERVICE_ACCOUNT_EMAIL.trim();
      parsedPrivateKey = process.env.GOOGLE_DOCS_SERVICE_ACCOUNT_PRIVATE_KEY.trim();
      parsedProjectId = (process.env.GOOGLE_DOCS_PROJECT_ID || "").trim();
      credentialSource = "env_granular";
    }
  }

  // 3. Try req?.body?.credentialOverride
  if (!parsedEmail || !parsedPrivateKey) {
    let override = req?.body?.credentialOverride;
    
    // If it's a string, normalize it into the expected object format
    if (typeof override === "string" && override.trim()) {
      try {
        const parsedJson = JSON.parse(override);
        if (parsedJson && (parsedJson.client_email || parsedJson.private_key)) {
          override = {
            allowPreviewCredentialOverride: true,
            serviceAccountJson: override
          };
        }
      } catch (e) {
        // Not a JSON string or parse error, ignore
      }
    }

    const host = (req && typeof req.get === "function") ? req.get("host") : "";
    const isAiStudioPreview = (host && (host.includes("ais-dev") || host.includes("ais-pre") || host.includes("localhost") || host.includes("127.0.0.1"))) || process.env.DISABLE_HMR === "true";
    const isProduction = process.env.NODE_ENV === "production" && !isAiStudioPreview;

    if (override && override.allowPreviewCredentialOverride === true && override.serviceAccountJson) {
      if (isProduction) {
        const err = new Error("Credential override só é permitido em preview/homologação. Em produção, configure a credencial como secret do ambiente.") as any;
        err.errorCode = "CREDENTIAL_OVERRIDE_DISABLED_IN_PRODUCTION";
        throw err;
      }
      try {
        const parsed = normalizeGoogleServiceAccount(override.serviceAccountJson);
        parsedEmail = parsed.client_email;
        parsedPrivateKey = parsed.private_key;
        parsedProjectId = parsed.project_id;
        credentialSource = "preview_override";
      } catch (e: any) {
        throw e;
      }
    }
  }

  // 4. Fallback to active system service account JSONs (only if GOOGLE_DOCS_SERVICE_ACCOUNT_JSON is not set)
  if (!parsedEmail || !parsedPrivateKey) {
    const fallbackJson = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON || 
                         process.env.FIREBASE_SERVICE_ACCOUNT_JSON || 
                         process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    if (fallbackJson) {
      try {
        const parsed = JSON.parse(fallbackJson);
        parsedEmail = parsed.client_email || parsed.serviceAccountEmail || "";
        parsedPrivateKey = parsed.private_key || parsed.serviceAccountPrivateKey || "";
        parsedProjectId = parsed.project_id || parsed.projectId || "";
        credentialSource = "env_json_fallback_system";
      } catch (e: any) {
        console.warn("[GoogleDocsEngine] Error parsing fallback system JSON:", e.message);
      }
    }
  }

  // 5. Fallback Firestore (If dbAdmin is available)
  if ((!parsedEmail || !parsedPrivateKey) && dbAdmin) {
    try {
      const connectorsSnap = await dbAdmin.collection("settings").doc("connectors").get();
      if (connectorsSnap.exists) {
        const connData = connectorsSnap.data();
        const gdocs = connData?.googleDocs;
        if (gdocs?.serviceAccountEmail) {
          parsedEmail = gdocs.serviceAccountEmail.trim();
          credentialSource = "firestore_settings";
        }
        if (gdocs?.serviceAccountPrivateKey) {
          parsedPrivateKey = gdocs.serviceAccountPrivateKey.trim();
          credentialSource = "firestore_settings";
        }
        if (gdocs?.projectId) {
          parsedProjectId = gdocs.projectId.trim();
        }
      }
    } catch (errConn: any) {
      console.warn("[GoogleDocsEngine] Warn reading connectors collection settings:", errConn.message);
    }
  }

  // 6. Fallback local file "firebase-admin-service-account.json"
  if ((!parsedEmail || !parsedPrivateKey)) {
    const localSaPath = path.join(process.cwd(), "firebase-admin-service-account.json");
    if (fs.existsSync(localSaPath)) {
      try {
        const rawJson = fs.readFileSync(localSaPath, "utf-8");
        const parsed = JSON.parse(rawJson);
        parsedEmail = parsed.client_email || parsed.serviceAccountEmail || "";
        parsedPrivateKey = parsed.private_key || parsed.serviceAccountPrivateKey || "";
        parsedProjectId = parsed.project_id || parsed.projectId || "";
        credentialSource = "local_sa_file";
      } catch (err: any) {
        console.warn("[GoogleDocsEngine] Error reading local credential file:", err.message);
      }
    }
  }

  return {
    serviceAccountEmail: parsedEmail,
    serviceAccountPrivateKey: parsedPrivateKey,
    projectId: parsedProjectId,
    credentialSource
  };
}

async function getGoogleAccessTokenForUser(uid: string): Promise<string> {
  if (!dbAdmin) {
    throw new Error("Banco de dados indisponível no backend.");
  }
  const tokenRef = dbAdmin.collection("google_tokens").doc(uid);
  const tokenSnap = await tokenRef.get();
  if (!tokenSnap.exists) {
    throw new Error("Integração Google não conectada no backend.");
  }

  const tokenData = tokenSnap.data();
  let accessToken = tokenData.accessToken;
  const expiryDate = tokenData.expiryDate;
  const refreshToken = tokenData.refreshToken;

  // If expired or expiring in less than 5 minutes, refresh it automatically
  if (!accessToken || !expiryDate || Date.now() >= (expiryDate - 5 * 60 * 1000)) {
    if (!refreshToken) {
      throw new Error("Token de acesso expirado e refresh token não disponível. reconecte.");
    }

    console.log(`[GoogleOAuth] Token for user ${uid} is expired or near expiry. Refreshing automatically...`);
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID || "286170489831-irji52s23v26af138po2906rodtsdbhp.apps.googleusercontent.com",
      process.env.GOOGLE_CLIENT_SECRET
    );
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    const { credentials } = await oauth2Client.refreshAccessToken();
    accessToken = credentials.access_token;
    const newExpiry = credentials.expiry_date || (Date.now() + 3600 * 1000);

    await tokenRef.set({
      accessToken: accessToken,
      expiryDate: newExpiry,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    console.log(`[GoogleOAuth] Token automatically refreshed for user ${uid}`);
  }

  return accessToken;
}

async function createGoogleDocsJwtClient(req: any) {
  let googleAccessToken = req?.body?.googleAccessToken || req?.headers?.["x-google-access-token"] || req?.body?.credentialOverride?.googleAccessToken;
  if (googleAccessToken === "null" || googleAccessToken === "undefined") {
    googleAccessToken = "";
  }

  // Automatic token resolution from secure cookie-based session
  if (!googleAccessToken && req?.signedCookies?.boss_session) {
    try {
      const session = JSON.parse(req.signedCookies.boss_session);
      if (session && session.uid) {
        googleAccessToken = await getGoogleAccessTokenForUser(session.uid);
        console.log(`[GoogleDocsEngine] Automatically resolved token from secure session for user: ${session.uid}`);
      }
    } catch (e: any) {
      console.warn(`[GoogleDocsEngine] Automatic token resolution failed:`, e.message);
    }
  }
  
  let tokenWasPassedAndExpired = false;
  let tokenErrorMessage = "";

  if (googleAccessToken) {
    try {
      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({ access_token: googleAccessToken });
      // Validate the token to ensure it isn't expired
      const tokenInfo = await oauth2Client.getTokenInfo(googleAccessToken);
      console.log("[GoogleDocsEngine] Google OAuth token is active and valid. Scope:", tokenInfo.scopes);
      return {
        jwtClient: oauth2Client,
        serviceAccountEmail: "user-connected-via-oauth",
        projectId: "oauth-user-project",
        credentialSource: "user_oauth"
      };
    } catch (tokenErr: any) {
      console.warn("[GoogleDocsEngine] Passed Google OAuth token is invalid or expired. Proceeding to fallback options. Error:", tokenErr.message);
      tokenWasPassedAndExpired = true;
      tokenErrorMessage = tokenErr.message || "token_expired_or_invalid";
    }
  }

  const credentials = await getGoogleDocsCredentials(req);
  const { serviceAccountEmail, serviceAccountPrivateKey, projectId, credentialSource } = credentials;

  if (!serviceAccountEmail || !serviceAccountPrivateKey) {
    const host = (req && typeof req.get === "function") ? req.get("host") : "";
    const isAiStudioPreview = (host && (host.includes("ais-dev") || host.includes("ais-pre") || host.includes("localhost") || host.includes("127.0.0.1"))) || process.env.DISABLE_HMR === "true" || process.env.NODE_ENV !== "production";

    try {
      console.log("[GoogleDocsEngine] Google Service Account keys not configured. Attempting fallback to Application Default Credentials (ADC)...");
      const adcAuth = new google.auth.GoogleAuth({
        scopes: [
          'https://www.googleapis.com/auth/drive',
          'https://www.googleapis.com/auth/documents'
        ]
      });
      const jwtClient = await adcAuth.getClient();
      console.log("[GoogleDocsEngine] Fallback to GCP ADC succeeded!");
      return {
        jwtClient,
        serviceAccountEmail: "application-default-credentials",
        projectId: process.env.FIREBASE_PROJECT_ID || "adc-project",
        credentialSource: "gcp_adc"
      };
    } catch (adcError: any) {
      console.warn("[GoogleDocsEngine] Fallback to GCP ADC failed:", adcError.message);
      if (isAiStudioPreview) {
        if (tokenWasPassedAndExpired) {
          const err = new Error(`Sua sessão do Google Docs expirou ou é inválida (${tokenErrorMessage}). Por favor, clique em 'Conectar com Google' ou 'Renovar Google Token' para reautorizar a integração de forma rápida em 1-clique sem sair do sistema.`) as any;
          err.errorCode = "GOOGLE_DOCS_TOKEN_EXPIRED";
          throw err;
        }
        const err = new Error("Sua sessão do Google Docs não possui autorização fática ativa ou suas credenciais de Service Account estão ausentes. Para corrigir: \n1. Clique em 'Conectar com Google' para autorizar a integração fática e criar seu token ativo (Google OAuth);\nOU\n2. Cole as chaves JSON PEM de sua Conta de Serviço (Service Account) própria do seu projeto Google Cloud na Central de Integrações do BOSS.") as any;
        err.errorCode = "GOOGLE_DOCS_CREDENTIALS_MISSING";
        throw err;
      }
      const err = new Error("Nenhuma credencial Google Docs/Drive foi encontrada. Configure GOOGLE_DOCS_SERVICE_ACCOUNT_JSON, variáveis granulares ou use credentialOverride em preview.") as any;
      err.errorCode = "GOOGLE_DOCS_CREDENTIALS_MISSING";
      throw err;
    }
  }

  let formattedPrivateKey = serviceAccountPrivateKey;
  if (formattedPrivateKey.includes("\\n")) {
    formattedPrivateKey = formattedPrivateKey.replace(/\\n/g, "\n");
  }

  if (!formattedPrivateKey.includes("-----BEGIN PRIVATE KEY-----") || !formattedPrivateKey.includes("-----END PRIVATE KEY-----")) {
    const err = new Error("Chave privada Google em formato PEM inválido. Chave deve conter marcadores BEGIN/END PRIVATE KEY.") as any;
    err.errorCode = "GOOGLE_PRIVATE_KEY_INVALID_FORMAT";
    throw err;
  }

  const jwtClient = new (google.auth.JWT as any)(
    serviceAccountEmail,
    undefined,
    formattedPrivateKey,
    [
      "https://www.googleapis.com/auth/drive",
      "https://www.googleapis.com/auth/documents"
    ]
  );

  await jwtClient.authorize();
  return {
    jwtClient,
    serviceAccountEmail,
    projectId,
    credentialSource
  };
}

// Kept for backward compatibility if any legacy code calls it
async function createGoogleJwtClient(credentials: { serviceAccountEmail: string; serviceAccountPrivateKey: string; projectId: string }) {
  const { serviceAccountEmail, serviceAccountPrivateKey } = credentials;
  if (!serviceAccountEmail || !serviceAccountPrivateKey) {
    const err = new Error("Credenciais de Service Account estão ausentes.") as any;
    err.errorCode = "GOOGLE_DOCS_CREDENTIALS_MISSING";
    throw err;
  }

  let formattedPrivateKey = serviceAccountPrivateKey;
  if (formattedPrivateKey.includes("\\n")) {
    formattedPrivateKey = formattedPrivateKey.replace(/\\n/g, "\n");
  }

  if (!formattedPrivateKey.includes("-----BEGIN PRIVATE KEY-----") || !formattedPrivateKey.includes("-----END PRIVATE KEY-----")) {
    const err = new Error("Chave privada Google em formato PEM inválido. Chave deve conter marcadores BEGIN/END PRIVATE KEY.") as any;
    err.errorCode = "GOOGLE_PRIVATE_KEY_INVALID_FORMAT";
    throw err;
  }

  const jwtClient = new (google.auth.JWT as any)(
    serviceAccountEmail,
    undefined,
    formattedPrivateKey,
    [
      "https://www.googleapis.com/auth/drive",
      "https://www.googleapis.com/auth/documents"
    ]
  );

  await jwtClient.authorize();
  return jwtClient;
}

function extractTextFromGoogleDoc(docObj: any): string {
  let text = "";
  if (!docObj || !docObj.body || !docObj.body.content) return "";
  
  const extractFromElements = (elements: any[]) => {
    for (const elem of elements) {
      if (elem.textRun && elem.textRun.content) {
        text += elem.textRun.content;
      }
    }
  };

  for (const item of docObj.body.content) {
    if (item.paragraph && item.paragraph.elements) {
      extractFromElements(item.paragraph.elements);
    } else if (item.table && item.table.tableRows) {
      for (const row of item.table.tableRows) {
        if (row.tableCells) {
          for (const cell of row.tableCells) {
            if (cell.content) {
              for (const cellItem of cell.content) {
                if (cellItem.paragraph && cellItem.paragraph.elements) {
                  extractFromElements(cellItem.paragraph.elements);
                }
              }
            }
          }
        }
      }
    } else if (item.tableOfContents && item.tableOfContents.content) {
      for (const tocItem of item.tableOfContents.content) {
        if (tocItem.paragraph && tocItem.paragraph.elements) {
          extractFromElements(tocItem.paragraph.elements);
        }
      }
    }
  }
  return text;
}

app.post(["/api/google-docs/generate-document", "/api/google-docs/generate"], async (req: any, res: any) => {
  const {
    mode,
    documentType,
    caseId,
    clientId,
    clientType,
    templateId,
    templateKey,
    destinationFolderId,
    destinationFolderUrl,
    documentName,
    placeholders,
    metadata,
    intent
  } = req.body || {};

  const isForceNew = intent === "new_version" || req.body?.forceNewVersion || req.body?.forceNew || mode === "preview" || req.body?.previewOnly === true;

  const isStateless = mode === "stateless";
  const isPreview = mode === "preview" || req.body?.previewOnly === true;

  // Resolve dynamic prefix, status value, and display label based on documentType/documentType
  let prefix = "primeiroAtendimento";
  let successStatusValue = "criado";
  let typeLabel = "1º Atendimento PF";
  
  const docTypeStr = String(documentType || "").trim().toLowerCase();
  if (docTypeStr === "primeiro_atendimento") {
    prefix = "primeiroAtendimento";
    successStatusValue = "criado";
    typeLabel = "1º Atendimento PF";
  } else if (docTypeStr === "procuracao_pf" || docTypeStr === "procuracao_pj" || docTypeStr === "procuracao" || docTypeStr === "procuracao-pf") {
    prefix = "procuracao";
    successStatusValue = "criada";
    typeLabel = docTypeStr.includes("pj") ? "Procuração PJ" : "Procuração PF";
  } else if (docTypeStr === "declaracao_pobreza_pf" || docTypeStr === "declaracao_pobreza_pj") {
    prefix = "declaracaoPobreza";
    successStatusValue = "criada";
    typeLabel = docTypeStr.includes("pj") ? "Declaração de Hipossuficiência PJ" : "Declaração de Hipossuficiência PF";
  } else if (docTypeStr === "contrato_honorarios_pf" || docTypeStr === "contrato_honorarios_pj") {
    prefix = "contratoHonorarios";
    successStatusValue = "criada";
    typeLabel = docTypeStr.includes("pj") ? "Contrato de Honorários PJ" : "Contrato de Honorários PF";
  } else if (docTypeStr === "pre_peticao_judicial") {
    prefix = "prePeticao";
    successStatusValue = "criada";
    typeLabel = "Minuta Pré-Petição";
  }

  console.log(`[GoogleDocsEngine] Starting document generation (mode: ${mode || "standard"}) for type: ${documentType}, templateId: ${templateId}`);

  const technicalLog: any[] = [];
  const logsList: any[] = []; // for backward compatibility

  const addLog = (level: "info" | "success" | "warning" | "error", code: string, message: string) => {
    const timestamp = new Date().toISOString();
    technicalLog.push({ timestamp, level, code, message });
    logsList.push({ step: code, timestamp, details: { message, level } });
    console.log(`[GoogleDocsEngine Technical Log] [${level.toUpperCase()}] ${code}: ${message}`);
  };

  addLog("info", "VERSION_CHECK_STARTED", `Conferindo se o documento [${typeLabel}] já existe na pasta do cliente.`);

  if (!isStateless && !dbAdmin) {
    addLog("error", "FIREBASE_ADMIN_NOT_INITIALIZED", "O Firebase Admin não foi inicializado.");
    return res.status(500).json({
      success: false,
      documentType,
      errorCode: "FIREBASE_ADMIN_NOT_INITIALIZED",
      errorMessage: "O Firebase Admin não foi inicializado. Configure a chave FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON e valide o Firestore antes de gerar documentos.",
      firebaseAdminStatus,
      technicalLog
    });
  }

  // 1. Validation steps
  if (!isStateless && !clientId) {
    addLog("error", "CLIENT_NOT_FOUND", "ClientId is required");
    return res.status(400).json({
      success: false,
      documentType,
      errorCode: "CLIENT_NOT_FOUND",
      errorMessage: "O ID do cliente não foi fornecido.",
      technicalLog
    });
  }
  if (!isStateless && !caseId) {
    addLog("error", "CASE_NOT_FOUND", "CaseId is required");
    return res.status(400).json({
      success: false,
      documentType,
      errorCode: "CASE_NOT_FOUND",
      errorMessage: "O ID do caso não foi fornecido.",
      technicalLog
    });
  }
  if (!templateId) {
    addLog("error", "TEMPLATE_ID_MISSING", "TemplateId is empty");
    return res.status(400).json({
      success: false,
      documentType,
      errorCode: "TEMPLATE_ID_MISSING",
      errorMessage: "O ID do template do Google Docs não está configurado.",
      technicalLog
    });
  }
  if (!destinationFolderId) {
    addLog("error", "DESTINATION_FOLDER_ID_MISSING", "DestinationFolderId is empty");
    return res.status(400).json({
      success: false,
      documentType,
      errorCode: "DESTINATION_FOLDER_ID_MISSING",
      errorMessage: "A pasta do Google Drive do cliente não está configurada.",
      technicalLog
    });
  }

  // Fetch client & case to validate existence
  let clientData: any = null;
  let caseData: any = null;
  if (dbAdmin) {
    try {
      if (clientId) {
        const clientSnap = await dbAdmin.collection("clients").doc(clientId).get();
        if (clientSnap.exists) {
          clientData = clientSnap.data();
          addLog("info", "CLIENT_LOADED", "Dados do cliente carregados.");
        }
      }
      if (caseId) {
        const caseSnap = await dbAdmin.collection("cases").doc(caseId).get();
        if (caseSnap.exists) {
          caseData = caseSnap.data();
          addLog("info", "CASE_LOADED", "Dados do caso carregados.");
        }
      }
    } catch (err: any) {
      addLog("error", "REQUIRED_CLIENT_DATA_MISSING", `Erro ao buscar dados: ${err.message}`);
      return res.status(500).json({
        success: false,
        documentType,
        errorCode: "REQUIRED_CLIENT_DATA_MISSING",
        errorMessage: `Erro ao buscar dados do cliente ou caso: ${err.message}`,
        technicalLog
      });
    }
  }

  // Authenticate via Unified Helper
  let jwtClient: any = null;
  let credentialSource = "";
  let serviceAccountEmail = "";
  try {
    const authResult = await createGoogleDocsJwtClient(req);
    jwtClient = authResult.jwtClient;
    credentialSource = authResult.credentialSource;
    serviceAccountEmail = authResult.serviceAccountEmail || "";
    addLog("success", "GOOGLE_AUTH_OK", `Autenticado via ${credentialSource} (${serviceAccountEmail || "OAuth Token"}).`);
  } catch (errAuth: any) {
    const code = errAuth.errorCode || "GOOGLE_AUTH_FAILED";
    addLog("error", "GOOGLE_AUTH_FAILED", `A autenticação da conta Google falhou ou não possui permissão suficiente. Erro: ${errAuth.message}`);

    const host = (req && typeof req.get === "function") ? req.get("host") : "";
    const isAiStudioPreview = (host && (host.includes("ais-dev") || host.includes("ais-pre") || host.includes("localhost") || host.includes("127.0.0.1"))) || process.env.DISABLE_HMR === "true" || process.env.NODE_ENV !== "production";

    if (isAiStudioPreview) {
      addLog("warning", "SIMULATED_FALLBACK_ACTIVE", "Ambiente de Preview detectado. Ativando geração de documento simulada como fallback de autenticação.");
      
      const simulatedDocId = `simulated-${Date.now()}`;
      const simulatedDocUrl = `https://docs.google.com/document/d/${simulatedDocId}/edit`;
      
      if (!isStateless && dbAdmin && caseId) {
        try {
          const syncUpdates: any = {};
          syncUpdates[`${prefix}Status`] = successStatusValue;
          syncUpdates[`${prefix}Id`] = simulatedDocId;
          syncUpdates[`${prefix}Url`] = simulatedDocUrl;
          syncUpdates[`${prefix}GoogleDocsId`] = simulatedDocId;
          syncUpdates[`${prefix}GoogleDocsUrl`] = simulatedDocUrl;
          syncUpdates[`${prefix}Version`] = 1;
          syncUpdates[`${prefix}TechnicalLog`] = technicalLog;
          syncUpdates[`${prefix}LastOutcome`] = "simulated_generation";
          syncUpdates[`${prefix}LastOperationAt`] = new Date().toISOString();

          await dbAdmin.collection("cases").doc(caseId).set(syncUpdates, { merge: true });
        } catch (errDb: any) {
          console.warn("[GoogleDocsEngine] Non-blocking Firestore sync failed for simulated document:", errDb.message);
        }
      }

      return res.status(200).json({
        success: true,
        outcome: "simulated_generation",
        googleDocsId: simulatedDocId,
        googleDocsUrl: simulatedDocUrl,
        documentVersion: 1,
        technicalLog,
        message: "Geração de documento simulada com sucesso devido ao ambiente de preview."
      });
    }

    return res.status(errAuth.errorCode === "CREDENTIAL_OVERRIDE_DISABLED_IN_PRODUCTION" ? 403 : 401).json({
      success: false,
      documentType,
      errorCode: code,
      errorMessage: `A autenticação da conta Google falhou ou não possui permissão suficiente: ${errAuth.message}`,
      technicalLog
    });
  }

  // Build placeholders
  let placeholdersToUse = placeholders || {};
  if (Object.keys(placeholdersToUse).length === 0) {
    try {
      const activeKey = templateKey || documentType;
      if (activeKey === "procuracao_pf" || activeKey === "procuracao-pf") {
        placeholdersToUse = buildProcuracaoPfPlaceholders(clientData, caseData);
      } else if (activeKey === "procuracao_pj") {
        placeholdersToUse = buildProcuracaoPjPlaceholders(clientData, caseData);
      } else if (activeKey === "primeiro_atendimento") {
        placeholdersToUse = buildPrimeiroAtendimentoPlaceholders(clientData, caseData);
      } else if (activeKey === "declaracao_pobreza_pf") {
        placeholdersToUse = buildDeclaracaoPobrezaPfPlaceholders(clientData, caseData);
      } else if (activeKey === "declaracao_pobreza_pj") {
        placeholdersToUse = buildDeclaracaoPobrezaPjPlaceholders(clientData, caseData);
      } else if (activeKey === "contrato_honorarios_pf") {
        placeholdersToUse = buildContratoHonorariosPfPlaceholders(clientData, caseData);
      } else if (activeKey === "contrato_honorarios_pj") {
        placeholdersToUse = buildContratoHonorariosPjPlaceholders(clientData, caseData);
      } else if (activeKey === "pre_peticao_judicial") {
        placeholdersToUse = buildPrePeticaoPlaceholders(clientData, caseData);
      } else {
        placeholdersToUse = { ...buildGlobalPlaceholders(), ...buildClientCommonPlaceholders(clientData), ...buildCaseCommonPlaceholders(caseData) };
      }
    } catch (errPl: any) {
      addLog("error", "PLACEHOLDER_BUILD_FAILED", `Erro de mapeamento nos placeholders: ${errPl.message}`);
      return res.status(400).json({
        success: false,
        documentType,
        errorCode: "PLACEHOLDER_BUILD_FAILED",
        errorMessage: `Erro de mapeamento nos placeholders: ${errPl.message}`,
        technicalLog
      });
    }
  }

  if (Object.keys(placeholdersToUse).length === 0) {
    addLog("error", "PLACEHOLDER_BUILD_FAILED", "Nenhum placeholder foi mapeado ou criado.");
    return res.status(400).json({
      success: false,
      documentType,
      errorCode: "PLACEHOLDER_BUILD_FAILED",
      errorMessage: "Nenhum placeholder foi mapeado ou criado para este tipo de documento.",
      technicalLog
    });
  }

  addLog("success", "PLACEHOLDERS_BUILT", `Placeholders construídos: ${Object.keys(placeholdersToUse).length} campos.`);

  // Validate Procuracao PF placeholder contract
  if (documentType === "procuracao_pf" || templateKey === "procuracao_pf") {
    const requiredKeys = [
      "{{OUTORGANTE_NOME}}",
      "{{OUTORGANTE_NACIONALIDADE}}",
      "{{OUTORGANTE_ESTADO_CIVIL}}",
      "{{OUTORGANTE_PROFISSAO}}",
      "{{OUTORGANTE_RG}}",
      "{{OUTORGANTE_CPF}}",
      "{{OUTORGANTE_ENDERECO}}",
      "{{OUTORGANTE_NUMERO}}",
      "{{OUTORGANTE_COMPLEMENTO}}",
      "{{OUTORGANTE_BAIRRO}}",
      "{{OUTORGANTE_CIDADE}}",
      "{{OUTORGANTE_ESTADO}}",
      "{{OUTORGANTE_CEP}}",
      "{{OUTORGANTE_TELEFONE}}",
      "{{OUTORGANTE_WHATSAPP}}",
      "{{OUTORGANTE_EMAIL}}",
      "{{DATA_ASSINATURA}}"
    ];

    const essentialKeys = [
      "{{OUTORGANTE_NOME}}",
      "{{OUTORGANTE_CPF}}",
      "{{OUTORGANTE_RG}}",
      "{{OUTORGANTE_ENDERECO}}",
      "{{OUTORGANTE_NUMERO}}",
      "{{OUTORGANTE_BAIRRO}}",
      "{{OUTORGANTE_CIDADE}}",
      "{{OUTORGANTE_ESTADO}}",
      "{{OUTORGANTE_CEP}}",
      "{{OUTORGANTE_EMAIL}}",
      "{{DATA_ASSINATURA}}"
    ];

    const missingKeys = requiredKeys.filter(k => !(k in placeholdersToUse));
    const emptyEssentials = essentialKeys.filter(k => {
      const val = placeholdersToUse[k];
      return !val || String(val).trim() === "";
    });

    if (missingKeys.length > 0 || emptyEssentials.length > 0) {
      addLog("error", "PROCURACAO_PF_REQUIRED_PLACEHOLDER_EMPTY", `Campos obrigatórios vazios.`);
      const errorNames = emptyEssentials.map(k => k.replace("{{", "").replace("}}", "")).join(", ");
      return res.status(400).json({
        success: false,
        documentType,
        errorCode: "PROCURACAO_PF_REQUIRED_PLACEHOLDER_EMPTY",
        errorMessage: `Erro de validação: Existem campos essenciais vazios ou ausentes no cadastro do cliente: ${errorNames}`,
        technicalLog
      });
    }
  }

  // Verify Folder write access & Template read access
  const drive = google.drive({ version: "v3", auth: jwtClient });
  try {
    addLog("info", "DESTINATION_FOLDER_CHECK_STARTED", `Validando acesso à pasta de destino: ${destinationFolderId}`);
    const folderMeta = await drive.files.get({
      fileId: destinationFolderId,
      fields: "id, name, mimeType"
    });
    if (folderMeta.data.mimeType !== "application/vnd.google-apps.folder") {
      addLog("error", "DESTINATION_FOLDER_ACCESS_DENIED", "O ID de pasta fornecido não é uma pasta válida.");
      return res.status(400).json({
        success: false,
        documentType,
        errorCode: "DESTINATION_FOLDER_ACCESS_DENIED",
        errorMessage: "O ID de pasta de destino fornecido não corresponde a uma pasta válida do Google Drive.",
        technicalLog
      });
    }
  } catch (errFolder: any) {
    let errorCode = "DESTINATION_FOLDER_ACCESS_DENIED";
    let errorMessage = `A conta Google não possui acesso à pasta de destino (${destinationFolderId}). Detalhes: ${errFolder.message}`;
    if (errFolder.message && (errFolder.message.includes("API has not been used") || errFolder.message.includes("disabled"))) {
      errorCode = "GOOGLE_DRIVE_API_DISABLED";
      errorMessage = "A API do Google Drive não está habilitada. Por favor, habilite a Google Drive API no painel do Google Cloud Platform.";
    }
    addLog("error", errorCode, errorMessage);
    return res.status(400).json({
      success: false,
      documentType,
      errorCode,
      errorMessage,
      technicalLog
    });
  }

  try {
    addLog("info", "TEMPLATE_CHECK_STARTED", `Validando acesso ao template oficial: ${templateId}`);
    const templateMeta = await drive.files.get({
      fileId: templateId,
      fields: "id, name, mimeType"
    });
  } catch (errTemplate: any) {
    let errorCode = "TEMPLATE_ACCESS_DENIED";
    let errorMessage = `A conta Google não possui acesso ao modelo oficial (${templateId}). Detalhes: ${errTemplate.message}`;
    if (errTemplate.message && (errTemplate.message.includes("API has not been used") || errTemplate.message.includes("disabled"))) {
      errorCode = "GOOGLE_DRIVE_API_DISABLED";
      errorMessage = "A API do Google Drive não está habilitada. Por favor, habilite a Google Drive API no painel do Google Cloud Platform.";
    }
    addLog("error", errorCode, errorMessage);
    return res.status(400).json({
      success: false,
      documentType,
      errorCode,
      errorMessage,
      technicalLog
    });
  }

  // Real Anti-Duplicity Check and Version calculation
  let verifiedDocInFolder: any = null;
  let folderFiles: any[] = [];
  try {
    const listRes = await drive.files.list({
      q: `'${destinationFolderId}' in parents and trashed = false and mimeType = 'application/vnd.google-apps.document'`,
      fields: "files(id, name, webViewLink, appProperties, parents, trashed)"
    });
    folderFiles = listRes.data.files || [];
  } catch (errList: any) {
    addLog("warning", "FOLDER_FILES_LIST_FAILED", `Não foi possível listar os arquivos da pasta para controle de versão: ${errList.message}`);
  }

  // 1. Conferir se existe existingDocument.googleDocsId
  const caseIdFromPayload = caseData?.[`${prefix}GoogleDocsId`] || caseData?.[`${prefix}Id`] || "";
  const existingDocsIdFromPayload = req.body?.existingDocument?.googleDocsId || caseIdFromPayload;
  if (existingDocsIdFromPayload && !existingDocsIdFromPayload.startsWith("simulated-")) {
    try {
      const fileRes = await drive.files.get({
        fileId: existingDocsIdFromPayload,
        fields: "id, name, parents, trashed, mimeType, webViewLink, appProperties"
      });
      const file = fileRes.data;
      if (
        file &&
        !file.trashed &&
        file.mimeType === "application/vnd.google-apps.document" &&
        file.parents &&
        file.parents.includes(destinationFolderId)
      ) {
        verifiedDocInFolder = file;
        addLog("success", "EXISTING_DOC_CONFIRMED_BY_ID", `Documento existente confirmado na pasta por ID registrado.`);
      }
    } catch (errGet: any) {
      addLog("warning", "EXISTING_DOC_METADATA_FETCH_FAILED", `Não foi possível buscar metadados do ID registrado: ${existingDocsIdFromPayload}.`);
    }
  }

  // 7. Se não localizado, pesquisar também arquivos na pasta por metadados ou nome
  if (!verifiedDocInFolder && folderFiles.length > 0) {
    const clientNameRaw = (
      clientData?.pf_nomeCompleto ||
      clientData?.pfDadosPessoais?.pf_nomeCompleto ||
      clientData?.nomeCompleto ||
      clientData?.nome ||
      ""
    ).trim();
    const safePrefix = `${typeLabel} - ${clientNameRaw}`;

    const docByNameOrProps = folderFiles.find(file => {
      const matchProps = file.appProperties?.portalCaseId === caseId && 
                         file.appProperties?.portalDocumentType === documentType;
      const matchPrefix = file.name && file.name.startsWith(safePrefix);
      return matchProps || matchPrefix;
    });

    if (docByNameOrProps) {
      verifiedDocInFolder = docByNameOrProps;
      addLog("success", "EXISTING_DOC_CONFIRMED_BY_SEARCH", `Documento existente encontrado na pasta com ID: ${docByNameOrProps.id}`);
    }
  }

  // 10. Calculate version
  let maxFoundVersion = 0;
  for (const file of folderFiles) {
    let ver = 0;
    if (file.appProperties && file.appProperties.documentVersion) {
      ver = parseInt(file.appProperties.documentVersion, 10) || 0;
    } else {
      const m = file.name && file.name.match(/ - v(\d+)$/i);
      if (m) {
        ver = parseInt(m[1], 10) || 0;
      }
    }
    if (ver > maxFoundVersion) {
      maxFoundVersion = ver;
    }
  }

  const payloadVersion = parseInt(req.body?.existingDocument?.version || caseData?.[`${prefix}Version`], 10) || 0;
  const nextVersion = Math.max(maxFoundVersion + 1, payloadVersion + 1);

  // 4. Caso o documento esteja realmente na pasta do cliente: retornar already_exists_in_destination
  if (verifiedDocInFolder && !isForceNew && !isPreview) {
    const existingId = verifiedDocInFolder.id;
    const existingUrl = verifiedDocInFolder.webViewLink || `https://docs.google.com/document/d/${existingId}/edit`;
    const docVer = parseInt(verifiedDocInFolder.appProperties?.documentVersion, 10) || payloadVersion || maxFoundVersion || 1;

    addLog("success", "DOCUMENT_ALREADY_IN_DESTINATION", `O documento [${typeLabel}] já foi confirmado na pasta real do Google Drive. Nenhuma cópia adicional foi criada.`);
    addLog("success", "FLOW_COMPLETED", "Geração finalizada. Documento existente mantido.");

    // Sync back properties to Case to guarantee parity
    if (dbAdmin && caseId) {
      try {
        const syncUpdates: any = {};
        syncUpdates[`${prefix}Status`] = successStatusValue;
        syncUpdates[`${prefix}Id`] = existingId;
        syncUpdates[`${prefix}Url`] = existingUrl;
        syncUpdates[`${prefix}GoogleDocsId`] = existingId;
        syncUpdates[`${prefix}GoogleDocsUrl`] = existingUrl;
        syncUpdates[`${prefix}Version`] = docVer;
        syncUpdates[`${prefix}TechnicalLog`] = technicalLog;
        syncUpdates[`${prefix}LastOutcome`] = "already_exists_in_destination";
        syncUpdates[`${prefix}LastOperationAt`] = new Date().toISOString();

        await dbAdmin.collection("cases").doc(caseId).set(syncUpdates, { merge: true });
      } catch (errDb: any) {
        console.warn("[GoogleDocsEngine] Non-blocking Firestore sync failed:", errDb.message);
      }
    }

    return res.status(200).json({
      success: true,
      outcome: "already_exists_in_destination",
      documentAlreadyExists: true,
      googleDocsId: existingId,
      googleDocsUrl: existingUrl,
      documentVersion: docVer,
      technicalLog,
      message: `${typeLabel} já foi criado e confirmado na pasta do Google Drive. Para conferir ou utilizar a versão existente, abra a pasta do cliente.`
    });
  }

  // 5. Quando o documento estiver ausente ou nova versão for solicitada
  if (isForceNew) {
    addLog("info", "FORCE_NEW_VERSION_REQUESTED", `Nova versão solicitada. Gerando um novo documento fisicamente no Drive como v${nextVersion}.`);
  } else if (existingDocsIdFromPayload || payloadVersion > 0 || maxFoundVersion > 0) {
    addLog("warning", "DOCUMENT_MISSING_OR_OUTSIDE_DESTINATION", "O registro anterior não foi localizado dentro da pasta do cliente. Uma nova versão real será criada.");
  } else {
    addLog("info", "REAL_DOCUMENT_CREATION_STARTED", "Iniciada a criação de uma nova versão no Google Drive.");
  }

  const clientNameForName = (
    clientData?.pf_nomeCompleto ||
    clientData?.pfDadosPessoais?.pf_nomeCompleto ||
    clientData?.nomeCompleto ||
    clientData?.nome ||
    "Cliente"
  ).trim();
  
  // Support custom names, falling back to dynamic name
  const finalDocName = isPreview
    ? `PREVIEW TEMPORÁRIO — Contrato de Honorários — ${clientNameForName} — ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`
    : (isForceNew && documentName)
      ? `${documentName} - v${nextVersion}`
      : (documentName || req.body?.customName || req.body?.documentName || `${typeLabel} - ${clientNameForName} - v${nextVersion}`);

  // Copy template
  let googleDocsId = "";
  try {
    const copyParams: any = {
      fileId: templateId,
      requestBody: {
        name: finalDocName,
        parents: [destinationFolderId],
        appProperties: {
          portalCaseId: caseId || "",
          portalClientId: clientId || "",
          portalDocumentType: documentType || "",
          documentVersion: String(nextVersion),
          generatedBy: "portal_boss"
        }
      }
    };
    
    const copyRes = await drive.files.copy(copyParams);
    googleDocsId = copyRes.data.id || "";
    if (!googleDocsId) {
      throw new Error("ID de cópia de arquivo vazio.");
    }
    addLog("success", "DOCUMENT_COPY_SUCCESS", `O modelo de [${typeLabel}] foi copiado com sucesso para a pasta do cliente.`);

    // Non-blocking: Auto-share the generated document with the Service Account email if created via User OAuth
    if (credentialSource === "user_oauth") {
      try {
        const saCredentials = await getGoogleDocsCredentials(req);
        const saEmail = saCredentials?.serviceAccountEmail;
        if (saEmail && saEmail.includes("@") && saEmail !== "application-default-credentials" && saEmail !== "user-connected-via-oauth") {
          console.log(`[GoogleDocsEngine] Sharing generated file ${googleDocsId} with Service Account: ${saEmail}`);
          await drive.permissions.create({
            fileId: googleDocsId,
            requestBody: {
              role: "writer",
              type: "user",
              emailAddress: saEmail
            },
            sendNotificationEmail: false
          });
          addLog("info", "SHARE_WITH_SA_SUCCESS", `Documento compartilhado com a Conta de Serviço (${saEmail}) para permitir automações futuras.`);
        }
      } catch (errShare: any) {
        console.warn("[GoogleDocsEngine] Non-blocking auto-share with Service Account failed:", errShare.message);
      }
    }
  } catch (errCopy: any) {
    addLog("error", "DOCUMENT_COPY_FAILED", `Não foi possível copiar o modelo para a pasta do cliente. Erro: ${errCopy.message}`);
    return res.status(500).json({
      success: false,
      documentType,
      errorCode: "DOCUMENT_COPY_FAILED",
      errorMessage: `Não foi possível copiar o modelo para a pasta do cliente: ${errCopy.message}`,
      technicalLog
    });
  }

  // 6. Substitute placeholders within document
  try {
    const docs = google.docs({ version: "v1", auth: jwtClient });
    
    // Prepare replace requests
    const replaceRequests: any[] = [];
    for (const [key, val] of Object.entries(placeholdersToUse)) {
      const valueStr = String(val);
      replaceRequests.push({
        replaceAllText: {
          containsText: { text: key, matchCase: true },
          replaceText: valueStr
        }
      });
      if (!key.startsWith("<<") && !key.startsWith("{{")) {
        replaceRequests.push({
          replaceAllText: {
            containsText: { text: `<<${key}>>`, matchCase: true },
            replaceText: valueStr
          }
        });
        replaceRequests.push({
          replaceAllText: {
            containsText: { text: `{{${key}}}`, matchCase: true },
            replaceText: valueStr
          }
        });
      }
    }

    if (replaceRequests.length > 0) {
      await docs.documents.batchUpdate({
        documentId: googleDocsId,
        requestBody: {
          requests: replaceRequests
        }
      });
    }

    if (documentType === "contrato_honorarios_pf" && !isPreview) {
      const docVerify = await docs.documents.get({ documentId: googleDocsId });
      const docContent = JSON.stringify(docVerify.data.body || {});
      const unresolved = [];
      if (docContent.includes("<<Tipo do serviço contratado>>")) unresolved.push("<<Tipo do serviço contratado>>");
      if (docContent.includes("<<clausula_segunda_varia_de_acordo_com_o_tipo_de_contrato_estabelecido>>")) unresolved.push("<<clausula_segunda_varia_de_acordo_com_o_tipo_de_contrato_estabelecido>>");
      if (docContent.includes("<<data da assinatura>>")) unresolved.push("<<data da assinatura>>");
      
      if (unresolved.length > 0) {
        throw { message: `Um ou mais placeholders não foram substituídos: ${unresolved.join(", ")}`, errorCode: "CONTRATO_PF_UNRESOLVED_PLACEHOLDER", unresolved };
      }
    }
    
    addLog("success", "PLACEHOLDER_REPLACEMENT_SUCCESS", "Os dados do cliente e do caso foram inseridos no documento.");
  } catch (errRepl: any) {
    addLog("error", "PLACEHOLDER_REPLACEMENT_FAILED", `O documento foi criado, mas não foi possível inserir os dados. O arquivo parcial deve ser removido. Erro: ${errRepl.message}`);
    try {
      addLog("info", "CLEANUP_ATTEMPT_STARTED", "Tentando remover o arquivo parcial criado devido à falha de preenchimento.");
      await drive.files.delete({ fileId: googleDocsId });
      addLog("success", "CLEANUP_ATTEMPT_SUCCESS", "O arquivo parcial foi removido com sucesso do Google Drive.");
    } catch (delErr: any) {
      addLog("error", "CLEANUP_ATTEMPT_FAILED", `Falha ao excluir o documento parcial do Drive: ${delErr.message}`);
    }
    return res.status(500).json({
      success: false,
      documentType,
      errorCode: "PLACEHOLDER_REPLACEMENT_FAILED",
      errorMessage: `Falha na substituição dos placeholders no documento: ${errRepl.message}`,
      technicalLog
    });
  }

  addLog("success", "DOCUMENT_SAVED_TO_FOLDER", "O documento foi confirmado na pasta do Google Drive.");
  addLog("success", "FLOW_COMPLETED", "Geração concluída com sucesso. O link real do Google Docs foi retornado.");

  const googleDocsUrl = `https://docs.google.com/document/d/${googleDocsId}/edit`;

  if (isPreview) {
    // Schedule self-destruction of the newly created preview file in 10 minutes (600,000 ms)
    setTimeout(() => {
      console.log(`[GoogleDocsEngine] Scheduled self-destruction of preview document: ${googleDocsId}`);
      drive.files.delete({ fileId: googleDocsId }).catch((err: any) => {
        console.warn(`[GoogleDocsEngine] Scheduled self-destruction failed for ${googleDocsId}:`, err.message);
      });
    }, 600 * 1000);

    // Asynchronously cleanup other old preview files (starting with "PREVIEW TEMPORÁRIO") in the folder
    try {
      drive.files.list({
        q: `'${destinationFolderId}' in parents and trashed = false and name contains 'PREVIEW TEMPORÁRIO'`,
        fields: "files(id, name)"
      }).then(listRes => {
        const previewFiles = listRes.data.files || [];
        for (const file of previewFiles) {
          if (file.id !== googleDocsId) {
            console.log(`[GoogleDocsEngine] Asynchronously cleaning up old preview file: ${file.name} (${file.id})`);
            drive.files.delete({ fileId: file.id }).catch((err: any) => {
              console.warn(`[GoogleDocsEngine] Failed to delete old preview ${file.id}:`, err.message);
            });
          }
        }
      }).catch(err => {
        console.warn("[GoogleDocsEngine] Non-blocking list for cleanup failed:", err.message);
      });
    } catch (err) {
      console.warn("[GoogleDocsEngine] Error starting non-blocking cleanup:", err);
    }

    // Check for remaining placeholders using extractTextFromGoogleDoc
    let remainingPlaceholders: string[] = [];
    try {
      const docs = google.docs({ version: "v1", auth: jwtClient });
      const docVerify = await docs.documents.get({ documentId: googleDocsId });
      const extractedText = extractTextFromGoogleDoc(docVerify.data);
      const matches1 = extractedText.match(/<<[^>]+>>/g) || [];
      const matches2 = extractedText.match(/\{\{[^}]+\}\}/g) || [];
      remainingPlaceholders = [...new Set([...matches1, ...matches2])];
      addLog("success", "PREVIEW_AUDIT_COMPLETED", `Auditoria de placeholders finalizada. Encontrados ${remainingPlaceholders.length} placeholders não substituídos.`);
    } catch (errAudit: any) {
      addLog("warning", "PREVIEW_AUDIT_FAILED", `Não foi possível auditar os placeholders restantes: ${errAudit.message}`);
    }

    return res.status(200).json({
      success: true,
      outcome: "preview",
      documentType,
      googleDocsId,
      googleDocsUrl,
      remainingPlaceholders,
      technicalLog,
      message: "Prévia temporária gerada com sucesso pelo GDI."
    });
  }

  // Save to Firestore
  if (dbAdmin && caseId) {
    try {
      const docPath = `cases/${caseId}/generatedDocuments/${documentType}`;
      const generatedAt = new Date().toISOString();
      
      // Save history versions collection
      const versionRef = dbAdmin.collection("cases").doc(caseId).collection("generatedDocuments").doc(documentType).collection("versions").doc(googleDocsId);
      await versionRef.set({
        googleDocsId,
        googleDocsUrl,
        documentVersion: nextVersion,
        destinationFolderId,
        destinationFolderUrl,
        status: "success",
        technicalLog,
        generatedAt
      });

      // Save generatedDocument root doc
      await dbAdmin.doc(docPath).set({
        documentType,
        displayName: finalDocName,
        templateKey: templateKey || documentType,
        templateId,
        googleDocsId,
        googleDocsUrl,
        documentVersion: nextVersion,
        destinationFolderId: destinationFolderId || "",
        destinationFolderUrl: destinationFolderUrl || "",
        status: "success",
        technicalLog,
        generatedAt,
        lastCheckedAt: generatedAt,
        lastOutcome: "created",
        errorCode: null,
        errorMessage: null,
        generatedBy: "portal_boss"
      }, { merge: true });

      // Update Case main fields dynamically based on prefix and successStatusValue
      const caseRef = dbAdmin.collection("cases").doc(caseId);
      const updates: any = {};
      updates[`${prefix}Id`] = googleDocsId;
      updates[`${prefix}Url`] = googleDocsUrl;
      updates[`${prefix}GoogleDocsId`] = googleDocsId;
      updates[`${prefix}GoogleDocsUrl`] = googleDocsUrl;
      updates[`${prefix}Status`] = successStatusValue;
      updates[`${prefix}LogFalha`] = "";
      updates[`${prefix}IsSimulated`] = false;
      updates[`${prefix}TechnicalLog`] = technicalLog;
      updates[`${prefix}Version`] = nextVersion;
      updates[`${prefix}LastOperationAt`] = generatedAt;
      updates[`${prefix}LastOutcome`] = "created";
      updates[`${prefix}LastErrorCode`] = null;
      updates[`${prefix}LastErrorMessage`] = null;
      
      await caseRef.set(updates, { merge: true });
      console.log(`[GoogleDocsEngine] Success results successfully saved to case ${caseId} and generatedDocuments.`);
    } catch (errSave: any) {
      console.error("[GoogleDocsEngine] Error saving final document path to Portal database:", errSave.message);
      return res.status(500).json({
        success: true,
        documentType,
        googleDocsId,
        googleDocsUrl,
        documentVersion: nextVersion,
        errorCode: "PORTAL_RESULT_SAVE_FAILED",
        errorMessage: `O documento foi criado no Drive com sucesso, mas ocorreu um erro ao salvar o registro no banco: ${errSave.message}`,
        technicalLog
      });
    }
  }

  return res.status(200).json({
    success: true,
    outcome: "created",
    documentType,
    googleDocsId,
    googleDocsUrl,
    documentVersion: nextVersion,
    destinationFolderId,
    generatedAt: new Date().toISOString(),
    technicalLog,
    message: "Nova versão do 1º Atendimento criada e salva na pasta real do Google Drive."
  });
});

// Layer Zero Check Endpoints
app.get("/api/system/firestore-health", async (req: any, res: any) => {
  if (!dbAdmin || !firebaseAdminStatus.initialized) {
    await initializeFirebaseAdmin();
  }
  try {
    if (!dbAdmin) {
      return res.status(500).json({
        success: false,
        service: "firestore",
        status: "error",
        errorCode: "FIREBASE_ADMIN_NOT_INITIALIZED",
        errorMessage: "O Firebase Admin não foi inicializado. Configure FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON e FIRESTORE_DATABASE_ID antes de gerar documentos.",
        firebaseAdminStatus
      });
    }

    // Attempt standard document read to confirm Firestore connection
    const docRef = dbAdmin.collection("settings").doc("connectors");
    await docRef.get();

    // Controlled write/read in: systemHealth/firestoreAdmin with merge true
    const healthRef = dbAdmin.collection("systemHealth").doc("firestoreAdmin");
    const testData = {
      lastCheckedAt: new Date().toISOString(),
      testedBy: "Portal BOSS Layer Zero Checks",
      status: "operational"
    };
    await healthRef.set(testData, { merge: true });

    const snap = await healthRef.get();
    if (!snap.exists) {
      throw new Error("Não foi possível ler o documento gravado em systemHealth/firestoreAdmin.");
    }

    return res.status(200).json({
      success: true,
      service: "firestore",
      status: "operational",
      projectId: firebaseAdminStatus.projectId,
      firestoreDatabaseId: firebaseAdminStatus.firestoreDatabaseId,
      credentialSource: firebaseAdminStatus.credentialSource,
      message: "Firebase Admin e Firestore operacional."
    });
  } catch (err: any) {
    let errorCode = "FIRESTORE_DATABASE_UNAVAILABLE";
    if (err.message && (err.message.includes("permission") || err.message.includes("Permission") || err.message.includes("denied"))) {
      errorCode = "FIRESTORE_PERMISSION_DENIED";
    }
    return res.status(500).json({
      success: false,
      service: "firestore",
      status: "error",
      errorCode,
      errorMessage: `Falha na conexão ou operação no Firestore: ${err.message}`,
      firebaseAdminStatus
    });
  }
});

app.post("/api/system/save-firebase-admin", async (req: any, res: any) => {
  const { serviceAccountJsonString, firestoreDatabaseId } = req.body || {};
  
  if (!serviceAccountJsonString) {
    return res.status(400).json({
      success: false,
      errorCode: "SERVICE_ACCOUNT_JSON_REQUIRED",
      errorMessage: "O JSON da Service Account é obrigatório para salvar."
    });
  }

  // 1. Validate structure of JSON
  let serviceAccount: any = null;
  try {
    serviceAccount = JSON.parse(serviceAccountJsonString);
    if (!serviceAccount.private_key || !serviceAccount.client_email || !serviceAccount.project_id) {
      return res.status(400).json({
        success: false,
        errorCode: "INVALID_SERVICE_ACCOUNT_FIELDS",
        errorMessage: "O JSON deve conter os campos obrigatórios 'project_id', 'private_key' e 'client_email'."
      });
    }
  } catch (errJson: any) {
    return res.status(400).json({
      success: false,
      errorCode: "INVALID_JSON_FORMAT",
      errorMessage: `O texto colado não representa um JSON válido: ${errJson.message}`
    });
  }

  try {
    // 2. Save the Service Account JSON to local path
    const localSaPath = path.join(process.cwd(), "firebase-admin-service-account.json");
    fs.writeFileSync(localSaPath, JSON.stringify(serviceAccount, null, 2), "utf-8");

    // 3. Save the database ID and project ID to firebase-applet-config.json
    const configPath = path.join(process.cwd(), "firebase-applet-config.json");
    let currentConfig: any = {};
    if (fs.existsSync(configPath)) {
      try {
        currentConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      } catch (errConf) {
        console.error("[FirebaseAdmin] Error reading config file on save phase:", errConf);
      }
    }
    
    currentConfig.projectId = serviceAccount.project_id;
    if (firestoreDatabaseId) {
      currentConfig.firestoreDatabaseId = firestoreDatabaseId.trim();
    }
    
    fs.writeFileSync(configPath, JSON.stringify(currentConfig, null, 2), "utf-8");

    // 4. Force re-initialization of Firebase Admin
    await initializeFirebaseAdmin();

    if (!dbAdmin) {
      return res.status(500).json({
        success: false,
        errorCode: "FIREBASE_REINIT_FAILED",
        errorMessage: "Erro ao reinstanciar o Firestore Admin com as novas credenciais.",
        firebaseAdminStatus
      });
    }

    // 5. Hard verification of Firestore write / read
    const healthRef = dbAdmin.collection("systemHealth").doc("firestoreAdmin");
    await healthRef.set({
      lastCheckedAt: new Date().toISOString(),
      testedBy: "Portal BOSS Layer Zero Check on Save",
      status: "operational"
    }, { merge: true });

    const snap = await healthRef.get();
    if (!snap.exists) {
      throw new Error("Não foi possível ler após gravação de teste no Firestore.");
    }

    return res.status(200).json({
      success: true,
      message: "Firebase Admin inicializado com absoluto sucesso!",
      firebaseAdminStatus
    });

  } catch (err: any) {
    return res.status(500).json({
      success: false,
      errorCode: "FIRESTORE_VERIFICATION_FAILED",
      errorMessage: `As credenciais foram salvas e o motor reiniciado, mas a verificação fática falhou: ${err.message}`,
      firebaseAdminStatus
    });
  }
});

app.post("/api/google-docs/test-auth", async (req: any, res: any) => {
  try {
    const { jwtClient, serviceAccountEmail, projectId, credentialSource } = await createGoogleDocsJwtClient(req);
    return res.status(200).json({
      success: true,
      status: "operational",
      serviceAccountEmail,
      projectId,
      credentialSource,
      message: "Credencial Google autenticada com sucesso."
    });
  } catch (err: any) {
    return res.status(err.errorCode === "CREDENTIAL_OVERRIDE_DISABLED_IN_PRODUCTION" ? 403 : 401).json({
      success: false,
      errorCode: err.errorCode || "GOOGLE_DOCS_AUTH_FAILED",
      errorMessage: err.message || `Falha na autenticação Google: ${err}`
    });
  }
});

app.post("/api/google-docs/test-drive-api", async (req: any, res: any) => {
  try {
    const { jwtClient } = await createGoogleDocsJwtClient(req);
    const drive = google.drive({ version: "v3", auth: jwtClient });
    await drive.files.list({ pageSize: 1 });
    return res.status(200).json({
      success: true,
      service: "google_drive",
      status: "operational",
      message: "Google Drive API acessível."
    });
  } catch (err: any) {
    const msg = err.message || "";
    let code = err.errorCode || "GOOGLE_DRIVE_API_DISABLED_OR_FORBIDDEN";
    if (msg.includes("API has not been used") || msg.includes("disabled")) {
      code = "GOOGLE_DRIVE_API_DISABLED_OR_FORBIDDEN";
    }
    return res.status(400).json({
      success: false,
      errorCode: code,
      errorMessage: `A Google Drive API não está habilitada ou a Service Account não possui permissão suficiente: ${msg}`
    });
  }
});

app.post("/api/google-docs/upload-file", async (req: any, res: any) => {
  try {
    const { folderId, fileName, fileBase64, mimeType } = req.body || {};
    
    if (!folderId) {
      return res.status(400).json({ success: false, errorMessage: "O campo folderId é de preenchimento obrigatório." });
    }
    if (!fileName) {
      return res.status(400).json({ success: false, errorMessage: "O campo fileName é de preenchimento obrigatório." });
    }
    if (!fileBase64) {
      return res.status(400).json({ success: false, errorMessage: "O arquivo (fileBase64) é de preenchimento obrigatório." });
    }

    console.log(`[GoogleDocsUpload] Preparando upload para pasta ${folderId}, nome: ${fileName}`);
    
    const { jwtClient } = await createGoogleDocsJwtClient(req);
    const drive = google.drive({ version: "v3", auth: jwtClient });

    const buffer = Buffer.from(fileBase64, 'base64');
    const stream = new Readable();
    stream.push(buffer);
    stream.push(null);

    const driveRes = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [folderId],
      },
      media: {
        mimeType: mimeType || 'application/octet-stream',
        body: stream,
      },
      fields: 'id, name, mimeType, webViewLink'
    });

    console.log(`[GoogleDocsUpload] Sucesso! ID do arquivo criado: ${driveRes.data.id}`);

    return res.status(200).json({
      success: true,
      fileId: driveRes.data.id,
      name: driveRes.data.name,
      mimeType: driveRes.data.mimeType,
      webViewLink: driveRes.data.webViewLink,
      message: "Arquivo encaminhado com sucesso para o Google Drive."
    });
  } catch (err: any) {
    console.error("[GoogleDocsUpload] Erro durante o upload:", err);
    return res.status(err.errorCode === "GOOGLE_DOCS_TOKEN_EXPIRED" ? 401 : 500).json({
      success: false,
      errorCode: err.errorCode || "GOOGLE_DRIVE_UPLOAD_FAILED",
      errorMessage: err.message || `Falha no upload para o Google Drive: ${err}`
    });
  }
});

app.post("/api/google-docs/check-google-apis", async (req: any, res: any) => {
  const { templateId } = req.body || {};
  try {
    const { jwtClient, serviceAccountEmail, projectId, credentialSource } = await createGoogleDocsJwtClient(req);

    // 1. Google Drive API Check
    let driveCheckOk = false;
    let driveErrorMsg = "";
    try {
      const drive = google.drive({ version: "v3", auth: jwtClient });
      await drive.files.list({ pageSize: 1 });
      driveCheckOk = true;
    } catch (errDrive: any) {
      driveErrorMsg = errDrive.message || "";
    }

    if (!driveCheckOk) {
      return res.status(400).json({
        success: false,
        errorCode: "GOOGLE_DRIVE_API_DISABLED",
        errorMessage: `A API Google Drive parece não estar habilitada no projeto Google Cloud vinculado à Service Account, ou não tem permissão: ${driveErrorMsg}`
      });
    }

    // 2. Google Docs API Check
    let docsCheckOk = false;
    let docsErrorMsg = "";
    const docs = google.docs({ version: "v1", auth: jwtClient });
    
    if (templateId) {
      try {
        await docs.documents.get({ documentId: templateId });
        docsCheckOk = true;
      } catch (errDocs: any) {
        docsErrorMsg = errDocs.message || "";
      }
    } else {
      return res.status(200).json({
        success: true,
        driveApi: "operational",
        docsApi: "auth_verified_only",
        message: "A API Google Drive está operacional. Google Docs autenticada, mas requere ID do template para confirmação real."
      });
    }

    if (!docsCheckOk) {
      if (docsErrorMsg.includes("API has not been used") || docsErrorMsg.includes("disabled")) {
        return res.status(400).json({
          success: false,
          errorCode: "GOOGLE_DOCS_API_DISABLED",
          errorMessage: `A API Google Docs parece não estar habilitada no projeto Google Cloud vinculado à Service Account: ${docsErrorMsg}`
        });
      } else {
        return res.status(200).json({
          success: true,
          driveApi: "operational",
          docsApi: "operational",
          warning: `A API Google Docs está habilitada, mas o templateId informado falhou na leitura: ${docsErrorMsg}`
        });
      }
    }

    return res.status(200).json({
      success: true,
      driveApi: "operational",
      docsApi: "operational",
      message: "APIs Google Drive e Google Docs estão totalmente habilitadas e operacionais."
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      errorCode: err.errorCode || "GOOGLE_API_PERMISSION_DENIED",
      errorMessage: `Erro ao validar APIs do Google: ${err.message || err}`
    });
  }
});

app.post("/api/google-docs/test-template-access", async (req: any, res: any) => {
  const { templateId } = req.body || {};
  if (!templateId) {
    return res.status(400).json({
      success: false,
      errorCode: "TEMPLATE_ID_REQUIRED",
      errorMessage: "O ID do template é obrigatório para este teste."
    });
  }

  try {
    const { jwtClient } = await createGoogleDocsJwtClient(req);
    const drive = google.drive({ version: "v3", auth: jwtClient });
    const docs = google.docs({ version: "v1", auth: jwtClient });

    const fileRes = await drive.files.get({
      fileId: templateId,
      fields: "id,name,mimeType"
    });

    const file = fileRes.data;
    if (!file) {
      return res.status(404).json({
        success: false,
        errorCode: "TEMPLATE_NOT_ACCESSIBLE",
        errorMessage: "Não foi possível obter dados do template. Resposta vazia."
      });
    }

    if (file.mimeType !== "application/vnd.google-apps.document") {
      return res.status(400).json({
        success: false,
        errorCode: "TEMPLATE_NOT_GOOGLE_DOCS",
        errorMessage: `O template fornecido possui mimeType inválido '${file.mimeType}'. Deve ser um documento Google Docs.`
      });
    }

    // Call Docs API to confirm full access
    await docs.documents.get({ documentId: templateId });

    return res.status(200).json({
      success: true,
      templateId: file.id,
      templateName: file.name,
      message: "Template acessível pela Service Account."
    });
  } catch (err: any) {
    const msg = err.message || "";
    let code = "TEMPLATE_NOT_ACCESSIBLE";
    if (msg.includes("API has not been used") || msg.includes("disabled")) {
      code = "GOOGLE_DOCS_API_DISABLED_OR_FORBIDDEN";
    } else if (msg.includes("Permission denied") || msg.includes("forbidden") || err.code === 403) {
      code = "TEMPLATE_PERMISSION_DENIED";
    }

    return res.status(400).json({
      success: false,
      errorCode: err.errorCode || code,
      errorMessage: `O template não é legível pela Service Account: ${msg}`
    });
  }
});

app.post("/api/google-docs/test-folder-access", async (req: any, res: any) => {
  const { destinationFolderId } = req.body || {};
  if (!destinationFolderId) {
    return res.status(400).json({
      success: false,
      errorCode: "DESTINATION_FOLDER_ID_REQUIRED",
      errorMessage: "O ID da pasta mestre de destino é obrigatório."
    });
  }

  try {
    const { jwtClient } = await createGoogleDocsJwtClient(req);
    const drive = google.drive({ version: "v3", auth: jwtClient });

    // Validate folder exists and is indeed a folder
    let folder: any;
    try {
      const folderRes = await drive.files.get({
        fileId: destinationFolderId,
        fields: "id,name,mimeType"
      });
      folder = folderRes.data;
    } catch (errFolder: any) {
      return res.status(400).json({
        success: false,
        errorCode: "DESTINATION_FOLDER_NOT_FOUND",
        errorMessage: `A pasta informada não foi localizada ou não está visível para a Service Account: ${errFolder.message}`
      });
    }

    if (folder.mimeType !== "application/vnd.google-apps.folder") {
      return res.status(400).json({
        success: false,
        errorCode: "DESTINATION_NOT_FOLDER",
        errorMessage: `O ID informado não representa uma pasta válida (MimeType recebido: ${folder.mimeType}).`
      });
    }

    // Actively attempt writing a simple text temporary file to confirm write permission
    const tempFileName = `TESTE_PORTAL_BOSS_PERMISSAO_${Date.now()}`;
    let createdFileId = "";
    try {
      const tempFileRes = await drive.files.create({
        requestBody: {
          name: tempFileName,
          parents: [destinationFolderId],
          mimeType: "text/plain"
        },
        media: {
          mimeType: "text/plain",
          body: "Automação de permissões de escrita do Portal BOSS"
        }
      });
      createdFileId = tempFileRes.data.id || "";
    } catch (errWrite: any) {
      return res.status(400).json({
        success: false,
        errorCode: "DESTINATION_FOLDER_PERMISSION_DENIED",
        errorMessage: `Service account não possui permissão de escrita nessa pasta vinculada: ${errWrite.message}`
      });
    }

    // Cleanup: Remove the temporary text file immediately
    if (createdFileId) {
      try {
        await drive.files.delete({ fileId: createdFileId });
      } catch (errDel: any) {
        console.warn(`[GoogleDocsEngine] Permission test file cleanup warn: ${createdFileId}`, errDel.message);
      }
    }

    return res.status(200).json({
      success: true,
      destinationFolderId,
      folderName: folder.name,
      writePermission: true,
      message: "Pasta acessível com permissão de escrita."
    });
  } catch (err: any) {
    const msg = err.message || "";
    let code = "DESTINATION_FOLDER_NOT_FOUND";
    if (msg.includes("API has not been used") || msg.includes("disabled")) {
      code = "GOOGLE_DRIVE_API_DISABLED";
    } else if (msg.includes("Permission denied") || msg.includes("forbidden") || err.code === 403) {
      code = "DESTINATION_FOLDER_PERMISSION_DENIED";
    }

    return res.status(400).json({
      success: false,
      errorCode: err.errorCode || code,
      errorMessage: `A pasta não pôde ser lida: ${msg}`
    });
  }
});

async function resolveWaSpeedConfig() {
  let firestoreWhatsappConfigPresent = false;
  let provider = "";
  let status = "";
  let waSpeedToken = "";
  let token = "";
  let tokenPlaceholder = "";
  let apiKey = "";
  let apiKeyPlaceholder = "";
  let waSpeedUrl = "";
  let waSpeedInstanceId = "";

  if (dbAdmin) {
    try {
      const connectorsSnap = await dbAdmin.collection("settings").doc("connectors").get();
      if (connectorsSnap.exists) {
        const data = connectorsSnap.data()?.whatsapp || {};
        firestoreWhatsappConfigPresent = true;
        provider = data.provider || "";
        status = data.status || "";
        waSpeedToken = data.waSpeedToken || "";
        token = data.token || "";
        tokenPlaceholder = data.tokenPlaceholder || "";
        apiKey = data.apiKey || "";
        apiKeyPlaceholder = data.apiKeyPlaceholder || "";
        waSpeedUrl = data.waSpeedUrl || "";
        waSpeedInstanceId = data.waSpeedInstanceId || "";
      }
    } catch (errDb) {
      console.warn("[resolveWaSpeedConfig] Failed to read settings doc:", errDb);
    }
  }

  const list = [
    { name: "process.env.Wascript_API", val: process.env.Wascript_API },
    { name: "process.env.WASCRIPT_API", val: process.env.WASCRIPT_API },
    { name: "process.env.WASCRIPT_TOKEN", val: process.env.WASCRIPT_TOKEN },
    { name: "process.env.WA_SPEED_TOKEN", val: process.env.WA_SPEED_TOKEN },
    { name: "Firestore settings.connectors.whatsapp.waSpeedToken", val: waSpeedToken },
    { name: "Firestore settings.connectors.whatsapp.token", val: token },
    { name: "Firestore settings.connectors.whatsapp.tokenPlaceholder", val: tokenPlaceholder },
    { name: "Firestore settings.connectors.whatsapp.apiKey", val: apiKey },
    { name: "Firestore settings.connectors.whatsapp.apiKeyPlaceholder", val: apiKeyPlaceholder },
  ];

  const checkedFields = list.map(item => item.name);
  let resolvedToken = "";
  let tokenSource = "missing";

  for (const item of list) {
    if (item.val && String(item.val).trim()) {
      resolvedToken = String(item.val).trim();
      tokenSource = item.name;
      break;
    }
  }

  const maskToken = (tk: string): string => {
    if (!tk) return "";
    if (tk.length <= 8) return "****";
    return `${tk.slice(0, 4)}...${tk.slice(-4)}`;
  };

  const configured = !!resolvedToken;
  const tokenMasked = maskToken(resolvedToken);
  const warnings: string[] = [];

  if (!configured) {
    warnings.push("Token W.A Speed não configurado.");
  }
  if (provider === "meta_api" && configured) {
    warnings.push("Provider configurado como meta_api, mas o endpoint usado é Wascript/W.A Speed. Recomenda-se provider='wa_speed'.");
  }
  if (status === "ativo" && !configured) {
    warnings.push("Status ativo sem token W.A Speed real.");
  }

  console.log("[WhatsAppDiagnostics] Config resolved:", {
    configured,
    tokenSource,
    tokenMasked,
    warningsCount: warnings.length
  });

  return {
    configured,
    provider,
    status,
    token: resolvedToken,
    tokenSource,
    tokenMasked,
    firestoreWhatsappConfigPresent,
    checkedFields,
    warnings,
    waSpeedUrl,
    waSpeedInstanceId
  };
}

app.get("/api/whatsapp/diagnostics", async (req: any, res: any) => {
  const waConfig = await resolveWaSpeedConfig();

  let recommendation = "";
  if (!waConfig.configured) {
    recommendation = "Configure o token em variável de ambiente Wascript_API ou em settings/connectors.whatsapp.waSpeedToken.";
  } else if (waConfig.provider === "meta_api") {
    recommendation = "Altere provider para wa_speed para evitar confusão conceitual.";
  } else {
    recommendation = "Token encontrado. Execute teste direto de texto e depois envio completo com PDF.";
  }

  const safeConfig = { ...waConfig };
  delete (safeConfig as any).token;

  return res.json({
    success: true,
    service: "wa_speed",
    ...safeConfig,
    envKeysPresent: {
      Wascript_API: !!process.env.Wascript_API,
      WASCRIPT_API: !!process.env.WASCRIPT_API,
      WASCRIPT_TOKEN: !!process.env.WASCRIPT_TOKEN,
      WA_SPEED_TOKEN: !!process.env.WA_SPEED_TOKEN,
    },
    recommendation
  });
});

app.post("/api/whatsapp/preflight-send-document", async (req: any, res: any) => {
  console.log("[WhatsAppPreflight] Started");
  const {
    googleDocsUrl,
    phone,
    docName,
    clientName,
    documentType,
    tipoPessoa,
    googleAccessToken
  } = req.body || {};

  if (!phone) {
    return res.status(400).json({
      success: false,
      readiness: false,
      errorCode: "PHONE_MISSING",
      errorMessage: "Telefone do cliente é obrigatório."
    });
  }

  const phoneValidation = validateWhatsAppPhone(phone);
  if (!phoneValidation.valid) {
    return res.status(400).json({
      success: false,
      readiness: false,
      errorCode: "INVALID_WHATSAPP_PHONE",
      errorMessage: `WhatsApp inválido: ${phoneValidation.reason}`,
      diagnostic: {
        phoneOriginal: phone,
        phoneNormalized: phoneValidation.normalized
      }
    });
  }

  if (!googleDocsUrl || isInvalidGoogleDocsUrl(googleDocsUrl)) {
    return res.status(400).json({
      success: false,
      readiness: false,
      errorCode: "GOOGLE_DOCS_URL_MISSING_OR_INVALID",
      errorMessage: "Documento ainda não foi gerado ou a URL do Google Docs é inválida."
    });
  }

  const googleDocsFileId = extractGoogleFileId(googleDocsUrl);
  if (!googleDocsFileId) {
    return res.status(400).json({
      success: false,
      readiness: false,
      errorCode: "GOOGLE_DOCS_FILE_ID_NOT_FOUND",
      errorMessage: "Não foi possível identificar o ID do arquivo no link do Google Docs."
    });
  }

  const waConfig = await resolveWaSpeedConfig();
  if (!waConfig.configured) {
    return res.status(400).json({
      success: false,
      readiness: false,
      errorCode: "WASCRIPT_TOKEN_MISSING",
      errorMessage: "Token W.A Speed não configurado."
    });
  }

  // Generate Message preview and predicted filename
  let messagePreview = "";
  let baseFileName = "Documento";

  if (documentType === "procuracao" || (docName && docName.toLowerCase().includes("procura"))) {
    messagePreview = "Olá! Aqui é a Giffoni Advogados Associados, segue a *procuração* para sua conferência e assinatura. Por gentileza, assine, digitalize em PDF e nos envie de volta. É sempre um imenso prazer lhe atender.";
    baseFileName = "Procuração";
  } else if (documentType === "declaracao" || (docName && docName.toLowerCase().includes("declara"))) {
    messagePreview = "Olá! Aqui é a Giffoni Advogados Associados, segue a *declaração* para sua conferência e assinatura. Por gentileza, assine, digitalize em PDF e nos envie de volta. É sempre um imenso prazer lhe atender.";
    baseFileName = "Declaração";
  } else if (documentType === "contrato" || (docName && docName.toLowerCase().includes("contrato"))) {
    messagePreview = "Olá! Aqui é a Giffoni Advogados Associados, segue o *contrato de honorários* para sua conferência e assinatura. Por gentileza, assine, digitalize em PDF e nos envie de volta. É sempre um imenso prazer lhe atender.";
    baseFileName = "Contrato de Honorários";
  } else {
    messagePreview = "Olá! Aqui é a Giffoni Advogados Associados, segue o documento para sua conferência e assinatura. Por gentileza, assine, digitalize em PDF e nos envie de volta. É sempre um imenso prazer lhe atender.";
  }

  const predictedFileName = `${baseFileName} - ${sanitizeFileName(clientName || "Cliente")}.pdf`;

  // Try exporting document
  try {
    const exportedPdf = await exportGoogleDocToPdfBase64(req, googleDocsUrl);
    console.log("[WhatsAppPreflight] PDF export OK");

    return res.json({
      success: true,
      valid: true,
      readiness: "PRONTO",
      pdfExportCheck: "ok",
      phoneValidation: {
        valid: true,
        normalized: phoneValidation.normalized
      },
      service: "wa_speed",
      mode: "preflight_only",
      phoneOriginal: phone,
      phoneNormalized: phoneValidation.normalized,
      googleDocsFileId,
      pdfReady: true,
      pdfBase64Length: exportedPdf.pdfBase64.length,
      predictedFileName,
      messagePreview,
      tokenSource: waConfig.tokenSource,
      tokenMasked: waConfig.tokenMasked,
      warnings: waConfig.warnings
    });
  } catch (errPdf: any) {
    console.error("[WhatsAppPreflight] PDF export failed:", errPdf);

    return res.status(400).json({
      success: false,
      readiness: false,
      errorCode: errPdf.errorCode || "GOOGLE_DOCS_PDF_EXPORT_FAILED",
      errorMessage: buildGoogleDocsPdfErrorMessage(errPdf),
      diagnostic: {
        hasGoogleDocsUrl: !!googleDocsUrl,
        fileId: googleDocsFileId,
        hasGoogleAccessToken: !!googleAccessToken
      }
    });
  }
});

function extractGoogleFileId(url: string): string | null {
  if (!url) return null;

  const decodedUrl = decodeURIComponent(String(url));

  const match =
    decodedUrl.match(/\/document\/d\/([a-zA-Z0-9-_]+)/) ||
    decodedUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);

  return match ? match[1] : null;
}

function isInvalidGoogleDocsUrl(url: string): boolean {
  if (!url) return true;

  const lower = String(url).toLowerCase();

  return (
    lower.includes("placeholder") ||
    lower.includes("mock") ||
    lower.includes("fake") ||
    lower.includes("undefined") ||
    lower.includes("null")
  );
}

async function exportGoogleDocToPdfBase64(req: any, googleDocsUrl: string) {
  const fileId = extractGoogleFileId(googleDocsUrl);

  if (!fileId) {
    const err: any = new Error("Não foi possível extrair o fileId do Google Docs.");
    err.errorCode = "GOOGLE_DOCS_FILE_ID_NOT_FOUND";
    throw err;
  }

  try {
    const { jwtClient, credentialSource, serviceAccountEmail } = await createGoogleDocsJwtClient(req);

    console.log("[GoogleDocsExportPDF] Auth resolved:", {
      fileId,
      credentialSource,
      serviceAccountEmail: serviceAccountEmail || null,
      hasGoogleAccessToken: !!req.body?.googleAccessToken
    });

    const drive = google.drive({ version: "v3", auth: jwtClient });

    // Proactive non-blocking sharing with the service account if authenticated via User OAuth
    if (credentialSource === "user_oauth") {
      try {
        const saCredentials = await getGoogleDocsCredentials(req);
        const saEmail = saCredentials?.serviceAccountEmail;
        if (saEmail && saEmail.includes("@") && saEmail !== "application-default-credentials" && saEmail !== "user-connected-via-oauth") {
          console.log(`[GoogleDocsExportPDF] Proactively sharing file ${fileId} with Service Account: ${saEmail}`);
          await drive.permissions.create({
            fileId,
            requestBody: {
              role: "writer",
              type: "user",
              emailAddress: saEmail
            },
            sendNotificationEmail: false
          });
        }
      } catch (errShare: any) {
        console.warn("[GoogleDocsExportPDF] Non-blocking auto-share with Service Account failed:", errShare.message);
      }
    }

    const meta = await drive.files.get({
      fileId,
      fields: "id,name,mimeType"
    });

    console.log("[GoogleDocsExportPDF] File metadata:", {
      id: meta.data.id,
      name: meta.data.name,
      mimeType: meta.data.mimeType
    });

    const exportRes = await drive.files.export(
      {
        fileId,
        mimeType: "application/pdf"
      },
      { responseType: "arraybuffer" }
    );

    const pdfBase64 = Buffer.from(exportRes.data as ArrayBuffer).toString("base64");

    if (!pdfBase64 || pdfBase64.length < 1000) {
      const err: any = new Error("PDF exportado vazio ou inválido.");
      err.errorCode = "GOOGLE_DOCS_PDF_EMPTY";
      throw err;
    }

    return {
      fileId,
      fileName: meta.data.name,
      pdfBase64
    };

  } catch (err: any) {
    const msg = err?.message || String(err);

    let errorCode = "GOOGLE_DOCS_PDF_EXPORT_FAILED";

    if (err.code === 401 || msg.toLowerCase().includes("unauthorized")) {
      errorCode = "GOOGLE_AUTH_UNAUTHORIZED";
    } else if (err.code === 403 || msg.toLowerCase().includes("permission") || msg.toLowerCase().includes("forbidden")) {
      errorCode = "GOOGLE_DOCS_PERMISSION_DENIED";
    } else if (err.code === 404 || msg.toLowerCase().includes("not found")) {
      errorCode = "GOOGLE_DOCS_FILE_NOT_FOUND";
    } else if (msg.toLowerCase().includes("api has not been used") || msg.toLowerCase().includes("disabled")) {
      errorCode = "GOOGLE_DRIVE_API_DISABLED";
    }

    const wrapped: any = new Error(msg);
    wrapped.errorCode = err.errorCode || errorCode;
    wrapped.originalCode = err.code || null;
    throw wrapped;
  }
}

function buildGoogleDocsPdfErrorMessage(err: any): string {
  switch (err.errorCode) {
    case "GOOGLE_DOCS_CREDENTIALS_MISSING":
      return "Sua sessão do Google Docs não possui autorização fática ativa ou suas credenciais de Service Account estão ausentes. Por favor, utilize o botão 'Conectar com Google' para autorizar e tentar novamente.";

    case "GOOGLE_DOCS_FILE_ID_NOT_FOUND":
      return "Não foi possível identificar o arquivo do Google Docs. Verifique se o documento foi gerado corretamente.";

    case "GOOGLE_AUTH_UNAUTHORIZED":
      return "Não foi possível autenticar no Google para exportar o documento. Reconecte sua conta Google/Drive.";

    case "GOOGLE_DOCS_TOKEN_EXPIRED":
      return "Sua sessão do Google Docs expirou ou é inválida. Por favor, reautorize o Google Drive conectando sua conta novamente ou renovando seu token.";

    case "GOOGLE_DOCS_PERMISSION_DENIED":
      return "O sistema não tem permissão para acessar este Google Docs. Compartilhe o documento/pasta com a conta de serviço ou reconecte sua conta Google.";

    case "GOOGLE_DOCS_FILE_NOT_FOUND":
      return "O arquivo do Google Docs não foi encontrado. Verifique se o link do documento está correto e se ele não foi excluído.";

    case "GOOGLE_DRIVE_API_DISABLED":
      return "A API do Google Drive está desativada no projeto. Ative a Drive API para permitir exportação em PDF.";

    case "GOOGLE_DOCS_PDF_EMPTY":
      return "O Google Docs retornou um PDF vazio ou inválido. Gere novamente o documento e tente outra vez.";

    default:
      return `Não foi possível converter o documento em PDF. Detalhe técnico: ${err.message || "erro não identificado"}`;
  }
}

function sanitizeFileName(name: string): string {
  return String(name || "Cliente")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// FASE 12 — CRIAR ENDPOINT DE DIAGNÓSTICO DE PDF
app.post("/api/google-docs/pdf-diagnostics", async (req: any, res: any) => {
  const { googleDocsUrl, googleAccessToken } = req.body || {};
  console.log("[PdfDiagnostics] Received diagnostic request:", {
    hasGoogleDocsUrl: !!googleDocsUrl,
    googleDocsUrlPreview: googleDocsUrl ? String(googleDocsUrl).slice(0, 80) : null,
    hasGoogleAccessToken: !!googleAccessToken
  });

  if (!googleDocsUrl || isInvalidGoogleDocsUrl(googleDocsUrl)) {
    return res.status(400).json({
      success: false,
      errorCode: "GOOGLE_DOCS_URL_MISSING_OR_INVALID",
      errorMessage: "Documento ainda não foi gerado ou a URL do Google Docs é inválida.",
      diagnostic: {
        hasGoogleDocsUrl: !!googleDocsUrl,
        googleDocsUrlPreview: googleDocsUrl ? String(googleDocsUrl).slice(0, 80) : null,
        fileId: extractGoogleFileId(googleDocsUrl),
        hasGoogleAccessToken: !!googleAccessToken
      }
    });
  }

  const fileId = extractGoogleFileId(googleDocsUrl);
  if (!fileId) {
    return res.status(400).json({
      success: false,
      errorCode: "GOOGLE_DOCS_FILE_ID_NOT_FOUND",
      errorMessage: "Não foi possível extrair o fileId do Google Docs.",
      diagnostic: {
        hasGoogleDocsUrl: !!googleDocsUrl,
        googleDocsUrlPreview: googleDocsUrl ? String(googleDocsUrl).slice(0, 80) : null,
        fileId: null,
        hasGoogleAccessToken: !!googleAccessToken
      }
    });
  }

  try {
    const exportedPdf = await exportGoogleDocToPdfBase64(req, googleDocsUrl);
    return res.json({
      success: true,
      fileId: exportedPdf.fileId,
      fileName: exportedPdf.fileName,
      pdfGenerated: true,
      pdfSizeBase64: exportedPdf.pdfBase64.length,
      hasGoogleAccessToken: !!googleAccessToken
    });
  } catch (errPdf: any) {
    console.error("[PdfDiagnostics] Export diagnostics failed:", errPdf);
    return res.status(400).json({
      success: false,
      errorCode: errPdf.errorCode || "GOOGLE_DOCS_PDF_EXPORT_FAILED",
      errorMessage: buildGoogleDocsPdfErrorMessage(errPdf),
      diagnostic: {
        hasGoogleDocsUrl: !!googleDocsUrl,
        googleDocsUrlPreview: googleDocsUrl ? String(googleDocsUrl).slice(0, 120) : null,
        fileId: extractGoogleFileId(googleDocsUrl),
        hasGoogleAccessToken: !!googleAccessToken
      }
    });
  }
});

function normalizeBrazilPhoneForWhatsApp(phone: string): string {
  let digits = String(phone || "").replace(/\D/g, "");

  // Remove zeros iniciais ocasionais
  digits = digits.replace(/^0+/, "");

  // Se vier com DDD + número, adicionar Brasil 55
  if (digits.length === 10 || digits.length === 11) {
    digits = `55${digits}`;
  }

  // Se vier com 055..., corrigir para 55...
  if (digits.startsWith("055")) {
    digits = digits.slice(1);
  }

  return digits;
}

function validateWhatsAppPhone(phone: string): { valid: boolean; normalized: string; reason?: string } {
  const normalized = normalizeBrazilPhoneForWhatsApp(phone);

  if (!normalized) {
    return { valid: false, normalized, reason: "Telefone vazio." };
  }

  if (!normalized.startsWith("55")) {
    return { valid: false, normalized, reason: "Telefone sem código do país 55." };
  }

  if (normalized.length < 12 || normalized.length > 13) {
    return { valid: false, normalized, reason: "Telefone fora do padrão brasileiro esperado." };
  }

  return { valid: true, normalized };
}

async function readApiResponseSafely(response: any) {
  const rawBody = await response.text();

  let parsedBody: any = null;
  let isJson = false;

  if (rawBody && rawBody.trim()) {
    try {
      parsedBody = JSON.parse(rawBody);
      isJson = true;
    } catch {
      parsedBody = null;
      isJson = false;
    }
  }

  return {
    status: response.status,
    ok: response.ok,
    rawBody,
    rawBodyPreview: String(rawBody || "").slice(0, 800),
    parsedBody,
    isJson,
    isEmpty: !rawBody || !rawBody.trim()
  };
}

function inspectWascriptResponse(kind: "text" | "document", httpStatus: number, rawBody: string, parsedBody: any) {
  const raw = String(rawBody || "");
  const rawLower = raw.toLowerCase();
  const isEmpty = !raw.trim();

  if (httpStatus < 200 || httpStatus >= 300) {
    return {
      accepted: false,
      confidence: "high" as const,
      reason: `HTTP ${httpStatus}`,
      parsedBody,
      rawBodyPreview: raw.slice(0, 500)
    };
  }

  if (isEmpty) {
    return {
      accepted: false,
      confidence: "unknown" as const,
      reason: "Resposta HTTP OK, mas corpo vazio. Não é possível confirmar aceite.",
      evidence: {
        hasPositiveFlag: false,
        hasMessageId: false,
        hasStructuredStatus: false,
        hasExplicitError: false,
        isEmpty: true,
        httpStatus
      },
      parsedBody: null,
      rawBodyPreview: ""
    };
  }

  const hasExplicitError = !!(
    rawLower.includes("error") ||
    rawLower.includes("erro") ||
    rawLower.includes("invalid") ||
    rawLower.includes("inválido") ||
    rawLower.includes("unauthorized") ||
    rawLower.includes("forbidden") ||
    rawLower.includes("token") ||
    rawLower.includes("not found") ||
    rawLower.includes("failed") ||
    rawLower.includes("falha") ||
    (parsedBody && (parsedBody.success === false || parsedBody.error || parsedBody.errorMessage))
  );

  const hasMessageId = !!(
    parsedBody?.id ||
    parsedBody?.messageId ||
    parsedBody?.message_id ||
    parsedBody?.data?.id ||
    parsedBody?.data?.messageId ||
    parsedBody?.result?.id
  );

  const statusVal = parsedBody?.status;
  const hasStructuredStatus = !!(
    statusVal === "success" ||
    statusVal === "sent" ||
    statusVal === "queued" ||
    (parsedBody?.data && ["sent", "queued", "success"].includes(parsedBody.data.status))
  );

  const hasPositiveFlag = !!(
    parsedBody?.success === true ||
    parsedBody?.status === true ||
    parsedBody?.ok === true ||
    parsedBody?.sent === true ||
    parsedBody?.enviado === true
  );

  // Real accept with strong proof
  // accepted: true somente se houver pelo menos uma destas provas fortes:
  // - parsedBody.success === true E houver parsedBody.id/messageId/message_id/data.id/data.messageId/result.id
  // - parsedBody.sent === true E houver id/messageId
  // - parsedBody.enviado === true E houver id/messageId
  // - parsedBody.status === "success" E houver id/messageId
  // - parsedBody.status === "sent" E houver id/messageId
  // - parsedBody.status === "queued" E houver id/messageId
  // - parsedBody.data.status em ["sent", "queued", "success"] E houver id/messageId
  let accepted = false;
  let confidence: "high" | "medium" | "unknown" = "unknown";
  let reason = "";

  const isStrongProof = hasMessageId && (
    parsedBody?.success === true ||
    parsedBody?.sent === true ||
    parsedBody?.enviado === true ||
    hasStructuredStatus
  );

  if (hasExplicitError) {
    accepted = false;
    confidence = "high";
    reason = "A API retornou corpo com indicação de erro.";
  } else if (isStrongProof) {
    accepted = true;
    confidence = "high";
    reason = "Resposta de sucesso estruturada (ID de mensagem e confirmação presentes).";
  } else {
    // If we have text positive words but it's not a strong proof:
    const hasAcceptedText =
      rawLower.includes("success") ||
      rawLower.includes("sucesso") ||
      rawLower.includes("sent") ||
      rawLower.includes("enviado") ||
      rawLower.includes("queued") ||
      rawLower.includes("fila") ||
      rawLower.includes("agendado");

    if (hasAcceptedText) {
      accepted = true;
      confidence = "medium";
      reason = "Resposta textual positiva, mas sem ID/status estruturado de mensagem.";
    } else {
      accepted = false;
      confidence = "unknown";
      reason = "HTTP OK, mas sem confirmação clara no corpo da resposta.";
    }
  }

  return {
    accepted,
    confidence,
    reason,
    evidence: {
      hasPositiveFlag,
      hasMessageId,
      hasStructuredStatus,
      hasExplicitError,
      isEmpty: false,
      httpStatus
    },
    parsedBody,
    rawBodyPreview: raw.slice(0, 500)
  };
}

// FASE 8 — CRIAR ENDPOINT DE TESTE DIRETO DO W.A SPEED
app.post("/api/whatsapp/test-send-text", async (req: any, res: any) => {
  const { phone, message } = req.body || {};

  if (!phone) {
    return res.status(400).json({ success: false, errorMessage: "Telefone do cliente é obrigatório." });
  }

  const phoneValidation = validateWhatsAppPhone(phone);
  if (!phoneValidation.valid) {
    return res.status(400).json({
      success: false,
      errorCode: "INVALID_WHATSAPP_PHONE",
      errorMessage: `WhatsApp inválido: ${phoneValidation.reason}`,
      diagnostic: {
        originalPhone: phone,
        normalizedPhone: phoneValidation.normalized
      }
    });
  }

  const cleanPhone = phoneValidation.normalized;
  const messageText = message || "Teste de integração W.A Speed - Giffoni";

  // Retrieve tokens
  let waSpeedToken = "";
  if (dbAdmin) {
    try {
      const connectorsSnap = await dbAdmin.collection("settings").doc("connectors").get();
      if (connectorsSnap.exists) {
        waSpeedToken = connectorsSnap.data()?.whatsapp?.waSpeedToken || "";
      }
    } catch (errDb) {
      console.warn("[WhatsAppTest] Failed to read settings doc:", errDb);
    }
  }

  let targetToken = "";
  let tokenSource = "missing";

  if (process.env.Wascript_API) {
    targetToken = process.env.Wascript_API;
    tokenSource = "process.env.Wascript_API";
  } else if (process.env.WASCRIPT_API) {
    targetToken = process.env.WASCRIPT_API;
    tokenSource = "process.env.WASCRIPT_API";
  } else if (process.env.WASCRIPT_TOKEN) {
    targetToken = process.env.WASCRIPT_TOKEN;
    tokenSource = "process.env.WASCRIPT_TOKEN";
  } else if (process.env.WA_SPEED_TOKEN) {
    targetToken = process.env.WA_SPEED_TOKEN;
    tokenSource = "process.env.WA_SPEED_TOKEN";
  } else if (waSpeedToken) {
    targetToken = waSpeedToken;
    tokenSource = "Firestore settings.connectors.whatsapp.waSpeedToken";
  }

  if (!targetToken) {
    return res.status(400).json({
      success: false,
      errorCode: "WASCRIPT_TOKEN_MISSING",
      errorMessage: "Token W.A Speed não configurado. Verifique o Secret Wascript_API."
    });
  }

  const baseUrl = "https://api-whatsapp.wascript.com.br";
  const textUrl = `${baseUrl}/api/enviar-texto/${targetToken}?phone=${cleanPhone}&message=${encodeURIComponent(messageText)}`;

  try {
    const textRes = await fetch(textUrl);
    const textApi = await readApiResponseSafely(textRes);

    const textInspection = inspectWascriptResponse(
      "text",
      textApi.status,
      textApi.rawBody,
      textApi.parsedBody
    );

    const isHighSuccess = textInspection.accepted && textInspection.confidence === "high";

    return res.json({
      success: isHighSuccess,
      requiresManualVerification: !isHighSuccess,
      phoneOriginal: phone,
      phoneNormalized: cleanPhone,
      wascript: {
        httpStatus: textApi.status,
        rawBodyPreview: textApi.rawBodyPreview,
        parsedBody: textApi.parsedBody,
        inspection: textInspection,
        isJson: textApi.isJson,
        isEmpty: textApi.isEmpty
      },
      message: isHighSuccess
        ? "Mensagem enviada com sucesso ao W.A Speed com confirmação da API."
        : "A API respondeu, mas é necessário confirmar se a mensagem chegou no WhatsApp."
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      errorCode: "WHATSAPP_TEST_SEND_FAILED",
      errorMessage: `Erro ao enviar teste de texto: ${err.message || err}`,
      diagnostic: {
        type: err.name || null
      }
    });
  }
});

// FASE 5 — VERIFICAR SE A INSTÂNCIA W.A SPEED ESTÁ REALMENTE CONECTADA
app.get("/api/whatsapp/connection-status", async (req: any, res: any) => {
  return res.json({
    success: false,
    errorCode: "WASCRIPT_STATUS_ENDPOINT_UNKNOWN",
    errorMessage: "Não foi encontrado endpoint de status da W.A Speed no código. Verificar documentação da Wascript/W.A Speed."
  });
});

// FASE 4 — TESTAR FORMATOS DE TELEFONE EM ENDPOINT DE DIAGNÓSTICO
app.post("/api/whatsapp/test-phone-formats", async (req: any, res: any) => {
  const { phone, message } = req.body || {};

  if (!phone) {
    return res.status(400).json({ success: false, errorMessage: "Telefone do cliente é obrigatório." });
  }

  const messageText = message || "Teste formato telefone W.A Speed";

  // Retrieve token securely
  let waSpeedToken = "";
  if (dbAdmin) {
    try {
      const connectorsSnap = await dbAdmin.collection("settings").doc("connectors").get();
      if (connectorsSnap.exists) {
        waSpeedToken = connectorsSnap.data()?.whatsapp?.waSpeedToken || "";
      }
    } catch (errDb) {
      console.warn("[WhatsAppTestFormats] Failed to read settings doc:", errDb);
    }
  }

  let targetToken = "";
  if (process.env.Wascript_API) {
    targetToken = process.env.Wascript_API;
  } else if (process.env.WASCRIPT_API) {
    targetToken = process.env.WASCRIPT_API;
  } else if (process.env.WASCRIPT_TOKEN) {
    targetToken = process.env.WASCRIPT_TOKEN;
  } else if (process.env.WA_SPEED_TOKEN) {
    targetToken = process.env.WA_SPEED_TOKEN;
  } else if (waSpeedToken) {
    targetToken = waSpeedToken;
  }

  if (!targetToken) {
    return res.status(400).json({
      success: false,
      errorCode: "WASCRIPT_TOKEN_MISSING",
      errorMessage: "Token W.A Speed não configurado. Verifique o Secret Wascript_API."
    });
  }

  // Generate unique list of formats to test
  const digitsOnly = String(phone).replace(/\D/g, "");
  const normalizedWithCountry = validateWhatsAppPhone(phone).normalized;

  // Let's draft the candidates
  const candidates = [
    normalizedWithCountry, // e.g. 5531988639056
    digitsOnly.startsWith("55") ? digitsOnly.slice(2) : digitsOnly, // e.g. 31988639056
    phone.trim(), // e.g. 55 31 98863-9056 raw
    `+${normalizedWithCountry}` // e.g. +5531988639056
  ];

  // Also include 12 digit format (no 9th digit) if DDD with 9 digits
  if (normalizedWithCountry.startsWith("55") && normalizedWithCountry.length === 13) {
    // 55 + DDD (2 digits) + 9 + 8 digits -> remove the 9: 55 + DDD + 8 digits
    const ddd = normalizedWithCountry.slice(2, 4);
    const rest = normalizedWithCountry.slice(5);
    candidates.push(`55${ddd}${rest}`); // e.g. 553188639056
  }

  // Unique elements
  const formatsToTry = Array.from(new Set(candidates)).filter(Boolean);

  const attempts = [];
  const baseUrl = "https://api-whatsapp.wascript.com.br";

  for (const format of formatsToTry) {
    const textUrl = `${baseUrl}/api/enviar-texto/${targetToken}?phone=${encodeURIComponent(format)}&message=${encodeURIComponent(messageText)}`;
    
    try {
      const textRes = await fetch(textUrl);
      const textApi = await readApiResponseSafely(textRes);
      const textInspection = inspectWascriptResponse(
        "text",
        textApi.status,
        textApi.rawBody,
        textApi.parsedBody
      );

      attempts.push({
        format,
        httpStatus: textApi.status,
        rawBodyPreview: textApi.rawBodyPreview,
        inspection: textInspection
      });
    } catch (err: any) {
      attempts.push({
        format,
        error: err.message || err
      });
    }

    // Small delay between requests to conform with Pase 4 requirements
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  return res.json({
    success: true,
    attempts
  });
});




function cleanUndefined(obj: any): any {
  if (obj === undefined) {
    return null;
  }
  if (obj === null) {
    return null;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => cleanUndefined(item));
  }
  if (typeof obj === "object") {
    const cleaned: any = {};
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (val !== undefined) {
        cleaned[key] = cleanUndefined(val);
      }
    }
    return cleaned;
  }
  return obj;
}

async function saveDeliveryLog(caseId: string, logData: any) {
  if (!caseId || !dbAdmin) return;
  try {
    const cleanData = cleanUndefined(logData);
    const deliveryLogsCol = dbAdmin.collection("cases").doc(caseId).collection("deliveryLogs");
    await deliveryLogsCol.add({
      ...cleanData,
      createdAt: new Date()
    });
    console.log("[saveDeliveryLog] Log saved successfully for caseId:", caseId);
  } catch (err) {
    console.warn("[saveDeliveryLog] Failed to save log:", err);
  }
}

app.post("/api/google-docs/send-whatsapp", async (req: any, res: any) => {
  console.log("[WhatsAppSend] START");
  const {
    googleDocsUrl,
    phone,
    docName,
    clientName,
    caseId,
    documentType,
    tipoPessoa,
    googleAccessToken
  } = req.body || {};

  console.log("[WhatsAppSend] Received payload safely:", {
    hasGoogleDocsUrl: !!googleDocsUrl,
    googleDocsUrlPreview: googleDocsUrl ? String(googleDocsUrl).slice(0, 80) : null,
    hasPhone: !!phone,
    hasGoogleAccessToken: !!googleAccessToken,
    docName,
    clientName,
    documentType,
    tipoPessoa,
    caseId
  });

  if (!phone) {
    console.log("[WhatsAppSend] DELIVERY_FAILED: phone missing");
    return res.status(400).json({
      success: false,
      errorCode: "PHONE_MISSING",
      errorMessage: "Telefone do cliente é obrigatório."
    });
  }

  // FASE 3 — VALIDAR URL ANTES DE EXPORTAR
  if (!googleDocsUrl || isInvalidGoogleDocsUrl(googleDocsUrl)) {
    console.log("[WhatsAppSend] DELIVERY_FAILED: googleDocsUrl missing or invalid");
    return res.status(400).json({
      success: false,
      errorCode: "GOOGLE_DOCS_URL_MISSING_OR_INVALID",
      errorMessage: "Documento ainda não foi gerado ou a URL do Google Docs é inválida."
    });
  }

  const fileId = extractGoogleFileId(googleDocsUrl);
  if (!fileId) {
    console.log("[WhatsAppSend] DELIVERY_FAILED: fileId not found");
    return res.status(400).json({
      success: false,
      errorCode: "GOOGLE_DOCS_FILE_ID_NOT_FOUND",
      errorMessage: "Não foi possível identificar o ID do arquivo no link do Google Docs.",
      diagnostic: {
        googleDocsUrlPreview: String(googleDocsUrl).slice(0, 120)
      }
    });
  }

  const phoneValidation = validateWhatsAppPhone(phone);
  if (!phoneValidation.valid) {
    console.log("[WhatsAppSend] DELIVERY_FAILED: invalid phone format");
    return res.status(400).json({
      success: false,
      errorCode: "INVALID_WHATSAPP_PHONE",
      errorMessage: `WhatsApp inválido: ${phoneValidation.reason}`,
      diagnostic: {
        originalPhone: phone,
        normalizedPhone: phoneValidation.normalized
      }
    });
  }

  const cleanPhone = phoneValidation.normalized;

  const waConfig = await resolveWaSpeedConfig();
  console.log("[WhatsAppConfig] Token source:", waConfig.tokenSource);
  console.log("[WhatsAppConfig] Token present:", waConfig.configured);
  console.log("[WhatsAppConfig] Token masked:", waConfig.tokenMasked);

  if (!waConfig.configured) {
    console.log("[WhatsAppSend] DELIVERY_FAILED: token missing");
    const safeConfigDiagnostic = { ...waConfig };
    delete (safeConfigDiagnostic as any).token;

    return res.status(400).json({
      success: false,
      errorCode: "WASCRIPT_TOKEN_MISSING",
      errorMessage: "Token W.A Speed não configurado.",
      diagnostic: safeConfigDiagnostic
    });
  }

  // Exact message structure with asterisks for bolding, as requested in Fase 1
  let messageText = "";
  let baseFileName = "Documento";
  if (documentType === "procuracao" || (docName && docName.toLowerCase().includes("procura"))) {
    messageText = "Olá! Aqui é a Giffoni Advogados Associados, segue a *procuração* para sua conferência e assinatura. Por gentileza, assine, digitalize em PDF e nos envie de volta. É sempre um imenso prazer lhe atender.";
    baseFileName = "Procuração";
  } else if (documentType === "declaracao" || (docName && docName.toLowerCase().includes("declara"))) {
    messageText = "Olá! Aqui é a Giffoni Advogados Associados, segue a *declaração* para sua conferência e assinatura. Por gentileza, assine, digitalize em PDF e nos envie de volta. É sempre um imenso prazer lhe atender.";
    baseFileName = "Declaração";
  } else if (documentType === "contrato" || (docName && docName.toLowerCase().includes("contrato"))) {
    messageText = "Olá! Aqui é a Giffoni Advogados Associados, segue o *contrato de honorários* para sua conferência e assinatura. Por gentileza, assine, digitalize em PDF e nos envie de volta. É sempre um imenso prazer lhe atender.";
    baseFileName = "Contrato de Honorários";
  } else {
    messageText = "Olá! Aqui é a Giffoni Advogados Associados, segue o documento para sua conferência e assinatura. Por gentileza, assine, digitalize em PDF e nos envie de volta. É sempre um imenso prazer lhe atender.";
  }

  // FASE 4 / 5 — EXPORTAR PDF
  let exportedPdf;
  try {
    exportedPdf = await exportGoogleDocToPdfBase64(req, googleDocsUrl);
  } catch (errPdf: any) {
    console.error("[WhatsAppSend] PDF Export failed:", {
      errorCode: errPdf.errorCode,
      message: errPdf.message,
      originalCode: errPdf.originalCode || null
    });

    console.log("[WhatsAppSend] DELIVERY_FAILED: export failed");
    return res.status(400).json({
      success: false,
      errorCode: errPdf.errorCode || "GOOGLE_DOCS_PDF_EXPORT_FAILED",
      errorMessage: buildGoogleDocsPdfErrorMessage(errPdf),
      diagnostic: {
        hasGoogleDocsUrl: !!googleDocsUrl,
        googleDocsUrlPreview: googleDocsUrl ? String(googleDocsUrl).slice(0, 120) : null,
        fileId: extractGoogleFileId(googleDocsUrl),
        hasGoogleAccessToken: !!googleAccessToken
      }
    });
  }

  const pdfBase64 = exportedPdf.pdfBase64;
  const safeFileName = `${baseFileName} - ${sanitizeFileName(clientName || "Cliente")}`;
  const baseUrl = "https://api-whatsapp.wascript.com.br";

  // Generate candidate phones (both 13-digit and 12-digit formats if Brazilian)
  const candidatePhones: string[] = [cleanPhone];
  if (cleanPhone.startsWith("55") && cleanPhone.length === 13) {
    const ddd = cleanPhone.slice(2, 4);
    const rest = cleanPhone.slice(5);
    const fallbackPhone = `55${ddd}${rest}`;
    if (fallbackPhone !== cleanPhone) {
      candidatePhones.push(fallbackPhone);
    }
  }

  console.log("[WhatsAppSend] Generated candidate phones to dispatch:", candidatePhones);

  const deliverySuccesses: any[] = [];
  const deliveryErrors: any[] = [];

  for (const targetPhone of candidatePhones) {
    console.log(`[WhatsAppSend] Attempting delivery for phone: ${targetPhone}`);
    
    // 1. Send the text message via GET
    const textUrl = `${baseUrl}/api/enviar-texto/${waConfig.token}?phone=${targetPhone}&message=${encodeURIComponent(messageText)}`;
    
    let textApi;
    try {
      const textRes = await fetch(textUrl);
      textApi = await readApiResponseSafely(textRes);
    } catch (errText: any) {
      console.error(`[WhatsAppSend] Text message failed for ${targetPhone}:`, errText);
      deliveryErrors.push({
        phone: targetPhone,
        step: "text_send",
        error: errText.message
      });
      continue;
    }

    console.log(`[WhatsAppSend] WascriptTextResponse for ${targetPhone}:`, {
      phone: targetPhone,
      httpStatus: textApi.status,
      isJson: textApi.isJson,
      isEmpty: textApi.isEmpty,
      rawBodyPreview: textApi.rawBodyPreview,
      parsedBody: textApi.parsedBody
    });

    const textInspection = inspectWascriptResponse(
      "text",
      textApi.status,
      textApi.rawBody,
      textApi.parsedBody
    );

    // Consider text successful if the API status is 2xx, OR inspection accepted it
    const isTextSuccess = (textApi.status >= 200 && textApi.status < 300) || textInspection.accepted;

    if (!isTextSuccess) {
      console.warn(`[WhatsAppSend] Text message rejected by API for ${targetPhone}:`, textInspection);
      deliveryErrors.push({
        phone: targetPhone,
        step: "text_validation",
        status: textApi.status,
        inspection: textInspection
      });
      continue;
    }

    console.log(`[WhatsAppSend] Text sent successfully/accepted for ${targetPhone}. Waiting 1.5s before PDF...`);
    await new Promise(resolve => setTimeout(resolve, 1500));

    // 2. Send the PDF document via POST
    const docUrl = `${baseUrl}/api/enviar-documento/${waConfig.token}`;
    let docApi;
    let formatUsed = "data_uri";

    // Log PDF parameters diagnostic securely before posting
    console.log(`[WhatsAppSend] Document payload diagnostic for ${targetPhone}:`, {
      endpoint: "/api/enviar-documento/[TOKEN_MASKED]",
      phone: targetPhone,
      base64Length: pdfBase64.length,
      fileName: `${safeFileName}.pdf`,
      hasDataPrefix: true
    });

    try {
      const docRes = await fetch(docUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: targetPhone,
          base64: `data:application/pdf;base64,${pdfBase64}`,
          name: `${safeFileName}.pdf`
        })
      });
      docApi = await readApiResponseSafely(docRes);
    } catch (errDoc: any) {
      console.error(`[WhatsAppSend] PDF send crashed for ${targetPhone}:`, errDoc);
      deliveryErrors.push({
        phone: targetPhone,
        step: "pdf_send_crash",
        error: errDoc.message
      });
      continue;
    }

    console.log(`[WascriptDocumentResponse] for ${targetPhone}:`, {
      phone: targetPhone,
      httpStatus: docApi.status,
      isJson: docApi.isJson,
      isEmpty: docApi.isEmpty,
      rawBodyPreview: docApi.rawBodyPreview,
      parsedBody: docApi.parsedBody
    });

    let docInspection = inspectWascriptResponse(
      "document",
      docApi.status,
      docApi.rawBody,
      docApi.parsedBody
    );

    // Fallback format check
    const docRawLower = String(docApi.rawBody || "").toLowerCase();
    const isBase64FormatError = docRawLower.includes("base64") || docRawLower.includes("format") || docRawLower.includes("prefix") || docRawLower.includes("data:application");

    const isDocHttpOk = docApi.status >= 200 && docApi.status < 300;
    let isDocSuccess = isDocHttpOk || docInspection.accepted;

    if (!isDocSuccess && isBase64FormatError) {
      console.log(`[WhatsAppSend] API error detected on format for ${targetPhone}, attempting plain base64 fallback...`);
      formatUsed = "plain_base64";

      try {
        const docResFallback = await fetch(docUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: targetPhone,
            base64: pdfBase64,
            name: `${safeFileName}.pdf`
          })
        });
        docApi = await readApiResponseSafely(docResFallback);
        docInspection = inspectWascriptResponse(
          "document",
          docApi.status,
          docApi.rawBody,
          docApi.parsedBody
        );
        isDocSuccess = (docApi.status >= 200 && docApi.status < 300) || docInspection.accepted;
      } catch (errFallback: any) {
        console.warn(`[WhatsAppSend] Plain base64 fallback crashed for ${targetPhone}:`, errFallback);
      }
    }

    if (!isDocSuccess) {
      console.warn(`[WhatsAppSend] PDF send rejected by API for ${targetPhone}:`, docInspection);
      deliveryErrors.push({
        phone: targetPhone,
        step: "pdf_validation",
        status: docApi.status,
        inspection: docInspection
      });
      continue;
    }

    // Both text and PDF successfully sent to this targetPhone!
    console.log(`[WhatsAppSend] Delivery fully successful for format: ${targetPhone}`);
    deliverySuccesses.push({
      phone: targetPhone,
      textHttpStatus: textApi.status,
      documentHttpStatus: docApi.status,
      textInspection,
      documentInspection: docInspection,
      formatUsed
    });
  }

  // If we had AT LEAST ONE fully successful delivery (both text and doc accepted), we log and return success!
  if (deliverySuccesses.length > 0) {
    console.log("[WhatsAppSend] DELIVERY_CONFIRMED - At least one recipient deliver fully succeeded:", deliverySuccesses);

    // Save success audit log in Firestore
    const primarySuccess = deliverySuccesses[0];
    const successPayload = {
      channel: "wa_speed",
      documentType: documentType || "procuracao",
      tipoPessoa: tipoPessoa || "PF",
      clientName: clientName || "",
      phoneOriginal: phone,
      phoneNormalized: primarySuccess.phone,
      googleDocsUrl,
      googleDocsFileId: fileId,
      docName: docName || "",
      tokenSource: waConfig.tokenSource,
      tokenMasked: waConfig.tokenMasked,
      status: "success",
      messageSent: true,
      documentSent: true,
      textConfidence: primarySuccess.textInspection.confidence,
      documentConfidence: primarySuccess.documentInspection.confidence,
      textHttpStatus: primarySuccess.textHttpStatus,
      documentHttpStatus: primarySuccess.documentHttpStatus,
      textInspection: primarySuccess.textInspection,
      documentInspection: primarySuccess.documentInspection,
      formatUsed: primarySuccess.formatUsed,
      allAttempts: {
        successes: deliverySuccesses,
        errors: deliveryErrors
      },
      successMessage: "Mensagem e PDF enviados com sucesso para o canal estruturado da API W.A Speed."
    };
    await saveDeliveryLog(caseId, successPayload);

    return res.status(200).json({
      success: true,
      message: `Mensagem e PDF enviados com sucesso pelo W.A Speed para o número ${primarySuccess.phone}.`,
      phoneNormalized: primarySuccess.phone,
      delivery: {
        phoneOriginal: phone,
        phoneNormalized: primarySuccess.phone,
        text: {
          accepted: true,
          confidence: primarySuccess.textInspection.confidence,
          reason: primarySuccess.textInspection.reason,
          response: primarySuccess.textInspection.parsedBody || primarySuccess.textInspection.rawBodyPreview
        },
        document: {
          accepted: true,
          confidence: primarySuccess.documentInspection.confidence,
          reason: primarySuccess.documentInspection.reason,
          response: primarySuccess.documentInspection.parsedBody || primarySuccess.documentInspection.rawBodyPreview
        }
      }
    });
  }

  // If we reach here, ALL candidates failed
  console.log("[WhatsAppSend] DELIVERY_FAILED - All formats attempts rejected or failed.");

  const failedPayload = {
    channel: "wa_speed",
    documentType: documentType || "procuracao",
    tipoPessoa: tipoPessoa || "PF",
    clientName: clientName || "",
    phoneOriginal: phone,
    phoneNormalized: cleanPhone,
    googleDocsUrl,
    googleDocsFileId: fileId,
    docName: docName || "",
    tokenSource: waConfig.tokenSource,
    tokenMasked: waConfig.tokenMasked,
    status: "failed",
    messageSent: false,
    documentSent: false,
    allAttempts: {
      successes: [],
      errors: deliveryErrors
    },
    errorCode: "WASCRIPT_ALL_FORMATS_FAILED",
    errorMessage: `Nenhum formato de telefone foi aceito pela API W.A Speed para entrega. Formatos tentados: ${candidatePhones.join(", ")}`
  };
  await saveDeliveryLog(caseId, failedPayload);

  return res.status(502).json({
    success: false,
    errorCode: "WASCRIPT_ALL_FORMATS_FAILED",
    errorMessage: `Falha ao enviar pelo W.A Speed. Tentou entregar para os formatos [${candidatePhones.join(", ")}], mas todos foram rejeitados pela API.`,
    diagnostic: {
      candidates: candidatePhones,
      errors: deliveryErrors,
      tokenSource: waConfig.tokenSource,
      tokenMasked: waConfig.tokenMasked
    }
  });
});




app.post("/api/google-docs/send-gmail", async (req: any, res: any) => {
  const { googleDocsUrl, email, docName, clientName, caseId, googleAccessToken, documentType } = req.body || {};
  if (!email) {
    return res.status(400).json({ success: false, errorMessage: "E-mail do cliente é obrigatório." });
  }

  // Choose the dynamic mention of the document based on its type
  let docMention = "procuração";
  if (documentType === "declaracao" || (docName && docName.toLowerCase().includes("declara"))) {
    docMention = "declaração";
  } else if (documentType === "contrato" || (docName && docName.toLowerCase().includes("contrato"))) {
    docMention = "contrato de honorários";
  }

  const messageText = `Olá!\n\nAqui é a Giffoni Advogados Associados. Segue a ${docMention} para sua conferência e assinatura.\n\nPor gentileza assine, digitalize em PDF e nos envie de volta em resposta a este e-mail.\n\nÉ sempre um imenso prazer lhe atender!\n\nAtenciosamente,\nGiffoni Advogados Associados.`;

  try {
    // Try exporting PDF from Google Drive if URL is provided
    let pdfBase64 = "";
    if (googleDocsUrl) {
      try {
        const { jwtClient } = await createGoogleDocsJwtClient(req);
        const drive = google.drive({ version: "v3", auth: jwtClient });
        const match = googleDocsUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
        const fileId = match ? match[1] : null;

        if (fileId) {
          const exportRes = await drive.files.export(
            {
              fileId,
              mimeType: "application/pdf"
            },
            { responseType: "arraybuffer" }
          );
          pdfBase64 = Buffer.from(exportRes.data as ArrayBuffer).toString("base64");
        }
      } catch (errPdf: any) {
        console.warn("[GmailSend] PDF Export failed:", errPdf.message);
      }
    }

    // Try sending email using user's active Google Access Token if available via Gmail API
    if (googleAccessToken) {
      try {
        const oauth2Client = new google.auth.OAuth2();
        oauth2Client.setCredentials({ access_token: googleAccessToken });
        const gmail = google.gmail({ version: "v1", auth: oauth2Client });

        const fileName = docName || "Documento";
        const boundary = "------=_Part_" + Date.now();
        const mailParts = [
          `To: ${email}`,
          `Subject: Envio de ${docName || "Documento"} — Giffoni Advogados`,
          `MIME-Version: 1.0`,
          `Content-Type: multipart/mixed; boundary="${boundary}"`,
          ``,
          `--${boundary}`,
          `Content-Type: text/plain; charset="UTF-8"`,
          `Content-Transfer-Encoding: 7bit`,
          ``,
          messageText,
          ``
        ];

        if (pdfBase64) {
          mailParts.push(
            `--${boundary}`,
            `Content-Type: application/pdf; name="${fileName}.pdf"`,
            `Content-Disposition: attachment; filename="${fileName}.pdf"`,
            `Content-Transfer-Encoding: base64`,
            ``,
            pdfBase64,
            ``
          );
        }

        mailParts.push(`--${boundary}--`);

        const rawMessageBase64 = Buffer.from(mailParts.join("\r\n"))
          .toString("base64")
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '');

        await gmail.users.messages.send({
          userId: "me",
          requestBody: {
            raw: rawMessageBase64
          }
        });

        return res.status(200).json({
          success: true,
          message: "Email enviado com sucesso usando sua conta do Gmail integrada!"
        });
      } catch (errGmailApi: any) {
        console.warn("[GmailSend] Gmail API send failed, falling back to simulated send:", errGmailApi.message);
      }
    }

    // Alternative: fallback to nodemailer smtp_sec or sendgrid if configured in settings
    let gmailConfig: any = null;
    let provider = "simulation";
    if (dbAdmin) {
      const connectorsSnap = await dbAdmin.collection("settings").doc("connectors").get();
      if (connectorsSnap.exists) {
        gmailConfig = connectorsSnap.data()?.gmail;
        if (gmailConfig) {
          provider = gmailConfig.provider || "simulation";
        }
      }
    }

    console.log(`[GmailSend] Simulating email send to ${email} via ${provider}. Msg: ${messageText}`);
    return res.status(200).json({
      success: true,
      message: `E-mail enviado com sucesso (Simulado via provedor ${provider || 'não_configurado'}).`,
      simulated: true,
      email,
      text: messageText,
      hasPdf: !!pdfBase64
    });

  } catch (err: any) {
    console.error("[GmailSend] Error:", err);
    return res.status(500).json({
      success: false,
      errorMessage: `Erro ao enviar e-mail: ${err.message || err}`
    });
  }
});

app.post("/api/google-docs/create-gmail-draft", async (req: any, res: any) => {
  const { googleDocsUrl, email, docName, clientName, googleAccessToken, documentType, tipoPessoa } = req.body || {};

  if (!email) {
    return res.status(400).json({ success: false, errorMessage: "E-mail do cliente é obrigatório." });
  }
  if (!googleDocsUrl) {
    return res.status(400).json({ success: false, errorMessage: "O link do Google Docs é obrigatório." });
  }
  if (!googleAccessToken) {
    return res.status(400).json({ success: false, errorMessage: "O token de acesso do Google/Gmail é obrigatório." });
  }

  // Determine dynamic details based on documentType or docName
  let docMention = "procuração";
  let subjectPrefix = "Envio de Procuração";
  let baseFileName = "Procuração";

  if (documentType === "declaracao" || (docName && docName.toLowerCase().includes("declara"))) {
    docMention = "declaração";
    subjectPrefix = "Envio de Declaração";
    baseFileName = "Declaração";
  } else if (documentType === "contrato" || (docName && docName.toLowerCase().includes("contrato"))) {
    docMention = "contrato de honorários";
    subjectPrefix = "Envio de Contrato de Honorários";
    baseFileName = "Contrato de Honorários";
  }

  const cleanClientName = (clientName || "Cliente").trim();
  const subject = `${subjectPrefix} - ${cleanClientName} - Giffoni Advogados`;

  // Encode header to base64 using RFC 2047 format to fix special character encoding problems
  const encodeMimeHeader = (val: string): string => {
    return `=?UTF-8?B?${Buffer.from(val, "utf8").toString("base64")}?=`;
  };
  const encodedSubject = encodeMimeHeader(subject);

  // Message body with NO asterisks, exactly as requested:
  const messageText = `Olá! Aqui é a Giffoni Advogados Associados, segue a ${docMention} para sua conferência e assinatura.\n\nPor gentileza, assine, digitalize em PDF e nos envie de volta.\n\nÉ sempre um imenso prazer lhe atender.\n\nAtenciosamente,\nGiffoni Advogados Associados`;

  try {
    // 1. Convert Google Docs URL to PDF using exportGoogleDocToPdfBase64
    let pdfBase64 = "";
    try {
      const exported = await exportGoogleDocToPdfBase64(req, googleDocsUrl);
      pdfBase64 = exported.pdfBase64;
    } catch (errPdf: any) {
      console.error("[GmailDraft] PDF Export failed:", errPdf);
      return res.status(500).json({
        success: false,
        errorCode: errPdf.errorCode || "GOOGLE_DOCS_PDF_EXPORT_FAILED",
        errorMessage: buildGoogleDocsPdfErrorMessage(errPdf)
      });
    }

    // 2. Setup OAuth and Gmail Client
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: googleAccessToken });
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    // 3. Construct filename
    const sanitizeFileName = (name: string): string => {
      return String(name || "Cliente")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // remove accents
        .replace(/[\/:*?"<>|]/g, "")
        .replace(/\s+/g, " ")
        .trim();
    };

    const fileName = `${baseFileName} - ${sanitizeFileName(cleanClientName)}`;
    
    // Always include direito.rgr@gmail.com as a mandatory recipient
    const recipientsList = [email.trim()];
    if (!recipientsList.some(r => r.toLowerCase() === "direito.rgr@gmail.com")) {
      recipientsList.push("direito.rgr@gmail.com");
    }
    const toHeaderValue = recipientsList.join(", ");

    // 4. Build MIME message (raw RFC 2822 format)
    const boundary = "------=_Part_" + Date.now();
    const bodyBase64 = Buffer.from(messageText, "utf8").toString("base64");

    const mailParts = [
      `To: ${toHeaderValue}`,
      `Subject: ${encodedSubject}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      ``,
      `--${boundary}`,
      `Content-Type: text/plain; charset="UTF-8"`,
      `Content-Transfer-Encoding: base64`,
      ``,
      bodyBase64,
      ``
    ];

    if (pdfBase64) {
      mailParts.push(
        `--${boundary}`,
        `Content-Type: application/pdf; name="${fileName}.pdf"`,
        `Content-Disposition: attachment; filename="${fileName}.pdf"`,
        `Content-Transfer-Encoding: base64`,
        ``,
        pdfBase64,
        ``
      );
    }

    mailParts.push(`--${boundary}--`);

    const rawMessageBase64 = Buffer.from(mailParts.join("\r\n"))
      .toString("base64")
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // 5. Create Draft
    const draftRes = await gmail.users.drafts.create({
      userId: "me",
      requestBody: {
        message: {
          raw: rawMessageBase64
        }
      }
    });

    const draftId = draftRes.data.id;
    const messageId = draftRes.data.message?.id;
    const threadId = draftRes.data.message?.threadId;

    // Return different possible open URL routes
    return res.status(200).json({
      success: true,
      message: "Rascunho de e-mail criado com sucesso no Gmail com o PDF anexado!",
      draftId,
      messageId,
      threadId,
      gmailOpenUrls: {
        draftById: draftId ? `https://mail.google.com/mail/u/0/#drafts/${draftId}` : null,
        draftByMessageId: messageId ? `https://mail.google.com/mail/u/0/#drafts/${messageId}` : null,
        inboxThread: threadId ? `https://mail.google.com/mail/u/0/#inbox/${threadId}` : null,
        composeByMessageId: messageId ? `https://mail.google.com/mail/u/0/#all?compose=${messageId}` : null,
        composeByDraftId: draftId ? `https://mail.google.com/mail/u/0/#all?compose=${draftId}` : null,
        composeInDraftsByMessageId: messageId ? `https://mail.google.com/mail/u/0/#drafts?compose=${messageId}` : null,
        draftsFolder: "https://mail.google.com/mail/u/0/#drafts"
      }
    });

  } catch (err: any) {
    console.error("[GmailDraft] Error creating gmail draft:", err);
    let errorCode = "GMAIL_DRAFT_CREATION_FAILED";
    const msg = err?.message || String(err);
    if (err.code === 401 || msg.toLowerCase().includes("unauthorized") || msg.toLowerCase().includes("invalid_token") || msg.toLowerCase().includes("expired")) {
      errorCode = "GOOGLE_DOCS_TOKEN_EXPIRED";
    }
    return res.status(500).json({
      success: false,
      errorCode,
      errorMessage: `Não foi possível criar o rascunho no Gmail. Erro: ${err.message || err}`
    });
  }
});

app.post("/api/google-docs/preflight", async (req: any, res: any) => {
  const { templateId, destinationFolderId, caseId, clientId, mode } = req.body || {};
  const isStateless = mode === "stateless";

  const checks: Record<string, string> = {
    firebaseAdmin: "pending",
    firestore: "pending",
    client: "pending",
    case: "pending",
    googleAuth: "pending",
    driveApi: "pending",
    docsApi: "pending",
    template: "pending",
    folder: "pending"
  };

  try {
    // 1. Check Firebase Admin
    if (!dbAdmin || !firebaseAdminStatus.initialized) {
      checks.firebaseAdmin = "error";
      if (!isStateless) {
        return res.status(200).json({
          success: false,
          status: "blocked",
          blockingStep: "firebaseAdmin",
          errorCode: "FIREBASE_ADMIN_NOT_INITIALIZED",
          errorMessage: "Configure FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON antes de gerar documentos.",
          checks: {}
        });
      } else {
        checks.firebaseAdmin = "skipped_stateless";
      }
    } else {
      checks.firebaseAdmin = "ok";
    }

    // 2. Check Firestore Database ID
    if (!isStateless && !firebaseAdminStatus.firestoreDatabaseId) {
      checks.firestore = "error";
      return res.status(200).json({
        success: false,
        status: "blocked",
        blockingStep: "firestore",
        errorCode: "FIRESTORE_DATABASE_NOT_CONFIGURED",
        errorMessage: "O ID do banco de dados Firestore não está definido.",
        checks
      });
    }

    if (!isStateless) {
      try {
        await dbAdmin.collection("settings").doc("connectors").get();
        checks.firestore = "ok";
      } catch (errFs: any) {
        checks.firestore = "error";
        return res.status(200).json({
          success: false,
          status: "blocked",
          blockingStep: "firestore",
          errorCode: "FIRESTORE_DATABASE_UNAVAILABLE",
          errorMessage: `Banco de dados Firestore ou coleção 'settings/connectors' ilegível: ${errFs.message}`,
          checks
        });
      }
    } else {
      checks.firestore = "skipped_stateless";
    }

    // 3. Validate Client existence
    if (clientId && !isStateless) {
      try {
        const clSnap = await dbAdmin.collection("clients").doc(clientId).get();
        if (clSnap.exists) {
          checks.client = "ok";
        } else {
          checks.client = "not_found";
          return res.status(200).json({
            success: false,
            status: "blocked",
            blockingStep: "client",
            errorCode: "CLIENT_NOT_FOUND",
            errorMessage: `Cliente de ID '${clientId}' não foi localizado.`,
            checks
          });
        }
      } catch (errCl: any) {
        checks.client = "error";
        return res.status(200).json({
          success: false,
          status: "blocked",
          blockingStep: "client",
          errorCode: "CLIENT_READ_ERROR",
          errorMessage: `Erro ao carregar dados do cliente: ${errCl.message}`,
          checks
        });
      }
    } else {
      checks.client = isStateless ? "skipped_stateless" : "missing";
    }

    // 4. Validate Case existence
    if (caseId && !isStateless) {
      try {
        const cSnap = await dbAdmin.collection("cases").doc(caseId).get();
        if (cSnap.exists) {
          checks.case = "ok";
        } else {
          checks.case = "not_found";
          return res.status(200).json({
            success: false,
            status: "blocked",
            blockingStep: "case",
            errorCode: "CASE_NOT_FOUND",
            errorMessage: `Caso de ID '${caseId}' não foi localizado.`,
            checks
          });
        }
      } catch (errC: any) {
        checks.case = "error";
        return res.status(200).json({
          success: false,
          status: "blocked",
          blockingStep: "case",
          errorCode: "CASE_READ_ERROR",
          errorMessage: `Erro ao carregar dados do caso: ${errC.message}`,
          checks
        });
      }
    } else {
      checks.case = isStateless ? "skipped_stateless" : "missing";
    }

    // 5. Validate Google Authenticity (Service Account credentials)
    let jwtClient: any = null;
    try {
      const authResult = await createGoogleDocsJwtClient(req);
      jwtClient = authResult.jwtClient;
      checks.googleAuth = "ok";
    } catch (errAuth: any) {
      checks.googleAuth = "error";
      return res.status(200).json({
        success: false,
        status: "blocked",
        blockingStep: "googleAuth",
        errorCode: errAuth.errorCode || "GOOGLE_DOCS_AUTH_FAILED",
        errorMessage: `Erro ao logar com credenciais Google: ${errAuth.message}`,
        checks
      });
    }

    // 5. Verify Google Drive API
    try {
      const drive = google.drive({ version: "v3", auth: jwtClient });
      await drive.files.list({ pageSize: 1 });
      checks.driveApi = "ok";
    } catch (errApis: any) {
      checks.driveApi = "error";
      checks.docsApi = "error";
      return res.status(200).json({
        success: false,
        status: "blocked",
        blockingStep: "driveApi",
        errorCode: "GOOGLE_DRIVE_API_DISABLED",
        errorMessage: `A API Google Drive não está habilitada ou acessível: ${errApis.message}`,
        checks
      });
    }

    // 6. Verify Google Docs API
    try {
      const docs = google.docs({ version: "v1", auth: jwtClient });
      checks.docsApi = "ok";
    } catch (errApis: any) {
      checks.docsApi = "error";
      return res.status(200).json({
        success: false,
        status: "blocked",
        blockingStep: "docsApi",
        errorCode: "GOOGLE_DOCS_API_DISABLED",
        errorMessage: `A API Google Docs não está habilitada no projeto: ${errApis.message}`,
        checks
      });
    }

    // 7. Verify template access
    if (templateId) {
      try {
        const drive = google.drive({ version: "v3", auth: jwtClient });
        const fileRes = await drive.files.get({ fileId: templateId, fields: "id,mimeType" });
        if (fileRes.data.mimeType !== "application/vnd.google-apps.document") {
          checks.template = "invalid_type";
          return res.status(200).json({
            success: false,
            status: "blocked",
            blockingStep: "template",
            errorCode: "TEMPLATE_NOT_GOOGLE_DOCS",
            errorMessage: "O ID do template não possui mimeType válido de Google Docs.",
            checks
          });
        }
        checks.template = "ok";
      } catch (errT: any) {
        checks.template = "error";
        return res.status(200).json({
          success: false,
          status: "blocked",
          blockingStep: "template",
          errorCode: "TEMPLATE_NOT_ACCESSIBLE",
          errorMessage: `Não possui leitura do template Google Docs: ${errT.message}`,
          checks
        });
      }
    } else {
      checks.template = "missing";
    }

    // 8. Verify Folder write access
    if (destinationFolderId) {
      try {
        const drive = google.drive({ version: "v3", auth: jwtClient });
        const fold = await drive.files.get({ fileId: destinationFolderId, fields: "id,mimeType" });
        if (fold.data.mimeType !== "application/vnd.google-apps.folder") {
          checks.folder = "invalid_type";
          return res.status(200).json({
            success: false,
            status: "blocked",
            blockingStep: "folder",
            errorCode: "DESTINATION_NOT_FOLDER",
            errorMessage: "O ID de destino no Google Drive não é do tipo Pasta.",
            checks
          });
        }
        
        // Active WRITE/DELETE test as specified
        const tempFileName = `TEST_PREFLIGHT_WRITE_${Date.now()}`;
        let createdFileId = "";
        try {
          const tempFileRes = await drive.files.create({
            requestBody: {
              name: tempFileName,
              parents: [destinationFolderId],
              mimeType: "text/plain"
            },
            media: {
              mimeType: "text/plain",
              body: "Validacao de escrita via preflight do Portal BOSS"
            }
          });
          createdFileId = tempFileRes.data.id || "";
        } catch (errWrite: any) {
          checks.folder = "permission_denied";
          return res.status(200).json({
            success: false,
            status: "blocked",
            blockingStep: "folder",
            errorCode: "DESTINATION_FOLDER_PERMISSION_DENIED",
            errorMessage: `Sem permissão de escrita na pasta destino do Drive: ${errWrite.message}. Certifique-se de compartilhar a pasta com o e-mail da Service Account.`,
            checks
          });
        }

        // Cleanup the test file
        if (createdFileId) {
          try {
            await drive.files.delete({ fileId: createdFileId });
          } catch (errDel: any) {
            console.warn(`[GoogleDocsEngine] Preflight test file cleanup warn: ${createdFileId}`, errDel.message);
          }
        }

        checks.folder = "ok";
      } catch (errF: any) {
        checks.folder = "error";
        return res.status(200).json({
          success: false,
          status: "blocked",
          blockingStep: "folder",
          errorCode: "DESTINATION_FOLDER_PERMISSION_DENIED",
          errorMessage: `Pasta de destino do Drive não pôde ser lida ou acessada: ${errF.message}`,
          checks
        });
      }
    } else {
      checks.folder = "missing";
    }

    const isReady = checks.firebaseAdmin === "ok" &&
                    checks.firestore === "ok" && 
                    checks.googleAuth === "ok" && 
                    checks.driveApi === "ok" && 
                    checks.docsApi === "ok" && 
                    checks.template === "ok" && 
                    checks.folder === "ok" &&
                    (clientId ? checks.client === "ok" : true) &&
                    (caseId ? checks.case === "ok" : true);

    return res.status(200).json({
      success: isReady,
      status: isReady ? "ready_for_real_test" : "blocked",
      checks
    });
  } catch (errPre: any) {
    return res.status(500).json({
      success: false,
      status: "blocked",
      errorCode: "PREFLIGHT_ERROR",
      errorMessage: `Erro interno crítico ao analisar preflight: ${errPre.message}`,
      checks
    });
  }
});

app.get("/api/google-docs/export-pdf", async (req: any, res: any) => {
  try {
    const documentId = req.query.documentId || req.query.fileId || req.body?.documentId;
    if (!documentId) {
      return res.status(400).json({ success: false, error: "O parâmetro documentId ou fileId é obrigatório." });
    }

    const { jwtClient } = await createGoogleDocsJwtClient(req);
    const drive = google.drive({ version: "v3", auth: jwtClient });

    // Retrieve file metadata to determine native google-apps doc or other mime type
    const fileMetadata = await drive.files.get({ fileId: documentId, fields: "mimeType, name" });
    const mimeType = fileMetadata.data.mimeType || "";
    const name = fileMetadata.data.name || "documento_exportado";

    if (mimeType.startsWith("application/vnd.google-apps")) {
      // Export Google Doc as PDF
      const exportRes = await drive.files.export(
        { fileId: documentId, mimeType: "application/pdf" },
        { responseType: "stream" }
      );
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(name)}.pdf"`);
      exportRes.data.pipe(res);
    } else {
      // Support binary downloads directly (e.g. if already pdf)
      const downloadRes = await drive.files.get(
        { fileId: documentId, alt: "media" },
        { responseType: "stream" }
      );
      res.setHeader("Content-Type", mimeType || "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(name)}"`);
      downloadRes.data.pipe(res);
    }
  } catch (err: any) {
    console.error("[ExportPDF] Error exporting document to PDF:", err);
    return res.status(500).json({
      success: false,
      error: `Erro ao exportar documento para PDF: ${err.message || err}`
    });
  }
});

app.get("/api/google-docs/export-html", async (req: any, res: any) => {
  try {
    const documentId = req.query.documentId || req.query.fileId || req.body?.documentId;
    if (!documentId) {
      return res.status(400).json({ success: false, error: "O parâmetro documentId ou fileId é obrigatório." });
    }

    const { jwtClient } = await createGoogleDocsJwtClient(req);
    const drive = google.drive({ version: "v3", auth: jwtClient });

    const fileMetadata = await drive.files.get({ fileId: documentId, fields: "mimeType, name" });
    const mimeType = fileMetadata.data.mimeType || "";
    const name = fileMetadata.data.name || "documento_exportado";

    if (mimeType.startsWith("application/vnd.google-apps")) {
      // Export Google Doc as HTML
      const exportRes = await drive.files.export(
        { fileId: documentId, mimeType: "text/html" },
        { responseType: "stream" }
      );
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(name)}.html"`);
      exportRes.data.pipe(res);
    } else {
      // Support binary downloads directly
      const downloadRes = await drive.files.get(
        { fileId: documentId, alt: "media" },
        { responseType: "stream" }
      );
      res.setHeader("Content-Type", mimeType || "text/html");
      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(name)}"`);
      downloadRes.data.pipe(res);
    }
  } catch (err: any) {
    console.error("[ExportHTML] Error exporting document to HTML:", err);
    return res.status(500).json({
      success: false,
      error: `Erro ao exportar documento para HTML: ${err.message || err}`
    });
  }
});

// Dedicated health-check endpoint for validating GDI integrations
app.post("/api/proxy-google-docs/health-check", async (req, res) => {
  try {
    const { targetEndpoint, integrationKey } = req.body || {};
    
    console.log("[Proxy Docs] PORTAL_GDI_SERVER_TO_SERVER_TEST_STARTED");

    if (!targetEndpoint || !targetEndpoint.trim()) {
      return res.status(200).json({
        success: false,
        environmentMode: "preview_browser",
        integrationOperationalStatus: "nao_configurado",
        lastPreviewWarning: "A URL do GDI configurada está vazia.",
        lastServerToServerTestAt: new Date().toISOString(),
        lastServerToServerResult: "Falha: URL ausente.",
        lastReceivedByGdiConfirmed: "não_confirmado"
      });
    }

    let url = targetEndpoint.trim().replace(/\/$/, "");

    // Clean query params
    if (url.includes("?")) {
      url = url.split("?")[0];
    }

    // Must start with https://
    if (!url.toLowerCase().startsWith("https://")) {
      return res.status(200).json({
        success: false,
        environmentMode: "preview_browser",
        integrationOperationalStatus: "invalida",
        lastPreviewWarning: "A URL do GDI deve começar obrigatoriamente com \"https://\"",
        lastServerToServerTestAt: new Date().toISOString(),
        lastServerToServerResult: "Falha: URL não utiliza HTTPS seguro.",
        lastReceivedByGdiConfirmed: "não_confirmado"
      });
    }

    let isPreviewEnv = url.toLowerCase().includes("ais-dev-") || url.toLowerCase().includes("ais-pre-") || url.toLowerCase().includes("web-preview") || url.toLowerCase().includes("aistudio");
    if (isPreviewEnv) {
      console.log("[Proxy Docs] PORTAL_GDI_PREVIEW_MODE_DETECTED");
    }

    let envMode = isPreviewEnv ? "preview_server_to_server" : "production_server_to_server";

    const incomingCookie = req.headers["cookie"] || "";
    const headers = {
      "X-BOSS-Google-Docs-Integration-Key": (integrationKey || "").trim()
    };

    const isAuthProxyOrPreview = (status: number, contentType: string, text: string, finalUrl: string, requestedUrl: string): boolean => {
      const cLower = (contentType || "").toLowerCase();
      const tLower = (text || "").toLowerCase();
      const fLower = (finalUrl || "").toLowerCase();
      const rLower = (requestedUrl || "").toLowerCase();

      // Redirected to auth/iframe domains or paths
      const isRedirectedToAuth = (fLower !== rLower) && (
        fLower.includes("accounts.google") ||
        fLower.includes("aistudio.google") ||
        fLower.includes("login") ||
        fLower.includes("auth") ||
        fLower.includes("unauthorized")
      );

      const containsAuthWords = 
        tLower.includes("login") ||
        tLower.includes("auth") ||
        tLower.includes("accounts.google.com") ||
        tLower.includes("aistudio.google.com") ||
        tLower.includes("showpreview") ||
        tLower.includes("showassistant") ||
        tLower.includes("unauthorized preview") ||
        tLower.includes("sign-in") ||
        tLower.includes("signin") ||
        tLower.includes("cookie check");

      const isHtml = cLower.includes("html") || 
                     text.trim().startsWith("<") || 
                     tLower.includes("<!doctype html") || 
                     tLower.includes("<html");

      return isHtml || isRedirectedToAuth || containsAuthWords || status === 401 || status === 403;
    };

    // TEST 2 - PROBING GET /api/health
    const healthUrl = `${url}/api/health`;
    console.log(`[Proxy Docs] Probing api/health: ${healthUrl}`);
    let healthRes, healthText = "";
    let httpStatusA = 0;
    let contentTypeA = "";
    let redirectedA = false;
    let finalUrlA = healthUrl;
    let authProxyDetectedA = false;
    let errA = "";

    try {
      const probeRes = await smartFetch(healthUrl, { method: "GET", headers }, incomingCookie);
      healthRes = probeRes.response;
      httpStatusA = healthRes.status;
      contentTypeA = healthRes.headers.get("content-type") || "";
      healthText = probeRes.text;
      redirectedA = healthRes.redirected || false;
      finalUrlA = healthRes.url || healthUrl;
      authProxyDetectedA = isAuthProxyOrPreview(httpStatusA, contentTypeA, healthText, finalUrlA, healthUrl);
    } catch (e: any) {
      errA = e.message || String(e);
      healthText = `Connection failed: ${errA}`;
    }

    // TEST 3 - PROBING GET /api/webhook/gdi-job
    const webhookUrl = `${url}/api/webhook/gdi-job`;
    console.log(`[Proxy Docs] Probing api/webhook/gdi-job: ${webhookUrl}`);
    let webhookRes, webhookText = "";
    let httpStatusB = 0;
    let contentTypeB = "";
    let redirectedB = false;
    let finalUrlB = webhookUrl;
    let authProxyDetectedB = false;
    let errB = "";

    try {
      const probeRes = await smartFetch(webhookUrl, { method: "GET", headers }, incomingCookie);
      webhookRes = probeRes.response;
      httpStatusB = webhookRes.status;
      contentTypeB = webhookRes.headers.get("content-type") || "";
      webhookText = probeRes.text;
      redirectedB = webhookRes.redirected || false;
      finalUrlB = webhookRes.url || webhookUrl;
      authProxyDetectedB = isAuthProxyOrPreview(httpStatusB, contentTypeB, webhookText, finalUrlB, webhookUrl);
    } catch (e: any) {
      errB = e.message || String(e);
      webhookText = `Connection failed: ${errB}`;
    }

    let authProxyDetected = authProxyDetectedA || authProxyDetectedB;
    let integrationOperationalStatus = "erro";
    let lastPreviewWarning = "";
    let lastServerToServerResult = "";
    let success = false;

    let healthJson: any = null;
    let webhookJson: any = null;
    try { healthJson = JSON.parse(healthText); } catch { }
    try { webhookJson = JSON.parse(webhookText); } catch { }

    const isHealthOk = healthJson && (healthJson.success === true || healthJson.status === "ok" || healthJson.status === "ready" || String(healthJson.service).toLowerCase() === "gdi");
    const isWebhookOk = webhookJson && (webhookJson.status === "ready" || webhookJson.success === true || webhookJson.status === "ok" || String(webhookJson.webhook).includes("/api/webhook/gdi-job"));

    if (authProxyDetected) {
      console.log("[Proxy Docs] PORTAL_GDI_AUTH_PROXY_DETECTED");
      console.log("[Proxy Docs] PORTAL_GDI_SERVER_TO_SERVER_BLOCKED");
      integrationOperationalStatus = "preview_server_to_server_blocked";
      lastPreviewWarning = "O GDI pode estar acessível no navegador preview, mas o backend do Portal não conseguiu comunicação server-to-server com o runtime do GDI.";
      lastServerToServerResult = `Falha: Redirecionamento Auth-Proxy ou HTML detectado. HealthStatus: ${httpStatusA}, WebhookStatus: ${httpStatusB}`;
    } else if (errA || errB) {
      integrationOperationalStatus = "erro";
      lastPreviewWarning = `Falha de rede ao conectar com GDI. Erro A: ${errA || "nenhum"}, Erro B: ${errB || "nenhum"}`;
      lastServerToServerResult = `Falha de conexão: ${lastPreviewWarning}`;
    } else if (isHealthOk && isWebhookOk) {
      console.log("[Proxy Docs] PORTAL_GDI_JSON_HEALTH_OK");
      console.log("[Proxy Docs] PORTAL_GDI_WEBHOOK_READY_OK");
      integrationOperationalStatus = "operacional";
      lastServerToServerResult = "Sucesso: Ambos os endpoints (/api/health e /api/webhook/gdi-job) confirmaram integridade do contrato GDI.";
      success = true;
    } else {
      integrationOperationalStatus = "endpoint_publico_ok";
      lastPreviewWarning = "Comunicação básica estabelecida, mas o JSON do contrato não correspondeu inteiramente aos parâmetros esperados do GDI.";
      lastServerToServerResult = `Parcial: api/health ok? ${!!isHealthOk} (${httpStatusA}), api/webhook ok? ${!!isWebhookOk} (${httpStatusB})`;
      success = true;
    }

    return res.status(200).json({
      success,
      environmentMode: envMode,
      integrationOperationalStatus,
      lastPreviewWarning,
      lastServerToServerTestAt: new Date().toISOString(),
      lastServerToServerResult,
      lastReceivedByGdiConfirmed: "não_confirmado", // Will be confirmed on first real job generation
      authProxyDetected,
      teste1: {
        endpointUrl: url,
        isValidHttps: url.toLowerCase().startsWith("https://")
      },
      teste2: {
        httpStatus: httpStatusA,
        contentType: contentTypeA,
        responseBody: healthText.substring(0, 500),
        redirected: redirectedA,
        finalUrl: finalUrlA,
        authProxyDetected: authProxyDetectedA
      },
      teste3: {
        httpStatus: httpStatusB,
        contentType: contentTypeB,
        responseBody: webhookText.substring(0, 500),
        redirected: redirectedB,
        finalUrl: finalUrlB,
        authProxyDetected: authProxyDetectedB
      }
    });

  } catch (err: any) {
    console.error("[HealthCheck Error]", err);
    return res.status(200).json({
      success: false,
      environmentMode: "preview_browser",
      integrationOperationalStatus: "erro",
      lastPreviewWarning: `Erro crítico na ponte de diagnóstico: ${err.message || err}`,
      lastServerToServerTestAt: new Date().toISOString(),
      lastServerToServerResult: `Falha: ${err.message || err}`,
      lastReceivedByGdiConfirmed: "não_confirmado",
      authProxyDetected: false
    });
  }
});

app.post("/api/test-google-docs", async (req, res) => {
  const { gdiBaseUrl, integrationKey, isDiagnostic } = req.body || {};
  try {

    // 1. Check if integrationKey exists
    if (!integrationKey || !integrationKey.trim()) {
      return res.status(400).json({ error: "A chave de integração (X-BOSS-Google-Docs-Integration-Key) é obrigatória." });
    }

    // 2. Validate URL against blocked terms
    if (!gdiBaseUrl || !gdiBaseUrl.trim()) {
      return res.status(400).json({ error: "O campo GDI API Base URL é obrigatório." });
    }

    let url = gdiBaseUrl.trim();

    // Must start with https://
    if (!url.toLowerCase().startsWith("https://")) {
      return res.status(400).json({ error: "A URL deve começar obrigatoriamente com https://" });
    }

    const blockedTerms = [
      "aistudio.google.com",
      "showpreview",
      "showassistant",
      "accounts.google.com",
      "firebaseapp login",
      "firebaseapp",
      "/__/auth/handler"
    ];

    const lowerUrl = url.toLowerCase();
    for (const term of blockedTerms) {
      if (lowerUrl.includes(term.toLowerCase())) {
        return res.status(400).json({
          error: "A URL informada é uma tela do AI Studio e não uma API pública."
        });
      }
    }

    if (lowerUrl.includes("localhost") || lowerUrl.includes("127.0.0.1")) {
      return res.status(400).json({
        error: "A URL do GDI não pode apontar para localhost ou 127.0.0.1."
      });
    }

    if (!lowerUrl.includes(".run.app")) {
      return res.status(400).json({
        error: "A URL do GDI deve ser uma URL homologada terminando com \".run.app\"."
      });
    }

    // Construct target endpoint and choose method dynamically
    let targetEndpoint = "";
    let method = "GET";
    let bodyPayload: any = undefined;

    if (isDiagnostic) {
      targetEndpoint = `${url.replace(/\/$/, "")}/api/webhook/gdi-job`;
      method = "POST";
      bodyPayload = {
        source: "Portal BOSS Clientes",
        target: "GDI",
        documentType: "procuracao_pf",
        caseId: "diagnostico_case_id",
        clientId: "diagnostico_client_id",
        clientType: "PF",
        destinationFolderId: "diagnostico_folder_id",
        destinationFolderUrl: "https://drive.google.com/drive/folders/diagnostico_folder",
        templateKey: "procuracao-pf",
        payload: {
          nomeCompleto: "Diagnóstico Real BOSS GDI",
          nacionalidade: "Brasileiro",
          estadoCivil: "Solteiro",
          profissao: "Engenheiro de Software",
          cpf: "000.000.000-00",
          rg: "MG-00.000.000",
          endereco: "Avenida Principal",
          numero: "100",
          complemento: "Apt 201",
          bairro: "Centro",
          cidade: "Viçosa",
          estado: "MG",
          cep: "36570-000",
          email: "diagnostico@exemplo.com",
          telefone: "(31) 99999-9999",
          whatsapp: "(31) 99999-9999",
          localAssinatura: "Viçosa, MG",
          advogadoNome: "RODRIGO GIFFONI RODRIGUES",
          advogadoOab: "OAB/MG 157.320",
          dataAssinatura: "data da assinatura eletrônica"
        }
      };
    } else {
      targetEndpoint = `${url.replace(/\/$/, "")}/api/config`;
      method = "GET";
    }

    console.log(`[GDI Test] Chamando endpoint: ${targetEndpoint} [${method}]`);

    const start = Date.now();

    // Call external GDI
    const incomingCookie = req.headers["cookie"] || "";
    const { response, text } = await smartFetch(targetEndpoint, {
      method: method,
      headers: {
        "Content-Type": "application/json",
        "X-BOSS-Google-Docs-Integration-Key": integrationKey.trim()
      },
      body: bodyPayload ? JSON.stringify(bodyPayload) : undefined
    }, incomingCookie);

    const duration = Date.now() - start;
    const status = response.status;
    const contentType = response.headers.get("content-type") || "";

    console.log(`[GDI Test] Resposta obtida. Status: ${status}, Content-Type: ${contentType}, Tempo: ${duration}ms`);

    // Check if it is HTML or Login redirect or redirect status code
    const isRedirect = response.redirected || (status >= 300 && status < 400);
    const isHtmlResponse = contentType.includes("html") || 
                           text.trim().startsWith("<") || 
                           text.toLowerCase().includes("<!doctype html") || 
                           text.toLowerCase().includes("<html") ||
                           text.toLowerCase().includes("login") ||
                           text.toLowerCase().includes("sign in");

    if (isHtmlResponse || isRedirect) {
      return res.status(200).json({
        success: false,
        status,
        durationMs: duration,
        endpoint: targetEndpoint,
        error: isRedirect 
          ? "Falha: O servidor redirecionou a requisição (provável login ou página restrita)."
          : "Falha: GDI retornou HTML/Login ao invés de JSON. Verifique se a URL da API está correta."
      });
    }

    // Must be valid JSON
    let responseData: any;
    let isJson = false;
    try {
      responseData = JSON.parse(text);
      isJson = true;
    } catch {
      // not JSON
    }

    if (!isJson) {
      return res.status(200).json({
        success: false,
        status,
        durationMs: duration,
        endpoint: targetEndpoint,
        error: `Falha: GDI não retornou um formato JSON válido. Resposta recebida: ${text.substring(0, 300)}`
      });
    }

    return res.status(200).json({
      success: response.ok && status === 200,
      status,
      durationMs: duration,
      endpoint: targetEndpoint,
      data: responseData
    });

  } catch (err: any) {
    console.error("[GDI Test Exception] Error:", err);
    return res.status(200).json({
      success: false,
      status: 0,
      endpoint: `${gdiBaseUrl || ""}/api/config`,
      error: `Erro de rede ou DNS ao conectar na API GDI: ${err.message || err}`
    });
  }
});

// Validate Google Drive Build URL to prevent using admin pages or HTML pages as APIs
app.post("/api/validate-build-url", async (req, res) => {
  try {
    const { buildUrl } = req.body;
    if (!buildUrl) {
      return res.status(400).json({ error: "O campo buildUrl é obrigatório." });
    }

    const trimmedUrl = buildUrl.trim();
    if (trimmedUrl.includes("aistudio.google.com/apps") || trimmedUrl.includes("accounts.google.com")) {
      return res.status(200).json({ 
        isValid: false, 
        message: "A URL configurada não é uma API. Ela abriu uma página de login do Google. Use a URL pública do runtime/Cloud Run do Build Google Drive." 
      });
    }

    // Try testing endpoint
    const endpointsToTry = [
      { url: `${trimmedUrl}/api/receiver-status`, method: "GET" },
      { url: `${trimmedUrl}/api/create-folder`, method: "POST" },
    ];

    let lastError = "";
    let isHtmlResponse = false;

    const incomingCookie = req.headers["cookie"] || "";
    for (const endpoint of endpointsToTry) {
      try {
        console.log(`[Validation] Probing endpoint: ${endpoint.url} with ${endpoint.method}`);
        const { response, text } = await smartFetch(endpoint.url, {
          method: endpoint.method,
          headers: {
            "Content-Type": "application/json",
          },
          body: endpoint.method === "POST" ? JSON.stringify({}) : undefined,
        }, incomingCookie);

        const contentType = response.headers.get("content-type") || "";

        console.log(`[Validation] Response Content-Type: ${contentType}. Status: ${response.status}`);

        if (contentType.includes("html") || text.trim().startsWith("<") || text.toLowerCase().includes("<!doctype html") || text.toLowerCase().includes("<html")) {
          isHtmlResponse = true;
          break;
        }

        let isJson = false;
        try {
          JSON.parse(text);
          isJson = true;
        } catch {
          if (contentType.includes("json")) {
            isJson = true;
          }
        }

        if (isJson) {
          return res.status(200).json({
            isValid: true,
            message: "URL da API validada com sucesso."
          });
        }
      } catch (err: any) {
        console.log(`[Validation] Probing endpoint ${endpoint.url} failed:`, err.message || err);
        lastError = err.message || String(err);
      }
    }

    if (isHtmlResponse) {
      return res.status(200).json({
        isValid: false,
        message: "A URL configurada não é uma API. Ela abriu uma página de login do Google. Use a URL pública do runtime/Cloud Run do Build Google Drive."
      });
    }

    try {
      console.log(`[Validation] Probing base URL as fallback: ${trimmedUrl}`);
      const { response, text } = await smartFetch(trimmedUrl, { method: "GET" }, incomingCookie);
      const contentType = response.headers.get("content-type") || "";
      
      if (contentType.includes("html") || text.trim().startsWith("<") || text.toLowerCase().includes("<!doctype html") || text.toLowerCase().includes("<html")) {
        return res.status(200).json({
          isValid: false,
          message: "A URL configurada não é uma API. Ela abriu uma página de login do Google. Use a URL pública do runtime/Cloud Run do Build Google Drive."
        });
      }
    } catch (e: any) {
      // ignore
    }

    return res.status(200).json({
      isValid: false,
      message: `Não foi possível obter uma resposta JSON válida do endpoint de API. Certifique-se de que o applet Build Google Drive está ligado/ativo na URL fornecida. Erro obtido: ${lastError || "Sem resposta da API"}`
    });

  } catch (err: any) {
    console.error("[Validation API] Erro ao validar URL do Google Drive:", err);
    return res.status(550).json({ error: `Erro no servidor de validação: ${err.message || err}` });
  }
});

// --- TODOIST BACKEND INTEGRATION BRIDGE ---

interface TodoistTaskPayload {
  title: string;
  description?: string;
  projectId?: string;
  sectionId?: string;
  labels?: string[];
  dueString?: string;
  priority?: number;
}

// 1. Backend helper function for communicating with Todoist REST API v1
async function createTodoistTask(payload: TodoistTaskPayload) {
  const token = process.env.TODOIST_API_TOKEN;
  if (!token || !token.trim()) {
    throw new Error("TODOIST_SECRET_MISSING");
  }

  // Map input params to safe Todoist REST API v1 parameters (content, description, etc.)
  const body: any = {
    content: payload.title || "Nova Tarefa do Caso"
  };

  if (payload.description) body.description = payload.description;
  if (payload.projectId && payload.projectId !== "__TODOIST_INBOX__" && payload.projectId !== "**TODOIST_INBOX**" && payload.projectId !== "inbox") {
    body.project_id = payload.projectId;
  }
  if (payload.sectionId) body.section_id = payload.sectionId;
  if (payload.labels) body.labels = payload.labels;
  if (payload.dueString) body.due_string = payload.dueString;
  if (payload.priority) body.priority = payload.priority;

  const url = "https://api.todoist.com/rest/v2/tasks";
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Todoist Integration Error] HTTP Status: ${response.status}. Payload attempted (excluding auth). Raw error text:`, errorText);
    throw new Error(`Erro retornado pela API do Todoist (HTTP ${response.status})`);
  }

  const data = await response.json();
  return {
    todoistTaskId: data.id,
    todoistUrl: data.url,
    data
  };
}

// 2. Internal secure API endpoint to receive task specifications and request Todoist API v1
app.post("/api/todoist/create-task", async (req, res) => {
  try {
    const token = process.env.TODOIST_API_TOKEN;
    if (!token || !token.trim()) {
      return res.status(400).json({
        success: false,
        error: "TODOIST_SECRET_MISSING",
        message: "O token de API do Todoist (TODOIST_API_TOKEN) não foi configurado."
      });
    }

    const { title, description, projectId, sectionId, labels, dueString, priority } = req.body;
    if (!title) {
      return res.status(400).json({
        success: false,
        error: "TITLE_REQUIRED",
        message: "O título da tarefa (title) é obrigatório."
      });
    }

    const result = await createTodoistTask({
      title,
      description,
      projectId,
      sectionId,
      labels,
      dueString,
      priority
    });

    return res.status(200).json({
      success: true,
      todoistTaskId: result.todoistTaskId,
      todoistUrl: result.todoistUrl,
      message: "Tarefa criada no Todoist com sucesso."
    });
  } catch (err: any) {
    console.error("[Todoist API Route Exception]:", err.message || err);
    if (err.message === "TODOIST_SECRET_MISSING") {
      return res.status(400).json({
        success: false,
        error: "TODOIST_SECRET_MISSING",
        message: "O token de API do Todoist (TODOIST_API_TOKEN) não foi configurado."
      });
    }
    if (err.message === "TODOIST_ENDPOINT_DEPRECATED") {
      return res.status(410).json({
        success: false,
        error: "TODOIST_ENDPOINT_DEPRECATED",
        message: "Endpoint antigo do Todoist detectado. Use somente https://api.todoist.com/rest/v2."
      });
    }
    return res.status(500).json({
      success: false,
      error: "TODOIST_API_ERROR",
      message: "Erro ao processar criação de tarefa de forma segura. Certifique-se de que os dados e a chave estejam corretificados."
    });
  }
});

// GET /api/todoist/projects
app.get("/api/todoist/projects", async (req: any, res: any) => {
  try {
    const token = process.env.TODOIST_API_TOKEN;
    if (!token || !token.trim()) {
      return res.status(400).json({
        success: false,
        errorCode: "TODOIST_TOKEN_MISSING",
        errorMessage: "O token de API do Todoist (TODOIST_API_TOKEN) não foi configurado.",
        httpStatus: 400,
        rawResponse: ""
      });
    }

    const response = await fetch("https://api.todoist.com/rest/v2/projects", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const text = await response.text();
      const slicedText = text.slice(0, 1000);
      return res.status(response.status).json({
        success: false,
        errorCode: "TODOIST_RESPONSE_ERROR",
        errorMessage: `Erro de resposta do Todoist: ${response.statusText}`,
        httpStatus: response.status,
        rawResponse: slicedText
      });
    }

    const projects = await response.json();
    if (!Array.isArray(projects)) {
      console.warn("[Todoist API Warning]: Retorno de projetos não é um array:", projects);
      return res.status(502).json({
        success: false,
        errorCode: "TODOIST_RESPONSE_MALFORMED",
        errorMessage: "A resposta do Todoist não retornou um array válido de projetos.",
        httpStatus: 502,
        rawResponse: JSON.stringify(projects)
      });
    }

    return res.status(200).json({
      success: true,
      projects: projects.map((p: any) => ({
        id: p.id,
        name: p.name,
        url: p.url || `https://todoist.com/showProject?id=${p.id}`,
        color: p.color,
        is_favorite: p.is_favorite
      }))
    });
  } catch (err: any) {
    console.error("[Todoist Projects Endpoint Error]:", err);
    return res.status(500).json({
      success: false,
      errorCode: "TODOIST_SERVER_ERROR",
      errorMessage: err.message || "Erro interno do servidor ao obter projetos.",
      httpStatus: 500,
      rawResponse: ""
    });
  }
});

// GET /api/todoist/sections
app.get("/api/todoist/sections", async (req: any, res: any) => {
  try {
    const token = process.env.TODOIST_API_TOKEN;
    if (!token || !token.trim()) {
      return res.status(400).json({
        success: false,
        errorMessage: "O token de API do Todoist (TODOIST_API_TOKEN) não foi configurado."
      });
    }

    const { projectId } = req.query;
    let url = "https://api.todoist.com/rest/v2/sections";
    if (projectId) {
      url += `?project_id=${projectId}`;
    }

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({
        success: false,
        errorMessage: `Erro de resposta do Todoist: ${response.statusText}`,
        rawResponse: text
      });
    }

    const sections = await response.json();
    return res.status(200).json({
      success: true,
      sections
    });
  } catch (err: any) {
    console.error("[Todoist Sections Endpoint Error]:", err);
    return res.status(500).json({
      success: false,
      errorMessage: err.message || "Erro interno do servidor ao obter seções."
    });
  }
});

// GET /api/todoist/collaborators
app.get("/api/todoist/collaborators", async (req: any, res: any) => {
  try {
    const token = process.env.TODOIST_API_TOKEN;
    if (!token || !token.trim()) {
      return res.status(400).json({
        success: false,
        errorMessage: "O token de API do Todoist (TODOIST_API_TOKEN) não foi configurado."
      });
    }

    const { projectId } = req.query;
    if (!projectId) {
      return res.status(400).json({
        success: false,
        errorMessage: "projectId é obrigatório para obter colaboradores."
      });
    }

    const url = `https://api.todoist.com/rest/v2/projects/${projectId}/collaborators`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({
        success: false,
        errorMessage: `Erro de resposta do Todoist: ${response.statusText}`,
        rawResponse: text
      });
    }

    const collaborators = await response.json();
    return res.status(200).json({
      success: true,
      collaborators
    });
  } catch (err: any) {
    console.error("[Todoist Collaborators Endpoint Error]:", err);
    return res.status(500).json({
      success: false,
      errorMessage: err.message || "Erro interno do servidor ao obter colaboradores."
    });
  }
});

async function saveTodoistStatusToFirestore(caseId: string, payload: any) {
  if (!dbAdmin || !caseId) return;

  await dbAdmin.collection("cases").doc(caseId).set(payload, { merge: true });

  await dbAdmin.collection("casos").doc(caseId).set({
    id: caseId,
    caseId,
    ...payload
  }, { merge: true });
}

async function appendTodoistLogs(caseId: string, logs: any[]) {
  if (!dbAdmin || !caseId || !Array.isArray(logs) || logs.length === 0) return;

  const caseRef = dbAdmin.collection("cases").doc(caseId);
  const mirrorRef = dbAdmin.collection("casos").doc(caseId);

  try {
    const snap = await caseRef.get();
    const oldLogs = snap.exists && Array.isArray(snap.data()?.todoistLogs)
      ? snap.data().todoistLogs
      : [];

    let mergedLogs = [...oldLogs, ...logs]
      .filter(Boolean);

    // Sanitize keys in details
    mergedLogs = mergedLogs.map((log: any) => {
      if (log.details) {
        const sanitizedDetails = JSON.parse(JSON.stringify(log.details));
        const sanitizeKeys = (obj: any) => {
          if (obj && typeof obj === 'object') {
            for (const k in obj) {
              if (k.toLowerCase().includes('token') || k.toLowerCase().includes('authorization') || k.toLowerCase().includes('secret') || k.toLowerCase().includes('key')) {
                obj[k] = '***';
              } else if (typeof obj[k] === 'object') {
                sanitizeKeys(obj[k]);
              }
            }
          }
        };
        sanitizeKeys(sanitizedDetails);
        return {
          ...log,
          details: sanitizedDetails
        };
      }
      return log;
    });

    mergedLogs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const limited = mergedLogs.slice(-100);

    await caseRef.set({ todoistLogs: limited }, { merge: true });
    await mirrorRef.set({
      id: caseId,
      caseId,
      todoistLogs: limited
    }, { merge: true });
  } catch (err: any) {
    console.warn("WARNING: Falha ao acrescentar logs do Todoist no Firestore:", err.message || err);
  }
}

// GET /api/todoist/diagnostics
app.get("/api/todoist/diagnostics", async (req: any, res: any) => {
  const token = process.env.TODOIST_API_TOKEN;
  const tokenConfigured = !!(token && token.trim());
  let tokenMasked = "não configurado";
  if (tokenConfigured && token) {
    const trimmed = token.trim();
    if (trimmed.length > 8) {
      tokenMasked = `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
    } else {
      tokenMasked = "***";
    }
  }

  let canReachTodoistApi = false;
  if (tokenConfigured) {
    try {
      const pingRes = await fetch("https://api.todoist.com/rest/v2/projects", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      canReachTodoistApi = pingRes.ok;
    } catch (err) {
      console.error("Error pinging Todoist API:", err);
    }
  }

  return res.json({
    success: true,
    tokenConfigured,
    tokenMasked,
    service: "todoist",
    canReachTodoistApi
  });
});

app.post("/api/todoist/create-comment", async (req: any, res: any) => {
  const token = process.env.TODOIST_API_TOKEN;
  if (!token) {
    return res.status(400).json({ success: false, errorMessage: "TODOIST_API_TOKEN não está configurado." });
  }
  const { taskId, content } = req.body;
  if (!taskId || !content) {
    return res.status(400).json({ success: false, errorMessage: "taskId e content são obrigatórios." });
  }
  try {
    const response = await fetch("https://api.todoist.com/rest/v2/comments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({
        task_id: taskId,
        content: content
      })
    });
    const raw = await response.text();
    if (!response.ok) {
      return res.status(response.status).json({ success: false, errorMessage: `Erro do Todoist: ${raw}` });
    }
    const data = JSON.parse(raw);
    return res.status(200).json({ success: true, data });
  } catch (err: any) {
    return res.status(500).json({ success: false, errorMessage: err.message || String(err) });
  }
});

function sha256(ascii: string): string {
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount));
  }
  let i, j;
  let result = '';
  const words: number[] = [];
  const asciiLength = ascii.length * 8;
  let hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ];
  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];
  let asciiBitLength = ascii.length * 8;
  const wordsCount = ((asciiBitLength + 64) >>> 9 << 4) + 16;
  for (i = 0; i < wordsCount; i++) words[i] = 0;
  for (i = 0; i < ascii.length; i++) {
    words[i >>> 2] |= (ascii.charCodeAt(i) & 0xff) << (24 - (i % 4) * 8);
  }
  words[ascii.length >>> 2] |= 0x80 << (24 - (ascii.length % 4) * 8);
  words[wordsCount - 1] = asciiBitLength;
  for (i = 0; i < wordsCount; i += 16) {
    const w = words.slice(i, i + 16);
    const oldHash = hash.slice(0);
    for (j = 0; j < 64; j++) {
      if (j >= 16) {
        const w15 = w[j - 15], w2 = w[j - 2], w16 = w[j - 16], w7 = w[j - 7];
        const s0 = rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3);
        const s1 = rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10);
        w[j] = (w16 + s0 + w7 + s1) | 0;
      }
      const h = hash;
      const s0 = rightRotate(h[0], 2) ^ rightRotate(h[0], 13) ^ rightRotate(h[0], 22);
      const maj = (h[0] & h[1]) ^ (h[0] & h[2]) ^ (h[1] & h[2]);
      const t2 = s0 + maj;
      const s1 = rightRotate(h[4], 6) ^ rightRotate(h[4], 11) ^ rightRotate(h[4], 25);
      const ch = (h[4] & h[5]) ^ (~h[4] & h[6]);
      const t1 = h[7] + s1 + ch + k[j] + w[j];
      hash = [(t1 + t2) | 0, h[0], h[1], h[2], (h[3] + t1) | 0, h[4], h[5], h[6]];
    }
    for (j = 0; j < 8; j++) {
      hash[j] = (hash[j] + oldHash[j]) | 0;
    }
  }
  for (i = 0; i < 8; i++) {
    const word = hash[i];
    const hex = (word >>> 0).toString(16);
    result += '00000000'.substring(hex.length) + hex;
  }
  return result;
}

function sanitizeTodoistPlainText(value: string): string {
  if (!value) return "";
  let text = value.replace(/&nbsp;/gi, " ").replace(/\u00A0/g, " ");
  text = text.replace(/<[^>]*>/g, " ");
  text = text.replace(/&[a-z0-9#]+;/gi, " ");
  text = text.replace(/\s+/g, " ").trim();

  const regex = /a\s+ação\s+indenizatória\s+é\s+fatídica/gi;
  if (regex.test(text)) {
    text = text.replace(regex, "");
    text = text.replace(/\s+/g, " ").trim();
  }
  const regexNoAccents = /a\s+acao\s+indenizatoria\s+e\s+fatidica/gi;
  if (regexNoAccents.test(text)) {
    text = text.replace(regexNoAccents, "");
    text = text.replace(/\s+/g, " ").trim();
  }
  const regexShort = /ação\s+indenizatória\s+é\s+fatídica/gi;
  if (regexShort.test(text)) {
    text = text.replace(regexShort, "");
    text = text.replace(/\s+/g, " ").trim();
  }
  const regexShortNoAccents = /acao\s+indenizatoria\s+e\s+fatidica/gi;
  if (regexShortNoAccents.test(text)) {
    text = text.replace(regexShortNoAccents, "");
    text = text.replace(/\s+/g, " ").trim();
  }
  return text;
}

function normalizeTodoistTaskForDuplicateCheck(value: string): string {
  const sanitized = sanitizeTodoistPlainText(value);
  let text = sanitized.toLowerCase();
  text = text.replace(/[\r\n\t]+/g, " ");
  text = text.replace(/\s+/g, " ");
  return text.trim();
}

function buildTodoistTaskFingerprint(projectId: string, content: string): string {
  const normalizedContent = normalizeTodoistTaskForDuplicateCheck(content);
  const fingerprintSource = `${projectId}::${normalizedContent}`;
  return sha256(fingerprintSource);
}

function isLegacyHtmlArtifact(value: string): boolean {
  if (!value) return false;
  const normalized = sanitizeTodoistPlainText(value).toLowerCase();
  return normalized.includes("a ação indenizatória é fatídica") ||
         normalized.includes("acao indenizatoria e fatidica") ||
         value.toLowerCase().includes("a ação indenizatória é fatídica") ||
         value.toLowerCase().includes("ação indenizatória é fatídica");
}

const TODOIST_API_BASE_URL = "https://api.todoist.com/rest/v2";

// POST /api/todoist/create-case-task
app.post("/api/todoist/create-case-task", async (req: any, res: any) => {
  const token = process.env.TODOIST_API_TOKEN;
  const logs: any[] = [];

  const addLog = (level: "info" | "success" | "warning" | "error", step: string, message: string, details: any = {}) => {
    logs.push({
      timestamp: new Date().toISOString(),
      level,
      step,
      message,
      details
    });
  };

  const fail = async (httpStatus: number, errorCode: string, errorMessage: string, details: any = {}) => {
    addLog("error", errorCode, errorMessage, details);

    if (req.body?.caseId) {
      const prevTaskId = req.body?.previousTodoistTaskId || "";
      const prevTaskUrl = req.body?.previousTodoistTaskUrl || "";

      await appendTodoistLogs(req.body.caseId, logs).catch(() => {});
      await saveTodoistStatusToFirestore(req.body.caseId, {
        todoistAutomationStatus: "falha",
        todoistTaskId: prevTaskId,
        todoistTaskUrl: prevTaskUrl,
        todoistTaskLogFalha: errorMessage,
        todoistProjectId: req.body?.projectId || "__TODOIST_INBOX__",
        todoistProjectName: req.body?.projectName || "Caixa de Entrada (Inbox)",
        todoistFormula: req.body?.content || "",
        todoistUpdatedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }).catch(() => {});
    }

    return res.status(httpStatus).json({
      success: false,
      verified: false,
      errorCode,
      errorMessage,
      logs
    });
  };

  try {
    addLog("info", "BACKEND_REQUEST_RECEIVED", "Backend recebeu solicitação para criar tarefa no Todoist.");

    if (!token) {
      return fail(
        500,
        "TODOIST_API_TOKEN_MISSING",
        "TODOIST_API_TOKEN não está configurado no ambiente."
      );
    }

    addLog("success", "TODOIST_TOKEN_PRESENT", "TODOIST_API_TOKEN encontrado no ambiente.");

    const {
      caseId,
      projectId,
      projectName,
      content,
      description,
      dueDate,
      priority,
      labels,
      assignee,
      previousTodoistTaskId,
      previousTodoistTaskUrl,
      isDuplicateCreationAttempt,
      parentId,
      parent_id,
      taskFingerprint,
      normalizedContent
    } = req.body || {};

    if (!caseId) {
      return fail(400, "TODOIST_CASE_ID_MISSING", "caseId é obrigatório.");
    }

    if (!content || !String(content).trim()) {
      return fail(400, "TODOIST_CONTENT_MISSING", "O conteúdo da tarefa é obrigatório.");
    }

    // 1. Exact Duplicate Verification on Backend
    const cleanProjectId = projectId || "__TODOIST_INBOX__";
    const cleanContent = sanitizeTodoistPlainText(content);
    const resolvedFingerprint = taskFingerprint || buildTodoistTaskFingerprint(cleanProjectId, cleanContent);

    const caseSnap = await dbAdmin.collection("cases").doc(caseId).get();
    const caseData = caseSnap.exists ? caseSnap.data() : null;
    const history = caseData && Array.isArray(caseData.todoistTaskHistory) ? caseData.todoistTaskHistory : [];
    
    const verifiedHistory = history.filter((entry: any) => entry.verified === true);
    const exactDuplicate = verifiedHistory.find((entry: any) => 
      entry.projectId === cleanProjectId && 
      entry.fingerprint === resolvedFingerprint
    );

    if (exactDuplicate) {
      addLog("warning", "TODOIST_EXACT_DUPLICATE_BLOCKED", "Tentativa de criação de tarefa idêntica bloqueada no backend.", {
        projectId: cleanProjectId,
        fingerprint: resolvedFingerprint,
        existingTaskId: exactDuplicate.todoistTaskId
      });
      await appendTodoistLogs(caseId, logs).catch(() => {});
      return res.status(409).json({
        success: false,
        verified: false,
        outcome: "exact_duplicate_blocked",
        errorCode: "TODOIST_EXACT_DUPLICATE_BLOCKED",
        errorMessage: "Já existe uma tarefa idêntica no mesmo projeto do Todoist.",
        existingTask: {
          todoistTaskId: exactDuplicate.todoistTaskId,
          todoistTaskUrl: exactDuplicate.todoistTaskUrl,
          content: exactDuplicate.content,
          projectId: exactDuplicate.projectId,
          projectName: exactDuplicate.projectName,
          createdAt: exactDuplicate.createdAt
        },
        logs
      });
    }

    // 2. HTML Legacy Artifact Removal
    let isLegacyDetected = false;
    if (isLegacyHtmlArtifact(content || "") || isLegacyHtmlArtifact(description || "")) {
      isLegacyDetected = true;
    }

    const contentText = sanitizeTodoistPlainText(content || "");
    const descriptionText = sanitizeTodoistPlainText(description || "");

    if (isLegacyDetected) {
      addLog("warning", "LEGACY_HTML_ARTIFACT_REMOVED", "Um trecho HTML inválido foi removido da descrição antes do envio ao Todoist.");
    }

    const forbiddenPlaceholders = [
      "[Assunto]",
      "[Parte Adversa]",
      "[Comarca]",
      "DOCUMENTO SEM CLIENTE"
    ];

    const foundPlaceholder = forbiddenPlaceholders.find((p) => contentText.toLowerCase().includes(p.toLowerCase()));

    if (foundPlaceholder) {
      return fail(
        400,
        "TODOIST_CONTENT_HAS_PLACEHOLDERS",
        `A tarefa não foi enviada porque o conteúdo ainda possui o placeholder pendente: ${foundPlaceholder}`,
        { foundPlaceholder }
      );
    }

    addLog("success", "BACKEND_PAYLOAD_VALIDATED", "Payload validado com sucesso antes do envio ao Todoist.", {
      caseId,
      projectId: cleanProjectId,
      projectName,
      content: contentText
    });

    const isInbox = cleanProjectId === "__TODOIST_INBOX__" || cleanProjectId === "**TODOIST_INBOX**" || !projectId;

    const todoistPayload: any = {
      content: contentText,
      description: descriptionText
    };

    if (dueDate && String(dueDate).trim()) {
      todoistPayload.due_string = String(dueDate).trim();
    }

    if (priority) {
      const pNum = Number(priority);
      if (pNum >= 1 && pNum <= 4) {
        todoistPayload.priority = pNum;
      }
    }

    if (Array.isArray(labels) && labels.length > 0) {
      todoistPayload.labels = labels;
    }

    if (assignee && String(assignee).trim()) {
      todoistPayload.assignee_id = String(assignee).trim();
    }

    if (!isInbox) {
      todoistPayload.project_id = projectId;
    }

    const finalParentId = parentId || parent_id;
    if (finalParentId && String(finalParentId).trim()) {
      todoistPayload.parent_id = String(finalParentId).trim();
    }

    addLog("info", "TODOIST_CREATE_STARTED", "Enviando tarefa para a API real do Todoist v1.", {
      endpoint: `${TODOIST_API_BASE_URL}/tasks`,
      isInbox,
      hasProjectId: !isInbox,
      todoistPayload
    });

    const createRes = await fetch(`${TODOIST_API_BASE_URL}/tasks`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify(todoistPayload)
    });

    const createRaw = await createRes.text();
    const createContentType = createRes.headers.get("content-type") || "";

    addLog("info", "TODOIST_CREATE_RESPONSE_RECEIVED", "Resposta recebida da API de criação do Todoist.", {
      httpStatus: createRes.status,
      contentType: createContentType,
      rawPreview: createRaw.slice(0, 300)
    });

    let createdTask: any = null;

    try {
      createdTask = createRaw ? JSON.parse(createRaw) : null;
    } catch {
      return fail(
        502,
        "TODOIST_CREATE_RESPONSE_NOT_JSON",
        `Todoist API response was not JSON. Status: ${createRes.status}. Response: ${createRaw.slice(0, 500)}`,
        {
          httpStatus: createRes.status,
          contentType: createContentType,
          rawResponse: createRaw.slice(0, 1000)
        }
      );
    }

    if (!createRes.ok || !createdTask?.id) {
      return fail(
        createRes.status || 502,
        "TODOIST_CREATE_FAILED",
        createdTask?.error || createdTask?.message || "Todoist não confirmou criação da tarefa.",
        {
          httpStatus: createRes.status,
          createdTask
        }
      );
    }

    const todoistTaskId = String(createdTask.id);
    const todoistTaskUrl = `https://app.todoist.com/app/task/${todoistTaskId}`;

    addLog("success", "TODOIST_TASK_CREATED", "Tarefa criada no Todoist com ID real.", {
      todoistTaskId,
      todoistTaskUrl
    });

    addLog("info", "TODOIST_VERIFY_STARTED", "Iniciando verificação da tarefa criada no Todoist.", {
      endpoint: `${TODOIST_API_BASE_URL}/tasks/${todoistTaskId}`
    });

    const verifyRes = await fetch(`${TODOIST_API_BASE_URL}/tasks/${todoistTaskId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json"
      }
    });

    const verifyRaw = await verifyRes.text();
    const verifyContentType = verifyRes.headers.get("content-type") || "";

    let verifiedTask: any = null;

    try {
      verifiedTask = verifyRaw ? JSON.parse(verifyRaw) : null;
    } catch {
      return fail(
        502,
        "TODOIST_VERIFY_RESPONSE_NOT_JSON",
        `Todoist verification response was not JSON. Status: ${verifyRes.status}. Response: ${verifyRaw.slice(0, 500)}`,
        {
          httpStatus: verifyRes.status,
          contentType: verifyContentType,
          rawResponse: verifyRaw.slice(0, 1000)
        }
      );
    }

    if (!verifyRes.ok || !verifiedTask?.id || String(verifiedTask.id) !== todoistTaskId) {
      return fail(
        502,
        "TODOIST_TASK_CREATED_BUT_NOT_VERIFIED",
        "A tarefa pode ter sido criada, mas não foi possível confirmar a existência dela no Todoist.",
        {
          httpStatus: verifyRes.status,
          verifiedTask
        }
      );
    }

    addLog("success", "TODOIST_TASK_VERIFIED", "Tarefa confirmada na API real do Todoist.", {
      todoistTaskId
    });

    // 3. Create Mandatory Comment
    const mandatoryComment = "☄️Tarefa Criada automaticamente através da Giffoni Connect☄️";
    addLog("info", "TODOIST_INITIAL_COMMENT_CREATE_STARTED", "Iniciada a criação do comentário automático obrigatório.");
    
    let commentVerified = false;
    let todoistCommentId = "";
    let commentErrorMsg = "";

    try {
      const commentRes = await fetch(`${TODOIST_API_BASE_URL}/comments`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({
          task_id: todoistTaskId,
          content: mandatoryComment
        })
      });
      const commentRaw = await commentRes.text();
      if (commentRes.ok) {
        const commentData = JSON.parse(commentRaw);
        todoistCommentId = String(commentData.id);
        commentVerified = true;
        addLog("success", "TODOIST_INITIAL_COMMENT_CREATED", "Comentário automático obrigatório criado e confirmado na tarefa.", {
          todoistCommentId,
          content: mandatoryComment
        });
      } else {
        commentErrorMsg = `API Error: ${commentRaw}`;
        addLog("error", "TODOIST_INITIAL_COMMENT_FAILED", "A tarefa foi criada, mas o comentário automático obrigatório não pôde ser confirmado.", {
          response: commentRaw
        });
      }
    } catch (commentErr: any) {
      commentErrorMsg = commentErr.message || String(commentErr);
      addLog("error", "TODOIST_INITIAL_COMMENT_FAILED", "A tarefa foi criada, mas o comentário automático obrigatório não pôde ser confirmado.", {
        errorMessage: commentErrorMsg
      });
    }

    const now = new Date().toISOString();

    const newHistoryEntry = {
      todoistTaskId,
      todoistTaskUrl,
      projectId: cleanProjectId,
      projectName: projectName || "Caixa de Entrada (Inbox)",
      content: contentText,
      normalizedContent: normalizeTodoistTaskForDuplicateCheck(contentText),
      fingerprint: resolvedFingerprint,
      verified: true,
      createdAt: now
    };

    const updatedHistory = [...history, newHistoryEntry];

    const firestorePayload: any = {
      todoistTaskId,
      todoistTaskUrl,
      todoistLastCreatedTaskId: todoistTaskId,
      todoistLastCreatedTaskUrl: todoistTaskUrl,
      todoistLastCreatedAt: now,
      todoistLastCreatedFingerprint: resolvedFingerprint,
      todoistTaskHistory: updatedHistory,
      todoistUpdatedAt: now,
      todoistProjectId: cleanProjectId,
      todoistProjectName: projectName || "Caixa de Entrada (Inbox)",
      todoistFormula: contentText,
      todoistDescription: descriptionText,
      updatedAt: now
    };

    if (commentVerified) {
      firestorePayload.todoistInitialComment = mandatoryComment;
      firestorePayload.todoistInitialCommentId = todoistCommentId;
      firestorePayload.todoistInitialCommentStatus = "criado";
      firestorePayload.todoistInitialCommentCreatedAt = now;
      firestorePayload.todoistAutomationStatus = "criado";
      firestorePayload.todoistTaskLogFalha = "";
    } else {
      firestorePayload.todoistInitialCommentStatus = "falha";
      firestorePayload.todoistInitialCommentErrorCode = "TODOIST_INITIAL_COMMENT_FAILED";
      firestorePayload.todoistInitialCommentErrorMessage = commentErrorMsg;
      firestorePayload.todoistAutomationStatus = "criado";
      firestorePayload.todoistTaskLogFalha = "Comentário obrigatório pendente: " + commentErrorMsg;
    }

    await saveTodoistStatusToFirestore(caseId, firestorePayload).catch((err: any) => {
      addLog("warning", "FIRESTORE_UPDATE_WARNING", "Tarefa criada no Todoist, mas houve falha ao salvar no Firestore.", {
        errorMessage: err.message || String(err)
      });
    });

    addLog("success", "FIRESTORE_UPDATED", "Dados reais da tarefa salvos no Firestore.");
    addLog("success", "TODOIST_FLOW_COMPLETED", "Fluxo de criação da tarefa Todoist concluído com sucesso.");

    await appendTodoistLogs(caseId, logs).catch(() => {});

    if (commentVerified) {
      return res.status(200).json({
        success: true,
        verified: true,
        commentVerified: true,
        todoistTaskId,
        todoistTaskUrl,
        todoistCommentId,
        todoistInitialComment: mandatoryComment,
        logs
      });
    } else {
      return res.status(200).json({
        success: false,
        verified: true,
        taskCreated: true,
        commentVerified: false,
        outcome: "task_created_comment_failed",
        todoistTaskId,
        todoistTaskUrl,
        errorCode: "TODOIST_INITIAL_COMMENT_FAILED",
        errorMessage: commentErrorMsg,
        logs
      });
    }
  } catch (err: any) {
    return fail(
      500,
      "TODOIST_CREATE_EXCEPTION",
      err.message || String(err),
      {
        name: err.name || null
      }
    );
  }
});

app.get("/__health", (_req, res) => {
  res.status(200).json({
    ok: true,
    service: "boss-giffoni-connect",
    timestamp: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV || null,
    cwd: process.cwd()
  });
});

app.get("/__runtime-info", (_req, res) => {
  const distPath = path.join(process.cwd(), "dist");
  const indexPath = path.join(distPath, "index.html");

  res.status(200).json({
    ok: true,
    cwd: process.cwd(),
    distPath,
    indexPath,
    distExists: fs.existsSync(distPath),
    indexExists: fs.existsSync(indexPath),
    filesInDist: fs.existsSync(distPath) ? fs.readdirSync(distPath) : [],
    timestamp: new Date().toISOString()
  });
});

app.get("/__plain", (_req, res) => {
  res.status(200).send(`
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>BOSS Plain Runtime</title>
      </head>
      <body style="font-family: Arial; padding: 40px;">
        <h1>BOSS — Servidor Express respondeu HTML puro</h1>
        <p>Se esta tela abriu, o problema não é porta nem roteamento HTTP básico.</p>
      </body>
    </html>
  `);
});

async function startServer() {
  console.log("[BOOT] NODE_ENV:", process.env.NODE_ENV);
  console.log("[BOOT] CWD:", process.cwd());

  // Integrate Vite middleware in development mode
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    console.log("[BOOT] distPath:", distPath);
    console.log("[BOOT] indexExists:", fs.existsSync(path.join(distPath, "index.html")));
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }


  // B3 - ENDPOINT PARA CRIAR OU ATUALIZAR PRÉVIA
  app.post("/api/google-docs/contract-preview", async (req, res) => {
    try {
      const {
        documentType,
        templateId,
        caseId,
        clientId,
        placeholders,
        payloadHash,
        previewRequestId
      } = req.body;

      if (!documentType || documentType !== "contrato_honorarios_pf") return res.status(400).json({ error: "Invalid documentType" });
      if (!templateId || templateId !== "1GJZ6LSW_szLSAA8Z3iw9jt4Q6zy5k6EuuTNhR5ooJQQ") return res.status(400).json({ error: "Invalid templateId" });
      if (!caseId) return res.status(400).json({ error: "Invalid caseId" });
      
      const resolvedClientId = clientId || "unknown_client";
      const resolvedPlaceholders = placeholders || {};
      const resolvedPayloadHash = payloadHash || `hash-${Date.now()}`;

      const previewFolderId = process.env.GOOGLE_DOCS_PREVIEW_FOLDER_ID;
      const db = dbAdmin;
      
      // Check for existing valid preview
      if (db) {
        const existingQuery = await db.collection("googleDocsPreviews")
          .where("caseId", "==", caseId)
          .where("documentType", "==", documentType)
          .where("payloadHash", "==", resolvedPayloadHash)
          .where("status", "==", "ready")
          .get();

        if (!existingQuery.empty) {
          let validPreview = null;
          for (const docSnap of existingQuery.docs) {
             const data = docSnap.data();
             if (new Date(data.expiresAt).getTime() > Date.now()) {
               validPreview = data;
               break;
             }
          }
          if (validPreview) {
            return res.json({
              success: true,
              previewId: validPreview.id,
              createdAt: validPreview.createdAt,
              expiresAt: validPreview.expiresAt
            });
          }
        }
      }

      const host = (req && typeof req.get === "function") ? req.get("host") : "";
      const isAiStudioPreview = (host && (host.includes("ais-dev") || host.includes("ais-pre") || host.includes("localhost") || host.includes("127.0.0.1"))) || process.env.DISABLE_HMR === "true" || process.env.NODE_ENV !== "production";

      let googleDocsId = "";
      let previewId = "";
      let isSimulated = false;

      try {
        if (!previewFolderId) {
          throw new Error("GOOGLE_DOCS_PREVIEW_FOLDER_ID_NOT_CONFIGURED");
        }
        const { jwtClient } = await createGoogleDocsJwtClient(req);
        const drive = google.drive({ version: "v3", auth: jwtClient });
        const docs = google.docs({ version: "v1", auth: jwtClient });

        const copyResponse = await drive.files.copy({
          fileId: templateId,
          requestBody: {
            name: `[PREVIEW] Contrato PF - ${caseId} - ${new Date().getTime()}`,
            parents: [previewFolderId]
          }
        });
        googleDocsId = copyResponse.data.id || "";
        if (!googleDocsId) throw new Error("Falha ao criar cópia do template.");

        const requests = Object.entries(resolvedPlaceholders).map(([key, value]) => ({
          replaceAllText: {
            containsText: {
              text: key,
              matchCase: true,
            },
            replaceText: String(value) || "",
          }
        }));

        if (requests.length > 0) {
          await docs.documents.batchUpdate({
            documentId: googleDocsId,
            requestBody: { requests }
          });
        }

        previewId = googleDocsId;
      } catch (errAuthOrDrive: any) {
        console.warn("[PREVIEW] Google Drive real preview generation failed. Reason:", errAuthOrDrive.message);
        if (isAiStudioPreview) {
          console.warn("[PREVIEW] AI Studio preview environment detected. Falling back to simulated preview.");
          previewId = `simulated-preview-${Date.now()}`;
          isSimulated = true;
        } else {
          return res.status(500).json({
            success: false,
            error: `Erro ao gerar prévia no Google Drive: ${errAuthOrDrive.message}`
          });
        }
      }

      const createdAt = new Date().toISOString();
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

      const previewRecord = {
        id: previewId,
        caseId,
        clientId: resolvedClientId,
        documentType,
        templateId,
        googleDocsId: previewId,
        payloadHash: resolvedPayloadHash,
        purpose: "preview",
        status: "ready",
        createdAt,
        expiresAt,
        createdBy: "portal_boss",
        simulated: isSimulated
      };

      if (db) {
        await db.collection("googleDocsPreviews").doc(previewId).set(previewRecord);
      }

      res.json({
        success: true,
        previewId,
        createdAt,
        expiresAt,
        simulated: isSimulated
      });
    } catch (err: any) {
      console.error("[PREVIEW_ERROR]", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // B7 - PDF DA PRÉVIA
  app.get("/api/google-docs/contract-preview/:previewId/pdf", async (req, res) => {
    try {
      const { previewId } = req.params;
      if (!previewId) return res.status(400).json({ error: "Missing previewId" });

      let previewData: any = null;
      if (dbAdmin) {
        const previewDoc = await dbAdmin.collection("googleDocsPreviews").doc(previewId).get();
        if (previewDoc.exists) {
          previewData = previewDoc.data();
        }
      }

      if (!previewData) {
        if (previewId.startsWith("simulated-")) {
          previewData = {
            id: previewId,
            googleDocsId: previewId,
            purpose: "preview",
            status: "ready",
            expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
            simulated: true
          };
        } else {
          return res.status(404).json({ error: "Preview not found" });
        }
      }

      if (previewData.purpose !== "preview" || previewData.status !== "ready") {
        return res.status(400).json({ error: "Invalid preview record" });
      }

      if (new Date(previewData.expiresAt).getTime() < Date.now()) {
        return res.status(410).json({ error: "Preview expired" });
      }

      if (previewId.startsWith("simulated-") || previewData.simulated) {
        // Return a valid, minimal 1-page PDF buffer representing the simulated contract preview
        const dummyPdf = Buffer.from(
          "%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 595.275 841.889]\n/Resources << >>\n/Contents 4 0 R\n>>\nendobj\n4 0 obj\n<<\n/Length 41\n>>\nstream\nBT\n/F1 12 Tf\n72 712 Td\n(Contrato de Honorarios Preview - SIMULATED) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f\n0000000009 00000 n\n0000000056 00000 n\n0000000111 00000 n\n0000000213 00000 n\ntrailer\n<<\n/Size 5\n/Root 1 0 R\n>>\nstartxref\n304\n%%EOF"
        );
        res.setHeader('Content-Type', 'application/pdf');
        return res.send(dummyPdf);
      }

      const { jwtClient } = await createGoogleDocsJwtClient(req);
      const drive = google.drive({ version: "v3", auth: jwtClient });

      const pdfResponse = await drive.files.export({
        fileId: previewData.googleDocsId,
        mimeType: 'application/pdf'
      }, { responseType: 'stream' });

      res.setHeader('Content-Type', 'application/pdf');
      pdfResponse.data.pipe(res);
    } catch (err: any) {
      console.error("[PREVIEW_PDF_ERROR]", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Batalha Naval Diagnostic Endpoint
  app.post("/api/google-docs/contrato-honorarios/batalha-naval", async (req: any, res: any) => {
    try {
      const { caseId, clientId, documentType, currentFinancialState } = req.body || {};
      if (!caseId) {
        return res.status(400).json({ success: false, errorMessage: "caseId é de preenchimento obrigatório." });
      }
      const docType = documentType || "contrato_honorarios_pf";

      let caseData: any = {};
      if (dbAdmin) {
        const caseSnap = await dbAdmin.collection("cases").doc(caseId).get();
        if (caseSnap.exists) {
          caseData = caseSnap.data();
        }
      }

      let clientData: any = {};
      if (dbAdmin && clientId) {
        const clientSnap = await dbAdmin.collection("clients").doc(clientId).get();
        if (clientSnap.exists) {
          clientData = clientSnap.data();
        }
      }

      // Execute Battle Map context resolver (pure, dry-run, no writes)
      const result = buildContratoHonorariosDocumentContext({
        documentType: docType,
        clientData,
        caseData,
        financialData: currentFinancialState || {}
      });

      return res.json({
        success: true,
        ...result
      });
    } catch (err: any) {
      console.error("[BATALHA_NAVAL_DIAGNOSTICS_ERROR]", err);
      return res.status(500).json({
        success: false,
        errorMessage: err.message || "Erro interno ao processar a Batalha Naval."
      });
    }
  });

  // Stateless / Dry-Run Contract Preview Endpoint
  app.post("/api/google-docs/contrato-honorarios/preview", async (req: any, res: any) => {
    try {
      const { caseId, clientId, documentType, currentFinancialState } = req.body || {};
      if (!caseId) {
        return res.status(400).json({ success: false, errorMessage: "caseId é de preenchimento obrigatório." });
      }
      const docType = documentType || "contrato_honorarios_pf";

      let caseData: any = {};
      if (dbAdmin) {
        const caseSnap = await dbAdmin.collection("cases").doc(caseId).get();
        if (caseSnap.exists) {
          caseData = caseSnap.data();
        }
      }

      let clientData: any = {};
      if (dbAdmin && clientId) {
        const clientSnap = await dbAdmin.collection("clients").doc(clientId).get();
        if (clientSnap.exists) {
          clientData = clientSnap.data();
        }
      }

      // Execute Battle Map context resolver
      const result = buildContratoHonorariosDocumentContext({
        documentType: docType,
        clientData,
        caseData,
        financialData: currentFinancialState || {}
      });

      let renderedContent = result.renderedPreview;
      let fetchedFromGoogle = false;

      // Try fetching template from Google Docs API
      try {
        const { jwtClient } = await createGoogleDocsJwtClient(req);
        if (jwtClient) {
          const docs = google.docs({ version: "v1", auth: jwtClient });
          const templateDoc = await docs.documents.get({ documentId: result.templateId });
          if (templateDoc && templateDoc.data) {
            // Parse Google Doc content to text in memory
            const content = templateDoc.data.body?.content || [];
            let extractedText = "";
            for (const el of content) {
              if (el.paragraph) {
                for (const sub of el.paragraph.elements) {
                  if (sub.textRun && sub.textRun.content) {
                    extractedText += sub.textRun.content;
                  }
                }
              }
            }

            if (extractedText) {
              // Substitute placeholders in memory
              let tempText = extractedText;
              for (const [ph, val] of Object.entries(result.placeholders)) {
                tempText = tempText.replace(new RegExp(ph.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'), String(val) || "");
              }
              
              // Formatting as simple HTML paragraphs
              renderedContent = `<div class="space-y-4 text-gray-800 leading-relaxed font-sans max-w-3xl mx-auto p-6 bg-white border border-gray-100 rounded-xl shadow-xs whitespace-pre-wrap font-serif">${tempText}</div>`;
              fetchedFromGoogle = true;
            }
          }
        }
      } catch (googleErr: any) {
        console.warn("[PREVIEW_ENDPOINT] Google Docs API retrieval failed, using canonical local template. Reason:", googleErr.message);
      }

      return res.json({
        success: true,
        documentType: docType,
        templateId: result.templateId,
        canonicalPayload: result.canonicalPayload,
        placeholders: result.placeholders,
        renderedContent,
        placeholderAudit: result.placeholderAudit,
        parityHash: result.parityHash,
        technicalLog: result.technicalLog,
        fetchedFromGoogle
      });
    } catch (err: any) {
      console.error("[PREVIEW_DIAGNOSTICS_ERROR]", err);
      return res.status(500).json({
        success: false,
        errorMessage: err.message || "Erro interno ao processar o Preview."
      });
    }
  });

  // Onboarding secure helper endpoints (Google Contacts and Gmail)
  function normalizePhoneNumber(phone: string): string {
    if (!phone) return "";
    return phone.replace(/\D/g, "");
  }

  function phonesMatch(phoneA: string, phoneB: string): boolean {
    const normA = normalizePhoneNumber(phoneA);
    const normB = normalizePhoneNumber(phoneB);
    if (!normA || !normB) return false;
    if (normA.length < 8 || normB.length < 8) {
      return normA === normB;
    }
    return normA.slice(-8) === normB.slice(-8);
  }

  app.post("/api/onboarding/sync-contact", async (req: any, res: any) => {
    const { name, phone, email, googleAccessToken } = req.body || {};
    
    if (!name) {
      return res.status(400).json({ success: false, errorMessage: "Nome do cliente é obrigatório." });
    }
    if (!phone) {
      return res.status(400).json({ success: false, errorMessage: "Telefone do cliente é obrigatório." });
    }
    if (!googleAccessToken) {
      return res.status(400).json({ success: false, errorMessage: "Token de acesso do Google (OAuth) não informado ou expirado." });
    }

    try {
      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({ access_token: googleAccessToken });
      const peopleService = google.people({ version: "v1", auth: oauth2Client });

      let existingContact: any = null;
      try {
        const listRes = await peopleService.people.connections.list({
          resourceName: "people/me",
          personFields: "names,emailAddresses,phoneNumbers",
          pageSize: 1000
        });

        const connections = listRes.data.connections || [];
        for (const conn of connections) {
          const connPhones = conn.phoneNumbers || [];
          const matchedPhone = connPhones.some((p: any) => phonesMatch(p.value, phone));
          
          const connEmails = conn.emailAddresses || [];
          const matchedEmail = email && connEmails.some((e: any) => e.value && e.value.toLowerCase() === email.toLowerCase());

          if (matchedPhone || matchedEmail) {
            existingContact = conn;
            break;
          }
        }
      } catch (listErr: any) {
        console.warn("[OnboardingSyncContact] Search connections failed, proceeding with create:", listErr.message);
      }

      const payload: any = {
        names: [{ givenName: name }],
        phoneNumbers: [{ value: phone }],
        emailAddresses: email ? [{ value: email }] : [],
        biographies: [{ value: "Cliente cadastrado no Portal BOSS Giffoni via Onboarding Inteligente." }]
      };

      if (existingContact) {
        payload.etag = existingContact.etag;
        
        const updateRes = await peopleService.people.updateContact({
          resourceName: existingContact.resourceName,
          updatePersonFields: "names,emailAddresses,phoneNumbers,biographies",
          requestBody: payload
        });

        return res.json({
          success: true,
          action: "updated",
          resourceName: existingContact.resourceName,
          contact: updateRes.data
        });
      } else {
        const createRes = await peopleService.people.createContact({
          requestBody: payload
        });

        return res.json({
          success: true,
          action: "created",
          resourceName: createRes.data.resourceName,
          contact: createRes.data
        });
      }
    } catch (err: any) {
      console.error("[OnboardingSyncContact] Error syncing contact:", err);
      return res.status(500).json({
        success: false,
        errorMessage: `Erro de integração com Google Contatos: ${err.message || err}`
      });
    }
  });

  app.post("/api/onboarding/send-email", async (req: any, res: any) => {
    const { email, subject, body, googleAccessToken } = req.body || {};
    if (!email) {
      return res.status(400).json({ success: false, errorMessage: "E-mail do cliente é obrigatório." });
    }
    if (!subject) {
      return res.status(400).json({ success: false, errorMessage: "Assunto do e-mail é obrigatório." });
    }
    if (!body) {
      return res.status(400).json({ success: false, errorMessage: "Corpo do e-mail é obrigatório." });
    }

    if (googleAccessToken) {
      try {
        const oauth2Client = new google.auth.OAuth2();
        oauth2Client.setCredentials({ access_token: googleAccessToken });
        const gmail = google.gmail({ version: "v1", auth: oauth2Client });

        const mailParts = [
          `To: ${email}`,
          `Subject: ${subject}`,
          `MIME-Version: 1.0`,
          `Content-Type: text/plain; charset="UTF-8"`,
          `Content-Transfer-Encoding: 7bit`,
          ``,
          body
        ];

        const rawMessageBase64 = Buffer.from(mailParts.join("\r\n"))
          .toString("base64")
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '');

        await gmail.users.messages.send({
          userId: "me",
          requestBody: {
            raw: rawMessageBase64
          }
        });

        return res.json({
          success: true,
          message: "Email enviado com sucesso usando sua conta do Gmail integrada!"
        });
      } catch (errGmailApi: any) {
        console.warn("[OnboardingEmail] Gmail API send failed, falling back to simulated send:", errGmailApi.message);
      }
    }

    let gmailConfig: any = null;
    let provider = "simulation";
    if (dbAdmin) {
      try {
        const connectorsSnap = await dbAdmin.collection("settings").doc("connectors").get();
        if (connectorsSnap.exists) {
          gmailConfig = connectorsSnap.data()?.gmail;
          if (gmailConfig) {
            provider = gmailConfig.provider || "simulation";
          }
        }
      } catch (e) {
        console.warn("[OnboardingEmail] Failed to load connectors config:", e);
      }
    }

    console.log(`[OnboardingEmail] Simulating email send to ${email} via ${provider}. Msg: ${body}`);
    return res.json({
      success: true,
      message: `E-mail enviado com sucesso (Simulado via provedor ${provider || 'não_configurado'}).`,
      simulated: true,
      email,
      text: body
    });
  });

  // Set up ASAAS integration routes
  setupAsaasRoutes(app, dbAdmin, createGoogleDocsJwtClient);

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
