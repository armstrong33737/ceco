// packages/frontend/src/App.jsx
import { useEffect } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import useAuthStore from "./store/authStore";
import Login from "./pages/Login";
import Layout from "./components/Layout";
import SettingsLayout from "./components/SettingsLayout";
import Dashboard from "./pages/Dashboard";
import Formations from "./pages/Formations";
import Students from "./pages/Students";
import CenterSettings from "./pages/CenterSettings";
import Users from "./pages/Users";
import Roles from "./pages/Roles";
import DocumentTemplatesSettings from "./pages/DocumentTemplatesSettings";
import License from "./pages/License";
import Backups from "./pages/Backups";
import About from "./pages/About";
import AuditLogs from "./pages/AuditLogs";
import PedagogieLayout from "./components/PedagogieLayout";
import GradesEntry from "./pages/pedagogie/GradesEntry";
import ClassOfferings from "./pages/pedagogie/ClassOfferings";
import FiliereCurriculum from "./pages/pedagogie/FiliereCurriculum";
import SubjectsCatalog from "./pages/pedagogie/SubjectsCatalog";
import SubjectCategories from "./pages/pedagogie/SubjectCategories";
import TeachersList from "./pages/pedagogie/TeachersList";
import GradingPolicies from "./pages/pedagogie/GradingPolicies";
import DeliberationView from "./pages/pedagogie/DeliberationView";
import BulletinsView from "./pages/pedagogie/BulletinsView";

export default function App() {
  const { token, status, restoreSession } = useAuthStore();

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  if (status === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <motion.div
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.4, repeat: Infinity }}
          className="text-sm text-on-surface-variant font-medium"
        >
          Connexion à votre espace de travail CECO...
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
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="formations" element={<Formations />} />
            <Route path="etudiants" element={<Students />} />
            <Route path="pedagogie" element={<PedagogieLayout />}>
              <Route index element={<Navigate to="saisie" replace />} />
              <Route path="saisie" element={<GradesEntry />} />
              <Route path="deliberations" element={<DeliberationView />} />
              <Route path="bulletins" element={<BulletinsView />} />
              <Route path="maquettes" element={<ClassOfferings />} />
              <Route path="programmes-filieres" element={<FiliereCurriculum />} />
              <Route path="matieres" element={<SubjectsCatalog />} />
              <Route path="categories" element={<SubjectCategories />} />
              <Route path="formateurs" element={<TeachersList />} />
              <Route path="ponderations" element={<GradingPolicies />} />
            </Route>
            <Route path="parametres" element={<SettingsLayout />}>
              <Route index element={<Navigate to="centre" replace />} />
              <Route path="centre" element={<CenterSettings />} />
              <Route path="utilisateurs" element={<Users />} />
              <Route path="roles" element={<Roles />} />
              <Route path="modeles" element={<DocumentTemplatesSettings />} />
              <Route path="licence" element={<License />} />
              <Route path="sauvegarde" element={<Backups />} />
              <Route path="audit" element={<AuditLogs />} />
              <Route path="apropos" element={<About />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        )}
      </Routes>
    </HashRouter>
  );
}