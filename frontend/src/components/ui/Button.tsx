"use client";

import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
};

export function Button({
  className,
  variant = "secondary",
  disabled,
  ...props
}: Props) {
  const base =
    "inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium transition-[transform,background-color,box-shadow] duration-200 ease-expo focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background-base disabled:pointer-events-none disabled:opacity-40";

  const variants: Record<Variant, string> = {
    primary:
      "bg-accent text-white shadow-accent-glow hover:bg-accent-bright active:scale-[0.98]",
    secondary:
      "bg-white/[0.05] text-foreground shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)] hover:bg-white/[0.08] active:scale-[0.98]",
    ghost:
      "bg-transparent text-foreground-muted hover:bg-white/[0.05] hover:text-foreground active:scale-[0.98]",
  };

  return (
    <button
      type="button"
      className={cn(base, variants[variant], className)}
      disabled={disabled}
      {...props}
    />
  );
}
