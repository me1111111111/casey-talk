/*
  VOICE: everything audio.
  - Casey speaks with the browser's speech synthesis
  - listen() waits for a pause before it finishes
  - recordName() records your voice so Casey can play it back
*/
const Voice = (() => {
  const synth = window.speechSynthesis || null;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition || null;

  // Pick a female English voice if the browser has one. Voices load late, so ask each time.
  function pickVoice() {
    if (!synth) return null;
    const en = synth.getVoices().filter(v => /^en/i.test(v.lang));
    return en.find(v => /google uk english female|microsoft (hazel|libby|zira|aria)|samantha|karen|moira/i.test(v.name))
        || en.find(v => /female/i.test(v.name))
        || en.find(v => /google/i.test(v.name))
        || en[0] || null;
  }

  const toneSettings = {
    excited: { pitch: 1.3, rate: 1.1 },
    sad: { pitch: 0.6, rate: 0.75 },
    fast: { pitch: 1, rate: 1.6 },
    normal: { pitch: 0.62, rate: 0.82 }
  };

  // Speak a line. Resolves when the voice finishes (or a safety timeout passes).
  function speak(text, onWord, tone = 'normal') {
    return new Promise(res => {
      if (!synth) {
        if (onWord) onWord(text);
        return res();
      }
      const spokenText = text.replace(/\./g, '').replace(/\bfull stop\b/gi, '');
      const u = new SpeechSynthesisUtterance(spokenText);
      u.voice = pickVoice();
      const settings = toneSettings[tone] || toneSettings.normal;
      u.rate = settings.rate;
      u.pitch = settings.pitch;
      u.volume = 1;
      u.onboundary = e => {
        if (onWord && Number.isInteger(e.charIndex)) {
          const start = e.charIndex;
          const match = spokenText.slice(start).match(/^\S+/);
          onWord(match ? match[0] : spokenText[start]);
        }
      };
      const safety = setTimeout(res, text.length * 130 + 4000);
      u.onend = u.onerror = () => { clearTimeout(safety); res(); };
      synth.cancel();
      synth.speak(u);
    });
  }

  function stopSpeaking() { if (synth) synth.cancel(); }

  // Short tone before listening
  function beep() {
    return new Promise(res => {
      try {
        const ac = new (window.AudioContext || window.webkitAudioContext)();
        const o = ac.createOscillator(), g = ac.createGain();
        o.frequency.value = 880; g.gain.value = 0.15;
        o.connect(g); g.connect(ac.destination);
        o.start(); o.stop(ac.currentTime + 0.35);
        setTimeout(res, 450);
      } catch (e) { setTimeout(res, 200); }
    });
  }

  // Listen until the user pauses. maxMs is the longest wait; silenceMs is the pause that ends the turn.
  function listen(maxMs, silenceMs, onStart, onFinish) {
    return new Promise(res => {
      if (!SR) return res(null);
      const r = new SR();
      r.lang = 'en-US';
      r.interimResults = false;
      r.continuous = true;
      r.maxAlternatives = 1;

      const parts = [];
      let done = false, silence, max;
      const micBtn = document.getElementById('mic');

      function finish() {
        if (done) return;
        done = true;
        clearTimeout(silence); clearTimeout(max);
        micBtn.classList.remove('on');
        try { r.stop(); } catch (e) {}
        if (onFinish) onFinish();
        res(parts.join(' ').replace(/\s+/g, ' ').trim() || null);
      }
      function arm(ms) { clearTimeout(silence); silence = setTimeout(finish, ms); }

      r.onresult = e => {
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) parts.push(e.results[i][0].transcript.trim());
        }
        arm(silenceMs);
      };
      r.onerror = finish;
      r.onend = finish;

      max = setTimeout(finish, maxMs);
      try {
        r.start();
        micBtn.classList.add('on');
        arm(silenceMs * 2); // allow a longer wait before the user starts talking
        if (onStart) onStart();
      } catch (e) { finish(); }
    });
  }

  // Record the user's voice while they say their name. Returns a data URL or null.
  async function recordStart() {
    try {
      if (!navigator.mediaDevices || !window.MediaRecorder) return null;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks = [];
      rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
      rec.start();
      return { rec, stream, chunks };
    } catch (e) { return null; }
  }

  function recordStop(h) {
    return new Promise(res => {
      if (!h) return res(null);
      h.rec.onstop = () => {
        h.stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(h.chunks, { type: h.rec.mimeType || 'audio/webm' });
        const fr = new FileReader();
        fr.onload = () => res(fr.result && fr.result.length > 300 ? fr.result : null);
        fr.onerror = () => res(null);
        fr.readAsDataURL(blob);
      };
      try { if (h.rec.state !== 'inactive') h.rec.stop(); else h.rec.onstop(); }
      catch (e) { res(null); }
    });
  }

  // Play a stored clip. Resolves when it ends or after 4 seconds.
  function playClip(dataUrl, text = '', onWord = null) {
    if (!dataUrl) return Promise.resolve();
    const a = new Audio(dataUrl);
    let lastWord = '';
    const updateFace = () => {
      if (!onWord || !text || !a.duration || !Number.isFinite(a.duration)) return;
      const index = Math.min(text.length - 1, Math.floor(a.currentTime / a.duration * text.length));
      const match = text.slice(0, index + 1).match(/\S+$/);
      const word = match ? match[0] : '';
      if (word && word !== lastWord) {
        lastWord = word;
        onWord(word);
      }
    };
    a.ontimeupdate = updateFace;
    a.play().catch(() => {});
    return new Promise(r => {
      const timeout = setTimeout(finish, 4000);
      function finish() {
        clearTimeout(timeout);
        a.ontimeupdate = null;
        if (onWord) onWord('');
        r();
      }
      a.onended = finish;
      a.onerror = finish;
    });
  }

  return { speak, stopSpeaking, beep, listen, recordStart, recordStop, playClip, hasSpeechRecognition: !!SR, hasSpeech: !!synth };
})();
