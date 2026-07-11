"use client";

import type { ButtonHTMLAttributes } from "react";

import clsx from "clsx";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger";
};

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center border px-3 py-2 text-xs uppercase tracking-[0.2em] transition",
        "disabled:cursor-not-allowed disabled:opacity-40",
        variant === "primary" &&
          "border-terminal-border bg-terminal-panelAlt text-terminal-text hover:bg-[#e7ddc1]",
        variant === "ghost" && "border-terminal-border bg-transparent text-terminal-muted hover:text-terminal-text",
        variant === "danger" && "border-terminal-negative bg-[#f3ddd8] text-terminal-negative hover:bg-[#efd0ca]",
        className
      )}
      {...props}
    />
  );
}
