import { Outlet } from "react-router-dom";
import Header from "./Header";
import Sidebar from "./Sidebar";
import useAuthStore from "../store/authStore";

export default function Layout() {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="min-h-screen bg-surface">
      <Header user={user} />
      <Sidebar />
      <div className="pl-sidebar-width pt-16">
        <main className="min-h-[calc(100vh-64px)] px-md py-md">
          <Outlet />
        </main>
      </div>
    </div>
  );
}