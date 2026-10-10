export const metadata = { title: "Hors connexion" };

export default function Offline() {
  return (
    <main className="grid min-h-dvh place-items-center p-6 text-center">
      <div>
        <h1 className="font-display text-4xl font-bold">Vous êtes hors connexion</h1>
        <p className="mt-3 text-ink-soft">Les activités déjà consultées restent disponibles. Reconnectez-vous pour synchroniser.</p>
      </div>
    </main>
  );
}
