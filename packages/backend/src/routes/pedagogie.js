// packages/backend/src/routes/pedagogie.js
const express = require("express");
const bcrypt = require("bcryptjs");
const prisma = require("../prismaClient");
const { verifyJwt } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");
const { assertEditableAcademicYear, assertActiveAcademicYear } = require("../middleware/academicYearGuard");

const router = express.Router();

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

async function getConnectedFormateur(req) {
  if (!req.userId) return null;
  return prisma.formateur.findFirst({
    where: { centerId: req.centerId, userId: req.userId },
  });
}

// ============================================================================
// 1. CATÉGORIES / GROUPES D'ENSEIGNEMENT (100% DYNAMIQUES)
// ============================================================================
router.get("/categories", verifyJwt, requirePermission("formations.read", "grades.read", "students.read"), async (req, res, next) => {
  try {
    const categories = await prisma.subjectCategory.findMany({
      where: { centerId: req.centerId },
      include: {
        _count: { select: { filiereSubjects: true, offerings: true } },
      },
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
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "L'intitulé de la catégorie est obligatoire." });
    }

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
    if (err.code === "P2002") {
      return res.status(409).json({ error: "Une catégorie porte déjà cet intitulé dans votre établissement." });
    }
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
        error: `Impossible de supprimer cette catégorie : elle est utilisée par ${templateUsage + classUsage} matière(s) dans des maquettes de cours.`,
      });
    }

    await prisma.subjectCategory.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// 2. RÉFÉRENTIEL DES MATIÈRES & CODES À 5 CARACTÈRES
// ============================================================================
router.get("/subjects", verifyJwt, requirePermission("formations.read", "grades.read", "students.read"), async (req, res, next) => {
  try {
    const subjects = await prisma.subject.findMany({
      where: { centerId: req.centerId },
      include: {
        _count: { select: { filiereTemplates: true, offerings: true } },
      },
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
        return res.status(400).json({ error: "Le code matière doit comporter exactement 5 caractères alphanumériques majuscules (ex: THM01, INF02)." });
      }
    } else {
      const count = await prisma.subject.count({ where: { centerId: req.centerId } });
      finalCode = generateSubjectCode(name, count + 1);
    }

    const created = await prisma.subject.create({
      data: {
        centerId: req.centerId,
        name: name.trim(),
        code: finalCode,
      },
    });
    res.status(201).json(created);
  } catch (err) {
    if (err.code === "P2002") return res.status(409).json({ error: "Ce code matière de 5 caractères existe déjà dans l'établissement." });
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
        return res.status(400).json({ error: "Le code matière doit comporter exactement 5 caractères alphanumériques majuscules (ex: THM01, INF02)." });
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
    if (err.code === "P2002") return res.status(409).json({ error: "Ce code matière de 5 caractères est déjà attribué." });
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

// ============================================================================
// 3. CURSUS PLURIANNUEL DE FILIÈRE
// ============================================================================
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
          {
            semesterOrder: 1,
            label: "Semestre 1",
            subjects: nivSubjects.filter((s) => s.semesterOrder === 1),
          },
          {
            semesterOrder: 2,
            label: "Semestre 2",
            subjects: nivSubjects.filter((s) => s.semesterOrder === 2),
          },
        ],
      };
    });

    res.json({
      filiere: {
        id: filiere.id,
        name: filiere.name,
        durationInYears: filiere.durationInYears,
        programType: filiere.programType,
      },
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
    if (err.code === "P2002") {
      return res.status(409).json({ error: "Cette matière est déjà enregistrée pour ce semestre dans cette filière." });
    }
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

// ============================================================================
// 4. ANNUAIRE DES FORMATEURS & COMPTE UTILISATEUR EN 1 CLIC
// ============================================================================
router.get("/formateurs", verifyJwt, requirePermission("formations.read", "grades.read", "center.read"), async (req, res, next) => {
  try {
    const formateurs = await prisma.formateur.findMany({
      where: { centerId: req.centerId },
      include: {
        user: { select: { id: true, email: true, isActive: true } },
        offerings: {
          include: {
            subject: true,
            classe: { include: { filiere: true } },
            gradePeriod: true,
          },
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

    let formateurRole = await prisma.role.findFirst({
      where: { centerId: req.centerId, name: "Formateur" },
    });

    if (!formateurRole) {
      formateurRole = await prisma.role.create({
        data: {
          centerId: req.centerId,
          name: "Formateur",
          isSystem: false,
          permissions: {
            create: [
              { action: "formations.read" },
              { action: "grades.read" },
              { action: "grades.create" },
              { action: "grades.update" },
            ],
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

    res.status(201).json({
      success: true,
      message: `Compte d'accès créé : ${userEmail} (mot de passe initial : ${userPassword})`,
      formateur: result,
    });
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "Cette adresse email est déjà attribuée à un compte utilisateur." });
    }
    next(err);
  }
});

router.delete("/formateurs/:id", verifyJwt, requirePermission("formations.delete", "center.update"), async (req, res, next) => {
  try {
    const count = await prisma.subjectOffering.count({ where: { formateurId: req.params.id } });
    if (count > 0) return res.status(409).json({ error: `Ce formateur dispense actuellement ${count} cours actif(s).` });
    await prisma.formateur.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ============================================================================
// 5. MAQUETTE PÉDAGOGIQUE PAR CLASSE & INSTANCIATION AVANCÉE
// ============================================================================
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
      include: {
        subject: true,
        category: true,
        formateur: true,
        gradePeriod: true,
        _count: { select: { grades: true } },
      },
      orderBy: [{ gradePeriod: { order: "asc" } }, { category: { order: "asc" } }, { subject: { name: "asc" } }],
    });

    res.json({
      offerings,
      periods: semesterPeriods,
      isEditable: classe.academicYear.status !== "CLOSED",
    });
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

    if (targetClasses.length === 0) {
      return res.status(400).json({ error: "Aucune classe éligible trouvée pour cette opération." });
    }

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
              where: {
                centerId: req.centerId,
                filiereId: targetCls.filiereId,
                niveauId: targetCls.niveauId,
                academicYearId: prevYear.id,
              },
            });

            if (prevClass) {
              const prevOfferings = await tx.subjectOffering.findMany({
                where: { classeId: prevClass.id },
                include: { gradePeriod: true },
              });

              for (const po of prevOfferings) {
                const targetPeriod = allPeriods.find((p) => p.type === "SEMESTRE" && p.order === po.gradePeriod.order);
                if (!targetPeriod) continue;

                const exists = await tx.subjectOffering.findUnique({
                  where: {
                    subjectId_classeId_gradePeriodId: {
                      subjectId: po.subjectId,
                      classeId: targetCls.id,
                      gradePeriodId: targetPeriod.id,
                    },
                  },
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
              where: {
                subjectId_classeId_gradePeriodId: {
                  subjectId: ts.subjectId,
                  classeId: targetCls.id,
                  gradePeriodId: period.id,
                },
              },
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

    res.json({
      success: true,
      createdCount,
      message: `${createdCount} cours instancié(s) avec succès (${mode === "PREVIOUS_SESSION" ? "Reconduction avec formateurs" : "Depuis maquette filière"}).`,
    });
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

// ============================================================================
// 6. POLITIQUES DE PONDÉRATION (30/70, 40/60...)
// ============================================================================
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
      return res.status(400).json({ error: "La somme des pourcentages doit être strictement égale à 100% (ex: 30% CC + 70% Examen)." });
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

// ============================================================================
// 7. ANALYTIQUE & KPIS PÉDAGOGIQUES
// ============================================================================
router.get("/pedagogie/dashboard-kpis", verifyJwt, requirePermission("grades.read", "formations.read", "students.read"), async (req, res, next) => {
  try {
    const connectedFormateur = await getConnectedFormateur(req);
    const isTeacher = Boolean(connectedFormateur);

    const activeYear = await prisma.academicYear.findFirst({
      where: { centerId: req.centerId, isCurrent: true },
      include: { gradePeriods: { where: { type: "SEMESTRE" }, orderBy: { order: "asc" } } },
    });

    if (!activeYear) {
      return res.json({
        hasActiveYear: false,
        activeYear: null,
        isTeacher,
        stats: {
          totalStudents: 0,
          totalClasses: 0,
          totalOfferings: 0,
          completedOfferings: 0,
          completionRate: 0,
          globalPassRate: null,
        },
        criticalSubjects: [],
        pendingOfferings: [],
        teacherLoads: [],
        cohortDistribution: [],
      });
    }

    const offerings = await prisma.subjectOffering.findMany({
      where: {
        classe: { academicYearId: activeYear.id, centerId: req.centerId },
        ...(isTeacher ? { formateurId: connectedFormateur.id } : {}),
      },
      include: {
        subject: true,
        category: true,
        formateur: true,
        classe: true,
        gradePeriod: true,
        _count: { select: { grades: true } },
      },
    });

    const classes = await prisma.classe.findMany({
      where: {
        centerId: req.centerId,
        academicYearId: activeYear.id,
        ...(isTeacher ? { id: { in: offerings.map((o) => o.classeId) } } : {}),
      },
      include: {
        filiere: true,
        inscriptions: {
          where: { student: { deletedAt: null } },
          include: { student: true, promotion: true },
        },
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

    const totalStudents = classes.reduce((sum, c) => sum + (c.inscriptions?.length || 0), 0);
    const totalOfferings = offerings.length;
    const completedOfferings = offerings.filter((o) => (o._count?.grades || 0) > 0).length;
    const pendingOfferings = offerings.filter((o) => (o._count?.grades || 0) === 0);
    const completionRate = totalOfferings > 0 ? Math.round((completedOfferings / totalOfferings) * 100) : 0;

    const evaluatedResults = subjectResults.filter((r) => r.finalGrade !== null);
    const passedResultsCount = evaluatedResults.filter((r) => r.finalGrade >= 10.0).length;
    const globalPassRate = evaluatedResults.length > 0
      ? Math.round((passedResultsCount / evaluatedResults.length) * 100)
      : null;

    const criticalSubjects = [];
    if (!isTeacher) {
      offerings.forEach((off) => {
        const offResults = subjectResults.filter(
          (r) => r.subjectId === off.subjectId && r.gradePeriodId === off.gradePeriodId
        );
        if (offResults.length >= 3) {
          const failedCount = offResults.filter((r) => r.finalGrade < 10.0).length;
          const failureRate = Math.round((failedCount / offResults.length) * 100);
          const avg = Number((offResults.reduce((sum, r) => sum + r.finalGrade, 0) / offResults.length).toFixed(2));

          if (failureRate >= 35 || avg < 10.0) {
            criticalSubjects.push({
              offeringId: off.id,
              subjectName: off.subject?.name || "Matière",
              categoryName: off.category?.name || "Général",
              classeLabel: off.classe?.label || "Classe",
              semesterLabel: off.gradePeriod?.label || "Semestre",
              formateurName: off.formateur ? `${off.formateur.firstName} ${off.formateur.lastName}` : "Non assigné",
              failureRate,
              average: avg,
              totalEvaluated: offResults.length,
            });
          }
        }
      });
    }

    let teacherLoads = [];
    if (!isTeacher) {
      const allFormateurs = await prisma.formateur.findMany({
        where: { centerId: req.centerId },
        include: {
          offerings: {
            where: { classe: { academicYearId: activeYear.id } },
          },
        },
      });

      teacherLoads = allFormateurs.map((f) => {
        const totalHours = (f.offerings || []).reduce((sum, o) => sum + (o.volumeHoraire || 0), 0);
        return {
          id: f.id,
          name: `${f.firstName} ${f.lastName}`,
          specialite: f.specialite || "Enseignant",
          totalCourses: f.offerings?.length || 0,
          totalHours,
        };
      }).sort((a, b) => b.totalHours - a.totalHours);
    } else {
      const myHours = offerings.reduce((sum, o) => sum + (o.volumeHoraire || 0), 0);
      teacherLoads = [
        {
          id: connectedFormateur.id,
          name: `${connectedFormateur.firstName} ${connectedFormateur.lastName}`,
          specialite: connectedFormateur.specialite || "Enseignant",
          totalCourses: offerings.length,
          totalHours: myHours,
        },
      ];
    }

    let cohortDistribution = [];
    if (!isTeacher) {
      const promotions = await prisma.promotion.findMany({
        where: { centerId: req.centerId },
        include: { _count: { select: { inscriptions: true } }, filiere: true },
      });
      cohortDistribution = promotions.map((p) => ({
        id: p.id,
        label: p.label,
        filiereName: p.filiere?.name || "Filière",
        studentCount: p._count?.inscriptions || 0,
      })).filter((p) => p.studentCount > 0);
    }

    res.json({
      hasActiveYear: true,
      activeYear: {
        id: activeYear.id,
        label: activeYear.label,
      },
      isTeacher,
      stats: {
        totalStudents,
        totalClasses: classes.length,
        totalOfferings,
        completedOfferings,
        completionRate,
        globalPassRate,
      },
      criticalSubjects: criticalSubjects.slice(0, 5),
      pendingOfferings: pendingOfferings.slice(0, 5).map((o) => ({
        id: o.id,
        subjectName: o.subject?.name || "Matière",
        classeLabel: o.classe?.label || "Classe",
        semesterLabel: o.gradePeriod?.label || "Semestre",
        formateurName: o.formateur ? `${o.formateur.firstName} ${o.formateur.lastName}` : "Non assigné",
      })),
      teacherLoads: teacherLoads.slice(0, 6),
      cohortDistribution: cohortDistribution.slice(0, 6),
    });
  } catch (err) {
    next(err);
  }
});

// Endpoint contextuel direct pour les formateurs connectés
router.get("/pedagogie/my-offerings", verifyJwt, requirePermission("grades.read"), async (req, res, next) => {
  try {
    const connectedFormateur = await getConnectedFormateur(req);
    if (!connectedFormateur) {
      return res.json([]);
    }

    const offerings = await prisma.subjectOffering.findMany({
      where: {
        formateurId: connectedFormateur.id,
        classe: {
          centerId: req.centerId,
          academicYear: { isCurrent: true },
        },
      },
      include: {
        subject: true,
        category: true,
        gradePeriod: true,
        classe: { include: { filiere: true } },
        _count: { select: { grades: true } },
      },
      orderBy: [
        { gradePeriod: { order: "asc" } },
        { classe: { label: "asc" } },
        { subject: { name: "asc" } },
      ],
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
// ============================================================================
// 8. MOTEUR DE DÉLIBÉRATION (SEMESTRE & ANNUEL PAR AGRÉGATION S1+S2)
// ============================================================================
router.get("/deliberations", verifyJwt, requirePermission("grades.read", "formations.read"), async (req, res, next) => {
  try {
    const { classeId, gradePeriodId, scope = "ANNUEL" } = req.query || {};
    if (!classeId || !gradePeriodId) {
      return res.status(400).json({ error: "Classe et période d'évaluation requises." });
    }

    const [classe, period, existingDelib] = await Promise.all([
      prisma.classe.findFirst({
        where: { id: classeId, centerId: req.centerId },
        include: {
          filiere: { include: { programType: true } },
          niveau: true,
          academicYear: { include: { gradePeriods: true } },
          inscriptions: {
            where: { student: { deletedAt: null } },
            include: { student: true, promotion: true },
            orderBy: { student: { lastName: "asc" } },
          },
        },
      }),
      prisma.gradePeriod.findFirst({
        where: { id: gradePeriodId, centerId: req.centerId },
      }),
      prisma.deliberation.findUnique({
        where: {
          classeId_gradePeriodId_scope: {
            classeId,
            gradePeriodId,
            scope,
          },
        },
        include: { studentResults: { include: { student: true } } },
      }),
    ]);

    if (!classe) return res.status(404).json({ error: "Classe introuvable." });
    if (!period) return res.status(404).json({ error: "Période d'évaluation introuvable." });

    const offerings = await prisma.subjectOffering.findMany({
      where: {
        classeId,
        ...(scope === "SEMESTRE" ? { gradePeriodId } : {}),
      },
      include: { subject: true, category: true, gradePeriod: true },
      orderBy: [{ gradePeriod: { order: "asc" } }, { category: { order: "asc" } }, { subject: { name: "asc" } }],
    });

    const subjectResults = await prisma.subjectResult.findMany({
      where: {
        centerId: req.centerId,
        studentId: { in: classe.inscriptions.map((i) => i.studentId) },
        subjectId: { in: offerings.map((o) => o.subjectId) },
      },
    });

    const isFinalYear = classe.niveau.order >= classe.filiere.durationInYears;

    const studentsCalculation = classe.inscriptions.map((insc) => {
      const st = insc.student;
      const stExistingDelib = existingDelib?.studentResults?.find((d) => d.studentId === st.id);

      let totalPoints = 0;
      let totalCoeffs = 0;
      let hasEliminatoryGrade = false;
      const subjectsDetail = [];

      offerings.forEach((off) => {
        const sRes = subjectResults.find((r) => r.studentId === st.id && r.subjectId === off.subjectId);
        const gradeVal = sRes?.finalGrade !== undefined && sRes?.finalGrade !== null ? sRes.finalGrade : null;

        if (gradeVal !== null) {
          totalPoints += gradeVal * off.coefficient;
          totalCoeffs += off.coefficient;

          if (off.category?.isEliminatory && gradeVal < 8.0) {
            hasEliminatoryGrade = true;
          }
        }

        subjectsDetail.push({
          offeringId: off.id,
          subjectId: off.subjectId,
          subjectName: off.subject.name,
          subjectCode: off.subject.code,
          categoryName: off.category?.name || "Général",
          semesterLabel: off.gradePeriod?.label,
          coefficient: off.coefficient,
          grade: gradeVal,
        });
      });

      const computedAverage = totalCoeffs > 0 ? Number((totalPoints / totalCoeffs).toFixed(2)) : null;

      let autoDecision = "ajourne";
      if (computedAverage !== null) {
        if (computedAverage >= 10.0 && !hasEliminatoryGrade) {
          if (scope === "ANNUEL") {
            autoDecision = isFinalYear ? "diplome" : "admis";
          } else {
            autoDecision = "valide";
          }
        } else {
          autoDecision = scope === "ANNUEL" ? "redouble" : "ajourne";
        }
      }

      return {
        studentId: st.id,
        matricule: st.matricule,
        firstName: st.firstName,
        lastName: st.lastName,
        promotionLabel: insc.promotion?.label,
        currentInscriptionStatus: insc.status,
        totalPoints: Number(totalPoints.toFixed(2)),
        totalCoeffs,
        moyenne: stExistingDelib ? stExistingDelib.moyenne : computedAverage,
        decision: stExistingDelib ? stExistingDelib.decision : autoDecision,
        rang: stExistingDelib ? stExistingDelib.rang : null,
        hasEliminatoryGrade,
        subjectsDetail,
      };
    });

    const sorted = [...studentsCalculation]
      .filter((s) => s.moyenne !== null)
      .sort((a, b) => b.moyenne - a.moyenne);

    studentsCalculation.forEach((st) => {
      if (st.moyenne !== null) {
        st.calculatedRank = sorted.findIndex((s) => s.studentId === st.studentId) + 1;
        if (!st.rang) st.rang = st.calculatedRank;
      }
    });

    res.json({
      classe: {
        id: classe.id,
        label: classe.label,
        filiereName: classe.filiere.name,
        durationInYears: classe.filiere.durationInYears,
        niveauOrder: classe.niveau.order,
        isFinalYear,
      },
      period: {
        id: period.id,
        label: period.label,
        type: period.type,
      },
      scope,
      offerings,
      isDeliberated: Boolean(existingDelib),
      deliberationId: existingDelib?.id || null,
      juryDate: existingDelib?.juryDate || new Date().toISOString(),
      results: studentsCalculation,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/deliberations/auto-run", verifyJwt, requirePermission("grades.validate"), async (req, res, next) => {
  try {
    const { classeId, gradePeriodId, scope = "ANNUEL", juryDate } = req.body || {};
    if (!classeId || !gradePeriodId) {
      return res.status(400).json({ error: "Classe et période requises." });
    }

    const [classe, period] = await Promise.all([
      prisma.classe.findFirst({
        where: { id: classeId, centerId: req.centerId },
        include: {
          filiere: true,
          niveau: true,
          inscriptions: {
            where: { student: { deletedAt: null } },
            include: { student: true },
          },
        },
      }),
      prisma.gradePeriod.findFirst({ where: { id: gradePeriodId, centerId: req.centerId } }),
    ]);

    if (!classe) return res.status(404).json({ error: "Classe introuvable." });
    if (!period) return res.status(404).json({ error: "Période introuvable." });

    await assertEditableAcademicYear(classe.academicYearId, req.centerId);

    const offerings = await prisma.subjectOffering.findMany({
      where: {
        classeId,
        ...(scope === "SEMESTRE" ? { gradePeriodId } : {}),
      },
      include: { category: true },
    });

    const subjectResults = await prisma.subjectResult.findMany({
      where: {
        centerId: req.centerId,
        studentId: { in: classe.inscriptions.map((i) => i.studentId) },
        subjectId: { in: offerings.map((o) => o.subjectId) },
      },
    });

    const isFinalYear = classe.niveau.order >= classe.filiere.durationInYears;
    const finalJuryDate = juryDate ? new Date(juryDate) : new Date();

    const computedList = classe.inscriptions.map((insc) => {
      const st = insc.student;
      let totalPoints = 0;
      let totalCoeffs = 0;
      let hasEliminatoryGrade = false;

      offerings.forEach((off) => {
        const sRes = subjectResults.find((r) => r.studentId === st.id && r.subjectId === off.subjectId);
        const gradeVal = sRes?.finalGrade !== undefined && sRes?.finalGrade !== null ? sRes.finalGrade : null;

        if (gradeVal !== null) {
          totalPoints += gradeVal * off.coefficient;
          totalCoeffs += off.coefficient;

          if (off.category?.isEliminatory && gradeVal < 8.0) {
            hasEliminatoryGrade = true;
          }
        }
      });

      const moyenne = totalCoeffs > 0 ? Number((totalPoints / totalCoeffs).toFixed(2)) : null;

      let decision = "ajourne";
      if (moyenne !== null) {
        if (moyenne >= 10.0 && !hasEliminatoryGrade) {
          if (scope === "ANNUEL") {
            decision = isFinalYear ? "diplome" : "admis";
          } else {
            decision = "valide";
          }
        } else {
          decision = scope === "ANNUEL" ? "redouble" : "ajourne";
        }
      }

      return {
        studentId: st.id,
        moyenne: moyenne !== null ? moyenne : 0.0,
        hasScore: moyenne !== null,
        decision,
      };
    });

    const ranked = [...computedList]
      .filter((s) => s.hasScore)
      .sort((a, b) => b.moyenne - a.moyenne);

    computedList.forEach((st) => {
      st.rang = st.hasScore ? ranked.findIndex((s) => s.studentId === st.studentId) + 1 : 1;
    });

    await prisma.$transaction(async (tx) => {
      const deliberation = await tx.deliberation.upsert({
        where: {
          classeId_gradePeriodId_scope: {
            classeId,
            gradePeriodId,
            scope,
          },
        },
        update: { juryDate: finalJuryDate },
        create: {
          centerId: req.centerId,
          classeId,
          gradePeriodId,
          scope,
          juryDate: finalJuryDate,
        },
      });

      await tx.studentDeliberation.deleteMany({
        where: { deliberationId: deliberation.id },
      });

      for (const item of computedList) {
        await tx.studentDeliberation.create({
          data: {
            deliberationId: deliberation.id,
            studentId: item.studentId,
            moyenne: item.moyenne,
            rang: item.rang,
            decision: item.decision,
          },
        });

        if (scope === "ANNUEL") {
          await tx.inscription.updateMany({
            where: { studentId: item.studentId, classeId, centerId: req.centerId },
            data: { status: item.decision },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          centerId: req.centerId,
          userId: req.userId,
          action: "AUTO_RUN_DELIBERATION",
          entity: "Deliberation",
          entityId: deliberation.id,
          metadata: {
            classeLabel: classe.label,
            scope,
            juryDate: finalJuryDate.toISOString(),
            studentsCount: computedList.length,
          },
        },
      });
    });

    res.json({
      success: true,
      message: `Délibération automatique calculée pour ${computedList.length} apprenant(s).`,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/deliberations/center-wide-run", verifyJwt, requirePermission("grades.validate"), async (req, res, next) => {
  try {
    const { academicYearId, scope = "ANNUEL", semesterOrder = 1, juryDate } = req.body || {};

    const targetYear = academicYearId
      ? await prisma.academicYear.findFirst({ where: { id: academicYearId, centerId: req.centerId }, include: { gradePeriods: true } })
      : await prisma.academicYear.findFirst({ where: { centerId: req.centerId, isCurrent: true }, include: { gradePeriods: true } });

    if (!targetYear) {
      return res.status(404).json({ error: "Aucune session active trouvée." });
    }

    await assertEditableAcademicYear(targetYear.id, req.centerId);

    const targetPeriod = scope === "ANNUEL"
      ? targetYear.gradePeriods.find((p) => p.type === "ANNUEL")
      : targetYear.gradePeriods.find((p) => p.type === "SEMESTRE" && p.order === parseInt(semesterOrder, 10));

    if (!targetPeriod) {
      return res.status(400).json({ error: "Période d'évaluation introuvable pour cette session." });
    }

    const classes = await prisma.classe.findMany({
      where: { centerId: req.centerId, academicYearId: targetYear.id },
      include: {
        filiere: true,
        niveau: true,
        inscriptions: {
          where: { student: { deletedAt: null } },
          include: { student: true },
        },
        subjectOfferings: {
          where: scope === "SEMESTRE" ? { gradePeriodId: targetPeriod.id } : {},
          include: { category: true, subject: true },
        },
      },
    });

    if (classes.length === 0) {
      return res.status(400).json({ error: "Aucune classe active trouvée pour cette session." });
    }

    const finalJuryDate = juryDate ? new Date(juryDate) : new Date();

    let totalStudentsDeliberated = 0;
    let totalAdmis = 0;
    let totalDiplomes = 0;
    let totalAjournes = 0;
    let totalRedoublants = 0;

    await prisma.$transaction(async (tx) => {
      for (const classe of classes) {
        const isFinalYear = classe.niveau.order >= classe.filiere.durationInYears;
        const offerings = classe.subjectOfferings;
        const studentIds = classe.inscriptions.map((i) => i.studentId);

        const subjectResults = await tx.subjectResult.findMany({
          where: {
            centerId: req.centerId,
            studentId: { in: studentIds },
            subjectId: { in: offerings.map((o) => o.subjectId) },
          },
        });

        const computedStudents = classe.inscriptions.map((insc) => {
          const st = insc.student;
          let totalPoints = 0;
          let totalCoeffs = 0;
          let hasEliminatoryGrade = false;

          offerings.forEach((off) => {
            const sRes = subjectResults.find((r) => r.studentId === st.id && r.subjectId === off.subjectId);
            const gradeVal = sRes?.finalGrade !== undefined && sRes?.finalGrade !== null ? sRes.finalGrade : null;

            if (gradeVal !== null) {
              totalPoints += gradeVal * off.coefficient;
              totalCoeffs += off.coefficient;

              if (off.category?.isEliminatory && gradeVal < 8.0) {
                hasEliminatoryGrade = true;
              }
            }
          });

          const moyenne = totalCoeffs > 0 ? Number((totalPoints / totalCoeffs).toFixed(2)) : null;

          let decision = "ajourne";
          if (moyenne !== null) {
            if (moyenne >= 10.0 && !hasEliminatoryGrade) {
              if (scope === "ANNUEL") {
                decision = isFinalYear ? "diplome" : "admis";
              } else {
                decision = "valide";
              }
            } else {
              decision = scope === "ANNUEL" ? "redouble" : "ajourne";
            }
          }

          if (decision === "admis" || decision === "valide") totalAdmis++;
          else if (decision === "diplome") totalDiplomes++;
          else if (decision === "redouble") totalRedoublants++;
          else totalAjournes++;

          totalStudentsDeliberated++;

          return {
            studentId: st.id,
            moyenne: moyenne !== null ? moyenne : 0.0,
            hasScore: moyenne !== null,
            decision,
          };
        });

        // Correction de la variable : utilisation de computedStudents au lieu de computedList
        const ranked = [...computedStudents]
          .filter((s) => s.hasScore)
          .sort((a, b) => b.moyenne - a.moyenne);

        computedStudents.forEach((st) => {
          st.rang = st.hasScore ? ranked.findIndex((s) => s.studentId === st.studentId) + 1 : 1;
        });

        const deliberation = await tx.deliberation.upsert({
          where: {
            classeId_gradePeriodId_scope: {
              classeId: classe.id,
              gradePeriodId: targetPeriod.id,
              scope,
            },
          },
          update: { juryDate: finalJuryDate },
          create: {
            centerId: req.centerId,
            classeId: classe.id,
            gradePeriodId: targetPeriod.id,
            scope,
            juryDate: finalJuryDate,
          },
        });

        await tx.studentDeliberation.deleteMany({
          where: { deliberationId: deliberation.id },
        });

        for (const item of computedStudents) {
          await tx.studentDeliberation.create({
            data: {
              deliberationId: deliberation.id,
              studentId: item.studentId,
              moyenne: item.moyenne,
              rang: item.rang,
              decision: item.decision,
            },
          });

          if (scope === "ANNUEL") {
            await tx.inscription.updateMany({
              where: { studentId: item.studentId, classeId: classe.id, centerId: req.centerId },
              data: { status: item.decision },
            });
          }
        }
      }

      await tx.auditLog.create({
        data: {
          centerId: req.centerId,
          userId: req.userId,
          action: "CENTER_WIDE_DELIBERATION",
          entity: "AcademicYear",
          entityId: targetYear.id,
          metadata: {
            yearLabel: targetYear.label,
            scope,
            totalClasses: classes.length,
            totalStudents: totalStudentsDeliberated,
            totalAdmis,
            totalDiplomes,
            totalRedoublants,
            totalAjournes,
          },
        },
      });
    });

    res.json({
      success: true,
      message: `Délibération globale terminée pour la session ${targetYear.label}.`,
      report: {
        totalClasses: classes.length,
        totalStudents: totalStudentsDeliberated,
        totalAdmis,
        totalDiplomes,
        totalRedoublants,
        totalAjournes,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post("/deliberations/run", verifyJwt, requirePermission("grades.validate"), async (req, res, next) => {
  try {
    const { classeId, gradePeriodId, scope = "ANNUEL", juryDate, results } = req.body || {};
    if (!classeId || !gradePeriodId || !Array.isArray(results)) {
      return res.status(400).json({ error: "Données de délibération incomplètes." });
    }

    const classe = await prisma.classe.findFirst({
      where: { id: classeId, centerId: req.centerId },
    });
    if (!classe) return res.status(404).json({ error: "Classe introuvable." });

    await assertEditableAcademicYear(classe.academicYearId, req.centerId);

    const finalJuryDate = juryDate ? new Date(juryDate) : new Date();

    await prisma.$transaction(async (tx) => {
      const deliberation = await tx.deliberation.upsert({
        where: {
          classeId_gradePeriodId_scope: {
            classeId,
            gradePeriodId,
            scope,
          },
        },
        update: { juryDate: finalJuryDate },
        create: {
          centerId: req.centerId,
          classeId,
          gradePeriodId,
          scope,
          juryDate: finalJuryDate,
        },
      });

      for (const resItem of results) {
        const { studentId, moyenne, rang, decision } = resItem;
        const moy = moyenne !== null && moyenne !== undefined ? parseFloat(moyenne) : 0.0;
        const finalRang = rang ? parseInt(rang, 10) : 1;

        await tx.studentDeliberation.deleteMany({
          where: { deliberationId: deliberation.id, studentId },
        });

        await tx.studentDeliberation.create({
          data: {
            deliberationId: deliberation.id,
            studentId,
            moyenne: moy,
            rang: finalRang,
            decision: decision || "ajourne",
          },
        });

        if (scope === "ANNUEL") {
          await tx.inscription.updateMany({
            where: { studentId, classeId, centerId: req.centerId },
            data: { status: decision },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          centerId: req.centerId,
          userId: req.userId,
          action: "MANUAL_DELIBERATION_SAVE",
          entity: "Deliberation",
          entityId: deliberation.id,
          metadata: {
            classeLabel: classe.label,
            scope,
            juryDate: finalJuryDate.toISOString(),
            studentsCount: results.length,
          },
        },
      });
    });

    res.json({
      success: true,
      message: `Délibération souveraine enregistrée et statuts scellés.`,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;