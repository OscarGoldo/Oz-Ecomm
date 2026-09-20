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

El checkout de Stripe es una **redirección**, no un botón embebido como PayPal.
Eso cambia el orden de las cosas:

1. El cliente elige "Tarjeta" y toca pagar → `createStripeCheckoutAction`.
2. El pedido se crea **antes** de irse, en `pending_payment`, con el stock ya
   reservado. El total lo calcula el servidor (`buildOrderDraft`), nunca el
   navegador.
3. El cliente paga en la página de Stripe y vuelve a `/{tienda}/pedido/{id}`.
4. El **webhook** (`checkout.session.completed`) compara el monto cobrado contra
   el total del pedido, lo pasa a `confirmed`, guarda comisión y neto, y recién
   ahí manda los avisos: email al dueño, WhatsApp y recibo al cliente.

Consecuencias buscadas de ese orden:

- Si el cliente abandona, el pedido queda en "esperando pago" y puede
  **reintentar** desde la página de su pedido. El comerciante ve que alguien
  intentó comprar.
- Si la sesión vence (24 h), el evento `checkout.session.expired` cancela el
  pedido y **devuelve el stock**. Sin eso, la última unidad de algo quedaría
  bloqueada un día por alguien que abrió Stripe y cerró la pestaña.
- El pedido nunca se confirma desde el navegador. Sin webhook verificado, el
  pedido se queda esperando: preferimos no confirmar a que alguien se regale uno
  con un POST.

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
