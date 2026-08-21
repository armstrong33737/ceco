// packages/frontend/src/pages/Dashboard.jsx
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { apiFetch } from "../lib/apiClient";
import useAuthStore from "../store/authStore";
import Icon from "../components/Icon";

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
    return () => { isMounted = false; };
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
      transition={{ duration: 0.25 }}
      className="space-y-md max-w-7xl mx-auto"
    >
      {/* En-tête officiel */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-sm bg-surface-container-lowest p-lg rounded-md border border-outline-variant/30 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">
              {user?.center?.name || "Établissement CECO"}
            </span>
            <span className="text-outline-variant">•</span>
            <span className="text-xs text-on-surface-variant capitalize">{currentDate}</span>
          </div>
          <h1 className="text-xl font-bold text-on-surface mt-1">
            Bonjour, {user ? `${user.firstName} ${user.lastName}` : "Utilisateur"}
          </h1>
          <p className="text-xs text-on-surface-variant mt-0.5">
            {isTeacher
              ? "Espace Enseignant — Suivi de vos cours assignés et saisie de vos bordereaux d'évaluation."
              : "Tour de contrôle académique, supervision des saisies de notes et pilotage de l'établissement."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/pedagogie/saisie"
            className="flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-2 text-xs font-bold text-on-primary hover:bg-primary-dark transition-colors shadow-xs"
          >
            <Icon name="edit_note" className="text-[16px]" />
            <span>Saisie des Notes</span>
          </Link>
          {!isTeacher && (
            <Link
              to="/etudiants"
              className="flex items-center gap-1.5 rounded-md border border-outline-variant px-3.5 py-2 text-xs font-semibold text-on-surface-variant hover:bg-surface-container transition-colors shadow-xs"
            >
              <Icon name="school" className="text-[16px]" />
              <span>Apprenants</span>
            </Link>
          )}
        </div>
      </div>

      {/* Grille 1 : Métriques Clés */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-md">
        {/* Avancement Saisie */}
        <div className="rounded-md bg-surface-container-lowest p-md border border-outline-variant/30 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="text-xs font-semibold uppercase tracking-wider">
              {isTeacher ? "Mes Cours Évalués" : "Saisies de Notes"}
            </span>
            <Icon name="fact_check" className="text-[18px] text-primary" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-primary tracking-tight">
              {stats.completionRate}%
            </div>
            <p className="text-[11px] text-on-surface-variant mt-0.5">
              {stats.completedOfferings} / {stats.totalOfferings} cours notés
            </p>
          </div>
          <Link to="/pedagogie/saisie" className="mt-3 pt-2.5 border-t border-outline-variant/15 text-xs font-semibold text-primary hover:underline flex items-center justify-between">
            <span>Ouvrir bordereaux</span>
            <Icon name="chevron_right" className="text-[16px]" />
          </Link>
        </div>

        {/* Taux de Réussite Global (Masqué si Formateur) */}
        {!isTeacher ? (
          <div className="rounded-md bg-surface-container-lowest p-md border border-outline-variant/30 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-on-surface-variant">
              <span className="text-xs font-semibold uppercase tracking-wider">Réussite Globale</span>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                hasPassRate && stats.globalPassRate >= 60 ? "bg-success-light text-success" : "bg-surface border text-on-surface-variant"
              }`}>
                {hasPassRate ? `${stats.globalPassRate}%` : "En attente"}
              </span>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-on-surface tracking-tight">
                {hasPassRate ? `${stats.globalPassRate}%` : "—"}
              </div>
              <p className="text-[11px] text-on-surface-variant mt-0.5">
                Moyenne générale ≥ 10.00 / 20
              </p>
            </div>
            <Link to="/pedagogie/deliberations" className="mt-3 pt-2.5 border-t border-outline-variant/15 text-xs font-semibold text-primary hover:underline flex items-center justify-between">
              <span>Délibérations du jury</span>
              <Icon name="chevron_right" className="text-[16px]" />
            </Link>
          </div>
        ) : (
          <div className="rounded-md bg-surface-container-lowest p-md border border-outline-variant/30 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-on-surface-variant">
              <span className="text-xs font-semibold uppercase tracking-wider">Mes Matières</span>
              <Icon name="auto_stories" className="text-[18px] text-primary" />
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold text-on-surface tracking-tight">
                {stats.totalOfferings}
              </div>
              <p className="text-[11px] text-on-surface-variant mt-0.5">Dispensées ce semestre</p>
            </div>
            <Link to="/pedagogie/maquettes" className="mt-3 pt-2.5 border-t border-outline-variant/15 text-xs font-semibold text-primary hover:underline flex items-center justify-between">
              <span>Voir mes cours</span>
              <Icon name="chevron_right" className="text-[16px]" />
            </Link>
          </div>
        )}

        {/* Effectif */}
        <div className="rounded-md bg-surface-container-lowest p-md border border-outline-variant/30 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="text-xs font-semibold uppercase tracking-wider">Effectif {isTeacher ? "Assigné" : "Session"}</span>
            <Icon name="groups" className="text-[18px] text-on-surface-variant/60" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-on-surface tracking-tight">
              {stats.totalStudents}
            </div>
            <p className="text-[11px] text-on-surface-variant mt-0.5">
              Répartis dans {stats.totalClasses} classes
            </p>
          </div>
          {!isTeacher ? (
            <Link to="/etudiants" className="mt-3 pt-2.5 border-t border-outline-variant/15 text-xs font-semibold text-primary hover:underline flex items-center justify-between">
              <span>Registre apprenants</span>
              <Icon name="chevron_right" className="text-[16px]" />
            </Link>
          ) : (
            <div className="mt-3 pt-2.5 border-t border-outline-variant/15 text-[11px] text-on-surface-variant">
              Session : {kpis?.activeYear?.label || "Active"}
            </div>
          )}
        </div>

        {/* Licence Locale */}
        <div className="rounded-md bg-surface-container-lowest p-md border border-outline-variant/30 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="text-xs font-semibold uppercase tracking-wider">Licence Système</span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
              remainingDays > 0 ? "bg-success-light text-success" : "bg-error-container text-error"
            }`}>
              {remainingDays > 0 ? "Active" : "Expirée"}
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-on-surface tracking-tight">{remainingDays} jours</div>
            <p className="text-[11px] text-on-surface-variant mt-0.5">Session : {kpis?.activeYear?.label || "Active"}</p>
          </div>
          {!isTeacher ? (
            <Link to="/parametres/licence" className="mt-3 pt-2.5 border-t border-outline-variant/15 text-xs font-semibold text-primary hover:underline flex items-center justify-between">
              <span>Recharger licence</span>
              <Icon name="chevron_right" className="text-[16px]" />
            </Link>
          ) : (
            <div className="mt-3 pt-2.5 border-t border-outline-variant/15 text-[11px] text-on-surface-variant">
              Accès Enseignant Sécurisé
            </div>
          )}
        </div>
      </div>

      {/* Grille 2 : Alertes & Saisies en Attente */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-md">
        {/* Colonne Gauche : Saisies en Attente & Alertes Critiques */}
        <div className="lg:col-span-7 space-y-md">
          <div className="rounded-md bg-surface-container-lowest p-md sm:p-lg border border-outline-variant/30 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
              <div className="flex items-center gap-2 text-primary">
                <Icon name="pending_actions" className="text-[20px]" />
                <h2 className="text-sm font-bold text-on-surface">
                  {isTeacher ? "Mes Bordereaux en Attente" : "Bordereaux en Attente de Saisie"}
                </h2>
              </div>
              <span className="text-[11px] font-mono text-primary font-bold">{pendingOfferings.length} cours en attente</span>
            </div>

            {pendingOfferings.length === 0 ? (
              <div className="p-4 bg-success-light/40 border border-success/20 rounded-md text-xs text-success font-semibold flex items-center gap-2">
                <Icon name="check_circle" className="text-[18px]" />
                <span>Tous les cours sont à jour d'évaluation.</span>
              </div>
            ) : (
              <div className="divide-y divide-outline-variant/15 text-xs">
                {pendingOfferings.map((po, idx) => (
                  <div key={idx} className="py-2.5 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-on-surface">{po.subjectName}</span>
                      <div className="text-[10px] text-on-surface-variant mt-0.5">
                        {po.classeLabel} • {po.semesterLabel}
                      </div>
                    </div>
                    <Link
                      to="/pedagogie/saisie"
                      className="px-2.5 py-1 bg-primary-light text-primary border border-primary/20 rounded text-[11px] font-bold hover:bg-primary hover:text-white transition-all"
                    >
                      Saisir
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>

          {!isTeacher && criticalSubjects.length > 0 && (
            <div className="rounded-md bg-surface-container-lowest p-md sm:p-lg border border-outline-variant/30 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
                <div className="flex items-center gap-2 text-error">
                  <Icon name="warning" className="text-[20px]" />
                  <h2 className="text-sm font-bold text-on-surface">Alertes Pédagogiques (Matières Critiques)</h2>
                </div>
                <span className="text-[11px] font-mono text-on-surface-variant">Taux d'échec &gt; 35%</span>
              </div>

              <div className="divide-y divide-outline-variant/15 text-xs">
                {criticalSubjects.map((cs, idx) => (
                  <div key={idx} className="py-2.5 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-on-surface">{cs.subjectName}</div>
                      <div className="text-[10px] text-on-surface-variant">
                        {cs.classeLabel} • {cs.semesterLabel} • Formateur : {cs.formateurName}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="inline-block px-2 py-0.5 rounded bg-error-container text-error font-bold font-mono text-[10px]">
                        {cs.failureRate}% d'échec
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Colonne Droite : Charge & Cohortes (Masquée pour Formateur) */}
        {!isTeacher && (
          <div className="lg:col-span-5 space-y-md">
            <div className="rounded-md bg-surface-container-lowest p-md sm:p-lg border border-outline-variant/30 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
                <h2 className="text-sm font-bold text-on-surface">Charge du Corps Professoral</h2>
                <Link to="/pedagogie/formateurs" className="text-[11px] text-primary font-semibold hover:underline">Annuaire</Link>
              </div>

              <div className="space-y-2 text-xs">
                {teacherLoads.map((t) => (
                  <div key={t.id} className="p-2.5 rounded bg-surface border border-outline-variant/20 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-on-surface">{t.name}</div>
                      <div className="text-[10px] text-on-surface-variant">{t.specialite} • {t.totalCourses} cours</div>
                    </div>
                    <span className="font-mono font-bold text-primary text-xs">{t.totalHours}h</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-md bg-surface-container-lowest p-md sm:p-lg border border-outline-variant/30 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
                <h2 className="text-sm font-bold text-on-surface">Effectifs par Promotion (Cohorte)</h2>
                <Link to="/formations" className="text-[11px] text-primary font-semibold hover:underline">Formations</Link>
              </div>

              <div className="space-y-1.5 text-xs">
                {cohortDistribution.map((c) => (
                  <div key={c.id} className="flex justify-between items-center py-1 border-b border-outline-variant/10">
                    <span className="font-semibold text-on-surface truncate max-w-[180px]">{c.label} ({c.filiereName})</span>
                    <span className="font-mono font-bold text-primary bg-primary-light px-2 py-0.5 rounded">{c.studentCount} élèves</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}