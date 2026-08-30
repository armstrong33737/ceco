/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // --- 04. COULEUR DE MARQUE : NAVY CECO ---
        brand: {
          900: "#071A2E", // Signature CECO
          800: "#0B2742",
          700: "#123B5D",
          600: "#18527A",
          500: "#216D9E",
        },

        // --- 05 & 06. SURFACES & CANVAS (LIGHT & DARK) ---
        canvas: {
          light: "#F5F7FA",
          dark: "#07111D",
          DEFAULT: "var(--color-bg)",
        },
        surface: {
          light: "#FFFFFF",
          "elevated-light": "#FFFFFF",
          dark: "#0D1B2A",
          "elevated-dark": "#13263A",
          DEFAULT: "var(--color-surface)",
        },
        ink: {
          primary: {
            light: "#0B1C30",
            dark: "#F3F7FA",
            DEFAULT: "var(--color-text-primary)",
          },
          secondary: {
            light: "#526173",
            dark: "#B5C1CE",
            DEFAULT: "var(--color-text-secondary)",
          },
          muted: {
            light: "#738195",
            dark: "#8190A0",
            DEFAULT: "var(--color-text-muted)",
          },
        },
        border: {
          light: "#D9E0E8",
          "strong-light": "#B9C4D1",
          dark: "#24384B",
          "strong-dark": "#355067",
          DEFAULT: "var(--color-border)",
        },

        // --- 07. COULEURS SÉMANTIQUES (WCAG 2.2 AA) ---
        success: {
          DEFAULT: "#16805A",
          subtle: "#E8F6F0",
          dark: "#10B981",
          "subtle-dark": "#064E3B",
        },
        error: {
          DEFAULT: "#C73B3B",
          subtle: "#FDECEC",
          dark: "#EF4444",
          "subtle-dark": "#7F1D1D",
        },
        warning: {
          DEFAULT: "#B7791F",
          subtle: "#FFF6DE",
          dark: "#F59E0B",
          "subtle-dark": "#78350F",
        },
        info: {
          DEFAULT: "#216D9E",
          subtle: "#EAF3F9",
          dark: "#38BDF8",
          "subtle-dark": "#0C4A6E",
        },

        // Alias de compatibilité ascendante pour fluidifier la transition
        primary: {
          DEFAULT: "#071A2E",
          hover: "#0B2742",
          active: "#051321",
          light: "#EAF3F9",
          dark: "#0B2742",
          container: "#0B2742",
        },
        "on-primary": "#FFFFFF",
        "outline-variant": "var(--color-border)",
        "on-surface": "var(--color-text-primary)",
        "on-surface-variant": "var(--color-text-secondary)",
        "surface-container-lowest": "var(--color-surface)",
        "surface-container": "var(--color-surface-elevated)",
      },

      // --- 09. TYPOGRAPHIES OFFICIELLES ---
      fontFamily: {
        display: ["Sora", "sans-serif"],
        heading: ["Sora", "sans-serif"],
        sans: ["IBM Plex Sans", "sans-serif"],
        body: ["IBM Plex Sans", "sans-serif"],
        mono: ["IBM Plex Mono", "monospace"],
      },

      // --- 10. ÉCHELLE TYPOGRAPHIQUE ---
      fontSize: {
        overline: ["11px", { lineHeight: "16px", fontWeight: "600" }],
        caption: ["12px", { lineHeight: "16px", fontWeight: "400" }],
        "body-sm": ["13px", { lineHeight: "18px", fontWeight: "400" }],
        body: ["14px", { lineHeight: "20px", fontWeight: "400" }],
        "body-md": ["14px", { lineHeight: "20px", fontWeight: "500" }],
        "body-lg": ["16px", { lineHeight: "24px", fontWeight: "400" }],
        h4: ["18px", { lineHeight: "24px", fontWeight: "600" }],
        h3: ["22px", { lineHeight: "28px", fontWeight: "600" }],
        h2: ["28px", { lineHeight: "36px", fontWeight: "650" }],
        h1: ["36px", { lineHeight: "44px", fontWeight: "650" }],
      },

      // --- 18. GÉOMÉTRIE SHARP ENTERPRISE (RADIUS 4px STANDARD) ---
      borderRadius: {
        none: "0px",
        compact: "2px",
        sm: "2px",
        DEFAULT: "4px",
        md: "4px",
        lg: "6px",
        exceptional: "6px",
        full: "9999px",
      },

      // --- 17. SYSTÈME D'ESPACEMENT (8px / MICRO 4px) & DIMENSIONS LAYOUT ---
      spacing: {
        "space-1": "4px",
        "space-2": "8px",
        "space-3": "12px",
        "space-4": "16px",
        "space-5": "20px",
        "space-6": "24px",
        "space-8": "32px",
        "space-10": "40px",
        "space-12": "48px",
        "space-16": "64px",
        sidebar: "248px",
        "sidebar-width": "248px",
        topbar: "64px",
        "content-x": "32px",
        "content-y": "24px",
      },

      // --- 20. OMBRES FONCTIONNELLES (BORDER-FIRST) ---
      boxShadow: {
        none: "none",
        xs: "0 1px 2px 0 rgba(7, 26, 46, 0.05)",
        sm: "0 2px 4px 0 rgba(7, 26, 46, 0.06)",
        md: "0 4px 12px -2px rgba(7, 26, 46, 0.08)",
        modal: "0 16px 36px -4px rgba(7, 26, 46, 0.22)",
      },

      // --- 46. MOTION DESIGN INSTANT ENTERPRISE (100–120ms) ---
      transitionDuration: {
        DEFAULT: "100ms",
        instant: "100ms",
        panel: "160ms",
      },
    },
  },
  plugins: [],
};