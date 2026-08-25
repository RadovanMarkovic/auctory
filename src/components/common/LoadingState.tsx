import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export interface LoadingStateProps {
  label?: string;
  variant?: "spinner" | "cards";
  count?: number;
  className?: string;
}

export function LoadingState({
  label = "Loading",
  variant = "spinner",
  count = 3,
  className,
}: LoadingStateProps) {
  if (variant === "cards") {
    return (
      <div
        className={cn("grid gap-6 sm:grid-cols-2 lg:grid-cols-3", className)}
        role="status"
        aria-label={label}
      >
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="space-y-4 rounded-lg border border-border bg-card p-5">
            <Skeleton className="aspect-4/3 w-full rounded-md" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn("flex flex-col items-center justify-center gap-3 py-16", className)}
      role="status"
      aria-label={label}
    >
      <Loader2 className="size-5 animate-spin text-gold" aria-hidden="true" />
      <p className="eyebrow">{label}</p>
    </div>
  );
}
