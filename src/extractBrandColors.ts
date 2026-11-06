const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
const rgbToHex = (r: number, g: number, b: number) => `#${toHex(r)}${toHex(g)}${toHex(b)}`

const luminance = (r: number, g: number, b: number) => (0.299 * r + 0.587 * g + 0.114 * b) / 255

const ensureReadable = (r: number, g: number, b: number) => {
  const l = luminance(r, g, b)
  if (l <= 0.55) return [r, g, b] as const
  const factor = 0.5 / l
  return [r * factor, g * factor, b * factor] as const
}

const distance = (a: [number, number, number], b: [number, number, number]) =>
  Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2)

export async function extractBrandColors(source: File | Blob): Promise<{ primary: string; secondary: string } | null> {
  try {
    const bitmap = await createImageBitmap(source)
    const size = 48
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(bitmap, 0, 0, size, size)
    const { data } = ctx.getImageData(0, 0, size, size)

    const buckets = new Map<string, { count: number; r: number; g: number; b: number }>()
    for (let i = 0; i < data.length; i += 4) {
      const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]]
      if (a < 200) continue
      if (r > 235 && g > 235 && b > 235) continue
      if (r < 25 && g < 25 && b < 25) continue
      if (Math.max(r, g, b) - Math.min(r, g, b) < 12) continue
      const key = `${Math.round(r / 24)}-${Math.round(g / 24)}-${Math.round(b / 24)}`
      const bucket = buckets.get(key) ?? { count: 0, r: 0, g: 0, b: 0 }
      bucket.count++; bucket.r += r; bucket.g += g; bucket.b += b
      buckets.set(key, bucket)
    }
    if (!buckets.size) return null

    const byCount = [...buckets.values()].sort((a, b) => b.count - a.count).map(b => [b.r / b.count, b.g / b.count, b.b / b.count] as [number, number, number])

    const primaryRgb = byCount[0]
    const secondaryRgb = byCount.slice(1).find(c => distance(c, primaryRgb) > 60)
      ?? (primaryRgb.map(c => c * 0.65) as [number, number, number])

    const [pr, pg, pb] = ensureReadable(...primaryRgb)
    const [sr, sg, sb] = ensureReadable(...secondaryRgb)

    return { primary: rgbToHex(pr, pg, pb), secondary: rgbToHex(sr, sg, sb) }
  } catch {
    return null
  }
}
