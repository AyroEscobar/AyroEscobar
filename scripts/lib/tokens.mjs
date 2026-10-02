// Design tokens: the only place a color, a type size or a motion duration lives.
// Mirrors the Sodium direction of ayroescobar.com: night blue, sodium amber for what is
// done, cool LED white for what is now, one red beacon for the single live thing.
// Dark is the default. Light is "dawn": overcast concrete, not cream.

export const palettes = {
  dark: {
    night: '#0B1226', // panel background
    deck: '#121B33', // raised plates: cards, the venture plate, the sign housing
    ink: '#F3ECDF', // names and primary text            15.8:1 on night
    dim: '#9AA7C2', // dates, roles, metadata             7.7:1
    sodium: '#FFA53D', // past work, lit traces, links (text) 9.5:1
    sodiumStroke: '#FFA53D', // the same hue for strokes
    led: '#D6E6FF', // current work and "now"             14.7:1
    beacon: '#FF5A47', // the one live indicator, never text 6.0:1
    trace: '#2A3757', // unlit roads, unlit sign dots (decorative)
    traceLit: '#5A6C96', // frames and hairlines             3.6:1 (non-text)
    green: '#5BD68A', // starboard position light on the venture plate, nowhere else
    haze: 0.1, // opacity of the sodium haze over the hero's lit district
  },
  light: {
    night: '#E9ECF1',
    deck: '#DDE2EA',
    ink: '#0B1226', // 15.7:1 on night, 14.3:1 on deck
    dim: '#4A5672', // 6.2:1, 5.6:1
    sodium: '#9A4A00', // 5.3:1, 4.8:1 (text)
    sodiumStroke: '#C45C00', // 3.6:1 (non-text)
    led: '#2B4C9B', // 6.8:1, 6.2:1
    beacon: '#B8261A', // 5.3:1
    trace: '#C5CCDA',
    traceLit: '#6E7B98', // 3.6:1, 3.3:1 (non-text); the plan's #8A97B4 measured 2.5:1
    green: '#1F8A4C',
    haze: 0.07,
  },
};

export const themes = Object.keys(palettes);

// Type sizes in SVG units. The GitHub profile column is 308 px at a 390 phone, 278 at 360
// (scale 0.35 for an 880 panel, 0.348 for a 442-unit card at 49.9%), so every content line is
// 36 units, about 12.5 px on that phone, and the pulse stamp is 34 (it repeats in the alt and
// the footer). The 22-unit label is decoration and is repeated in the alt text or the Markdown.
export const type = {
  heroName: 112,
  heroLine: 36,
  label: 22,
  routeOrg: 36,
  routeLine: 36,
  ventureName: 64,
  ventureLine: 36,
  cardTitle: 44,
  cardLine: 36,
  pulseLine: 34,
};

export const frame = {
  radius: 14, // panel corner radius
  hairline: 1, // frame stroke
  hairlineOpacity: 0.7,
};

export const motion = {
  beaconSeconds: 3, // aircraft obstruction light: a slow red cycle
  beaconLow: 0.25,
  packetSeconds: 7, // constant speed, linear, like traffic
  packetLength: 40,
};

export const fonts = {
  display: 'overpass-900', // Overpass at wght 900, outlined to paths
  mono: 'overpass-mono-500', // Overpass Mono at wght 500, outlined to paths
};
