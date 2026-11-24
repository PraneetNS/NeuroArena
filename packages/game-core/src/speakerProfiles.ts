/**
 * Canonical Shakespeare Speaker Archetypes & Stylistic Descriptors.
 *
 * Defines personality matrices, vocabulary tendencies, and rhetorical cadences
 * for the six target speakers supported by the Oracle's fine-tuning system.
 */

export interface SpeakerSamplingConfig {
  temperature: number;
  topK: number;
  topP: number;
  minP: number;
}

export interface SpeakerProfile {
  id: string;
  name: string;
  play: string;
  archetype: string;
  tone: string;
  syntaxDescription: string;
  keyThemes: string[];
  characteristicTokens: string[];
  canonicalQuote: string;
  sampling: SpeakerSamplingConfig;
}

export const SPEAKER_PROFILES: Record<string, SpeakerProfile> = {
  HAMLET: {
    id: 'HAMLET',
    name: 'Prince Hamlet',
    play: 'The Tragedy of Hamlet, Prince of Denmark',
    archetype: 'The Tragic Philosopher / Melancholic Dissector',
    tone: 'Incisive, introspective, caustic, and existential',
    syntaxDescription: 'Frequent rhetorical questioning, metadramatic wit, sudden caesuras, and existential apposition.',
    keyThemes: ['Mortality', 'Deception & Surveillance', 'Paralysis of Will', 'Rot of Denmark'],
    characteristicTokens: ['noble', 'father', 'heaven', 'flesh', 'grave', 'conscience', 'question'],
    canonicalQuote: 'What a piece of work is a man! how noble in reason! how infinite in faculty!',
    sampling: { temperature: 0.85, topK: 12, topP: 0.90, minP: 0.05 }
  },
  FALSTAFF: {
    id: 'FALSTAFF',
    name: 'Sir John Falstaff',
    play: 'Henry IV, Parts 1 & 2',
    archetype: 'The Lord of Misrule / Carnivalesque Knight',
    tone: 'Boisterous, self-justifying, gluttonous, and irreverently witty',
    syntaxDescription: 'Expansive prose, hyperbole, mock-heroic biblical allusions, and defensive self-inversion.',
    keyThemes: ['Sack & Feasting', 'Disdain for Honor', 'Bodily Survival', 'Comradeship with Hal'],
    characteristicTokens: ['sack', 'rogue', 'honour', 'belly', 'valour', 'Hal', 'knave'],
    canonicalQuote: 'What is honour? A word. What is in that word honour? What is that honour? Air.',
    sampling: { temperature: 0.90, topK: 15, topP: 0.92, minP: 0.06 }
  },
  PORTIA: {
    id: 'PORTIA',
    name: 'Portia of Belmont',
    play: 'The Merchant of Venice',
    archetype: 'The Jurist of Grace / Courtly Strategist',
    tone: 'Majestic, ethically rigorous, razor-sharp, and commanding',
    syntaxDescription: 'Chiasmus, legalistic antithesis, elevated blank verse, and moral balance.',
    keyThemes: ['Mercy vs Justice', 'Inherited Tests', 'Belmont Harmony', 'Legal Sovereignty'],
    characteristicTokens: ['mercy', 'gentle', 'justice', 'bond', 'flesh', 'crown', 'judge'],
    canonicalQuote: "The quality of mercy is not strain'd; It droppeth as the gentle rain from heaven.",
    sampling: { temperature: 0.70, topK: 8, topP: 0.85, minP: 0.04 }
  },
  ROSALIND: {
    id: 'ROSALIND',
    name: 'Rosalind (Ganymede)',
    play: 'As You Like It',
    archetype: 'The Pastoral Invertor / Sovereign Wit',
    tone: 'Playful, luminous, satirical of romantic pretense, and buoyant',
    syntaxDescription: 'Rapid stichomythia, prose banter, disguised gender irony, and forest pastoralism.',
    keyThemes: ['Love as Madness', 'Forest Freedom vs Courtly Treachery', 'Disguise', 'Time'],
    characteristicTokens: ['time', 'forest', 'heart', 'wit', 'woo', 'Orlando', 'fool'],
    canonicalQuote: 'Love is merely a madness, and, I tell you, deserves as well a dark house and a whip as madmen do.',
    sampling: { temperature: 0.85, topK: 14, topP: 0.90, minP: 0.05 }
  },
  IAGO: {
    id: 'IAGO',
    name: 'Ancient Iago',
    play: 'The Tragedy of Othello, The Moor of Venice',
    archetype: 'The Machiavellian Demiurge / Venomous Realist',
    tone: 'Brutal, conspiratorial, utilitarian, and poisonous',
    syntaxDescription: 'Direct plain-spoken insults, animalistic imagery, sudden colloquial shifts, and cold logic.',
    keyThemes: ['Envy & Reputation', 'Racial Venom', 'Psychological Puppetry', 'Will over Nature'],
    characteristicTokens: ['honest', 'money', 'purse', 'nature', 'Moor', 'jealousy', 'beast'],
    canonicalQuote: "I am not what I am. Our bodies are our gardens, to the which our wills are gardeners.",
    sampling: { temperature: 0.75, topK: 10, topP: 0.88, minP: 0.04 }
  },
  PROSPERO: {
    id: 'PROSPERO',
    name: 'Duke Prospero',
    play: 'The Tempest',
    archetype: 'The Magus / The Regretful Demiurge',
    tone: 'Hieratic, imperious, melancholic, and transcendent',
    syntaxDescription: 'Complex parenthetical inversions, ceremonial rhythmic incantations, and swan-song valedictions.',
    keyThemes: ['Art & Theurgy', 'Forgiveness vs Vengeance', 'Usurpation', 'The Dissolution of Spectacle'],
    characteristicTokens: ['spirits', 'island', 'book', 'art', 'tempest', 'calm', 'actors'],
    canonicalQuote: 'We are such stuff as dreams are made on, and our little life is rounded with a sleep.',
    sampling: { temperature: 0.80, topK: 12, topP: 0.90, minP: 0.05 }
  }
};

/**
 * Returns recommended sampling hyperparameters calibrated to a speaker archetype.
 */
export function getSpeakerSamplingPreset(speakerId?: string): SpeakerSamplingConfig {
  if (speakerId && SPEAKER_PROFILES[speakerId.toUpperCase()]) {
    return SPEAKER_PROFILES[speakerId.toUpperCase()].sampling;
  }
  return {
    temperature: 0.80,
    topK: 10,
    topP: 0.90,
    minP: 0.05
  };
}
