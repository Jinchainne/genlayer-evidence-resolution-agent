import clsx from "clsx";
import type { InputHTMLAttributes } from "react";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={clsx(
        "w-full border border-terminal-border bg-terminal-panelAlt px-3 py-2 text-sm text-terminal-text outline-none",
        "placeholder:text-terminal-muted focus:border-terminal-accent",
        className
      )}
      {...props}
    />
  );
}
