/**
 * Reusable Chinese Stroke Order Animated SVG Engine
 * 
 * Takes a Chinese character and a corresponding SVG path sequence,
 * rendering an animated stroke-by-stroke demonstration for the 'Stroke Order' section.
 * Renders all Chinese text inside HTML blocks styled with 楷体 (KaiTi).
 *
 * @param {HTMLElement|string} container - Target DOM element or CSS selector.
 * @param {string|object} character - Chinese character string (e.g. '水') or metadata object.
 * @param {Array<string|object>} svgPathSequence - Array of SVG path strings ("M...") or stroke objects.
 * @param {object} [options] - Configuration options:
 *   - speed {number}: Animation speed multiplier (default 1.0)
 *   - autoPlay {boolean}: Start animating automatically (default true)
 *   - showNumbers {boolean}: Show numbered badge at stroke start points (default true)
 *   - showArrows {boolean}: Show directional indicators (default true)
 *   - showSequenceGrid {boolean}: Render step-by-step evolution cards (default true)
 *   - showControls {boolean}: Render playback control toolbar (default true)
 *   - onStepChange {function}: Callback(stepIndex, stroke)
 *   - onComplete {function}: Callback()
 *   - onPracticeClick {function}: Callback(character)
 * @returns {object} Controller instance with play, pause, replay, goToStep, nextStep, prevStep, setSpeed, destroy.
 */
(function(global) {
  function escapeHTML(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function parseStartCoordinates(pathStr) {
    if (!pathStr || typeof pathStr !== 'string') return { x1: 160, y1: 160 };
    const match = /M\s*([-\d.]+)[,\s]+([-\d.]+)/i.exec(pathStr);
    if (match) {
      return {
        x1: parseFloat(match[1]),
        y1: parseFloat(match[2])
      };
    }
    return { x1: 160, y1: 160 };
  }

  function normalizeStrokeSequence(svgPathSequence, char) {
    if (!Array.isArray(svgPathSequence) || !svgPathSequence.length) {
      // Default fallback if empty
      return [
        {
          path: "M 160 55 L 160 265",
          name: "第1笔 竖 (Shù)",
          label: "Stroke 1",
          direction: "Top to bottom",
          ruleNote: "Standard Chinese stroke order",
          x1: 160,
          y1: 55
        }
      ];
    }

    return svgPathSequence.map((item, idx) => {
      if (typeof item === 'string') {
        const coords = parseStartCoordinates(item);
        return {
          path: item,
          name: `第${idx + 1}笔`,
          label: `Stroke ${idx + 1}`,
          direction: 'Follow stroke vector',
          ruleNote: 'Standard Chinese stroke sequence',
          x1: coords.x1,
          y1: coords.y1
        };
      } else if (typeof item === 'object' && item !== null) {
        const coords = (item.x1 !== undefined && item.y1 !== undefined)
          ? { x1: item.x1, y1: item.y1 }
          : parseStartCoordinates(item.path);
        return {
          ...item,
          path: item.path || '',
          name: item.name || item.label || `第${idx + 1}笔`,
          label: item.label || item.name || `Stroke ${idx + 1}`,
          direction: item.direction || 'Follow stroke vector',
          ruleNote: item.ruleNote || '',
          x1: coords.x1,
          y1: coords.y1
        };
      }
      return null;
    }).filter(Boolean);
  }

  function renderAnimatedStrokeOrderDemo(container, character, svgPathSequence, options = {}) {
    const target = typeof container === 'string' ? document.querySelector(container) : container;
    if (!target) {
      console.warn('[renderAnimatedStrokeOrderDemo] Container not found:', container);
      return null;
    }

    // Normalize character input
    const rawChar = (typeof character === 'object' && character !== null)
      ? (character.character || character.char || character.title || '水')
      : String(character || '水');
    const char = (String(rawChar).match(/[\u4e00-\u9fa5]/) || ['水'])[0];

    // Normalize SVG path sequence
    const strokes = normalizeStrokeSequence(svgPathSequence, char);
    const totalStrokes = strokes.length;

    // State & Options
    let speed = typeof options.speed === 'number' ? options.speed : 1.0;
    let isPlaying = options.autoPlay !== false;
    let showNumbers = options.showNumbers !== false;
    let showArrows = options.showArrows !== false;
    const showSequenceGrid = options.showSequenceGrid !== false;
    const showControls = options.showControls !== false;
    const onStepChange = typeof options.onStepChange === 'function' ? options.onStepChange : null;
    const onComplete = typeof options.onComplete === 'function' ? options.onComplete : null;
    const onPracticeClick = typeof options.onPracticeClick === 'function' ? options.onPracticeClick : null;

    let currentStep = 0;
    let animTimer = null;
    let hanziWriterInstance = null;

    // Generate unique ID prefix to avoid DOM collisions
    const uid = 'sod_' + Math.random().toString(36).substring(2, 9);

    // Build Demo HTML Shell with 楷体 styled blocks
    target.innerHTML = `
      <div class="stroke-order-demo-wrapper" id="${uid}_wrapper">
        <!-- Status Indicator Bar -->
        <div class="stroke-order-indicator-bar" style="margin-bottom: 12px; width: 100%; max-width: 320px;">
          <span id="${uid}_stepBadge" class="stroke-order-step-badge">Stroke 1 / ${totalStrokes}</span>
          <span id="${uid}_stepName" class="chinese-kaiti-block">${escapeHTML(strokes[0] ? strokes[0].name : '')}</span>
        </div>

        <!-- Authentic Mi-Zi-Ge (米字格) SVG Stage -->
        <div class="stroke-order-mizige-container" id="${uid}_mizigeBox">
          <!-- Mi-Zi-Ge Guidelines (Red/Gold Dashed) -->
          <svg class="stroke-order-grid-svg" viewBox="0 0 320 320">
            <rect x="4" y="4" width="312" height="312" fill="none" stroke="#fca5a5" stroke-width="2"/>
            <line x1="4" y1="160" x2="316" y2="160" stroke="#f87171" stroke-width="1.2" stroke-dasharray="6,4"/>
            <line x1="160" y1="4" x2="160" y2="316" stroke="#f87171" stroke-width="1.2" stroke-dasharray="6,4"/>
            <line x1="4" y1="4" x2="316" y2="316" stroke="#fecaca" stroke-width="1" stroke-dasharray="4,4"/>
            <line x1="316" y1="4" x2="4" y2="316" stroke="#fecaca" stroke-width="1" stroke-dasharray="4,4"/>
          </svg>

          <!-- HanziWriter Fallback/Calligraphy Container -->
          <div id="${uid}_hwTarget" class="stroke-order-svg-render-target"></div>

          <!-- Dynamic SVG Vector Layer for Stroke Overlays & Highlights -->
          <svg id="${uid}_svgOverlay" viewBox="0 0 320 320" style="position: absolute; inset: 0; width: 100%; height: 100%; z-index: 3; pointer-events: none;"></svg>
        </div>

        ${showControls ? `
          <!-- Playback Controls Toolbar -->
          <div class="stroke-order-playback-toolbar" style="margin-top: 14px;">
            <button type="button" class="btn-stroke-ctrl" id="${uid}_btnReplay" title="Replay from stroke 1">
              ↺ Replay
            </button>
            <button type="button" class="btn-stroke-ctrl" id="${uid}_btnPrev" title="Previous Stroke">
              ◀ Prev
            </button>
            <button type="button" class="btn-stroke-ctrl primary" id="${uid}_btnPlayPause" title="Play or Pause">
              ${isPlaying ? '⏸ Pause' : '▶ Play'}
            </button>
            <button type="button" class="btn-stroke-ctrl" id="${uid}_btnNext" title="Next Stroke">
              Next ▶
            </button>
            <select class="stroke-speed-select" id="${uid}_selectSpeed" aria-label="Animation Speed">
              <option value="0.5" ${speed === 0.5 ? 'selected' : ''}>0.5x Slow</option>
              <option value="1.0" ${speed === 1.0 ? 'selected' : ''}>1.0x Normal</option>
              <option value="1.5" ${speed === 1.5 ? 'selected' : ''}>1.5x Fast</option>
            </select>
            <button type="button" class="btn-stroke-ctrl" id="${uid}_btnNumbers" title="Toggle start point numbers">
              ${showNumbers ? '🔢 Numbers: ON' : '🔢 Numbers: OFF'}
            </button>
          </div>
        ` : ''}

        ${onPracticeClick ? `
          <div style="margin-top: 16px; width: 100%; text-align: center;">
            <button type="button" class="btn-switch-to-canvas" id="${uid}_btnPractice" style="width: 100%;">
              🖌️ Practice Drawing "<span class="chinese-kaiti-block">${escapeHTML(char)}</span>" on Canvas →
            </button>
          </div>
        ` : ''}

        ${showSequenceGrid ? `
          <!-- Progressive Stroke Sequence Strip with 楷体 styling -->
          <div class="stroke-sequence-strip-wrapper" style="margin-top: 20px; width: 100%;">
            <div class="stroke-sequence-strip-title">
              <span>🖌️ Step-by-Step Progressive Sequence (<span class="chinese-kaiti-block">${escapeHTML(char)}</span> · ${totalStrokes} Strokes)</span>
              <span style="font-size: 0.8rem; font-weight: 600; color: #64748b;">Click step to inspect</span>
            </div>
            <div class="stroke-sequence-grid" id="${uid}_sequenceGrid">
              ${strokes.map((stroke, k) => `
                <div class="stroke-step-card ${k === 0 ? 'active' : ''}" data-step="${k}">
                  <div class="stroke-step-mini-box">
                    <span class="stroke-step-num-badge">Step ${k + 1}</span>
                    <svg viewBox="0 0 320 320" style="width: 100%; height: 100%;">
                      <rect x="4" y="4" width="312" height="312" fill="none" stroke="#fca5a5" stroke-width="2"/>
                      <line x1="4" y1="160" x2="316" y2="160" stroke="#f87171" stroke-width="1.2" stroke-dasharray="6,4"/>
                      <line x1="160" y1="4" x2="160" y2="316" stroke="#f87171" stroke-width="1.2" stroke-dasharray="6,4"/>
                      <line x1="4" y1="4" x2="316" y2="316" stroke="#fecaca" stroke-width="1" stroke-dasharray="4,4"/>
                      <line x1="316" y1="4" x2="4" y2="316" stroke="#fecaca" stroke-width="1" stroke-dasharray="4,4"/>
                      
                      <!-- KaiTi (楷体) Faint Character Watermark -->
                      <text x="160" y="240" font-family="'KaiTi', 'STKaiti', '楷体', 'BiauKai', 'DFKai-SB', 'Noto Serif SC', serif" font-size="210" font-weight="900" text-anchor="middle" fill="rgba(234, 88, 12, 0.12)">${escapeHTML(char)}</text>
                      
                      <!-- Prior strokes in black ink -->
                      ${strokes.slice(0, k).map(s => `
                        <path d="${s.path}" fill="none" stroke="#334155" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>
                      `).join('')}

                      <!-- Active stroke in bold red -->
                      <path d="${stroke.path}" fill="none" stroke="#ea580c" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </div>
                  <div class="stroke-step-name chinese-kaiti-block">${escapeHTML(stroke.name || stroke.label)}</div>
                  <div class="stroke-step-direction">${escapeHTML(stroke.direction || '')}</div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;

    // Initialize HanziWriter if present in window
    const hwContainer = document.getElementById(`${uid}_hwTarget`);
    if (hwContainer && typeof global.HanziWriter !== 'undefined' && char) {
      try {
        hanziWriterInstance = global.HanziWriter.create(hwContainer, char, {
          width: 300,
          height: 300,
          padding: 15,
          showOutline: true,
          showCharacter: false,
          strokeColor: '#1e293b',
          radicalColor: '#ea580c',
          strokeAnimationSpeed: speed,
          delayBetweenStrokes: 200,
          charDataLoader: function (charToLoad, onComplete, onError) {
            if (global.EMBEDDED_HANZI_DATA && global.EMBEDDED_HANZI_DATA[charToLoad]) {
              onComplete(global.EMBEDDED_HANZI_DATA[charToLoad]);
              return;
            }
            fetch(`https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0.1/${encodeURIComponent(charToLoad)}.json`)
              .then(r => {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.json();
              })
              .then(d => onComplete(d))
              .catch(err => {
                if (typeof onError === 'function') onError(err);
              });
          },
          onLoadCharDataError: function (err) {
            console.warn('[StrokeOrderDemo] HanziWriter char data notice for ' + char, err);
          }
        });
      } catch (err) {
        hanziWriterInstance = null;
      }
    }

    // Step animation function
    function renderStep(stepIndex) {
      if (animTimer) {
        clearTimeout(animTimer);
        animTimer = null;
      }

      if (stepIndex < 0) stepIndex = 0;
      if (stepIndex >= totalStrokes) stepIndex = totalStrokes - 1;

      currentStep = stepIndex;
      const currentStroke = strokes[stepIndex];

      // Update badge and text
      const badge = document.getElementById(`${uid}_stepBadge`);
      if (badge) badge.textContent = `Stroke ${stepIndex + 1} / ${totalStrokes}`;

      const nameEl = document.getElementById(`${uid}_stepName`);
      if (nameEl) nameEl.textContent = currentStroke.name || currentStroke.label || '';

      // Update active card highlight in sequence grid
      const grid = document.getElementById(`${uid}_sequenceGrid`);
      if (grid) {
        grid.querySelectorAll('.stroke-step-card').forEach(card => {
          const cardStep = parseInt(card.dataset.step, 10);
          card.classList.toggle('active', cardStep === stepIndex);
        });
      }

      // Update SVG Overlay with 楷体 watermark
      const svg = document.getElementById(`${uid}_svgOverlay`);
      if (svg) {
        svg.innerHTML = `
          <!-- 楷体 Ghost Character Watermark -->
          <text x="160" y="240" font-family="'KaiTi', 'STKaiti', '楷体', 'BiauKai', 'DFKai-SB', 'Noto Serif SC', serif" font-size="210" font-weight="900" text-anchor="middle" fill="rgba(234, 88, 12, 0.14)">${escapeHTML(char)}</text>

          <!-- Completed prior strokes in dark ink -->
          ${strokes.slice(0, stepIndex).map(s => `
            <path d="${s.path}" class="stroke-done-path"/>
          `).join('')}

          <!-- Active animating stroke in bright red -->
          <path id="${uid}_activePath" d="${currentStroke.path}" class="stroke-anim-path"/>

          <!-- Number badge at stroke start coordinates -->
          ${showNumbers && currentStroke.x1 ? `
            <g>
              <circle cx="${currentStroke.x1}" cy="${currentStroke.y1}" r="11" fill="#ea580c"/>
              <text x="${currentStroke.x1}" y="${currentStroke.y1 + 4}" fill="#ffffff" font-size="11" font-weight="800" text-anchor="middle">${stepIndex + 1}</text>
            </g>
          ` : ''}
        `;

        // Animate stroke drawing with stroke-dashoffset transition
        const pathEl = document.getElementById(`${uid}_activePath`);
        if (pathEl) {
          try {
            const length = pathEl.getTotalLength() || 300;
            pathEl.style.strokeDasharray = `${length}`;
            pathEl.style.strokeDashoffset = `${length}`;
            // Force layout reflow
            void pathEl.getBoundingClientRect();
            const duration = Math.max(280, Math.round(700 / speed));
            pathEl.style.transition = `stroke-dashoffset ${duration}ms cubic-bezier(0.25, 0.1, 0.25, 1)`;
            pathEl.style.strokeDashoffset = '0';
          } catch (e) {}
        }
      }

      // Synchronize HanziWriter stroke animation if active
      if (hanziWriterInstance && typeof hanziWriterInstance.animateStroke === 'function') {
        try {
          hanziWriterInstance.animateStroke(stepIndex);
        } catch (e) {}
      }

      // Notify callback
      if (onStepChange) {
        onStepChange(stepIndex, currentStroke);
      }

      // Schedule next stroke if isPlaying
      if (isPlaying) {
        const stepDelay = Math.max(750, Math.round(1100 / speed));
        animTimer = setTimeout(() => {
          if (isPlaying) {
            if (stepIndex + 1 < totalStrokes) {
              renderStep(stepIndex + 1);
            } else {
              // Finished character sequence
              renderCompletedState();
              if (onComplete) onComplete();
              animTimer = setTimeout(() => {
                if (isPlaying) {
                  renderStep(0);
                }
              }, 1800);
            }
          }
        }, stepDelay);
      }
    }

    function renderCompletedState() {
      const badge = document.getElementById(`${uid}_stepBadge`);
      if (badge) badge.textContent = `Completed (${totalStrokes}/${totalStrokes})`;

      const nameEl = document.getElementById(`${uid}_stepName`);
      if (nameEl) nameEl.textContent = 'All Strokes Finished! 👏';

      const svg = document.getElementById(`${uid}_svgOverlay`);
      if (svg) {
        svg.innerHTML = `
          <text x="160" y="240" font-family="'KaiTi', 'STKaiti', '楷体', 'BiauKai', 'DFKai-SB', 'Noto Serif SC', serif" font-size="210" font-weight="900" text-anchor="middle" fill="rgba(234, 88, 12, 0.14)">${escapeHTML(char)}</text>
          ${strokes.map(s => `<path d="${s.path}" class="stroke-done-path"/>`).join('')}
        `;
      }
    }

    // Playback Controller API methods
    const controller = {
      play: function() {
        isPlaying = true;
        const btn = document.getElementById(`${uid}_btnPlayPause`);
        if (btn) btn.innerHTML = '⏸ Pause';
        renderStep(currentStep);
      },
      pause: function() {
        isPlaying = false;
        if (animTimer) {
          clearTimeout(animTimer);
          animTimer = null;
        }
        const btn = document.getElementById(`${uid}_btnPlayPause`);
        if (btn) btn.innerHTML = '▶ Play';
      },
      replay: function() {
        isPlaying = true;
        const btn = document.getElementById(`${uid}_btnPlayPause`);
        if (btn) btn.innerHTML = '⏸ Pause';
        renderStep(0);
      },
      goToStep: function(stepIndex) {
        controller.pause();
        renderStep(stepIndex);
      },
      nextStep: function() {
        controller.pause();
        let next = currentStep + 1;
        if (next >= totalStrokes) next = 0;
        renderStep(next);
      },
      prevStep: function() {
        controller.pause();
        let prev = currentStep - 1;
        if (prev < 0) prev = totalStrokes - 1;
        renderStep(prev);
      },
      setSpeed: function(newSpeed) {
        speed = parseFloat(newSpeed) || 1.0;
        const sel = document.getElementById(`${uid}_selectSpeed`);
        if (sel) sel.value = String(speed);
      },
      toggleNumbers: function() {
        showNumbers = !showNumbers;
        const btn = document.getElementById(`${uid}_btnNumbers`);
        if (btn) btn.textContent = showNumbers ? '🔢 Numbers: ON' : '🔢 Numbers: OFF';
        renderStep(currentStep);
      },
      toggleArrows: function() {
        showArrows = !showArrows;
        renderStep(currentStep);
      },
      getCurrentStep: function() {
        return currentStep;
      },
      getTotalSteps: function() {
        return totalStrokes;
      },
      destroy: function() {
        if (animTimer) {
          clearTimeout(animTimer);
          animTimer = null;
        }
        if (target) {
          target.innerHTML = '';
        }
      }
    };

    // Bind Controls Events
    const btnReplay = document.getElementById(`${uid}_btnReplay`);
    if (btnReplay) btnReplay.onclick = () => controller.replay();

    const btnPrev = document.getElementById(`${uid}_btnPrev`);
    if (btnPrev) btnPrev.onclick = () => controller.prevStep();

    const btnPlayPause = document.getElementById(`${uid}_btnPlayPause`);
    if (btnPlayPause) {
      btnPlayPause.onclick = () => {
        if (isPlaying) {
          controller.pause();
        } else {
          controller.play();
        }
      };
    }

    const btnNext = document.getElementById(`${uid}_btnNext`);
    if (btnNext) btnNext.onclick = () => controller.nextStep();

    const selectSpeed = document.getElementById(`${uid}_selectSpeed`);
    if (selectSpeed) {
      selectSpeed.onchange = (e) => {
        controller.setSpeed(e.target.value);
      };
    }

    const btnNumbers = document.getElementById(`${uid}_btnNumbers`);
    if (btnNumbers) {
      btnNumbers.onclick = () => controller.toggleNumbers();
    }

    const btnPractice = document.getElementById(`${uid}_btnPractice`);
    if (btnPractice && onPracticeClick) {
      btnPractice.onclick = () => onPracticeClick(charObj);
    }

    // Bind Step cards in sequence grid
    const seqGrid = document.getElementById(`${uid}_sequenceGrid`);
    if (seqGrid) {
      seqGrid.querySelectorAll('.stroke-step-card').forEach(card => {
        card.onclick = () => {
          const step = parseInt(card.dataset.step, 10) || 0;
          controller.goToStep(step);
        };
      });
    }

    // Start playing
    renderStep(0);

    return controller;
  }

  // Expose globally
  global.renderAnimatedStrokeOrderDemo = renderAnimatedStrokeOrderDemo;
})(typeof window !== 'undefined' ? window : this);
