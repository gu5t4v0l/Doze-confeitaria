"use client"

import { Switch as SwitchPrimitive } from "@base-ui/react/switch"
import { cn } from "@/lib/utils"

/** Interruptor grande (alvo de toque >= 44px de largura) no tema da marca. */
function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "relative inline-flex h-8 w-14 shrink-0 cursor-pointer items-center rounded-full border-2 border-choc/50 bg-sage-light transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 data-checked:border-choc data-checked:bg-choc data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block size-6 translate-x-0.5 rounded-full bg-choc shadow transition-transform data-checked:translate-x-[1.625rem] data-checked:bg-cream"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
