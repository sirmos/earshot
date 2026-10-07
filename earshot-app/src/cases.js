// Every mystery lives here. To add a case: add an entry, drop its pictures and audio in the
// folders named below, and the game picks it up (the case file lists it automatically).
//
// theme               = the room's setting: 'parlor' (default, classic dining room) or 'conservatory' (moonlit garden)
// host                = [x, z] where Helen stands (optional). Keep her clear of the line of sight behind any guest pair.
// groups[i].pair      = [left guest, right guest] (picture names, lowercase)
// startSpeaker/clueSpeaker = 0 or 1, which of the pair talks first / gives the clue
// angle               = degrees from straight ahead (negative = left, positive = right)
// accuse              = a list of questions, asked in order. Each has options and the index of the right one
//                       (options are shuffled in play). A single object also works.
// finale.appear       = people who step into view when solved (x, z in room units; door is at x 1.9, z -3.44)
// finale.picture      = picture shown above the door when solved
// ask / reveal        = optional Helen audio (the game works without them)

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
    host: [0, -3.0], // straight ahead at the back: no guest pair stands in front of her
    banner: 'Happy 50th, Arthur & Beatrice!',
    prop: 'piano',
    art: 'characters/case2/',
    shared: ['helen', 'helen-talk'],
    images: [
      'dot', 'dot-talk', 'hugh', 'hugh-talk', 'mia', 'mia-talk', 'omar', 'omar-talk',
      'rosa', 'rosa-talk', 'ben', 'ben-talk', 'walter', 'walter-talk', 'lucille', 'lucille-talk',
      'winston', 'kit', 'felix', 'felix-talk', 'felix-piano',
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
        { name: 'felix', x: -2.65, z: -2.2 },
        { name: 'winston', x: 2.4, z: -1.2 },
        { name: 'kit', x: -2.5, z: -0.8 },
      ],
      picture: 'felix-piano',
    },
  },
];