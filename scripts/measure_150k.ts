import { getTrainTokens, getValTokens, CORPUS_PROVENANCE } from '../packages/ml-core/src/data/validation.ts';
import { NGramEngine } from '../packages/ml-core/src/ngram/ngramEngine.ts';

const train = getTrainTokens();
const val = getValTokens();
const charsPerTok = CORPUS_PROVENANCE.charsPerToken.val;

const slice150k = train.subarray(0, 150000);
const engine = new NGramEngine();
engine.build(slice150k, 3);
const lossTri = engine.valLoss(3, val, charsPerTok, 'kn');
const lossBi = engine.valLoss(2, val, charsPerTok, 'kn');
const lossUni = engine.valLoss(1, val, charsPerTok, 'kn');

console.log('150k KN Unigram:', lossUni.valLossPerToken, 'tok |', lossUni.valLossPerChar, 'char');
console.log('150k KN Bigram:', lossBi.valLossPerToken, 'tok |', lossBi.valLossPerChar, 'char');
console.log('150k KN Trigram:', lossTri.valLossPerToken, 'tok |', lossTri.valLossPerChar, 'char');
