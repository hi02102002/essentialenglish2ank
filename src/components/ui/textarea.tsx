import { Field as FieldPrimitive } from '@base-ui/react/field'
import { mergeProps } from '@base-ui/react/merge-props'
import type * as React from 'react'
import { cn } from '@/lib/utils'

export type TextareaProps = React.ComponentPropsWithoutRef<'textarea'> &
  React.RefAttributes<HTMLTextAreaElement> & {
    size?: 'sm' | 'default' | 'lg' | number
    unstyled?: boolean
  }

export function Textarea({
  className,
  size = 'default',
  unstyled = false,
  ref,
  ...props
}: TextareaProps): React.ReactElement {
  return (
    <span
      className={
        cn(
          !unstyled &&
            'relative inline-flex w-full rounded-lg border border-border bg-card/60 backdrop-blur-xs text-sm shadow-xs transition-all focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/25 has-disabled:opacity-50 has-disabled:pointer-events-none',
          className,
        ) || undefined
      }
      data-size={size}
      data-slot="textarea-control"
    >
      <FieldPrimitive.Control
        ref={ref}
        value={props.value}
        defaultValue={props.defaultValue}
        disabled={props.disabled}
        id={props.id}
        name={props.name}
        render={(defaultProps: React.ComponentProps<'textarea'>) => (
          <textarea
            className={cn(
              'field-sizing-content min-h-18 w-full rounded-[inherit] px-3 py-2 text-foreground outline-none placeholder:text-muted-foreground/60 text-sm leading-relaxed resize-y',
              size === 'sm' && 'min-h-14 px-2.5 py-1.5 text-xs',
              size === 'lg' && 'min-h-24 px-3.5 py-2.5 text-base',
            )}
            data-slot="textarea"
            {...mergeProps(defaultProps, props)}
          />
        )}
      />
    </span>
  )
}

export { FieldPrimitive }

