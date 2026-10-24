import { PulseLogo } from "@/components/brand/logo";
import { LoginForm } from "./login-form";

export const metadata = { title: "Connexion" };

export default function LoginPage() {
  return (
    <main className="mx-auto grid min-h-dvh max-w-md content-center gap-8 px-6" style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
      <header>
        <h1><PulseLogo size={64} /></h1>
        <p className="mt-3 max-w-xs text-lg text-ink-soft">Chaque sortie raconte quelque chose.</p>
      </header>
      <LoginForm google={!!process.env.GOOGLE_CLIENT_ID} />
    </main>
  );
}
