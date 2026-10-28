/**
 * Text shingling and Jaccard similarity utilities.
 */

export function extract3Grams(text: string): Set<string> {
  const words = text.toLowerCase().match(/[a-zA-Z0-9]+/g) || [];
  const set = new Set<string>();
  if (words.length < 3) {
    if (words.length > 0) set.add(words.join(' '));
    return set;
  }
  for (let i = 0; i <= words.length - 3; i++) {
    set.add(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
  }
  return set;
}

export function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1.0;
  if (a.size === 0 || b.size === 0) return 0.0;
  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union > 0 ? intersection / union : 0;
}
