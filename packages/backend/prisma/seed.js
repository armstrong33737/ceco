const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.center.findFirst();
  if (existing) {
    console.log(`Centre déjà initialisé : ${existing.name} (${existing.id}). Rien à faire.`);
    return;
  }
  
  console.log("Démarrage du peuplement de la base de données (Seed)...");

  // 1. Création ou mise à jour du centre local par défaut
  const center = await prisma.center.upsert({
    where: { slug: "local" },
    update: {},
    create: {
      name: "Centre d'Excellence CECO Local",
      slug: "local",
      email: "contact@local.ceco",
      phone: "+237 600 000 000",
      address: "Bafoussam, Cameroun",
      city: "Bafoussam",
      country: "Cameroun",
      subscriptionPlan: "local",
      maxStorage: BigInt(10 * 1024 * 1024 * 1024), // 10 Go
    },
  });

  console.log(`Centre résolu : ${center.name} (ID: ${center.id})`);

  // 2. AJUSTEMENT DE LA LICENCE / ABONNEMENT — 2 MOIS GRATUITS (60 JOURS)
  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + 2); // Ajoute exactement 2 mois à la date courante

  const subscription = await prisma.subscription.upsert({
    where: { centerId: center.id },
    update: {
      expiresAt,
    },
    create: {
      centerId: center.id,
      plan: "local",
      status: "active",
      expiresAt,
      maxUsers: 50,
      maxStorage: BigInt(10 * 1024 * 1024 * 1024),
    },
  });

  console.log(`Abonnement configuré avec 2 mois gratuits. Expiration le : ${subscription.expiresAt}`);

  // 3. Création des rôles par défaut
  // Rôle Administrateur (Non-modifiable, détient "*")
  const adminRole = await prisma.role.upsert({
    where: { centerId_name: { centerId: center.id, name: "Admin" } },
    update: {},
    create: {
      centerId: center.id,
      name: "Admin",
      isSystem: true,
    },
  });

  // Crée la permission wildcard "*" pour l'admin
  await prisma.permission.upsert({
    where: { roleId_action: { roleId: adminRole.id, action: "*" } },
    update: {},
    create: {
      roleId: adminRole.id,
      action: "*",
    },
  });

  // Rôle Secrétaire (Entièrement modifiable par l'admin)
  const secretaireRole = await prisma.role.upsert({
    where: { centerId_name: { centerId: center.id, name: "Secrétaire" } },
    update: {},
    create: {
      centerId: center.id,
      name: "Secrétaire",
      isSystem: false,
    },
  });

  // Rôle Formateur (Entièrement modifiable par l'admin)
  const formateurRole = await prisma.role.upsert({
    where: { centerId_name: { centerId: center.id, name: "Formateur" } },
    update: {},
    create: {
      centerId: center.id,
      name: "Formateur",
      isSystem: false,
    },
  });

  // 4. Création de l'utilisateur admin par défaut
  const hashedPassword = await bcrypt.hash("admin123", 10);
  await prisma.user.upsert({
    where: { centerId_email: { centerId: center.id, email: "admin@local.ceco" } },
    update: {},
    create: {
      centerId: center.id,
      roleId: adminRole.id,
      email: "admin@local.ceco",
      password: hashedPassword,
      firstName: "Admin",
      lastName: "Centre",
      isActive: true,
    },
  });

  console.log(`Compte Admin créé : admin@local.ceco / admin123`);
  console.log("Seed complété avec succès !");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });