// packages/backend/scripts/copyPdfkitData.js
const fs = require("fs");
const path = require("path");

/**
 * Copie déterministe des métriques de polices standards PDFKit (.afm)
 * pour garantir leur disponibilité dans le bundle de production Electron.
 */
function copyPdfkitData() {
  try {
    const pdfkitPkg = require.resolve("pdfkit/package.json");
    const srcDir = path.join(path.dirname(pdfkitPkg), "js", "data");
    const destDir = path.join(__dirname, "../dist/data");

    if (!fs.existsSync(srcDir)) {
      console.warn(`[Build] Dossier source pdfkit/js/data introuvable à : ${srcDir}`);
      return;
    }

    fs.mkdirSync(destDir, { recursive: true });
    fs.cpSync(srcDir, destDir, { recursive: true });
    console.log(`✓ Métriques de polices AFM PDFKit copiées avec succès vers : ${destDir}`);
  } catch (err) {
    console.error("❌ Échec de la copie des polices AFM PDFKit :", err.message);
  }
}

copyPdfkitData();