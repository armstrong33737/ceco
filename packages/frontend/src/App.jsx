import StatusBar from "./components/StatusBar";

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <StatusBar mode="local" connected={true} />
      <header className="px-6 py-4 border-b border-ocre/30">
        <h1 className="font-display text-2xl text-encre font-bold">CECO</h1>
        <p className="text-anthracite/70 text-sm">Tableau de bord — V0</p>
      </header>
      <main className="flex-1 p-6">
        <p className="text-anthracite">
          Squelette V0. Connectez le backend (voir <code>packages/backend</code>) puis
          construisez les premiers modules (apprenants, formations) par-dessus cette base.
        </p>
      </main>
    </div>
  );
}
