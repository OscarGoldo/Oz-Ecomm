"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import {
  AlertTriangle,
  ArrowLeft,
  Bike,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
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
  saveCheckoutLead,
  type CheckoutInput,
} from "@/app/(public)/[store_slug]/checkout/actions";
import { formatBs, formatUSD, usdToBs } from "@/lib/format";
import { getImageUrl } from "@/lib/storage";
import { cn } from "@/lib/utils";
import type { EnrichedCart } from "@/lib/cart";
import type { PaymentMethod, Store } from "@/types/database";

/**
 * Etiquetas legibles de los datos de cobro. Tienen que cubrir todas las claves
 * de `PAYMENT_TYPE_FIELDS` en lib/constants: la que falte se le muestra al
 * cliente con el nombre crudo de la columna en plena pantalla de pago.
 */
const DETAIL_LABELS: Record<string, string> = {
  banco: "Banco",
  telefono: "Teléfono",
  cedula: "Cédula / RIF",
  titular: "Titular",
  cuenta: "N° de cuenta",
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

/** Suficiente para atajar el dedazo; la validación de verdad es del servidor. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  /** Contenedor del teléfono: el input vive dentro de PhoneInput, sin id propio. */
  const phoneRef = useRef<HTMLDivElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [proofPath, setProofPath] = useState<string | null>(null);
  /**
   * Una clave por intento de compra, generada al montar el formulario y
   * reenviada en cada envío. Si la conexión se cae después de que el servidor
   * creó el pedido pero antes de que llegue la respuesta, el reintento trae la
   * misma clave y el servidor devuelve el pedido que ya existe en vez de
   * crear otro. Es el caso de todos los días en datos móviles.
   */
  const [idempotencyKey] = useState(() =>
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
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
    setError,
    clearErrors,
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

  /* ── Borrador del checkout ────────────────────────────────────────────────
   * Todo lo que el cliente escribe vive en memoria, así que irse a la app del
   * banco a pagar y volver —el flujo NORMAL con Pago Móvil— borraba nombre,
   * dirección, cupón y el paso en el que iba. En un Android de gama baja la
   * pestaña se descarta sola con solo cambiar de app. Guardar el borrador es lo
   * que hace que el checkout en dos tiempos sea usable.
   * Solo datos de contacto y entrega: nunca el comprobante ni nada de pago.  */
  const draftKey = `oz_checkout_draft:${store.id}`;
  const restored = useRef(false);
  /**
   * Teléfono que venía en el borrador. Va aparte del form porque PhoneInput
   * guarda su propio estado: sin esto el cliente vuelve, ve el nombre y la
   * dirección puestos y el teléfono vacío, y cree que se perdió todo.
   */
  const [restoredPhone, setRestoredPhone] = useState("");

  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    try {
      const raw = window.localStorage.getItem(draftKey);
      if (!raw) return;
      const d = JSON.parse(raw) as Partial<FormValues> & { step?: 1 | 2 };
      const keys: (keyof FormValues)[] = [
        "customer_name",
        "customer_phone",
        "customer_email",
        "fulfillment_type",
        "delivery_address",
        "delivery_notes",
        "notes",
      ];
      for (const k of keys) {
        const v = d[k];
        if (typeof v === "string" && v) setValue(k, v as never);
      }
      if (typeof d.customer_phone === "string" && d.customer_phone) {
        setRestoredPhone(d.customer_phone);
      }
      // El método guardado puede haberse desactivado desde entonces.
      if (d.payment_method_id && paymentMethods.some((m) => m.id === d.payment_method_id)) {
        setValue("payment_method_id", d.payment_method_id);
      }
      if (d.step === 2) setStep(2);
    } catch {
      // Borrador ilegible o localStorage bloqueado (modo privado): se sigue.
    }
  }, [draftKey, paymentMethods, setValue]);

  useEffect(() => {
    const sub = watch((values) => {
      try {
        window.localStorage.setItem(
          draftKey,
          JSON.stringify({ ...values, step }),
        );
      } catch {
        // Sin espacio o sin permiso: guardar el borrador es un extra.
      }
    });
    return () => sub.unsubscribe();
  }, [watch, draftKey, step]);

  /** Se llama al crear el pedido: el borrador ya no sirve para nada. */
  function clearDraft() {
    try {
      window.localStorage.removeItem(draftKey);
    } catch {
      /* nada que hacer */
    }
  }

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
    try {
      const res = await previewCoupon(store.id, couponCode, subtotal);
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
    } catch {
      toast.error("No pudimos validar el cupón. Revisa tu conexión.");
    } finally {
      setCheckingCoupon(false);
    }
  }

  /**
   * Copiar con red de contención. `navigator.clipboard` no existe en varios
   * navegadores embebidos (el de Instagram, entre otros), que es justo de donde
   * llega buena parte de los compradores. Antes el fallo se tragaba en silencio:
   * el cliente tocaba el ícono, no pasaba nada y no había explicación.
   */
  async function copy(text: string, what = "Dato") {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        toast.success(`${what} copiado`);
        return;
      }
      throw new Error("sin clipboard");
    } catch {
      // Camino viejo: un textarea fuera de pantalla + execCommand. Funciona en
      // los WebView donde la API moderna está bloqueada.
      try {
        const el = document.createElement("textarea");
        el.value = text;
        el.setAttribute("readonly", "");
        el.style.position = "fixed";
        el.style.opacity = "0";
        document.body.appendChild(el);
        el.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(el);
        if (ok) {
          toast.success(`${what} copiado`);
          return;
        }
      } catch {
        /* sigue al aviso de abajo */
      }
      toast.error("Tu navegador no deja copiar", {
        description: "Mantén presionado el dato para seleccionarlo y copiarlo.",
      });
    }
  }

  /**
   * Valida el paso 1 marcando los campos, no tirando un toast.
   *
   * El toast se iba solo a los pocos segundos y no dejaba rastro de CUÁL campo
   * estaba mal; peor todavía cuando el error se detectaba desde el paso 2 y el
   * cliente aterrizaba en una pantalla anterior sin nada resaltado. Ahora el
   * mensaje queda debajo del campo y la página hace foco en el primero que
   * falla.
   */
  function validateStep1(): boolean {
    const v = getValues();
    clearErrors();
    const problems: { field: keyof FormValues; message: string }[] = [];

    if (v.customer_name.trim().length < 2) {
      problems.push({ field: "customer_name", message: "Ingresa tu nombre y apellido" });
    }
    if (v.customer_phone.trim().length < 6) {
      problems.push({
        field: "customer_phone",
        message: "Ingresa tu teléfono, por ahí te escribe la tienda",
      });
    }
    if (!EMAIL_RE.test(v.customer_email.trim())) {
      problems.push({
        field: "customer_email",
        message: v.customer_email.trim()
          ? "Revisa el email, parece incompleto"
          : "Ingresa tu email para recibir el recibo",
      });
    }
    if (v.fulfillment_type === "delivery" && v.delivery_address.trim().length < 5) {
      problems.push({
        field: "delivery_address",
        message: "Escribe la dirección con un punto de referencia",
      });
    }

    if (problems.length === 0) return true;

    for (const p of problems) setError(p.field, { message: p.message });
    setStep(1);
    // Al primero que falla: en un celular el campo puede estar fuera de la
    // pantalla y sin esto el cliente no ve el mensaje que acabamos de poner.
    const first = problems[0]!.field;
    requestAnimationFrame(() => {
      const el =
        first === "customer_phone"
          ? phoneRef.current?.querySelector("input")
          : document.getElementById(first);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      (el as HTMLElement | null | undefined)?.focus?.({ preventScroll: true });
    });
    return false;
  }

  /** Validate step 1 (data + delivery) before moving to payment. */
  function goToPayment() {
    const v = getValues();
    if (!validateStep1()) return;
    // El cliente ya dio sus datos para comprar: guardamos el carrito por si no
    // termina, así el comerciante puede recuperarlo. Sin await — no puede
    // demorar el paso al pago, y el action se traga sus propios errores.
    void saveCheckoutLead({
      store_id: store.id,
      customer_name: v.customer_name,
      customer_phone: v.customer_phone,
      customer_email: v.customer_email || undefined,
      fulfillment_type: v.fulfillment_type,
    });

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
    // Marca los campos y hace foco; también devuelve al paso 1 si hace falta.
    if (!validateStep1()) return null;
    if (!selectedMethod) {
      toast.error("Elige cómo vas a pagar");
      return null;
    }
    return {
      store_id: store.id,
      customer_name: values.customer_name,
      customer_phone: values.customer_phone,
      customer_email: values.customer_email,
      fulfillment_type: values.fulfillment_type,
      delivery_address: values.delivery_address || undefined,
      delivery_notes: values.delivery_notes || undefined,
      payment_method_id: values.payment_method_id,
      payment_reference: values.payment_reference || undefined,
      payment_proof_path: proofPath || undefined,
      coupon_code: coupon?.code || undefined,
      notes: values.notes || undefined,
      idempotency_key: idempotencyKey,
    };
  }

  async function onSubmit() {
    if (!selectedMethod) {
      toast.error("Elige cómo vas a pagar");
      return;
    }
    const input = buildInput();
    if (!input) return;

    setSubmitting(true);
    try {
      const res = await createOrder(input);
      if (!res.ok || !res.orderId) {
        toast.error(res.error ?? "No se pudo crear el pedido");
        return;
      }
      clearDraft();
      router.push(`/${store.slug}/pedido/${res.orderId}`);
    } catch {
      // Se cortó la conexión en pleno envío. El pedido PUEDE haberse creado —
      // por eso el mensaje no dice "falló" y por eso reintentar es seguro: la
      // clave de idempotencia hace que el segundo intento devuelva el mismo
      // pedido en lugar de duplicarlo.
      toast.error(
        "Se perdió la conexión. Revisa tu correo antes de reintentar: si el pedido entró, te llegó el recibo.",
      );
    } finally {
      // En el `finally` a propósito: antes esto vivía después del await, así
      // que una promesa rechazada dejaba el botón girando para siempre.
      setSubmitting(false);
    }
  }

  const details =
    selectedMethod && typeof selectedMethod.details === "object" && selectedMethod.details
      ? (selectedMethod.details as Record<string, unknown>)
      : {};
  const isPaypal = selectedMethod?.type === "paypal";
  /** Va a comprar sin haber pagado todavía: el pedido nace esperando el pago. */
  const awaitingPayment = Boolean(selectedMethod?.requires_proof) && !proofPath;
  const paypalClientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
  const detailEntries = Object.entries(details).filter(
    ([, v]) => typeof v === "string" && v.length > 0,
  ) as [string, string][];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px] lg:items-start">
      {/* Order summary — top on mobile (collapsible), right on desktop (sticky) */}
      <aside className="lg:order-2 lg:sticky lg:top-4">
        <OrderSummary
          openOnMobile={step === 2}
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
        {cart.changes.length > 0 && (
          <div className="mb-5 rounded-xl border border-warning/40 bg-warning/10 p-3">
            <p className="flex items-center gap-2 text-sm font-medium">
              <AlertTriangle className="size-4 shrink-0 text-warning-foreground" />
              Ajustamos tu pedido
            </p>
            <ul className="mt-1.5 space-y-0.5 pl-6 text-sm text-muted-foreground">
              {cart.changes.map((c, i) => (
                <li key={`${c.name}-${i}`}>
                  {c.kind === "removed"
                    ? `${c.name} se agotó y lo quitamos.`
                    : `De ${c.name} quedaban ${c.available}, así que llevas esa cantidad.`}
                </li>
              ))}
            </ul>
          </div>
        )}
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
                  {...register("customer_name", { required: "Ingresa tu nombre" })}
                  placeholder="Ej. María Pérez"
                  aria-invalid={Boolean(errors.customer_name)}
                  aria-describedby={
                    errors.customer_name ? "customer_name_error" : undefined
                  }
                />
                {errors.customer_name && (
                  <p id="customer_name_error" className="text-xs text-destructive">
                    {errors.customer_name.message}
                  </p>
                )}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2" ref={phoneRef}>
                  <Label>Teléfono / WhatsApp *</Label>
                  <PhoneInput
                    key={restoredPhone ? "restored" : "fresh"}
                    defaultValue={restoredPhone}
                    invalid={Boolean(errors.customer_phone)}
                    describedBy={
                      errors.customer_phone ? "customer_phone_error" : undefined
                    }
                    onChange={(v) => {
                      setValue("customer_phone", v);
                      if (v.trim().length >= 6) clearErrors("customer_phone");
                    }}
                    placeholder="424 1234567"
                  />
                  {errors.customer_phone && (
                    <p id="customer_phone_error" className="text-xs text-destructive">
                      {errors.customer_phone.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customer_email">Email *</Label>
                  <Input
                    id="customer_email"
                    type="email"
                    inputMode="email"
                    {...register("customer_email", {
                      required: "Ingresa tu email",
                      pattern: { value: EMAIL_RE, message: "Email inválido" },
                    })}
                    placeholder="tu@correo.com"
                    aria-invalid={Boolean(errors.customer_email)}
                    aria-describedby="customer_email_hint"
                  />
                  {errors.customer_email ? (
                    <p id="customer_email_hint" className="text-xs text-destructive">
                      {errors.customer_email.message}
                    </p>
                  ) : (
                    <p id="customer_email_hint" className="text-xs text-muted-foreground">
                      Ahí te llega el recibo de tu pedido.
                    </p>
                  )}
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
                      aria-invalid={Boolean(errors.delivery_address)}
                    />
                    {errors.delivery_address && (
                      <p className="text-xs text-destructive">
                        {errors.delivery_address.message}
                      </p>
                    )}
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
                    Retiras en:{" "}
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
                    Pagas con PayPal, tarjeta de crédito o débito. Confirmas el
                    pago más abajo. Tu pedido se confirma al instante.
                  </p>
                </div>
              ) : selectedMethod ? (
                <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
                  {selectedMethod.requires_proof && (
                    <AmountToPay
                      total={total}
                      totalBs={totalBs}
                      /* Pago Móvil y transferencia se pagan en bolívares; Zelle
                         y Binance en dólares. El cliente tiene que ver EL
                         número que va a tipear en la app del banco. */
                      inBs={
                        selectedMethod.type === "pago_movil" ||
                        selectedMethod.type === "transfer"
                      }
                      onCopy={copy}
                    />
                  )}
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
                      {!proofPath && (
                        <p className="flex items-start gap-2 rounded-lg bg-muted/60 p-2.5 text-xs text-muted-foreground">
                          <Clock className="mt-0.5 size-3.5 shrink-0" />
                          ¿Todavía no pagaste? Confirma el pedido igual: te
                          guardamos el carrito y el precio, y subes el
                          comprobante cuando lo tengas.
                        </p>
                      )}
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
                      Pagas al recibir o retirar el pedido. No necesitas comprobante.
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
                  onSuccess={(id) => {
                    clearDraft();
                    router.push(`/${store.slug}/pedido/${id}`);
                  }}
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
                {awaitingPayment
                  ? `Guardar mi pedido · ${formatUSD(total)}`
                  : `Confirmar pedido · ${formatUSD(total)}`}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                {awaitingPayment
                  ? "Te mandamos el enlace por email para que subas el comprobante cuando pagues."
                  : "Al confirmar, la tienda recibe tu pedido para procesarlo."}
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
  openOnMobile = false,
}: {
  cart: EnrichedCart;
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  totalBs: number | null;
  showShippingRow: boolean;
  couponCode?: string;
  /** En el paso de pago se despliega solo: es cuando el cliente compara. */
  openOnMobile?: boolean;
}) {
  const [open, setOpen] = useState(openOnMobile);
  const [touched, setTouched] = useState(false);

  // Se abre al llegar al pago, salvo que el cliente ya lo haya cerrado a mano.
  useEffect(() => {
    if (openOnMobile && !touched) setOpen(true);
  }, [openOnMobile, touched]);

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      {/* Mobile collapsible header */}
      <button
        type="button"
        onClick={() => {
          setTouched(true);
          setOpen((o) => !o);
        }}
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

/**
 * Cuánto tiene que transferir el cliente, en la moneda en la que va a pagar.
 *
 * Es el dato que faltaba justo donde se toma la decisión: el total en Bs vivía
 * solo dentro del resumen, que en celular arranca colapsado. El cliente se iba
 * a la app del banco a tipear un número que no tenía a la vista, y transfería
 * de más, de menos, o abandonaba.
 *
 * El botón de copiar entrega el número PELADO (sin "Bs", sin separadores de
 * miles) porque eso es lo que acepta el campo de monto de la app del banco.
 */
function AmountToPay({
  total,
  totalBs,
  inBs,
  onCopy,
}: {
  total: number;
  totalBs: number | null;
  inBs: boolean;
  onCopy: (text: string, what?: string) => void;
}) {
  const showBs = inBs && totalBs !== null;
  const raw = showBs ? totalBs!.toFixed(2) : total.toFixed(2);

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
      <p className="text-xs font-medium text-muted-foreground">
        Transfiere exactamente
      </p>
      <div className="mt-1 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-2xl font-bold leading-tight tracking-tight">
            {showBs ? formatBs(totalBs!) : formatUSD(total)}
          </p>
          {showBs && (
            <p className="text-xs text-muted-foreground">
              equivale a {formatUSD(total)}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => onCopy(raw, "Monto")}
          className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-lg border border-primary/40 bg-background px-3 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
        >
          <Copy className="size-4" /> Copiar
        </button>
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
