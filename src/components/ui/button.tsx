import * as React from "react";
import { cn } from "../../lib/utils";
import { motion, HTMLMotionProps } from "motion/react";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "glass" | "outline" | "ghost" | "danger";
  size?: "default" | "sm" | "lg" | "icon";
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", asChild = false, ...props }, ref) => {
    
    const variants = {
      default: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_15px_rgba(99,102,241,0.5)] border border-primary/20 hover:border-primary/50 transition-all",
      glass: "bg-white/[0.05] backdrop-blur-md border border-white/10 text-white hover:bg-white/10 shadow-[0_4px_30px_rgba(0,0,0,0.1)] transition-all",
      outline: "border border-white/10 bg-transparent hover:bg-white/5 hover:text-white transition-all",
      ghost: "hover:bg-white/5 hover:text-white transition-all",
      danger: "bg-red-500/90 text-white hover:bg-red-600 shadow-md",
    };

    const sizes = {
      default: "h-10 px-4 py-2",
      sm: "h-9 rounded-md px-3",
      lg: "h-11 rounded-md px-8",
      icon: "h-10 w-10",
    };

    const baseClass = "inline-flex items-center justify-center rounded-lg text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-95 transition-transform duration-200";

    if (asChild) {
      // Very basic implementation, real apps would use Radix Slot
      return (
        <button
          className={cn(baseClass, variants[variant], sizes[size], className)}
          ref={ref}
          {...props}
        />
      )
    }

    return (
      <button
        className={cn(baseClass, variants[variant], sizes[size], className)}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };
