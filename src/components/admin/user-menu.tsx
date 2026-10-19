"use client";

import { ChevronDown, Copy, ExternalLink, LogOut } from "lucide-react";
import { toast } from "sonner";

import { useCopyLink } from "@/components/admin/use-copy-link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/lib/auth-actions";
import { cn } from "@/lib/utils";

interface UserMenuProps {
  fullName: string;
  email: string;
  /** La dirección pública de la tienda: su subdominio. */
  storeUrl: string;
  /** "dark" para cuando va sobre la barra noche del teléfono. */
  tone?: "light" | "dark";
}

export function UserMenu({ fullName, email, storeUrl, tone = "light" }: UserMenuProps) {
  const initials = fullName
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  // El menú se cierra al elegir, así que el "copiado" se avisa con un toast.
  const { copy } = useCopyLink(storeUrl);
  async function copyStoreLink() {
    if (await copy()) {
      toast.success("Link copiado", {
        description: storeUrl.replace(/^https?:\/\//, ""),
      });
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex items-center gap-1.5 rounded-full p-1 pr-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          tone === "dark" ? "hover:bg-white/10" : "hover:bg-muted",
        )}
      >
        <span
          className={cn(
            "grid size-8 place-items-center rounded-full text-xs font-bold",
            tone === "dark" ? "bg-brand-600 text-white" : "bg-brand-700 text-white",
          )}
        >
          {initials || "?"}
        </span>
        <ChevronDown
          className={cn("size-4", tone === "dark" ? "text-white/70" : "text-muted-foreground")}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col">
          <span className="truncate">{fullName}</span>
          <span className="truncate text-xs font-normal text-muted-foreground">
            {email}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a href={storeUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="size-4" />
            Ver mi tienda
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void copyStoreLink()}>
          <Copy className="size-4" />
          Copiar link de mi tienda
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <form action={signOut}>
            <button type="submit" className="flex w-full items-center gap-2">
              <LogOut className="size-4" />
              Cerrar sesión
            </button>
          </form>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
