# Stripe en Tiendify

Cobro con tarjeta para las dos cosas que se cobran online: el **checkout de las
tiendas** y el **plan Pro** de los comerciantes.

## Modelo

Una sola cuenta de Stripe (la de la plataforma, en Canadá) para todas las
tiendas — igual que PayPal. **No es Stripe Connect**: no hay cuentas conectadas
ni KYC por tienda. La plata de los pedidos cae en la cuenta de la plataforma y
lo que se le debe a cada comerciante se liquida en `/super/pagos`, sumado con lo
de PayPal.

El comerciante recibe el **neto** (total − comisión de Stripe). Sin comisión de
plataforma, igual que se decidió para PayPal.

Todo se cobra en **USD**. La cuenta es canadiense: si Stripe liquida en CAD, la
comisión y el neto se convierten de vuelta a USD con el `exchange_rate` del
balance transaction (ver `chargeBreakdown` en `src/lib/stripe.ts`), para no
mezclar monedas en la misma columna.

## Puesta en marcha

1. **Claves.** Dashboard → Developers → API keys. Poner `STRIPE_SECRET_KEY` en
   `.env.local` y en Vercel. Empezar con `sk_test_…`.
2. **Precios del plan y webhook.** Con la clave ya puesta:

   ```bash
   npx tsx --env-file=.env.local scripts/stripe-setup.ts
   ```

   Crea el producto "Tiendify Pro", los precios mensual y anual, y el endpoint
   del webhook. Imprime `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY` y
   `STRIPE_WEBHOOK_SECRET` listos para pegar. Es idempotente y hay que correrlo
   **una vez por entorno** (test y live usan ids distintos).
3. **Migración.** Aplicar `supabase/migrations/0026_stripe.sql`.
4. **Redeploy** en Vercel para que tome las variables.
5. En cada tienda que lo vaya a usar: Panel → Configuración → Pagos → agregar el
   método **"Tarjeta de crédito o débito"** y completar cómo quiere que le
   paguemos (Zelle / Pago Móvil / Binance).

Para probar en local, el webhook no llega solo:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Tarjeta de prueba: `4242 4242 4242 4242`, cualquier fecha futura y CVC.

## Cómo funciona el checkout de una tienda

Los campos de la tarjeta (con Apple Pay y Google Pay) se ven **dentro** del
checkout, apenas el cliente elige el método — Payment Element, no una página de
Stripe. Eso obliga a invertir el orden de siempre: **primero se cobra, después
nace el pedido**. Si el pedido se creara al mostrar el formulario, el panel del
comerciante se llenaría de pedidos de gente que solo está mirando cómo se paga.

1. El cliente elige "Tarjeta" → `syncCardPayment` calcula el total del carrito
   y abre un PaymentIntent. **No se crea ningún pedido.** El monto sale del
   servidor, nunca del navegador, y se reajusta si el total cambia (un cupón).
2. Al tocar Pagar, `syncCardPayment` corre otra vez con el formulario completo
   y **congela el pedido entero** —productos, totales, datos del cliente— en
   `checkout_intents`. Esto es lo que hace que el cobro no pueda quedar huérfano.
3. Stripe cobra. Si el banco pide verificación, el cliente sale y vuelve a
   `/{tienda}/checkout/procesando`.
4. `finalizeCardOrder` le pregunta a Stripe si el cobro está hecho, compara el
   monto contra el borrador congelado y **ahí sí crea el pedido**, ya
   confirmado, con su comisión y su neto. Salen los avisos: email al dueño,
   WhatsApp y recibo al cliente.

Lo llaman los dos caminos —el navegador y el webhook
(`payment_intent.succeeded`)— y es idempotente por el UNIQUE sobre
`orders.stripe_payment_intent`. Esa duplicación es deliberada: si el cliente
cierra la pestaña justo después de pagar, el webhook crea el pedido igual.

Consecuencias de este orden, todas asumidas:

- **El stock no se reserva** mientras el cliente escribe la tarjeta. Dos
  personas pueden comprar la última unidad a la vez y las dos pagan. Cuando
  pasa, el pedido se crea igual (la plata ya entró) y el faltante se concilia a
  mano — mismo criterio que PayPal.
- Un cupón que se agota entre que se aplica y que se paga tampoco tumba el
  pedido, por lo mismo.
- El pedido nunca se crea sin un cobro verificado contra Stripe.

## Cómo funciona el plan Pro

- Si el período tiene precio recurrente (`STRIPE_PRICE_MONTHLY` / `_YEARLY`), se
  contrata una **suscripción** que se renueva sola.
- El trimestre no tiene precio recurrente, así que se cobra **una sola vez**. La
  UI lo dice explícito: la diferencia entre "se renueva solo" y "se vence" es la
  que le hace perder el Pro sin darse cuenta.
- Los meses los suma **solo `invoice.paid`**. `checkout.session.completed` en
  modo suscripción únicamente registra el id — sumar en los dos daría el doble
  de meses en el primer cobro (misma regla que el webhook de PayPal).
- Cancelar corta la renovación pero **no** el plan: lo pagado corre hasta su
  vencimiento.

## Eventos del webhook

| Evento | Qué hace |
| --- | --- |
| `checkout.session.completed` | Confirma el pedido, o registra la suscripción / cobra el plan de una vez |
| `checkout.session.expired` | Cancela el pedido sin pagar y devuelve el stock |
| `invoice.paid` | Extiende el plan Pro (primer cobro y renovaciones) |
| `customer.subscription.updated` / `.deleted` | Actualiza el estado de la suscripción |

Todos se deduplican por id en `stripe_webhook_events`: Stripe reintenta hasta
recibir un 200.

## La URL del webhook no puede redirigir

**Stripe no sigue redirecciones en las entregas del webhook.** Si el endpoint
apunta a `https://www.tiendifyapp.com/...` y Vercel redirige `www` al dominio
sin www con un 308, cada entrega queda como fallida y no se reintenta a la URL
nueva: el cliente paga y su pedido se queda en "esperando pago" sin una sola
pista en la app.

Pasó en el primer cobro real. `scripts/stripe-setup.ts` ahora sigue la
redirección solo y registra la URL final, pero si creas el endpoint a mano en
el dashboard, verifica que responda directo:

```bash
curl -i -X POST https://tiendifyapp.com/api/stripe/webhook -d '{}'
```

Tiene que dar **400** ("falta la firma"), que significa que la ruta está viva y
con sus variables. Un **503** es que faltan `STRIPE_SECRET_KEY` o
`STRIPE_WEBHOOK_SECRET` en Vercel (o que falta el redeploy). Un **3xx** es esta
misma trampa otra vez.

## Apple Pay y Google Pay

Aparecen solos arriba del formulario embebido cuando el dispositivo los tiene.
Apple Pay necesita **una vez** que el dominio esté registrado: Stripe →
Settings → Payment methods → Apple Pay → **Add domain** → `tiendifyapp.com`.
Con el checkout alojado esto era automático; dentro de nuestro sitio, no.

Google Pay no necesita registro.
