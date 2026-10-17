import type { AnnouncementStyle, LookId } from "@/lib/design/types";

/**
 * La barra de anuncio de arriba. Fija o en movimiento: "auto" la mueve en los
 * estilos que la tenían así (Atleta Editorial y Drops).
 */
export function StoreAnnouncement({
  text,
  look,
  style = "auto",
}: {
  text: string;
  look: LookId;
  style?: AnnouncementStyle;
}) {
  const moving =
    style === "movimiento" ||
    (style === "auto" && (look === "fashion-athletic" || look === "sports-drops"));

  if (moving) {
    return (
      <div
        className="overflow-hidden py-1.5 text-xs font-extrabold uppercase tracking-widest"
        style={{
          background: "hsl(var(--brand-accent, var(--primary)))",
          color: "hsl(var(--brand-accent-foreground, 0 0% 100%))",
        }}
      >
        <div className="flex animate-marquee whitespace-nowrap">
          {Array.from({ length: 8 }).map((_, i) => (
            <span key={i} className="mx-8">
              {text}
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className="px-4 py-2 text-center text-sm font-medium"
      style={{
        background: "hsl(var(--brand-accent, var(--primary)))",
        color: "hsl(var(--brand-accent-foreground, 0 0% 100%))",
      }}
    >
      {text}
    </div>
  );
}
