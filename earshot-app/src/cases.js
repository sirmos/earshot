// Every mystery lives here. To add a case: add an entry, drop its pictures and audio in the folders named below.
//
// theme        = 'parlor' | 'conservatory' | 'gala'
// mode         = 'timed' (case 3): one long conversation per group with timed evidence, a countdown and a notebook.
//                Otherwise: each group has a chatter loop plus a clue file you catch by cupping.
// groups[i]    = timed: { setting, at:[x,z], members:[names], lift, boost, chatter, evidence:[{at,len,key,note}] }
//                classic: { pair:[a,b], chatter, clue, angle, startSpeaker, clueSpeaker }
//   at         = position in the party's own coordinates (forward is -z, right is +x)
//   evidence   = at/len are seconds into the chatter file; key marks the clues the answer depends on
// accuse       = questions asked in order; options are shuffled in play
// finale.appear = people who step into view when solved

const both = (...names) => names.flatMap((n) => [n, n + '-talk']);

export const CASES = [
  {
    id: 1,
    title: 'The Retirement Party',
    theme: 'parlor',
    banner: 'Happy Retirement, Margaret!',
    giftLabel: 'For Margaret',
    prop: 'gift',
    art: 'characters/',
    images: [
      'tom', 'tom-talk', 'priya', 'priya-talk', 'luca', 'luca-talk',
      'sam', 'sam-talk', 'nora', 'nora-talk', 'jim', 'jim-talk',
      'helen', 'helen-talk', 'victor', 'victor-talk', 'victor-pantry',
    ],
    intro: 'audio/intro.mp3',
    ask: 'audio/ask1.mp3',
    reveal: 'audio/reveal1.mp3',
    groups: [
      { name: 'LEFT ', pair: ['tom', 'priya'], chatter: 'audio/left-chatter.mp3', clue: 'audio/left-clue.mp3', angle: -80, startSpeaker: 0, clueSpeaker: 1 },
      { name: 'RIGHT', pair: ['luca', 'sam'], chatter: 'audio/right-chatter.mp3', clue: 'audio/right-clue.mp3', angle: 80, startSpeaker: 1, clueSpeaker: 0 },
      { name: 'FRONT', pair: ['nora', 'jim'], chatter: 'audio/front-chatter.mp3', clue: 'audio/front-clue.mp3', angle: 0, startSpeaker: 0, clueSpeaker: 1 },
    ],
    accuse: [
      { question: "Who hid Margaret's gift?", options: ['Victor', 'Sam the waiter', 'Chef Luca'], answer: 0 },
      { question: "Where is Margaret's gift hidden?", options: ['The kitchen pantry', 'The coat closet', 'Under the gift table'], answer: 0 },
    ],
    finale: {
      text: "Victor hid Margaret's gift in the kitchen pantry, and he has the key.",
      appear: [{ name: 'victor', x: 1.75, z: -2.6 }],
      picture: 'victor-pantry',
    },
  },
  {
    id: 2,
    title: 'The Golden Anniversary',
    theme: 'conservatory',
    host: [0, -3.0],
    banner: 'Happy 50th, Arthur & Beatrice!',
    prop: 'piano',
    art: 'characters/case2/',
    shared: ['helen', 'helen-talk'],
    images: [
      'dot', 'dot-talk', 'hugh', 'hugh-talk', 'mia', 'mia-talk', 'omar', 'omar-talk',
      'rosa', 'rosa-talk', 'ben', 'ben-talk', 'walter', 'walter-talk', 'lucille', 'lucille-talk',
      'winston', 'kit', 'felix', 'felix-talk',
    ],
    intro: 'audio/case2/intro.mp3',
    ask: 'audio/case2/ask.mp3',
    reveal: 'audio/case2/reveal.mp3',
    groups: [
      { name: 'FAR L', pair: ['dot', 'hugh'], chatter: 'audio/case2/g1-chatter.mp3', clue: 'audio/case2/g1-clue.mp3', angle: -100, startSpeaker: 1, clueSpeaker: 0 },
      { name: 'NEAR L', pair: ['rosa', 'ben'], chatter: 'audio/case2/g2-chatter.mp3', clue: 'audio/case2/g2-clue.mp3', angle: -35, startSpeaker: 0, clueSpeaker: 0 },
      { name: 'NEAR R', pair: ['lucille', 'walter'], chatter: 'audio/case2/g3-chatter.mp3', clue: 'audio/case2/g3-clue.mp3', angle: 35, startSpeaker: 0, clueSpeaker: 1 },
      { name: 'FAR R', pair: ['omar', 'mia'], chatter: 'audio/case2/g4-chatter.mp3', clue: 'audio/case2/g4-clue.mp3', angle: 100, startSpeaker: 0, clueSpeaker: 1 },
    ],
    accuse: [
      { question: "Who is hiding Beatrice's locket?", options: ['Winston', 'Kit', 'Felix the pianist'], answer: 2 },
      { question: "Where is Beatrice's locket?", options: ['Inside the piano', 'At the buffet', 'On the terrace'], answer: 0 },
    ],
    finale: {
      text: "Felix was keeping a promise: Arthur asked him to hide Beatrice's locket inside the piano until the toast.",
      appear: [
        { name: 'felix', x: -1.7, z: -3.05 },
        { name: 'winston', x: 2.4, z: -1.2 },
        { name: 'kit', x: -2.5, z: -0.8 },
      ],
      picture: null,
    },
  },
  {
    id: 3,
    title: 'The Lumen Awards',
    tagline: 'The Golden Waveform has vanished. Find out who took it, where it is, and why, before the ceremony begins.',
    theme: 'gala',
    mode: 'timed',
    time: 420,      // seconds until the ceremony starts
    minNotes: 6,    // notes needed before you may accuse early (look down at your notebook)
    art: 'characters/case3/',
    images: both('kai', 'nia', 'dev', 'ximena', 'jonah', 'amara', 'elias', 'sooah', 'tobias', 'imani', 'gus', 'sienna', 'marcus', 'lola', 'idris', 'tess', 'remy', 'jules'),
    // Real-world heights in metres, so tall people look tall (1.72 is the standard figure size).
    heights: {
      kai: 1.76, nia: 1.68, dev: 1.75, ximena: 1.64, jonah: 1.78, amara: 1.70, elias: 1.75, sooah: 1.62, tobias: 1.92,
      imani: 1.65, gus: 1.72, sienna: 1.66, marcus: 1.90, lola: 1.60, idris: 1.80, tess: 1.62, remy: 1.76, jules: 1.74,
    },
    host: 'jules',
    hostAt: [1.9, -2.4],
    // Where you can walk to: 'at' is where your head goes, 'look' is what the camera turns toward, 'group' is the conversation there.
    stops: [
      { name: 'ENTRANCE', at: [0, 0], look: [0, -9] },
      { name: 'GREEN ROOM', at: [-3.1, -0.9], look: [-5.2, -1.6], group: 5 },
      { name: 'TALL TABLE', at: [2.6, -0.9], look: [4.6, -2.2], group: 4 },
      { name: 'POOL BAR', at: [-4.5, -4.5], look: [-6.5, -6.0], group: 0 },
      { name: 'LOUNGE', at: [4.6, -5.0], look: [6.5, -6.5], group: 1 },
      { name: 'BISTRO', at: [-4.6, -9.3], look: [-6.4, -10.6], group: 3 },
      { name: 'STAGE', at: [0.6, -11.6], look: [0.6, -13.6], group: 2 },
    ],
    intro: 'audio/case3/intro.mp3',
    ask: 'audio/case3/ask.mp3',
    reveal: 'audio/case3/reveal.mp3',
    groups: [
      { name: 'BAR', setting: 'bar', at: [-6.5, -6.0], boost: 1.2, members: ['kai', 'nia', 'dev'],
        chatter: 'audio/case3/g1.mp3',
        evidence: [
          { at: 52, len: 11, key: false, note: 'Dev was on a call by the deep end from 8:10 to 8:20. Kai saw him.' },
          { at: 82, len: 12, key: true, note: 'Kai: about 8:15 someone with a tablet carried a long flat case into the locked pool house.' },
        ] },
      { name: 'LOUNGE', setting: 'lounge', at: [6.5, -6.5], boost: 1.2, members: ['ximena', 'jonah', 'amara'],
        chatter: 'audio/case3/g2.mp3',
        evidence: [
          { at: 38, len: 10, key: false, note: 'Amara: the Academy chair hinted Sienna will win. Only a rumour.' },
          { at: 65.5, len: 9, key: true, note: "Jonah's stream: the trophy was still on its plinth at 8:12." },
        ] },
      { name: 'TRIO', setting: 'stage', at: [0.6, -13.6], lift: 0.2, boost: 1.5, members: ['elias', 'sooah', 'tobias'],
        chatter: 'audio/case3/g3.mp3',
        evidence: [
          { at: 37.5, len: 10, key: false, note: 'The trio saw a waiter in a white jacket hovering by the plinth.' },
          { at: 71, len: 17, key: true, note: 'The trio: about 8:15 someone in black with a headset and a tablet put the trophy in a flight case and walked toward the pool house.' },
        ] },
      { name: 'BISTRO', setting: 'bistro', at: [-6.4, -10.6], boost: 1.4, members: ['imani', 'gus'],
        chatter: 'audio/case3/g4.mp3',
        evidence: [
          { at: 50, len: 15, key: true, note: 'Dr. Imani: the Artist of the Year nameplate has a misspelling. A corrected plate arrives tonight. Keep it quiet.' },
          { at: 92, len: 15, key: true, note: 'Gus: Tess, the stage manager, borrowed a screwdriver and a polishing cloth at 8:10 for a nameplate.' },
        ] },
      { name: 'TALL', setting: 'tall', at: [4.6, -2.2], members: ['sienna', 'marcus', 'lola', 'idris'],
        chatter: 'audio/case3/g5.mp3',
        evidence: [
          { at: 50, len: 10, key: false, note: 'Idris was at this table all evening. Lola took a group photo with him at 8:15.' },
          { at: 83.5, len: 20, key: false, note: 'Lola saw Remy photographing the plinth. Marcus saw Remy on the press line at 8:14.' },
        ] },
      { name: 'DOOR', setting: 'door', at: [-5.2, -1.6], members: ['tess', 'remy'],
        chatter: 'audio/case3/g6.mp3',
        evidence: [
          { at: 23, len: 17, key: true, note: 'Tess, on her headset: the engraver should come round by the pool and use the glass cabin. Do not tell Jules.' },
          { at: 51.5, len: 12, key: true, note: 'Tess told Remy to say the trophy is "being polished".' },
        ] },
    ],
    accuse: [
      { question: 'Who took the Golden Waveform?', options: ['Tess, the stage manager', 'Idris, the rival nominee', 'Remy, the publicist'], answer: 0 },
      { question: 'Where is it now?', options: ['The pool house', 'The green room', 'At the bottom of the pool'], answer: 0 },
      { question: 'Why was it taken?', options: ['To fix a misspelled nameplate', 'To rig the winner', 'As a stunt for the livestream'], answer: 0 },
    ],
    finale: {
      text: 'Tess took the Golden Waveform to the pool house so the engraver could fix a misspelled nameplate.',
      appear: [{ name: 'tess', x: 7.75, z: -10.5 }],
      hostPath: [[3.7, -4.5], [3.9, -9.0], [7.35, -9.4]],  // Jules walks this route to stand beside Tess while he reveals the answer
      stop: { at: [4.0, -8.7], look: [8.0, -10.0] },       // the camera walks here to watch the pool house open
      picture: null,
    },
  },
];