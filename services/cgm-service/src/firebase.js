import admin, { cert, getApps, initializeApp } from "firebase-admin";
import fs from "node:fs";

const serviceAccount = JSON.parse(
  fs.readFileSync("/run/secrets/firebase-key", "utf8"),
);

if (getApps().length === 0) {
  initializeApp({ credential: cert(serviceAccount) });
}
