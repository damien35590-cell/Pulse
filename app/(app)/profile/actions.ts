"use server";
import { revalidatePath } from "next/cache";
import { del, put } from "@vercel/blob";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MAX_BYTES = 5 * 1024 * 1024;
type Res = { ok: true } | { ok: false; error: string };
const isBlobUrl = (u?: string | null) => { try { return !!u && new URL(u).hostname.endsWith(".blob.vercel-storage.com"); } catch { return false; } };

/** Met à jour le nom et, selon le formulaire, remplace (« file ») ou retire (« remove ») la photo. */
export async function updateProfile(fd: FormData): Promise<Res> {
  const userId = (await auth())?.user?.id;
  if (!userId) return { ok: false, error: "Session expirée, reconnectez-vous." };
  const name = String(fd.get("name") ?? "").trim().replace(/\s+/g, " ");
  if (name.length < 1 || name.length > 40) return { ok: false, error: "Le nom doit faire de 1 à 40 caractères." };
  const file = fd.get("file"), remove = fd.get("remove") === "1";
  const hasFile = file instanceof File && file.size > 0;
  if (hasFile && (!file.type.startsWith("image/") || file.size > MAX_BYTES)) return { ok: false, error: "Fichier refusé : une image de 5 Mo maximum est attendue." };
  if (hasFile && !process.env.BLOB_READ_WRITE_TOKEN) return { ok: false, error: "Stockage photo non configuré (BLOB_READ_WRITE_TOKEN)." };

  try {
    const prev = (await prisma.user.findUnique({ where: { id: userId }, select: { image: true } }))?.image;
    let image: string | null | undefined;
    if (hasFile) image = (await put(`avatars/${userId}.webp`, file, { access: "public", contentType: file.type, addRandomSuffix: true })).url;
    else if (remove) image = null;
    await prisma.user.update({ where: { id: userId }, data: { name, ...(image !== undefined && { image }) } });
    if (image !== undefined && isBlobUrl(prev)) await del(prev!).catch(() => {}); // l'ancienne photo ne doit pas faire échouer l'enregistrement
  } catch {
    return { ok: false, error: "Enregistrement impossible, réessayez." };
  }
  revalidatePath("/profile");
  return { ok: true };
}
