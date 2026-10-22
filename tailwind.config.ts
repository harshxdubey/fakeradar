import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", '"SF Pro Display"', '"SF Pro Text"', "Inter", '"Segoe UI"', "Roboto", "sans-serif"],
      },
      colors: {
        accent: { DEFAULT: "#4f46e5", soft: "#eef2ff", ink: "#3730a3" },
        ink: { DEFAULT: "#1d1d1f", soft: "#6e6e73", faint: "#86868b" },
        canvas: "#fbfbfd",
        fake: { DEFAULT: "#e2512b", soft: "#fff1ec" },
      },
      boxShadow: {
        soft: "0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)",
        lift: "0 2px 4px rgba(0,0,0,0.04), 0 18px 48px rgba(0,0,0,0.10)",
      },
      keyframes: {
        sweep: { to: { transform: "rotate(360deg)" } },
        blip: {
          "0%, 100%": { transform: "scale(1)", opacity: "1" },
          "50%": { transform: "scale(1.35)", opacity: "0.65" },
        },
        ripple: {
          "0%": { transform: "scale(0.6)", opacity: "0.55" },
          "100%": { transform: "scale(2.6)", opacity: "0" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(24px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
      },
      animation: {
        sweep: "sweep 4s linear infinite",
        blip: "blip 2.4s ease-in-out infinite",
        ripple: "ripple 2.4s ease-out infinite",
        "fade-up": "fade-up 0.9s cubic-bezier(0.22, 1, 0.36, 1) both",
        float: "float 6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
