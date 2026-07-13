import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { TiendifyLogo } from "@/components/landing/tiendify-logo";

export const metadata: Metadata = {
  title: "Términos y condiciones",
  description: "Términos y condiciones de uso de Tiendify.",
};

export default function TerminosPage() {
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
            Términos y condiciones
          </h1>
          <p className="mt-1 text-xs">Última actualización: julio 2026</p>
        </div>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">1. Qué es Tiendify</h2>
          <p>
            Tiendify es una plataforma que permite a emprendedores y comercios
            («las tiendas») crear su tienda online, publicar productos y recibir
            pedidos de sus clientes. Tiendify actúa como intermediario tecnológico:
            provee la herramienta, pero <strong>no es el vendedor</strong> de los
            productos publicados.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">
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
          <h2 className="text-lg font-semibold text-foreground">3. Cuentas</h2>
          <p>
            Para administrar una tienda necesitas una cuenta con correo y
            contraseña. Eres responsable de mantener tu contraseña segura y de
            toda la actividad realizada desde tu cuenta. Tiendify puede suspender
            cuentas o tiendas que publiquen contenido ilegal, fraudulento o que
            abusen de la plataforma.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">4. Pagos</h2>
          <p>
            Las tiendas pueden aceptar métodos de pago locales (Pago Móvil,
            Zelle, Binance, efectivo, transferencia) gestionados directamente por
            cada tienda, y pagos online con PayPal o tarjeta procesados por
            PayPal. Los pagos procesados por terceros están sujetos a los
            términos y comisiones de esos procesadores. Los montos en bolívares
            son referenciales y se calculan con la tasa configurada por cada
            tienda.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">
            5. Uso aceptable
          </h2>
          <p>
            No está permitido usar Tiendify para vender productos ilegales,
            falsificados o peligrosos; enviar spam; intentar vulnerar la
            seguridad de la plataforma; ni crear tiendas o pedidos falsos.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">
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
          <h2 className="text-lg font-semibold text-foreground">7. Contacto</h2>
          <p>
            Para dudas sobre estos términos, escríbenos a{" "}
            <a
              href="mailto:ovalery1903@gmail.com"
              className="font-medium text-primary hover:underline"
            >
              ovalery1903@gmail.com
            </a>
            .
          </p>
        </section>

        <p className="border-t pt-4 text-xs">
          Ver también nuestra{" "}
          <Link href="/privacidad" className="font-medium text-primary hover:underline">
            Política de privacidad
          </Link>
          .
        </p>
      </article>
    </main>
  );
}
