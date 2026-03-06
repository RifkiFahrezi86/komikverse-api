/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        base: {
          dark: "#0f172a",
          bg: "#1e293b",
          card: "#334155",
          white: "#f8fafc",
        },
        primary: {
          400: "#22d3ee",
          500: "#06b6d4",
          600: "#0891b2",
        },
        general: {
          300: "#94a3b8",
        },
      },
    },
  },
  plugins: [],
};
