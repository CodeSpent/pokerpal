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
        // Surface colors - deep charcoal/near-black for premium feel
        surface: {
          primary: "#0D0D0F",
          secondary: "#141418",
          tertiary: "#1A1A20",
          quaternary: "#222228",
        },
        // Legacy background colors (kept for compatibility)
        background: {
          DEFAULT: "#09090b",
          secondary: "#18181b",
          tertiary: "#27272a",
        },
        // Text hierarchy
        text: {
          primary: "#FAFAFA",
          secondary: "#A1A1AA",
          muted: "#71717A",
          accent: "#C9A962",
        },
        // Legacy foreground (kept for compatibility)
        foreground: {
          DEFAULT: "#fafafa",
          muted: "#a1a1aa",
        },
        // Accent colors - gold for premium highlights
        accent: {
          primary: "#10b981",
          secondary: "#6366f1",
          gold: "#C9A962",
          goldMuted: "#8B7941",
          goldBright: "#E5C578",
        },
        // Action button colors - muted, professional tones
        action: {
          fold: "#7F3D3D",
          foldHover: "#994A4A",
          foldMuted: "#5C2D2D",
          check: "#3D5A80",
          checkHover: "#4A6D96",
          checkMuted: "#2F4662",
          raise: "#4A7C59",
          raiseHover: "#5A946B",
          raiseMuted: "#3A6249",
          allIn: "#B8860B",
        },
        // Card suit colors
        card: {
          hearts: "#EF4444",
          diamonds: "#3B82F6",
          clubs: "#22C55E",
          spades: "#1E293B", // Dark slate for visibility on white card background
        },
      },
    },
  },
  plugins: [],
};
export default config;
