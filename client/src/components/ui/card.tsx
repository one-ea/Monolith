import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Monolith Card（Phase 4）
 * surface 层级经 variant 表达：default 卡面 / elevated 浮层卡 / tonal 容器卡。
 * 主题差异（Apple 中性卡面 vs Pixel container 层级）由 token 驱动。
 */
const cardVariants = cva(
  "rounded-xl border text-card-foreground transition-colors duration-(--motion-fast) ease-(--ease-standard)",
  {
    variants: {
      variant: {
        default: "border-border/25 bg-card shadow-e1",
        elevated: "border-border/30 bg-surface-elevated shadow-e2",
        tonal: "border-transparent bg-surface-container shadow-none",
        outline: "border-border/40 bg-transparent shadow-none",
        interactive:
          "border-border/25 bg-card shadow-e1 hover:-translate-y-[2px] hover:border-border/55 hover:shadow-e2 card-hover",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Card({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof cardVariants>) {
  return (
    <div
      data-slot="card"
      data-variant={variant}
      className={cn(cardVariants({ variant }), className)}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn("flex flex-col gap-1.5 p-5", className)}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn("font-heading text-title-md font-semibold leading-none", className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-caption text-muted-foreground", className)}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-content" className={cn("p-5 pt-0", className)} {...props} />
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center p-5 pt-0", className)}
      {...props}
    />
  )
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, cardVariants }
