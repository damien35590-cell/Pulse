"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";

export function LoginForm({ google }: { google: boolean }) {
  const [pw, setPw] = useState(""), [busy, setBusy] = useState(false), [err, setErr] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    const r = await signIn("credentials", { password: pw, redirect: false });
    if (r?.ok && !r.error) { window.location.href = "/"; return; }
    setErr("Mot de passe incorrect."); setBusy(false);
  }
  return (
    <div className="grid gap-4">
      <form onSubmit={submit} className="grid gap-3">
        <label className="text-sm text-ink-soft" htmlFor="pw">Mot de passe</label>
        <input id="pw" type="password" required autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} className="min-h-14 rounded-xl border border-line bg-surface px-4 text-lg" />
        {err && <p role="alert" className="text-sm font-medium text-brand">{err}</p>}
        <button disabled={busy} className="min-h-14 rounded-xl bg-brand font-display text-xl font-semibold text-brand-ink disabled:opacity-60 active:scale-[.98]">{busy ? "Connexion…" : "Se connecter"}</button>
      </form>
      {google && <button onClick={() => signIn("google", { callbackUrl: "/" })} className="min-h-14 rounded-xl bg-surface-2 font-semibold">Continuer avec Google</button>}
    </div>
  );
}
