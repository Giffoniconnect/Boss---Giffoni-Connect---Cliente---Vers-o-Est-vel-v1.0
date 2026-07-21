import * as admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

async function run() {
  console.log("--- FIRESTORE DIAGNOSTIC START ---");
  
  // 1. Load config
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (!fs.existsSync(configPath)) {
    console.error("firebase-applet-config.json not found!");
    return;
  }
  const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  const firestoreDatabaseId = config.firestoreDatabaseId || "ai-studio-ffebafe8-f1b5-4749-87a5-7b28a5c05e6c";
  const projectId = config.projectId || "planar-granite-495814-r8";

  console.log(`Project ID: ${projectId}`);
  console.log(`Database ID: ${firestoreDatabaseId}`);

  // 2. Initialize Firebase Admin
  let serviceAccount: any = null;
  if (process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON) {
    serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON);
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    serviceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
  }

  if (serviceAccount && serviceAccount.private_key) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
  }

  const options: any = {
    projectId: projectId,
  };

  if (serviceAccount) {
    options.credential = admin.credential.cert(serviceAccount);
  } else {
    console.log("No service account credentials found in environment. Using default credentials.");
  }

  const adminProps = (admin as any);
  const adminSdk = adminProps?.initializeApp ? admin : (adminProps?.default || admin);

  // Initialize admin app
  const app = adminSdk.initializeApp(options, "diagnostic-app");
  const db = adminSdk.firestore(app);
  // Set databaseId
  if (db.settings) {
    db.settings({ databaseId: firestoreDatabaseId });
  }

  try {
    // 3. Inspect Users collection
    console.log("\n--- Users collection ---");
    const usersSnap = await db.collection("users").get();
    console.log(`Total users found: ${usersSnap.size}`);
    usersSnap.forEach(doc => {
      console.log(`User ID: ${doc.id} => ${JSON.stringify(doc.data())}`);
    });

    // 4. Inspect Cases collection
    console.log("\n--- Cases collection ---");
    const casesSnap = await db.collection("cases").get();
    console.log(`Total cases found: ${casesSnap.size}`);
    casesSnap.forEach(doc => {
      console.log(`Case ID: ${doc.id} => ${JSON.stringify(doc.data())}`);
    });

    // 5. Inspect specific case f60jptoSi8Z9xat45yIb
    console.log("\n--- Case f60jptoSi8Z9xat45yIb ---");
    const caseDoc = await db.collection("cases").doc("f60jptoSi8Z9xat45yIb").get();
    if (caseDoc.exists) {
      console.log(`Case found: ${JSON.stringify(caseDoc.data())}`);
    } else {
      console.log("Case f60jptoSi8Z9xat45yIb does NOT exist!");
    }

  } catch (err: any) {
    console.error("Error during Firestore query:", err);
  } finally {
    await app.delete();
  }
}

run().catch(console.error);
