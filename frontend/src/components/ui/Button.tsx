import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/cn";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
}

const VARIANT_CLASSES: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "bg-accent-blue text-white hover:bg-blue-500 border-transparent",
  secondary: "bg-surface-raised text-text-primary hover:bg-surface-hover border-border",
  ghost: "bg-transparent text-text-secondary hover:bg-surface-hover hover:text-text-primary border-transparent",
  danger: "bg-transparent text-status-critical hover:bg-status-critical/10 border-transparent",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "secondary", size = "sm", ...props },
  ref
) {
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-3.5 py-2 text-sm",
        VARIANT_CLASSES[variant],
        className
      )}
      {...props}
    />
  );
});
