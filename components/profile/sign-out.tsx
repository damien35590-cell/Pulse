"use client";
import { signOut } from "next-auth/react";
export function SignOut() {
  return <button onClick={() => signOut({ callbackUrl: "/login" })} className="min-h-12 w-full rounded-xl border border-line bg-surface font-semibold">Se déconnecter</button>;
}
