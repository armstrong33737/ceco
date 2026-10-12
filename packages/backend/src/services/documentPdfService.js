// packages/backend/src/services/documentPdfService.js

// 1. Primitives et fonctions communes
const pdfHelpers = require("./pdf/common/pdfHelpers");
const pdfHeaders = require("./pdf/common/pdfHeaders");
const pdfGraphics = require("./pdf/common/pdfGraphics");
const pdfEvaluation = require("./pdf/common/pdfEvaluation");
const pdfSignatories = require("./pdf/common/pdfSignatories");

// 2. Modules métier spécialisés
const cardsPdf = require("./pdf/modules/cardsPdf");
const attestationsPdf = require("./pdf/modules/attestationsPdf");
const bulletinsPdf = require("./pdf/modules/bulletinsPdf");
const transcriptsPdf = require("./pdf/modules/transcriptsPdf");
const diplomasPdf = require("./pdf/modules/diplomasPdf");
const classPvsPdf = require("./pdf/modules/classPvsPdf");
const mockExamsPdf = require("./pdf/modules/mockExamsPdf");

module.exports = {
  // Primitives communes
  ...pdfHelpers,
  ...pdfHeaders,
  ...pdfGraphics,
  ...pdfEvaluation,
  ...pdfSignatories,

  // Modules de génération PDF
  ...cardsPdf,
  ...attestationsPdf,
  ...bulletinsPdf,
  ...transcriptsPdf,
  ...diplomasPdf,
  ...classPvsPdf,
  ...mockExamsPdf,
};