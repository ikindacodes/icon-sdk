import { IconInputError } from './errors.ts'

export type AccessibleName = string & { readonly __brand: 'AccessibleName' }

export type IconUse =
  | { readonly purpose: 'decorative' }
  | { readonly purpose: 'meaningful'; readonly name: AccessibleName }

export type PaintA11y =
  | { readonly purpose: 'decorative'; readonly ariaHidden: 'true' }
  | { readonly purpose: 'meaningful'; readonly role: 'img'; readonly ariaLabel: AccessibleName }

export function accessibleName(raw: string): AccessibleName {
  const name = raw.trim()
  if (name.length === 0) {
    throw new IconInputError('accessible name is empty', 'name')
  }
  return name as AccessibleName
}

export function toPaintA11y(use: IconUse): PaintA11y {
  switch (use.purpose) {
    case 'decorative':
      return { purpose: 'decorative', ariaHidden: 'true' }
    case 'meaningful':
      return { purpose: 'meaningful', role: 'img', ariaLabel: use.name }
    default: {
      const unreachable: never = use
      return unreachable
    }
  }
}
