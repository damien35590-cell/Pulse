/**
 * Sauvegarde nocturne des données de muscu vers Google Drive (API REST v3, scope drive.file : l'app ne voit que les fichiers qu'elle a créés).
 * Dossier « Pulse Backups », fichiers pulse-muscu-AAAA-MM-JJ.json et .csv, les 30 plus récents de chaque sorte sont gardés.
 */
import { prisma } from "@/lib/prisma";
import { getValidAccessToken } from "@/lib/sync/google-fit";
import { exportStrength, toCsv } from "./strength-export";

export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const FOLDER_NAME = "Pulse Backups";
const FOLDER_MIME = "application/vnd.google-apps.folder";
const KEEP = 30;
const API = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3";
const NAME_RE = /^pulse-muscu-\d{4}-\d{2}-\d{2}\.(json|csv)$/;

/** Compte Google absent, sans le droit Drive, ou jeton refusé : il faut se reconnecter à Google. */
export class DriveAuthError extends Error {}

const folderKey = (uid: string) => `drive-backup:folder:${uid}`;
const lastKey = (uid: string) => `drive-backup:last:${uid}`;

async function setSecret(key: string, value: string) {
  await prisma.appSecret.upsert({ where: { key }, update: { value }, create: { key, value } });
}

/** Date de la dernière sauvegarde réussie, ou null. */
export async function getLastBackupAt(uid: string): Promise<Date | null> {
  const r = await prisma.appSecret.findUnique({ where: { key: lastKey(uid) } });
  const d = r ? new Date(r.value) : null;
  return d && !isNaN(+d) ? d : null;
}

async function drive(token: string, url: string, init: RequestInit = {}) {
  const res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, ...init.headers } });
  if (res.status === 401 || res.status === 403) {
    const body = (await res.text()).slice(0, 200);
    // 403 hors autorisation (quota, API Drive non activée) n'est pas un problème de reconnexion.
    if (res.status === 401 || /insufficient|scope|invalid_grant|unauthenticated/i.test(body)) throw new DriveAuthError(`Drive ${res.status} : ${body}`);
    throw new Error(`Drive ${res.status} : ${body}`);
  }
  if (!res.ok) throw new Error(`Drive ${res.status} : ${(await res.text()).slice(0, 200)}`);
  return res;
}
const q = (s: string) => s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

async function ensureFolder(token: string, uid: string): Promise<string> {
  const saved = (await prisma.appSecret.findUnique({ where: { key: folderKey(uid) } }))?.value;
  if (saved) {
    const r = await fetch(`${API}/files/${encodeURIComponent(saved)}?fields=id,trashed`, { headers: { Authorization: `Bearer ${token}` } });
    if (r.ok && !(await r.json()).trashed) return saved;
    if (r.status === 401) throw new DriveAuthError("Drive 401");
  }
  const found = await (await drive(token, `${API}/files?q=${encodeURIComponent(`name='${q(FOLDER_NAME)}' and mimeType='${FOLDER_MIME}' and trashed=false`)}&fields=files(id)&pageSize=1`)).json();
  let id: string | undefined = found.files?.[0]?.id;
  if (!id) {
    const r = await drive(token, `${API}/files?fields=id`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: FOLDER_NAME, mimeType: FOLDER_MIME }) });
    id = (await r.json()).id as string;
  }
  await setSecret(folderKey(uid), id);
  return id;
}

/** Envoie le fichier, ou remplace celui du même nom (deux sauvegardes le même jour). */
async function putFile(token: string, folderId: string, name: string, mime: string, content: string, existing: Map<string, string>) {
  const id = existing.get(name);
  const boundary = `pulse${Date.now().toString(36)}`;
  const meta = id ? { name } : { name, parents: [folderId] };
  const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: ${mime}\r\n\r\n${content}\r\n--${boundary}--`;
  await drive(token, `${UPLOAD}/files${id ? `/${id}` : ""}?uploadType=multipart&fields=id`, {
    method: id ? "PATCH" : "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
}

async function listBackups(token: string, folderId: string) {
  const out: { id: string; name: string }[] = [];
  let pageToken = "";
  do {
    const url = `${API}/files?q=${encodeURIComponent(`'${folderId}' in parents and trashed=false`)}&fields=nextPageToken,files(id,name)&pageSize=1000${pageToken ? `&pageToken=${pageToken}` : ""}`;
    const j = await (await drive(token, url)).json();
    out.push(...(j.files ?? []));
    pageToken = j.nextPageToken ?? "";
  } while (pageToken);
  return out.filter((f) => NAME_RE.test(f.name)); // jamais un fichier qui ne suit pas notre nommage
}

export type BackupReport = { date: string; json: string; csv: string; bytes: { json: number; csv: number }; deleted: number; counts: Record<string, number> };

/** Exporte la muscu de `uid` et la dépose dans Drive. Lève DriveAuthError s'il faut se reconnecter à Google. */
export async function backupToDrive(uid: string, now = new Date()): Promise<BackupReport> {
  const account = await prisma.account.findFirst({ where: { userId: uid, provider: "google" } });
  if (!account?.access_token) throw new DriveAuthError("Compte Google non lié.");
  if (!account.scope?.split(" ").includes(DRIVE_SCOPE)) throw new DriveAuthError("Droit Drive non accordé : reconnecte Google.");
  const token = await getValidAccessToken(account);

  const backup = await exportStrength(uid, now);
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const [jsonName, csvName] = [`pulse-muscu-${day}.json`, `pulse-muscu-${day}.csv`];
  const json = JSON.stringify(backup), csv = toCsv(backup);

  const folderId = await ensureFolder(token, uid);
  const files = await listBackups(token, folderId);
  const byName = new Map(files.map((f) => [f.name, f.id]));
  await putFile(token, folderId, jsonName, "application/json", json, byName);
  await putFile(token, folderId, csvName, "text/csv", csv, byName);

  // Rotation : on garde les 30 plus récents de chaque sorte (le nom contient la date, donc l'ordre alphabétique est chronologique).
  let deleted = 0;
  for (const ext of ["json", "csv"]) {
    const names = new Set(files.filter((f) => f.name.endsWith(`.${ext}`)).map((f) => f.name).concat(ext === "json" ? jsonName : csvName));
    const old = [...names].sort().reverse().slice(KEEP);
    for (const name of old) {
      const id = byName.get(name);
      if (!id) continue;
      await drive(token, `${API}/files/${id}`, { method: "DELETE" }).then(() => deleted++).catch((e) => console.error("[backup] suppression", name, e instanceof Error ? e.message : e));
    }
  }

  await setSecret(lastKey(uid), now.toISOString());
  return { date: day, json: jsonName, csv: csvName, bytes: { json: json.length, csv: csv.length }, deleted, counts: backup.counts };
}
