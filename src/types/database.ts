// Hand-authored Database type matching the SQL schema in /supabase/migrations.
// Keep this in sync with the migrations. (Can later be replaced by
// `supabase gen types typescript`.)

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = "super_admin" | "store_owner" | "store_staff";

export type SubscriptionStatus = "active" | "paused" | "cancelled";

/** Plan de la tienda. Ver src/lib/plans.ts para los límites de cada uno. */
export type StorePlan = "free" | "pro";
/** Cómo obtuvo el plan: pagando, de regalo (amigos), o nunca pagó. */
export type PlanSource = "free" | "paid" | "comp";
/** Estado de revisión de un comprobante de suscripción. */
export type SubscriptionPaymentStatus = "pending" | "approved" | "rejected";
/** Cómo pagó el comerciante su plan. */
export type SubscriptionMethod = "pago_movil" | "zelle" | "binance" | "paypal";
/** Espejo del estado de la suscripción recurrente en PayPal. */
export type SubscriptionState = "active" | "suspended" | "cancelled" | "expired";
/**
 * En qué va un referido. 'qualified' = la tienda referida se activó pero el
 * premio todavía no se acreditó (pasó el tope y espera revisión en /super).
 */
export type ReferralStatus = "pending" | "qualified" | "rewarded" | "rejected";

export type ProductStatus = "active" | "draft" | "archived";

export type PaymentMethodType =
  | "pago_movil"
  | "zelle"
  | "binance"
  | "cash"
  | "transfer"
  | "other"
  | "paypal";

export type FulfillmentType = "delivery" | "pickup";

/** Foto de una línea del carrito abandonado (`abandoned_carts.items`). */
export interface AbandonedCartItem {
  name: string;
  variant: string | null;
  qty: number;
  /** Precio unitario en USD al momento de abandonar. */
  price: number;
}

export type CouponType = "percentage" | "fixed" | "free_shipping";

export type PayCurrency = "USD" | "VES";
export type PayFrequency = "weekly" | "biweekly" | "monthly";

/** One variant axis, e.g. { name: "Talla", values: ["S","M","L"] }. */
export interface VariantOption {
  name: string;
  values: string[];
}

export type OrderStatus =
  | "pending_payment"
  | "pending_confirmation"
  | "confirmed"
  | "preparing"
  | "in_delivery"
  | "completed"
  | "cancelled";

export interface Database {
  public: {
    Tables: {
      stores: {
        Row: {
          id: string;
          slug: string;
          name: string;
          description: string | null;
          logo_url: string | null;
          banner_url: string | null;
          primary_color: string;
          whatsapp: string | null;
          instagram: string | null;
          phone: string | null;
          email: string | null;
          address: string | null;
          currency_primary: string;
          show_bs_prices: boolean;
          exchange_rate: number | null;
          exchange_rate_updated_at: string | null;
          offers_delivery: boolean;
          delivery_note: string | null;
          offers_pickup: boolean;
          pickup_address: string | null;
          delivery_fee: number;
          free_delivery_min: number | null;
          subscription_status: SubscriptionStatus;
          active: boolean;
          auto_exchange_rate: boolean;
          customization: Json | null;
          plan: StorePlan;
          plan_expires_at: string | null;
          plan_source: PlanSource;
          plan_note: string | null;
          paypal_subscription_id: string | null;
          paypal_subscription_status: SubscriptionState | null;
          referral_code: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          description?: string | null;
          logo_url?: string | null;
          banner_url?: string | null;
          primary_color?: string;
          whatsapp?: string | null;
          instagram?: string | null;
          phone?: string | null;
          email?: string | null;
          address?: string | null;
          currency_primary?: string;
          show_bs_prices?: boolean;
          exchange_rate?: number | null;
          exchange_rate_updated_at?: string | null;
          offers_delivery?: boolean;
          delivery_note?: string | null;
          offers_pickup?: boolean;
          pickup_address?: string | null;
          delivery_fee?: number;
          free_delivery_min?: number | null;
          subscription_status?: SubscriptionStatus;
          active?: boolean;
          auto_exchange_rate?: boolean;
          customization?: Json | null;
          plan?: StorePlan;
          plan_expires_at?: string | null;
          plan_source?: PlanSource;
          plan_note?: string | null;
          paypal_subscription_id?: string | null;
          paypal_subscription_status?: SubscriptionState | null;
          referral_code?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["stores"]["Insert"]>;
        Relationships: [];
      };
      users: {
        Row: {
          id: string;
          store_id: string | null;
          full_name: string;
          email: string;
          role: UserRole;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          store_id?: string | null;
          full_name: string;
          email: string;
          role: UserRole;
          active?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["users"]["Insert"]>;
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          store_id: string;
          name: string;
          slug: string;
          display_order: number;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          name: string;
          slug: string;
          display_order?: number;
          active?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["categories"]["Insert"]>;
        Relationships: [];
      };
      products: {
        Row: {
          id: string;
          store_id: string;
          category_id: string | null;
          name: string;
          slug: string;
          description: string | null;
          price: number;
          cost: number | null;
          currency: string;
          compare_at_price: number | null;
          stock: number;
          track_stock: boolean;
          low_stock_threshold: number;
          status: ProductStatus;
          featured: boolean;
          images: string[];
          sku: string | null;
          variant_options: VariantOption[] | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          category_id?: string | null;
          name: string;
          slug: string;
          description?: string | null;
          price: number;
          cost?: number | null;
          currency?: string;
          compare_at_price?: number | null;
          stock?: number;
          track_stock?: boolean;
          low_stock_threshold?: number;
          status?: ProductStatus;
          featured?: boolean;
          images?: string[];
          sku?: string | null;
          variant_options?: VariantOption[] | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["products"]["Insert"]>;
        Relationships: [];
      };
      payment_methods: {
        Row: {
          id: string;
          store_id: string;
          type: PaymentMethodType;
          label: string;
          details: Json;
          requires_proof: boolean;
          instructions: string | null;
          active: boolean;
          display_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          type: PaymentMethodType;
          label: string;
          details?: Json;
          requires_proof?: boolean;
          instructions?: string | null;
          active?: boolean;
          display_order?: number;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["payment_methods"]["Insert"]
        >;
        Relationships: [];
      };
      orders: {
        Row: {
          id: string;
          store_id: string;
          order_number: number;
          customer_name: string;
          customer_phone: string;
          customer_email: string | null;
          fulfillment_type: FulfillmentType;
          delivery_address: string | null;
          delivery_notes: string | null;
          subtotal: number;
          shipping_cost: number;
          discount_total: number;
          coupon_code: string | null;
          total: number;
          currency: string;
          total_bs: number | null;
          exchange_rate: number | null;
          payment_method_type: string | null;
          payment_proof_url: string | null;
          payment_reference: string | null;
          payment_fee: number | null;
          payment_net: number | null;
          paid_out_at: string | null;
          payout_proof_url: string | null;
          payout_reference: string | null;
          status: OrderStatus;
          notes: string | null;
          confirmed_at: string | null;
          completed_at: string | null;
          cancelled_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          order_number?: number;
          customer_name: string;
          customer_phone: string;
          customer_email?: string | null;
          fulfillment_type: FulfillmentType;
          delivery_address?: string | null;
          delivery_notes?: string | null;
          subtotal: number;
          shipping_cost?: number;
          discount_total?: number;
          coupon_code?: string | null;
          total: number;
          currency?: string;
          total_bs?: number | null;
          exchange_rate?: number | null;
          payment_method_type?: string | null;
          payment_proof_url?: string | null;
          payment_reference?: string | null;
          payment_fee?: number | null;
          payment_net?: number | null;
          paid_out_at?: string | null;
          payout_proof_url?: string | null;
          payout_reference?: string | null;
          status?: OrderStatus;
          notes?: string | null;
          confirmed_at?: string | null;
          completed_at?: string | null;
          cancelled_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["orders"]["Insert"]>;
        Relationships: [];
      };
      bcv_rates: {
        Row: {
          id: string;
          usd: number | null;
          eur: number | null;
          source_date: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          usd?: number | null;
          eur?: number | null;
          source_date?: string | null;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["bcv_rates"]["Insert"]>;
        Relationships: [];
      };
      coupons: {
        Row: {
          id: string;
          store_id: string;
          code: string;
          type: CouponType;
          value: number;
          min_cart: number | null;
          max_discount: number | null;
          usage_limit: number | null;
          times_used: number;
          starts_at: string | null;
          expires_at: string | null;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          code: string;
          type: CouponType;
          value?: number;
          min_cart?: number | null;
          max_discount?: number | null;
          usage_limit?: number | null;
          times_used?: number;
          starts_at?: string | null;
          expires_at?: string | null;
          active?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["coupons"]["Insert"]>;
        Relationships: [];
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          product_id: string | null;
          product_name: string;
          variant_id: string | null;
          variant_name: string | null;
          quantity: number;
          unit_price: number;
          unit_cost: number;
          subtotal: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          product_id?: string | null;
          product_name: string;
          variant_id?: string | null;
          variant_name?: string | null;
          quantity: number;
          unit_price: number;
          unit_cost?: number;
          subtotal: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["order_items"]["Insert"]>;
        Relationships: [];
      };
      product_variants: {
        Row: {
          id: string;
          product_id: string;
          store_id: string;
          option_values: string[];
          name: string;
          price: number | null;
          cost: number | null;
          stock: number;
          sku: string | null;
          active: boolean;
          position: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          store_id: string;
          option_values?: string[];
          name: string;
          price?: number | null;
          cost?: number | null;
          stock?: number;
          sku?: string | null;
          active?: boolean;
          position?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["product_variants"]["Insert"]>;
        Relationships: [];
      };
      expenses: {
        Row: {
          id: string;
          store_id: string;
          description: string;
          category: string | null;
          amount: number;
          spent_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          description: string;
          category?: string | null;
          amount: number;
          spent_at?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["expenses"]["Insert"]>;
        Relationships: [];
      };
      employees: {
        Row: {
          id: string;
          store_id: string;
          name: string;
          role: string | null;
          amount: number;
          currency: PayCurrency;
          frequency: PayFrequency;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          name: string;
          role?: string | null;
          amount: number;
          currency?: PayCurrency;
          frequency?: PayFrequency;
          active?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["employees"]["Insert"]>;
        Relationships: [];
      };
      signup_attempts: {
        Row: {
          id: string;
          ip: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          ip: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["signup_attempts"]["Insert"]>;
        Relationships: [];
      };
      store_events: {
        Row: {
          id: string;
          store_id: string;
          session_id: string;
          event_type: string;
          product_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          session_id: string;
          event_type: string;
          product_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["store_events"]["Insert"]>;
        Relationships: [];
      };
      abandoned_carts: {
        Row: {
          id: string;
          store_id: string;
          session_id: string;
          customer_name: string;
          customer_phone: string;
          customer_email: string | null;
          fulfillment_type: FulfillmentType | null;
          items: AbandonedCartItem[];
          items_count: number;
          subtotal: number;
          recovered_order_id: string | null;
          recovered_at: string | null;
          last_contacted_at: string | null;
          dismissed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          session_id: string;
          customer_name: string;
          customer_phone: string;
          customer_email?: string | null;
          fulfillment_type?: FulfillmentType | null;
          items?: AbandonedCartItem[];
          items_count?: number;
          subtotal?: number;
          recovered_order_id?: string | null;
          recovered_at?: string | null;
          last_contacted_at?: string | null;
          dismissed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["abandoned_carts"]["Insert"]
        >;
        Relationships: [];
      };
      referrals: {
        Row: {
          id: string;
          referrer_store_id: string;
          referred_store_id: string;
          code_used: string;
          status: ReferralStatus;
          reward_months: number;
          signup_ip: string | null;
          qualified_at: string | null;
          rewarded_at: string | null;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          referrer_store_id: string;
          referred_store_id: string;
          code_used: string;
          status?: ReferralStatus;
          reward_months?: number;
          signup_ip?: string | null;
          qualified_at?: string | null;
          rewarded_at?: string | null;
          note?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["referrals"]["Insert"]>;
        Relationships: [];
      };
      subscription_payments: {
        Row: {
          id: string;
          store_id: string;
          period_months: number;
          amount: number;
          currency: string;
          method: SubscriptionMethod;
          reference: string | null;
          proof_url: string | null;
          status: SubscriptionPaymentStatus;
          review_note: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          paypal_capture_id: string | null;
          paypal_subscription_id: string | null;
          fee: number | null;
          net: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          period_months: number;
          amount: number;
          currency?: string;
          method: SubscriptionMethod;
          reference?: string | null;
          proof_url?: string | null;
          status?: SubscriptionPaymentStatus;
          review_note?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          paypal_capture_id?: string | null;
          paypal_subscription_id?: string | null;
          fee?: number | null;
          net?: number | null;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["subscription_payments"]["Insert"]
        >;
        Relationships: [];
      };
      paypal_webhook_events: {
        Row: {
          id: string;
          event_type: string;
          resource_id: string | null;
          processed_at: string;
        };
        Insert: {
          id: string;
          event_type: string;
          resource_id?: string | null;
          processed_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["paypal_webhook_events"]["Insert"]
        >;
        Relationships: [];
      };
      platform_settings: {
        Row: {
          id: boolean;
          pago_movil: Json;
          zelle: Json;
          binance: Json;
          paypal: Json;
          pro_price_usd: number;
          pro_price_yearly_usd: number;
          updated_at: string;
        };
        Insert: {
          id?: boolean;
          pago_movil?: Json;
          zelle?: Json;
          binance?: Json;
          paypal?: Json;
          pro_price_usd?: number;
          pro_price_yearly_usd?: number;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["platform_settings"]["Insert"]
        >;
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      current_store_id: {
        Args: Record<string, never>;
        Returns: string;
      };
      commit_order_stock: {
        Args: { p_items: Json; p_enforce: boolean };
        Returns: undefined;
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
}

// ── Convenience row aliases ──────────────────────────────────────────────────
type Tables = Database["public"]["Tables"];
export type Store = Tables["stores"]["Row"];
export type AppUser = Tables["users"]["Row"];
export type Category = Tables["categories"]["Row"];
export type Product = Tables["products"]["Row"];
export type PaymentMethod = Tables["payment_methods"]["Row"];
export type Order = Tables["orders"]["Row"];
export type OrderItem = Tables["order_items"]["Row"];
export type Expense = Tables["expenses"]["Row"];
export type Employee = Tables["employees"]["Row"];
export type StoreEvent = Tables["store_events"]["Row"];
export type ProductVariant = Tables["product_variants"]["Row"];
export type Coupon = Tables["coupons"]["Row"];
export type SubscriptionPayment = Tables["subscription_payments"]["Row"];
export type PlatformSettings = Tables["platform_settings"]["Row"];
export type AbandonedCart = Tables["abandoned_carts"]["Row"];
export type Referral = Tables["referrals"]["Row"];
