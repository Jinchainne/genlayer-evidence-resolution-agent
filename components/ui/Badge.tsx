import clsx from "clsx";
import type { HTMLAttributes } from "react";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "positive" | "negative";
};

export function Badge({ className, tone = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center border px-2 py-1 text-[10px] uppercase tracking-[0.22em]",
        tone === "neutral" && "border-terminal-border text-terminal-muted",
        tone === "positive" && "border-terminal-positive/40 text-terminal-positive",
        tone === "negative" && "border-terminal-negative/40 text-terminal-negative",
        className
      )}
      {...props}
    />
  );
}
