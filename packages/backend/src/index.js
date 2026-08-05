const express = require("express");
const cors = require("cors");
const { buildTenantResolver } = require("./middleware/tenantResolver");
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

app.use("/", healthRoutes);
app.use("/", authRoutes);
app.use("/", centerRoutes);
app.use("/", usersRoutes);
app.use("/", rolesRoutes);
app.use("/", licenseRoutes);
app.use("/", backupsRoutes);
// Les futures routes métier (students, grades, documents, ...) se
// branchent ici, chacune protégée par verifyJwt + RBAC.

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Erreur interne du serveur." });
});

app.listen(PORT, () => {
  console.log(`CECO API démarrée sur http://localhost:${PORT} (mode: ${MODE})`);
});

module.exports = app;