const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");
const { ensureStorageTree } = require("../src/storage/paths");

const prisma = new PrismaClient();

const SYSTEM_ROLES = [
  { name: "admin", isSystem: true, permissions: ["*"] },
  { name: "formateur", isSystem: true, permissions: ["grades.create", "grades.update", "student.read"] },
  { name: "secretaire", isSystem: true, permissions: ["student.read", "student.create", "student.update"] },
];

async function main() {
  const existing = await prisma.center.findFirst();
  if (existing) {
    console.log(`Centre déjà initialisé : ${existing.name} (${existing.id}). Rien à faire.`);
    return;
  }

  console.log("Première initialisation — création du centre local par défaut...");

  const center = await prisma.center.create({
    data: {
      name: "Mon Centre de Formation",
      slug: "local",
      subscriptionPlan: "local",
    },
  });

  await prisma.subscription.create({
    data: {
      centerId: center.id,
      plan: "local",
      status: "active",
      maxUsers: null, // illimité en local
      maxStorage: null,
    },
  });

  for (const roleDef of SYSTEM_ROLES) {
    await prisma.role.create({
      data: {
        centerId: center.id,
        name: roleDef.name,
        isSystem: true,
        permissions: { create: roleDef.permissions.map((action) => ({ action })) },
      },
    });
  }

  const adminRole = await prisma.role.findFirst({ where: { centerId: center.id, name: "admin" } });
  const hashedPassword = await bcrypt.hash("admin123", 10);
  await prisma.user.create({
    data: {
      centerId: center.id,
      roleId: adminRole.id,
      email: "admin@local.ceco",
      password: hashedPassword,
      firstName: "Admin",
      lastName: "Centre",
    },
  });

  await ensureStorageTree(center.id);

  console.log(`Centre créé : ${center.name} (${center.id})`);
  console.log("Compte admin par défaut : admin@local.ceco / admin123 — À CHANGER IMMÉDIATEMENT.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
