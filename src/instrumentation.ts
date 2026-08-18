/**
 * Arranque del monitoreo de errores del SERVIDOR.
 *
 * Decisión deliberada: Tiendify NO carga el SDK de Sentry en el navegador. El
 * cliente de Sentry pesa ~35 kB comprimidos y acá el visitante típico compra
 * desde un Android de gama baja con datos móviles caros — pagarle eso a cada
 * comprador para saber de errores de JS no vale la pena todavía. Lo que sí se
 * necesita es enterarse cuando una tienda revienta del lado del servidor a las
 * 3 AM, y eso es exactamente lo que cubre este archivo.
 *
 * Sin `SENTRY_DSN` en el entorno no se inicializa nada: el proyecto sigue
 * funcionando igual y los errores quedan en los logs de Vercel vía
 * `lib/report-error.ts`. Para activarlo, crear el proyecto en Sentry y poner
 * SENTRY_DSN en las variables de entorno de Vercel. No hace falta redeploy de
 * código.
 */
export async function register() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  if (process.env.NEXT_RUNTIME === "nodejs") {
    const Sentry = await import("@sentry/nextjs");
    Sentry.init({
      dsn,
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
      // Muestreo de trazas apagado: acá interesan los errores, no el APM, y
      // las trazas se cobran aparte.
      tracesSampleRate: 0,
      // Los pedidos llevan nombre, teléfono y dirección de compradores reales.
      // Que Sentry no los recolecte solo.
      sendDefaultPii: false,
    });
  }
}
