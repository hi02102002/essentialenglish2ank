import { mergeProps } from '@base-ui/react/merge-props'
import { useRender } from '@base-ui/react/use-render'
import { cva, type VariantProps } from 'class-variance-authority'
import type * as React from 'react'
import { cn } from '@/lib/utils'
import { Spinner } from '@/components/ui/spinner'

export const buttonVariants = cva(
  "relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg border font-medium text-base outline-none transition-all before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] pointer-coarse:after:absolute pointer-coarse:after:size-full pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 data-loading:select-none data-loading:text-transparent sm:text-sm [&_svg:not([class*='opacity-'])]:opacity-80 [&_svg:not([class*='size-'])]:size-4.5 sm:[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:-mx-0.5 [&_svg]:shrink-0",
  {
    defaultVariants: {
      size: 'default',
      variant: 'default',
    },
    variants: {
      size: {
        default: 'h-9 px-3.5 sm:h-8 sm:px-3',
        icon: 'size-9 sm:size-8',
        'icon-lg': 'size-10 sm:size-9',
        'icon-sm': 'size-8 sm:size-7',
        'icon-xs': 'size-7 rounded-md sm:size-6',
        lg: 'h-10 px-4 text-base sm:h-9 sm:px-3.5 sm:text-sm',
        sm: 'h-8 gap-1.5 px-2.5 sm:h-7 sm:px-2 text-xs',
        xs: 'h-7 gap-1 rounded-md px-2 text-xs sm:h-6',
      },
      variant: {
        default:
          'border-primary bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 active:scale-[0.98] *:data-[slot=button-loading-indicator]:text-primary-foreground',
        destructive:
          'border-destructive bg-destructive text-white shadow-xs hover:bg-destructive/90 active:scale-[0.98] *:data-[slot=button-loading-indicator]:text-white',
        'destructive-outline':
          'border-border bg-card text-destructive hover:border-destructive/40 hover:bg-destructive/10 active:scale-[0.98]',
        ghost:
          'border-transparent text-foreground hover:bg-accent/70 hover:text-accent-foreground active:scale-[0.98]',
        link: 'border-transparent text-foreground underline-offset-4 hover:underline',
        outline:
          'border-border bg-card text-foreground shadow-xs hover:bg-accent hover:text-accent-foreground active:scale-[0.98]',
        secondary:
          'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80 active:scale-[0.98]',
      },
    },
  },
)

export interface ButtonProps extends useRender.ComponentProps<'button'> {
  variant?: VariantProps<typeof buttonVariants>['variant']
  size?: VariantProps<typeof buttonVariants>['size']
  loading?: boolean
}

export function Button({
  className,
  variant,
  size,
  render,
  children,
  loading = false,
  disabled: disabledProp,
  ...props
}: ButtonProps): React.ReactElement {
  const isDisabled = Boolean(loading || disabledProp)
  const typeValue = render ? undefined : (props.type ?? 'button')

  const defaultProps = {
    children: (
      <>
        {children}
        {loading && (
          <Spinner
            className="pointer-events-none absolute inset-auto"
            data-slot="button-loading-indicator"
          />
        )}
      </>
    ),
    className: cn(buttonVariants({ className, size, variant })),
    'aria-disabled': loading || undefined,
    'data-loading': loading ? '' : undefined,
    'data-slot': 'button',
    disabled: isDisabled,
    type: typeValue,
  }

  return useRender({
    defaultTagName: 'button',
    props: mergeProps<'button'>(defaultProps, props),
    render,
  })
}

