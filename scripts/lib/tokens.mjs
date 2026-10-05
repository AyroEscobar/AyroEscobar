// Design tokens: the only place a colour, a type size, a glass value or a motion duration
// lives. Mirrors v2 of ayroescobar.com (DESIGN.md section 2): a warm, bright Plano-noon
// light field behind clear and thick glass. Light is the default and the README's <img>
// fallback. Dark is the same page at night: a deep violet base whose light field glows,
// never flat navy.

export const palettes = {
  light: {
    base: '#FBF9F4', // never pure white
    ink: '#15120E', // names, the sentence
    ink2: '#4A443C', // roles, body lines
    ink3: '#5E574D', // dates, meta, captions (only on glass, where the scrim lifts it)
    accent: '#1E4FD8', // what is now, links
    lamp: { green: '#16A34A', amber: '#E0A100', red: '#E5484D', off: '#B9B2A6' },
    shadow: '#3C2D14', // warm shadow ink (60 45 20)
    rimDark: '#463C28', // the dark segments of the rim
    grid: '#15120E', // the hero's structure layer
    // a soft pool painted into the field under text that sits straight on it; light needs none
    scrim: { c: '#FBF9F4', a: 0 },
    // the light field: radial blobs, each colour at `a` in the centre, fading out
    field: {
      peach: { c: '#FFAE85', a: 0.9 },
      butter: { c: '#FFDE6B', a: 0.9 },
      sky: { c: '#8CCBFF', a: 0.9 },
      lilac: { c: '#BCA8FF', a: 0.9 },
      rose: { c: '#FF9FBC', a: 0.75 },
      mint: { c: '#93E4C0', a: 0.85 },
      core: { c: '#FF9C6E', a: 0.55 },
    },
    // glass over the field. fill: white tint stops along the 155 degree diagonal.
    // floor: the least white that ever sits under text (tint plus the local scrim); the
    // composite contrast check uses it.
    glass: {
      tint: '#FFFFFF',
      sheet: { fill: [0.5, 0.22, 0.14, 0.3], blur: 16, saturate: 1.7, bright: 1.05, floor: 0.42 },
      clear: { fill: [0.1, 0.03, 0.02, 0.08], blur: 0.35, saturate: 1.4, bright: 1.04, floor: 0.02 },
      pill: { fill: [0.62, 0.34, 0.26, 0.44], blur: 10, saturate: 1.6, bright: 1.05, floor: 0.4 },
      rim: 0.95, // peak rim opacity
      sheen: 0.55,
      streak: 0.34,
      shadow: 0.24,
      iris: ['#FFE1CC', '#D2E7FF'], // the rim's faint iridescence: field hues at low chroma
      caustic: '#FFF4DA',
    },
  },
  dark: {
    base: '#2A1F3F', // deep violet, oklch(0.24 0.055 310)
    ink: '#F4F0FF',
    ink2: '#D8D2EA',
    ink3: '#C4BDD8',
    accent: '#B3C7FF',
    lamp: { green: '#4ADE80', amber: '#FFC53D', red: '#FF6B6B', off: '#5A4E73' },
    shadow: '#05030F',
    rimDark: '#000000',
    grid: '#F4F0FF',
    // at night the blobs glow brighter than white text can stand on, so the field carries a
    // soft violet pool under the masthead and the sentence (the lens sees it too)
    scrim: { c: '#2A1F3F', a: 0.44 },
    field: {
      // warm hues on violet go brown, so night leans pink, blue and violet
      peach: { c: '#FF7E8E', a: 0.6 },
      butter: { c: '#F59BFF', a: 0.42 }, // orchid: yellow on violet reads as mud
      sky: { c: '#3FB8FF', a: 0.62 },
      lilac: { c: '#A77BFF', a: 0.78 },
      rose: { c: '#FF5FCB', a: 0.58 },
      mint: { c: '#2FD39A', a: 0.5 },
      core: { c: '#FF6F9C', a: 0.5 },
    },
    // dark glass is a dimming tint with white rims (DESIGN.md 2.2), so white text keeps its
    // contrast over the brightest blob
    glass: {
      tint: '#181030',
      sheet: { fill: [0.52, 0.46, 0.44, 0.5], blur: 16, saturate: 1.5, bright: 0.92, floor: 0.46 },
      clear: { tint: '#FFFFFF', fill: [0.14, 0.05, 0.04, 0.1], blur: 0.35, saturate: 1.3, bright: 1.08, floor: 0.04 }, // the lens glows at night
      pill: { fill: [0.5, 0.44, 0.42, 0.48], blur: 10, saturate: 1.5, bright: 0.95, floor: 0.44 },
      rim: 0.6,
      sheen: 0.16,
      streak: 0.12,
      shadow: 0.55,
      iris: ['#FFD0E8', '#C9DCFF'],
      caustic: '#FFE9C7',
    },
  },
};

export const themes = Object.keys(palettes);

// Which text token may sit on which surface, and the ratio it needs there, so the contrast
// check knows the composite. field: small text straight on the field (over its scrim).
// display: the sentence, large text on the field. clear: the sentence under the lens. sheet
// and pill: on thick glass.
export const textOn = {
  field: { need: 4.5, tokens: ['ink', 'ink2'] },
  display: { need: 3, tokens: ['ink'] },
  clear: { need: 3, tokens: ['ink'] },
  sheet: { need: 4.5, tokens: ['ink', 'ink2', 'ink3', 'accent'] },
  pill: { need: 4.5, tokens: ['ink', 'accent'] },
};

// Type sizes in SVG units. The GitHub profile column is 846 px on a desktop and 308 px on a
// 390 phone, so an 880-unit panel shows at 0.96 and 0.35, and a 442-unit card at 49.9% at
// 0.96 and 0.35 too. 28 units is the floor for anything that must be read (about 10 px on the
// phone); the sentence at 60 units is about 21 px there.
export const type = {
  heroName: 40,
  heroLine: 28,
  sentence: 60,
  sentenceLead: 60, // line pitch of the sentence (0.98 of 60, rounded up for the lens)
  sectionWord: 48, // "now", "route": the section word in the italic serif
  rowOrg: 36,
  rowRole: 30,
  label: 28,
  ventureName: 64,
  ventureTag: 38,
  ventureLine: 30,
  cardTitle: 44,
  cardLine: 36,
  cardMeta: 28,
  routeOrg: 34,
  routeLine: 28,
  pulseLine: 30,
};

export const frame = {
  radius: 32, // the panel's outer corner
  inset: 12, // field visible around a glass sheet
  inner: 20, // a sheet's corner: concentric with the panel (32 = 20 + 12)
  pad: 28, // text inside a sheet
};

export const motion = {
  lensSeconds: 16, // the lens reads the sentence: four lines down and back
  streakSeconds: 6,
  streakLow: 0.35,
};

export const fonts = {
  display: 'instrument-serif-italic-400', // his voice
  sans: 'inter-600', // names, titles
  text: 'inter-400', // roles, dates, meta
};
