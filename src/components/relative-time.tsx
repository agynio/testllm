"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type RelativeTimeProps = {
  value: string | Date;
  className?: string;
};

const units: Array<{ unit: Intl.RelativeTimeFormatUnit; ms: number }> = [
  { unit: "year", ms: 1000 * 60 * 60 * 24 * 365 },
  { unit: "month", ms: 1000 * 60 * 60 * 24 * 30 },
  { unit: "day", ms: 1000 * 60 * 60 * 24 },
  { unit: "hour", ms: 1000 * 60 * 60 },
  { unit: "minute", ms: 1000 * 60 },
];

function formatRelative(date: Date) {
  const now = Date.now();
  const diff = date.getTime() - now;
  const abs = Math.abs(diff);
  if (abs < 1000 * 30) return "just now";

  const match = units.find((unit) => abs >= unit.ms) ?? units.at(-1);
  if (!match) return "just now";

  const value = Math.round(diff / match.ms);
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  return formatter.format(value, match.unit);
}

export function RelativeTime({ value, className }: RelativeTimeProps) {
  const date = React.useMemo(
    () => (typeof value === "string" ? new Date(value) : value),
    [value]
  );
  const [label, setLabel] = React.useState(() => formatRelative(date));

  React.useEffect(() => {
    setLabel(formatRelative(date));
  }, [date]);

  return (
    <time
      className={cn("text-sm text-muted-foreground", className)}
      dateTime={date.toISOString()}
      title={date.toLocaleString()}
      suppressHydrationWarning
    >
      {label}
    </time>
  );
}
