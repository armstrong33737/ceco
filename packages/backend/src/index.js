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
const formationsRoutes = require("./routes/formations"); // V2 - Formations & Structure Académique

const app = express();
const PORT = process.env.CECO_API_PORT || 4000;
const MODE = process.env.CECO_MODE || "local";

app.use(cors());
app.use(express.json());

app.use(buildTenantResolver(MODE));

// 1. Routes accessibles même en licence échue
app.use("/", healthRoutes);
app.use("/", authRoutes);
app.use("/", licenseRoutes);

// 2. Garde de licence active
app.use(checkLicense);

// 3. Routes métier protégées
app.use("/", centerRoutes);
app.use("/", usersRoutes);
app.use("/", rolesRoutes);
app.use("/", backupsRoutes);
app.use("/", formationsRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Erreur interne du serveur." });
});

app.listen(PORT, () => {
  console.log(`CECO API démarrée sur http://localhost:${PORT} (mode: ${MODE})`);
});

module.exports = app;