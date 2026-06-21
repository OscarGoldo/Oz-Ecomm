"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Bike, Loader2, Save, Store as StoreIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { updateDeliverySettings } from "@/app/(admin)/panel/configuracion/actions";
import type { Store } from "@/types/database";

interface FormValues {
  offers_delivery: boolean;
  delivery_note: string;
  delivery_fee: string;
  free_delivery_min: string;
  offers_pickup: boolean;
  pickup_address: string;
}

export function DeliverySettingsForm({ store }: { store: Store }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const { register, handleSubmit, watch, setValue } = useForm<FormValues>({
    defaultValues: {
      offers_delivery: store.offers_delivery,
      delivery_note: store.delivery_note ?? "",
      delivery_fee: store.delivery_fee ? String(store.delivery_fee) : "0",
      free_delivery_min:
        store.free_delivery_min != null ? String(store.free_delivery_min) : "",
      offers_pickup: store.offers_pickup,
      pickup_address: store.pickup_address ?? "",
    },
  });

  const delivery = watch("offers_delivery");
  const pickup = watch("offers_pickup");

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    const res = await updateDeliverySettings({
      offers_delivery: values.offers_delivery,
      delivery_note: values.delivery_note || null,
      delivery_fee: values.delivery_fee,
      free_delivery_min: values.free_delivery_min === "" ? null : values.free_delivery_min,
      offers_pickup: values.offers_pickup,
      pickup_address: values.pickup_address || null,
    });
    setSubmitting(false);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo guardar");
      return;
    }
    toast.success("Cambios guardados");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
                <Bike className="size-5" />
              </span>
              <div>
                <p className="text-sm font-medium">Delivery</p>
                <p className="text-xs text-muted-foreground">Entrega a domicilio</p>
              </div>
            </div>
            <Switch
              checked={delivery}
              onCheckedChange={(v) => setValue("offers_delivery", v)}
            />
          </div>
          {delivery && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="delivery_note">Nota de delivery</Label>
                <Input
                  id="delivery_note"
                  {...register("delivery_note")}
                  placeholder="Ej. Delivery dentro de Maturín"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="delivery_fee">Costo de envío (USD)</Label>
                  <Input
                    id="delivery_fee"
                    type="number"
                    step="0.01"
                    min="0"
                    inputMode="decimal"
                    {...register("delivery_fee")}
                    placeholder="0.00"
                  />
                  <p className="text-xs text-muted-foreground">0 = envío gratis.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="free_delivery_min">Envío gratis desde (USD)</Label>
                  <Input
                    id="free_delivery_min"
                    type="number"
                    step="0.01"
                    min="0"
                    inputMode="decimal"
                    {...register("free_delivery_min")}
                    placeholder="Opcional"
                  />
                  <p className="text-xs text-muted-foreground">
                    Compras de este monto o más, sin costo de envío.
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
                <StoreIcon className="size-5" />
              </span>
              <div>
                <p className="text-sm font-medium">Retiro en tienda</p>
                <p className="text-xs text-muted-foreground">El cliente busca su pedido</p>
              </div>
            </div>
            <Switch
              checked={pickup}
              onCheckedChange={(v) => setValue("offers_pickup", v)}
            />
          </div>
          {pickup && (
            <div className="space-y-2">
              <Label htmlFor="pickup_address">Dirección de retiro</Label>
              <Input
                id="pickup_address"
                {...register("pickup_address")}
                placeholder="Dónde retira el cliente"
              />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={submitting}>
          {submitting ? <Loader2 className="animate-spin" /> : <Save />}
          Guardar cambios
        </Button>
      </div>
    </form>
  );
}
