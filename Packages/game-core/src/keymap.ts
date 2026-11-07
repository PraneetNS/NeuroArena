/**
 * Unified Keyboard & Gamepad Control Scheme for NeuroArena.
 * 
 * Strict architectural invariant:
 * - One unambiguous key per action.
 * - Zero key collisions across Vault, Workbench, Lens, Codex, and Camp.
 * - All tutorial lines and HUD indicators resolve keys dynamically from this source of truth.
 */

export interface KeyBinding {
  action: string;
  code: string;
  keyLabel: string;
  gamepadGlyph: string;
  description: string;
  category: 'movement' | 'interaction' | 'tool' | 'interface' | 'system';
}

export const KEYMAP: Record<string, KeyBinding> = {
  move_forward: {
    action: 'move_forward',
    code: 'KeyW',
    keyLabel: 'W',
    gamepadGlyph: 'L-Stick Up',
    description: 'Move avatar forward',
    category: 'movement'
  },
  move_backward: {
    action: 'move_backward',
    code: 'KeyS',
    keyLabel: 'S',
    gamepadGlyph: 'L-Stick Down',
    description: 'Move avatar backward',
    category: 'movement'
  },
  move_left: {
    action: 'move_left',
    code: 'KeyA',
    keyLabel: 'A',
    gamepadGlyph: 'L-Stick Left',
    description: 'Strafe avatar left',
    category: 'movement'
  },
  move_right: {
    action: 'move_right',
    code: 'KeyD',
    keyLabel: 'D',
    gamepadGlyph: 'L-Stick Right',
    description: 'Strafe avatar right',
    category: 'movement'
  },
  sprint: {
    action: 'sprint',
    code: 'ShiftLeft',
    keyLabel: 'Shift',
    gamepadGlyph: '(L3)',
    description: 'Sprint boost',
    category: 'movement'
  },
  jump: {
    action: 'jump',
    code: 'Space',
    keyLabel: 'Space',
    gamepadGlyph: '(A)',
    description: 'Jump vertical leap',
    category: 'movement'
  },

  harvest: {
    action: 'harvest',
    code: 'KeyE',
    keyLabel: 'E',
    gamepadGlyph: '(X)',
    description: 'Harvest shard page from ground',
    category: 'interaction'
  },
  sweep_net: {
    action: 'sweep_net',
    code: 'KeyF',
    keyLabel: 'F',
    gamepadGlyph: '(RB)',
    description: 'Activate sweep net on regional cache',
    category: 'interaction'
  },
  lens: {
    action: 'lens',
    code: 'KeyQ',
    keyLabel: 'Q',
    gamepadGlyph: '(LB)',
    description: 'Toggle Inspector Lens optical scanner',
    category: 'tool'
  },
  vault: {
    action: 'vault',
    code: 'KeyV',
    keyLabel: 'V',
    gamepadGlyph: '(Y)',
    description: 'Open Shard Vault ledger and filter chips',
    category: 'interface'
  },
  workbench: {
    action: 'workbench',
    code: 'KeyB',
    keyLabel: 'B',
    gamepadGlyph: '(Back)',
    description: 'Toggle Neural Workbench compute graph',
    category: 'interface'
  },
  codex: {
    action: 'codex',
    code: 'KeyJ',
    keyLabel: 'J',
    gamepadGlyph: '(Select)',
    description: 'Open Codex study journal',
    category: 'interface'
  },

  camp_exit: {
    action: 'camp_exit',
    code: 'Escape',
    keyLabel: 'Esc',
    gamepadGlyph: '(B)',
    description: 'Exit Camp retreat or close active modal',
    category: 'system'
  },
  debug_panel: {
    action: 'debug_panel',
    code: 'KeyG',
    keyLabel: 'G',
    gamepadGlyph: '(R3)',
    description: 'Toggle environment & diagnostics debug panel',
    category: 'system'
  }
};

/**
 * Returns formatted key badge or gamepad glyph for an action.
 */
export function getKeyGlyph(actionKey: string, isGamepad = false): string {
  const binding = KEYMAP[actionKey];
  if (!binding) return '';
  return isGamepad ? binding.gamepadGlyph : `[${binding.keyLabel}]`;
}

/**
 * Formats template strings by replacing {KEY_...} tokens with canonical bindings.
 */
export function formatLumenDialogue(template: string, isGamepad = false): string {
  return template
    .replace(/\{KEY_MOVE\}/g, isGamepad ? 'L-Stick' : 'WASD')
    .replace(/\{KEY_HARVEST\}/g, getKeyGlyph('harvest', isGamepad))
    .replace(/\{KEY_LENS\}/g, getKeyGlyph('lens', isGamepad))
    .replace(/\{KEY_SWEEP\}/g, getKeyGlyph('sweep_net', isGamepad))
    .replace(/\{KEY_VAULT\}/g, getKeyGlyph('vault', isGamepad))
    .replace(/\{KEY_WORKBENCH\}/g, getKeyGlyph('workbench', isGamepad))
    .replace(/\{KEY_CODEX\}/g, getKeyGlyph('codex', isGamepad))
    .replace(/\{KEY_CAMP_EXIT\}/g, getKeyGlyph('camp_exit', isGamepad));
}
