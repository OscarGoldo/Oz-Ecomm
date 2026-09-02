import type { Config } from "tailwindcss";

/** Envuelve un token de triplete HSL y le permite el modificador de opacidad. */
const hsl = (token: string) => `hsl(var(${token}) / <alpha-value>)`;

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "1rem",
      screens: {
        "2xl": "1280px",
      },
    },
    extend: {
      fontFamily: {
        // UI y datos: Inter, que es la que aguanta tablas densas a 13px.
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        // Titulares y cifras protagonistas: una grotesca distinta, con
        // aperturas más cerradas. El contraste con Inter es lo que hace que
        // un encabezado se lea compuesto y no simplemente "más grande".
        display: [
          "var(--font-display)",
          "var(--font-inter)",
          "system-ui",
          "sans-serif",
        ],
      },
      fontSize: {
        // Los dos escalones por debajo de `text-xs`. Existen para que las
        // insignias y las ayudas dejen de escribirse como `text-[11px]` suelto
        // en cada pantalla. Nada de la interfaz baja de 10px.
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],
        "3xs": ["0.625rem", { lineHeight: "0.875rem" }],
        // Escalones de titular con su tracking ya resuelto: el interlineado y
        // el tracking de un display no son los mismos que los de un párrafo, y
        // dejarlos al default es de las cosas que más delatan una interfaz sin
        // dirección tipográfica.
        "display-xs": ["1.375rem", { lineHeight: "1.75rem", letterSpacing: "-0.02em" }],
        "display-sm": ["1.75rem", { lineHeight: "2.125rem", letterSpacing: "-0.024em" }],
        "display-md": ["2.25rem", { lineHeight: "2.5rem", letterSpacing: "-0.03em" }],
        "display-lg": ["3rem", { lineHeight: "3.125rem", letterSpacing: "-0.034em" }],
        "display-xl": ["3.75rem", { lineHeight: "3.875rem", letterSpacing: "-0.038em" }],
        "display-2xl": ["4.5rem", { lineHeight: "4.5rem", letterSpacing: "-0.042em" }],
      },
      colors: {
        border: hsl("--border"),
        input: hsl("--input"),
        ring: hsl("--ring"),
        background: hsl("--background"),
        foreground: hsl("--foreground"),

        /* Rampa neutra de plataforma. Solo panel / landing / super-admin:
           la tienda pública no la sobrescribe, así que usarla ahí rompería
           los temas con fondo oscuro. */
        ink: {
          0: hsl("--ink-0"),
          25: hsl("--ink-25"),
          50: hsl("--ink-50"),
          100: hsl("--ink-100"),
          200: hsl("--ink-200"),
          300: hsl("--ink-300"),
          400: hsl("--ink-400"),
          500: hsl("--ink-500"),
          600: hsl("--ink-600"),
          700: hsl("--ink-700"),
          800: hsl("--ink-800"),
          900: hsl("--ink-900"),
          950: hsl("--ink-950"),
        },

        /* Marca Tiendify. Distinta de `primary`: `primary` es el color del
           tenant en la tienda pública y tinta en el panel; `brand` es siempre
           el sky de la plataforma. */
        brand: {
          50: hsl("--brand-50"),
          100: hsl("--brand-100"),
          200: hsl("--brand-200"),
          300: hsl("--brand-300"),
          400: hsl("--brand-400"),
          500: hsl("--brand-500"),
          600: hsl("--brand-600"),
          700: hsl("--brand-700"),
          800: hsl("--brand-800"),
          900: hsl("--brand-900"),
          DEFAULT: hsl("--brand-500"),
        },

        surface: {
          DEFAULT: hsl("--surface"),
          raised: hsl("--surface-raised"),
          sunken: hsl("--surface-sunken"),
        },

        primary: {
          DEFAULT: hsl("--primary"),
          foreground: hsl("--primary-foreground"),
        },
        secondary: {
          DEFAULT: hsl("--secondary"),
          foreground: hsl("--secondary-foreground"),
        },
        destructive: {
          DEFAULT: hsl("--destructive"),
          foreground: hsl("--destructive-foreground"),
          surface: hsl("--destructive-surface"),
          border: hsl("--destructive-border"),
          text: hsl("--destructive-text"),
        },
        muted: {
          DEFAULT: hsl("--muted"),
          foreground: hsl("--muted-foreground"),
        },
        accent: {
          DEFAULT: hsl("--accent"),
          foreground: hsl("--accent-foreground"),
        },
        popover: {
          DEFAULT: hsl("--popover"),
          foreground: hsl("--popover-foreground"),
        },
        card: {
          DEFAULT: hsl("--card"),
          foreground: hsl("--card-foreground"),
        },
        success: {
          DEFAULT: hsl("--success"),
          foreground: hsl("--success-foreground"),
          surface: hsl("--success-surface"),
          border: hsl("--success-border"),
          text: hsl("--success-text"),
        },
        warning: {
          DEFAULT: hsl("--warning"),
          foreground: hsl("--warning-foreground"),
          surface: hsl("--warning-surface"),
          border: hsl("--warning-border"),
          text: hsl("--warning-text"),
        },
        chart: {
          1: hsl("--chart-1"),
          2: hsl("--chart-2"),
          3: hsl("--chart-3"),
          4: hsl("--chart-4"),
          5: hsl("--chart-5"),
          6: hsl("--chart-6"),
        },
        info: {
          surface: hsl("--info-surface"),
          border: hsl("--info-border"),
          text: hsl("--info-text"),
        },
      },
      borderRadius: {
        // Toda la escala cuelga de `--radius`, así que la redondez del
        // producto entero se regula desde una línea. Los escalones de abajo
        // van con max() porque la tienda pública baja `--radius` a 0.25rem
        // cuando el dueño elige botones cuadrados: sin el tope, `calc()` da
        // negativo, el valor es inválido y el navegador tira la regla entera.
        xs: "max(0px, calc(var(--radius) - 6px))",
        sm: "max(0px, calc(var(--radius) - 4px))",
        md: "max(0px, calc(var(--radius) - 2px))",
        lg: "var(--radius)",
        xl: "calc(var(--radius) + 2px)",
        "2xl": "calc(var(--radius) + 4px)",
        "3xl": "calc(var(--radius) + 8px)",
      },
      boxShadow: {
        // Sombras del sistema, en dos capas y teñidas con la tinta. Las de
        // Tailwind por defecto son negro puro y sobre un neutro cálido se ven
        // grises sucias.
        xs: "var(--shadow-xs)",
        sm: "var(--shadow-sm)",
        DEFAULT: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        pop: "var(--shadow-pop)",
        none: "none",
      },
      transitionTimingFunction: {
        // Salida rápida, entrada con freno: el default `ease` de CSS hace que
        // todo se sienta igual de perezoso.
        out: "cubic-bezier(0.22, 1, 0.36, 1)",
        in: "cubic-bezier(0.64, 0, 0.78, 0)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-12px)" },
        },
        "fade-in-up": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        marquee: "marquee 25s linear infinite",
        float: "float 6s ease-in-out infinite",
        "fade-in-up": "fade-in-up 0.6s cubic-bezier(0.22, 1, 0.36, 1) both",
        shimmer: "shimmer 1.6s infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
