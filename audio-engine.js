/**
 * =========================================================
 * LINGUAPATH - AUDIO ENGINE & iOS SAFARI UNLOCKER (audio-engine.js)
 * High-performance, zero-latency audio playback, Web Audio tone synthesis,
 * pre-buffering cache, and iOS Safari autoplay restriction unlocker.
 * =========================================================
 */

(function () {
  'use strict';

  let sharedAudioCtx = null;
  let isUnlocked = false;
  const audioCache = new Map();

  // Initialize or retrieve singleton AudioContext
  function getAudioContext() {
    if (!sharedAudioCtx) {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (AudioCtxClass) {
        sharedAudioCtx = new AudioCtxClass();
      }
    }
    if (sharedAudioCtx && sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {});
    }
    return sharedAudioCtx;
  }

  // Unlock iOS Safari Web Audio & HTMLAudioElement on first user interaction
  function unlockAudio() {
    if (isUnlocked) return;

    try {
      const ctx = getAudioContext();
      if (ctx) {
        // Play an inaudible 1-sample buffer to unlock the audio hardware
        const buffer = ctx.createBuffer(1, 1, 22050);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start(0);

        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }
      }

      // Warm up SpeechSynthesis on iOS Safari
      if (window.speechSynthesis && typeof window.SpeechSynthesisUtterance !== 'undefined') {
        const warmUtterance = new SpeechSynthesisUtterance('');
        warmUtterance.volume = 0;
        window.speechSynthesis.speak(warmUtterance);
      }

      isUnlocked = true;
    } catch (e) {
      console.warn('Audio unlock note:', e);
    }
  }

  // Pre-bind unlocker to touch and click events
  ['touchstart', 'touchend', 'pointerdown', 'mousedown', 'keydown'].forEach(evt => {
    window.addEventListener(evt, unlockAudio, { once: true, passive: true });
  });

  // Pre-buffer audio file into cache
  function prebufferAudio(url) {
    if (!url || audioCache.has(url)) return;
    try {
      const audio = new Audio();
      audio.preload = 'auto';
      audio.src = url;
      audioCache.set(url, audio);
    } catch (e) {}
  }

  // Play audio file with caching, instant fallback to SpeechSynthesis
  function playAudioFile(url, textFallback = '', onPlay = null, onEnd = null) {
    unlockAudio();

    if (url) {
      try {
        let audio = audioCache.get(url);
        if (!audio) {
          audio = new Audio(url);
          audioCache.set(url, audio);
        } else {
          audio.currentTime = 0;
        }

        if (onPlay) onPlay();

        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              audio.onended = () => {
                if (onEnd) onEnd();
              };
            })
            .catch(() => {
              // If file fails or is blocked, fallback immediately to Chinese TTS
              if (textFallback) {
                speakChinese(textFallback, onPlay, onEnd);
              } else if (onEnd) {
                onEnd();
              }
            });
          return;
        }
      } catch (err) {
        // Fallback to TTS
      }
    }

    if (textFallback) {
      speakChinese(textFallback, onPlay, onEnd);
    } else if (onEnd) {
      onEnd();
    }
  }

  // Chinese Mandarin Text-to-Speech synthesis
  function speakChinese(text, onStart = null, onEnd = null, rate = 0.88) {
    if (!text || typeof window === 'undefined' || !window.speechSynthesis) {
      if (onEnd) onEnd();
      return;
    }

    unlockAudio();

    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-CN';
      utterance.rate = rate;

      // Select natural Chinese voice if available
      const voices = window.speechSynthesis.getVoices();
      const zhVoice = voices.find(v => v.lang && (v.lang === 'zh-CN' || v.lang.startsWith('zh')));
      if (zhVoice) {
        utterance.voice = zhVoice;
      }

      utterance.onstart = () => {
        if (onStart) onStart();
      };
      utterance.onend = () => {
        if (onEnd) onEnd();
      };
      utterance.onerror = () => {
        if (onEnd) onEnd();
      };

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      if (onEnd) onEnd();
    }
  }

  // High-fidelity Mandarin Tone Synthesizer (Web Audio API pitch contours)
  // Tone 1: 55 (High Level ~350Hz)
  // Tone 2: 35 (Mid-Rising ~270Hz -> ~360Hz)
  // Tone 3: 214 (Dipping ~260Hz -> ~200Hz -> ~320Hz)
  // Tone 4: 51 (High-Falling ~380Hz -> ~200Hz)
  // Tone 5: Neutral (~270Hz short pulse)
  function playMandarinTone(toneNumber, duration = 0.45) {
    unlockAudio();
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      // Soft harmonic timbre (sine + gentle triangle blend)
      osc.type = 'sine';

      // Envelope settings
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.35, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      const tone = parseInt(toneNumber, 10) || 1;

      switch (tone) {
        case 1: // 55 High Level
          osc.frequency.setValueAtTime(360, now);
          osc.frequency.linearRampToValueAtTime(365, now + duration);
          break;
        case 2: // 35 Rising
          osc.frequency.setValueAtTime(270, now);
          osc.frequency.exponentialRampToValueAtTime(370, now + duration);
          break;
        case 3: // 214 Dipping
          osc.frequency.setValueAtTime(260, now);
          osc.frequency.exponentialRampToValueAtTime(195, now + duration * 0.45);
          osc.frequency.exponentialRampToValueAtTime(330, now + duration);
          break;
        case 4: // 51 High Falling
          osc.frequency.setValueAtTime(390, now);
          osc.frequency.exponentialRampToValueAtTime(190, now + duration);
          break;
        default: // Neutral
          osc.frequency.setValueAtTime(280, now);
          osc.frequency.linearRampToValueAtTime(250, now + duration * 0.5);
          break;
      }

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + duration + 0.05);
    } catch (e) {
      console.warn('Tone synth error:', e);
    }
  }

  // Pleasant success / chime feedback sound
  function playChime(isSuccess = true) {
    unlockAudio();
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';

      if (isSuccess) {
        // Joyful D5 -> A5 rising chime
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.exponentialRampToValueAtTime(880.0, now + 0.12); // A5
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.exponentialRampToValueAtTime(0.28, now + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc.stop(now + 0.42);
      } else {
        // Gentle descending bump
        osc.frequency.setValueAtTime(240, now);
        osc.frequency.exponentialRampToValueAtTime(160, now + 0.18);
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.exponentialRampToValueAtTime(0.22, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.stop(now + 0.32);
      }

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
    } catch (e) {}
  }

  // Expose to window for all scripts
  window.LinguaAudio = {
    unlock: unlockAudio,
    playFile: playAudioFile,
    speak: speakChinese,
    playTone: playMandarinTone,
    playChime: playChime,
    prebuffer: prebufferAudio,
    getAudioContext: getAudioContext
  };
})();
