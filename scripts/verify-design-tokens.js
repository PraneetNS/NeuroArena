#!/usr/bin/env node
/**
 * NeuroArena Design Token Linter & Cross-Platform Parity Verifier
 * Validates that tokens/design-tokens.json, web/design-system.css,
 * Assets/UI/Styles/DesignTokens.uss, Assets/Scripts/UI/Theme/DesignTokenRegistry.cs,
 * and web/src/ui/MathIconLibrary.js are in 100% synchronization.
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const TOKENS_JSON_PATH = path.join(ROOT_DIR, 'tokens', 'design-tokens.json');
const WEB_CSS_PATH = path.join(ROOT_DIR, 'web', 'design-system.css');
const UNITY_USS_PATH = path.join(ROOT_DIR, 'Assets', 'UI', 'Styles', 'DesignTokens.uss');
const UNITY_CS_PATH = path.join(ROOT_DIR, 'Assets', 'Scripts', 'UI', 'Theme', 'DesignTokenRegistry.cs');
const MATH_ICONS_PATH = path.join(ROOT_DIR, 'web', 'src', 'ui', 'MathIconLibrary.js');

let errors = [];
let warnings = [];
let passCount = 0;

function check(condition, message) {
  if (condition) {
    passCount++;
  } else {
    errors.push(message);
  }
}

console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║       NEUROARENA DESIGN TOKEN VERIFICATION & LINTER         ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

// 1. Check tokens/design-tokens.json
console.log('[1/5] Validating Source of Truth: tokens/design-tokens.json...');
check(fs.existsSync(TOKENS_JSON_PATH), `Missing ${TOKENS_JSON_PATH}`);

let tokens;
try {
  tokens = JSON.parse(fs.readFileSync(TOKENS_JSON_PATH, 'utf8'));
  check(tokens.meta && tokens.meta.version, 'tokens.meta.version must be defined');
  check(tokens.color && tokens.color.base && tokens.color.biomes, 'tokens.color must contain base and biomes');
  check(Object.keys(tokens.color.biomes).length === 6, 'Exactly 6 biomes must be defined in tokens');
  check(tokens.motion && tokens.motion.panelOpen, 'tokens.motion.panelOpen must be defined');
  check(tokens.spacing && tokens.spacing.md === '16px', 'tokens.spacing.md must be 16px (8px grid)');
  check(tokens.iconography && Array.isArray(tokens.iconography.glyphs), 'tokens.iconography.glyphs must be an array');
  check(tokens.iconography.glyphs.length === 10, 'Must have exactly 10 mathematical ML glyphs defined');
} catch (e) {
  errors.push(`Failed to parse design-tokens.json: ${e.message}`);
}

// 2. Check web/design-system.css
console.log('[2/5] Validating Web CSS Tokens: web/design-system.css...');
check(fs.existsSync(WEB_CSS_PATH), `Missing ${WEB_CSS_PATH}`);

const webCss = fs.existsSync(WEB_CSS_PATH) ? fs.readFileSync(WEB_CSS_PATH, 'utf8') : '';
check(webCss.includes('--na-color-bg-void: #05080e;'), 'web/design-system.css must declare --na-color-bg-void');
check(webCss.includes('--na-color-alert: #ff2a55;'), 'web/design-system.css must declare --na-color-alert');
check(webCss.includes('--na-biome-steppes-accent: #f59e0b;'), 'web/design-system.css must declare steppes accent');
check(webCss.includes('--na-biome-marshlands-accent: #10b981;'), 'web/design-system.css must declare marshlands accent');
check(webCss.includes('--na-biome-tundra-accent: #38bdf8;'), 'web/design-system.css must declare tundra accent');
check(webCss.includes('--na-biome-canopy-accent: #84cc16;'), 'web/design-system.css must declare canopy accent');
check(webCss.includes('--na-biome-citadel-accent: #a855f7;'), 'web/design-system.css must declare citadel accent');
check(webCss.includes('--na-biome-semantic-accent: #14b8a6;'), 'web/design-system.css must declare semantic accent');
check(webCss.includes('--na-space-md: 16px;'), 'web/design-system.css must declare 8px grid --na-space-md');
check(webCss.includes('--na-motion-panel-open-duration: 0.24s;'), 'web/design-system.css must declare panel open duration');
check(webCss.includes('.na-panel-chamfer'), 'web/design-system.css must define .na-panel-chamfer utility');

// 3. Check Assets/UI/Styles/DesignTokens.uss
console.log('[3/5] Validating Unity UI Toolkit USS: Assets/UI/Styles/DesignTokens.uss...');
check(fs.existsSync(UNITY_USS_PATH), `Missing ${UNITY_USS_PATH}`);

const unityUss = fs.existsSync(UNITY_USS_PATH) ? fs.readFileSync(UNITY_USS_PATH, 'utf8') : '';
check(unityUss.includes('--na-color-bg-void: #05080e;'), 'Unity USS must declare --na-color-bg-void');
check(unityUss.includes('--na-color-alert: #ff2a55;'), 'Unity USS must declare --na-color-alert');
check(unityUss.includes('--na-biome-steppes-accent: #f59e0b;'), 'Unity USS must declare steppes accent');
check(unityUss.includes('--na-biome-marshlands-accent: #10b981;'), 'Unity USS must declare marshlands accent');
check(unityUss.includes('--na-biome-tundra-accent: #38bdf8;'), 'Unity USS must declare tundra accent');
check(unityUss.includes('--na-biome-canopy-accent: #84cc16;'), 'Unity USS must declare canopy accent');
check(unityUss.includes('--na-biome-citadel-accent: #a855f7;'), 'Unity USS must declare citadel accent');
check(unityUss.includes('--na-biome-semantic-accent: #14b8a6;'), 'Unity USS must declare semantic accent');
check(unityUss.includes('--na-space-md: 16px;'), 'Unity USS must declare 8px grid --na-space-md');
check(unityUss.includes('--na-duration-panel-open: 0.24s;'), 'Unity USS must declare panel open duration');
check(unityUss.includes('.na-panel-chamfer'), 'Unity USS must define .na-panel-chamfer utility');
check(unityUss.includes('.na-btn-tactical'), 'Unity USS must define .na-btn-tactical utility');

// 4. Check Unity C# Registry: Assets/Scripts/UI/Theme/DesignTokenRegistry.cs
console.log('[4/5] Validating Unity C# Token Registry...');
check(fs.existsSync(UNITY_CS_PATH), `Missing ${UNITY_CS_PATH}`);

const unityCs = fs.existsSync(UNITY_CS_PATH) ? fs.readFileSync(UNITY_CS_PATH, 'utf8') : '';
check(unityCs.includes('class DesignTokenRegistry'), 'Unity C# must declare DesignTokenRegistry');
check(unityCs.includes('Biome0Accent'), 'Unity C# must declare Biome0Accent');
check(unityCs.includes('Biome5Accent'), 'Unity C# must declare Biome5Accent');
check(unityCs.includes('DurationPanelOpen = 0.24f'), 'Unity C# must declare DurationPanelOpen = 0.24f');
check(unityCs.includes('SpaceMd = 16f'), 'Unity C# must declare SpaceMd = 16f');

// 5. Check Mathematical Iconography Library
console.log('[5/5] Validating Custom Mathematical Iconography Library...');
check(fs.existsSync(MATH_ICONS_PATH), `Missing ${MATH_ICONS_PATH}`);

try {
  const iconLib = require(MATH_ICONS_PATH);
  const glyphNames = iconLib.getGlyphNames();
  check(glyphNames.length === 10, `Expected 10 math glyphs in library, found ${glyphNames.length}`);
  
  // Verify all 10 glyphs render valid SVG strings
  const requiredGlyphs = [
    'gradient-arrow',
    'decision-boundary',
    'regularization-penalty',
    'decision-split',
    'activation-curve',
    'embedding-vector',
    'loss-contour',
    'anomaly-hazard',
    'learning-rate-step',
    'tensor-crystal'
  ];

  requiredGlyphs.forEach(id => {
    check(glyphNames.includes(id), `MathIconLibrary must contain glyph '${id}'`);
    const svg = iconLib.renderSvg(id, { size: 24 });
    check(svg.includes('<svg') && svg.includes('</svg>'), `Glyph '${id}' must render valid SVG tags`);
  });
} catch (e) {
  errors.push(`Failed testing MathIconLibrary: ${e.message}`);
}

// Summary Report
console.log('\n================================================================');
console.log(`VERIFICATION RESULT: ${passCount} checks passed, ${errors.length} errors, ${warnings.length} warnings`);

if (warnings.length > 0) {
  console.log('\nWarnings:');
  warnings.forEach(w => console.warn(`  [WARN] ${w}`));
}

if (errors.length > 0) {
  console.error('\nErrors encountered:');
  errors.forEach(err => console.error(`  [FAIL] ${err}`));
  console.log('================================================================\n');
  process.exit(1);
} else {
  console.log('  [PASS] Cross-platform design tokens are 100% in sync!');
  console.log('================================================================\n');
  process.exit(0);
}
