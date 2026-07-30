const prisma = require("../prismaClient");

// ------------------------------------------------------------------
// Principe : req.centerId est TOUJOURS peuplé par ce middleware,
// jamais lu ailleurs à partir d'une source différente.
// Le reste de l'application (routes, repositories) ne sait jamais
// si elle tourne en mode local ou en mode SaaS.
// ------------------------------------------------------------------

let cachedLocalCenterId = null;

// Mode local (V0 -> V7) : un seul centre, résolu une fois puis mis en cache.
async function tenantResolverLocal(req, res, next) {
  try {
    if (!cachedLocalCenterId) {
      const center = await prisma.center.findFirst();
      if (!center) {
        return res.status(500).json({
          error: "Aucun centre initialisé. Lancez le seed d'installation (prisma:seed).",
        });
      }
      cachedLocalCenterId = center.id;
    }
    req.centerId = cachedLocalCenterId;
    next();
  } catch (err) {
    next(err);
  }
}

// Mode SaaS (V8+) : résolution dynamique par sous-domaine.
async function tenantResolverSaas(req, res, next) {
  try {
    const host = req.hostname || "";
    const slug = host.split(".")[0];
    const center = await prisma.center.findUnique({ where: { slug } });
    if (!center) {
      return res.status(404).json({ error: "Centre inconnu pour ce sous-domaine." });
    }
    req.centerId = center.id;
    next();
  } catch (err) {
    next(err);
  }
}

function buildTenantResolver(mode) {
  return mode === "saas" ? tenantResolverSaas : tenantResolverLocal;
}

module.exports = { buildTenantResolver, tenantResolverLocal, tenantResolverSaas };
