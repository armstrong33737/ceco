import Icon from "./Icon";
import { API_BASE } from "../lib/apiClient";

const isLocalServer = API_BASE.includes("localhost") || API_BASE.includes("127.0.0.1");
const displayAddress = API_BASE.replace(/^https?:\/\//, "");

export default function Header({ user }) {
  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-surface/80 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] z-[60] px-md flex items-center justify-between">
      <div className="flex items-center gap-xs">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-gradient-to-br from-primary to-violet">
          <Icon name="school" className="text-on-primary" />
        </div>
        <span className="font-semibold text-lg text-on-surface tracking-tight">CECO</span>
      </div>

      {/* Adresse du serveur — toujours visible, jamais cachée dans un menu */}
      <div className="hidden sm:flex items-center gap-2 rounded-md bg-success-light px-3 py-1.5">
        <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
        <span className="text-xs font-medium text-on-surface">
          {isLocalServer ? "Serveur local" : "Serveur distant"} · {displayAddress}
        </span>
      </div>

      <div className="flex items-center gap-md">
        <div className="flex items-center gap-xs px-xs py-1">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-on-surface leading-tight">
              {user ? `${user.firstName} ${user.lastName}` : "..."}
            </p>
            <p className="text-xs text-on-surface-variant leading-tight">
              {user?.role?.name || "Utilisateur"}
            </p>
          </div>
          <div className="w-8 h-8 rounded-md bg-gradient-to-br from-primary to-violet flex items-center justify-center shadow-sm">
            <Icon name="person" className="text-on-primary text-[18px]" />
          </div>
        </div>
      </div>
    </header>
  );
}