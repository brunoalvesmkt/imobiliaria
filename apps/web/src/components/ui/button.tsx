"use client";

import type { ButtonHTMLAttributes } from "react";
import { forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-brand-500 text-white hover:bg-brand-600 disabled:bg-brand-300",
  secondary: "bg-surface text-ink border border-line hover:bg-surface-alt disabled:opacity-50",
  ghost: "bg-transparent text-ink-dim hover:bg-surface-muted disabled:opacity-50",
  danger: "bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300",
};

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean }>(
  ({ variant = "primary", loading = false, disabled, className = "", children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed ${VARIANT_CLASSES[variant]} ${className}`}
        {...props}
      >
        {loading && (
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
        )}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";
