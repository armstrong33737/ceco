// packages/frontend/src/pages/Students.jsx
import React from "react";
import { useLocation } from "react-router-dom";
import LearnersListPage from "../modules/learners/LearnersListPage";
import LearnersArchivesPage from "../modules/learners/LearnersArchivesPage";

export default function Students() {
  const location = useLocation();
  const isArchives = location.pathname.includes("/archives");

  return isArchives ? <LearnersArchivesPage /> : <LearnersListPage />;
}