// Lance tous les tests tools/test-*.ts l'un après l'autre (Windows comme Linux) : npm test
import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const files = readdirSync(dir).filter((f) => /^test-.*\.ts$/.test(f)).sort();
let failed = 0;
for (const f of files) {
  const r = spawnSync(process.execPath, ["--import", "tsx", join(dir, f)], { stdio: "inherit" });
  if (r.status !== 0) { failed++; console.error(`✗ ${f}`); } else console.log(`✓ ${f}`);
}
console.log(failed ? `${failed} fichier(s) de test en échec sur ${files.length}` : `${files.length} fichiers de test : tout est vert`);
process.exit(failed ? 1 : 0);
