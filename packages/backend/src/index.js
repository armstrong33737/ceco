// ============================================================
// CORRECTIF DE SÉRIALISATION GLOBALE DES BIGINT (PRISMA / EXPRESS)
// Placez ceci tout en haut du fichier de démarrage du serveur.
// Permet de convertir automatiquement les BigInt en nombres sécurisés ou
// en chaînes pour éviter le crash JSON.stringify.
// ============================================================
BigInt.prototype.toJSON = function () {
  const num = Number(this);
  return Number.isSafeInteger(num) ? num : this.toString();
};

const express = require("express");
const cors = require("cors");
const { buildTenantResolver } = require("./middleware/tenantResolver");
const { checkLicense } = require("./middleware/licenseGuard");
const healthRoutes = require("./routes/health");
const authRoutes = require("./routes/auth");
const centerRoutes = require("./routes/center");
const usersRoutes = require("./routes/users");
const rolesRoutes = require("./routes/roles");
const licenseRoutes = require("./routes/license");
const backupsRoutes = require("./routes/backups");

const app = express();
const PORT = process.env.CECO_API_PORT || 4000;
const MODE = process.env.CECO_MODE || "local"; // "local" | "saas"

app.use(cors());
app.use(express.json());

// Middleware central : req.centerId est peuplé ici, une seule fois,
// et jamais recalculé ailleurs dans l'application.
app.use(buildTenantResolver(MODE));

// 1. Routes ouvertes : ces routes restent impérativement accessibles 
// même si la licence d'exploitation du centre a expiré (pour se connecter,
// vérifier l'état du serveur et pouvoir payer le renouvellement).
app.use("/", healthRoutes);
app.use("/", authRoutes);
app.use("/", licenseRoutes);

// 2. Activation globale du verrouillage de licence
// Toutes les requêtes HTTP adressées aux routeurs déclarés en dessous
// de cette ligne feront l'objet d'une vérification de validité de date en base de données.
app.use(checkLicense);

// 3. Routes protégées : inaccessibles si la licence est expirée.
app.use("/", centerRoutes);
app.use("/", usersRoutes);
app.use("/", rolesRoutes);
app.use("/", backupsRoutes);

// Les futures routes métier (students, grades, documents, ...) se
// branchent ici, chacune protégée par verifyJwt + RBAC et de fait,
// soumise à la validité de la licence active ci-dessus.

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Erreur interne du serveur." });
});

app.listen(PORT, () => {
  console.log(`CECO API démarrée sur http://localhost:${PORT} (mode: ${MODE})`);
});

module.exports = app;