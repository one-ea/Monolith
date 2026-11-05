"use client"

import * as React from "react"
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip"

import { cn } from "@/lib/utils"

/**
 * Monolith Tooltip（Phase 4）
 * 便捷 API：<Tooltip content="说明">…trigger…</Tooltip>
 * （Base UI 模式：Portal 嵌套在 Trigger 内部）
 */
function TooltipProvider({ delay = 200, ...props }: TooltipPrimitive.Provider.Props) {
  return <TooltipPrimitive.Provider data-slot="tooltip-provider" delay={delay} {...props} />
}

function TooltipRoot({ ...props }: TooltipPrimitive.Root.Props) {
  return <TooltipPrimitive.Root data-slot="tooltip-root" {...props} />
}

function TooltipTrigger({ ...props }: TooltipPrimitive.Trigger.Props) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

function Tooltip({
  content,
  children,
  side = "top",
  align = "center",
  sideOffset = 6,
  className,
  ...props
}: TooltipPrimitive.Root.Props & {
  content: React.ReactNode
  children: React.ReactNode
  side?: "top" | "bottom" | "left" | "right"
  align?: "start" | "center" | "end"
  sideOffset?: number
  className?: string
}) {
  return (
    <TooltipRoot {...props}>
      <TooltipTrigger>
        {children}
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Positioner sideOffset={sideOffset} side={side} align={align} className="z-50">
            <TooltipPrimitive.Popup
              data-slot="tooltip-popup"
              className={cn(
                "max-w-64 rounded-md bg-foreground px-2.5 py-1.5 text-xs font-medium text-background shadow-e2",
                className
              )}
            >
              {content}
            </TooltipPrimitive.Popup>
          </TooltipPrimitive.Positioner>
        </TooltipPrimitive.Portal>
      </TooltipTrigger>
    </TooltipRoot>
  )
}

export { Tooltip, TooltipProvider, TooltipRoot, TooltipTrigger }
