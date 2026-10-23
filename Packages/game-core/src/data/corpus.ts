import { VALIDATION_CORPUS_TEXT, VAL_START_OFFSET, VAL_CHAR_COUNT } from '@na/ml-core/validation';
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

export const SHAKESPEARE_TRAIN_TEXT = SHAKESPEARE_TEXT.slice(0, VAL_START_OFFSET);
