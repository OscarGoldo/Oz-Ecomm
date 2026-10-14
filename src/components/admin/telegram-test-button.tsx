"use client";

import { useTransition } from "react";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";

import { sendTelegramTest } from "@/app/(superadmin)/super/actions";
import { Button } from "@/components/ui/button";

/** Manda un mensaje de prueba al grupo de Telegram de los socios. */
export function TelegramTestButton() {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await sendTelegramTest();
          if (!res.ok) {
            toast.error(res.error ?? "No se pudo mandar");
            return;
          }
          toast.success("Mensaje enviado al grupo");
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <Send />}
      Probar Telegram
    </Button>
  );
}
