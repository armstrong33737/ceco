const PDFDocument = require('pdfkit');
const fs = require('fs');

const doc = new PDFDocument({ size: 'A4', margin: 50 });
doc.pipe(fs.createWriteStream('illustration_polices.pdf'));

// Titre principal
doc.font('Helvetica-Bold').fontSize(24).fillColor('#1A2B4C').text('Catalogue des Polices Natives PDFKit', { align: 'center' });
doc.moveDown(2);

// Fonction utilitaire pour générer une ligne d'exemple
function illustrerFont(label, fontName, testText = "L'élève intelligent écrit ici. 1234567890") {
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#666666').text(`${label} (${fontName}) :`);
    doc.font(fontName).fontSize(14).fillColor('#000000').text(testText);
    doc.moveDown(1);
}

// ---- SECTION HELVETICA ----
doc.font('Helvetica-Bold').fontSize(14).fillColor('#003366').text('1. Famille Helvetica (Sans-Serif)', { underline: true });
doc.moveDown(0.5);
illustrerFont('Helvetica Regular', 'Helvetica');
illustrerFont('Helvetica Bold', 'Helvetica-Bold');
illustrerFont('Helvetica Italic', 'Helvetica-Oblique');
illustrerFont('Helvetica Bold Italic', 'Helvetica-BoldOblique');

// ---- SECTION TIMES ----
doc.font('Helvetica-Bold').fontSize(14).fillColor('#003366').text('2. Famille Times (Serif)', { underline: true });
doc.moveDown(0.5);
illustrerFont('Times Roman', 'Times-Roman');
illustrerFont('Times Bold', 'Times-Bold');
illustrerFont('Times Italic', 'Times-Italic');
illustrerFont('Times Bold Italic', 'Times-BoldItalic');

// ---- SECTION COURIER ----
doc.font('Helvetica-Bold').fontSize(14).fillColor('#003366').text('3. Famille Courier (Monospace)', { underline: true });
doc.moveDown(0.5);
illustrerFont('Courier Regular', 'Courier');
illustrerFont('Courier Bold', 'Courier-Bold');
illustrerFont('Courier Italic', 'Courier-Oblique');
illustrerFont('Courier Bold Italic', 'Courier-BoldOblique');

// ---- SECTION SYMBOLES ----
doc.font('Helvetica-Bold').fontSize(14).fillColor('#003366').text('4. Polices Spéciales / Glyphes', { underline: true });
doc.moveDown(0.5);
illustrerFont('Symbol', 'Symbol', 'abcdefg ABCDEFG 12345');
illustrerFont('ZapfDingbats', 'ZapfDingbats', 'abcdefg ABCDEFG 12345');

doc.end();
