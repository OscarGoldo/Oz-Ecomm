import { DeliverySettingsForm } from "@/components/admin/delivery-settings-form";
import { SetupChecklist } from "@/components/admin/setup-checklist";
import { requireStoreUser } from "@/lib/auth";
import { getStoreSetup } from "@/lib/store-setup";

export const metadata = { title: "Entrega" };

export default async function EntregaPage() {
  const { store } = await requireStoreUser();
  const setup = await getStoreSetup(store);

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,1fr)]">
      <div className="min-w-0">
        <DeliverySettingsForm store={store} />
      </div>
      <aside className="min-w-0">
        <SetupChecklist items={setup.checklist} />
      </aside>
    </div>
  );
}
