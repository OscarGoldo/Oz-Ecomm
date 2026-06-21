import { ConfigTabs } from "@/components/admin/config-tabs";
import { StoreSettingsForm } from "@/components/admin/store-settings-form";
import { requireStoreUser } from "@/lib/auth";

export const metadata = { title: "Configuración" };

export default async function ConfiguracionPage() {
  const { store } = await requireStoreUser();

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-2xl font-bold tracking-tight">Configuración</h1>
      <ConfigTabs />
      <StoreSettingsForm store={store} />
    </div>
  );
}
