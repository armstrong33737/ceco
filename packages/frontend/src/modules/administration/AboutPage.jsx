// packages/frontend/src/modules/administration/AboutPage.jsx
import React from "react";
import { motion } from "framer-motion";
import PageHeader from "../../design-system/layout/PageHeader";
import { StructuredPanel } from "../../design-system/layout/Card";
import Badge from "../../design-system/primitives/Badge";
import logo from "../../../assets/logo2.png";

const TECHNICAL_SPECIFICATIONS = [
  {
    category: "Architecture & Moteur de Données",
    icon: "dns",
    items: [
      { label: "Moteur de Base de Données", value: "PostgreSQL 17.10 Embarqué Autonome" },
      { label: "Port d'Écoute Isolé", value: "TCP 5433 (Zéro conflit hôte)" },
      { label: "Couche d'Accès aux Données", value: "Prisma ORM 5.20 avec Isolation Multi-Tenant" },
      { label: "Environnement d'Exécution", value: "Node.js 20 LTS & Electron 31 (Multi-Processus)" },
      { label: "Interface Utilisateur", value: "React 18, Tailwind CSS, Framer Motion" },
      { label: "Mode de Fonctionnement", value: "100% Hors-Ligne (Offline First) & Réseau Local (LAN)" },
    ],
  },
  {
    category: "Sécurité Cryptographique & Souveraineté",
    icon: "security",
    items: [
      { label: "Autorité de Licence", value: "Signature Asymétrique Ed25519 (Clés 256 bits)" },
      { label: "Protection Horloge Système", value: "Détection anti-altération temporelle (Clock Tampering Guard)" },
      { label: "Chiffrement des Mots de Passe", value: "Bcrypt Salé (10 rounds de hachage)" },
      { label: "Certification des Documents", value: "Code QR Compact (< 150 car.) avec HMAC SHA-256" },
      { label: "Isolation Multi-Établissement", value: "Partitionnement strict par centerId à chaque requête" },
      { label: "Traçabilité des Opérations", value: "Journal d'Audit Immuable (AuditLog JSON brute)" },
    ],
  },
  {
    category: "Conformité Ministérielle (MINEFOP)",
    icon: "school",
    items: [
      { label: "Cycles Professionnels Supportés", value: "DQP (Qualification), CQP (Spécialisation)" },
      { label: "Règle de Durée de Session", value: "Durée minimale obligatoire de 8 mois (240 jours)" },
      { label: "Cycle de Vie des Années", value: "Machine d'états stricte : UPCOMING → CURRENT → CLOSED" },
      { label: "Seuils Éliminatoires de Jury", value: "Alerte automatique sur note < 08.00/20 en spécialité" },
      { label: "Bordereaux d'Examens Blancs", value: "Formulaire officiel régional sans QR code (Délégation)" },
      { label: "Immatriculation Sécurisée", value: "Matricule paramétrable avec scellement juridique à vie" },
    ],
  },
  {
    category: "Ingénierie Documentaire & Moteur PDF",
    icon: "picture_as_pdf",
    items: [
      { label: "Moteur de Génération PDF", value: "PDFKit Natif Vectoriel (Zéro dépendance Chromium)" },
      { label: "Dimensionnement & Formats", value: "A4 Portrait (595x842pt) & A4 Paysage (842x595pt)" },
      { label: "Budgetting Vertical des Pages", value: "Contrôle strict des hauteurs pour éliminer les pages orphelines" },
      { label: "Format Cartes d'Apprenant", value: "Norme CR80 (85.6 x 53.98 mm) & Planches A4 Duplex" },
      { label: "Ségrégation du Stockage", value: "Documents légaux pérennes (/archive) vs Fichiers temporaires (/temp)" },
      { label: "Filigrane & Armoiries", value: "Sceau de la République & Logo à opacité calibrée" },
    ],
  },
  {
    category: "Plan de Reprise d'Activité (PRA Local) & Sauvegardes",
    icon: "archive",
    items: [
      { label: "Format des Sauvegardes", value: "Archive Hybride Universelle Compressée (.zip zlib 9)" },
      { label: "Périmètre de l'Archive", value: "Base relationnelle JSON + Arborescence médias (/storage)" },
      { label: "Contrôle d'Intégrité", value: "Validation de structure (db_dump.json) avant toute importation" },
      { label: "Procédure de Restauration", value: "Transplantation d'identité relationnelle multi-machine" },
      { label: "Externalisation Recommandée", value: "Support physique externe (Clé USB, Disque externe)" },
      { label: "Garantie de Déploiement", value: "Migration à chaud sur nouvelle machine avec maintien de licence" },
    ],
  },
];

export default function AboutPage() {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }} className="space-y-6">
      <PageHeader
        contextBadge={<Badge variant="brand">Système • Fiche Technique Industrielle</Badge>}
        title="Spécifications &amp; Architecture de CECO Suite ERP"
        subtitle="Dossier technique de conformité ministérielle, infrastructure locale PostgreSQL et sécurité cryptographique"
      />

      {/* Cartouche d'Identification Officiel : VERSION 4.0.0 */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-6 p-6 rounded bg-surface border border-border shadow-xs dark:bg-surface-dark dark:border-border-dark">
        <div className="w-24 h-24 rounded bg-white border border-border p-2 flex items-center justify-center flex-shrink-0 shadow-xs">
          <img src={logo} alt="Logo CECO" className="h-full w-full object-contain" />
        </div>
        <div className="space-y-1.5 flex-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-h3 font-heading font-semibold text-ink-primary dark:text-white">CECO Suite ERP</h2>
            <Badge variant="success">Version 4.0.0 Stable</Badge>
            <Badge variant="brand">Architecture On-Premise &amp; Réseau</Badge>
          </div>
          <p className="text-body text-ink-secondary leading-relaxed dark:text-ink-secondary-dark">
            Progiciel de gestion intégré pour centres de formation professionnelle au Cameroun et en Afrique subsaharienne. Conçu pour fonctionner en souveraineté absolue 100% hors-ligne avec base de données embarquée, certification cryptographique et conformité ministérielle (MINEFOP).
          </p>
          <div className="flex items-center gap-4 pt-1 text-caption text-ink-muted font-mono flex-wrap">
            <span>Auteur-Concepteur : Armstrong Euclador NGALEU</span>
            <span>•</span>
            <span>Contact : armstrongngaleu3@gmail.com</span>
            <span>•</span>
            <span>Édition Professionnelle Certifiée v4.0.0</span>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {TECHNICAL_SPECIFICATIONS.map((spec, idx) => (
          <StructuredPanel
            key={idx}
            title={spec.category}
            subtitle="Spécifications techniques et normes d'ingénierie associées"
            icon={spec.icon}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 -mx-2">
              {spec.items.map((it, itemIdx) => (
                <div
                  key={itemIdx}
                  className="p-3.5 rounded bg-[#F5F7FA] border border-border flex flex-col justify-between space-y-1 dark:bg-[#07111D] dark:border-border-dark"
                >
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                    {it.label}
                  </span>
                  <span className="font-heading font-semibold text-body-sm text-ink-primary dark:text-white">
                    {it.value}
                  </span>
                </div>
              ))}
            </div>
          </StructuredPanel>
        ))}
      </div>

      <div className="p-4 rounded bg-surface border border-border text-caption text-ink-muted flex flex-col sm:flex-row items-center justify-between gap-2 dark:bg-surface-dark dark:border-border-dark font-mono">
        <span>© 2026 Armstrong Euclador NGALEU. Tous droits réservés. Version 4.0.0</span>
        <span>Conforme aux normes MINEFOP et à l'Acte Uniforme OHADA.</span>
      </div>
    </motion.div>
  );
}