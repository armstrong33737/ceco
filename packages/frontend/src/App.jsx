import { useEffect } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import useAuthStore from "./store/authStore";
import Login from "./pages/Login";
import Layout from "./components/Layout";
import SettingsLayout from "./components/SettingsLayout";
import Dashboard from "./pages/Dashboard";
import CenterSettings from "./pages/CenterSettings";
import Users from "./pages/Users";
import Roles from "./pages/Roles";
import License from "./pages/License";
import Backups from "./pages/Backups";
import About from "./pages/About";

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
          className="text-sm text-on-surface-variant"
        >
          Connexion à votre espace de travail...
        </motion.div>
      </div>
    );
  }

  const isAuthenticated = token && status === "authenticated";

  return (
    <HashRouter>
      <AnimatePresence mode="wait">
        {!isAuthenticated ? (
          <motion.div key="login" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Login />
          </motion.div>
        ) : (
          <motion.div key="app" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Routes>
              <Route element={<Layout />}>
                <Route index element={<Dashboard />} />
                <Route path="parametres" element={<SettingsLayout />}>
                  <Route index element={<Navigate to="centre" replace />} />
                  <Route path="centre" element={<CenterSettings />} />
                  <Route path="utilisateurs" element={<Users />} />
                  <Route path="roles" element={<Roles />} />
                  <Route path="licence" element={<License />} />
                  <Route path="sauvegarde" element={<Backups />} />
                  <Route path="apropos" element={<About />} />
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </motion.div>
        )}
      </AnimatePresence>
    </HashRouter>
  );
}