"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Switch } from "@/components/ui/switch";
import { setStoreActive } from "@/app/(superadmin)/super/actions";

export function StoreActiveSwitch({
  storeId,
  active,
}: {
  storeId: string;
  active: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Switch
      checked={active}
      disabled={pending}
      onCheckedChange={(v) =>
        startTransition(async () => {
          const res = await setStoreActive(storeId, v);
          if (!res.ok) {
            toast.error(res.error ?? "Error");
            return;
          }
          toast.success(v ? "Tienda activada" : "Tienda pausada");
          router.refresh();
        })
      }
      aria-label="Activa"
    />
  );
}
