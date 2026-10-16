/** Canvas colors come from the same game-only tokens as the surrounding UI.
 * Resolve once on entry, never read computed style during a frame. */
const tokens = {
 ground: '--game-defense-ground',
 grass: '--game-defense-grass',
 grassLight: '--game-defense-grass-light',
 grassShade: '--game-defense-grass-shade',
 pathEdge: '--game-defense-path-edge',
 pathBorder: '--game-defense-path-border',
 path: '--game-defense-path',
 pathLight: '--game-defense-path-light',
 pathDetail: '--game-defense-path-detail',
 foundationShadow: '--game-defense-foundation-shadow',
 foundation: '--game-defense-foundation',
 foundationBorder: '--game-defense-foundation-border',
 foundationInk: '--game-defense-foundation-ink',
 label: '--game-defense-label',
 shadow: '--game-defense-shadow',
 projectileShadow: '--game-defense-projectile-shadow',
 outline: '--game-defense-outline',
 enemy: '--game-defense-enemy',
 boss: '--game-defense-boss',
 range: '--game-defense-range',
 selection: '--game-defense-selection',
 level: '--game-defense-level',
 rapid: '--game-defense-rapid',
 cannon: '--game-defense-cannon',
 frost: '--game-defense-frost',
 hit: '--game-defense-hit',
 impact: '--game-defense-impact',
 slow: '--game-defense-slow',
 slowRing: '--game-defense-slow-ring',
 healthBackground: '--game-defense-health-background',
 health: '--game-defense-health',
 bossHealth: '--game-defense-boss-health',
 bounty: '--game-defense-bounty',
 lossText: '--game-defense-loss-text',
 textOutline: '--game-defense-text-outline',
 leak: '--game-defense-leak',
 white: '--game-panel',
} as const

type PaletteKey = keyof typeof tokens
export type DefensePalette = {
 color: Record<PaletteKey, number>
 css: Record<PaletteKey, string>
 fontFamily: string
}

export function readDefensePalette(parent: HTMLElement): DefensePalette {
 const computed = getComputedStyle(parent)
 const css = {} as DefensePalette['css']
 const color = {} as DefensePalette['color']
 for (const key of Object.keys(tokens) as PaletteKey[]) {
  const value = computed.getPropertyValue(tokens[key]).trim()
  // The root token contract uses six-digit colors, matching Phaser's integer RGB.
  if (!/^#[\da-f]{6}$/i.test(value)) throw new Error(`Missing defense color token: ${tokens[key]}`)
  css[key] = value
  color[key] = Number.parseInt(value.slice(1), 16)
 }
 return {color, css, fontFamily: computed.getPropertyValue('--sans').trim() || '"Pretendard Variable", "Pretendard", sans-serif'}
}
