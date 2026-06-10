import type { Config } from "tailwindcss";
import styleGuide from "./resources/style-guide.json";

const theme = styleGuide.theme;

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        app: theme.colors.app,
        canvas: theme.colors.canvas,
        panel: theme.colors.panel,
        "panel-raised": theme.colors.panelRaised,
        control: theme.colors.control,
        "control-hover": theme.colors.controlHover,
        inverse: theme.colors.inverse,
        "border-subtle": theme.colors.borderSubtle,
        "border-default": theme.colors.borderDefault,
        "border-strong": theme.colors.borderStrong,
        "text-primary": theme.colors.textPrimary,
        "text-secondary": theme.colors.textSecondary,
        "text-muted": theme.colors.textMuted,
        "text-inverse": theme.colors.textInverse,
        accent: theme.colors.accent,
        "accent-strong": theme.colors.accentStrong,
        success: theme.colors.success,
        warning: theme.colors.warning,
        danger: theme.colors.danger,
        new: theme.colors.new,
      },
      borderRadius: {
        xs: theme.radius.xs,
        sm: theme.radius.sm,
        md: theme.radius.md,
        lg: theme.radius.lg,
        xl: theme.radius.xl,
        pill: theme.radius.pill,
      },
      boxShadow: {
        panel: theme.shadow.panel,
        floating: theme.shadow.floating,
        selected: theme.shadow.selected,
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "\"Segoe UI\"",
          "\"Microsoft YaHei\"",
          "\"PingFang SC\"",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
} satisfies Config;
