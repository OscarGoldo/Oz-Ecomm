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
import { supportContact } from "@/lib/support";

export const metadata: Metadata = {
  title: "Política de privacidad",
  description: "Cómo Tiendify trata tus datos personales.",
};

export default function PrivacidadPage() {
  const whatsapp = supportContact();

  return (
    <PageShell action={<BarLink href="/crear-tienda">Crear mi tienda</BarLink>}>
      <main className="mx-auto w-full max-w-3xl px-4 pb-20 pt-8 sm:px-6 sm:pt-12">
        <BackLink href="/">Volver al inicio</BackLink>
        <article className={legalArticle}>
          <div>
            <Eyebrow>Legal</Eyebrow>
            <h1 className={legalTitle}>
              Política de privacidad
            </h1>
            <p className={legalUpdated}>Última actualización: octubre 2026</p>
          </div>

          <section className="space-y-2">
            <h2 className={legalHeading}>
              1. Qué datos recopilamos
            </h2>
            <p>
              <strong>De los dueños de tiendas:</strong> nombre, correo,
              contraseña (protegida con cifrado), teléfono/WhatsApp y los datos de
              su tienda (productos, precios, métodos de pago que configuran).
            </p>
            <p>
              <strong>De los compradores:</strong> al hacer un pedido, la tienda
              recibe tu nombre, teléfono, correo (opcional), dirección de entrega
              y, si pagas con un método que lo requiere, el comprobante de pago que
              subas. Los compradores no necesitan crear cuenta.
            </p>
            <p>
              <strong>Compras sin terminar:</strong> si cargas tu nombre y
              teléfono en el checkout pero no completas la compra, guardamos esos
              datos junto con los productos que dejaste en el carrito, para que la
              tienda pueda escribirte y ayudarte a terminar el pedido. Si no
              quieres que te contacten, escríbele a la tienda o a{" "}
              <a
                href="mailto:ovalery1903@gmail.com"
                className={legalLink}
              >
                ovalery1903@gmail.com
              </a>{" "}
              y lo eliminamos.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className={legalHeading}>
              2. Para qué los usamos
            </h2>
            <p>
              Para que las tiendas funcionen: procesar y entregar pedidos,
              contactarte sobre tu compra, calcular totales y mostrar tu pedido.
              La tienda también puede escribirte si dejaste una compra a medias.
              No vendemos tus datos a terceros ni los usamos para publicidad.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className={legalHeading}>
              3. Con quién se comparten
            </h2>
            <p>
              Los datos del pedido se comparten con la tienda a la que le
              compraste (es quien procesa tu entrega). Usamos proveedores de
              infraestructura para operar la plataforma: Supabase (base de datos y
              archivos), Vercel (alojamiento), Resend (correos) y Stripe (pagos
              con tarjeta, sujeto a su propia política de privacidad).
            </p>
          </section>

          <section className="space-y-2">
            <h2 className={legalHeading}>4. Cookies</h2>
            <p>
              Usamos cookies estrictamente funcionales: mantener tu carrito de
              compras y tu sesión si administras una tienda. No usamos cookies de
              publicidad ni de seguimiento de terceros.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className={legalHeading}>
              5. Seguridad y retención
            </h2>
            <p>
              Los datos se guardan en servidores con acceso restringido y las
              tiendas solo pueden ver la información de sus propios clientes y
              pedidos. Los comprobantes de pago se almacenan en un espacio privado
              accesible solo por la tienda correspondiente. Conservamos los datos
              mientras la tienda esté activa o mientras sean necesarios para el
              historial de pedidos.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className={legalHeading}>
              6. Tus derechos
            </h2>
            <p>
              Puedes pedir la corrección o eliminación de tus datos escribiendo
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
              . Si eres comprador, también puedes contactar directamente a la
              tienda donde compraste.
            </p>
          </section>

          <p className={legalFooter}>
            Ver también nuestros{" "}
            <Link href="/terminos" className={legalLink}>
              Términos y condiciones
            </Link>
            .
          </p>
        </article>
      </main>
    </PageShell>
  );
}
