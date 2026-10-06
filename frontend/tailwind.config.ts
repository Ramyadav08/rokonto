import type { Config } from "tailwindcss";

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
        background: "var(--background)",
        foreground: "var(--foreground)",
        surface: {
          DEFAULT: "#0f131a",
          raised: "#141922",
          hover: "#1a2029",
        },
        border: {
          DEFAULT: "#232a35",
          subtle: "#1a2029",
        },
        text: {
          primary: "#e6e9ef",
          secondary: "#9aa4b2",
          muted: "#6b7280",
        },
        accent: {
          blue: "#3b82f6",
          purple: "#8b5cf6",
        },
        status: {
          healthy: "#22c55e",
          warning: "#eab308",
          critical: "#ef4444",
          info: "#3b82f6",
          unknown: "#6b7280",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      fontSize: {
        xs: ["0.75rem", { lineHeight: "1rem" }],
        sm: ["0.8125rem", { lineHeight: "1.125rem" }],
      },
      boxShadow: {
        panel: "0 1px 2px 0 rgb(0 0 0 / 0.4)",
      },
    },
  },
  plugins: [],
};
export default config;
