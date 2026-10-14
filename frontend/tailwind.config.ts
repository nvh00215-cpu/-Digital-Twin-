import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        app: "var(--bg-app)",
        frame: "var(--bg-frame)",
        surface: "var(--bg-surface)",
        raised: "var(--bg-raised)",
        ink: "var(--text-primary)",
        secondary: "var(--text-secondary)",
        muted: "var(--text-muted)",
        accent: "var(--accent)",
        "on-accent": "var(--text-on-accent)",
        danger: "var(--status-danger)",
        warning: "var(--status-warning)",
        success: "var(--status-success)",
        info: "var(--status-info)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        panel: "var(--shadow-panel)",
        floating: "var(--shadow-floating)",
      },
      borderRadius: {
        panel: "28px",
      },
    },
  },
  plugins: [],
};

export default config;
