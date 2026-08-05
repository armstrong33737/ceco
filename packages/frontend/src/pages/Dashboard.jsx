import { motion } from "framer-motion";
import useAuthStore from "../store/authStore";

export default function Dashboard() {
  const user = useAuthStore((s) => s.user);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <h1 className="text-2xl font-bold text-on-surface">
        Bonjour{user ? `, ${user.firstName}` : ""}
      </h1>
      <p className="mt-1 text-sm text-on-surface-variant">Bienvenue sur votre espace CECO.</p>

      <div className="mt-lg rounded-2xl bg-surface-container-lowest p-lg shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <p className="text-on-surface">
          Les statistiques du centre (apprenants, formations, stages) arriveront avec les
          modules pédagogiques (V2 et suivants).
        </p>
      </div>
    </motion.div>
  );
}