import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { TiendifyLogo } from "@/components/landing/tiendify-logo";

export const metadata: Metadata = {
  title: "Política de privacidad",
  description: "Cómo Tiendify trata tus datos personales.",
};

export default function PrivacidadPage() {
  return (
    <main className="min-h-dvh bg-background">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center">
          <TiendifyLogo className="h-7 w-auto" />
        </Link>
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Volver
        </Link>
      </div>

      <article className="container max-w-3xl space-y-6 pb-16 pt-6 text-sm leading-relaxed text-muted-foreground">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Política de privacidad
          </h1>
          <p className="mt-1 text-xs">Última actualización: julio 2026</p>
        </div>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">
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
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">
            2. Para qué los usamos
          </h2>
          <p>
            Para que las tiendas funcionen: procesar y entregar pedidos,
            contactarte sobre tu compra, calcular totales y mostrar tu pedido.
            No vendemos tus datos a terceros ni los usamos para publicidad.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">
            3. Con quién se comparten
          </h2>
          <p>
            Los datos del pedido se comparten con la tienda a la que le
            compraste (es quien procesa tu entrega). Usamos proveedores de
            infraestructura para operar la plataforma: Supabase (base de datos y
            archivos), Vercel (alojamiento), Resend (correos) y PayPal (pagos
            online, sujeto a su propia política de privacidad).
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">4. Cookies</h2>
          <p>
            Usamos cookies estrictamente funcionales: mantener tu carrito de
            compras y tu sesión si administras una tienda. No usamos cookies de
            publicidad ni de seguimiento de terceros.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">
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
          <h2 className="text-lg font-semibold text-foreground">
            6. Tus derechos
          </h2>
          <p>
            Puedes pedir la corrección o eliminación de tus datos escribiendo a{" "}
            <a
              href="mailto:ovalery1903@gmail.com"
              className="font-medium text-primary hover:underline"
            >
              ovalery1903@gmail.com
            </a>
            . Si eres comprador, también puedes contactar directamente a la
            tienda donde compraste.
          </p>
        </section>

        <p className="border-t pt-4 text-xs">
          Ver también nuestros{" "}
          <Link href="/terminos" className="font-medium text-primary hover:underline">
            Términos y condiciones
          </Link>
          .
        </p>
      </article>
    </main>
  );
}
