// packages/frontend/src/pages/Dashboard.jsx
import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { apiFetch } from "../lib/apiClient";
import useAuthStore from "../store/authStore";
import Icon from "../components/Icon";
import { DataModule, StructuredPanel, Button, Badge } from "../design-system";

export default function Dashboard() {
  const user = useAuthStore((s) => s.user);
  const isTeacher = user?.role?.name?.toLowerCase() === "formateur";
  const [kpis, setKpis] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    apiFetch("/pedagogie/dashboard-kpis")
      .then((data) => {
        if (isMounted) setKpis(data);
      })
      .catch(() => {
        if (isMounted) setKpis(null);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const getRemainingDays = () => {
    if (!user?.center?.subscription?.expiresAt) return 0;
    const diff = new Date(user.center.subscription.expiresAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  const remainingDays = getRemainingDays();
  const currentDate = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const stats = kpis?.stats || {
    totalStudents: 0,
    totalClasses: 0,
    totalOfferings: 0,
    completedOfferings: 0,
    completionRate: 0,
    globalPassRate: null,
  };

  const criticalSubjects = kpis?.criticalSubjects || [];
  const pendingOfferings = kpis?.pendingOfferings || [];
  const teacherLoads = kpis?.teacherLoads || [];
  const cohortDistribution = kpis?.cohortDistribution || [];
  const hasPassRate = stats.globalPassRate !== null && stats.globalPassRate !== undefined;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className="space-y-6"
    >
      {/* 1. EN-TÊTE DU COCKPIT ACADÉMIQUE */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-surface p-6 rounded border border-border shadow-xs dark:bg-surface-dark dark:border-border-dark">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="brand">{user?.center?.name || "Établissement CECO"}</Badge>
            <span className="text-ink-muted">•</span>
            <span className="text-caption text-ink-secondary capitalize dark:text-ink-secondary-dark">{currentDate}</span>
          </div>
          <h1 className="text-h3 font-heading font-semibold text-ink-primary mt-1 dark:text-white">
            Bonjour, {user ? `${user.firstName} ${user.lastName}` : "Utilisateur"}
          </h1>
          <p className="text-body text-ink-secondary mt-0.5 dark:text-ink-secondary-dark">
            {isTeacher
              ? "Espace Enseignant — Suivi de vos cours assignés et saisie de vos bordereaux d'évaluation."
              : "Tour de contrôle académique, supervision des saisies de notes et pilotage de l'établissement."}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Link to="/pedagogie/saisie">
            <Button variant="primary" icon="edit_note">
              Saisie des Notes
            </Button>
          </Link>
          {!isTeacher && (
            <>
              <Link to="/apprenants">
                <Button variant="secondary" icon="person_add">
                  Nouvel Apprenant
                </Button>
              </Link>
              <Link to="/administration/sauvegardes">
                <Button variant="secondary" icon="archive">
                  Sauvegarde .zip
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* 2. GRILLE DE 5 CARTES MÉTRIQUES DATA MODULE (SORA 650) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Avancement Notes */}
        <DataModule
          label={isTeacher ? "Mes Cours Notés" : "Avancement Saisies"}
          value={`${stats.completionRate}%`}
          subtext={`${stats.completedOfferings} / ${stats.totalOfferings} cours notés`}
          icon="fact_check"
          badge={<Badge variant={stats.completionRate === 100 ? "success" : "info"} withDot>{stats.completionRate === 100 ? "À jour" : "En cours"}</Badge>}
          action={<Link to="/pedagogie/saisie" className="text-caption font-semibold text-brand-900 hover:underline dark:text-brand-500">Saisir →</Link>}
        />

        {/* Réussite Globale */}
        {!isTeacher ? (
          <DataModule
            label="Réussite Globale"
            value={hasPassRate ? `${stats.globalPassRate}%` : "—"}
            subtext="Moyenne générale ≥ 10.00"
            icon="workspace_premium"
            badge={<Badge variant={hasPassRate && stats.globalPassRate >= 60 ? "success" : "warning"} withDot>{hasPassRate ? `${stats.globalPassRate}% Admis` : "En attente"}</Badge>}
            action={<Link to="/pedagogie/deliberations" className="text-caption font-semibold text-brand-900 hover:underline dark:text-brand-500">Jurys →</Link>}
          />
        ) : (
          <DataModule
            label="Mes Matières"
            value={stats.totalOfferings}
            subtext="Dispensées ce semestre"
            icon="auto_stories"
            badge={<Badge variant="brand">Semestre Actif</Badge>}
            action={<Link to="/pedagogie/maquettes" className="text-caption font-semibold text-brand-900 hover:underline dark:text-brand-500">Voir cours →</Link>}
          />
        )}

        {/* Effectif Global */}
        <DataModule
          label={isTeacher ? "Effectif Assigné" : "Effectif Inscrits"}
          value={stats.totalStudents}
          subtext={`Répartis en ${stats.totalClasses} classe(s)`}
          icon="groups"
          badge={<Badge variant="neutral">Actifs</Badge>}
          action={!isTeacher ? <Link to="/apprenants" className="text-caption font-semibold text-brand-900 hover:underline dark:text-brand-500">Registre →</Link> : null}
        />

        {/* Complétude Dossiers (Data Quality) */}
        {!isTeacher ? (
          <DataModule
            label="Complétude Dossiers"
            value="98.4%"
            subtext="Matricules & tuteurs enregistrés"
            icon="verified"
            badge={<Badge variant="success" withDot>Conforme</Badge>}
            action={<Link to="/apprenants" className="text-caption font-semibold text-brand-900 hover:underline dark:text-brand-500">Vérifier →</Link>}
          />
        ) : (
          <DataModule
            label="Mes Évaluations"
            value={`${stats.completedOfferings}/${stats.totalOfferings}`}
            subtext="Bordereaux scellés"
            icon="assignment_turned_in"
            badge={<Badge variant="brand">CC & Examens</Badge>}
          />
        )}

        {/* Licence Locale & Sauvegarde */}
        <DataModule
          label="Validité Système"
          value={`${remainingDays} j`}
          subtext={`Session : ${kpis?.activeYear?.label || "2026-2027"}`}
          icon="verified_user"
          badge={<Badge variant={remainingDays > 7 ? "success" : remainingDays > 0 ? "warning" : "error"} withDot>{remainingDays > 0 ? "Active" : "Expirée"}</Badge>}
          action={!isTeacher ? <Link to="/administration/licence" className="text-caption font-semibold text-brand-900 hover:underline dark:text-brand-500">Recharger →</Link> : null}
        />
      </div>

      {/* 3. CENTRE D'ACTIONS & ALERTES DÉCISIONNELLES (ACTION CENTER INBOX) */}
      {!isTeacher && (
        <StructuredPanel
          title="Centre d'Actions &amp; Alertes Décisionnelles"
          subtitle="Tâches prioritaires et anomalies requérant une intervention administrative immédiate"
          icon="notification_important"
          headerAction={<Badge variant={criticalSubjects.length > 0 || pendingOfferings.length > 0 ? "warning" : "success"} withDot>{criticalSubjects.length + (pendingOfferings.length > 0 ? 1 : 0)} alertes</Badge>}
        >
          <div className="space-y-3">
            {criticalSubjects.length > 0 && (
              <div className="p-4 rounded bg-error-subtle border border-error/30 flex items-center justify-between dark:bg-error-subtle-dark">
                <div className="flex items-center gap-3">
                  <Icon name="warning" className="text-error text-[22px] flex-shrink-0" />
                  <div>
                    <strong className="text-body-sm font-semibold text-error block dark:text-error-dark">
                      {criticalSubjects.length} matière(s) affichent un taux d'échec critique (&gt; 35%)
                    </strong>
                    <span className="text-caption text-ink-secondary dark:text-ink-secondary-dark">
                      Examen de session normale : un arbitrage pédagogique est requis avant clôture.
                    </span>
                  </div>
                </div>
                <Link to="/pedagogie/deliberations">
                  <Button variant="danger" size="sm">
                    Consulter Jurys
                  </Button>
                </Link>
              </div>
            )}

            {pendingOfferings.length > 0 && (
              <div className="p-4 rounded bg-warning-subtle border border-warning/30 flex items-center justify-between dark:bg-warning-subtle-dark">
                <div className="flex items-center gap-3">
                  <Icon name="pending_actions" className="text-warning text-[22px] flex-shrink-0" />
                  <div>
                    <strong className="text-body-sm font-semibold text-warning-dark block dark:text-warning">
                      {pendingOfferings.length} bordereau(x) sont en attente de saisie de notes
                    </strong>
                    <span className="text-caption text-ink-secondary dark:text-ink-secondary-dark">
                      Les enseignants concernés n'ont pas encore finalisé le report des évaluations.
                    </span>
                  </div>
                </div>
                <Link to="/pedagogie/saisie">
                  <Button variant="secondary" size="sm">
                    Ouvrir Saisie
                  </Button>
                </Link>
              </div>
            )}

            {criticalSubjects.length === 0 && pendingOfferings.length === 0 && (
              <div className="p-4 rounded bg-success-subtle border border-success/30 flex items-center gap-3 text-success dark:bg-success-subtle-dark dark:text-success-dark">
                <Icon name="check_circle" className="text-[20px]" />
                <span className="text-body-sm font-medium">Toutes les opérations académiques sont à jour et conformes.</span>
              </div>
            )}
          </div>
        </StructuredPanel>
      )}

      {/* 4. ANALYTIQUE EN 2 COLONNES (7 cols Gauche / 5 cols Droite) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Colonne Gauche : Saisies en Attente & Matières Critiques */}
        <div className="lg:col-span-7 space-y-6">
          <StructuredPanel
            title={isTeacher ? "Mes Cours en Attente de Saisie" : "Bordereaux en Attente de Saisie"}
            subtitle="Matières nécessitant le report des notes de CC ou d'Examen"
            icon="edit_note"
          >
            {pendingOfferings.length === 0 ? (
              <p className="text-caption text-ink-muted text-center py-6">Tous les cours sont à jour d'évaluation.</p>
            ) : (
              <div className="divide-y divide-border -mx-6 -my-4 dark:divide-border-dark">
                {pendingOfferings.slice(0, 5).map((po, idx) => (
                  <div key={idx} className="px-6 py-3 flex items-center justify-between hover:bg-[#F5F7FA] dark:hover:bg-[#13263A]/40 transition-colors">
                    <div>
                      <span className="font-semibold text-ink-primary dark:text-white block">{po.subjectName}</span>
                      <span className="text-caption text-ink-muted">{po.classeLabel} • {po.semesterLabel} • Formateur : {po.formateurName}</span>
                    </div>
                    <Link to="/pedagogie/saisie">
                      <Button variant="secondary" size="sm" icon="edit">Saisir</Button>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </StructuredPanel>

          {!isTeacher && criticalSubjects.length > 0 && (
            <StructuredPanel
              title="Matières Critiques (Alertes Pédagogiques)"
              subtitle="Disciplines nécessitant un soutien ou un rattrapage prioritaire"
              icon="warning"
            >
              <div className="divide-y divide-border -mx-6 -my-4 dark:divide-border-dark">
                {criticalSubjects.slice(0, 5).map((cs, idx) => (
                  <div key={idx} className="px-6 py-3 flex items-center justify-between hover:bg-[#F5F7FA] dark:hover:bg-[#13263A]/40 transition-colors">
                    <div>
                      <span className="font-semibold text-ink-primary dark:text-white block">{cs.subjectName}</span>
                      <span className="text-caption text-ink-muted">{cs.classeLabel} • {cs.semesterLabel} • {cs.formateurName}</span>
                    </div>
                    <Badge variant="error">{cs.failureRate}% d'échec (Moy : {cs.average}/20)</Badge>
                  </div>
                ))}
              </div>
            </StructuredPanel>
          )}
        </div>

        {/* Colonne Droite : Chronologie de la Session, Charge & Cohortes */}
        <div className="lg:col-span-5 space-y-6">
          {/* Échéancier de la Session */}
          <StructuredPanel
            title="Chronologie de la Session Active"
            subtitle={`Session : ${kpis?.activeYear?.label || "2026-2027"}`}
            icon="calendar_month"
          >
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-caption font-semibold mb-1">
                  <span className="text-ink-secondary dark:text-ink-secondary-dark">Progression Temporelle</span>
                  <span className="font-mono text-brand-900 dark:text-brand-500">62% écoulée</span>
                </div>
                <div className="w-full h-2 rounded-full bg-[#E2E8F0] overflow-hidden dark:bg-[#24384B]">
                  <div className="h-full bg-brand-900 rounded-full w-[62%] dark:bg-brand-500" />
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-border text-body-sm dark:border-border-dark">
                <div className="flex items-center justify-between text-caption">
                  <span className="text-ink-secondary dark:text-ink-secondary-dark">• Fin des Saisies CC1</span>
                  <span className="font-mono font-semibold text-warning">Dans 6 jours</span>
                </div>
                <div className="flex items-center justify-between text-caption">
                  <span className="text-ink-secondary dark:text-ink-secondary-dark">• Examens de Session Normale</span>
                  <span className="font-mono font-semibold text-ink-primary dark:text-white">12 Octobre 2026</span>
                </div>
                <div className="flex items-center justify-between text-caption">
                  <span className="text-ink-secondary dark:text-ink-secondary-dark">• Jurys de Délibération S1</span>
                  <span className="font-mono font-semibold text-brand-900 dark:text-brand-500">20 Octobre 2026</span>
                </div>
              </div>
            </div>
          </StructuredPanel>

          {/* Charge du Corps Professoral */}
          {!isTeacher && (
            <StructuredPanel
              title="Charge du Corps Professoral"
              subtitle="Suivi des volumes horaires dispensés"
              icon="badge"
              headerAction={<Link to="/pedagogie/formateurs" className="text-caption font-semibold text-brand-900 hover:underline dark:text-brand-500">Annuaire →</Link>}
            >
              <div className="space-y-2.5">
                {teacherLoads.slice(0, 4).map((t) => (
                  <div key={t.id} className="p-3 rounded bg-surface border border-border flex items-center justify-between text-body-sm dark:bg-surface-dark dark:border-border-dark">
                    <div>
                      <span className="font-semibold text-ink-primary dark:text-white block">{t.name}</span>
                      <span className="text-caption text-ink-muted">{t.specialite} • {t.totalCourses} cours</span>
                    </div>
                    <span className="font-mono font-semibold text-brand-900 dark:text-brand-500">{t.totalHours} h</span>
                  </div>
                ))}
              </div>
            </StructuredPanel>
          )}

          {/* Effectifs par Promotion */}
          {!isTeacher && (
            <StructuredPanel
              title="Effectifs par Promotion (Cohortes)"
              subtitle="Répartition des apprenants en cours de cursus"
              icon="school"
            >
              <div className="divide-y divide-border -mx-6 -my-4 dark:divide-border-dark">
                {cohortDistribution.slice(0, 4).map((c) => (
                  <div key={c.id} className="px-6 py-2.5 flex items-center justify-between text-body-sm">
                    <span className="text-ink-primary font-medium dark:text-white truncate max-w-[200px]">{c.label}</span>
                    <Badge variant="brand">{c.studentCount} élèves</Badge>
                  </div>
                ))}
              </div>
            </StructuredPanel>
          )}
        </div>
      </div>
    </motion.div>
  );
}