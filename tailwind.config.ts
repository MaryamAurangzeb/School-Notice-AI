import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#16202e",
        paper: "#f5f6f2",
        line: "#d5dae0",
        muted: "#576271",
        brand: { DEFAULT: "#0b6b52", dark: "#08523f", soft: "#e4f1ec" },
      },
      fontFamily: {
        sans: ['"Public Sans"', "system-ui", "sans-serif"],
        serif: ['"Source Serif 4"', "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};
export default config;
