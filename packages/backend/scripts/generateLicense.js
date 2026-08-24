// packages/backend/scripts/generateLicense.js
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const KEYS_DIR = path.join(__dirname, "../keys");
const PRIVATE_KEY_PATH = path.join(KEYS_DIR, "private.key");
const PUBLIC_KEY_PATH = path.join(KEYS_DIR, "public.key");

/**
 * Initialise automatiquement la paire de clés Ed25519 si elle n'existe pas encore
 */
function ensureKeyPair() {
  if (!fs.existsSync(KEYS_DIR)) {
    fs.mkdirSync(KEYS_DIR, { recursive: true });
  }

  if (!fs.existsSync(PRIVATE_KEY_PATH) || !fs.existsSync(PUBLIC_KEY_PATH)) {
    console.log("⚙️  Génération d'une nouvelle paire de clés cryptographiques Ed25519 certifiée...");
    const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519", {
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" },
    });

    fs.writeFileSync(PRIVATE_KEY_PATH, privateKey, { mode: 0o600 });
    fs.writeFileSync(PUBLIC_KEY_PATH, publicKey, { mode: 0o644 });

    // Copie également dans src/services pour le runtime
    const serviceKeyDir = path.join(__dirname, "../src/services");
    if (fs.existsSync(serviceKeyDir)) {
      fs.writeFileSync(path.join(serviceKeyDir, "public.key"), publicKey, { mode: 0o644 });
    }

    console.log("✓ Clés enregistrées dans packages/backend/keys/\n");
  }

  const privateKeyPem = fs.readFileSync(PRIVATE_KEY_PATH, "utf-8");
  const publicKeyPem = fs.readFileSync(PUBLIC_KEY_PATH, "utf-8");

  return { privateKeyPem, publicKeyPem };
}

function getCanonicalDataString(data) {
  const keys = Object.keys(data).sort();
  const sortedObj = {};
  for (const k of keys) {
    sortedObj[k] = data[k];
  }
  return JSON.stringify(sortedObj);
}

function signLicensePayload(payload, privateKeyPem) {
  const canonicalString = getCanonicalDataString(payload);
  const dataBuffer = Buffer.from(canonicalString, "utf-8");
  const signature = crypto.sign(null, dataBuffer, privateKeyPem);

  const bundle = {
    data: payload,
    signature: signature.toString("base64"),
  };

  return Buffer.from(JSON.stringify(bundle)).toString("base64");
}

function verifyGeneratedToken(tokenString, publicKeyPem) {
  try {
    const cleanToken = tokenString.trim().replace(/^CECO-/, "").replace(/\s+/g, "");
    const bundle = JSON.parse(Buffer.from(cleanToken, "base64").toString("utf-8"));
    const dataBuffer = Buffer.from(getCanonicalDataString(bundle.data), "utf-8");
    const signatureBuffer = Buffer.from(bundle.signature, "base64");
    return crypto.verify(null, dataBuffer, publicKeyPem, signatureBuffer);
  } catch {
    return false;
  }
}

// 1. Chargement / Initialisation des clés
const { privateKeyPem, publicKeyPem } = ensureKeyPair();

// 2. Traitement des arguments
const args = process.argv.slice(2);
const centerId = args[0];
const months = parseInt(args[1], 10) || 12;
const plan = args[2] || "local_pro";

if (!centerId) {
  console.log(`
=============================================================================
  GÉNÉRATEUR DE LICENCE ASYMÉTRIQUE ED25519 (Éditeur CECO)
=============================================================================
Usage :
  node scripts/generateLicense.js <centerId> [mois] [plan]

Exemples :
  node scripts/generateLicense.js cmt0bsfih0000k3q79ua7qwv0 2 local_pro
  node scripts/generateLicense.js cmt0bsfih0000k3q79ua7qwv0 12 enterprise
=============================================================================
`);
  process.exit(1);
}

const expiresAt = new Date();
expiresAt.setMonth(expiresAt.getMonth() + months);

const payload = {
  centerId: centerId.trim(),
  plan,
  expiresAt: expiresAt.toISOString(),
  maxUsers: 50,
  maxStudents: 2000,
  issuedAt: new Date().toISOString(),
  issuer: "CECO Africa Licensing Authority",
};

const signedToken = signLicensePayload(payload, privateKeyPem);
const formattedKey = `CECO-${signedToken}`;

console.log("=============================================================================");
console.log("  LICENCE ASYMÉTRIQUE ED25519 GÉNÉRÉE AVEC SUCCÈS");
console.log("=============================================================================");
console.log(`Établissement ID : ${centerId}`);
console.log(`Validité         : ${months} mois (jusqu'au ${expiresAt.toLocaleDateString("fr-FR")})`);
console.log(`Plan             : ${plan}`);
console.log("-----------------------------------------------------------------------------");
console.log("CLÉ D'ACTIVATION HORS-LIGNE (À copier-coller dans l'application) :\n");
console.log(formattedKey);
console.log("\n=============================================================================");

const isTestOk = verifyGeneratedToken(formattedKey, publicKeyPem);
console.log("Validation mathématique par clé publique :", isTestOk ? "✓ SIGNATURE INVIOLABLE VALIDE" : "❌ ÉCHEC");