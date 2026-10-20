import Link from "next/link";

import { reveal, wrap } from "@/components/landing/landing-ui";
import { TiendifyLogo } from "@/components/landing/tiendify-logo";
import { LAUNCH_SIGNUP_HREF } from "@/lib/promo";
import { supportContact } from "@/lib/support";

const LINKS = [
  { label: "Crear tienda", href: LAUNCH_SIGNUP_HREF },
  { label: "Ingresar", href: "/login" },
  { label: "Términos", href: "/terminos" },
  { label: "Privacidad", href: "/privacidad" },
];

export function LandingFooter() {
  // Un lugar donde preguntar antes de registrarse. Es el mismo WhatsApp del
  // soporte del panel (SUPPORT_WHATSAPP); sin la variable, el link no sale.
  const whatsapp = supportContact("Hola, vengo de la página de Tiendify y tengo una pregunta.");

  return (
    <footer className="overflow-hidden bg-claro">
      <div className={wrap}>
        <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-5 border-b border-linea py-9">
          <TiendifyLogo />
          <p className="text-sm text-pizarra">
            © {new Date().getFullYear()} · Un producto de{" "}
            <span className="font-semibold text-noche">OzAI</span> · Hecho en Venezuela
          </p>
          <nav aria-label="Pie de página" className="flex flex-wrap gap-5">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-sm font-semibold text-pizarra transition-colors hover:text-noche"
              >
                {l.label}
              </Link>
            ))}
            {whatsapp && (
              <a
                href={whatsapp.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-semibold text-pizarra transition-colors hover:text-noche"
              >
                WhatsApp
              </a>
            )}
          </nav>
        </div>
        {/* La marca enorme y apenas visible cierra la página como un sello. */}
        <p
          aria-hidden="true"
          {...reveal()}
          className="mb-[-0.14em] mt-[18px] select-none whitespace-nowrap text-center font-landing-display text-[clamp(5rem,25vw,23rem)] font-extrabold leading-[0.8] tracking-[-0.06em] text-claro-hondo [font-stretch:76%]"
        >
          tiendify
        </p>
      </div>
    </footer>
  );
}
