import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#3b82f6", dark: "#2563eb" },

        /* Surfaces */
        main:       "var(--bg-main)",
        surface:    "var(--bg-surface)",
        overlay:    "var(--bg-overlay)",
        "input-bg": "var(--bg-input)",
        hover:      "var(--bg-hover)",
        "row-hover":"var(--bg-row-hover)",

        /* Borders */
        "b-default": "var(--border-default)",
        "b-input":   "var(--border-input)",

        /* Text */
        primary:   "var(--text-primary)",
        secondary: "var(--text-secondary)",
        muted:     "var(--text-muted)",
        faint:     "var(--text-faint)",
        ph:        "var(--text-placeholder)",

        /* Action (blue) + opacity variants */
        action:         "var(--color-primary)",
        "action-hover": "var(--color-primary-hover)",
        "action-5":     "var(--color-primary-5)",
        "action-10":    "var(--color-primary-10)",
        "action-15":    "var(--color-primary-15)",
        "action-20":    "var(--color-primary-20)",
        "action-30":    "var(--color-primary-30)",

        /* Profit (emerald) + opacity variants */
        profit:         "var(--color-profit)",
        "profit-hover": "var(--color-profit-hover)",
        "profit-5":     "var(--color-profit-5)",
        "profit-10":    "var(--color-profit-10)",
        "profit-15":    "var(--color-profit-15)",
        "profit-20":    "var(--color-profit-20)",
        "profit-25":    "var(--color-profit-25)",
        "profit-30":    "var(--color-profit-30)",
        "profit-40":    "var(--color-profit-40)",

        /* Loss */
        loss: "var(--color-loss)",

        /* Destructive (red) + opacity variants */
        destructive:         "var(--color-destructive)",
        "destructive-hover": "var(--color-destructive-hover)",
        "destructive-5":     "var(--color-destructive-5)",
        "destructive-10":    "var(--color-destructive-10)",
        "destructive-15":    "var(--color-destructive-15)",
        "destructive-20":    "var(--color-destructive-20)",
        "destructive-30":    "var(--color-destructive-30)",

        /* Warning (amber) + opacity variants */
        warning:         "var(--color-warning)",
        "warning-hover": "var(--color-warning-hover)",
        "warning-5":     "var(--color-warning-5)",
        "warning-10":    "var(--color-warning-10)",
        "warning-15":    "var(--color-warning-15)",
        "warning-20":    "var(--color-warning-20)",
        "warning-25":    "var(--color-warning-25)",
        "warning-30":    "var(--color-warning-30)",

        /* Accent (violet) + opacity variants */
        accent:       "var(--color-accent)",
        "accent-10":  "var(--color-accent-10)",
        "accent-15":  "var(--color-accent-15)",
        "accent-20":  "var(--color-accent-20)",
        "accent-40":  "var(--color-accent-40)",

        /* Neutral */
        neutral:       "var(--color-neutral)",
        "neutral-15":  "var(--color-neutral-15)",
        "neutral-20":  "var(--color-neutral-20)",

        /* Chart */
        "chart-1": "var(--chart-1)",
        "chart-2": "var(--chart-2)",
        "chart-3": "var(--chart-3)",
        "chart-4": "var(--chart-4)",
        "chart-5": "var(--chart-5)",
        "chart-6": "var(--chart-6)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", ...defaultTheme.fontFamily.sans],
      },
      animation: {
        shimmer: "shimmer 1.5s ease-in-out infinite",
        "fade-in": "fadeIn 0.2s ease-out",
        "slide-down": "slideDown 0.15s ease-out",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
        fadeIn: {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "none" },
        },
        slideDown: {
          from: { opacity: "0", transform: "translateY(-4px)" },
          to: { opacity: "1", transform: "none" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
