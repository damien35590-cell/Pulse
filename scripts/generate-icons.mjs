// Rasterise les SVG de assets/brand/ en icônes d'app. Usage : npm run icons
import sharp from "sharp";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const brand = (f) => readFile(resolve(root, "assets/brand", f));
const out = (f) => resolve(root, f);

const master = await brand("pulse-mark.svg");
const maskable = await brand("pulse-mark-maskable.svg");
const mono = await brand("pulse-mark-monochrome.svg");
const png = (svg, size) => sharp(svg, { density: 384 }).resize(size, size).png().toBuffer();

// Badge 96 px : trait plus épais pour rester lisible
const badgeMono = mono.toString().replace('stroke-width="30"', 'stroke-width="40"');

// ICO : trois PNG embarqués (16/32/48)
function ico(images) {
  const head = Buffer.alloc(6);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(images.length, 4);
  let offset = 6 + 16 * images.length;
  const dirs = images.map(({ size, data }) => {
    const d = Buffer.alloc(16);
    d.writeUInt8(size, 0); d.writeUInt8(size, 1);
    d.writeUInt16LE(1, 4); d.writeUInt16LE(32, 6);
    d.writeUInt32LE(data.length, 8); d.writeUInt32LE(offset, 12);
    offset += data.length;
    return d;
  });
  return Buffer.concat([head, ...dirs, ...images.map((i) => i.data)]);
}

await mkdir(out("public/icons"), { recursive: true });
await writeFile(out("app/icon.svg"), master);
await writeFile(out("app/favicon.ico"), ico(await Promise.all([16, 32, 48].map(async (size) => ({ size, data: await png(master, size) })))));
await writeFile(out("app/apple-icon.png"), await png(maskable, 180)); // iOS arrondit lui-même : fond plein, marque à 0,85
for (const s of [192, 512]) {
  await writeFile(out(`public/icons/icon-live-${s}.png`), await png(master, s));
  await writeFile(out(`public/icons/icon-live-maskable-${s}.png`), await png(maskable, s));
}
await writeFile(out("public/icons/icon-live-monochrome-512.png"), await png(mono, 512));
await writeFile(out("public/icons/badge-live-96.png"), await png(Buffer.from(badgeMono), 96)); // badge des notifications (silhouette blanche)
console.log("icons ok");
