const SIZE = 512;

/** Recadre l'image en carré au centre et la réduit à 512 px en WebP (qualité 0,85), pour n'envoyer qu'un petit fichier. */
export async function toAvatarBlob(file: Blob): Promise<Blob> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const side = Math.min(bmp.width, bmp.height), c = document.createElement("canvas");
  c.width = c.height = SIZE;
  const g = c.getContext("2d");
  if (!g) throw new Error("canvas");
  g.imageSmoothingQuality = "high";
  g.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
  bmp.close();
  const out = await new Promise<Blob | null>((r) => c.toBlob(r, "image/webp", 0.85));
  if (!out || out.type !== "image/webp") throw new Error("webp");
  return out;
}
