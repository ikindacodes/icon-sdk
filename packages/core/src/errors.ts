export class IconInputError extends Error {
  readonly at?: string

  constructor(message: string, at?: string) {
    super(message)
    this.name = 'IconInputError'
    this.at = at
  }
}
