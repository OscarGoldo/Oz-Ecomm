"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { markFeedbackRead } from "@/app/(superadmin)/super/comentarios/actions";
import { Button } from "@/components/ui/button";

/** Marca un comentario como leído, o todos los pendientes si no recibe `id`. */
export function FeedbackReadButton({ id = null }: { id?: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      size="sm"
      variant={id ? "ghost" : "outline"}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await markFeedbackRead(id);
          if (!res.ok) {
            toast.error(res.error ?? "Error");
            return;
          }
          router.refresh();
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <Check />}
      {id ? "Marcar como leído" : "Marcar todos como leídos"}
    </Button>
  );
}
