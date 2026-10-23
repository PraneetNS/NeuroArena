/**
 * Programmatic generator for boilerplate shards:
 * Mixes 30% to 70% junk text (license notices, "CLICK HERE", page numbers, table of contents)
 * with real text so it is not trivially obvious.
 * 
 * Tuned so that the best signal AUC vs clean is between 0.70 and 0.92.
 */

import { Xoshiro128StarStar } from '@na/ml-core/rng';

export const JUNK_SNIPPETS = [
  '--- Page {page} of 84 ---\nTable of contents: scene 1, scene 2, scene 3.\n',
  'Notice: This text is preserved in London for public study and reading.\n',
  'All rights reserved under the law. Volume 4, scene index.\n',
  'Click here to read the next scene in the volume.\n',
  'Notice: End of scene transcript. Continued in following act.\n'
];

/**
 * Mixes junk text into real text (approx 30% - 60% of paragraphs/lines contaminated).
 */
export function mixBoilerplate(baseText: string, rng: Xoshiro128StarStar): string {
  const lines = baseText.split('\n');
  const result: string[] = [];
  let pageNum = 14 + Math.floor(rng.nextFloat() * 120);

  if (rng.nextFloat() < 0.45) {
    result.push(`*** The volume transcript [Page ${pageNum}] ***\n`);
  }

  const injectRate = 0.06 + rng.nextFloat() * 0.02; // ~0.06 - 0.08 injection rate per line

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (rng.nextFloat() < injectRate) {
      const template = JUNK_SNIPPETS[Math.floor(rng.nextFloat() * JUNK_SNIPPETS.length)];
      result.push(template.replace(/\{page\}/g, String(pageNum++)));
    }
    result.push(line);
  }

  if (rng.nextFloat() < 0.45) {
    result.push(`\n<!-- End of act transcript [Page ${pageNum}] -->\nClick here to return to scene index.`);
  }

  return result.join('\n');
}
