const prisma = require("../prismaClient");

const checkLicense = async (req, res, next) => {
  // Les routes d'authentification et de licence restent accessibles pour permettre la connexion et le rechargement
  const isAuthOrLicenseRoute = 
    req.path.startsWith("/auth") || 
    req.path.startsWith("/license");

  if (isAuthOrLicenseRoute) {
    return next();
  }

  try {
    // Recherche de l'abonnement du centre
    const subscription = await prisma.subscription.findUnique({
      where: { centerId: req.centerId }
    });

    // Si aucun abonnement n'existe, ou s'il a expiré
    if (!subscription || !subscription.expiresAt || new Date(subscription.expiresAt).getTime() < Date.now()) {
      return res.status(402).json({ 
        error: "LICENSE_EXPIRED", 
        message: "La licence d'exploitation locale de votre centre a expiré. Rechargement requis." 
      });
    }

    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { checkLicense };