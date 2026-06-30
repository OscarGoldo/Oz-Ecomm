"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import {
  ArrowLeft,
  Bike,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  CreditCard,
  Loader2,
  Lock,
  ShoppingBag,
  Store as StoreIcon,
  Ticket,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PaymentProofUpload } from "@/components/storefront/payment-proof-upload";
import { PaypalButtons } from "@/components/storefront/paypal-buttons";
import {
  createOrder,
  previewCoupon,
  type CheckoutInput,
} from "@/app/(public)/[store_slug]/checkout/actions";
import { formatBs, formatUSD, usdToBs } from "@/lib/format";
import { getImageUrl } from "@/lib/storage";
import { cn } from "@/lib/utils";
import type { EnrichedCart } from "@/lib/cart";
import type { PaymentMethod, Store } from "@/types/database";

const DETAIL_LABELS: Record<string, string> = {
  banco: "Banco",
  telefono: "Teléfono",
  cedula: "Cédula / RIF",
  titular: "Titular",
  email: "Email",
  email_o_id: "Email o ID",
  usuario: "Usuario",
};

type StoreInfo = Pick<
  Store,
  | "id"
  | "slug"
  | "offers_delivery"
  | "offers_pickup"
  | "pickup_address"
  | "delivery_note"
  | "delivery_fee"
  | "free_delivery_min"
>;

interface FormValues {
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  fulfillment_type: "delivery" | "pickup";
  delivery_address: string;
  delivery_notes: string;
  payment_method_id: string;
  payment_reference: string;
  notes: string;
}

export function CheckoutForm({
  store,
  paymentMethods,
  cart,
}: {
  store: StoreInfo;
  paymentMethods: PaymentMethod[];
  cart: EnrichedCart;
}) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [submitting, setSubmitting] = useState(false);
  const [proofPath, setProofPath] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [checkingCoupon, setCheckingCoupon] = useState(false);
  const [coupon, setCoupon] = useState<{
    code: string;
    discount: number;
    freeShipping: boolean;
  } | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      customer_name: "",
      customer_phone: "",
      customer_email: "",
      fulfillment_type: store.offers_delivery ? "delivery" : "pickup",
      delivery_address: "",
      delivery_notes: "",
      payment_method_id: paymentMethods[0]?.id ?? "",
      payment_reference: "",
      notes: "",
    },
  });

  const fulfillment = watch("fulfillment_type");
  const methodId = watch("payment_method_id");
  const selectedMethod = paymentMethods.find((m) => m.id === methodId);

  const subtotal = cart.subtotalUsd;
  const deliveryFee = Number(store.delivery_fee ?? 0);
  const freeMin = store.free_delivery_min;
  const baseShipping =
    fulfillment === "delivery" &&
    deliveryFee > 0 &&
    !(freeMin != null && subtotal >= Number(freeMin))
      ? deliveryFee
      : 0;
  const discount = coupon ? coupon.discount : 0;
  const shipping = coupon?.freeShipping ? 0 : baseShipping;
  const total = Math.max(0, subtotal + shipping - discount);
  const totalBs = cart.showBs ? usdToBs(total, cart.exchangeRate) : null;
  const showShippingRow = fulfillment === "delivery" && deliveryFee > 0;

  async function applyCoupon() {
    if (!couponCode.trim()) return;
    setCheckingCoupon(true);
    const res = await previewCoupon(store.id, couponCode, subtotal);
    setCheckingCoupon(false);
    if (!res.ok) {
      setCoupon(null);
      toast.error(res.error ?? "Cupón no válido");
      return;
    }
    setCoupon({
      code: res.code ?? couponCode.toUpperCase(),
      discount: res.discount ?? 0,
      freeShipping: Boolean(res.freeShipping),
    });
    toast.success("Cupón aplicado");
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copiado");
    } catch {
      /* clipboard unavailable */
    }
  }

  /** Validate step 1 (data + delivery) before moving to payment. */
  function goToPayment() {
    const v = getValues();
    if (v.customer_name.trim().length < 2) {
      toast.error("Ingresá tu nombre");
      return;
    }
    if (v.customer_phone.trim().length < 6) {
      toast.error("Ingresá tu teléfono");
      return;
    }
    if (
      v.fulfillment_type === "delivery" &&
      v.delivery_address.trim().length < 5
    ) {
      toast.error("Ingresá la dirección de entrega");
      return;
    }
    setStep(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function backToDelivery() {
    setStep(1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /** Build + validate the checkout payload (shared by manual submit + PayPal). */
  function buildInput(): CheckoutInput | null {
    const values = getValues();
    if (values.customer_name.trim().length < 2) {
      setStep(1);
      toast.error("Ingresá tu nombre");
      return null;
    }
    if (values.customer_phone.trim().length < 6) {
      setStep(1);
      toast.error("Ingresá tu teléfono");
      return null;
    }
    if (
      values.fulfillment_type === "delivery" &&
      values.delivery_address.trim().length < 5
    ) {
      setStep(1);
      toast.error("Ingresá la dirección de entrega");
      return null;
    }
    if (!selectedMethod) {
      toast.error("Elegí un método de pago");
      return null;
    }
    return {
      store_id: store.id,
      customer_name: values.customer_name,
      customer_phone: values.customer_phone,
      customer_email: values.customer_email || undefined,
      fulfillment_type: values.fulfillment_type,
      delivery_address: values.delivery_address || undefined,
      delivery_notes: values.delivery_notes || undefined,
      payment_method_id: values.payment_method_id,
      payment_reference: values.payment_reference || undefined,
      payment_proof_path: proofPath || undefined,
      coupon_code: coupon?.code || undefined,
      notes: values.notes || undefined,
    };
  }

  async function onSubmit() {
    if (!selectedMethod) {
      toast.error("Elegí un método de pago");
      return;
    }
    if (selectedMethod.requires_proof && !proofPath) {
      toast.error("Subí el comprobante de pago");
      return;
    }
    const input = buildInput();
    if (!input) return;

    setSubmitting(true);
    const res = await createOrder(input);
    setSubmitting(false);

    if (!res.ok || !res.orderId) {
      toast.error(res.error ?? "No se pudo crear el pedido");
      return;
    }
    router.push(`/${store.slug}/pedido/${res.orderId}`);
  }

  const details =
    selectedMethod && typeof selectedMethod.details === "object" && selectedMethod.details
      ? (selectedMethod.details as Record<string, unknown>)
      : {};
  const isPaypal = selectedMethod?.type === "paypal";
  const paypalClientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
  const detailEntries = Object.entries(details).filter(
    ([, v]) => typeof v === "string" && v.length > 0,
  ) as [string, string][];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px] lg:items-start">
      {/* Order summary — top on mobile (collapsible), right on desktop (sticky) */}
      <aside className="lg:order-2 lg:sticky lg:top-4">
        <OrderSummary
          cart={cart}
          subtotal={subtotal}
          discount={discount}
          shipping={shipping}
          total={total}
          totalBs={totalBs}
          showShippingRow={showShippingRow}
          couponCode={coupon?.code}
        />
      </aside>

      {/* Steps + form */}
      <form onSubmit={handleSubmit(onSubmit)} className="lg:order-1">
        <Stepper step={step} />

        {/* ── Step 1: Entrega ─────────────────────────────────────────────── */}
        <div className={cn("space-y-5", step === 1 ? "block" : "hidden")}>
          {/* Customer */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tus datos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="customer_name">Nombre y apellido *</Label>
                <Input
                  id="customer_name"
                  {...register("customer_name", { required: "Ingresá tu nombre" })}
                  placeholder="Ej. María Pérez"
                />
                {errors.customer_name && (
                  <p className="text-xs text-destructive">{errors.customer_name.message}</p>
                )}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Teléfono / WhatsApp *</Label>
                  <PhoneInput
                    onChange={(v) => setValue("customer_phone", v)}
                    placeholder="424 1234567"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customer_email">Email (opcional)</Label>
                  <Input
                    id="customer_email"
                    type="email"
                    inputMode="email"
                    {...register("customer_email")}
                    placeholder="tu@correo.com"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Fulfillment */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Entrega</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {store.offers_delivery && (
                  <OptionCard
                    active={fulfillment === "delivery"}
                    onClick={() => setValue("fulfillment_type", "delivery")}
                    icon={<Bike className="size-5" />}
                    title="Delivery"
                    subtitle={store.delivery_note || "A tu dirección"}
                  />
                )}
                {store.offers_pickup && (
                  <OptionCard
                    active={fulfillment === "pickup"}
                    onClick={() => setValue("fulfillment_type", "pickup")}
                    icon={<StoreIcon className="size-5" />}
                    title="Retiro"
                    subtitle="En la tienda"
                  />
                )}
              </div>

              {fulfillment === "delivery" ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="delivery_address">Dirección de entrega *</Label>
                    <Textarea
                      id="delivery_address"
                      {...register("delivery_address")}
                      placeholder="Calle, casa/edificio, punto de referencia, zona…"
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="delivery_notes">Indicaciones (opcional)</Label>
                    <Input
                      id="delivery_notes"
                      {...register("delivery_notes")}
                      placeholder="Ej. tocar el timbre, horario, etc."
                    />
                  </div>
                </div>
              ) : (
                store.pickup_address && (
                  <p className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
                    Retirás en:{" "}
                    <span className="font-medium text-foreground">{store.pickup_address}</span>
                  </p>
                )
              )}
            </CardContent>
          </Card>

          <Button type="button" size="lg" className="w-full" onClick={goToPayment}>
            Continuar con el pago
          </Button>
        </div>

        {/* ── Step 2: Pago ────────────────────────────────────────────────── */}
        <div className={cn("space-y-5", step === 2 ? "block" : "hidden")}>
          <button
            type="button"
            onClick={backToDelivery}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> Volver a entrega
          </button>

          {/* Payment */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pago</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {paymentMethods.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  La tienda todavía no configuró métodos de pago.
                </p>
              ) : (
                <div className="space-y-2">
                  {paymentMethods.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setValue("payment_method_id", m.id)}
                      className={cn(
                        "flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors",
                        methodId === m.id
                          ? "border-primary bg-primary/5"
                          : "hover:border-primary/40",
                      )}
                    >
                      <span className="text-sm font-medium">{m.label}</span>
                      {methodId === m.id && <Check className="size-4 text-primary" />}
                    </button>
                  ))}
                </div>
              )}

              {isPaypal && selectedMethod ? (
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">
                    Pagás con PayPal, tarjeta de crédito o débito. Confirmás el
                    pago más abajo. Tu pedido se confirma al instante.
                  </p>
                </div>
              ) : selectedMethod ? (
                <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
                  {detailEntries.length > 0 && (
                    <ul className="space-y-1.5">
                      {detailEntries.map(([key, val]) => (
                        <li
                          key={key}
                          className="flex items-center justify-between gap-2 text-sm"
                        >
                          <span className="text-muted-foreground">
                            {DETAIL_LABELS[key] ?? key}
                          </span>
                          <span className="flex items-center gap-1.5 font-medium">
                            {val}
                            <button
                              type="button"
                              onClick={() => copy(val)}
                              className="text-muted-foreground hover:text-foreground"
                              aria-label="Copiar"
                            >
                              <Copy className="size-3.5" />
                            </button>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {selectedMethod.instructions && (
                    <p className="text-xs text-muted-foreground">
                      {selectedMethod.instructions}
                    </p>
                  )}

                  {selectedMethod.requires_proof ? (
                    <div className="space-y-3 border-t pt-3">
                      <PaymentProofUpload
                        storeId={store.id}
                        value={proofPath}
                        onChange={setProofPath}
                      />
                      <div className="space-y-2">
                        <Label htmlFor="payment_reference">Referencia (opcional)</Label>
                        <Input
                          id="payment_reference"
                          {...register("payment_reference")}
                          placeholder="N° de referencia / confirmación"
                        />
                      </div>
                    </div>
                  ) : (
                    <p className="border-t pt-3 text-xs text-muted-foreground">
                      Pagás al recibir o retirar el pedido. No necesitás comprobante.
                    </p>
                  )}
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* Coupon */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cupón de descuento</CardTitle>
            </CardHeader>
            <CardContent>
              {coupon ? (
                <div className="flex items-center justify-between rounded-lg border border-success/40 bg-success/5 p-3">
                  <span className="inline-flex items-center gap-2 text-sm font-medium">
                    <Ticket className="size-4 text-success" />
                    <span className="font-mono">{coupon.code}</span>
                    <span className="text-success">
                      {coupon.freeShipping
                        ? "envío gratis"
                        : `−${formatUSD(coupon.discount)}`}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setCoupon(null);
                      setCouponCode("");
                    }}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="Quitar cupón"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        applyCoupon();
                      }
                    }}
                    placeholder="Código"
                    className="font-mono"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={applyCoupon}
                    disabled={checkingCoupon || !couponCode.trim()}
                  >
                    {checkingCoupon ? <Loader2 className="animate-spin" /> : "Aplicar"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Nota para la tienda (opcional)</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                {...register("notes")}
                placeholder="Algo que la tienda deba saber sobre tu pedido…"
                rows={2}
              />
            </CardContent>
          </Card>

          {isPaypal ? (
            paypalClientId ? (
              <div className="rounded-xl border bg-card p-4">
                <PaypalButtons
                  clientId={paypalClientId}
                  getInput={buildInput}
                  onSuccess={(id) => router.push(`/${store.slug}/pedido/${id}`)}
                />
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  Pago seguro procesado por PayPal · {formatUSD(total)}
                </p>
              </div>
            ) : (
              <p className="text-sm text-destructive">
                PayPal no está configurado correctamente.
              </p>
            )
          ) : (
            <>
              <Button type="submit" size="lg" className="w-full" disabled={submitting}>
                {submitting ? <Loader2 className="animate-spin" /> : <Lock />}
                Confirmar pedido · {formatUSD(total)}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Al confirmar, la tienda recibe tu pedido para procesarlo.
              </p>
            </>
          )}
        </div>
      </form>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */

function Stepper({ step }: { step: 1 | 2 }) {
  return (
    <div className="mb-6 flex items-start">
      <StepNode label="Entrega" icon={<Bike className="size-4" />} active={step === 1} done={step > 1} />
      <div
        className={cn(
          "mx-3 mt-[17px] h-0.5 flex-1 rounded",
          step > 1 ? "bg-primary" : "bg-border",
        )}
      />
      <StepNode label="Pago" icon={<CreditCard className="size-4" />} active={step === 2} done={false} />
    </div>
  );
}

function StepNode({
  label,
  icon,
  active,
  done,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  done: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span
        className={cn(
          "grid size-9 place-items-center rounded-full border-2 transition-colors",
          done
            ? "border-primary bg-primary text-primary-foreground"
            : active
              ? "border-primary text-primary"
              : "border-border text-muted-foreground",
        )}
      >
        {done ? <Check className="size-4" /> : icon}
      </span>
      <span
        className={cn(
          "text-xs font-medium",
          active || done ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
      </span>
    </div>
  );
}

function OrderSummary({
  cart,
  subtotal,
  discount,
  shipping,
  total,
  totalBs,
  showShippingRow,
  couponCode,
}: {
  cart: EnrichedCart;
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  totalBs: number | null;
  showShippingRow: boolean;
  couponCode?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      {/* Mobile collapsible header */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 p-4 lg:hidden"
        aria-expanded={open}
      >
        <span className="inline-flex items-center gap-1.5 text-sm font-medium">
          {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          {open ? "Ocultar detalles" : "Ver detalles de la compra"}
        </span>
        <span className="text-base font-bold">{formatUSD(total)}</span>
      </button>

      {/* Desktop header */}
      <div className="hidden items-center gap-2 border-b p-4 lg:flex">
        <ShoppingBag className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Resumen de tu pedido</h2>
      </div>

      {/* Body: follows `open` on mobile, always visible on desktop */}
      <div className={cn(open ? "block" : "hidden", "lg:block")}>
        <ul className="divide-y border-t lg:border-t-0">
          {cart.lines.map((line) => {
            const img = getImageUrl(line.product.images[0]);
            return (
              <li
                key={`${line.product.id}:${line.variantId ?? ""}`}
                className="flex items-center gap-3 p-3"
              >
                <div className="relative size-12 shrink-0 overflow-hidden rounded-lg border bg-muted">
                  {img && (
                    <Image
                      src={img}
                      alt={line.product.name}
                      fill
                      sizes="48px"
                      className="object-cover"
                    />
                  )}
                  <span className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                    {line.available}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-snug line-clamp-2">
                    {line.product.name}
                  </p>
                  {line.variantName && (
                    <p className="text-xs text-primary">{line.variantName}</p>
                  )}
                </div>
                <span className="shrink-0 text-sm font-medium">
                  {formatUSD(line.lineTotalUsd)}
                </span>
              </li>
            );
          })}
        </ul>

        <div className="space-y-1.5 border-t p-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">
              Subtotal ({cart.count} {cart.count === 1 ? "art." : "arts."})
            </span>
            <span>{formatUSD(subtotal)}</span>
          </div>
          {discount > 0 && (
            <div className="flex items-center justify-between text-success">
              <span>Descuento{couponCode ? ` (${couponCode})` : ""}</span>
              <span>−{formatUSD(discount)}</span>
            </div>
          )}
          {showShippingRow && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Envío</span>
              <span className={shipping === 0 ? "font-medium text-success" : ""}>
                {shipping === 0 ? "Gratis" : formatUSD(shipping)}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between border-t pt-2">
            <span className="font-semibold">Total</span>
            <div className="text-right">
              <p className="text-lg font-bold">{formatUSD(total)}</p>
              {cart.showBs && totalBs !== null && (
                <p className="text-xs text-muted-foreground">{formatBs(totalBs)}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function OptionCard({
  active,
  onClick,
  icon,
  title,
  subtitle,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors",
        active ? "border-primary bg-primary/5" : "hover:border-primary/40",
      )}
    >
      <span className={cn("text-primary", active ? "" : "text-muted-foreground")}>
        {icon}
      </span>
      <span className="text-sm font-medium">{title}</span>
      <span className="line-clamp-1 text-xs text-muted-foreground">{subtitle}</span>
    </button>
  );
}
