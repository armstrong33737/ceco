// packages/backend/src/index.js
BigInt.prototype.toJSON = function () {
  const num = Number(this);
  return Number.isSafeInteger(num) ? num : this.toString();
};

const express = require("express");
const cors = require("cors");
const { buildTenantResolver } = require("./middleware/tenantResolver");
const { checkLicense } = require("./middleware/licenseGuard");
const { errorHandler } = require("./middleware/errorHandler");

const healthRoutes = require("./routes/health");
const authRoutes = require("./routes/auth");
const centerRoutes = require("./routes/center");
const usersRoutes = require("./routes/users");
const rolesRoutes = require("./routes/roles");
const licenseRoutes = require("./routes/license");
const backupsRoutes = require("./routes/backups");
const formationsRoutes = require("./routes/formations");
const pedagogieRoutes = require("./routes/pedagogie");
const gradesRoutes = require("./routes/grades");
const studentsRoutes = require("./routes/students");
const documentsRoutes = require("./routes/documents");
const auditRoutes = require("./routes/audit"); // ⬅️ Monté

const app = express();
const PORT = process.env.CECO_API_PORT || 4000;
const MODE = process.env.CECO_MODE || "local";

app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.use(buildTenantResolver(MODE));

// 1. Routes ouvertes
app.use("/", healthRoutes);
app.use("/", authRoutes);
app.use("/", licenseRoutes);

// 2. Garde de licence
app.use(checkLicense);

// 3. Routes métier
app.use("/", centerRoutes);
app.use("/", usersRoutes);
app.use("/", rolesRoutes);
app.use("/", backupsRoutes);
app.use("/", formationsRoutes);
app.use("/", pedagogieRoutes);
app.use("/", gradesRoutes);
app.use("/", studentsRoutes);
app.use("/", documentsRoutes);
app.use("/", auditRoutes);

// 4. Gestionnaire d'erreurs centralisé
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`CECO API démarrée sur http://localhost:${PORT} (mode: ${MODE})`);
});

module.exports = app;