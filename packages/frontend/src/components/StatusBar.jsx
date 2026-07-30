// Le statut de connexion serveur (local/distant) doit TOUJOURS être
// visible, jamais caché dans un menu — décision UX du projet CECO.
export default function StatusBar({ mode = "local", address = "192.168.1.10:4000", connected = true }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-encre text-papier text-sm font-sans">
      <span
        className={`inline-block w-2 h-2 rounded-full ${connected ? "bg-sauge" : "bg-brique"}`}
      />
      <span>
        {connected ? "Connecté" : "Hors ligne"} —{" "}
        {mode === "local" ? `Serveur local (${address})` : "Serveur distant"}
      </span>
    </div>
  );
}
