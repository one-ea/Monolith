"use client"

import * as React from "react"
import { Popover as PopoverPrimitive } from "@base-ui/react/popover"
import { XIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Monolith Popover（Phase 4）
 * 行为层复用 Base UI（点击外关闭 / 焦点归还 / 定位）。
 */
function Popover({ ...props }: PopoverPrimitive.Root.Props) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />
}

function PopoverTrigger({ ...props }: PopoverPrimitive.Trigger.Props) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />
}

function PopoverContent({
  className,
  children,
  align = "center",
  sideOffset = 8,
  showCloseButton = false,
  ...props
}: PopoverPrimitive.Popup.Props & {
  align?: "start" | "center" | "end"
  sideOffset?: number
  showCloseButton?: boolean
}) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner align={align} sideOffset={sideOffset} className="z-50">
        <PopoverPrimitive.Popup
          data-slot="popover-content"
          className={cn(
            "relative w-72 origin-[var(--popover-origin,center)] rounded-lg border border-border/40 bg-popover p-4 text-popover-foreground shadow-e3 outline-none transition-[opacity,transform,scale] duration-(--motion-normal) ease-(--ease-emphasized) data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0",
            className
          )}
          {...props}
        >
          {children}
          {showCloseButton && (
            <PopoverPrimitive.Close
              data-slot="popover-close"
              className="absolute top-3 right-3 text-muted-foreground/60 transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-focus-ring"
              aria-label="关闭"
            >
              <XIcon className="size-4" />
            </PopoverPrimitive.Close>
          )}
        </PopoverPrimitive.Popup>
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  )
}

function PopoverTitle({ className, ...props }: PopoverPrimitive.Title.Props) {
  return (
    <PopoverPrimitive.Title
      data-slot="popover-title"
      className={cn("font-heading text-title-sm font-semibold text-foreground", className)}
      {...props}
    />
  )
}

function PopoverDescription({ className, ...props }: PopoverPrimitive.Description.Props) {
  return (
    <PopoverPrimitive.Description
      data-slot="popover-description"
      className={cn("text-caption text-muted-foreground", className)}
      {...props}
    />
  )
}

export { Popover, PopoverTrigger, PopoverContent, PopoverTitle, PopoverDescription }
