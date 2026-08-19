/** Concorda un numero variabile con il sostantivo singolare o plurale corretto. */
export function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`
}
