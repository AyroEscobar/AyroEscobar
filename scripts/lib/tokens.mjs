// Design tokens: the only place a colour, a type size or a glass value lives. Mirrors v3 of
// ayroescobar.com (the boulder, DESIGN.md section 2): two hues and white on a night mountain.
// GitHub's dark theme gets the night (the hero frame at p = 0); its light theme gets the same
// world above the weather (the end frame at p = 1, the sky's lower third gone cold and pale).
// The glass is the site's thick glass in both: a light fill, a 62% void scrim under copy, the
// rim lit cyan-white on the side facing the rock. So white type works in both themes.

const shared = {
  ink: '#F6FBFF', // names, headings
  ink2: '#DFE6F3', // roles, body lines
  ink3: '#C3CEDD', // dates and the sync stamp, only on the scrim
  accent: '#19E6FF', // cyan: eyebrows, domains, what is now
  magenta: '#FF3DBB', // the scene and the rim only, never text
  void: '#05060D',
  shadow: '#000000',
};

export const palettes = {
  dark: {
    ...shared,
    world: {
      zenith: '#05070F',
      horizon: '#143852', // the sky's horizon band
      glowA: '#0E7A8F', // the city-side glow in the sky
      ridge: '#0C2236', // the far ridge: lighter than the slope, darker than the sky
      slope: '#1C2231', // wet stone
      slopeLow: '#121725',
      contour: '#1FD2EE', // hairlines on the slope
      contourA: 0.3,
      stars: 0.75,
    },
    // what can sit under text at full strength, for the contrast check
    field: {
      horizon: { c: '#143852', a: 1 },
      glowA: { c: '#0E7A8F', a: 1 },
      rock: { c: '#19E6FF', a: 0.42 }, // the rock's light leaking into a panel
      rim: { c: '#FF3DBB', a: 0.34 },
    },
    glass: { blur: 14, saturate: 1.9, bright: 1.07, fill: [0.1, 0.06, 0.06, 0.07], fillMin: 0.06, scrim: 0.62, rim: 0.95 },
  },
  light: {
    ...shared,
    world: {
      zenith: '#3F6C84',
      horizon: '#A9D8F0', // the cold band above the weather (no warm term, ever)
      glowA: '#7FB4CC',
      ridge: '#4A6886',
      slope: '#2A3A62',
      slopeLow: '#202D50',
      contour: '#DDF2FF', // the contours whiten above the weather
      contourA: 0.42,
      stars: 0.3,
    },
    field: {
      horizon: { c: '#A9D8F0', a: 1 },
      glowA: { c: '#7FB4CC', a: 1 },
      rock: { c: '#19E6FF', a: 0.36 },
      rim: { c: '#FF3DBB', a: 0.26 },
    },
    glass: { blur: 14, saturate: 1.9, bright: 1.07, fill: [0.1, 0.06, 0.06, 0.07], fillMin: 0.06, scrim: 0.7, rim: 0.95 }, // the site raises --scrim to .70 above the weather
  },
};

export const themes = ['dark', 'light'];

// Which text token may sit on the glass scrim and the ratio it needs there. All copy in the
// panels sits on the scrim (the void pool under copy); none stands on the open world.
export const textOn = {
  scrim: { need: 4.5, tokens: ['ink', 'ink2', 'ink3', 'accent'] },
};

// Type sizes in SVG units. The GitHub profile column is 846 px on a desktop and 308 px on a
// 390 phone, so an 880-unit panel shows at 0.96 and 0.35. 28 units is the floor for anything
// that must be read (about 10 px on the phone).
export const type = {
  eyebrow: 28,
  cardName: 56,
  cardTag: 34,
  cardBlurb: 29,
  domain: 28,
  rowOrg: 34,
  rowLine: 28,
  pulseLine: 28,
};

export const frame = {
  radius: 32, // the panel's outer corner
  inset: 12, // world visible around a glass sheet
  inner: 22, // a sheet's corner (the site's --r-panel)
};

export const fonts = {
  display: 'inter-700', // names
  sans: 'inter-600', // orgs, headlines, eyebrows
  text: 'inter-400', // roles, dates, body
};
