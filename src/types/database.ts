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

export type ProductStatus = "active" | "draft" | "archived";

export type PaymentMethodType =
  | "pago_movil"
  | "zelle"
  | "binance"
  | "cash"
  | "transfer"
  | "other";

export type FulfillmentType = "delivery" | "pickup";

export type CouponType = "percentage" | "fixed" | "free_shipping";

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
          customization: Json | null;
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
          customization?: Json | null;
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
          currency: string;
          compare_at_price: number | null;
          stock: number;
          track_stock: boolean;
          low_stock_threshold: number;
          status: ProductStatus;
          featured: boolean;
          images: string[];
          sku: string | null;
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
          currency?: string;
          compare_at_price?: number | null;
          stock?: number;
          track_stock?: boolean;
          low_stock_threshold?: number;
          status?: ProductStatus;
          featured?: boolean;
          images?: string[];
          sku?: string | null;
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
          quantity: number;
          unit_price: number;
          subtotal: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          product_id?: string | null;
          product_name: string;
          quantity: number;
          unit_price: number;
          subtotal: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["order_items"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      current_store_id: {
        Args: Record<string, never>;
        Returns: string;
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
export type Coupon = Tables["coupons"]["Row"];
