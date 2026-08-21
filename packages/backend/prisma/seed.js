// packages/backend/prisma/seed.js
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

// Rôles système V3
const SYSTEM_ROLES = [
  { name: "Admin", isSystem: true, permissions: ["*"] },
  {
    name: "Directeur des Études",
    isSystem: false,
    permissions: [
      "formations.read", "formations.create", "formations.update", "formations.delete",
      "grades.read", "grades.create", "grades.update", "grades.validate",
      "students.read", "bulletins.generate",
    ],
  },
  {
    name: "Secrétaire",
    isSystem: false,
    permissions: [
      "students.read", "students.create", "students.update",
      "formations.read", "grades.read", "bulletins.generate",
    ],
  },
  {
    name: "Formateur",
    isSystem: false,
    permissions: [
      "formations.read", "grades.read", "grades.create", "grades.update",
    ],
  },
];

const ADMIN_EMAIL = "admin@local.ceco";

async function main() {
  // 1. Centre local
  let center = await prisma.center.findFirst();
  if (!center) {
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
  }

  // 2. Abonnement 60 jours
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
  }

  // 3. Politique de pondération initiale par défaut (30% CC_TP / 70% NORMALE)
  const existingPolicy = await prisma.gradingPolicy.findFirst({ where: { centerId: center.id } });
  if (!existingPolicy) {
    await prisma.gradingPolicy.create({
      data: {
        centerId: center.id,
        ccWeight: 0.30,
        normalWeight: 0.70,
      },
    });
    console.log("Politique de pondération par défaut initialisée : 30% CC_TP / 70% NORMALE.");
  }

  // 4. Rôles système et permissions
  for (const roleDef of SYSTEM_ROLES) {
    let role = await prisma.role.findFirst({ where: { centerId: center.id, name: roleDef.name } });
    if (!role) {
      role = await prisma.role.create({
        data: { centerId: center.id, name: roleDef.name, isSystem: roleDef.isSystem },
      });
    }

    const existing = await prisma.permission.findMany({ where: { roleId: role.id } });
    const existingActions = existing.map((p) => p.action);
    const missing = roleDef.permissions.filter((a) => !existingActions.includes(a));
    if (missing.length > 0) {
      await prisma.permission.createMany({ data: missing.map((action) => ({ roleId: role.id, action })) });
    }
  }

  // 5. Compte admin
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
    console.log(`Compte admin créé : ${ADMIN_EMAIL} / admin123`);
  }

  console.log("Seed V3 vérifié avec succès.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });