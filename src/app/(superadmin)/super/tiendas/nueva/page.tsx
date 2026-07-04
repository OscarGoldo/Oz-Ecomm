import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { StoreOnboardingForm } from "@/components/admin/store-onboarding-form";

export const metadata = { title: "Nueva tienda" };

export default function NewStorePage() {
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <Link
          href="/super"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Tiendas
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Nueva tienda</h1>
        <p className="text-sm text-muted-foreground">
          Crea un tenant y su dueño. Se agrega Efectivo como método de pago por
          defecto.
        </p>
      </div>
      <StoreOnboardingForm />
    </div>
  );
}
