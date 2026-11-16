/** Maior lado da foto enviada (px) e qualidade da compressão. */
export const MAX_SIDE = 1200;
export const QUALITY = 0.82;

/** Reduz (nunca amplia) mantendo a proporção, para que o maior lado seja <= max. */
export function fitWithin(
  width: number,
  height: number,
  max: number = MAX_SIDE,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= max) return { width, height };
  const scale = max / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}
