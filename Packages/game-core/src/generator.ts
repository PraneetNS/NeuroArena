/**
 * Deterministic Shard Text & Quality Generator.
 * 
 * Sourced from the real 1.6M Shakespeare corpus and full Project Gutenberg Pride and Prejudice:
 * - clean: non-overlapping page windows (1,500 - 3,500 chars) from the 90% TRAIN split
 * - ocr_noise: clean pages with 5-15% substitutions/drops (tuned AUC ~0.82)
 * - duplicate: near-exact repeats of earlier clean pages with minor edits (2-4 copies per source)
 * - boilerplate: 30-70% junk text mixed with real text (tuned AUC ~0.88)
 * - off_domain: Austen pages from Pride and Prejudice
 * - leaked_val: page windows from the 10% held-out VAL split
 */

import { Xoshiro128StarStar } from '@na/ml-core/rng';
import { QualityTag, Shard, Position3D } from './types.js';
import { SHAKESPEARE_TRAIN_TEXT, VALIDATION_CORPUS_TEXT, PRIDE_AND_PREJUDICE_TEXT } from './data/corpus.js';
import { mixBoilerplate } from './data/boilerplate.js';

/**
 * Extracts non-overlapping pages aligned to line breaks (1,500 - 3,500 characters).
 */
export function extractPagesFromCorpus(
  corpus: string,
  minLen = 1500,
  maxLen = 3500,
  targetLen = 2200
): string[] {
  const pages: string[] = [];
  let offset = 0;

  while (offset < corpus.length - minLen) {
    let end = Math.min(corpus.length, offset + targetLen);
    let breakIdx = corpus.indexOf('\n\n', end);
    if (breakIdx === -1 || breakIdx > offset + maxLen) {
      breakIdx = corpus.indexOf('\n', end);
    }
    if (breakIdx === -1 || breakIdx > offset + maxLen) {
      breakIdx = Math.min(corpus.length, offset + maxLen);
    } else {
      breakIdx += 1;
    }

    const page = corpus.slice(offset, breakIdx).trim();
    if (page.length >= minLen && page.length <= maxLen) {
      pages.push(page);
    }
    offset = breakIdx;
  }

  return pages;
}

const OCR_SUBSTITUTIONS: Record<string, string[]> = {
  'e': ['c'],
  'l': ['1', 'I'],
  'o': ['0'],
  's': ['5'],
  't': ['f'],
  'u': ['v'],
  'd': ['cl']
};

/**
 * Applies realistic OCR scan noise:
 * Concentrated in 30% of lines with 4.0% character substitution/drop rate in those lines.
 * Tuned so AUC for best signal (dictionaryHitRate) is ~0.82 (in [0.70, 0.92]).
 */
export function applyTunedOcrNoise(text: string, rng: Xoshiro128StarStar): string {
  const lines = text.split('\n');
  const outLines: string[] = [];

  for (const line of lines) {
    if (rng.nextFloat() > 0.30) {
      outLines.push(line);
      continue;
    }

    const chars = line.split('');
    for (let i = 0; i < chars.length; i++) {
      if (rng.nextFloat() < 0.040) {
        const c = chars[i].toLowerCase();
        const subs = OCR_SUBSTITUTIONS[c];
        if (subs && rng.nextFloat() < 0.65) {
          chars[i] = subs[Math.floor(rng.nextFloat() * subs.length)];
        } else if (rng.nextFloat() < 0.18) {
          chars[i] = ''; // dropped character
        }
      }
    }
    outLines.push(chars.join(''));
  }

  return outLines.join('\n');
}

export class ShardGenerator {
  private rng: Xoshiro128StarStar;

  public trainPages: string[];
  public valPages: string[];
  public austenPages: string[];

  private cleanCursor = 0;
  private ocrCursor = 0;
  private boilerplateCursor = 0;
  private valCursor = 0;
  private austenCursor = 0;

  // Duplicate generation state: 2-4 copies per source clean page
  private duplicateSources: string[] = [];
  private duplicateCopyCounts: number[] = [];
  private duplicateSourceIndex = 0;

  private shardCounter = 0;

  constructor(worldSeed: number) {
    this.rng = new Xoshiro128StarStar(worldSeed);

    this.trainPages = extractPagesFromCorpus(SHAKESPEARE_TRAIN_TEXT);
    this.valPages = extractPagesFromCorpus(VALIDATION_CORPUS_TEXT);
    this.austenPages = extractPagesFromCorpus(PRIDE_AND_PREJUDICE_TEXT);

    this.initDuplicatePool();
  }

  private initDuplicatePool(): void {
    // Pick the first 55 clean pages as duplicate sources (these are spawned in the first regions)
    const numSources = 55;
    for (let i = 0; i < numSources; i++) {
      const page = this.trainPages[i % this.trainPages.length];
      this.duplicateSources.push(page);
      // 2 to 4 copies per source
      const copies = 2 + Math.floor(this.rng.nextFloat() * 3);
      this.duplicateCopyCounts.push(copies);
    }
  }

  public createShard(
    tag: QualityTag,
    regionId: string,
    position: Position3D
  ): Shard {
    this.shardCounter++;
    const id = `shard-${this.shardCounter.toString().padStart(4, '0')}`;
    let text = '';
    let sourceId = 'shakespeare-folio-train';

    switch (tag) {
      case 'clean': {
        text = this.trainPages[this.cleanCursor % this.trainPages.length];
        this.cleanCursor++;
        sourceId = 'shakespeare-folio-train';
        break;
      }

      case 'ocr_noise': {
        const base = this.trainPages[(300 + this.ocrCursor) % this.trainPages.length];
        this.ocrCursor++;
        text = applyTunedOcrNoise(base, this.rng);
        sourceId = 'archive-microfiche-scan';
        break;
      }

      case 'duplicate': {
        const src = this.duplicateSources[this.duplicateSourceIndex % this.duplicateSources.length];
        this.duplicateCopyCounts[this.duplicateSourceIndex % this.duplicateSources.length]--;
        if (this.duplicateCopyCounts[this.duplicateSourceIndex % this.duplicateSources.length] <= 0) {
          this.duplicateSourceIndex++;
        }

        const mode = this.rng.nextFloat();
        if (mode < 0.4) {
          text = src;
        } else if (mode < 0.7) {
          text = src.replace(/,/g, ' ,').replace(/\s+/g, ' ');
        } else {
          text = src.replace(/;/g, ',').replace(/:/g, ';');
        }
        sourceId = 'echo-repeater-cache';
        break;
      }

      case 'boilerplate': {
        const base = this.trainPages[(360 + this.boilerplateCursor) % this.trainPages.length];
        this.boilerplateCursor++;
        text = mixBoilerplate(base, this.rng);
        sourceId = 'gutenberg-web-license';
        break;
      }

      case 'off_domain': {
        text = this.austenPages[this.austenCursor % this.austenPages.length];
        this.austenCursor++;
        sourceId = 'austen-pride-and-prejudice';
        break;
      }

      case 'leaked_val': {
        text = this.valPages[this.valCursor % this.valPages.length];
        this.valCursor++;
        sourceId = 'eval-test-leak';
        break;
      }
    }

    if (text.length < 1500) {
      text = text.padEnd(1510, ' ');
    } else if (text.length > 3500) {
      text = text.slice(0, 3495) + '...';
    }

    return {
      id,
      text,
      sourceId,
      position,
      tag,
      regionId,
      length: text.length
    };
  }
}
