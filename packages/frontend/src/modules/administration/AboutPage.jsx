// packages/frontend/src/modules/administration/AboutPage.jsx
import React from "react";
import { motion } from "framer-motion";
import PageHeader from "../../design-system/layout/PageHeader";
import { StructuredPanel } from "../../design-system/layout/Card";
import Badge from "../../design-system/primitives/Badge";
import logo from "../../../assets/logo2.png";

const ROADMAP = [
  { v: "V0", title: "Fondation Multi-Tenant", desc: "Isolation stricte par centerId, PostgreSQL 17 embarqué, architecture pérenne.", status: "Actif" },
  { v: "V1", title: "Installation & Paramètres", desc: "Mode Serveur/Client, licence Ed25519, sauvegardes compressées .zip, RBAC.", status: "Actif" },
  { v: "V2", title: "Formations & Scolarité", desc: "Filières, promotions, inscriptions, webcam 4:4, planches de badges découpables A4.", status: "Actif" },
  { v: "V3", title: "Pédagogie & Évaluations", desc: "Matières 5 car., grille matricielle Excel-like, jurys de délibération, verrouillage.", status: "Actif" },
  { v: "V4", title: "Diplomation & Actes Certifiés", desc: "Relevés bilingues, bulletins, diplômes d'État paysage, QR Codes hors-ligne.", status: "Actif" },
  { v: "V5", title: "Gestion des Stages", desc: "Conventions de stage, entreprises partenaires, encadreurs, évaluations en milieu pro.", status: "Prévu" },
  { v: "V6", title: "Gestion Financière", desc: "Frais de scolarité, échéanciers de paiement, reçus de versement, comptabilité légère.", status: "Prévu" },
  { v: "V7", title: "Administration Avancée & KPI", desc: "Journaux d'audit complets, notifications SMS/Email, tableaux statistiques prédictifs.", status: "Prévu" },
  { v: "V8-V9", title: "CECO Cloud (Mode SaaS)", desc: "Sous-domaines par centre, passerelles bancaires automatisées, portail apprenant.", status: "Roadmap" },
];

export default function AboutPage() {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }} className="space-y-6">
      <PageHeader
        contextBadge={<Badge variant="brand">Système • Fiche Technique</Badge>}
        title="À Propos de CECO Suite ERP"
        subtitle="Spécifications architecturales, conformité ministérielle et feuille de route produit"
      />

      <div className="flex flex-col sm:flex-row sm:items-center gap-6 p-6 rounded bg-surface border border-border shadow-xs dark:bg-surface-dark dark:border-border-dark">
        <div className="w-20 h-20 rounded bg-white border border-border p-1 flex items-center justify-center flex-shrink-0 shadow-xs">
          <img src={logo} alt="Logo CECO" className="h-full w-full object-contain" />
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-h3 font-heading font-semibold text-ink-primary dark:text-white">CECO Suite ERP</h2>
            <Badge variant="success">Version 1.0.0 Stable</Badge>
          </div>
          <p className="text-body text-ink-secondary leading-relaxed dark:text-ink-secondary-dark">
            Progiciel de gestion intégré pour centres de formation professionnelle au Cameroun et en Afrique sub-saharienne. Fonctionnement 100% autonome On-Premise avec certification cryptographique hors-ligne.
          </p>
        </div>
      </div>

      <StructuredPanel title="Feuille de Route Produit (Roadmap V0 → V9)" subtitle="Développement incrémental et jalons d'ingénierie" icon="alt_route">
        <div className="divide-y divide-border -mx-6 -my-4 dark:divide-border-dark">
          {ROADMAP.map((step) => (
            <div key={step.v} className="px-6 py-3 flex items-center justify-between">
              <div>
                <span className="font-mono font-bold text-brand-900 mr-2 dark:text-brand-500">{step.v}</span>
                <strong className="text-ink-primary dark:text-white">{step.title} :</strong>
                <span className="text-caption text-ink-muted ml-1.5">{step.desc}</span>
              </div>
              <Badge variant={step.status === "Actif" ? "success" : "neutral"}>{step.status}</Badge>
            </div>
          ))}
        </div>
      </StructuredPanel>
    </motion.div>
  );
}