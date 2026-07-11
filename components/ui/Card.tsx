import clsx from "clsx";
import type { HTMLAttributes } from "react";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        "border border-terminal-border bg-terminal-panel shadow-terminal",
        "animate-riseIn",
        className
      )}
      {...props}
    />
  );
}
