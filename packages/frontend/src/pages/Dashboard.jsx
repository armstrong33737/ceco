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

  const roleType = kpis?.roleType || "ADMIN";

  const stats = kpis?.stats || {
    totalStudents: 0,
    totalClasses: 0,
    totalOfferings: 0,
    completedOfferings: 0,
    completionRate: 0,
    globalPassRate: null,
    dataQualityScore: 100,
    sessionProgressPercent: 0,
    roomOccupationRate: 0,
  };

  const mockExamStats = kpis?.mockExamStats || null;
  const criticalSubjects = kpis?.criticalSubjects || [];
  const pendingOfferings = kpis?.pendingOfferings || [];
  const teacherLoads = kpis?.teacherLoads || [];
  const cohortDistribution = kpis?.cohortDistribution || [];
  const incompleteStudentsList = kpis?.incompleteStudentsList || [];
  const myOfferingsList = kpis?.myOfferingsList || [];
  const recentAuditLogs = kpis?.recentAuditLogs || [];

  const hasPassRate = stats.globalPassRate !== null && stats.globalPassRate !== undefined;

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }} className="space-y-6">
      {/* 1. EN-TÊTE DU TABLEAU DE BORD */}
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
            {roleType === "TEACHER"
              ? "Cockpit Formateur — Suivi de vos cours assignés, de vos épreuves d'examen blanc et saisie directe de vos notes."
              : roleType === "SECRETARY"
              ? "Cockpit Secrétariat — Gestion des inscriptions, complétude des dossiers apprenants et édition des attestations."
              : "Tour de contrôle générale — Supervision académique, préparation des examens d'État (MINEFOP) et gouvernance du centre."}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {roleType === "TEACHER" && (
            <>
              <Link to="/pedagogie/saisie">
                <Button variant="primary" icon="edit_note">Saisir Mes Notes</Button>
              </Link>
              <Link to="/examens-blancs/bordereau">
                <Button variant="secondary" icon="school">Examens Blancs</Button>
              </Link>
            </>
          )}

          {roleType === "SECRETARY" && (
            <>
              <Link to="/apprenants">
                <Button variant="primary" icon="person_add">Nouvel Apprenant</Button>
              </Link>
              <Link to="/pedagogie/bulletins">
                <Button variant="secondary" icon="verified">Émettre Attestation</Button>
              </Link>
            </>
          )}

          {roleType === "ADMIN" && (
            <>
              <Link to="/examens-blancs/bordereau">
                <Button variant="primary" icon="assignment">Bordereaux MINEFOP</Button>
              </Link>
              <Link to="/pedagogie/deliberations">
                <Button variant="secondary" icon="gavel">Jurys de Délibération</Button>
              </Link>
              <Link to="/administration/sauvegardes">
                <Button variant="secondary" icon="archive">Sauvegarde .zip</Button>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* 2. COCKPIT EXAMEN BLANC POUR L'ADMINISTRATION */}
      {roleType === "ADMIN" && mockExamStats && (
        <StructuredPanel
          title="Préparation aux Certifications Nationales (Examens Blancs MINEFOP)"
          subtitle={`Session active : ${mockExamStats.activeSessionTitle || "Examen Régional du DQP Blanc"}`}
          icon="school"
          headerAction={
            <Badge variant={mockExamStats.readyClassesCount === mockExamStats.totalClassesCount ? "success" : "warning"} withDot>
              {mockExamStats.readyClassesCount} / {mockExamStats.totalClassesCount} classes prêtes pour la délégation
            </Badge>
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-3.5 rounded bg-[#F5F7FA] border border-border dark:bg-[#07111D] dark:border-border-dark space-y-1">
                <span className="text-caption text-ink-muted uppercase font-semibold">Candidats Enrôlés</span>
                <div className="font-heading font-bold text-h3 text-brand-900 dark:text-brand-500">
                  {mockExamStats.totalCandidates}
                </div>
                <span className="text-[11px] text-ink-secondary dark:text-ink-secondary-dark">
                  Sur {mockExamStats.totalClassesCount} classe(s)
                </span>
              </div>

              <div className="p-3.5 rounded bg-[#F5F7FA] border border-border dark:bg-[#07111D] dark:border-border-dark space-y-1">
                <span className="text-caption text-ink-muted uppercase font-semibold">Avancement des Saisies</span>
                <div className="font-heading font-bold text-h3 text-brand-900 dark:text-brand-500">
                  {mockExamStats.completionRate}%
                </div>
                <span className="text-[11px] text-ink-secondary dark:text-ink-secondary-dark">
                  Notes &amp; Points N*Coef calculés
                </span>
              </div>

              <div className="p-3.5 rounded bg-[#F5F7FA] border border-border dark:bg-[#07111D] dark:border-border-dark space-y-1">
                <span className="text-caption text-ink-muted uppercase font-semibold">Taux de Réussite Blanc</span>
                <div className="font-heading font-bold text-h3 text-success">
                  {mockExamStats.passRate !== null ? `${mockExamStats.passRate}%` : "—"}
                </div>
                <span className="text-[11px] text-ink-secondary dark:text-ink-secondary-dark">
                  Moyenne générale &ge; 10.00 / 20
                </span>
              </div>

              <div className="p-3.5 rounded bg-[#F5F7FA] border border-border dark:bg-[#07111D] dark:border-border-dark flex flex-col justify-between">
                <div>
                  <span className="text-caption text-ink-muted uppercase font-semibold block">Dépôt Délégation</span>
                  <span className="text-body-sm font-bold text-ink-primary dark:text-white">
                    {mockExamStats.readyClassesCount} bordereau(x) finalisé(s)
                  </span>
                </div>
                <Link to="/examens-blancs/bordereau" className="mt-2">
                  <Button variant="primary" size="sm" icon="print" className="w-full">
                    Imprimer Bordereaux
                  </Button>
                </Link>
              </div>
            </div>

            {mockExamStats.classesStatus?.length > 0 && (
              <div className="border border-border rounded overflow-hidden dark:border-border-dark">
                <div className="px-4 py-2 bg-[#F5F7FA] border-b border-border text-[11px] font-bold uppercase text-ink-secondary dark:bg-[#07111D] dark:border-border-dark">
                  État de préparation des bordereaux par classe
                </div>
                <div className="divide-y divide-border dark:divide-border-dark">
                  {mockExamStats.classesStatus.map((cs) => (
                    <div key={cs.classeMockExamId} className="px-4 py-2.5 flex items-center justify-between text-body-sm bg-surface dark:bg-surface-dark">
                      <div>
                        <span className="font-bold text-ink-primary dark:text-white mr-2">{cs.classeLabel}</span>
                        <span className="text-caption text-ink-muted">({cs.filiereName}) • {cs.studentCount} candidat(s) • {cs.epreuvesCount} épreuves</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={cs.isReady ? "success" : "warning"} withDot>
                          {cs.isReady ? "Prête pour délégation" : "Saisies incomplètes"}
                        </Badge>
                        <Link to="/examens-blancs/bordereau">
                          <Button variant="secondary" size="sm" icon="edit">Ouvrir</Button>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </StructuredPanel>
      )}

      {/* 3. CARTES MÉTRIQUES DYNAMIQUES ADAPTÉES */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${roleType === "TEACHER" ? "lg:grid-cols-4" : "lg:grid-cols-5"} gap-4`}>
        {roleType === "TEACHER" ? (
          <>
            <DataModule
              label="Mes Cours Assignés"
              value={myOfferingsList.length}
              subtext="Matières régulières"
              icon="auto_stories"
              badge={<Badge variant="brand">Session Active</Badge>}
            />
            <DataModule
              label="Bordereaux Complétés"
              value={`${myOfferingsList.filter((o) => o.hasGrades).length} / ${myOfferingsList.length}`}
              subtext="Notes déjà enregistrées"
              icon="fact_check"
              badge={<Badge variant={myOfferingsList.every((o) => o.hasGrades) ? "success" : "warning"} withDot>{myOfferingsList.every((o) => o.hasGrades) ? "Complet" : "En cours"}</Badge>}
              action={<Link to="/pedagogie/saisie" className="text-caption font-semibold text-brand-900 hover:underline dark:text-brand-500">Saisir →</Link>}
            />
            <DataModule
              label="Total Heures de Cours"
              value={`${myOfferingsList.reduce((acc, o) => acc + o.volumeHoraire, 0)} h`}
              subtext="Volume dispensé"
              icon="schedule"
              badge={<Badge variant="neutral">Annuel</Badge>}
            />
            <DataModule
              label="Apprenants Évalués"
              value={stats.totalStudents}
              subtext="Dans vos classes"
              icon="groups"
              badge={<Badge variant="neutral">Actifs</Badge>}
            />
          </>
        ) : roleType === "SECRETARY" ? (
          <>
            <DataModule
              label="Effectif Total Apprenants"
              value={stats.totalStudents}
              subtext={`Dans ${stats.totalClasses} classe(s)`}
              icon="groups"
              badge={<Badge variant="neutral">Inscrits</Badge>}
              action={<Link to="/apprenants" className="text-caption font-semibold text-brand-900 hover:underline dark:text-brand-500">Registre →</Link>}
            />
            <DataModule
              label="Qualité des Dossiers"
              value={`${stats.dataQualityScore}%`}
              subtext="Dossiers complets & conformes"
              icon="verified"
              badge={<Badge variant={stats.dataQualityScore >= 90 ? "success" : "warning"} withDot>{stats.dataQualityScore >= 90 ? "Conforme" : "À régulariser"}</Badge>}
            />
            <DataModule
              label="Dossiers Incomplets"
              value={incompleteStudentsList.length}
              subtext="Pièces manquantes à collecter"
              icon="warning"
              badge={<Badge variant={incompleteStudentsList.length === 0 ? "success" : "error"} withDot>{incompleteStudentsList.length === 0 ? "Aucun" : "À traiter"}</Badge>}
            />
            <DataModule
              label="Classes Ouvertes"
              value={stats.totalClasses}
              subtext="Session active en cours"
              icon="school"
              badge={<Badge variant="brand">Active</Badge>}
            />
            <DataModule
              label="Validité Système"
              value={`${remainingDays} j`}
              subtext="Licence locale active"
              icon="verified_user"
              badge={<Badge variant="success" withDot>Ed25519</Badge>}
            />
          </>
        ) : (
          <>
            <DataModule
              label="Avancement Saisies"
              value={`${stats.completionRate}%`}
              subtext={`${stats.completedOfferings} / ${stats.totalOfferings} cours notés`}
              icon="fact_check"
              badge={<Badge variant={stats.completionRate === 100 ? "success" : "info"} withDot>{stats.completionRate === 100 ? "À jour" : "En cours"}</Badge>}
              action={<Link to="/pedagogie/saisie" className="text-caption font-semibold text-brand-900 hover:underline dark:text-brand-500">Saisir →</Link>}
            />
            <DataModule
              label="Réussite Globale"
              value={hasPassRate ? `${stats.globalPassRate}%` : "—"}
              subtext="Moyenne générale &ge; 10.00"
              icon="workspace_premium"
              badge={<Badge variant={hasPassRate && stats.globalPassRate >= 60 ? "success" : "warning"} withDot>{hasPassRate ? `${stats.globalPassRate}% Admis` : "En attente"}</Badge>}
              action={<Link to="/pedagogie/deliberations" className="text-caption font-semibold text-brand-900 hover:underline dark:text-brand-500">Jurys →</Link>}
            />
            <DataModule
              label="Effectif Inscrits"
              value={stats.totalStudents}
              subtext={`Dans ${stats.totalClasses} classe(s)`}
              icon="groups"
              badge={<Badge variant="neutral">Actifs</Badge>}
              action={<Link to="/apprenants" className="text-caption font-semibold text-brand-900 hover:underline dark:text-brand-500">Registre →</Link>}
            />
            <DataModule
              label="Complétude Dossiers"
              value={`${stats.dataQualityScore}%`}
              subtext="Photos, tuteurs & diplômes"
              icon="verified"
              badge={<Badge variant={stats.dataQualityScore >= 90 ? "success" : "warning"} withDot>{stats.dataQualityScore >= 90 ? "Conforme" : "Incomplet"}</Badge>}
            />
            <DataModule
              label="Validité Système"
              value={`${remainingDays} j`}
              subtext={`Session : ${kpis?.activeYear?.label || "2026-2027"}`}
              icon="verified_user"
              badge={<Badge variant={remainingDays > 7 ? "success" : "warning"} withDot>{remainingDays > 0 ? "Active" : "Expirée"}</Badge>}
              action={<Link to="/administration/licence" className="text-caption font-semibold text-brand-900 hover:underline dark:text-brand-500">Recharger →</Link>}
            />
          </>
        )}
      </div>

      {/* 4. CONTENU MODULAIRE ADAPTÉ PAR RÔLE */}

      {/* VUE FORMATEUR */}
      {roleType === "TEACHER" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-6">
            <StructuredPanel
              title="Mes Cours Assignés &amp; Saisie des Évaluations"
              subtitle="Accédez directement à vos bordereaux de notes pour la session active"
              icon="auto_stories"
              headerAction={<Badge variant="brand">{myOfferingsList.length} cours</Badge>}
            >
              <div className="divide-y divide-border -mx-6 -my-4 dark:divide-border-dark">
                {myOfferingsList.map((o) => (
                  <div key={o.id} className="px-6 py-3.5 flex items-center justify-between hover:bg-[#F5F7FA] dark:hover:bg-[#13263A]/40 transition-colors">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-ink-primary dark:text-white">{o.subjectName}</span>
                        <Badge variant="neutral">{o.classeLabel}</Badge>
                      </div>
                      <span className="text-caption text-ink-muted block mt-0.5">
                        {o.semesterLabel} • Coef {o.coefficient} • {o.volumeHoraire}h prévues
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant={o.hasGrades ? "success" : "warning"} withDot>
                        {o.hasGrades ? "Bordereau saisi" : "En attente"}
                      </Badge>
                      <Link to={`/pedagogie/saisie?offeringId=${o.id}`}>
                        <Button variant="primary" size="sm" icon="edit">Saisir Notes</Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </StructuredPanel>
          </div>

          <div className="lg:col-span-4 space-y-6">
            <StructuredPanel title="Consignes &amp; Pondérations" subtitle="Règles d'évaluation en vigueur" icon="rule">
              <div className="space-y-3 text-body-sm text-ink-secondary dark:text-ink-secondary-dark">
                <div className="p-3 rounded bg-[#F5F7FA] border border-border dark:bg-[#07111D] dark:border-border-dark">
                  <strong className="text-ink-primary dark:text-white block font-semibold">Formule de Calcul</strong>
                  <p className="text-caption mt-0.5">30% Contrôle Continu (CC1 + CC2) + 70% Examen de Session Normale.</p>
                </div>
                <div className="p-3 rounded bg-[#F5F7FA] border border-border dark:bg-[#07111D] dark:border-border-dark">
                  <strong className="text-ink-primary dark:text-white block font-semibold">Absences (Touche « M » ou ABS)</strong>
                  <p className="text-caption mt-0.5">Les absences justifiées sont exemptées. Les absences non justifiées sont notées 0.00.</p>
                </div>
              </div>
            </StructuredPanel>
          </div>
        </div>
      )}

      {/* VUE SECRÉTARIAT */}
      {roleType === "SECRETARY" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-6">
            <StructuredPanel
              title="Dossiers Apprenants Incomplets (Action Requise)"
              subtitle="Collecte des pièces administratives manquantes pour conformité MINEFOP"
              icon="assignment_late"
              headerAction={<Badge variant={incompleteStudentsList.length > 0 ? "error" : "success"}>{incompleteStudentsList.length} dossier(s)</Badge>}
            >
              {incompleteStudentsList.length === 0 ? (
                <div className="p-6 text-center text-success font-medium flex items-center justify-center gap-2">
                  <Icon name="check_circle" className="text-[20px]" />
                  <span>Tous les dossiers apprenants sont 100% complets et conformes.</span>
                </div>
              ) : (
                <div className="divide-y divide-border -mx-6 -my-4 dark:divide-border-dark">
                  {incompleteStudentsList.map((st) => (
                    <div key={st.id} className="px-6 py-3 flex items-center justify-between hover:bg-[#F5F7FA] dark:hover:bg-[#13263A]/40 transition-colors">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-caption font-bold text-brand-900 dark:text-brand-500">{st.matricule}</span>
                          <span className="font-semibold text-ink-primary dark:text-white">{st.fullName}</span>
                          <span className="text-caption text-ink-muted">({st.classeLabel})</span>
                        </div>
                        <div className="flex gap-1.5 mt-1 flex-wrap">
                          {st.missingReasons.map((r, i) => (
                            <span key={i} className="text-[10px] px-1.5 py-0.2 rounded bg-error-subtle text-error border border-error/20 font-medium">
                              {r}
                            </span>
                          ))}
                        </div>
                      </div>

                      <Link to={`/apprenants?search=${encodeURIComponent(st.matricule)}`}>
                        <Button variant="secondary" size="sm" icon="edit">Compléter</Button>
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </StructuredPanel>
          </div>

          <div className="lg:col-span-5 space-y-6">
            <StructuredPanel title="Effectifs par Filière" subtitle="Répartition globale des cohortes" icon="school">
              <div className="divide-y divide-border -mx-6 -my-4 dark:divide-border-dark">
                {cohortDistribution.map((c) => (
                  <div key={c.id} className="px-6 py-2.5 flex items-center justify-between text-body-sm">
                    <span className="text-ink-primary font-medium dark:text-white truncate max-w-[200px]">{c.label}</span>
                    <Badge variant="brand">{c.studentCount} élèves</Badge>
                  </div>
                ))}
              </div>
            </StructuredPanel>
          </div>
        </div>
      )}

      {/* VUE DIRECTION / ADMINISTRATEUR */}
      {roleType === "ADMIN" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-6">
            <StructuredPanel
              title="Bordereaux de Cours Réguliers en Attente"
              subtitle="Matières nécessitant le report des notes de CC ou d'Examen"
              icon="edit_note"
            >
              {pendingOfferings.length === 0 ? (
                <p className="text-caption text-ink-muted text-center py-6">Tous les cours réguliers sont à jour d'évaluation.</p>
              ) : (
                <div className="divide-y divide-border -mx-6 -my-4 dark:divide-border-dark">
                  {pendingOfferings.slice(0, 5).map((po, idx) => (
                    <div key={idx} className="px-6 py-3 flex items-center justify-between hover:bg-[#F5F7FA] dark:hover:bg-[#13263A]/40 transition-colors">
                      <div>
                        <span className="font-semibold text-ink-primary dark:text-white block">{po.subjectName}</span>
                        <span className="text-caption text-ink-muted">{po.classeLabel} • {po.semesterLabel} • Formateur : {po.formateurName}</span>
                      </div>
                      <Link to={`/pedagogie/saisie?offeringId=${po.id}`}>
                        <Button variant="secondary" size="sm" icon="edit">Saisir</Button>
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </StructuredPanel>

            {criticalSubjects.length > 0 && (
              <StructuredPanel
                title="Matières Critiques (Alertes Pédagogiques)"
                subtitle="Disciplines avec un taux d'échec supérieur à 35% requérant un arbitrage"
                icon="warning"
              >
                <div className="divide-y divide-border -mx-6 -my-4 dark:divide-border-dark">
                  {criticalSubjects.map((cs, idx) => (
                    <div key={idx} className="px-6 py-3 flex items-center justify-between hover:bg-[#F5F7FA] dark:hover:bg-[#13263A]/40 transition-colors">
                      <div>
                        <span className="font-semibold text-ink-primary dark:text-white block">{cs.subjectName}</span>
                        <span className="text-caption text-ink-muted">{cs.classeLabel} • {cs.semesterLabel} • Formateur : {cs.formateurName}</span>
                      </div>
                      <Badge variant="error">{cs.failureRate}% d'échec (Moy : {cs.average}/20)</Badge>
                    </div>
                  ))}
                </div>
              </StructuredPanel>
            )}

            <StructuredPanel title="Traçabilité &amp; Journal d'Audit Récent" subtitle="Dernières opérations sensibles consignées" icon="history">
              <div className="divide-y divide-border -mx-6 -my-4 dark:divide-border-dark">
                {recentAuditLogs.map((log) => (
                  <div key={log.id} className="px-6 py-2.5 flex items-center justify-between text-body-sm">
                    <div>
                      <span className="font-mono text-caption text-ink-muted mr-2">
                        {new Date(log.createdAt).toLocaleDateString("fr-FR")}
                      </span>
                      <strong className="text-ink-primary dark:text-white">{log.action}</strong>
                    </div>
                    <Badge variant="neutral">{log.entity || "Système"}</Badge>
                  </div>
                ))}
              </div>
            </StructuredPanel>
          </div>

          <div className="lg:col-span-5 space-y-6">
            <StructuredPanel title="Chronologie de la Session Active" subtitle={`Session : ${kpis?.activeYear?.label || "2026-2027"}`} icon="calendar_month">
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-caption font-semibold mb-1">
                    <span className="text-ink-secondary dark:text-ink-secondary-dark">Progression Temporelle Réelle</span>
                    <span className="font-mono text-brand-900 dark:text-brand-500">{stats.sessionProgressPercent}% écoulée</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[#E2E8F0] overflow-hidden dark:bg-[#24384B]">
                    <div className="h-full bg-brand-900 rounded-full transition-all duration-300 dark:bg-brand-500" style={{ width: `${stats.sessionProgressPercent}%` }} />
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-border text-body-sm dark:border-border-dark">
                  <div className="flex items-center justify-between text-caption">
                    <span className="text-ink-secondary dark:text-ink-secondary-dark">Taux d'occupation des espaces :</span>
                    <span className="font-mono font-bold text-brand-900 dark:text-brand-500">{stats.roomOccupationRate}%</span>
                  </div>
                  <div className="flex items-center justify-between text-caption">
                    <span className="text-ink-secondary dark:text-ink-secondary-dark">Période officielle :</span>
                    <span className="font-mono text-ink-primary dark:text-white">
                      {kpis?.activeYear?.startDate ? new Date(kpis.activeYear.startDate).toLocaleDateString("fr-FR") : "—"} au {kpis?.activeYear?.endDate ? new Date(kpis.activeYear.endDate).toLocaleDateString("fr-FR") : "—"}
                    </span>
                  </div>
                </div>
              </div>
            </StructuredPanel>

            <StructuredPanel title="Charge du Corps Professoral" subtitle="Suivi des volumes horaires dispensés" icon="badge" headerAction={<Link to="/pedagogie/formateurs" className="text-caption font-semibold text-brand-900 hover:underline dark:text-brand-500">Annuaire →</Link>}>
              <div className="space-y-2.5">
                {teacherLoads.slice(0, 5).map((t) => (
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
          </div>
        </div>
      )}
    </motion.div>
  );
}