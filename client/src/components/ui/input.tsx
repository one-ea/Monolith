"use client"

import * as React from "react"
import { Field as FieldPrimitive } from "@base-ui/react/field"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { cva } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Monolith Input / Textarea（Phase 4）
 * 视觉全部来自语义 token；focus 态使用 focus-ring 角色，
 * 圆角/边框强度随 data-theme 自动变化。
 */
const inputVariants = cva(
  "flex w-full min-w-0 rounded-lg border border-input bg-background/50 px-3 text-foreground text-sm shadow-xs outline-none transition-[border-color,background-color,box-shadow] duration-(--motion-fast) ease-(--ease-standard) placeholder:text-muted-foreground/60 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-error aria-invalid:ring-[3px] aria-invalid:ring-error/25 focus-visible:border-focus-ring focus-visible:bg-background/80 focus-visible:ring-[3px] focus-visible:ring-focus-ring/35"
)

function Input({
  className,
  type,
  ...props
}: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(inputVariants(), "h-9", className)}
      {...props}
    />
  )
}

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(inputVariants(), "min-h-20 py-2 field-sizing-content", className)}
      {...props}
    />
  )
}

/** Base UI Field 包装：label / description / error 的无障碍关联开箱即用 */
function Field({ className, ...props }: FieldPrimitive.Root.Props) {
  return <FieldPrimitive.Root data-slot="field" className={cn("flex flex-col gap-1.5", className)} {...props} />
}

function FieldLabel({ className, ...props }: FieldPrimitive.Label.Props) {
  return (
    <FieldPrimitive.Label
      data-slot="field-label"
      className={cn("text-label-md text-foreground-secondary select-none", className)}
      {...props}
    />
  )
}

function FieldDescription({ className, ...props }: FieldPrimitive.Description.Props) {
  return (
    <FieldPrimitive.Description
      data-slot="field-description"
      className={cn("text-caption text-muted-foreground", className)}
      {...props}
    />
  )
}

function FieldError({ className, ...props }: FieldPrimitive.Error.Props) {
  return (
    <FieldPrimitive.Error
      data-slot="field-error"
      className={cn("text-caption text-error", className)}
      {...props}
    />
  )
}

/** 受控输入（Base UI Input）：值变化时去除首尾空格的能力由调用方决定 */
function FieldInput(props: InputPrimitive.Props) {
  return <InputPrimitive data-slot="field-input" className={inputVariants()} {...props} />
}

export { Input, Textarea, inputVariants, Field, FieldLabel, FieldDescription, FieldError, FieldInput }
