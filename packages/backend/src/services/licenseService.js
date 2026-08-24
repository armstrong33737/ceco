// packages/backend/src/services/licenseService.js
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const prisma = require("../prismaClient");

const GRACE_PERIOD_DAYS = 7;

/**
 * Résolution dynamique de la clé publique officielle
 */
function getPublicKeyPem() {
  const possiblePaths = [
    path.join(__dirname, "public.key"),
    path.join(__dirname, "../../keys/public.key"),
    path.join(process.cwd(), "keys/public.key"),
    path.join(process.cwd(), "packages/backend/keys/public.key"),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return fs.readFileSync(p, "utf-8").trim();
    }
  }

  return null;
}

function getCanonicalDataString(data) {
  const keys = Object.keys(data).sort();
  const sortedObj = {};
  for (const k of keys) {
    sortedObj[k] = data[k];
  }
  return JSON.stringify(sortedObj);
}

/**
 * Décode et vérifie la signature cryptographique asymétrique Ed25519
 */
function verifyLicenseToken(tokenString, centerId) {
  try {
    if (!tokenString || typeof tokenString !== "string") {
      return { isValid: false, reason: "Jeton de licence vide ou manquant." };
    }

    const publicKeyPem = getPublicKeyPem();
    if (!publicKeyPem) {
      return { isValid: false, reason: "Clé publique d'autorité introuvable sur le serveur." };
    }

    const cleanToken = tokenString.trim().replace(/^CECO-/, "").replace(/\s+/g, "");
    const decodedJson = Buffer.from(cleanToken, "base64").toString("utf-8");
    const bundle = JSON.parse(decodedJson);

    if (!bundle.data || !bundle.signature) {
      return { isValid: false, reason: "Format de certificat corrompu." };
    }

    const canonicalString = getCanonicalDataString(bundle.data);
    const dataBuffer = Buffer.from(canonicalString, "utf-8");
    const signatureBuffer = Buffer.from(bundle.signature, "base64");

    // Vérification mathématique avec la clé publique
    const isSignatureValid = crypto.verify(null, dataBuffer, publicKeyPem, signatureBuffer);
    if (!isSignatureValid) {
      return { isValid: false, reason: "Signature cryptographique non reconnue ou altérée." };
    }

    if (bundle.data.centerId && centerId && bundle.data.centerId !== centerId) {
      return {
        isValid: false,
        reason: `Cette licence a été émise pour l'établissement "${bundle.data.centerId}", alors que votre centre est "${centerId}".`,
      };
    }

    return {
      isValid: true,
      data: bundle.data,
      expiresAt: new Date(bundle.data.expiresAt),
      plan: bundle.data.plan || "local_pro",
      maxUsers: bundle.data.maxUsers || 50,
      maxStudents: bundle.data.maxStudents || 2000,
    };
  } catch (err) {
    return { isValid: false, reason: "Erreur de déchiffrement de la licence : " + err.message };
  }
}

async function checkClockIntegrity(centerId) {
  try {
    const settingKey = "system.clock.last_tick";
    const lastTickSetting = await prisma.setting.findUnique({
      where: { centerId_key: { centerId, key: settingKey } },
    });

    const now = Date.now();

    if (lastTickSetting && lastTickSetting.value?.timestamp) {
      const lastTimestamp = Number(lastTickSetting.value.timestamp);
      if (now < lastTimestamp - 2 * 60 * 60 * 1000) {
        return {
          isClockTampered: true,
          lastSeenDate: new Date(lastTimestamp).toLocaleString("fr-FR"),
          currentDate: new Date(now).toLocaleString("fr-FR"),
        };
      }
    }

    await prisma.setting.upsert({
      where: { centerId_key: { centerId, key: settingKey } },
      update: { value: { timestamp: now, updatedAt: new Date() } },
      create: { centerId, key: settingKey, value: { timestamp: now, updatedAt: new Date() } },
    });

    return { isClockTampered: false };
  } catch (err) {
    return { isClockTampered: false };
  }
}

async function evaluateCenterLicense(centerId) {
  const clockCheck = await checkClockIntegrity(centerId);
  if (clockCheck.isClockTampered) {
    return {
      status: "TAMPERED",
      isAllowedToWrite: false,
      isAllowedToRead: true,
      reason: `Horloge système manipulée : l'heure de votre PC (${clockCheck.currentDate}) est antérieure au dernier enregistrement (${clockCheck.lastSeenDate}).`,
      remainingDays: 0,
      graceDaysRemaining: 0,
    };
  }

  const licenseRecord = await prisma.license.findUnique({
    where: { centerId },
  });

  let activeExpiresAt = null;
  let activePlan = "local";
  let maxUsers = 50;
  let licenseVerified = false;

  if (licenseRecord && licenseRecord.signedPayload) {
    const verification = verifyLicenseToken(licenseRecord.signedPayload, centerId);
    if (verification.isValid) {
      activeExpiresAt = verification.expiresAt;
      activePlan = verification.plan;
      maxUsers = verification.maxUsers;
      licenseVerified = true;
    }
  }

  if (!licenseVerified) {
    const sub = await prisma.subscription.findUnique({ where: { centerId } });
    if (sub && sub.expiresAt) {
      activeExpiresAt = new Date(sub.expiresAt);
      activePlan = sub.plan;
      maxUsers = sub.maxUsers || 50;
    }
  }

  if (!activeExpiresAt) {
    return {
      status: "EXPIRED",
      isAllowedToWrite: false,
      isAllowedToRead: true,
      reason: "Aucune licence valide enregistrée pour cet établissement.",
      remainingDays: 0,
      graceDaysRemaining: 0,
    };
  }

  const now = Date.now();
  const expiryTime = activeExpiresAt.getTime();
  const graceEndTime = expiryTime + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000;

  const remainingDays = Math.ceil((expiryTime - now) / (1000 * 60 * 60 * 24));
  const graceDaysRemaining = Math.max(0, Math.ceil((graceEndTime - now) / (1000 * 60 * 60 * 24)));

  if (now <= expiryTime) {
    return {
      status: "ACTIVE",
      isAllowedToWrite: true,
      isAllowedToRead: true,
      expiresAt: activeExpiresAt,
      remainingDays: Math.max(0, remainingDays),
      graceDaysRemaining: GRACE_PERIOD_DAYS,
      plan: activePlan,
      maxUsers,
      isVerified: licenseVerified,
    };
  }

  if (now <= graceEndTime) {
    return {
      status: "GRACE_PERIOD",
      isAllowedToWrite: true,
      isAllowedToRead: true,
      expiresAt: activeExpiresAt,
      remainingDays: 0,
      graceDaysRemaining,
      plan: activePlan,
      maxUsers,
      isVerified: licenseVerified,
      warning: `Votre licence a expiré le ${activeExpiresAt.toLocaleDateString("fr-FR")}. Période de grâce active : il vous reste ${graceDaysRemaining} jour(s) pour recharger.`,
    };
  }

  return {
    status: "READ_ONLY",
    isAllowedToWrite: false,
    isAllowedToRead: true,
    expiresAt: activeExpiresAt,
    remainingDays: 0,
    graceDaysRemaining: 0,
    plan: activePlan,
    maxUsers,
    isVerified: licenseVerified,
    reason: `Licence expirée depuis le ${activeExpiresAt.toLocaleDateString("fr-FR")} et délai de grâce dépassé. L'application est en mode Consultation / Lecture seule.`,
  };
}

module.exports = {
  verifyLicenseToken,
  evaluateCenterLicense,
  checkClockIntegrity,
  getPublicKeyPem,
};