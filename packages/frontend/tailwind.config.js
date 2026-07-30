/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        encre: "#1B2A44",
        papier: "#EFEBE2",
        ocre: "#B8873A",
        sauge: "#2F6F5E",
        brique: "#9A3E2B",
        anthracite: "#2B2823",
      },
      fontFamily: {
        display: ["Fraunces", "serif"],
        sans: ["IBM Plex Sans", "sans-serif"],
        mono: ["IBM Plex Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
