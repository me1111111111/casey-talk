/*
  FACE: shows Casey's sprites.
  Every sprite is preloaded so swapping during speech does not flicker.
*/
const Face = (() => {
  const el = document.getElementById('face');
  let current = null;
  let moodTimer = null;
  let blinkTimer = null;
  let listening = false;
  let speechTimer = null;
  const speechQueue = [];
  let speechRunning = false;

  // Preload all sprites
  Object.values(CFG.sprites).forEach(src => { const i = new Image(); i.src = src; });

  function show(key) {
    const src = CFG.sprites[key];
    if (!src || key === current) return;
    current = key;
    el.src = src;
  }

  show('rest');

  // Retained for direct single-letter callers.
  function forLetter(ch) {
    const key = CFG.visemes[(ch || '').toLowerCase()];
    show(key || 'rest');
  }

  function rest() { show('rest'); }

  function speakingWord(word) {
    if (listening) return;

    const letters = (word || '').toLowerCase();
    const hasRoundVowel = /[ou]/.test(letters);
    const hasOpenVowel = /[aei]/.test(letters);
    if (hasRoundVowel || hasOpenVowel) {
      speechQueue.push({
        type: hasRoundVowel ? 'round' : 'open',
        scale: Math.max(0.75, Math.min(1.35, letters.length / 5))
      });
    }
    if (!speechRunning) runNextSpeechSequence();
  }

  function runNextSpeechSequence() {
    const item = speechQueue.shift();
    if (!item) {
      speechRunning = false;
      rest();
      return;
    }
    speechRunning = true;
    const sequence = item.type === 'round'
      ? ['rest', 'O', 'U', 'O', 'rest']
      : ['rest', 'E', 'I', 'A', 'E', 'rest'];
    const baseDurations = item.type === 'round'
      ? [0.7, 1.15, 1.5, 1.05, 0.8]
      : [0.7, 1.05, 1.35, 1.55, 1.05, 0.8];
    let index = 0;
    const step = () => {
      show(sequence[index++]);
      if (index >= sequence.length) {
        clearTimeout(speechTimer);
        speechTimer = null;
        runNextSpeechSequence();
        return;
      }
      speechTimer = setTimeout(step, CFG.talkSpriteMs * baseDurations[index - 1] * item.scale);
    };
    step();
  }

  function speechStop() {
    clearTimeout(speechTimer);
    speechTimer = null;
    speechQueue.length = 0;
    speechRunning = false;
    rest();
  }

  // Show a mood for a while, then return to rest (unless speaking changed it)
  function mood(key, ms) {
    if (listening) return;
    clearTimeout(moodTimer);
    show(key);
    moodTimer = setTimeout(() => {
      if (!listening && current === key) rest();
    }, ms);
  }

  function listenStart() {
    clearTimeout(moodTimer);
    speechStop();
    clearInterval(blinkTimer);
    listening = true;
    show('rest');
    let phase = 0;
    const blink = ['rest', 'happy', 'sleepy', 'happy', 'rest'];
    const next = () => {
      show(blink[phase]);
      phase = (phase + 1) % blink.length;
    };
    blinkTimer = setInterval(next, 180);
  }

  function listenStop() {
    listening = false;
    clearInterval(blinkTimer);
    blinkTimer = null;
    rest();
  }

  return { show, forLetter, speakingWord, speechStop, rest, mood, listenStart, listenStop };
})();
