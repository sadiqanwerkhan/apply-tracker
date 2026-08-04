"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const base =
  "inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all " +
  "outline-none focus-visible:ring-4 focus-visible:ring-ring/30 " +
  "active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 select-none";

const variants: Record<Variant, string> = {
  primary:
    "bg-primary text-primary-foreground shadow-sm hover:brightness-110",
  secondary:
    "bg-card text-foreground/80 border border-border hover:bg-secondary hover:text-foreground",
  ghost:
    "bg-transparent text-muted-foreground hover:text-foreground hover:bg-secondary",
  danger:
    "bg-danger-muted text-danger border border-transparent hover:brightness-105",
};

const sizes: Record<Size, string> = {
  sm: "h-9 text-[13px] px-3",
  md: "h-10 text-sm px-4",
  lg: "h-11 text-base px-6",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", loading = false, disabled, children, className = "", ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
        {...props}
      >
        {loading && (
          <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" aria-hidden="true" />
        )}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
export default Button;
