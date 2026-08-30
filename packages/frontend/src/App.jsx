// packages/frontend/src/App.jsx
import React, { useEffect } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import useAuthStore from "./store/authStore";
import Login from "./pages/Login";
import AppShell from "./app/AppShell";

// Modules Métier
import DashboardPage from "./pages/Dashboard";
import LearnersListPage from "./modules/learners/LearnersListPage";
import LearnersArchivesPage from "./modules/learners/LearnersArchivesPage";

// Académie
import FilieresCyclesPage from "./modules/academie/FilieresCyclesPage";
import PromotionsPage from "./modules/academie/PromotionsPage";
import ClassesPage from "./modules/academie/ClassesPage";
import SessionsPage from "./modules/academie/SessionsPage";
import SallesPage from "./modules/academie/SallesPage";

// Pédagogie
import GradesEntryPage from "./pages/pedagogie/GradesEntry";
import DeliberationView from "./pages/pedagogie/DeliberationView";
import BulletinsDiplomesPage from "./modules/documents/BulletinsDiplomesPage";
import ClassOfferings from "./pages/pedagogie/ClassOfferings";
import FiliereCurriculum from "./pages/pedagogie/FiliereCurriculum";
import TeachersList from "./pages/pedagogie/TeachersList";
import SubjectsCatalog from "./pages/pedagogie/SubjectsCatalog";
import SubjectCategories from "./pages/pedagogie/SubjectCategories";
import GradingPolicies from "./pages/pedagogie/GradingPolicies";

// Administration
import CenterIdentityPage from "./modules/administration/CenterIdentityPage";
import DocumentStudioPage from "./modules/documents/DocumentStudioPage";
import UsersManagementPage from "./modules/administration/UsersManagementPage";
import RolesPermissionsPage from "./modules/administration/RolesPermissionsPage";
import LicenseSecurityPage from "./modules/administration/LicenseSecurityPage";
import BackupsPage from "./modules/administration/BackupsPage";
import AuditLogsPage from "./modules/administration/AuditLogsPage";
import AboutPage from "./modules/administration/AboutPage";

export default function App() {
  const { token, status, restoreSession } = useAuthStore();

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  if (status === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas-light text-ink-primary font-sans dark:bg-canvas-dark dark:text-ink-primary-dark">
        <motion.div
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.4, repeat: Infinity }}
          className="text-body-md font-medium"
        >
          Initialisation de votre espace CECO...
        </motion.div>
      </div>
    );
  }

  const isAuthenticated = token && status === "authenticated";

  return (
    <HashRouter>
      <Routes>
        {!isAuthenticated ? (
          <Route path="*" element={<Login />} />
        ) : (
          <Route element={<AppShell />}>
            {/* 1. PRINCIPAL */}
            <Route index element={<DashboardPage />} />

            {/* 2. SCOLARITÉ & APPRENANTS */}
            <Route path="apprenants" element={<LearnersListPage />} />
            <Route path="apprenants/archives" element={<LearnersArchivesPage />} />

            {/* 3. STRUCTURE ACADÉMIQUE */}
            <Route path="academie/filieres" element={<FilieresCyclesPage />} />
            <Route path="academie/promotions" element={<PromotionsPage />} />
            <Route path="academie/classes" element={<ClassesPage />} />
            <Route path="academie/sessions" element={<SessionsPage />} />
            <Route path="academie/salles" element={<SallesPage />} />

            {/* 4. PÉDAGOGIE & ÉVALUATIONS */}
            <Route path="pedagogie/saisie" element={<GradesEntryPage />} />
            <Route path="pedagogie/deliberations" element={<DeliberationView />} />
            <Route path="pedagogie/bulletins" element={<BulletinsDiplomesPage />} />
            <Route path="pedagogie/maquettes" element={<ClassOfferings />} />
            <Route path="pedagogie/cursus" element={<FiliereCurriculum />} />
            <Route path="pedagogie/formateurs" element={<TeachersList />} />
            <Route path="pedagogie/matieres" element={<SubjectsCatalog />} />
            <Route path="pedagogie/categories" element={<SubjectCategories />} />
            <Route path="pedagogie/ponderations" element={<GradingPolicies />} />

            {/* 5. ADMINISTRATION & SÉCURITÉ */}
            <Route path="administration/centre" element={<CenterIdentityPage />} />
            <Route path="administration/modeles" element={<DocumentStudioPage />} />
            <Route path="administration/utilisateurs" element={<UsersManagementPage />} />
            <Route path="administration/roles" element={<RolesPermissionsPage />} />
            <Route path="administration/licence" element={<LicenseSecurityPage />} />
            <Route path="administration/sauvegardes" element={<BackupsPage />} />
            <Route path="administration/audit" element={<AuditLogsPage />} />
            <Route path="administration/apropos" element={<AboutPage />} />

            {/* Redirections de sécurité */}
            <Route path="etudiants" element={<Navigate to="/apprenants" replace />} />
            <Route path="formations" element={<Navigate to="/academie/filieres" replace />} />
            <Route path="pedagogie" element={<Navigate to="/pedagogie/saisie" replace />} />
            <Route path="parametres/*" element={<Navigate to="/administration/centre" replace />} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        )}
      </Routes>
    </HashRouter>
  );
}