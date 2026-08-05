import { motion } from "framer-motion";
import Icon from "../components/Icon";

export default function About() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="max-w-3xl"
    >
      <div className="rounded-md bg-surface-container-lowest p-lg shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-outline-variant/30">
        <div className="flex items-center gap-4 border-b border-outline-variant/20 pb-4 mb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-md bg-gradient-to-br from-primary to-violet">
            <Icon name="bookmark" className="text-white text-[24px]" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-on-surface">À propos de CECO</h2>
            <span className="text-xs text-on-surface-variant font-medium">ERP de gestion de référence</span>
          </div>
        </div>

        <div className="space-y-4 text-sm text-on-surface-variant leading-relaxed">
          <p>
            <strong>CECO V1</strong> est l'ERP de gestion des centres de formation professionnelle 
            permettant l'alignement des critères administratifs, financiers et académiques.
          </p>

          <h3 className="font-semibold text-on-surface text-sm uppercase tracking-wider mt-4">Notice Technique</h3>
          <div className="bg-surface rounded-md p-4 space-y-2 text-xs font-mono">
            <div><span className="text-primary font-bold">Produit :</span> CECO Core Desktop Application</div>
            <div><span className="text-primary font-bold">Version de référence :</span> V1.0.0-v0</div>
            <div><span className="text-primary font-bold">Base de données :</span> PostgreSQL (Prisma Client)</div>
            <div><span className="text-primary font-bold">Dépôt source :</span> africa.ceco.desktop</div>
          </div>

          <h3 className="font-semibold text-on-surface text-sm uppercase tracking-wider mt-4">Spécifications Générales</h3>
          <ul className="list-disc pl-5 space-y-2 text-xs">
            <li>
              <strong>Architecture Multi-Tenant :</strong> Isolement fort par <code className="bg-surface px-1 py-0.5 rounded text-primary">centerId</code>.
            </li>
            <li>
              <strong>Matières et Évaluations :</strong> Modèle flexible par semestre pour figer les relevés.
            </li>
            <li>
              <strong>Sécurité :</strong> Empreinte chiffrée, QR Code de validation et RBAC configurable.
            </li>
          </ul>
        </div>
      </div>
    </motion.div>
  );
}