
// packages/backend/src/routes/pedagogie.js
const express = require("express");
const bcrypt = require("bcryptjs");
const prisma = require("../prismaClient");
const { verifyJwt } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");
const { assertEditableAcademicYear } = require("../middleware/academicYearGuard");

const router = express.Router();

async function getConnectedFormateur(req) {
  if (!req.userId) return null;
  return prisma.formateur.findFirst({
    where: { centerId: req.centerId, userId: req.userId },
  });
}

function generateSubjectCode(name, existingCount = 1) {
  const clean = (name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();

  let prefix = clean.substring(0, 3);
  if (prefix.length < 3) {
    prefix = (prefix + "MAT").substring(0, 3);
  }
  const suffix = String(existingCount).padStart(2, "0");
  return `${prefix}${suffix}`.substring(0, 5);
}

function validateSubjectCode(code) {
  return typeof code === "string" && /^[A-Z0-9]{5}$/.test(code.trim().toUpperCase());
}

async function ensureYearGradePeriods(centerId, academicYear) {
  let periods = await prisma.gradePeriod.findMany({
    where: { centerId, academicYearId: academicYear.id },
    orderBy: { order: "asc" },
  });

  if (periods.length === 0) {
    const s1End = new Date(academicYear.startDate);
    s1End.setMonth(s1End.getMonth() + 5);
    const s2Start = new Date(academicYear.startDate);
    s2Start.setMonth(s2Start.getMonth() + 6);

    await prisma.gradePeriod.createMany({
      data: [
        { centerId, academicYearId: academicYear.id, type: "SEMESTRE", order: 1, label: "Semestre 1", startDate: new Date(academicYear.startDate), endDate: s1End },
        { centerId, academicYearId: academicYear.id, type: "SEMESTRE", order: 2, label: "Semestre 2", startDate: s2Start, endDate: new Date(academicYear.endDate) },
        { centerId, academicYearId: academicYear.id, type: "ANNUEL", order: 1, label: `Année ${academicYear.label}`, startDate: new Date(academicYear.startDate), endDate: new Date(academicYear.endDate) },
      ],
    });

    periods = await prisma.gradePeriod.findMany({
      where: { centerId, academicYearId: academicYear.id },
      orderBy: { order: "asc" },
    });
  }
  return periods;
}

// 1. CATÉGORIES / GROUPES D'ENSEIGNEMENT
router.get("/categories", verifyJwt, requirePermission("formations.read", "grades.read", "students.read"), async (req, res, next) => {
  try {
    const categories = await prisma.subjectCategory.findMany({
      where: { centerId: req.centerId },
      include: { _count: { select: { filiereSubjects: true, offerings: true } } },
      orderBy: { order: "asc" },
    });
    res.json(categories);
  } catch (err) {
    next(err);
  }
});

router.post("/categories", verifyJwt, requirePermission("formations.create", "center.update"), async (req, res, next) => {
  try {
    const { name, code, order, isEliminatory } = req.body || {};
    if (!name || !name.trim()) return res.status(400).json({ error: "L'intitulé de la catégorie est obligatoire." });

    const count = await prisma.subjectCategory.count({ where: { centerId: req.centerId } });
    const created = await prisma.subjectCategory.create({
      data: {
        centerId: req.centerId,
        name: name.trim(),
        code: code ? code.trim().toUpperCase() : null,
        order: order ? parseInt(order, 10) : count + 1,
        isEliminatory: Boolean(isEliminatory),
      },
    });
    res.status(201).json(created);
  } catch (err) {
    if (err.code === "P2002") return res.status(409).json({ error: "Une catégorie porte déjà cet intitulé." });
    next(err);
  }
});

router.put("/categories/:id", verifyJwt, requirePermission("formations.update", "center.update"), async (req, res, next) => {
  try {
    const { name, code, order, isEliminatory } = req.body || {};
    const updated = await prisma.subjectCategory.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name: name.trim() }),
        ...(code !== undefined && { code: code ? code.trim().toUpperCase() : null }),
        ...(order !== undefined && { order: parseInt(order, 10) }),
        ...(isEliminatory !== undefined && { isEliminatory: Boolean(isEliminatory) }),
      },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.delete("/categories/:id", verifyJwt, requirePermission("formations.delete", "center.update"), async (req, res, next) => {
  try {
    const [templateUsage, classUsage] = await Promise.all([
      prisma.filiereSubject.count({ where: { categoryId: req.params.id } }),
      prisma.subjectOffering.count({ where: { categoryId: req.params.id } }),
    ]);

    if (templateUsage > 0 || classUsage > 0) {
      return res.status(409).json({
        error: `Impossible de supprimer cette catégorie : elle est utilisée par ${templateUsage + classUsage} cours.`,
      });
    }

    await prisma.subjectCategory.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// 2. RÉFÉRENTIEL DES MATIÈRES & IMPORTATION CSV
router.get("/subjects", verifyJwt, requirePermission("formations.read", "grades.read", "students.read"), async (req, res, next) => {
  try {
    const subjects = await prisma.subject.findMany({
      where: { centerId: req.centerId },
      include: { _count: { select: { filiereTemplates: true, offerings: true } } },
      orderBy: { name: "asc" },
    });
    res.json(subjects);
  } catch (err) {
    next(err);
  }
});

router.post("/subjects", verifyJwt, requirePermission("formations.create", "center.update"), async (req, res, next) => {
  try {
    const { name, code } = req.body || {};
    if (!name || !name.trim()) return res.status(400).json({ error: "L'intitulé de la matière est requis." });

    let finalCode = code ? code.trim().toUpperCase() : null;
    if (finalCode) {
      if (!validateSubjectCode(finalCode)) {
        return res.status(400).json({ error: "Le code matière doit comporter exactement 5 caractères majuscules (ex: THM01)." });
      }
    } else {
      const count = await prisma.subject.count({ where: { centerId: req.centerId } });
      finalCode = generateSubjectCode(name, count + 1);
    }

    const created = await prisma.subject.create({
      data: { centerId: req.centerId, name: name.trim(), code: finalCode },
    });
    res.status(201).json(created);
  } catch (err) {
    if (err.code === "P2002") return res.status(409).json({ error: "Ce code matière de 5 caractères existe déjà." });
    next(err);
  }
});

router.post("/subjects/import", verifyJwt, requirePermission("formations.create", "center.update"), async (req, res, next) => {
  try {
    const { subjects: items } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Liste de matières vide." });
    }

    let createdCount = 0;
    const errors = [];
    const existingCount = await prisma.subject.count({ where: { centerId: req.centerId } });

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const rowNum = i + 2;
      if (!item.name || !item.name.trim()) {
        errors.push({ row: rowNum, reason: "Intitulé de matière manquant" });
        continue;
      }

      let code = item.code ? item.code.trim().toUpperCase() : null;
      if (!code || !validateSubjectCode(code)) {
        code = generateSubjectCode(item.name, existingCount + createdCount + 1);
      }

      const exists = await prisma.subject.findFirst({
        where: { centerId: req.centerId, OR: [{ code }, { name: item.name.trim() }] },
      });

      if (exists) {
        errors.push({ row: rowNum, reason: `Matière ou code (${code}) déjà existant` });
        continue;
      }

      try {
        await prisma.subject.create({
          data: { centerId: req.centerId, name: item.name.trim(), code },
        });
        createdCount++;
      } catch (err) {
        errors.push({ row: rowNum, reason: err.message });
      }
    }

    res.json({
      success: true,
      createdCount,
      totalCount: items.length,
      errors,
      message: `${createdCount} matière(s) importée(s) avec succès.`,
    });
  } catch (err) {
    next(err);
  }
});

router.put("/subjects/:id", verifyJwt, requirePermission("formations.update", "center.update"), async (req, res, next) => {
  try {
    const { name, code } = req.body || {};
    let finalCode = undefined;
    if (code !== undefined) {
      finalCode = code ? code.trim().toUpperCase() : null;
      if (finalCode && !validateSubjectCode(finalCode)) {
        return res.status(400).json({ error: "Le code matière doit comporter exactement 5 caractères majuscules (ex: THM01)." });
      }
    }

    const updated = await prisma.subject.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name: name.trim() }),
        ...(finalCode !== undefined && { code: finalCode }),
      },
    });
    res.json(updated);
  } catch (err) {
    if (err.code === "P2002") return res.status(409).json({ error: "Ce code matière est déjà attribué." });
    next(err);
  }
});

router.delete("/subjects/:id", verifyJwt, requirePermission("formations.delete", "center.update"), async (req, res, next) => {
  try {
    const count = await prisma.subjectOffering.count({ where: { subjectId: req.params.id } });
    if (count > 0) return res.status(409).json({ error: `Cette matière est activement affectée à ${count} classe(s).` });

    await prisma.filiereSubject.deleteMany({ where: { subjectId: req.params.id } });
    await prisma.subject.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// 3. CURSUS PLURIANNUEL DE FILIÈRE
router.get("/filieres/:id/curriculum", verifyJwt, requirePermission("formations.read"), async (req, res, next) => {
  try {
    const filiere = await prisma.filiere.findFirst({
      where: { id: req.params.id, centerId: req.centerId },
      include: {
        programType: true,
        niveaux: { orderBy: { order: "asc" } },
        subjects: {
          include: { subject: true, category: true },
          orderBy: [{ niveauOrder: "asc" }, { semesterOrder: "asc" }],
        },
      },
    });

    if (!filiere) return res.status(404).json({ error: "Filière introuvable." });

    const curriculum = filiere.niveaux.map((niv) => {
      const nivSubjects = filiere.subjects.filter((s) => s.niveauOrder === niv.order);
      return {
        niveauOrder: niv.order,
        semesters: [
          { semesterOrder: 1, label: "Semestre 1", subjects: nivSubjects.filter((s) => s.semesterOrder === 1) },
          { semesterOrder: 2, label: "Semestre 2", subjects: nivSubjects.filter((s) => s.semesterOrder === 2) },
        ],
      };
    });

    res.json({
      filiere: { id: filiere.id, name: filiere.name, durationInYears: filiere.durationInYears, programType: filiere.programType },
      curriculum,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/filieres/:id/subjects", verifyJwt, requirePermission("formations.create", "formations.update"), async (req, res, next) => {
  try {
    const { niveauOrder, semesterOrder, subjectId, categoryId, defaultCoefficient, defaultVolumeHoraire } = req.body || {};
    if (!niveauOrder || !semesterOrder || !subjectId) {
      return res.status(400).json({ error: "Niveau, semestre et matière requis." });
    }

    const created = await prisma.filiereSubject.create({
      data: {
        centerId: req.centerId,
        filiereId: req.params.id,
        niveauOrder: parseInt(niveauOrder, 10),
        semesterOrder: parseInt(semesterOrder, 10),
        subjectId,
        categoryId: categoryId || null,
        defaultCoefficient: defaultCoefficient ? parseFloat(defaultCoefficient) : 2.0,
        defaultVolumeHoraire: defaultVolumeHoraire ? parseInt(defaultVolumeHoraire, 10) : null,
      },
      include: { subject: true, category: true },
    });
    res.status(201).json(created);
  } catch (err) {
    if (err.code === "P2002") return res.status(409).json({ error: "Cette matière est déjà enregistrée pour ce semestre dans cette filière." });
    next(err);
  }
});

router.put("/filieres/subjects/:id", verifyJwt, requirePermission("formations.update"), async (req, res, next) => {
  try {
    const { categoryId, defaultCoefficient, defaultVolumeHoraire } = req.body || {};
    const updated = await prisma.filiereSubject.update({
      where: { id: req.params.id },
      data: {
        ...(categoryId !== undefined && { categoryId: categoryId || null }),
        ...(defaultCoefficient && { defaultCoefficient: parseFloat(defaultCoefficient) }),
        ...(defaultVolumeHoraire !== undefined && { defaultVolumeHoraire: defaultVolumeHoraire ? parseInt(defaultVolumeHoraire, 10) : null }),
      },
      include: { subject: true, category: true },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.delete("/filieres/subjects/:id", verifyJwt, requirePermission("formations.delete", "formations.update"), async (req, res, next) => {
  try {
    await prisma.filiereSubject.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// 4. ANNUAIRE DES FORMATEURS & COMPTES
router.get("/formateurs", verifyJwt, requirePermission("formations.read", "grades.read", "center.read"), async (req, res, next) => {
  try {
    const formateurs = await prisma.formateur.findMany({
      where: { centerId: req.centerId },
      include: {
        user: { select: { id: true, email: true, isActive: true } },
        offerings: {
          include: { subject: true, classe: { include: { filiere: true } }, gradePeriod: true },
        },
        _count: { select: { offerings: true } },
      },
      orderBy: { lastName: "asc" },
    });
    res.json(formateurs);
  } catch (err) {
    next(err);
  }
});

router.post("/formateurs", verifyJwt, requirePermission("formations.create", "center.update"), async (req, res, next) => {
  try {
    const { firstName, lastName, email, phone, specialite } = req.body || {};
    if (!firstName || !lastName) return res.status(400).json({ error: "Nom et prénom requis." });

    const created = await prisma.formateur.create({
      data: {
        centerId: req.centerId,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email ? email.trim() : null,
        phone: phone ? phone.trim() : null,
        specialite: specialite ? specialite.trim() : null,
      },
      include: { user: true },
    });
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

router.post("/formateurs/import", verifyJwt, requirePermission("formations.create", "center.update"), async (req, res, next) => {
  try {
    const { formateurs: items } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: "Liste d'enseignants vide." });

    let createdCount = 0;
    const errors = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const rowNum = i + 2;
      if (!item.lastName || !item.firstName) {
        errors.push({ row: rowNum, reason: "Nom ou prénom manquant" });
        continue;
      }

      try {
        await prisma.formateur.create({
          data: {
            centerId: req.centerId,
            firstName: item.firstName.trim(),
            lastName: item.lastName.trim(),
            email: item.email ? item.email.trim() : null,
            phone: item.phone ? item.phone.trim() : null,
            specialite: item.specialite ? item.specialite.trim() : null,
          },
        });
        createdCount++;
      } catch (err) {
        errors.push({ row: rowNum, reason: err.message });
      }
    }

    res.json({ success: true, createdCount, totalCount: items.length, errors, message: `${createdCount} enseignant(s) importé(s) avec succès.` });
  } catch (err) {
    next(err);
  }
});

router.put("/formateurs/:id", verifyJwt, requirePermission("formations.update", "center.update"), async (req, res, next) => {
  try {
    const { firstName, lastName, email, phone, specialite } = req.body || {};
    const updated = await prisma.formateur.update({
      where: { id: req.params.id },
      data: {
        ...(firstName && { firstName: firstName.trim() }),
        ...(lastName && { lastName: lastName.trim() }),
        ...(email !== undefined && { email: email ? email.trim() : null }),
        ...(phone !== undefined && { phone: phone ? phone.trim() : null }),
        ...(specialite !== undefined && { specialite: specialite ? specialite.trim() : null }),
      },
      include: { user: true },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.post("/formateurs/:id/account", verifyJwt, requirePermission("users.create", "center.update"), async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    const formateur = await prisma.formateur.findFirst({
      where: { id: req.params.id, centerId: req.centerId },
    });

    if (!formateur) return res.status(404).json({ error: "Formateur introuvable." });
    if (formateur.userId) return res.status(409).json({ error: "Ce formateur possède déjà un compte d'accès." });

    const userEmail = (email || formateur.email || `${formateur.firstName.toLowerCase()}.${formateur.lastName.toLowerCase()}@ceco.local`).trim();
    const userPassword = password || "prof1234";

    let formateurRole = await prisma.role.findFirst({ where: { centerId: req.centerId, name: "Formateur" } });
    if (!formateurRole) {
      formateurRole = await prisma.role.create({
        data: {
          centerId: req.centerId,
          name: "Formateur",
          isSystem: true,
          permissions: {
            create: [{ action: "formations.read" }, { action: "grades.read" }, { action: "grades.create" }, { action: "grades.update" }],
          },
        },
      });
    }

    const hashedPassword = await bcrypt.hash(userPassword, 10);
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          centerId: req.centerId,
          email: userEmail,
          password: hashedPassword,
          firstName: formateur.firstName,
          lastName: formateur.lastName,
          roleId: formateurRole.id,
          isActive: true,
        },
      });

      return tx.formateur.update({
        where: { id: formateur.id },
        data: { userId: user.id },
        include: { user: { select: { id: true, email: true, isActive: true } } },
      });
    });

    res.status(201).json({ success: true, message: `Compte d'accès créé : ${userEmail}`, formateur: result });
  } catch (err) {
    if (err.code === "P2002") return res.status(409).json({ error: "Cette adresse email est déjà attribuée." });
    next(err);
  }
});

router.delete("/formateurs/:id", verifyJwt, requirePermission("formations.delete", "center.update"), async (req, res, next) => {
  try {
    const count = await prisma.subjectOffering.count({ where: { formateurId: req.params.id } });
    if (count > 0) return res.status(409).json({ error: `Ce formateur dispense actuellement ${count} cours.` });
    await prisma.formateur.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// 5. MAQUETTES DE COURS & INSTANCIATION PAR CLASSE
router.get("/pedagogie/my-offerings", verifyJwt, requirePermission("grades.read"), async (req, res, next) => {
  try {
    const connectedFormateur = await getConnectedFormateur(req);
    if (!connectedFormateur) return res.json([]);

    const offerings = await prisma.subjectOffering.findMany({
      where: {
        formateurId: connectedFormateur.id,
        classe: { centerId: req.centerId, academicYear: { isCurrent: true } },
      },
      include: {
        subject: true,
        category: true,
        gradePeriod: true,
        classe: { include: { filiere: true } },
        _count: { select: { grades: true } },
      },
      orderBy: [{ gradePeriod: { order: "asc" } }, { classe: { label: "asc" } }, { subject: { name: "asc" } }],
    });

    res.json(
      offerings.map((o) => ({
        id: o.id,
        subjectId: o.subjectId,
        subjectName: o.subject.name,
        subjectCode: o.subject.code,
        categoryName: o.category?.name || "Général",
        coefficient: o.coefficient,
        volumeHoraire: o.volumeHoraire,
        classeId: o.classeId,
        classeLabel: o.classe.label,
        filiereName: o.classe.filiere.name,
        semesterOrder: o.gradePeriod.order,
        semesterLabel: o.gradePeriod.label,
        academicYearId: o.classe.academicYearId,
        hasGrades: (o._count?.grades || 0) > 0,
      }))
    );
  } catch (err) {
    next(err);
  }
});

router.get("/classes/:classeId/offerings", verifyJwt, requirePermission("formations.read", "grades.read"), async (req, res, next) => {
  try {
    const classe = await prisma.classe.findFirst({
      where: { id: req.params.classeId, centerId: req.centerId },
      include: { academicYear: true },
    });
    if (!classe) return res.status(404).json({ error: "Classe introuvable." });

    const allPeriods = await ensureYearGradePeriods(req.centerId, classe.academicYear);
    const semesterPeriods = allPeriods.filter((p) => p.type === "SEMESTRE");

    const connectedFormateur = await getConnectedFormateur(req);
    const whereOffering = {
      classeId: req.params.classeId,
      ...(connectedFormateur ? { formateurId: connectedFormateur.id } : {}),
    };

    const offerings = await prisma.subjectOffering.findMany({
      where: whereOffering,
      include: { subject: true, category: true, formateur: true, gradePeriod: true, _count: { select: { grades: true } } },
      orderBy: [{ gradePeriod: { order: "asc" } }, { category: { order: "asc" } }, { subject: { name: "asc" } }],
    });

    res.json({ offerings, periods: semesterPeriods, isEditable: classe.academicYear.status !== "CLOSED" });
  } catch (err) {
    next(err);
  }
});

router.post("/classes/instantiate-template", verifyJwt, requirePermission("formations.update"), async (req, res, next) => {
  try {
    const { classeId, targetYearId, mode = "FILIERE_TEMPLATE", scope = "SINGLE_CLASS" } = req.body || {};

    let targetClasses = [];
    if (scope === "ALL_CENTER") {
      const year = await assertEditableAcademicYear(targetYearId, req.centerId);
      targetClasses = await prisma.classe.findMany({
        where: { centerId: req.centerId, academicYearId: year.id },
        include: { niveau: true, academicYear: true },
      });
    } else {
      if (!classeId) return res.status(400).json({ error: "Identifiant de classe requis." });
      const cls = await prisma.classe.findFirst({
        where: { id: classeId, centerId: req.centerId },
        include: { niveau: true, academicYear: true },
      });
      if (!cls) return res.status(404).json({ error: "Classe introuvable." });
      await assertEditableAcademicYear(cls.academicYearId, req.centerId);
      targetClasses = [cls];
    }

    if (targetClasses.length === 0) return res.status(400).json({ error: "Aucune classe éligible trouvée." });

    let createdCount = 0;
    await prisma.$transaction(async (tx) => {
      for (const targetCls of targetClasses) {
        const allPeriods = await ensureYearGradePeriods(req.centerId, targetCls.academicYear);

        if (mode === "PREVIOUS_SESSION") {
          const prevYear = await tx.academicYear.findFirst({
            where: { centerId: req.centerId, id: { not: targetCls.academicYearId } },
            orderBy: { startDate: "desc" },
          });

          if (prevYear) {
            const prevClass = await tx.classe.findFirst({
              where: { centerId: req.centerId, filiereId: targetCls.filiereId, niveauId: targetCls.niveauId, academicYearId: prevYear.id },
            });

            if (prevClass) {
              const prevOfferings = await tx.subjectOffering.findMany({ where: { classeId: prevClass.id }, include: { gradePeriod: true } });
              for (const po of prevOfferings) {
                const targetPeriod = allPeriods.find((p) => p.type === "SEMESTRE" && p.order === po.gradePeriod.order);
                if (!targetPeriod) continue;

                const exists = await tx.subjectOffering.findUnique({
                  where: { subjectId_classeId_gradePeriodId: { subjectId: po.subjectId, classeId: targetCls.id, gradePeriodId: targetPeriod.id } },
                });

                if (!exists) {
                  await tx.subjectOffering.create({
                    data: {
                      subjectId: po.subjectId,
                      classeId: targetCls.id,
                      gradePeriodId: targetPeriod.id,
                      categoryId: po.categoryId,
                      formateurId: po.formateurId,
                      coefficient: po.coefficient,
                      volumeHoraire: po.volumeHoraire,
                    },
                  });
                  createdCount++;
                }
              }
            }
          }
        }

        if (mode === "FILIERE_TEMPLATE" || createdCount === 0) {
          const templateSubjects = await tx.filiereSubject.findMany({
            where: { filiereId: targetCls.filiereId, niveauOrder: targetCls.niveau.order, centerId: req.centerId },
          });

          for (const ts of templateSubjects) {
            const period = allPeriods.find((gp) => gp.type === "SEMESTRE" && gp.order === ts.semesterOrder);
            if (!period) continue;

            const exists = await tx.subjectOffering.findUnique({
              where: { subjectId_classeId_gradePeriodId: { subjectId: ts.subjectId, classeId: targetCls.id, gradePeriodId: period.id } },
            });

            if (!exists) {
              await tx.subjectOffering.create({
                data: {
                  subjectId: ts.subjectId,
                  classeId: targetCls.id,
                  gradePeriodId: period.id,
                  categoryId: ts.categoryId,
                  coefficient: ts.defaultCoefficient,
                  volumeHoraire: ts.defaultVolumeHoraire,
                },
              });
              createdCount++;
            }
          }
        }
      }
    });

    res.json({ success: true, createdCount, message: `${createdCount} cours instancié(s) avec succès.` });
  } catch (err) {
    next(err);
  }
});

router.post("/classes/:classeId/offerings", verifyJwt, requirePermission("formations.update"), async (req, res, next) => {
  try {
    const { subjectId, gradePeriodId, categoryId, formateurId, coefficient, volumeHoraire } = req.body || {};
    if (!subjectId || !gradePeriodId) return res.status(400).json({ error: "Matière et semestre requis." });

    const classe = await prisma.classe.findUnique({ where: { id: req.params.classeId } });
    if (!classe) return res.status(404).json({ error: "Classe introuvable." });

    await assertEditableAcademicYear(classe.academicYearId, req.centerId);

    const created = await prisma.subjectOffering.create({
      data: {
        classeId: req.params.classeId,
        subjectId,
        gradePeriodId,
        categoryId: categoryId || null,
        formateurId: formateurId || null,
        coefficient: coefficient ? parseFloat(coefficient) : 2.0,
        volumeHoraire: volumeHoraire ? parseInt(volumeHoraire, 10) : null,
      },
      include: { subject: true, category: true, formateur: true, gradePeriod: true },
    });
    res.status(201).json(created);
  } catch (err) {
    if (err.code === "P2002") return res.status(409).json({ error: "Cette matière est déjà affectée à ce semestre." });
    next(err);
  }
});

router.put("/offerings/:id", verifyJwt, requirePermission("formations.update"), async (req, res, next) => {
  try {
    const { categoryId, formateurId, coefficient, volumeHoraire } = req.body || {};
    const existing = await prisma.subjectOffering.findUnique({ where: { id: req.params.id }, include: { classe: true } });
    if (!existing) return res.status(404).json({ error: "Cours introuvable." });

    await assertEditableAcademicYear(existing.classe.academicYearId, req.centerId);

    const updated = await prisma.subjectOffering.update({
      where: { id: req.params.id },
      data: {
        ...(categoryId !== undefined && { categoryId: categoryId || null }),
        ...(formateurId !== undefined && { formateurId: formateurId || null }),
        ...(coefficient && { coefficient: parseFloat(coefficient) }),
        ...(volumeHoraire !== undefined && { volumeHoraire: volumeHoraire ? parseInt(volumeHoraire, 10) : null }),
      },
      include: { subject: true, category: true, formateur: true, gradePeriod: true },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.delete("/offerings/:id", verifyJwt, requirePermission("formations.delete", "formations.update"), async (req, res, next) => {
  try {
    const existing = await prisma.subjectOffering.findUnique({ where: { id: req.params.id }, include: { classe: true } });
    if (!existing) return res.status(404).json({ error: "Cours introuvable." });

    await assertEditableAcademicYear(existing.classe.academicYearId, req.centerId);

    const count = await prisma.grade.count({ where: { subjectOfferingId: req.params.id } });
    if (count > 0) return res.status(409).json({ error: `Impossible de retirer ce cours : ${count} note(s) y sont déjà enregistrées.` });
    await prisma.subjectOffering.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// 6. POLITIQUES DE PONDÉRATION
router.get("/grading-policies", verifyJwt, requirePermission("formations.read", "center.read"), async (req, res, next) => {
  try {
    const policies = await prisma.gradingPolicy.findMany({
      where: { centerId: req.centerId },
      include: { filiere: true },
      orderBy: { effectiveFrom: "desc" },
    });
    res.json(policies);
  } catch (err) {
    next(err);
  }
});

router.post("/grading-policies", verifyJwt, requirePermission("formations.update", "center.update"), async (req, res, next) => {
  try {
    const { filiereId, ccWeight, normalWeight } = req.body || {};
    const cc = parseFloat(ccWeight);
    const norm = parseFloat(normalWeight);

    if (Math.abs(cc + norm - 1.0) > 0.001) {
      return res.status(400).json({ error: "La somme des pourcentages doit être strictement égale à 100%." });
    }

    const created = await prisma.gradingPolicy.create({
      data: {
        centerId: req.centerId,
        filiereId: filiereId || null,
        ccWeight: cc,
        normalWeight: norm,
      },
      include: { filiere: true },
    });
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

// 7. TABLEAU DE BORD & KPIS
router.get("/pedagogie/dashboard-kpis", verifyJwt, async (req, res, next) => {
  try {
    const connectedFormateur = await getConnectedFormateur(req);
    const isTeacher = Boolean(connectedFormateur);

    const currentUser = await prisma.user.findUnique({ where: { id: req.userId }, include: { role: true } });
    const roleName = currentUser?.role?.name?.toLowerCase() || "";
    const isSecretary = roleName.includes("secrétaire") || roleName.includes("secretaire");
    const roleType = isTeacher ? "TEACHER" : isSecretary ? "SECRETARY" : "ADMIN";

    const activeYear = await prisma.academicYear.findFirst({
      where: { centerId: req.centerId, isCurrent: true },
      include: { gradePeriods: { orderBy: { order: "asc" } } },
    });

    if (!activeYear) {
      return res.json({
        hasActiveYear: false,
        activeYear: null,
        roleType,
        stats: {
          totalStudents: 0,
          totalClasses: 0,
          totalOfferings: 0,
          completedOfferings: 0,
          completionRate: 0,
          globalPassRate: null,
          dataQualityScore: 100,
          sessionProgressPercent: 0,
          roomOccupationRate: 0,
        },
        mockExamStats: null,
        criticalSubjects: [],
        pendingOfferings: [],
        teacherLoads: [],
        cohortDistribution: [],
        incompleteStudentsList: [],
        myOfferingsList: [],
        recentAuditLogs: [],
      });
    }

    const startMs = new Date(activeYear.startDate).getTime();
    const endMs = new Date(activeYear.endDate).getTime();
    const nowMs = Date.now();
    const totalSessionMs = Math.max(1, endMs - startMs);
    const elapsedSessionMs = Math.max(0, Math.min(totalSessionMs, nowMs - startMs));
    const sessionProgressPercent = Math.round((elapsedSessionMs / totalSessionMs) * 100);

    const offerings = await prisma.subjectOffering.findMany({
      where: {
        classe: { academicYearId: activeYear.id, centerId: req.centerId },
        ...(isTeacher ? { formateurId: connectedFormateur.id } : {}),
      },
      include: { subject: true, category: true, formateur: true, classe: true, gradePeriod: true, _count: { select: { grades: true } } },
    });

    const classes = await prisma.classe.findMany({
      where: {
        centerId: req.centerId,
        academicYearId: activeYear.id,
        ...(isTeacher ? { id: { in: offerings.map((o) => o.classeId) } } : {}),
      },
      include: {
        filiere: true,
        inscriptions: { where: { student: { deletedAt: null } }, include: { student: true, promotion: true } },
      },
    });

    const subjectResults = await prisma.subjectResult.findMany({
      where: {
        centerId: req.centerId,
        gradePeriod: { academicYearId: activeYear.id },
        ...(isTeacher ? { subjectId: { in: offerings.map((o) => o.subjectId) } } : {}),
      },
      include: { subject: true },
    });

    const allInscriptions = await prisma.inscription.findMany({
      where: { centerId: req.centerId, academicYearId: activeYear.id, student: { deletedAt: null } },
      include: { student: true, classe: true },
    });

    const uniqueStudentsMap = new Map();
    allInscriptions.forEach((i) => uniqueStudentsMap.set(i.studentId, { ...i.student, classeLabel: i.classe?.label }));
    const uniqueStudents = Array.from(uniqueStudentsMap.values());

    const incompleteStudentsList = [];
    let completeDossiersCount = 0;

    uniqueStudents.forEach((st) => {
      const missing = [];
      if (!st.photoPath) missing.push("Photo manquante");
      if (!st.guardianPhone && !st.guardianName) missing.push("Contact tuteur manquant");
      if (!st.birthDate) missing.push("Date naissance manquante");
      if (!st.entryDiploma) missing.push("Diplôme d'entrée non spécifié");

      if (missing.length === 0) completeDossiersCount++;
      else if (incompleteStudentsList.length < 8) {
        incompleteStudentsList.push({
          id: st.id,
          matricule: st.matricule,
          fullName: `${st.lastName} ${st.firstName}`,
          classeLabel: st.classeLabel || "—",
          missingReasons: missing,
        });
      }
    });

    const dataQualityScore = uniqueStudents.length > 0
      ? Number(((completeDossiersCount / uniqueStudents.length) * 100).toFixed(1))
      : 100;

    const totalStudents = classes.reduce((sum, c) => sum + (c.inscriptions?.length || 0), 0);
    const totalOfferings = offerings.length;
    const completedOfferings = offerings.filter((o) => (o._count?.grades || 0) > 0).length;
    const pendingOfferings = offerings.filter((o) => (o._count?.grades || 0) === 0);
    const completionRate = totalOfferings > 0 ? Math.round((completedOfferings / totalOfferings) * 100) : 0;

    const evaluatedResults = subjectResults.filter((r) => r.finalGrade !== null);
    const passedResultsCount = evaluatedResults.filter((r) => r.finalGrade >= 10.0).length;
    const globalPassRate = evaluatedResults.length > 0 ? Math.round((passedResultsCount / evaluatedResults.length) * 100) : null;

    let myOfferingsList = [];
    if (isTeacher) {
      myOfferingsList = offerings.map((o) => ({
        id: o.id,
        subjectName: o.subject?.name,
        classeLabel: o.classe?.label,
        semesterLabel: o.gradePeriod?.label,
        coefficient: o.coefficient,
        volumeHoraire: o.volumeHoraire || 0,
        hasGrades: (o._count?.grades || 0) > 0,
      }));
    }

    res.json({
      hasActiveYear: true,
      activeYear: { id: activeYear.id, label: activeYear.label, startDate: activeYear.startDate, endDate: activeYear.endDate },
      roleType,
      stats: {
        totalStudents,
        totalClasses: classes.length,
        totalOfferings,
        completedOfferings,
        completionRate,
        globalPassRate,
        dataQualityScore,
        sessionProgressPercent,
        roomOccupationRate: 0,
      },
      criticalSubjects: [],
      pendingOfferings: pendingOfferings.slice(0, 5).map((o) => ({
        id: o.id,
        subjectName: o.subject?.name || "Matière",
        classeLabel: o.classe?.label || "Classe",
        semesterLabel: o.gradePeriod?.label || "Semestre",
        formateurName: o.formateur ? `${o.formateur.firstName} ${o.formateur.lastName}` : "Non assigné",
      })),
      teacherLoads: [],
      cohortDistribution: [],
      incompleteStudentsList,
      recentAuditLogs: [],
      myOfferingsList,
    });
  } catch (err) {
    next(err);
  }
});

// 8. DÉLÉGATION AU SOUS-MODULE SPÉCIALISÉ DES DÉLIBÉRATIONS (SRP)
router.use("/", require("./deliberations"));

module.exports = router;