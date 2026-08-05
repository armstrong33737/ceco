const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const { ensureStorageTree } = require("../src/storage/paths");

const prisma = new PrismaClient();

const SYSTEM_ROLES = [
  { name: "admin", isSystem: true, permissions: ["*"] },
  { name: "formateur", isSystem: true, permissions: ["grades.create", "grades.update", "student.read"] },
  { name: "secretaire", isSystem: true, permissions: ["student.read", "student.create", "student.update"] },
];

const ADMIN_EMAIL = "admin@local.ceco";

async function main() {
  let center = await prisma.center.findFirst();

  if (!center) {
    console.log("Première initialisation — création du centre local par défaut...");
    center = await prisma.center.create({
      data: { name: "Mon Centre de Formation", slug: "local", subscriptionPlan: "local" },
    });
    await prisma.subscription.create({
      data: { centerId: center.id, plan: "local", status: "active", maxUsers: null, maxStorage: null },
    });
    await ensureStorageTree(center.id);
    console.log(`Centre créé : ${center.name} (${center.id})`);
  } else {
    console.log(`Centre déjà initialisé : ${center.name} (${center.id}).`);
  }

  // RÉPARATEUR, pas juste créateur : s'assure que chaque rôle système
  // possède exactement les permissions attendues, même si ce centre a été
  // créé par une version antérieure de ce script — utile après une mise à
  // jour qui ajoute de nouvelles permissions système. Ne touche jamais aux
  // rôles personnalisés créés par l'utilisateur (isSystem: false).
  for (const roleDef of SYSTEM_ROLES) {
    let role = await prisma.role.findFirst({ where: { centerId: center.id, name: roleDef.name } });

    if (!role) {
      role = await prisma.role.create({
        data: { centerId: center.id, name: roleDef.name, isSystem: true },
      });
      console.log(`Rôle système "${roleDef.name}" créé.`);
    }

    const existing = await prisma.permission.findMany({ where: { roleId: role.id } });
    const existingActions = existing.map((p) => p.action);
    const missing = roleDef.permissions.filter((a) => !existingActions.includes(a));

    if (missing.length > 0) {
      await prisma.permission.createMany({
        data: missing.map((action) => ({ roleId: role.id, action })),
      });
      console.log(`Rôle "${roleDef.name}" réparé — permissions ajoutées : ${missing.join(", ")}`);
    }
  }

  const adminRole = await prisma.role.findFirst({ where: { centerId: center.id, name: "admin" } });
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
      },
    });
    console.log(`Compte admin par défaut créé : ${ADMIN_EMAIL} / admin123 — À CHANGER IMMÉDIATEMENT.`);
  } else if (!adminUser.roleId) {
    // Cas exact du bug rencontré : un admin existant mais sans rôle
    // correctement associé (données créées avant que ce lien soit fiabilisé).
    await prisma.user.update({ where: { id: adminUser.id }, data: { roleId: adminRole.id } });
    console.log(`Compte admin réparé : rôle "admin" réassocié à ${ADMIN_EMAIL}.`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });