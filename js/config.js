/*
  CONFIG: edit this file to change which sprite Casey uses for each sound.
  Sprite files live in assets/sprite/ and use the names from the Drive folder.
*/
const CFG = {
  // Sprite for each mouth or expression state
  sprites: {
    rest:  'assets/sprite/Mouth_Closed.png',      // closed smile (idle)
    sad:   'assets/sprite/Mouth_Closed_Sad.png',  // when you leave
    happy: 'assets/sprite/Eyes_Narrowing2.png',   // greetings
    sleepy:'assets/sprite/Eyes_Closed.png',       // calm, heavy-lidded
    A:     'assets/sprite/A.png',                 // wide open
    E:     'assets/sprite/AE.png',                // teeth, wide
    I:     'assets/sprite/EI.png',                // teeth, narrow
    O:     'assets/sprite/O.png',                 // round
    U:     'assets/sprite/OA.png'                 // pursed
  },

  // Which letter makes which vowel sprite while Casey speaks
  visemes: { a: 'A', e: 'E', i: 'I', o: 'O', u: 'U' },

  // Typing and speech speed (ms per character)
  typeSpeed: 55,      // Casey's spoken lines
  talkSpriteMs: 115,  // base timing for talking sprites
  bootSpeed: 14,      // boot text
  echoSpeed: 8,       // your own typed lines

  // Listening
  nameMaxMs: 15000,   // how long to wait for your name to start
  nameSilenceMs: 2500,// pause that ends your name
  turnMaxMs: 25000,   // longest a spoken message can run
  turnSilenceMs: 3000,// pause that ends a spoken message

  // Uncanny escalation: total minutes on the site
  stageSeconds: [120, 300, 600],

  // Summon: start calling your name after this much silence (ms)
  summonAfterMs: 40000
};
