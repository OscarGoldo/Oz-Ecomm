import { Sticker, TagOutline, reveal, wrap } from "@/components/landing/landing-ui";
import { Pana } from "@/components/landing/pana";
import { StoreClaimForm } from "@/components/landing/store-name";

/**
 * El cierre, en noche como la última lámina de los carruseles. Repite el
 * campo del hero —ya con lo que la persona escribió arriba— para que no tenga
 * que volver a subir. Pana, la mascota, llega volando y saluda: es azul, así que va sobre
 * noche y no sobre el azul de marca, donde desaparecería.
 */
export function ClosingCta() {
  return (
    <section className="relative isolate overflow-hidden bg-noche text-claro">
      <TagOutline className="pointer-events-none absolute -bottom-[40%] -left-[8%] -z-10 w-[min(70vw,760px)] text-white/[0.06]" />
      <div
        className={`${wrap} grid items-center gap-10 py-[clamp(80px,9vw,128px)] lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.65fr)]`}
      >
        <div>
          <h2 {...reveal(0, "wipe")} className="text-balance font-landing-display text-[clamp(2.5rem,1.4rem+4.2vw,5rem)] font-extrabold leading-[0.92] tracking-[-0.047em] [font-stretch:82%]">
            Tu catálogo en línea, <Sticker>hoy mismo.</Sticker>
          </h2>
          <p {...reveal(150)} className="mt-5 max-w-[46ch] text-pretty text-[clamp(1.05rem,1rem+0.3vw,1.22rem)] text-niebla">
            Creas la tienda, cargas tus productos y compartes el link. Eso es todo.
          </p>
          <div {...reveal(250)} className="mt-[30px]">
            <StoreClaimForm id="tienda-cierre" label="Nombre de tu negocio" tone="night" />
          </div>
        </div>

        <div {...reveal(0, "fly")} className="relative order-first w-[min(70%,260px)] justify-self-start lg:order-none lg:w-[min(100%,330px)] lg:justify-self-center">
          <span
            aria-hidden="true"
            {...reveal(1150, "pop")}
            className="absolute -left-[4%] top-[4%] z-10 rounded-[20px_20px_20px_5px] bg-white px-[17px] py-[13px] font-landing-display text-xl font-extrabold leading-none tracking-[-0.02em] text-noche shadow-[0_2px_6px_hsl(var(--noche)/0.1),0_30px_50px_-18px_rgb(0_0_0/0.45)] [font-stretch:90%] [rotate:-6deg]"
          >
            Epa, pana.
          </span>
          <Pana className="h-auto w-full overflow-visible" />
        </div>
      </div>
    </section>
  );
}
