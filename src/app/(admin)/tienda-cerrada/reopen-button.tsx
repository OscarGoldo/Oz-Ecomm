"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { reopenStore } from "@/app/(admin)/panel/configuracion/actions";

export function ReopenStoreButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function reopen() {
    setBusy(true);
    const res = await reopenStore();
    if (!res.ok) {
      setBusy(false);
      return toast.error(res.error ?? "No se pudo reabrir la tienda");
    }
    toast.success("Tu tienda está en línea de nuevo");
    router.push("/panel");
    router.refresh();
  }

  return (
    <Button className="w-full" onClick={reopen} disabled={busy}>
      {busy && <Loader2 className="animate-spin" />} Reabrir mi tienda
    </Button>
  );
}
