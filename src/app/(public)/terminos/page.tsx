import type { Metadata } from "next";
import Link from "next/link";

import { Eyebrow } from "@/components/landing/landing-ui";
import {
  BackLink,
  BarLink,
  PageShell,
  legalArticle,
  legalFooter,
  legalHeading,
  legalLink,
  legalTitle,
  legalUpdated,
} from "@/components/landing/page-shell";

export const metadata: Metadata = {
  title: "Términos y condiciones",
  description: "Términos y condiciones de uso de Tiendify.",
};

export default function TerminosPage() {
  return (
    <PageShell action={<BarLink href="/crear-tienda">Crear mi tienda</BarLink>}>
      <main className="mx-auto w-full max-w-3xl px-4 pb-20 pt-8 sm:px-6 sm:pt-12">
        <BackLink href="/">Volver al inicio</BackLink>
        <article className={legalArticle}>
          <div>
            <Eyebrow>Legal</Eyebrow>
            <h1 className={legalTitle}>
              Términos y condiciones
            </h1>
            <p className={legalUpdated}>Última actualización: julio 2026</p>
          </div>

          <section className="space-y-2">
            <h2 className={legalHeading}>1. Qué es Tiendify</h2>
            <p>
              Tiendify es una plataforma que permite a emprendedores y comercios
              («las tiendas») crear su tienda online, publicar productos y recibir
              pedidos de sus clientes. Tiendify actúa como intermediario tecnológico:
              provee la herramienta, pero <strong>no es el vendedor</strong> de los
              productos publicados.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className={legalHeading}>
              2. Responsabilidad de cada tienda
            </h2>
            <p>
              Cada tienda es responsable de los productos que publica, su calidad,
              precio, stock, la entrega de los pedidos y la atención a sus
              clientes. Las compras se realizan directamente entre el cliente y la
              tienda. Tiendify no garantiza ni responde por los productos, entregas o
              reembolsos de las tiendas.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className={legalHeading}>3. Cuentas</h2>
            <p>
              Para administrar una tienda necesitas una cuenta con correo y
              contraseña. Eres responsable de mantener tu contraseña segura y de
              toda la actividad realizada desde tu cuenta. Tiendify puede suspender
              cuentas o tiendas que publiquen contenido ilegal, fraudulento o que
              abusen de la plataforma.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className={legalHeading}>4. Pagos</h2>
            <p>
              Las tiendas pueden aceptar métodos de pago locales (Pago Móvil,
              Zelle, Binance, efectivo, transferencia) gestionados directamente por
              cada tienda, y pagos con tarjeta procesados por Stripe a través de
              la plataforma. Los pagos procesados por terceros están sujetos a los
              términos y comisiones de esos procesadores. Los montos en bolívares
              son referenciales y se calculan con la tasa configurada por cada
              tienda.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className={legalHeading}>
              5. Uso aceptable
            </h2>
            <p>
              No está permitido usar Tiendify para vender productos ilegales,
              falsificados o peligrosos; enviar spam; intentar vulnerar la
              seguridad de la plataforma; ni crear tiendas o pedidos falsos.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className={legalHeading}>
              6. Disponibilidad y cambios
            </h2>
            <p>
              Tiendify se ofrece «tal cual». Hacemos lo posible por mantener el
              servicio disponible y seguro, pero no garantizamos disponibilidad
              ininterrumpida. Podemos actualizar estas condiciones y las funciones
              de la plataforma; los cambios importantes se comunicarán en este
              sitio.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className={legalHeading}>7. Contacto</h2>
            <p>
              Para dudas sobre estos términos, escríbenos a{" "}
              <a
                href="mailto:ovalery1903@gmail.com"
                className={legalLink}
              >
                ovalery1903@gmail.com
              </a>
              .
            </p>
          </section>

          <p className={legalFooter}>
            Ver también nuestra{" "}
            <Link href="/privacidad" className={legalLink}>
              Política de privacidad
            </Link>
            .
          </p>
        </article>
      </main>
    </PageShell>
  );
}
