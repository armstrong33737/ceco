const prisma = require("../prismaClient");

// ------------------------------------------------------------------
// Filet de sécurité multi-tenant : centerId est injecté automatiquement
// dans chaque requête. Un développeur ne peut pas "oublier" le filtre
// puisqu'il n'a jamais accès au modèle Prisma brut via ce wrapper.
// ------------------------------------------------------------------

function scopedRepository(modelName, centerId) {
  if (!centerId) {
    throw new Error(`scopedRepository(${modelName}) appelé sans centerId — refus par sécurité.`);
  }
  const model = prisma[modelName];

  return {
    findMany: (args = {}) =>
      model.findMany({ ...args, where: { ...args.where, centerId } }),

    findFirst: (args = {}) =>
      model.findFirst({ ...args, where: { ...args.where, centerId } }),

    findUniqueScoped: async (args) => {
      const record = await model.findUnique(args);
      if (record && record.centerId !== centerId) return null; // isolation stricte
      return record;
    },

    create: (args) =>
      model.create({ ...args, data: { ...args.data, centerId } }),

    update: (args) =>
      model.updateMany({ ...args, where: { ...args.where, centerId } }),

    delete: (args) =>
      model.deleteMany({ ...args, where: { ...args.where, centerId } }),
  };
}

module.exports = { scopedRepository };
