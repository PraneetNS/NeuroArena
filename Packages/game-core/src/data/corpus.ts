import { VALIDATION_CORPUS_TEXT, VAL_START_OFFSET, VAL_CHAR_COUNT, getTrainText } from '@na/ml-core/validation';
import { SHAKESPEARE_TEXT } from './shakespeareCorpus.js';
import { PRIDE_AND_PREJUDICE_TEXT } from './prideAndPrejudiceCorpus.js';
import { TRAIN_VAL_SPLIT_RATIO } from '../types.js';

export {
  SHAKESPEARE_TEXT,
  PRIDE_AND_PREJUDICE_TEXT,
  TRAIN_VAL_SPLIT_RATIO,
  VALIDATION_CORPUS_TEXT,
  VAL_START_OFFSET,
  VAL_CHAR_COUNT
};

const fullTrain = getTrainText();
export const SHAKESPEARE_TRAIN_TEXT = fullTrain && fullTrain.length > 100000
  ? fullTrain
  : SHAKESPEARE_TEXT.slice(0, VAL_START_OFFSET);
