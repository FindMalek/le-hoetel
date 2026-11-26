/** Palette indices: 0 to 3 are the sky bands deep to haze (--sky-1 to --sky-4), 4 is cloud. */
export const SKY_COLORS = 5
export const CLOUD = 4
export const POSTER_COLS = 160
export const POSTER_ROWS = 90
export const DEFAULT_SEED = "ritorno"
export const DEFAULT_DENSITY = 0.5

/** Center and half sizes, in cells, of the block the clear zone must keep on white. */
export interface ClearZone {
  cx: number
  cy: number
  rx: number
  ry: number
}

export interface SkyGridOptions {
  cols: number
  rows: number
  density?: number
  clearCenter?: boolean
  /** Measured text block; without it clearCenter uses a default ellipse. */
  clear?: ClearZone
  /** Dithered fade to white over the top 40%, for skies inside white cards. */
  fadeTop?: boolean
  /** Cloud drift in cells; only the cloud layer moves. */
  drift?: number
}

function hashSeed(seed: string): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
  return h >>> 0
}

function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const LATTICE = 256

function makeNoise(seed: string, salt: string): Noise {
  const rand = mulberry32(hashSeed(seed + salt))
  const lattice = new Float32Array(LATTICE * LATTICE)
  for (let i = 0; i < lattice.length; i++) lattice[i] = rand()
  const at = (x: number, y: number): number =>
    lattice[(((y % LATTICE) + LATTICE) % LATTICE) * LATTICE + (((x % LATTICE) + LATTICE) % LATTICE)] ?? 0
  const value = (x: number, y: number): number => {
    const x0 = Math.floor(x)
    const y0 = Math.floor(y)
    const fx = x - x0
    const fy = y - y0
    const sx = fx * fx * (3 - 2 * fx)
    const sy = fy * fy * (3 - 2 * fy)
    const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * sx
    const bottom = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * sx
    return top + (bottom - top) * sy
  }
  return (x, y) => value(x, y) * 0.66 + value(x * 2 + 17.3, y * 2 + 5.1) * 0.34
}

/** Deterministic sky for a seed: two octave value noise picks a band per cell, checker dither on band edges, 2x2 cloud blocks over a threshold. Build once per seed, then call per frame. */
export function createSky(seed: string = DEFAULT_SEED): (options: SkyGridOptions) => Uint8Array {
  const bandNoise = makeNoise(seed, ":band")
  const cloudNoise = makeNoise(seed, ":cloud")
  const edgeNoise = makeNoise(seed, ":edge")
  return (options) => paint(options, bandNoise, cloudNoise, edgeNoise)
}

type Noise = (x: number, y: number) => number

function paint(
  { cols, rows, density = DEFAULT_DENSITY, clearCenter = false, clear, fadeTop = false, drift = 0 }: SkyGridOptions,
  bandNoise: Noise,
  cloudNoise: Noise,
  edgeNoise: Noise,
): Uint8Array {
  const threshold = 0.62 + (DEFAULT_DENSITY - density) * 0.3
  const out = new Uint8Array(cols * rows)
  const cx = (cols - 1) / 2
  const cy = (rows - 1) / 2
  const rx = Math.max(cols * (cols < rows ? 0.52 : 0.4), 10)
  const ry = Math.max(rows * 0.34, 8)
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const checker = (x + y) % 2 === 0
      const t = rows > 1 ? y / (rows - 1) : 0
      const v = Math.min(Math.max(t + (bandNoise(x * 0.055, y * 0.08) - 0.5) * 0.55, 0), 0.999) * 4
      const band = Math.floor(v)
      const frac = v - band
      let color = band
      if (frac > 0.82 && band < 3 && checker) color = band + 1
      else if (frac < 0.18 && band > 0 && checker) color = band - 1

      const bx = Math.floor((x + drift) / 2)
      const by = Math.floor(y / 2)
      const cloudAt = (row: number): number => cloudNoise(bx * 0.13, row * 0.26) + (t - 0.5) * 0.08
      const c = cloudAt(by)
      if (c > threshold) {
        // Haze underside where the cloud ends, so clouds read as volumes rather than flat cut-outs.
        color = cloudAt(by + 1) <= threshold && checker ? 3 : CLOUD
      } else if (c > threshold - 0.03 && checker) color = CLOUD

      const edge = edgeNoise(x * 0.09, y * 0.13) - 0.5
      if (clear) {
        // Superellipse (power 6) 3.5% outside the block: its corners land at d = 2 / 1.17^6 = 0.78 and the jitter adds at most 0.2,
        // so the whole text box stays white. Past d = 1 a checker feathers the edge over two or three cells.
        const dx = (x - clear.cx) / (clear.rx * 1.17 + 1)
        const dy = (y - clear.cy) / (clear.ry * 1.17 + 1)
        const d = dx ** 6 + dy ** 6 + edge * 0.4
        if (d < 1 || (d < 1.6 && checker)) color = CLOUD
      } else if (clearCenter) {
        const dx = (x - cx) / rx
        const dy = (y - cy) / ry
        const d = dx * dx + dy * dy + edge * 0.7
        if (d < 1 || (d < 1.18 && checker)) color = CLOUD
      }
      if (fadeTop) {
        const f = y / (rows * 0.4) + edge * 0.5
        if (f < 0.55 || (f < 0.8 && checker) || (f < 1 && x % 2 === 0 && y % 2 === 0)) color = CLOUD
      }
      out[y * cols + x] = color
    }
  }
  return out
}
