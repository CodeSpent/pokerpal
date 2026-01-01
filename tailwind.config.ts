import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: "#09090b",
          secondary: "#18181b",
          tertiary: "#27272a",
        },
        foreground: {
          DEFAULT: "#fafafa",
          muted: "#a1a1aa",
        },
        accent: {
          primary: "#10b981",
          secondary: "#6366f1",
        },
        action: {
          fold: "#ef4444",
          call: "#3b82f6",
          raise: "#22c55e",
        },
        card: {
          hearts: "#ef4444",
          diamonds: "#3b82f6",
          clubs: "#22c55e",
          spades: "#a1a1aa",
        },
      },
    },
  },
  plugins: [],
};
export default config;
