import {
  AVATAR,
  ProductPhoto,
  SAMPLE,
  SectionHeading,
  sectionY,
  usd,
  wrap,
} from "@/components/landing/landing-ui";
import { StoreInitial, StoreName, StoreSlug } from "@/components/landing/store-name";
import { cn } from "@/lib/utils";

/**
 * Los tres pasos. Acá la numeración sí es información: es un orden real.
 * Cada paso lleva el pedacito de interfaz que le toca, con el nombre que la
 * persona escribió arriba, para que vea su tienda armándose.
 */

const card = "flex min-w-0 flex-col gap-3 rounded-[26px] border border-linea bg-white p-[26px]";
const mini = "mt-auto grid gap-2.5 rounded-[18px] border border-linea bg-claro p-3.5";
const field = "block truncate rounded-[10px] border border-linea-fuerte bg-white px-3 py-[9px] text-sm";

export function LandingSteps() {
  return (
    <section id="como-funciona" className={cn(sectionY, "scroll-mt-20")}>
      <div className={wrap}>
        <SectionHeading eyebrow="Cómo funciona" title="Tu tienda lista en tres pasos." />

        <ol className="mt-[60px] grid gap-[18px] lg:grid-cols-3">
          <Step n={1} title="Crea tu tienda." text="Con tu correo y el nombre de tu negocio. Sin tarjeta de crédito.">
            <div className={mini} aria-hidden="true">
              <div className="grid gap-1">
                <span className="text-[11.5px] font-semibold text-gris">Nombre de tu negocio</span>
                <b className={cn(field, "font-semibold")}>
                  <StoreName />
                </b>
              </div>
              <div className="grid gap-1">
                <span className="text-[11.5px] font-semibold text-gris">Tu link</span>
                <span className={cn(field, "font-landing-mono")}>
                  usatiendify.com/<StoreSlug />
                </span>
              </div>
            </div>
          </Step>

          <Step n={2} title="Carga tus productos." text="Foto, precio en dólares, tallas y stock. Todo desde el celular.">
            <div className={mini} aria-hidden="true">
              <div className="flex items-center gap-3">
                <ProductPhoto
                  src={SAMPLE.franela.photo}
                  sizes="52px"
                  className="size-[52px] shrink-0 rounded-xl"
                />
                <div className="grid min-w-0 flex-1 leading-snug">
                  <b className="truncate text-[14.5px]">{SAMPLE.franela.name}</b>
                  <span className="font-landing-mono text-[12.5px] text-pizarra">
                    {usd(SAMPLE.franela.usd)} · Stock 14
                  </span>
                </div>
                <span className="rounded-full bg-success-surface px-2.5 py-1.5 text-xs font-bold leading-none text-success-text">
                  Publicado
                </span>
              </div>
            </div>
          </Step>

          <Step n={3} title="Pon el link en tu bio." text="Tus clientes ven, piden y pagan. Tú confirmas y despachas.">
            <div className={mini} aria-hidden="true">
              <div className="flex items-center gap-3">
                <span
                  className="grid size-[54px] shrink-0 place-items-center rounded-full text-xl font-bold text-white shadow-[0_0_0_3px_hsl(var(--claro)),0_0_0_5px_hsl(var(--brand-500))]"
                  style={{ background: AVATAR.azul }}
                >
                  <StoreInitial />
                </span>
                <div className="grid min-w-0 leading-snug">
                  <b className="truncate text-[14.5px]">
                    <StoreName />
                  </b>
                  <span className="text-[13px] text-pizarra">Ropa y accesorios · Caracas</span>
                  <span className="truncate font-landing-mono text-[13px] font-semibold text-brand-700">
                    usatiendify.com/<StoreSlug />
                  </span>
                </div>
              </div>
            </div>
          </Step>
        </ol>
      </div>
    </section>
  );
}

function Step({
  n,
  title,
  text,
  children,
}: {
  n: number;
  title: string;
  text: string;
  children: React.ReactNode;
}) {
  return (
    <li className={card}>
      {/* Número calado: el orden ya lo dice la <ol>, esto es solo para el ojo. */}
      <span
        aria-hidden="true"
        className="mb-2 font-landing-display text-[76px] font-extrabold leading-[0.78] tracking-[-0.04em] text-transparent [-webkit-text-stroke:2px_hsl(var(--noche))] [font-stretch:75%]"
      >
        {n}
      </span>
      <h3 className="font-landing-display text-[1.6rem] font-extrabold leading-none tracking-[-0.03em] [font-stretch:88%]">
        {title}
      </h3>
      <p className="text-pretty text-[15.5px] leading-relaxed text-pizarra">{text}</p>
      {children}
    </li>
  );
}
