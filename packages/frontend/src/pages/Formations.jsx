// packages/frontend/src/pages/Formations.jsx
import React from "react";
import { useLocation } from "react-router-dom";
import FilieresCyclesPage from "../modules/academie/FilieresCyclesPage";
import PromotionsPage from "../modules/academie/PromotionsPage";
import ClassesPage from "../modules/academie/ClassesPage";
import SessionsPage from "../modules/academie/SessionsPage";
import SallesPage from "../modules/academie/SallesPage";

export default function Formations() {
  const location罕 = useLocation();
  const path = location罕.pathname;

  if (path.includes("/promotions")) return <PromotionsPage />;
  if (path.includes("/classes")) return <ClassesPage />;
  if (path.includes("/sessions")) return <SessionsPage />;
  if (path.includes("/salles")) return <SallesPage />;
  return <FilieresCyclesPage />;
}