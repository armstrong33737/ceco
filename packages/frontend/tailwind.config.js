/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0B1C30",
        paper: "#F8F9FF",

        // Accent inspiré Argon Design System (indigo/violet en gradient)
        // — appliqué avec parcimonie, la base reste blanc/noir neutre.
        primary: "#5E72E4",
        "primary-container": "#4C58C4", // alias : hover/état pressé
        "primary-dark": "#4C58C4",
        "primary-light": "#EEF1FD",
        "on-primary": "#FFFFFF",
        "on-primary-container": "#EEF1FD",
        violet: "#825EE4", // second point du gradient Argon

        success: "#2DCE89",
        "success-light": "#E6FAF1",
        info: "#11CDEF",

        danger: "#F5365C",
        error: "#F5365C",             // alias
        "on-error": "#FFFFFF",        // alias
        "error-container": "#FEEBEF", // alias

        "on-surface": "#0B1C30",
        "on-surface-variant": "#43474F",
        "outline-variant": "#C3C6D1",

        surface: "#F8F9FF",
        "surface-container-lowest": "#FFFFFF",
        "surface-container-low": "#EFF4FF",
        "surface-container": "#E5EEFF",
        "surface-container-high": "#DCE9FF",
        "surface-container-highest": "#D3E4FE",
      },
      fontFamily: {
        sans: ["Inter", "IBM Plex Sans", "sans-serif"],
        mono: ["IBM Plex Mono", "monospace"],
      },
      spacing: {
        xs: "8px",
        sm: "16px",
        md: "24px",
        lg: "32px",
        xl: "48px",
        "sidebar-width": "260px",
      },
    },
  },
  plugins: [],
};