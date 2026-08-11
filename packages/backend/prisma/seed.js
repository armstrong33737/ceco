const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

// Permissions par défaut des rôles système, avec la NOUVELLE nomenclature
// granulaire (module.action) — doit rester synchronisée avec la grille de
// packages/frontend/src/pages/Roles.jsx (MODULES x ACTIONS).
const SYSTEM_ROLES = [
  { name: "Admin", isSystem: true, permissions: ["*"] },
  { name: "Secrétaire", isSystem: false, permissions: ["students.read", "students.create", "students.update"] },
  { name: "Formateur", isSystem: false, permissions: ["students.read", "grades.create", "grades.update"] },
];

const ADMIN_EMAIL = "admin@local.ceco";

async function main() {
  // 1. Centre — créé une seule fois, jamais recréé ni écrasé ensuite.
  let center = await prisma.center.findFirst();
  if (!center) {
    console.log("Première initialisation — création du centre local par défaut...");
    center = await prisma.center.create({
      data: {
        name: "Centre d'Excellence CECO Local",
        slug: "local",
        email: "contact@local.ceco",
        phone: "+237 600 000 000",
        address: "Bafoussam, Cameroun",
        city: "Bafoussam",
        country: "Cameroun",
        subscriptionPlan: "local",
        maxStorage: BigInt(10 * 1024 * 1024 * 1024),
      },
    });
    console.log(`Centre créé : ${center.name} (${center.id})`);
  } else {
    console.log(`Centre déjà initialisé : ${center.name} (${center.id}).`);
  }

  // 2. Abonnement — 2 mois gratuits, créé une seule fois. Ne touche jamais
  // à une date d'expiration déjà fixée (ex. après un paiement réel).
  const existingSubscription = await prisma.subscription.findUnique({ where: { centerId: center.id } });
  if (!existingSubscription) {
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 2);
    await prisma.subscription.create({
      data: {
        centerId: center.id,
        plan: "local",
        status: "active",
        expiresAt,
        maxUsers: 50,
        maxStorage: BigInt(10 * 1024 * 1024 * 1024),
      },
    });
    console.log(`Abonnement créé avec 2 mois gratuits — expiration le ${expiresAt.toISOString()}.`);
  }

  // 3. Rôles système — RÉPARATEUR, pas juste créateur : s'assure que chaque
  // rôle système possède exactement les permissions attendues, même si ce
  // centre a été créé par une version antérieure de ce script. C'est ce qui
  // évite qu'un rôle admin se retrouve un jour sans son "*" après une mise
  // à jour du catalogue de permissions. Ne touche jamais un rôle
  // personnalisé créé par l'utilisateur (isSystem: false et absent d'ici).
  for (const roleDef of SYSTEM_ROLES) {
    let role = await prisma.role.findFirst({ where: { centerId: center.id, name: roleDef.name } });
    if (!role) {
      role = await prisma.role.create({
        data: { centerId: center.id, name: roleDef.name, isSystem: roleDef.isSystem },
      });
      console.log(`Rôle "${roleDef.name}" créé.`);
    }

    const existing = await prisma.permission.findMany({ where: { roleId: role.id } });
    const existingActions = existing.map((p) => p.action);
    const missing = roleDef.permissions.filter((a) => !existingActions.includes(a));
    if (missing.length > 0) {
      await prisma.permission.createMany({ data: missing.map((action) => ({ roleId: role.id, action })) });
      console.log(`Rôle "${roleDef.name}" réparé — permissions ajoutées : ${missing.join(", ")}`);
    }
  }

  // 4. Compte admin par défaut — créé une seule fois ; réparé si son rôle
  // a été perdu (même logique que pour le rôle lui-même).
  const adminRole = await prisma.role.findFirst({ where: { centerId: center.id, name: "Admin" } });
  const adminUser = await prisma.user.findFirst({ where: { centerId: center.id, email: ADMIN_EMAIL } });

  if (!adminUser) {
    const hashedPassword = await bcrypt.hash("admin123", 10);
    await prisma.user.create({
      data: {
        centerId: center.id,
        roleId: adminRole.id,
        email: ADMIN_EMAIL,
        password: hashedPassword,
        firstName: "Admin",
        lastName: "Centre",
        isActive: true,
      },
    });
    console.log(`Compte admin par défaut créé : ${ADMIN_EMAIL} / admin123 — À CHANGER IMMÉDIATEMENT.`);
  } else if (!adminUser.roleId) {
    await prisma.user.update({ where: { id: adminUser.id }, data: { roleId: adminRole.id } });
    console.log(`Compte admin réparé : rôle "Admin" réassocié à ${ADMIN_EMAIL}.`);
  }

  console.log("Seed vérifié.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });