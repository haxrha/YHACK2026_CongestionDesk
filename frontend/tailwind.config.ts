import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        background: {
          deep: "var(--color-bg-deep)",
          base: "var(--color-bg-base)",
          elevated: "var(--color-bg-elevated)",
        },
        surface: {
          DEFAULT: "var(--color-surface)",
          hover: "var(--color-surface-hover)",
        },
        foreground: {
          DEFAULT: "var(--color-fg)",
          muted: "var(--color-fg-muted)",
          subtle: "var(--color-fg-subtle)",
        },
        accent: {
          DEFAULT: "var(--color-accent)",
          bright: "var(--color-accent-bright)",
          glow: "var(--color-accent-glow)",
        },
        border: {
          DEFAULT: "var(--color-border)",
          hover: "var(--color-border-hover)",
          accent: "var(--color-border-accent)",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        card: "var(--shadow-card)",
        "card-hover": "var(--shadow-card-hover)",
        "accent-glow": "var(--shadow-accent)",
      },
      transitionTimingFunction: {
        expo: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
      animation: {
        float: "float 9s ease-in-out infinite",
        "float-slow": "float 11s ease-in-out infinite reverse",
        "float-delay": "float 10s ease-in-out 2s infinite",
        shimmer: "shimmer 4s ease-in-out infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0) rotate(0deg)" },
          "50%": { transform: "translateY(-20px) rotate(1deg)" },
        },
        shimmer: {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
      },
    },
  },
  plugins: [
    function motionReduce({ addVariant }: { addVariant: (name: string, def: string) => void }) {
      addVariant("motion-reduce", "@media (prefers-reduced-motion: reduce)");
      addVariant("motion-safe", "@media (prefers-reduced-motion: no-preference)");
    },
  ],
};

export default config;
