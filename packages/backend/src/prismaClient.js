const { PrismaClient } = require("@prisma/client");

// Singleton — une seule instance de connexion pour tout le process backend.
const prisma = new PrismaClient();

module.exports = prisma;
