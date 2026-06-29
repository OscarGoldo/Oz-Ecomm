import { ConfigTabs } from "@/components/admin/config-tabs";
import {
  StoreSettingsForm,
  type BcvDisplay,
} from "@/components/admin/store-settings-form";
import { requireStoreUser } from "@/lib/auth";
import { fetchBcvRates, getCachedBcvRates } from "@/lib/bcv";

export const metadata = { title: "Configuración" };

export default async function ConfiguracionPage() {
  const { store } = await requireStoreUser();

  // Prefer cached rates (refreshed by the cron); fall back to a live fetch.
  const cached = await getCachedBcvRates();
  let bcvRates: BcvDisplay | null =
    cached && (cached.usd || cached.eur || cached.paralelo)
      ? {
          usd: cached.usd,
          eur: cached.eur,
          paralelo: cached.paralelo,
          updated_at: cached.updated_at,
        }
      : null;
  if (!bcvRates) {
    const live = await fetchBcvRates();
    if (live)
      bcvRates = {
        usd: live.usd,
        eur: live.eur,
        paralelo: live.paralelo,
        updated_at: live.date,
      };
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-2xl font-bold tracking-tight">Configuración</h1>
      <ConfigTabs />
      <StoreSettingsForm store={store} bcvRates={bcvRates} />
    </div>
  );
}
