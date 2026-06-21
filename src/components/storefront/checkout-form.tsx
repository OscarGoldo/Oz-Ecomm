"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import {
  Bike,
  Check,
  Copy,
  Loader2,
  Lock,
  Store as StoreIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PaymentProofUpload } from "@/components/storefront/payment-proof-upload";
import { createOrder } from "@/app/(public)/[store_slug]/checkout/actions";
import { formatBs, formatUSD, usdToBs } from "@/lib/format";
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
  const [submitting, setSubmitting] = useState(false);
  const [proofPath, setProofPath] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
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
  const shipping =
    fulfillment === "delivery" &&
    deliveryFee > 0 &&
    !(freeMin != null && subtotal >= Number(freeMin))
      ? deliveryFee
      : 0;
  const total = subtotal + shipping;
  const totalBs = cart.showBs ? usdToBs(total, cart.exchangeRate) : null;

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copiado");
    } catch {
      /* clipboard unavailable */
    }
  }

  async function onSubmit(values: FormValues) {
    if (values.fulfillment_type === "delivery" && values.delivery_address.trim().length < 5) {
      toast.error("Ingresá la dirección de entrega");
      return;
    }
    if (!selectedMethod) {
      toast.error("Elegí un método de pago");
      return;
    }
    if (selectedMethod.requires_proof && !proofPath) {
      toast.error("Subí el comprobante de pago");
      return;
    }

    setSubmitting(true);
    const res = await createOrder({
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
      notes: values.notes || undefined,
    });
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
  const detailEntries = Object.entries(details).filter(
    ([, v]) => typeof v === "string" && v.length > 0,
  ) as [string, string][];

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
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
              <Label htmlFor="customer_phone">Teléfono / WhatsApp *</Label>
              <Input
                id="customer_phone"
                type="tel"
                inputMode="tel"
                {...register("customer_phone", { required: "Ingresá un teléfono" })}
                placeholder="0424-1234567"
              />
              {errors.customer_phone && (
                <p className="text-xs text-destructive">{errors.customer_phone.message}</p>
              )}
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
                Retirás en: <span className="font-medium text-foreground">{store.pickup_address}</span>
              </p>
            )
          )}
        </CardContent>
      </Card>

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

          {selectedMethod && (
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

      {/* Summary + submit */}
      <Card>
        <CardContent className="space-y-3 pt-6">
          <div className="space-y-1.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">
                Subtotal ({cart.count} {cart.count === 1 ? "art." : "arts."})
              </span>
              <span>{formatUSD(subtotal)}</span>
            </div>
            {fulfillment === "delivery" && deliveryFee > 0 && (
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
          <Button type="submit" size="lg" className="w-full" disabled={submitting}>
            {submitting ? <Loader2 className="animate-spin" /> : <Lock />}
            Confirmar pedido
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Al confirmar, la tienda recibe tu pedido para procesarlo.
          </p>
        </CardContent>
      </Card>
    </form>
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
