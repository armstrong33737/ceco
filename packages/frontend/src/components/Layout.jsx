import { Outlet } from "react-router-dom";
import Header from "./Header";
import Sidebar from "./Sidebar";
import useAuthStore from "../store/authStore";

export default function Layout() {
  const user = useAuthStore((s) => s.user);
  const isSidebarCollapsed = useAuthStore((s) => s.isSidebarCollapsed);

  return (
    <div className="min-h-screen bg-surface">
      <Header user={user} />
      <Sidebar />
      <div className={`${isSidebarCollapsed ? "pl-20" : "pl-sidebar-width"} pt-16 transition-all duration-300`}>
        <main className="min-h-[calc(100vh-64px)] px-md py-md max-w-7xl mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}