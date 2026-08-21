import { motion } from "framer-motion";
import Icon from "../components/Icon";
import logo from "../../assets/logo2.png";

export default function About() {
  // packages/frontend/src/pages/About.jsx (Extrait mis à jour du tableau Roadmap)
  const ROADMAP = [
    { v: "V0", title: "Fondation Technique", desc: "Multi-tenant (centerId), stockage scopé, modélisation académique figée, moteur PostgreSQL embarqué.", status: "Actif" },
    { v: "V1", title: "Installation Locale & Paramètres", desc: "Configuration Serveur/Client, licence 60j, sauvegardes compressées .zip, gestion des comptes et RBAC.", status: "Actif" },
    { v: "V2", title: "Gestion des Formations & Apprenants", desc: "Filières, promotions (cohortes), inscriptions annuelles, fiches, cartes d'étudiant découpables duplex et certificats.", status: "Actif" },
    { v: "V3", title: "Gestion Pédagogique & Évaluations", desc: "Matières & groupes libres, cursus filières, formateurs, bordereau de saisie matricielle, délibérations (S1+S2), verrouillage et KPIs.", status: "Actif" }, // ⬅️ Actif & Scellé
    { v: "V4", title: "Bulletins Périodiques & Diplômes d'État", desc: "Composition des relevés de notes bilingues, bulletins périodiques et diplômes certifiés par QR Code et scellés d'agrément.", status: "Prochainement" },
    { v: "V5", title: "Gestion des Stages", desc: "Conventions de stage, entreprises partenaires, encadreurs, évaluations et présences.", status: "Prévu" },
    { v: "V6", title: "Gestion Financière", desc: "Frais de scolarité, échéanciers de paiement, reçus de versement et comptabilité légère du centre.", status: "Prévu" },
    { v: "V7", title: "Administration Avancée & KPI", desc: "Journaux d'audit complets, notifications internes/SMS, graphiques statistiques et indicateurs.", status: "Prévu" },
    { v: "V8-V9", title: "CECO Cloud (Mode SaaS)", desc: "Sous-domaines par centre, passerelles bancaires automatisées, portail d'auto-inscription.", status: "Roadmap Cloud" },
    { v: "V10-V11", title: "Marketplace & Applications Mobiles", desc: "Plugins tiers, APIs d'intégration, applications mobiles pour parents, apprenants et formateurs.", status: "Roadmap Écosystème" },
  ];
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-md max-w-5xl mx-auto"
    >
      {/* En-tête officiel avec le Logo */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-md bg-surface-container-lowest p-md sm:p-lg rounded-md border border-outline-variant/30 shadow-xs">
        <div className="relative flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-md overflow-hidden bg-white border border-outline-variant/30 shadow-inner flex-shrink-0 p-1">
          <img
            src={logo}
            alt="Logo officiel CECO"
            className="h-full w-full object-contain"
            onError={(e) => {
              e.target.style.display = "none";
              e.target.nextElementSibling.style.display = "flex";
            }}
          />
          <div className="hidden h-full w-full items-center justify-center bg-gradient-to-br from-primary to-violet text-white">
            <Icon name="school" className="text-[32px]" />
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-on-surface">CECO — Suite ERP Pédagogique</h1>
            <span className="rounded-md bg-primary-light text-primary font-bold text-xs px-2.5 py-0.5">
              Version 1.0.0 Stable
            </span>
            <span className="rounded-md bg-success-light text-success font-bold text-xs px-2.5 py-0.5">
              Mode On-Premise (Local)
            </span>
          </div>
          <p className="text-xs text-on-surface-variant leading-relaxed">
            Plateforme intégrée de gestion administrative, académique et financière conçue spécifiquement pour les centres de formation professionnelle au Cameroun et en Afrique sub-saharienne.
          </p>
        </div>
      </div>

      {/* Grille 3 colonnes : Vision, Architecture et Sécurité */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-md">
        
        {/* Carte 1 : Vision Métier */}
        <div className="rounded-md bg-surface-container-lowest p-md sm:p-lg border border-outline-variant/30 shadow-xs space-y-2">
          <div className="flex items-center gap-2 text-primary">
            <Icon name="lightbulb" className="text-[20px]" />
            <h2 className="text-sm font-bold text-on-surface">Vision &amp; Philosophie</h2>
          </div>
          <p className="text-xs text-on-surface-variant leading-relaxed">
            Offrir une autonomie numérique totale aux établissements de formation professionnelle. Le logiciel s'exécute localement sans dépendance obligatoire à Internet, garantissant une continuité de service irréprochable.
          </p>
        </div>

        {/* Carte 2 : Socle Technique */}
        <div className="rounded-md bg-surface-container-lowest p-md sm:p-lg border border-outline-variant/30 shadow-xs space-y-2">
          <div className="flex items-center gap-2 text-primary">
            <Icon name="memory" className="text-[20px]" />
            <h2 className="text-sm font-bold text-on-surface">Socle Technologique</h2>
          </div>
          <p className="text-xs text-on-surface-variant leading-relaxed">
            Architecture Desktop Electron 31 couplée à un moteur PostgreSQL 17 embarqué autonome, une API REST Express sous Prisma 5.20 et une interface React 18 / Tailwind CSS réactive.
          </p>
        </div>

        {/* Carte 3 : Non-destruction des données */}
        <div className="rounded-md bg-surface-container-lowest p-md sm:p-lg border border-outline-variant/30 shadow-xs space-y-2">
          <div className="flex items-center gap-2 text-primary">
            <Icon name="history_edu" className="text-[20px]" />
            <h2 className="text-sm font-bold text-on-surface">Régularité &amp; Traçabilité</h2>
          </div>
          <p className="text-xs text-on-surface-variant leading-relaxed">
            Modélisation non-destructive stricte : les parcours étudiants et les pondérations de notes sont historisés par année et semestre afin d'assurer l'authenticité juridique des procès-verbaux émis.
          </p>
        </div>
      </div>

      {/* Fiche Technique & Bibliographie d'Ingénierie */}
      <div className="rounded-md bg-surface-container-lowest p-md sm:p-lg border border-outline-variant/30 shadow-xs space-y-md">
        <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
          <div className="flex items-center gap-2">
            <Icon name="menu_book" className="text-primary text-[20px]" />
            <h2 className="text-sm font-bold text-on-surface">Bibliographie &amp; Références de Conception</h2>
          </div>
          <span className="text-[11px] font-mono text-on-surface-variant">CECO Architecture Blueprint</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-md text-xs leading-relaxed">
          <div className="space-y-1.5 p-md bg-surface rounded-md border border-outline-variant/20">
            <h3 className="font-bold text-on-surface flex items-center gap-1.5">
              <Icon name="verified" className="text-[16px] text-primary" />
              Isolation Multi-Tenant Native
            </h3>
            <p className="text-on-surface-variant">
              Toutes les tables de la base de données intègrent dès la V0 une colonne d'isolation <code className="bg-white px-1 py-0.5 rounded-md font-mono text-primary border border-outline-variant/30">centerId</code>. Cela permet de migrer sans rupture d'un serveur physique local vers une instance hébergée Cloud (V9).
            </p>
          </div>

          <div className="space-y-1.5 p-md bg-surface rounded-md border border-outline-variant/20">
            <h3 className="font-bold text-on-surface flex items-center gap-1.5">
              <Icon name="verified" className="text-[16px] text-primary" />
              Sécurité &amp; Intégrité Cryptographique
            </h3>
            <p className="text-on-surface-variant">
              Les mots de passe sont hachés sous Bcrypt, les sessions sont scellées par jetons JWT signés par une clé unique générée par machine, et les documents générés disposent d'un token d'authenticité QR Code.
            </p>
          </div>

          <div className="space-y-1.5 p-md bg-surface rounded-md border border-outline-variant/20">
            <h3 className="font-bold text-on-surface flex items-center gap-1.5">
              <Icon name="verified" className="text-[16px] text-primary" />
              Moteur de Sauvegarde Universel
            </h3>
            <p className="text-on-surface-variant">
              Génération d'archives compressées autonomes <code className="bg-white px-1 py-0.5 rounded-md font-mono text-primary border border-outline-variant/30">.zip</code> encapsulant à la fois la structure de données relationnelle et l'arborescence des fichiers médias du centre.
            </p>
          </div>

          <div className="space-y-1.5 p-md bg-surface rounded-md border border-outline-variant/20">
            <h3 className="font-bold text-on-surface flex items-center gap-1.5">
              <Icon name="verified" className="text-[16px] text-primary" />
              Agrément &amp; Système Académique
            </h3>
            <p className="text-on-surface-variant">
              Conforme aux exigences des diplômes d'État et de qualification professionnelle (DQP, CQP), avec délibérations semestrielles ou annuelles et arrêtés de fin de cycle.
            </p>
          </div>
        </div>
      </div>

      {/* Feuille de route produit (Roadmap) */}
      <div className="rounded-md bg-surface-container-lowest p-md sm:p-lg border border-outline-variant/30 shadow-xs space-y-md">
        <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
          <div className="flex items-center gap-2">
            <Icon name="alt_route" className="text-primary text-[20px]" />
            <h2 className="text-sm font-bold text-on-surface">Feuille de Route Produit (Roadmap V0 → V11)</h2>
          </div>
          <span className="text-xs font-semibold text-primary">Développement incrémental</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead>
              <tr className="border-b border-outline-variant/30 text-on-surface-variant uppercase font-semibold bg-surface">
                <th className="px-md py-2.5">Version</th>
                <th className="px-md py-2.5">Module &amp; Objectif</th>
                <th className="px-md py-2.5">Périmètre fonctionnel</th>
                <th className="px-md py-2.5 text-right">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/15">
              {ROADMAP.map((step) => (
                <tr key={step.v} className="hover:bg-surface-container/20 transition-colors">
                  <td className="px-md py-3 font-mono font-bold text-primary">{step.v}</td>
                  <td className="px-md py-3 font-bold text-on-surface">{step.title}</td>
                  <td className="px-md py-3 text-on-surface-variant whitespace-normal max-w-md">{step.desc}</td>
                  <td className="px-md py-3 text-right">
                    <span className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-bold ${
                      step.status === "Actif"
                        ? "bg-success-light text-success border border-success/20"
                        : step.status === "Prochainement"
                        ? "bg-primary-light text-primary border border-primary/20"
                        : "bg-surface text-on-surface-variant border border-outline-variant/30"
                    }`}>
                      {step.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mentions légales et support */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-sm p-md rounded-md bg-surface border border-outline-variant/30 text-xs text-on-surface-variant">
        <div>
          <span className="font-bold text-on-surface">CECO Africa Development Team</span> • Tous droits réservés 2026
        </div>
        <div className="flex items-center gap-3">
          <span>Licence d'exploitation locale active</span>
          <span className="text-outline-variant">•</span>
          <a href="https://ceco.africa" target="_blank" rel="noreferrer" className="font-bold text-primary hover:underline">
            ceco.africa
          </a>
        </div>
      </div>
    </motion.div>
  );
}