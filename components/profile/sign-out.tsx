"use client";
import { useState } from "react";
import { signOut } from "next-auth/react";
import { ConfirmSheet } from "@/components/ui/bottom-sheet";

export function SignOut() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="mx-auto flex min-h-12 touch-manipulation items-center px-4 text-sm font-semibold text-bad active:opacity-60">Se déconnecter</button>
      <ConfirmSheet open={open} onClose={() => setOpen(false)} onConfirm={() => signOut({ callbackUrl: "/login" })} title="Se déconnecter ?" message="Tu devras te reconnecter pour retrouver tes données." confirmLabel="Se déconnecter" destructive />
    </>
  );
}
