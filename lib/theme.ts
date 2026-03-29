export function getThemeColor(name: string): string {
  if (typeof window === 'undefined') return ''

  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}
