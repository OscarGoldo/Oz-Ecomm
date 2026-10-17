"use client";

import { useState } from "react";

import { bs, rateText } from "@/components/landing/landing-ui";

const MIN = 1;
const MAX = 120;

/**
 * Mueve el precio en dólares y mira el monto en bolívares con la tasa real.
 * Es la doble moneda demostrada en vez de descrita: la misma cuenta que el
 * comerciante hoy saca a mano en cada DM.
 */
export function RateConverter({ rate }: { rate: number }) {
  const [price, setPrice] = useState(18);
  const fill = ((price - MIN) / (MAX - MIN)) * 100;

  return (
    <div className="grid gap-3.5 rounded-[20px] bg-noche-suave p-[22px]">
      <div className="flex flex-wrap items-baseline gap-3" aria-live="polite">
        <span className="font-landing-display text-[clamp(2.8rem,2.2rem+2vw,3.9rem)] font-extrabold leading-[0.9] tracking-[-0.05em] tabular-nums text-claro [font-stretch:80%]">
          ${price}
        </span>
        <span className="font-landing-mono text-[22px] text-niebla" aria-hidden="true">
          =
        </span>
        <span className="font-landing-mono text-[clamp(1.25rem,1.05rem+0.8vw,1.75rem)] font-semibold tabular-nums text-sol">
          {bs(price, rate)}
        </span>
      </div>
      <label htmlFor="conversor-precio" className="text-[13.5px] font-semibold text-niebla">
        Mueve el precio en dólares
      </label>
      <input
        id="conversor-precio"
        type="range"
        min={MIN}
        max={MAX}
        step={1}
        value={price}
        onChange={(e) => setPrice(Number(e.target.value))}
        style={{ "--fill": `${fill}%` } as React.CSSProperties}
        className="h-7 w-full cursor-pointer appearance-none bg-transparent [&::-moz-range-progress]:h-2 [&::-moz-range-progress]:rounded-full [&::-moz-range-progress]:bg-brand-500 [&::-moz-range-thumb]:size-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-4 [&::-moz-range-thumb]:border-noche-suave [&::-moz-range-thumb]:bg-sol [&::-moz-range-track]:h-2 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-white/15 [&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-[linear-gradient(90deg,hsl(var(--brand-500))_var(--fill),rgb(255_255_255/0.16)_var(--fill))] [&::-webkit-slider-thumb]:-mt-[9px] [&::-webkit-slider-thumb]:size-[26px] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-4 [&::-webkit-slider-thumb]:border-noche-suave [&::-webkit-slider-thumb]:bg-sol [&::-webkit-slider-thumb]:shadow-[0_2px_6px_rgb(0_0_0/0.35)]"
      />
      <p className="font-landing-mono text-[12.5px] leading-relaxed text-niebla">
        Tasa BCV: <b className="font-semibold text-claro">{rateText(rate)} Bs/$</b>
      </p>
    </div>
  );
}
