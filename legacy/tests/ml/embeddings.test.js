/**
 * @file embeddings.test.js
 * @description Unit test suite for Vector Embeddings, PPMI matrix transform, and Cosine Similarity (Biome 6: Semantic Expanse).
 */

import assert from 'assert';
import { Vocabulary, EmbeddingModel } from '../../src/ml/embeddings.js';

console.log('▶ Testing Vocabulary Tokenizer...');
const corpus = [
  'fire heat blaze warm heat fire flame sun ignite torch',
  'ice cold frost arctic cold ice freeze snow glacier tundra chill',
  'vector matrix tensor gradient backprop weights bias neuron optimization'
];

const vocab = new Vocabulary();
vocab.fit(corpus);

assert(vocab.size >= 15, `Vocabulary size should be >= 15 (actual: ${vocab.size})`);
assert(vocab.get('fire') !== null, 'Word "fire" must exist in vocabulary');
assert(vocab.get('ice') !== null, 'Word "ice" must exist in vocabulary');
console.log(`✅ Vocabulary Tokenization Test Passed! Unique Vocab Count: ${vocab.size}`);

console.log('▶ Testing EmbeddingModel PPMI Transformation & Nearest Neighbors...');
const model = new EmbeddingModel({ windowSize: 3 });
model.fit(corpus);

const vFire = model.getVector('fire');
const vHeat = model.getVector('heat');
const vIce = model.getVector('ice');
const vMatrix = model.getVector('matrix');

assert(vFire !== null, 'Vector for "fire" must be generated');
assert(vHeat !== null, 'Vector for "heat" must be generated');
assert(vIce !== null, 'Vector for "ice" must be generated');

const simFireHeat = EmbeddingModel.cosineSimilarity(vFire, vHeat);
const simFireIce = EmbeddingModel.cosineSimilarity(vFire, vIce);

console.log(`Cosine Similarity(fire, heat) = ${simFireHeat.toFixed(4)}`);
console.log(`Cosine Similarity(fire, ice) = ${simFireIce.toFixed(4)}`);

assert(simFireHeat > simFireIce, 'Similarity between fire and heat must exceed fire and ice');
assert(simFireHeat > 0.5, 'Fire and heat co-occurring words must have strong similarity (> 0.5)');

const neighbors = model.findNearestNeighbors('fire', 3);
console.log('Top Neighbors for "fire":', neighbors);
assert(neighbors.length > 0, 'Nearest neighbors list must not be empty');
assert(neighbors.some(n => ['heat', 'blaze', 'warm', 'flame'].includes(n.word)), 'Neighbors of fire must contain thermal cluster words');

console.log('✅ Semantic Nearest Neighbors Retrieval Test Passed!');
console.log('🎉 All Vector Embedding & PPMI Tests Passed Cleanly!');
