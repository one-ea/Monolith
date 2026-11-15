"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Tabs, TabsIndicator, TabsList, TabsTab } from "@/components/ui/tabs"

/**
 * Monolith SegmentedControl（Phase 4，基于 Tabs）
 * Apple 主题呈现 iOS 分段控件质感；Pixel 主题由 pixel.css
 * 将轨道/指示器换为 secondary-container 胶囊组。
 */
export interface SegmentedControlItem {
  value: string
  label: React.ReactNode
  disabled?: boolean
}

function SegmentedControl({
  items,
  value,
  onValueChange,
  defaultValue,
  className,
  size = "md",
  "aria-label": ariaLabel,
}: {
  items: readonly SegmentedControlItem[]
  value?: string
  onValueChange?: (value: string) => void
  defaultValue?: string
  className?: string
  size?: "sm" | "md"
  "aria-label"?: string
}) {
  const height = size === "sm" ? "h-8" : "h-9"
  return (
    <Tabs value={value} onValueChange={onValueChange} defaultValue={defaultValue ?? items[0]?.value}>
      <TabsList className={cn(height, "w-full", className)} aria-label={ariaLabel}>
        <TabsIndicator />
        {items.map((item) => (
          <TabsTab
            key={item.value}
            value={item.value}
            disabled={item.disabled}
            className={size === "sm" ? "h-6 text-xs" : "h-7 text-sm"}
          >
            {item.label}
          </TabsTab>
        ))}
      </TabsList>
    </Tabs>
  )
}

export { SegmentedControl }
