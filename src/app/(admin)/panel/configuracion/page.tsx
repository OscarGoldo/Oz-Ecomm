import { CloseStoreCard } from "@/components/admin/close-store-card";
import { ConfigTabs } from "@/components/admin/config-tabs";
import {
  StoreSettingsForm,
  type BcvDisplay,
} from "@/components/admin/store-settings-form";
import { requireStoreUser } from "@/lib/auth";
import { fetchBcvRates, getCachedBcvRates } from "@/lib/bcv";

export const metadata = { title: "Configuración" };

export default async function ConfiguracionPage() {
  const { user, store } = await requireStoreUser();

  // Prefer cached rates (refreshed by the cron); fall back to a live fetch.
  const cached = await getCachedBcvRates();
  let bcvRates: BcvDisplay | null =
    cached && (cached.usd || cached.eur)
      ? { usd: cached.usd, eur: cached.eur, value_date: cached.source_date }
      : null;
  if (!bcvRates) {
    const live = await fetchBcvRates();
    if (live) bcvRates = { usd: live.usd, eur: live.eur, value_date: live.date };
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-2xl font-bold tracking-tight">Configuración</h1>
      <ConfigTabs />
      <StoreSettingsForm store={store} bcvRates={bcvRates} />
      {user.role === "store_owner" && (
        <CloseStoreCard
          storeName={store.name}
          hasSubscription={
            store.stripe_subscription_status === "active" ||
            store.stripe_subscription_status === "suspended" ||
            store.paypal_subscription_status === "active" ||
            store.paypal_subscription_status === "suspended"
          }
        />
      )}
    </div>
  );
}
