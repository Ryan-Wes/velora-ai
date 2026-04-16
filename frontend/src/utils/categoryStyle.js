export function getCategoryDisplayColor(baseColor, alpha = 0.2) {
  if (!baseColor) return 'rgba(113,113,122,0.15)'

  const r = parseInt(baseColor.slice(1, 3), 16)
  const g = parseInt(baseColor.slice(3, 5), 16)
  const b = parseInt(baseColor.slice(5, 7), 16)

  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}