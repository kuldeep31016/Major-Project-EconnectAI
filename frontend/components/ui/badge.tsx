import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-wide whitespace-nowrap transition-colors [&_svg]:size-3",
  {
    variants: {
      variant: {
        default: "border-[#15803d]/25 bg-[#15803d]/12 text-[#15803d]",
        secondary: "border-foreground/10 bg-foreground/[0.06] text-muted-foreground",
        outline: "border-foreground/12 text-foreground",
        success: "border-[#22c55e]/25 bg-[#22c55e]/12 text-[#22c55e]",
        warning: "border-[#f59e0b]/25 bg-[#f59e0b]/12 text-[#f59e0b]",
        danger: "border-[#ef4444]/25 bg-[#ef4444]/12 text-[#ef4444]",
        sky: "border-[#1e5f8a]/25 bg-[#1e5f8a]/12 text-[#1e5f8a]",
        violet: "border-[#6d5bd0]/25 bg-[#6d5bd0]/12 text-[#6d5bd0]",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
