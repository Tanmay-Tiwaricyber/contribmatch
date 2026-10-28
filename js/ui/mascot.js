/**
 * The mascot: "the ink stamp".
 *
 * A near-black ink body with a lighter charcoal band across the top, paper
 * cut-outs for the belly and the eyes, and one accent-blue signature mark
 * that is the exact overlap lens from the logo.
 *
 * Dark mode inverts through tokens: the body becomes light, the cut-outs
 * become ink, so the character never disappears.
 *
 * The mascot is decorative. It is always aria-hidden, and every state it
 * shows is also stated in text next to it.
 */

const NS = 'http://www.w3.org/2000/svg';

/** The overlap lens, in the logo's 32x32 coordinate space. */
const LENS_PATH =
  'M 13.001 20.374 A 7.5 7.5 0 0 1 20.374 13.001 A 9.0 9.0 0 0 1 13.001 20.374 Z';

/** Where the lens sits on the body, and how big. */
const LENS = { cx: 60, cy: 73, width: 19 };

/** The stamp body silhouette. */
const BODY_PATH = [
  'M60 12',
  'C76 12 92 20 98 36',
  'C101 45 103 52 102 60',
  'C101 74 97 88 89 97',
  'C83 104 72 108 60 108',
  'C47 108 35 103 29 95',
  'C22 85 19 72 20 60',
  'C21 49 22 43 26 35',
  'C33 21 45 12 60 12',
  'Z',
].join(' ');

/** The belly cut-out. */
const BELLY_PATH =
  'M60 56 C74 56 85 64 85 76 C85 88 74 96 60 96 C46 96 35 88 35 76 C35 64 46 56 60 56 Z';

export const MOODS = [
  'idle',
  'thinking',
  'scouting',
  'happy',
  'celebrating',
  'oops',
  'sleepy',
];

/** Which app state each mood stands for. */
export const MOOD_MEANING = {
  idle: 'Ready',
  thinking: 'Reading your profile',
  scouting: 'Searching for issues',
  happy: 'Working',
  celebrating: 'Shortlist ready',
  oops: 'Something went wrong',
  sleepy: 'Waiting for input',
};

function svgEl(tag, attrs = {}) {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) {
    node.setAttribute(key, String(value));
  }
  return node;
}

function path(d, attrs = {}) {
  return svgEl('path', { d, ...attrs });
}

/** Eye shapes per mood. */
function eyeGroup(mood) {
  const g = svgEl('g', { class: 'mascot__face' });

  const dot = (cx, cy, r = 5.2, extra = {}) =>
    svgEl('circle', { cx, cy, r, fill: 'var(--mascot-cut)', stroke: 'none', ...extra });

  const arc = (cx, cy, r, flip) =>
    path(
      `M ${cx - r} ${cy} Q ${cx} ${cy + (flip ? -1 : 1) * r} ${cx + r} ${cy}`,
      { fill: 'none' }
    );

  const lid = (cx, cy, w = 7) =>
    path(`M ${cx - w} ${cy} Q ${cx} ${cy + 2.5} ${cx + w} ${cy}`, { fill: 'none' });

  switch (mood) {
    case 'thinking':
      g.append(dot(46, 27, 5.2), dot(74, 27, 5.2));
      g.append(
        path('M38 18 Q46 14 54 17', { fill: 'none', 'stroke-width': 2.6 }),
        path('M66 17 Q74 14 82 18', { fill: 'none', 'stroke-width': 2.6 })
      );
      break;
    case 'scouting':
      g.append(dot(48, 30, 5.2), dot(76, 30, 5.2));
      break;
    case 'happy':
      g.append(arc(46, 31, 6.5, false), arc(74, 31, 6.5, false));
      break;
    case 'celebrating':
      g.append(arc(46, 31, 7, false), arc(74, 31, 7, false));
      break;
    case 'oops':
      g.append(dot(46, 30, 6.6), dot(74, 30, 6.6));
      break;
    case 'sleepy':
      g.append(lid(46, 30), lid(74, 30));
      break;
    default:
      g.append(dot(46, 30, 5.2), dot(74, 30, 5.2));
  }
  return g;
}

/** Mouth shapes per mood. */
function mouthGroup(mood) {
  const g = svgEl('g', { class: 'mascot__mouth' });
  switch (mood) {
    case 'happy':
      g.append(path('M50 50 Q60 60 70 50', { fill: 'none' }));
      break;
    case 'celebrating':
      g.append(path('M47 48 Q60 64 73 48', { fill: 'none' }));
      break;
    case 'oops':
      g.append(path('M50 52 Q55 48 60 52 Q65 56 70 52', { fill: 'none' }));
      break;
    case 'sleepy':
      g.append(path('M54 53 Q60 56 66 53', { fill: 'none', 'stroke-width': 2.6 }));
      break;
    case 'thinking':
      g.append(path('M52 52 L68 52', { fill: 'none', 'stroke-width': 2.6 }));
      break;
    case 'scouting':
      g.append(svgEl('circle', {
        cx: 60,
        cy: 52,
        r: 3.4,
        fill: 'none',
        'stroke-width': 2.6,
      }));
      break;
    default:
      g.append(path('M52 51 Q60 54 68 51', { fill: 'none', 'stroke-width': 2.6 }));
  }
  return g;
}

/**
 * Build the mascot.
 * @param {{mood?: string, size?: string, className?: string, title?: string}} [opts]
 */
export function createMascot({ mood = 'idle', className = '', size = '' } = {}) {
  const wrap = document.createElement('div');
  wrap.className = `mascot ${className}`.trim();
  if (size) wrap.classList.add(`mascot--${size}`);
  wrap.dataset.mood = MOODS.includes(mood) ? mood : 'idle';
  wrap.setAttribute('aria-hidden', 'true');

  const svg = svgEl('svg', { viewBox: '0 0 120 120', focusable: 'false' });

  // Clip so the band never escapes the body.
  const defs = svgEl('defs');
  const clip = svgEl('clipPath', { id: 'cm-mascot-body' });
  clip.append(path(BODY_PATH));
  defs.append(clip);
  svg.append(defs);

  const body = svgEl('g', { class: 'mascot__body-group' });
  body.append(path(BODY_PATH, { class: 'mascot__body' }));

  const band = svgEl('g', { 'clip-path': 'url(#cm-mascot-body)' });
  band.append(svgEl('rect', { x: 0, y: 0, width: 120, height: 44, class: 'mascot__band' }));
  body.append(band);

  // Belly cut-out and the accent signature mark.
  body.append(path(BELLY_PATH, { class: 'mascot__cut' }));

  const scale = LENS.width / 7.373;
  const tx = LENS.cx - 16.687 * scale;
  const ty = LENS.cy - 16.687 * scale;
  body.append(
    path(LENS_PATH, {
      class: 'mascot__mark',
      transform: `translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${scale.toFixed(3)})`,
    })
  );

  svg.append(body);

  // Mood layers: one shared base, one visible expression at a time.
  for (const m of MOODS) {
    const group = svgEl('g', { class: `mascot__mood mood-${m}` });
    group.append(eyeGroup(m), mouthGroup(m));
    svg.append(group);
  }

  wrap.append(svg);
  return wrap;
}

/**
 * Change the mood of a mascot element.
 * @param {HTMLElement} node
 * @param {string} mood
 */
export function setMood(node, mood) {
  if (!node) return;
  node.dataset.mood = MOODS.includes(mood) ? mood : 'idle';
}

/** Map an agent name to a mood. */
export function moodForAgent(agent) {
  switch (agent) {
    case 'profile-agent':
      return 'thinking';
    case 'scout-agent':
      return 'scouting';
    case 'ranker-agent':
      return 'scouting';
    case 'coach-agent':
      return 'happy';
    case 'quality-guard':
      return 'celebrating';
    default:
      return 'idle';
  }
}
