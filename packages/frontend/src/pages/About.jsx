// packages/frontend/src/pages/About.jsx
import { motion } from "framer-motion";
import Icon from "../components/Icon";

export default function About() {
  const ROADMAP = [
    { v: "V0", title: "Fondation Technique Multi-Tenant", desc: "Multi-tenant (centerId), stockage scopé, modélisation académique, PostgreSQL embarqué.", status: "Actif" },
    { v: "V1", title: "Installation Locale & Paramètres", desc: "Configuration Serveur/Client, licence cryptographique, sauvegardes .zip, rôles RBAC.", status: "Actif" },
    { v: "V2", title: "Formations & Apprenants", desc: "Filières, promotions (cohortes), inscriptions annuelles, fiches, badges CR80 duplex.", status: "Actif" },
    { v: "V3", title: "Pédagogie & Évaluations", desc: "Matières & codes 5 car., formateurs, grille matricielle, délibérations (S1+S2), verrouillage.", status: "Actif" },
    { v: "V4", title: "Bulletins Périodiques & Diplômes (Actuel)", desc: "Bulletins semestriels bilingues, relevés annuels (transcripts), diplômes d'État paysage, QR code hors-ligne.", status: "Actif" },
    { v: "V5", title: "Gestion des Stages & Entreprises", desc: "Conventions de stage, entreprises partenaires, encadreurs, évaluations en atelier.", status: "Prochainement" },
    { v: "V6", title: "Gestion Financière & Échéanciers", desc: "Frais de scolarité, tranches de paiement, reçus de versement et comptabilité légère.", status: "Prévu" },
    { v: "V7", title: "Administration Avancée & KPI", desc: "Journaux d'audit complets, notifications SMS/Email, graphiques statistiques décisionnels.", status: "Prévu" },
    { v: "V8-V9", title: "CECO Cloud (Mode SaaS)", desc: "Sous-domaines par centre, passerelles bancaires automatisées, portail d'auto-inscription.", status: "Roadmap Cloud" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-4 max-w-5xl mx-auto text-slate-800"
    >
      {/* 1. En-tête officiel */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 bg-white p-5 rounded-lg border border-slate-200 shadow-card">
        <div className="w-14 h-14 rounded-lg bg-blue-700 flex items-center justify-center text-white font-bold text-2xl shadow-sm shrink-0">
          <Icon name="school" className="text-[32px]" />
        </div>

        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-bold text-slate-900">CECO Suite ERP — Plateforme Pédagogique</h1>
            <span className="badge-blue font-bold font-mono">Version 1.0.0 Stable</span>
            <span className="badge-emerald font-bold">Mode On-Premise &amp; Réseau LAN</span>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Suite logicielle d'ingénierie administrative, pédagogique et réglementaire pour les centres de formation professionnelle.
          </p>
        </div>
      </div>

      {/* 2. Informations d'Auteur & Conception */}
      <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-card space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-100 pb-2">
          Conception &amp; Ingénierie Logicielle
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded bg-slate-50 border border-slate-200 space-y-1">
            <span className="text-slate-500 font-bold block text-[10px] uppercase">Auteur &amp; Concepteur</span>
            <strong className="text-slate-900 text-sm block">Armstrong Euclador NGALEU</strong>
            <span className="text-[11px] text-blue-700 font-semibold">Ingénieur Logiciel &amp; Architecte Système</span>
          </div>

          <div className="p-3 rounded bg-slate-50 border border-slate-200 space-y-1">
            <span className="text-slate-500 font-bold block text-[10px] uppercase">Contact Direct</span>
            <span className="font-mono text-slate-900 block">armstrongngaleu3@gmail.com</span>
            <span className="text-[11px] text-slate-500 font-mono">+237 679 78 47 50</span>
          </div>

          <div className="p-3 rounded bg-slate-50 border border-slate-200 space-y-1">
            <span className="text-slate-500 font-bold block text-[10px] uppercase">Portfolio Professionnel</span>
            <a
              href="https://armstrongngaleu.netlify.app"
              target="_blank"
              rel="noreferrer"
              className="font-bold text-blue-700 hover:underline block text-xs truncate"
            >
              armstrongngaleu.netlify.app
            </a>
            <span className="text-[10px] text-slate-500">Solutions Numériques B2B</span>
          </div>
        </div>
      </div>

      {/* 3. Feuille de Route Produit (Roadmap V0 → V9) */}
      <div className="table-container">
        <div className="p-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
            Feuille de Route Produit &amp; Évolutions
          </h2>
          <span className="badge-slate font-mono">V0 → V9</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead>
              <tr>
                <th className="table-header-cell w-20">Version</th>
                <th className="table-header-cell w-48">Module Métier</th>
                <th className="table-header-cell">Spécification Fonctionnelle</th>
                <th className="table-header-cell text-right w-32">Statut</th>
              </tr>
            </thead>
            <tbody>
              {ROADMAP.map((step) => (
                <tr key={step.v} className="table-body-row">
                  <td className="table-body-cell font-mono font-bold text-blue-700">{step.v}</td>
                  <td className="table-body-cell font-bold text-slate-900">{step.title}</td>
                  <td className="table-body-cell text-slate-600 whitespace-normal max-w-md">{step.desc}</td>
                  <td className="table-body-cell text-right">
                    <span className={
                      step.status === "Actif"
                        ? "badge-emerald"
                        : step.status === "Prochainement"
                        ? "badge-blue"
                        : "badge-slate"
                    }>
                      {step.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}