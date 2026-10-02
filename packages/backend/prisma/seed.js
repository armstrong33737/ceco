// packages/backend/prisma/seed.js
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

// Rôles système d'usine protégés (isSystem: true) avec socles de permissions garantis
const SYSTEM_ROLES = [
  { 
    name: "Admin", 
    isSystem: true, 
    permissions: ["*"] 
  },
  {
    name: "Directeur des Études",
    isSystem: true,
    permissions: [
      "formations.read", "formations.create", "formations.update", "formations.delete",
      "grades.read", "grades.create", "grades.update", "grades.validate",
      "students.read", "bulletins.generate",
    ],
  },
  {
    name: "Secrétaire",
    isSystem: true,
    permissions: [
      "students.read", "students.create", "students.update",
      "formations.read", "grades.read", "bulletins.generate",
    ],
  },
  {
    name: "Formateur",
    isSystem: true,
    permissions: [
      "formations.read", "grades.read", "grades.create", "grades.update",
    ],
  },
];

const ADMIN_EMAIL = "admin@local.ceco";
const SECRETAIRE_EMAIL = "secretaire@local.ceco";
const PROF_EMAIL = "prof@local.ceco";

async function main() {
  // 1. Initialisation du Centre local
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

  // 2. Initialisation de l'Abonnement (60 jours d'évaluation)
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

  // 3. Politique de pondération par défaut (30% CC_TP / 70% NORMALE)
  const existingPolicy = await prisma.gradingPolicy.findFirst({ where: { centerId: center.id } });
  if (!existingPolicy) {
    await prisma.gradingPolicy.create({
      data: {
        centerId: center.id,
        ccWeight: 0.30,
        normalWeight: 0.70,
      },
    });
    console.log("Pondération par défaut initialisée : 30% CC / 70% Examen.");
  }

  // 4. Initialisation & Protection des Rôles Système (Garantie du socle fonctionnel)
  for (const roleDef of SYSTEM_ROLES) {
    let role = await prisma.role.findFirst({ where: { centerId: center.id, name: roleDef.name } });
    if (!role) {
      role = await prisma.role.create({
        data: { centerId: center.id, name: roleDef.name, isSystem: roleDef.isSystem },
      });
    } else if (!role.isSystem && roleDef.isSystem) {
      await prisma.role.update({
        where: { id: role.id },
        data: { isSystem: true },
      });
    }

    // Réalignement du socle minimal garanti sans supprimer les permissions additionnelles accordées par l'admin
    const existing = await prisma.permission.findMany({ where: { roleId: role.id } });
    const existingActions = existing.map((p) => p.action);
    const missing = roleDef.permissions.filter((a) => !existingActions.includes(a));
    if (missing.length > 0) {
      await prisma.permission.createMany({ data: missing.map((action) => ({ roleId: role.id, action })) });
    }
  }

  // 5. Comptes de test de référence
  const adminRole = await prisma.role.findFirst({ where: { centerId: center.id, name: "Admin" } });
  let adminUser = await prisma.user.findFirst({ where: { centerId: center.id, email: ADMIN_EMAIL } });
  if (!adminUser && adminRole) {
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

  const secretaireRole = await prisma.role.findFirst({ where: { centerId: center.id, name: "Secrétaire" } });
  let secretaireUser = await prisma.user.findFirst({ where: { centerId: center.id, email: SECRETAIRE_EMAIL } });
  if (!secretaireUser && secretaireRole) {
    const hashedSecPassword = await bcrypt.hash("sec1234", 10);
    await prisma.user.create({
      data: {
        centerId: center.id,
        roleId: secretaireRole.id,
        email: SECRETAIRE_EMAIL,
        password: hashedSecPassword,
        firstName: "Jeanne",
        lastName: "Secrétariat",
        isActive: true,
      },
    });
    console.log(`Compte secrétaire créé : ${SECRETAIRE_EMAIL} / sec1234`);
  }

  const formateurRole = await prisma.role.findFirst({ where: { centerId: center.id, name: "Formateur" } });
  let profUser = await prisma.user.findFirst({ where: { centerId: center.id, email: PROF_EMAIL } });
  if (!profUser && formateurRole) {
    const hashedProfPassword = await bcrypt.hash("prof1234", 10);
    profUser = await prisma.user.create({
      data: {
        centerId: center.id,
        roleId: formateurRole.id,
        email: PROF_EMAIL,
        password: hashedProfPassword,
        firstName: "Paul",
        lastName: "Enseignant",
        isActive: true,
      },
    });

    let formateurProfile = await prisma.formateur.findFirst({ where: { centerId: center.id, userId: profUser.id } });
    if (!formateurProfile) {
      await prisma.formateur.create({
        data: {
          centerId: center.id,
          userId: profUser.id,
          firstName: "Paul",
          lastName: "Enseignant",
          email: PROF_EMAIL,
          phone: "+237 670 000 111",
          specialite: "Génie Thermique & Climatisation",
        },
      });
    }
    console.log(`Compte formateur créé : ${PROF_EMAIL} / prof1234`);
  }

  console.log("Seed CECO vérifié avec succès.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });