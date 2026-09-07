import { Checkbox as CheckboxPrimitive } from '@base-ui/react/checkbox'
import type React from 'react'
import { cn } from '@/lib/utils'

export function Checkbox({
  className,
  ...props
}: CheckboxPrimitive.Root.Props): React.ReactElement {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        'relative inline-flex size-4.5 shrink-0 items-center justify-center rounded border border-border bg-card/80 shadow-xs outline-none transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background data-disabled:cursor-not-allowed data-disabled:opacity-50 sm:size-4 data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground cursor-pointer',
        className,
      )}
      data-slot="checkbox"
      {...props}
    >
      <CheckboxPrimitive.Indicator
        className="flex items-center justify-center text-primary-foreground data-unchecked:hidden"
        data-slot="checkbox-indicator"
        render={(
          props: React.ComponentProps<'span'>,
        ) => (
          <span {...props}>
            <svg
              aria-hidden="true"
              className="size-3"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.5"
              viewBox="0 0 24 24"
            >
              <path d="M4.5 12.5l4.5 4.5L19.5 6.5" />
            </svg>
          </span>
        )}
      />
    </CheckboxPrimitive.Root>
  )
}

export { CheckboxPrimitive }

