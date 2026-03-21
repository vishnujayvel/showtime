import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "../lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:
          "border border-input bg-transparent shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost:
          "hover:bg-surface-hover hover:text-txt-primary",
        link:
          "text-accent underline-offset-4 hover:underline",
        primary:
          "w-full py-4 rounded-xl bg-gradient-to-br from-accent to-accent-dark text-white font-bold text-base tracking-wide shadow-[0_0_30px_rgba(217,119,87,0.3),0_4px_20px_rgba(0,0,0,0.4)]",
        accent:
          "px-5 py-2.5 rounded-lg bg-accent/15 text-accent font-medium text-sm border border-accent/30 hover:bg-accent/25",
        beat:
          "px-5 py-2.5 rounded-lg bg-beat/15 text-beat font-medium text-sm border border-beat/30 hover:bg-beat/25",
        "beat-large":
          "w-full py-3.5 rounded-xl bg-gradient-to-br from-beat/20 to-beat/10 text-beat font-semibold text-base border-[1.5px] border-beat/40 shadow-[0_0_20px_rgba(245,158,11,0.1)]",
        neutral:
          "px-4 py-2 rounded-lg bg-surface-hover text-txt-secondary font-mono text-sm border border-border-default",
        ghost_muted:
          "text-txt-muted hover:text-txt-secondary text-sm",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
