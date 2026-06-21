import { cn } from "@/lib/utils";
import { formatBs, formatUSD, usdToBs } from "@/lib/format";

interface PriceProps {
  amountUsd: number;
  exchangeRate: number | null;
  showBs: boolean;
  compareAtUsd?: number | null;
  size?: "sm" | "lg";
  className?: string;
}

export function Price({
  amountUsd,
  exchangeRate,
  showBs,
  compareAtUsd,
  size = "sm",
  className,
}: PriceProps) {
  const bs = showBs ? usdToBs(amountUsd, exchangeRate) : null;
  const hasDiscount = compareAtUsd != null && compareAtUsd > amountUsd;

  return (
    <div className={className}>
      <div className="flex items-baseline gap-2">
        <span
          className={cn(
            "font-bold text-foreground",
            size === "lg" ? "text-2xl" : "text-base",
          )}
        >
          {formatUSD(amountUsd)}
        </span>
        {hasDiscount && (
          <span
            className={cn(
              "text-muted-foreground line-through",
              size === "lg" ? "text-base" : "text-xs",
            )}
          >
            {formatUSD(compareAtUsd!)}
          </span>
        )}
      </div>
      {bs !== null && (
        <p
          className={cn(
            "text-muted-foreground",
            size === "lg" ? "text-sm" : "text-xs",
          )}
        >
          {formatBs(bs)}
        </p>
      )}
    </div>
  );
}
