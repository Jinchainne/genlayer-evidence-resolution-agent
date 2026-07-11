import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        terminal: {
          bg: "var(--bg)",
          panel: "var(--panel)",
          panelAlt: "var(--panel-alt)",
          border: "var(--border)",
          text: "var(--text)",
          muted: "var(--muted)",
          positive: "var(--positive)",
          negative: "var(--negative)",
          neutral: "var(--neutral)",
          accent: "var(--accent)"
        }
      },
      boxShadow: {
        terminal: "0 0 0 1px rgba(197, 221, 191, 0.14), 0 10px 40px rgba(0, 0, 0, 0.22)"
      },
      backgroundImage: {
        grid: "linear-gradient(rgba(197,221,191,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(197,221,191,0.04) 1px, transparent 1px)"
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "Liberation Mono", "monospace"]
      },
      keyframes: {
        pulseLine: {
          "0%, 100%": { opacity: "0.55" },
          "50%": { opacity: "1" }
        },
        riseIn: {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" }
        }
      },
      animation: {
        pulseLine: "pulseLine 1.8s ease-in-out infinite",
        riseIn: "riseIn 0.45s ease forwards"
      }
    }
  },
  plugins: []
};

export default config;
