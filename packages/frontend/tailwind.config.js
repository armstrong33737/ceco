/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // 1. Échelle Neutre Slate (Socle B2B Enterprise)
        slate: {
          50: "#F8FAFC",
          100: "#F1F5F9",
          200: "#E2E8F0",
          300: "#CBD5E1",
          400: "#94A3B8",
          500: "#64748B",
          600: "#475569",
          700: "#334155",
          750: "#243247",
          800: "#1E293B",
          900: "#0F172A",
          950: "#020617",
        },

        // 2. Palette Corporate Blue (EduFlex ERP)
        blue: {
          50: "#EFF6FF",
          100: "#DBEAFE",
          200: "#BFDBFE",
          300: "#93C5FD",
          400: "#60A5FA",
          500: "#3B82F6",
          600: "#2563EB",
          700: "#1D4ED8", // Couleur d'action primaire majeure
          800: "#1E40AF",
          900: "#1E3A8A",
          950: "#172554",
        },

        // 3. Nuances ERP d'Autorité
        erp: {
          50: "#F0F4F8",
          100: "#D9E2EC",
          200: "#BCCADC",
          500: "#102A43",
          600: "#0B69A3",
          700: "#035388",
          800: "#014361",
          900: "#002B49",
        },

        // 4. Sémantique Métier & Conformité
        emerald: {
          50: "#ECFDF5",
          100: "#D1FAE5",
          200: "#A7F3D0",
          300: "#6EE7B7",
          600: "#059669",
          700: "#047857",
          800: "#065F46",
          900: "#064E3B",
        },
        amber: {
          50: "#FFFBEB",
          100: "#FEF3C7",
          200: "#FDE68A",
          300: "#FCD34D",
          600: "#D97706",
          700: "#B45309",
          800: "#92400E",
          900: "#78350F",
        },
        rose: {
          50: "#FFF1F2",
          100: "#FFE4E6",
          200: "#FECDD3",
          300: "#FDA4AF",
          600: "#E11D48",
          700: "#BE123C",
          800: "#9F1239",
          900: "#881337",
        },
      },

      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["IBM Plex Mono", "JetBrains Mono", "Menlo", "Courier New", "monospace"],
      },

      fontSize: {
        "2xs": ["10px", { lineHeight: "14px", letterSpacing: "0.02em" }],
        xs: ["12px", { lineHeight: "16px" }],
        sm: ["13px", { lineHeight: "18px" }],
        base: ["14px", { lineHeight: "20px" }],
        md: ["15px", { lineHeight: "22px" }],
        lg: ["16px", { lineHeight: "24px" }],
        xl: ["18px", { lineHeight: "26px" }],
        "2xl": ["24px", { lineHeight: "30px" }],
      },

      spacing: {
        "sidebar-w": "256px",
        "sidebar-collapsed-w": "64px",
        "header-h": "64px",
      },

      boxShadow: {
        "2xs": "0 1px 2px 0 rgba(15, 23, 42, 0.04)",
        xs: "0 1px 3px 0 rgba(15, 23, 42, 0.08), 0 1px 2px -1px rgba(15, 23, 42, 0.06)",
        sm: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
        card: "0 1px 3px 0 rgba(15, 23, 42, 0.06), 0 1px 2px 0 rgba(15, 23, 42, 0.04)",
        dropdown: "0 10px 15px -3px rgba(15, 23, 42, 0.1), 0 4px 6px -4px rgba(15, 23, 42, 0.08)",
        modal: "0 25px 50px -12px rgba(15, 23, 42, 0.25)",
      },

      borderRadius: {
        DEFAULT: "4px",
        sm: "3px",
        md: "4px",
        lg: "6px",
        xl: "8px",
        "2xl": "12px",
        full: "9999px",
      },
    },
  },
  plugins: [],
};