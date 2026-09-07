import { Input as InputPrimitive } from '@base-ui/react/input'
import type * as React from 'react'
import { cn } from '@/lib/utils'

export type InputProps = Omit<
  InputPrimitive.Props & React.RefAttributes<HTMLInputElement>,
  'size'
> & {
  size?: 'sm' | 'default' | 'lg' | number
  unstyled?: boolean
  nativeInput?: boolean
}

export function Input({
  className,
  size = 'default',
  unstyled = false,
  nativeInput = false,
  style,
  ...props
}: InputProps): React.ReactElement {
  const inputClassName = cn(
    'h-9 w-full min-w-0 rounded-[inherit] px-3 text-foreground leading-9 outline-none placeholder:text-muted-foreground/60 sm:h-8 sm:leading-8 text-sm',
    size === 'sm' && 'h-7.5 px-2.5 leading-7.5 sm:h-7 sm:leading-7 text-xs',
    size === 'lg' && 'h-11 leading-11 sm:h-10 sm:leading-10 text-base',
    props.type === 'search' &&
      '[&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none',
  )

  return (
    <span
      className={
        cn(
          !unstyled &&
            'relative inline-flex w-full items-center rounded-lg border border-border bg-card/60 backdrop-blur-xs shadow-xs transition-all focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/25 has-disabled:opacity-50 has-disabled:pointer-events-none',
          className,
        ) || undefined
      }
      data-size={size}
      data-slot="input-control"
    >
      {nativeInput ? (
        <input
          className={inputClassName}
          data-slot="input"
          size={typeof size === 'number' ? size : undefined}
          style={typeof style === 'function' ? undefined : style}
          {...props}
        />
      ) : (
        <InputPrimitive
          className={inputClassName}
          data-slot="input"
          size={typeof size === 'number' ? size : undefined}
          style={style}
          {...props}
        />
      )}
    </span>
  )
}

export { InputPrimitive }

