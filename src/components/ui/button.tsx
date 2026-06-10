import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Material 3 — botões (Filled, Filled tonal, Outlined, Text) com state layers.
const buttonVariants = cva(
  "group/button relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-full border border-transparent text-sm font-medium leading-5 tracking-[0.1px] whitespace-nowrap transition-[background-color,box-shadow,color] outline-none select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[18px]",
  {
    variants: {
      variant: {
        // Filled
        default:
          "bg-primary text-primary-foreground hover:bg-[color-mix(in_srgb,var(--md-on-primary)_8%,var(--md-primary))] hover:shadow-[0_1px_2px_0_rgba(0,0,0,0.3),0_1px_3px_1px_rgba(0,0,0,0.15)] active:bg-[color-mix(in_srgb,var(--md-on-primary)_12%,var(--md-primary))]",
        // Filled tonal
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_srgb,var(--md-on-secondary-container)_8%,var(--md-secondary-container))] hover:shadow-[0_1px_2px_0_rgba(0,0,0,0.3),0_1px_3px_1px_rgba(0,0,0,0.15)] active:bg-[color-mix(in_srgb,var(--md-on-secondary-container)_12%,var(--md-secondary-container))]",
        // Outlined
        outline:
          "border-outline text-primary bg-transparent hover:bg-[color-mix(in_srgb,var(--md-primary)_8%,transparent)] active:bg-[color-mix(in_srgb,var(--md-primary)_12%,transparent)]",
        // Text
        ghost:
          "text-primary bg-transparent hover:bg-[color-mix(in_srgb,var(--md-primary)_8%,transparent)] active:bg-[color-mix(in_srgb,var(--md-primary)_12%,transparent)]",
        // Error / destrutivo
        destructive:
          "bg-destructive text-on-error hover:bg-[color-mix(in_srgb,#ffffff_8%,var(--md-error))] active:bg-[color-mix(in_srgb,#ffffff_12%,var(--md-error))]",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-6 has-[>svg:first-child]:pl-4",
        xs: "h-7 px-3 text-xs",
        sm: "h-9 px-4 text-[0.8rem]",
        lg: "h-12 px-8",
        icon: "size-10 rounded-full",
        "icon-xs": "size-7 rounded-full [&_svg:not([class*='size-'])]:size-4",
        "icon-sm": "size-9 rounded-full",
        "icon-lg": "size-12 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
