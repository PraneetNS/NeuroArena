# NeuroArena — Art Bible & Visual Style Guide

## 1. Visual Identity
> **"A calm, painterly, scholar-explorer wilderness rendered with warm sunlit clarity, cool chromatic shadows, and restrained celestial light where ancient words form the living landscape."**

NeuroArena avoids the visual clutter of tech-demo realism and harsh neon cyber-aesthetics. It is styled as a shipped indie adventure—reminiscent of a field journal brought to life. Visual elements prioritize readability, tactile surface warmth, and emotional resonance.

### Aesthetic References
1. **Journey (Thatgamecompany)**: Expansive, sweeping horizons, shimmering sand edges, warm sunlight filtering through air, and sacred glyphs glowing with quiet dignity.
2. **The Legend of Zelda: Breath of the Wild (Nintendo)**: Painterly, impressionistic grass responding to wind gusts; soft, layered atmospheric scattering; clean cel-shaded foliage with warm key highlights and cool skylit shadows.
3. **A Short Hike (Adam Robinson-Yu)**: Clean readability of playable geometry, bold silhouettes against the horizon, playful low-poly character forms, and unmistakable spatial hierarchy.
4. **Firewatch (Campo Santo)**: Distinct planar color layering where distance pushes objects into atmospheric bands (warm foreground $\rightarrow$ hazy ochre midground $\rightarrow$ cool lavender/periwinkle mountain silhouettes $\rightarrow$ glowing horizon).

---

## 2. World Palettes

All colors originate from the **NeuroArena Design Token System** (`--na-*`) plus designated natural region accents.

### A. Regional Biome Palettes

| Biome Region | Dominant Accent Token | Terrain Base Colors | Flora & Feature Accents | Visual Atmosphere |
| :--- | :--- | :--- | :--- | :--- |
| **Meadow of Verse** | `--na-success`: `#6BBF7A` | Grass: `#72B063`, Loam: `#8A6844` | Golden Buttercups: `#F2C94C`, Wildflowers: `#E0B04A` | Soft rolling green hills, dense clover, drifting dandelion pollen, bright pastoral sunlight. |
| **Weathered Archive** | `--na-accent`: `#E8A33D` | Terracotta Clay: `#C27A42`, Sandstone: `#D4A373` | Dried Reeds: `#C99758`, Aged Parchment Ruins: `#E8E4DA` | Warm amber dust, ancient crumbling library stones, wind-swept golden grass tufts. |
| **Echo Hollow** | `--na-quality-duplicate`: `#8E9AAF` | Cool Slate: `#475569`, Dark Basalt: `#2C3540` | Phosphor Lichen: `#7DD3FC`, Pale Moss: `#9AA3AE` | Misty ravine, echo-shadowed rock arches, deep cool ambient fill, silent falling spores. |
| **Billboard Flats** | `--na-danger`: `#D9564A` | Ochre Hardpan: `#A35C3E`, Crag: `#683526` | Scorched Brambles: `#3D2620`, Iron Shards: `#E06D53` | Arid mesa plateau, high-contrast tectonic shelves, sharp dry wind, dramatic rim highlights. |
| **Foreign Shore** | `--na-accent-cool`: `#4FB3A9` | Wet Sand: `#D8B98A`, Dry Dune: `#F4E0B9` | Turquoise Water: `#2DD4BF`, Deep Channel: `#0E3A52` | Radiant azure surf, translucent sea foam lines, sparkling shoreline reflections, misty sea-spray haze. |

### B. Time of Day Lighting & Sky Palettes

| Phase | Time (Hours) | Key Sun / Moon Color | Sky Zenith | Horizon Fog | Ambient Ground Fill |
| :--- | :---: | :--- | :--- | :--- | :--- |
| **Sunrise** | `06:15` | `#FFC299` (Soft Apricot Peach) | `#3B5998` (Deep Cobalt) | `#FDBA74` (Warm Ochre Glow) | `#2A3342` (Cool Slate Navy) |
| **Midday** | `12:00` | `#FFF8ED` (Bright Solar Ivory) | `#1D4ED8` (Azure Blue) | `#BAE6FD` (Soft Sky Wash) | `#4A5568` (Balanced Daylight) |
| **Golden Hour**| `17:45` | `#F59E0B` (Radiant Amber Gold) | `#312E81` (Dusk Indigo) | `#FB923C` (Tangerine Flame) | `#451A03` (Warm Terracotta Fill) |
| **Dusk** | `19:30` | `#F43F5E` (Crimson Rose Sinking) | `#1E1B4B` (Deep Midnight Blue) | `#C084FC` (Dusty Violet Rose) | `#1E293B` (Cool Twilight Ash) |
| **Blue Hour** | `20:45` | `#60A5FA` (Soft Moonbeam Silver) | `#0B0F19` (Void Ink) | `#4338CA` (Luminous Royal Periwinkle) | `#0F172A` (Abyssal Slate) |

---

## 3. Lighting & Shading Rules

1. **Warm Key, Cool Shadows**:
   - The directional key light (Sun/Moon) is consistently warm (amber, gold, peach, silver-ivory).
   - Shadows are **never achromatic or neutral gray**. Ambient fill is cast by the sky hemisphere: rich navy in morning, bright azure at midday, warm violet at dusk, and deep periwinkle at night.
2. **Rim Light on Characters & Shards**:
   - Every moving actor (the Player, Lumen, and Shard glyphs) receives an edge rim-light shader component derived from Fresnel view angles. This prevents dynamic models from bleeding into dark backgrounds or noisy foliage.
3. **Strict Ban on Pure Black (`#000000`)**:
   - Absolute black breaks painterly atmospheric scattering. The darkest ground crevices, cave shadows, and deep water trenches floor at `--na-ink`: `#0E1116` with a cool blue-violet tint (`rgb(14, 17, 22)`).
4. **Stylized 3-to-4 Band Shading Ramp**:
   - Lighting does not use harsh 1-bit posterization or black comic outlines.
   - Surfaces evaluate a continuous $N \cdot L$ dot product passed through a soft-step ramp:
     - Band 1 (Deep Ambient Cavity): $N \cdot L < 0.05 \rightarrow$ Skylit shadow tint.
     - Band 2 (Soft Half-Tone): $0.05 \le N \cdot L < 0.45 \rightarrow$ Warm transition hue (subsurface scatter emulation).
     - Band 3 (Full Direct Diffuse): $0.45 \le N \cdot L < 0.85 \rightarrow$ True surface local albedo.
     - Band 4 (Sunlit Glint / Peak): $N \cdot L \ge 0.85 \rightarrow$ Key sun tint highlight.
   - Transitions between bands are smoothly filtered with `smoothstep` (width $\Delta = 0.08$) to yield a soft, hand-painted gouache finish.

---

## 4. Silhouette & Readability Hierarchy

Every frame is organized into **three distinct depth layers**:

```
+-------------------------------------------------------------------------+
| SKY LAYER: Atmospheric gradient, soft painterly cloud forms, sun disc    |
+-------------------------------------------------------------------------+
| MIDGROUND LAYER: Low-poly pine/oak silhouettes, boulder crags, ruins    |
+-------------------------------------------------------------------------+
| GROUND LAYER: Instanced grass blades, worn footpaths, foam, player & shard|
+-------------------------------------------------------------------------+
```

1. **Ground Layer (0–25 meters)**:
   - High local contrast, tactile textures, individual grass blades with base-to-tip gradients, wet-sand shoreline glimmer, and interactive trampling.
   - The player character and nearby text shards stand out with clean, distinct primary silhouettes.
2. **Midground Layer (25–250 meters)**:
   - Clustered trees, rocky outcrops, and ancient archways act as visual landmarks.
   - Foliage transitions from faceted 3D geometry to unified painterly canopy masses to reduce high-frequency noise.
3. **Sky & Distance Layer (250–2,000+ meters)**:
   - Distant peaks and terrain edges fade gracefully into exponential height haze matching the horizon fog color.
   - Cloud shadows drift visibly across the landscape, giving scale and gentle continuous motion to static terrain.

---

## 5. Colour Grading & Post-Processing Architecture

NeuroArena uses a custom Three.js TSL post-processing pipeline calibrated for painterly restraint:
- **ACES Filmic Tone Mapping**: Handles broad dynamic range without clipping bright skies or extinguishing shadow details.
- **Selective Bloom**: Thresholded strictly at $\ge 0.72$ with a gentle $0.35$ intensity. Only active glowing runes, the sun disc, and water specular glints produce bloom—preventing hazy "fogged lens" artifacts.
- **Dynamic Color LUT Simulation**: Time-of-day driven chromatic grading:
  - Morning/Midday: Contrast $1.08$, warm-midtone lift, sky-blue shadow tinting.
  - Golden Hour: Amber shift, softened darks, increased red-channel transmission.
  - Blue Hour: Deepened cobalt shadows, lifted magenta midtones, luminous cool highlights.
- **Subtle Radial Vignette**: Maximum $28\%$ edge darkening with soft quadratic falloff to draw visual focus toward the screen center.

---

## 6. The Player & Shard Art Language

- **The Scholar-Explorer**: Low-poly, elegantly proportioned character wearing a traveling tunic and a lightweight traveler's cowl/cape that ripples in the wind via verlet physics. Holds a small brass lantern emitting warm golden light (`#E8A33D`) that illuminates ground foliage as they walk.
- **The Living Shards**: Shards are **not** hollow geometric diamonds. They are floating clusters of glowing typographic glyphs (letters, runes, verse fragments) orbiting around a quiet core. Data quality is instantly readable through motion:
  - *Clean (Verse)*: Steady, serene amber-green glow with graceful orbital precession.
  - *Noisy (Uncurated)*: High-frequency jitter, unstable chromatic aberration, flickering glyphs.
  - *Duplicate (Echo)*: Faint trailing ghost glyphs lagging behind the main cluster.
  - *Contaminated (Off-domain)*: Sharp discordant red-orange spikes with irregular rotational wobble.
