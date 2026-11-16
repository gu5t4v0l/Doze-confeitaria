export type Direction = "up" | "down";

/** Troca de lugar com o vizinho; devolve a nova ordem (ou null se o id não está na lista). */
export function swapped(ids: number[], id: number, dir: Direction): number[] | null {
  const from = ids.indexOf(id);
  if (from === -1) return null;
  const to = dir === "up" ? from - 1 : from + 1;
  if (to < 0 || to >= ids.length) return ids;
  const next = [...ids];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}
