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
import {
  DEFAULT_PRO_PRICE_USD,
  DEFAULT_PRO_PRICE_YEARLY_USD,
  FOUNDER_PRICES,
  GRACE_DAYS,
  TRIAL_DAYS,
} from "@/lib/plans";
import { supportContact } from "@/lib/support";

export const metadata: Metadata = {
  title: "Términos y condiciones",
  description: "Términos y condiciones de uso de Tiendify.",
};

export default function TerminosPage() {
  const whatsapp = supportContact();

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
            <p className={legalUpdated}>Última actualización: octubre 2026</p>
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
            <h2 className={legalHeading}>4. Pagos de los clientes</h2>
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

          {/* Lo que paga el comerciante y qué pasa si no paga. Las cifras salen
              de lib/plans, las mismas que usa el cobro: si cambian allá, este
              texto cambia solo. */}
          <section className="space-y-2">
            <h2 className={legalHeading}>5. El plan de Tiendify</h2>
            <p>
              <strong>Precio.</strong> Tiendify tiene un solo plan, Pro, que
              cuesta US${DEFAULT_PRO_PRICE_USD} al mes o US$
              {DEFAULT_PRO_PRICE_YEARLY_USD} al año. Se paga desde tu panel con
              tarjeta (procesada por Stripe), Pago Móvil o Binance. Por Pago
              Móvil pagas el equivalente en bolívares a la tasa del BCV del día.
            </p>
            <p>
              <strong>Prueba.</strong> Al crear tu tienda tienes {TRIAL_DAYS}{" "}
              días de Pro sin pagar, o un mes si usas un código promocional
              vigente. Para la prueba no te pedimos tarjeta.
            </p>
            <p>
              <strong>Renovación y cancelación.</strong> Con tarjeta, el plan se
              renueva solo al final de cada período y se cobra a la misma tarjeta
              hasta que canceles la renovación desde tu panel. Al cancelar sigues
              con Pro hasta el final del período que ya pagaste; el período en
              curso no se reembolsa. Con Pago Móvil o Binance el plan no se
              renueva solo: pagas cada período. Si te cobramos por error,
              escríbenos y lo corregimos.
            </p>
            <p>
              <strong>Vencimiento, gracia y pausa.</strong> Si el plan vence sin
              renovarse, tienes {GRACE_DAYS} días de gracia con todo funcionando
              y te avisamos por correo. Pasados esos días tu tienda queda en
              pausa: la vitrina deja de recibir pedidos y le muestra tu WhatsApp a
              quien entre. Tu panel, tus productos, tus clientes y los pedidos
              que ya tenías siguen disponibles, y la tienda vuelve a vender
              apenas renuevas.
            </p>
            <p>
              <strong>Tiendas fundadoras.</strong> Las tiendas creadas antes del
              20 de octubre de 2026 conservan sus condiciones: Pro a US$
              {FOUNDER_PRICES.monthly} al mes o US${FOUNDER_PRICES.yearly} al año,
              y si no pagan, el plan Gratis con sus límites. Un cambio del precio
              de lista no las afecta.
            </p>
            <p>
              <strong>Cambios de precio.</strong> Si cambiamos el precio de lista,
              lo avisaremos antes, y el nuevo precio rige desde tu siguiente
              período: no cambia lo que ya pagaste.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className={legalHeading}>
              6. Uso aceptable
            </h2>
            <p>
              No está permitido usar Tiendify para vender productos ilegales,
              falsificados o peligrosos; enviar spam; intentar vulnerar la
              seguridad de la plataforma; ni crear tiendas o pedidos falsos.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className={legalHeading}>
              7. Disponibilidad y cambios
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
            <h2 className={legalHeading}>8. Contacto</h2>
            <p>
              Para dudas sobre estos términos o sobre tu plan, escríbenos
              {whatsapp && (
                <>
                  {" "}
                  por WhatsApp al{" "}
                  <a
                    href={whatsapp.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={legalLink}
                  >
                    {whatsapp.label}
                  </a>{" "}
                  o
                </>
              )}{" "}
              a{" "}
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
