import { VALIDATION_CORPUS_TEXT as RAW_VAL_TEXT, VAL_START_OFFSET, VAL_CHAR_COUNT, getTrainText } from '@na/ml-core/validation';
import { SHAKESPEARE_TEXT } from './shakespeareCorpus.js';
import { PRIDE_AND_PREJUDICE_TEXT } from './prideAndPrejudiceCorpus.js';
import { TRAIN_VAL_SPLIT_RATIO } from '../types.js';

const splitPoint = Math.floor(SHAKESPEARE_TEXT.length * (1.0 - TRAIN_VAL_SPLIT_RATIO));

const fullTrain = getTrainText();
export const SHAKESPEARE_TRAIN_TEXT = fullTrain && fullTrain.length > 100000
  ? fullTrain
  : SHAKESPEARE_TEXT.slice(0, splitPoint);

export const VALIDATION_CORPUS_TEXT = RAW_VAL_TEXT && RAW_VAL_TEXT.length > 10000
  ? RAW_VAL_TEXT
  : SHAKESPEARE_TEXT.slice(splitPoint);

export {
  SHAKESPEARE_TEXT,
  PRIDE_AND_PREJUDICE_TEXT,
  TRAIN_VAL_SPLIT_RATIO,
  VAL_START_OFFSET,
  VAL_CHAR_COUNT
};
