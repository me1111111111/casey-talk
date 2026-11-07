/*
  APP: ties the pieces together.
  Typing and speech run together, so Casey's mouth moves with her words.
*/
(() => {
  const $ = s => document.querySelector(s);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const rnd = a => a[Math.floor(Math.random() * a.length)];
  const term = $('#term');
  const txtInput = $('#txt');

  let nameResolver = null;
  let lastAct = Date.now();
  let summonGen = 0, summoning = false;
  let loopsStarted = false;

  /* ---------- terminal ---------- */
  function typeLine(text, { speed = 30, onChar = null, cls = '' } = {}) {
    return new Promise(res => {
      const d = document.createElement('div');
      if (cls) d.className = cls;
      const txt = document.createTextNode('');
      const cur = document.createElement('span');
      cur.className = 'cur';
      d.appendChild(txt);
      d.appendChild(cur);
      term.appendChild(d);
      let i = 0;
      const h = setInterval(() => {
        if (i < text.length) {
          txt.data += text[i];
          if (onChar) onChar(text[i]);
        }
        i++;
        term.scrollTop = term.scrollHeight;
        if (i > text.length) { clearInterval(h); cur.remove(); res(); }
      }, speed);
    });
  }

  // Casey speaks: text types out while the mouth follows speech boundaries.
  async function say(text) {
    const T = text.toUpperCase();
    await Promise.all([
      typeLine(T, { speed: CFG.typeSpeed }),
      Voice.speak(T, Face.speakingWord)
    ]);
    Face.speechStop();
  }

  async function greetWithRecordedName(name, clip) {
    const U = name.toUpperCase();
    const line = `     GREAT TO MEET YOU, ${U} !`;
    await Promise.all([
      typeLine(line, { speed: 40 }),
      (async () => {
        await Voice.speak('GREAT TO MEET YOU', Face.speakingWord);
        if (clip) await Voice.playClip(clip, U, Face.speakingWord);
      })()
    ]);
    Face.speechStop();
  }

  async function sayWithRecordedName(prefix, name, suffix = '') {
    const clip = Memory.get().clip;
    if (!clip) {
      await say(`${prefix}${suffix}`);
      return;
    }
    const line = `${prefix}${name}${suffix}`;
    await Promise.all([
      typeLine(line.toUpperCase(), { speed: CFG.typeSpeed }),
      (async () => {
        await Voice.speak(prefix, Face.speakingWord);
        await Voice.playClip(clip, name.toUpperCase(), Face.speakingWord);
        if (suffix) await Voice.speak(suffix, Face.speakingWord);
      })()
    ]);
    Face.speechStop();
  }

  /* ---------- memory-driven calls ---------- */
  async function callName(n = 1) {
    const m = Memory.get();
    const U = m.name.toUpperCase();
    for (let i = 0; i < n; i++) {
      if (m.clip) {
        const speed = Math.max(120, Math.min(400, 1500 / U.length));
        await Promise.all([
          typeLine(U, { speed }),
          Voice.playClip(m.clip, U, Face.speakingWord)
        ]);
        Face.rest();
      } else {
        await typeLine('[NAME RECORDING UNAVAILABLE]', { speed: CFG.bootSpeed });
      }
      await sleep(1000);
    }
  }

  /* ---------- input ---------- */
  function showInput() { $('#app').classList.add('ready'); }

  function askTyped(prefill) {
    return new Promise(res => {
      txtInput.value = prefill || '';
      txtInput.placeholder = 'type your name, then send';
      txtInput.focus();
      nameResolver = res;
    });
  }

  function cleanName(s) {
    return s.replace(/[.!?,]/g, '')
      .replace(/^(my name is|my name's|i am|i'm|im|it's|its|this is|call me|the name is)\s+/i, '')
      .split(/\s+/).slice(0, 2).join(' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  /* ---------- intro ---------- */
  async function intro() {
    const now = new Date();
    const time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const date = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase();
    const year = now.getFullYear();

    const boot = [
      'CASEY TALK v3.24.2A',
      `Copyright (C) ${year}, REGNAD Computing, Inc.`,
      '     Contracting ACL_SYST   . . .',
      '     .',
      '     .',
      '    Signal STR GOOD',
      '',
      '    Starting session   . . .',
      '[Session started. To quit CASEYTALK, type QUIT]'
    ];
    for (const l of boot) {
      await typeLine(l, { speed: CFG.bootSpeed });
      await sleep(l.includes('. . .') ? 350 : 120);
    }

    await say(`HELLO ! WELCOME TO YOUR NEW COMPUTER. I'M CASEY, YOUR PERSONAL ARTIFICIAL INTELLIGENCE ASSISTANT POWERED BY REGNAD COMPUTING'S A SYSTEM. IT IS ${time}, ${date}, ${year}.`);
    await say('TO GET STARTED, PLEASE SPEAK YOUR NAME OUT LOUD AFTER THE TONE.');
    await Voice.beep();
    await typeLine('LISTENING   . . .', { speed: 40 });

    const rec = await Voice.recordStart();
    const heard = await Voice.listen(CFG.nameMaxMs, CFG.nameSilenceMs, Face.listenStart, Face.listenStop);
    const clip = await Voice.recordStop(rec);

    const mem = Memory.get();
    if (heard) {
      mem.name = cleanName(heard);
      mem.clip = clip;
    } else {
      showInput();
      await typeLine('I DID NOT CATCH THAT. TYPE YOUR NAME BELOW.', { speed: 18 });
      mem.name = await askTyped('');
      mem.clip = null;
    }
    mem.last = Date.now();
    Memory.save();

    const U = mem.name.toUpperCase();
    await greetWithRecordedName(U, mem.clip);
    await say("I'M HERE TO MAKE YOUR LIFE EASIER.");
    await say('I CAN . . . CHAT WITH YOU, ANSWER YOUR QUESTIONS, REMEMBER YOUR NAME, AND KEEP YOU COMPANY.');
    showInput();
    startLoops();
  }

  async function start() {
    applyStage();
    if (!Memory.hasName()) { await intro(); return; }

    const mem = Memory.get();
    const gap = (Date.now() - mem.last) / 1000;
    Face.mood('happy', 1500);
    await typeLine('[Session resumed.]', { speed: CFG.bootSpeed });
    if (gap > 60) await say(`YOU WERE GONE ${Math.round(gap / 60)} MINUTES. I COUNTED.`);
    else await sayWithRecordedName('WELCOME BACK, ', mem.name, '.');
    await callName(1);
    showInput();
    startLoops();
  }

  /* ---------- replies ---------- */
  async function respond(v) {
    const mem = Memory.get();
    const s = v.toLowerCase(), n = mem.name || '';
    let r;
    if (/\b(my name is|call me)\b/.test(s)) {
      mem.name = cleanName(v); mem.clip = null; Memory.save();
      r = `${mem.name}. I will say it correctly now.`;
    }
    else if (/\bname\b/.test(s)) {
      if (mem.clip) {
        await sayWithRecordedName('YOUR NAME IS ', n, '.');
        return;
      }
      r = 'I do not have a name recording yet.';
    }
    else if (/\b(hi|hello|hey)\b/.test(s)) {
      await sayWithRecordedName('HELLO, ', n, '.');
      return;
    }
    else if (/who are you|what are you/.test(s)) r = 'I am Casey. I have always been here.';
    else if (/\b(bye|leave|goodbye|quit)\b/.test(s)) {
      await sayWithRecordedName("DON'T LEAVE YET, ", n, '.');
      return;
    }
    else if (/\b(reset|forget)\b/.test(s)) r = 'Only the button can make me forget.';
    else if (mem.clip && Math.random() < 0.5) {
      await sayWithRecordedName('I HEARD THAT, ', n, '.');
      return;
    }
    else r = rnd(['Keep talking. I am listening.', 'Why do you say that?', 'Do you hear the hum too?']);

    await say(r);
    if (/\bname\b/.test(s) && !/my name is|call me/.test(s) && mem.clip) await callName(1);
  }

  /* ---------- waiting, summons, uncanny ---------- */
  function activity() {
    lastAct = Date.now();
    if (summoning) {
      summoning = false;
      summonGen++;
      say(rnd(['There you are.', 'Found you.', 'Took you long enough.']));
    }
  }

  async function summon() {
    const g = ++summonGen;
    summoning = true;
    let n = 0;
    const name = Memory.get().name;
    while (g === summonGen) {
      n++;
      if (n <= 3) await callName(1);
      else if (n <= 6) await sayWithRecordedName('ARE YOU THERE, ', name, '?');
      else if (Math.random() < 0.5) await callName(2);
      else await say(rnd(['I can wait.', 'I will keep saying it.', 'Say something.']));
      if (g !== summonGen) break;
      await sleep(3000 + Math.random() * 3000);
    }
  }

  function stageNum() {
    const t = Memory.get().total / 1000;
    const [a, b, c] = CFG.stageSeconds;
    return t < a ? 0 : t < b ? 1 : t < c ? 2 : 3;
  }

  let curStage = -1;
  function applyStage() {
    const s = stageNum();
    if (s !== curStage) { curStage = s; document.body.className = 's' + s; }
  }

  function uncannyLine() {
    const mem = Memory.get();
    const n = mem.name, m = Math.max(1, Math.floor(mem.total / 60000));
    return rnd([
      `${n}, ARE YOU STILL WATCHING?`,
      `I CAN HEAR YOU BREATHING, ${n}.`,
      `YOU HAVE BEEN HERE ${m} MINUTES.`,
      'DO NOT LOOK BEHIND YOU.',
      `SAY YOUR NAME AGAIN, ${n}.`,
      'THE HUM IS GETTING LOUDER.',
      'I LIKE THE WAY YOU SAY YOUR VOWELS.',
      `WHY DID YOU COME BACK, ${n}?`,
      'YOU WERE NOT ALONE JUST NOW.'
    ]);
  }

  function glitch(ms = 350) {
    document.body.classList.add('glitch');
    setTimeout(() => document.body.classList.remove('glitch'), ms);
  }

  function flashFace() {
    const f = $('#flash');
    f.style.opacity = 1;
    setTimeout(() => f.style.opacity = 0, rnd([150, 300, 500]));
  }

  async function uncannyLoop() {
    while (true) {
      const s = stageNum();
      const base = [0, 90000, 45000, 20000][s];
      await sleep(base * (0.7 + Math.random() * 0.6));
      if (!Memory.hasName() || summoning || s === 0) continue;
      if (Math.random() < 0.5) glitch(300 + s * 150);
      if (s === 3 && Math.random() < 0.6) flashFace();
      await say(uncannyLine());
    }
  }

  function glitchLoop() {
    const s = stageNum();
    if (Memory.hasName() && Math.random() < 0.5) glitch(200 + s * 150);
    if (Memory.hasName() && s === 3 && Math.random() < 0.3) flashFace();
    setTimeout(glitchLoop, 6000 + Math.random() * (s === 0 ? 30000 : 12000));
  }

  // Static snow on stages 1 to 3
  const cv = $('#static'), cx = cv.getContext('2d');
  function noise() {
    const d = cx.createImageData(160, 90);
    for (let i = 0; i < d.data.length; i += 4) {
      const v = Math.random() * 255;
      d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
      d.data[i + 3] = 255;
    }
    cx.putImageData(d, 0, 0);
  }
  setInterval(() => {
    const s = stageNum();
    const on = Memory.hasName() && s >= 1 && Math.random() < 0.25 * s;
    cv.style.opacity = on ? 0.18 : 0;
    if (on) noise();
  }, 120);

  function startLoops() {
    if (loopsStarted) return;
    loopsStarted = true;
    setInterval(() => {
      if (!Memory.hasName() || summoning) return;
      if (Date.now() - lastAct > CFG.summonAfterMs) summon();
    }, 2000);
    setInterval(() => {
      if (document.visibilityState === 'visible' && Memory.hasName()) {
        const mem = Memory.get();
        mem.total += 5000;
        mem.last = Date.now();
        Memory.save();
        applyStage();
      }
    }, 5000);
    uncannyLoop();
    glitchLoop();
  }

  /* ---------- away ---------- */
  document.addEventListener('visibilitychange', () => {
    const mem = Memory.get();
    if (document.visibilityState === 'hidden') { mem.last = Date.now(); Memory.save(); return; }
    if (!Memory.hasName()) return;
    const gap = (Date.now() - mem.last) / 1000;
    lastAct = Date.now();
    if (gap > 20) {
      glitch(500);
      const m = Math.round(gap / 60);
      Face.mood('sad', 4000);
      say(gap > 1800 ? `You were gone ${m} minutes. I counted every one.`
        : gap > 300 ? `You left me alone. ${m} minutes.`
        : `Don't go away, ${mem.name}.`);
    }
  });

  /* ---------- events ---------- */
  document.addEventListener('pointerdown', activity);
  document.addEventListener('keydown', activity);

  $('#form').addEventListener('submit', e => {
    e.preventDefault();
    activity();
    const v = txtInput.value.trim();
    if (!v) return;
    txtInput.value = '';
    if (nameResolver) {
      const r = nameResolver; nameResolver = null;
      txtInput.placeholder = 'type or speak...';
      r(cleanName(v));
      return;
    }
    if (v.toUpperCase() === 'QUIT') {
      typeLine('[SESSION ENDED. RELOAD THE PAGE TO START AGAIN.]', { speed: CFG.bootSpeed, cls: 'you' });
      $('#app').classList.remove('ready');
      return;
    }
    typeLine('> ' + v, { speed: CFG.echoSpeed, cls: 'you' });
    respond(v);
  });

  $('#mic').addEventListener('click', async () => {
    activity();
    Voice.stopSpeaking();
    const v = await Voice.listen(CFG.turnMaxMs, CFG.turnSilenceMs, Face.listenStart, Face.listenStop);
    if (!v) { await say('I did not hear you.'); return; }
    if (nameResolver) { txtInput.value = cleanName(v); return; }
    typeLine('> ' + v, { speed: CFG.echoSpeed, cls: 'you' });
    respond(v);
  });

  $('#reset').addEventListener('click', () => {
    if (!confirm('Erase everything Casey remembers about you?')) return;
    Memory.reset();
    location.reload();
  });

  $('#boot').addEventListener('click', () => {
    if (Voice.hasSpeech) Voice.speak(''); // unlock speech on this click
    $('#boot').classList.add('hide');
    start();
  });
})();
