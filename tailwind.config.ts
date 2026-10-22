import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        accent: { DEFAULT: "#4f46e5", soft: "#eef2ff", ink: "#3730a3" },
      },
    },
  },
  plugins: [],
} satisfies Config;
