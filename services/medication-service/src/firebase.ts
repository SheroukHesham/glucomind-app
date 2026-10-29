import admin from "firebase-admin";
import fs from "node:fs";

const serviceAccountPath = "/run/secrets/firebase-key";

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

module.exports = admin;
