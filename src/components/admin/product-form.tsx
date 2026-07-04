"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { Loader2, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ImageUploader } from "@/components/admin/image-uploader";
import {
  VariantsEditor,
  initialVariantState,
  type VariantState,
} from "@/components/admin/variants-editor";
import {
  createProduct,
  deleteProduct,
  updateProduct,
  type ProductInput,
} from "@/app/(admin)/panel/productos/actions";
import { cleanVariantOptions, variantCombos, variantKey } from "@/lib/variants";
import type {
  Category,
  Product,
  ProductStatus,
  ProductVariant,
} from "@/types/database";

const NONE = "none";

interface FormValues {
  name: string;
  description: string;
  category_id: string;
  sku: string;
  price: string;
  cost: string;
  compare_at_price: string;
  stock: string;
  track_stock: boolean;
  low_stock_threshold: string;
  status: ProductStatus;
  featured: boolean;
  images: string[];
}

function toDefaults(product?: Product): FormValues {
  return {
    name: product?.name ?? "",
    description: product?.description ?? "",
    category_id: product?.category_id ?? NONE,
    sku: product?.sku ?? "",
    price: product ? String(product.price) : "",
    cost: product?.cost != null ? String(product.cost) : "",
    compare_at_price:
      product?.compare_at_price != null ? String(product.compare_at_price) : "",
    stock: product ? String(product.stock) : "0",
    track_stock: product?.track_stock ?? true,
    low_stock_threshold: product ? String(product.low_stock_threshold) : "5",
    status: product?.status ?? "active",
    featured: product?.featured ?? false,
    images: product?.images ?? [],
  };
}

interface ProductFormProps {
  storeId: string;
  categories: Pick<Category, "id" | "name">[];
  product?: Product;
  variants?: ProductVariant[];
}

export function ProductForm({
  storeId,
  categories,
  product,
  variants,
}: ProductFormProps) {
  const router = useRouter();
  const isEdit = Boolean(product);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [variantState, setVariantState] = useState<VariantState>(() =>
    initialVariantState(product?.variant_options, variants),
  );

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: toDefaults(product) });

  const trackStock = watch("track_stock");
  const hasVariants = variantState.enabled;

  async function onSubmit(values: FormValues) {
    // Build variant payload from the editor state.
    let variantOptions: ProductInput["variant_options"] = null;
    let variantPayload: ProductInput["variants"] = [];
    if (variantState.enabled) {
      const axes = cleanVariantOptions(variantState.options);
      const combos = variantCombos(axes);
      if (axes.length === 0 || combos.length === 0) {
        toast.error("Agrega al menos un tipo de variante con sus valores");
        return;
      }
      const rowByKey = new Map(variantState.rows.map((r) => [r.key, r]));
      variantOptions = axes;
      variantPayload = combos.map((vals) => {
        const r = rowByKey.get(variantKey(vals));
        const priceNum = r?.price ? Number(r.price) : NaN;
        return {
          option_values: vals,
          stock: Math.max(0, Math.floor(Number(r?.stock) || 0)),
          price: Number.isFinite(priceNum) && priceNum > 0 ? priceNum : null,
          active: r?.active ?? true,
        };
      });
    }

    const input: ProductInput = {
      name: values.name,
      description: values.description || null,
      category_id: values.category_id === NONE ? null : values.category_id,
      sku: values.sku || null,
      price: values.price,
      cost: values.cost === "" ? null : values.cost,
      compare_at_price: values.compare_at_price === "" ? null : values.compare_at_price,
      currency: "USD",
      stock: values.stock,
      track_stock: values.track_stock,
      low_stock_threshold: values.low_stock_threshold,
      status: values.status,
      featured: values.featured,
      images: values.images,
      variant_options: variantOptions,
      variants: variantPayload,
    };

    setSubmitting(true);
    try {
      const result = isEdit
        ? await updateProduct(product!.id, input)
        : await createProduct(input);

      if (!result.ok) {
        toast.error(result.error ?? "No se pudo guardar");
        return;
      }
      toast.success(isEdit ? "Producto actualizado" : "Producto creado");
      router.push("/panel/productos");
      router.refresh();
    } catch {
      toast.error("No se pudo guardar. Revisa tu conexión e intenta de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }

  async function onDelete() {
    if (!product) return;
    setDeleting(true);
    try {
      const result = await deleteProduct(product.id);
      if (!result.ok) {
        toast.error(result.error ?? "No se pudo eliminar");
        return;
      }
      toast.success("Producto eliminado");
      router.push("/panel/productos");
      router.refresh();
    } catch {
      toast.error("No se pudo eliminar. Intenta de nuevo.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Información</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre *</Label>
            <Input
              id="name"
              {...register("name", {
                required: "Pon un nombre",
                minLength: { value: 2, message: "Muy corto" },
              })}
              placeholder="Ej. Air Fryer Digital 3.5L"
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              {...register("description")}
              placeholder="Características, capacidad, garantía…"
              rows={4}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Categoría</Label>
              <Controller
                control={control}
                name="category_id"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sin categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Sin categoría</SelectItem>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sku">SKU / Código</Label>
              <Input id="sku" {...register("sku")} placeholder="Opcional" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Precio y stock</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="price">Precio (USD) *</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                {...register("price", {
                  required: "Pon un precio",
                  min: { value: 0, message: "Inválido" },
                })}
                placeholder="0.00"
              />
              {errors.price && (
                <p className="text-xs text-destructive">{errors.price.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="compare_at_price">Precio tachado</Label>
              <Input
                id="compare_at_price"
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                {...register("compare_at_price")}
                placeholder="Opcional (oferta)"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cost">Costo (USD)</Label>
              <Input
                id="cost"
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                {...register("cost")}
                placeholder="Cuánto te cuesta"
              />
              <p className="text-xs text-muted-foreground">
                {(() => {
                  const p = Number(watch("price"));
                  const c = Number(watch("cost"));
                  if (p > 0 && c > 0 && c <= p) {
                    const margin = Math.round(((p - c) / p) * 100);
                    return `Ganancia: $${(p - c).toFixed(2)} · margen ${margin}%`;
                  }
                  return "Para ver márgenes en Finanzas.";
                })()}
              </p>
            </div>
          </div>

          {hasVariants ? (
            <p className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
              El stock se maneja por variante (abajo). El precio de arriba es el
              precio base; cada variante puede tener el suyo.
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Controlar stock</p>
                  <p className="text-xs text-muted-foreground">
                    Mostrar “agotado” cuando llegue a 0.
                  </p>
                </div>
                <Controller
                  control={control}
                  name="track_stock"
                  render={({ field }) => (
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
              </div>

              {trackStock && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="stock">Stock</Label>
                    <Input
                      id="stock"
                      type="number"
                      min="0"
                      inputMode="numeric"
                      {...register("stock")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="low_stock_threshold">Aviso de bajo stock</Label>
                    <Input
                      id="low_stock_threshold"
                      type="number"
                      min="0"
                      inputMode="numeric"
                      {...register("low_stock_threshold")}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Variantes</CardTitle>
        </CardHeader>
        <CardContent>
          <VariantsEditor
            value={variantState}
            onChange={setVariantState}
            basePrice={watch("price")}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Imágenes</CardTitle>
        </CardHeader>
        <CardContent>
          <Controller
            control={control}
            name="images"
            render={({ field }) => (
              <ImageUploader
                storeId={storeId}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Publicación</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Estado</Label>
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Activo (visible)</SelectItem>
                    <SelectItem value="draft">Borrador (oculto)</SelectItem>
                    <SelectItem value="archived">Archivado</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Destacado</p>
              <p className="text-xs text-muted-foreground">
                Aparece primero en la tienda.
              </p>
            </div>
            <Controller
              control={control}
              name="featured"
              render={({ field }) => (
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        {isEdit ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="outline" className="text-destructive">
                <Trash2 /> Eliminar
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar este producto?</AlertDialogTitle>
                <AlertDialogDescription>
                  Se quitará de tu catálogo. Esta acción no se puede deshacer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={onDelete}
                  disabled={deleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deleting ? "Eliminando…" : "Eliminar"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : (
          <span />
        )}

        <div className="flex gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push("/panel/productos")}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? <Loader2 className="animate-spin" /> : <Save />}
            {isEdit ? "Guardar cambios" : "Crear producto"}
          </Button>
        </div>
      </div>
    </form>
  );
}
