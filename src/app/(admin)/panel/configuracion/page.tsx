import { CloseStoreCard } from "@/components/admin/close-store-card";
import { PushNotifications } from "@/components/admin/push-notifications";
import { SetupChecklist } from "@/components/admin/setup-checklist";
import {
  StoreSettingsForm,
  type BcvDisplay,
} from "@/components/admin/store-settings-form";
import { requireStoreUser } from "@/lib/auth";
import { fetchBcvRates, getCachedBcvRates } from "@/lib/bcv";
import { pushConfigured } from "@/lib/push";
import { getStoreSetup } from "@/lib/store-setup";
import { getUsdtRate } from "@/lib/usdt";

export const metadata = { title: "Ajustes" };

export default async function ConfiguracionPage() {
  const { user, store } = await requireStoreUser();

  // Prefer cached rates (refreshed by the cron); fall back to a live fetch.
  // El USDT sale de una caché de 15 minutos y no demora la página (lib/usdt.ts).
  const [cached, setup, usdt] = await Promise.all([
    getCachedBcvRates(),
    getStoreSetup(store),
    getUsdtRate(),
  ]);
  let bcvRates: BcvDisplay | null =
    cached && (cached.usd || cached.eur)
      ? { usd: cached.usd, eur: cached.eur, value_date: cached.source_date }
      : null;
  if (!bcvRates) {
    const live = await fetchBcvRates();
    if (live) bcvRates = { usd: live.usd, eur: live.eur, value_date: live.date };
  }

  return (
    <StoreSettingsForm
      store={store}
      bcvRates={bcvRates}
      usdtRate={usdt?.rate ?? null}
      after={
        <>
          {pushConfigured() && (
            <PushNotifications variant="card" publicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!} />
          )}
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
        </>
      }
      aside={<SetupChecklist items={setup.checklist} />}
    />
  );
}
