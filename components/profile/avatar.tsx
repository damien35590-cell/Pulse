import { cn } from "@/lib/utils";

const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "P";

/** Photo de profil ; sans photo, les initiales sur surface-2. */
export function Avatar({ name, image, className }: { name: string; image?: string | null; className?: string }) {
  return (
    <span className={cn("grid shrink-0 place-items-center overflow-hidden rounded-full bg-surface-2 font-display font-bold text-ink", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {image ? <img src={image} alt="" className="size-full object-cover" /> : <span aria-hidden>{initials(name)}</span>}
    </span>
  );
}
