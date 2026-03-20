"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CopyButtonProps = {
  value: string;
  label?: string;
  showLabel?: boolean;
  className?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
};

export function CopyButton({
  value,
  label = "Copy",
  showLabel = false,
  className,
  variant = "outline",
  size = "sm",
}: CopyButtonProps) {
  const [hasCopied, setHasCopied] = React.useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setHasCopied(true);
      toast.success("Copied to clipboard");
      window.setTimeout(() => setHasCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={cn("gap-2", className)}
      onClick={handleCopy}
    >
      {hasCopied ? (
        <Check className="size-4" />
      ) : (
        <Copy className="size-4" />
      )}
      {showLabel ? <span className="text-xs">{label}</span> : null}
      <span className="sr-only">{label}</span>
    </Button>
  );
}
