# Crédito en Tiendify

Tiendify quiere financiar con capital de un socio inversionista. Hoy no se
presta nada: lo que existe es el **puntaje interno** en `/super/credito`, que
mide la reputación de cada tienda para el día que estemos listos.

Reglas de la casa:

- **Es interno.** Solo lo ven los socios. Ninguna tienda ve su puntaje.
- **El comerciante decide.** Nada se le ofrece sin que lo pida y acepte los
  términos.
- **Las tiendas de prueba no cuentan.** Quedan fuera Alfa Electronic, Retro
  Mania, Ozzie Steaks, Abigaile, Ovejita y Mr. Cleaner
  (`CREDIT_EXCLUDED_SLUGS` en `src/lib/credit-score.ts`).

## Los dos productos

### Cuotas para los compradores de la tienda

Inspirado en Cashea y Afterpay: la tienda vende en cuotas y el fondo le
adelanta lo que el comprador todavía no pagó.

1. El comprador paga una **inicial del 50 %** y se lleva el producto.
2. El fondo le paga a la tienda el resto, menos una comisión.
3. El comprador paga lo que falta en cuotas quincenales al fondo.

Ejemplo con una venta de $100: la tienda cobra $50 de inicial; el fondo le paga
$44 (los $50 menos una comisión del 6 % sobre la venta), y recupera $50 en tres
cuotas en unas 6 semanas.

El comprador **no paga intereses**: la comisión la paga la tienda, que vende
más. Así trabajan Cashea y Afterpay, y así se evita cobrarle intereses a una
persona (ver "Antes de prestar").

En este producto la reputación de la tienda importa por **fraude**: una tienda
podría inventar compradores que pagan la inicial y desaparecen, y quedarse con
lo que pone el fondo. Por eso pide muchos compradores distintos y castiga que un
solo comprador concentre las ventas.

### Adelanto de ventas para la tienda

Inspirado en Shopify Capital: el fondo le adelanta plata a la tienda y la
recupera con un porcentaje de cada venta.

- Monto: hasta **un mes de ventas promedio** (tope inicial $2.000).
- Costo: un **cargo fijo del 12 %**, no un interés: si presta $500, devuelve $560.
- Cobro: el **15 % de cada venta** hasta completar.

Más adelante conviene ofrecerlo como **financiamiento de inventario**: el fondo
le paga al proveedor en vez de darle efectivo al comerciante. Tiendify ya sabe
el costo, el stock y la rotación de cada producto.

El límite real es cómo se cobra. Shopify descuenta de lo que le liquida al
comerciante. Tiendify solo puede hacer eso con las ventas **con tarjeta**, que
entran a nuestra cuenta y se liquidan desde `/super/pagos`; el resto (Pago
Móvil, efectivo, Zelle, Binance) va directo al comerciante.

### Qué tomar de cada referencia

| Referencia | Modelo | Qué nos sirve |
| --- | --- | --- |
| Cashea | Inicial + cuotas quincenales, 0 % al comprador, comisión a la tienda; niveles que suben con buen pago | El modelo base de cuotas para Venezuela |
| Afterpay / Klarna "Pay in 4" | 4 pagos cada 2 semanas, sin interés, la tienda paga la comisión | Plazos cortos y simples; el riesgo dura semanas |
| Affirm | Préstamos con interés al comprador, plazos largos | No por ahora: cobrarle intereses a personas es lo más delicado legalmente |
| Shopify Capital | Adelanto con cargo fijo, cobrado con un % de las ventas | El modelo de adelanto, una vez que las ventas pasen por Tiendify |

Cashea cobra a los comercios afiliación, 6 % en ventas online y un cargo
mínimo mensual. Una tienda chica de Tiendify no llega a pagarlo: ahí está
nuestro espacio.

## El puntaje

Suma 100 puntos con lo que ya guarda Tiendify. Casi todas las ventas las
confirma el propio comerciante, así que pesa más lo difícil de inventar.

| Parte | Máx. | Qué mide |
| --- | --- | --- |
| Antigüedad vendiendo | 15 | Días desde la primera venta; completo al año |
| Constancia | 20 | En cuántos de los últimos 6 meses vendió |
| Volumen | 20 | Promedio mensual: $100, $300, $1.000, $3.000 |
| Tendencia | 10 | Últimos 3 meses contra los 3 anteriores |
| Cumplimiento | 10 | Pedidos cobrados y después cancelados; pesa completo desde 10 pedidos |
| Clientes | 15 | Compradores distintos en el año y cuántos volvieron |
| Ventas verificadas | 5 | Qué parte se cobró con tarjeta por Tiendify |
| Le paga a Tiendify | 5 | Si alguna vez pagó un plan |

- Un "mes" son 30 días hacia atrás, no un mes de calendario.
- Las compras con el teléfono o el correo de la tienda no cuentan.
- Bloquean cualquiera de los dos productos: tienda pausada, 45 días sin vender,
  o un solo comprador con más del 50 % de lo vendido en 6 meses.
- Niveles: En observación (0–39), En construcción (40–54), Confiable (55–69),
  Sólida (70+).

| | Cuotas | Adelanto |
| --- | --- | --- |
| Puntaje mínimo | 55 | 70 |
| Días vendiendo | 90 | 180 |
| Meses con ventas (de 6) | 3 | 5 |
| Otros | 10 compradores distintos | $300 al mes; ventas que no caigan más de 40 % |
| Cuánto | 30 % de lo que vende al mes (tope $1.500) | Un mes de ventas (tope $2.000) |

Todas las cifras están en `CREDIT_RULES` y la pantalla las lee de ahí. Son un
punto de partida: se ajustan cuando haya historial de pagos real.

El cálculo es una función pura de los pedidos y una fecha (`scoreStore`), así
que el puntaje "de hace 30 días" se recalcula sin guardar historia aparte.

## Antes de prestar

- **Abogado venezolano.** Si prestar capital propio necesita autorización de
  SUDEBAN (la figura de ITFB, Resolución 001-21), qué límites de interés están
  vigentes, y desde qué empresa y país se presta.
- **Stripe.** La cuenta no es Connect, y Stripe restringe los pagos de
  préstamos con tarjeta. Las cuotas y los pagos de adelantos van por Pago
  Móvil, Zelle o Binance, nunca por Stripe.
- **Contrato con el inversionista.** Plata en una cuenta separada, tope del
  piloto, reparto (cuánto él, cuánto Tiendify por operar) y quién absorbe las
  pérdidas.
- **Términos y privacidad.** Hoy dicen que los datos se usan "para que las
  tiendas funcionen". Antes de ofrecer crédito tienen que decir que los datos
  de ventas sirven para evaluar productos financieros, y la oferta tiene que
  pedir el consentimiento del comerciante.

## Lo que viene

1. **Ahora:** el puntaje en `/super/credito`. Empujar las ventas con tarjeta,
   que son las únicas verificadas y las únicas que se pueden retener para
   cobrar.
2. **Cuando 2 o 3 tiendas califiquen para cuotas:** el comerciante pide
   activarlas desde su panel y acepta los términos; plan de cuotas por pedido
   (cédula y teléfono del comprador, recordatorios por WhatsApp, comprobante de
   cada cuota con el flujo de hoy); libro de crédito con desembolsos, pagos y
   saldos, que sirve de reporte para el inversionista.
3. **Con historial de pagos del piloto:** adelantos o inventario para las
   tiendas sólidas, con la retención automática en `/super/pagos`.
4. **Cuando pese el volumen:** el cálculo pasa a Postgres, como
   `super_store_stats()` en `0030_super_admin_stats.sql`. Hoy los pedidos se
   leen todos y se puntúan en Node (`src/lib/credit-server.ts`).
