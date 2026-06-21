import { ConfigTabs } from "@/components/admin/config-tabs";
import { DeliverySettingsForm } from "@/components/admin/delivery-settings-form";
import { requireStoreUser } from "@/lib/auth";

export const metadata = { title: "Entrega" };

export default async function EntregaPage() {
  const { store } = await requireStoreUser();

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-2xl font-bold tracking-tight">Configuración</h1>
      <ConfigTabs />
      <DeliverySettingsForm store={store} />
    </div>
  );
}
