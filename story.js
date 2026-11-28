/* =========================================================
   JiedeEdu - Story Lesson JavaScript
   ========================================================= */


/* =========================================================
   CONFIGURATION
   ========================================================= */

const EXCEL_FILE = "data/stories.xlsx";

let currentLoadedLessonId = "lesson-01";
let currentLoadedLesson = null;
let currentLoadedAllLessons = [];

let cachedStoryWorkbook = {
  loaded: false,
  lessons: [],
  allStoryRows: [],
  allVocabularyRows: [],
  allExerciseRows: []
};

function normalizeStoryLessonId(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function storyIdsMatch(a, b) {
  const normA = normalizeStoryLessonId(a);
  const normB = normalizeStoryLessonId(b);
  if (!normA && !normB) return false;
  return (
    normA === normB ||
    normA === normalizeStoryLessonId(`lesson-${normB}`) ||
    normA === normalizeStoryLessonId(`lesson-0${normB}`) ||
    normB === normalizeStoryLessonId(`lesson-${normA}`) ||
    normB === normalizeStoryLessonId(`lesson-0${normA}`) ||
    String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase()
  );
}


/* =========================================================
   HELPERS
   ========================================================= */

function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function backendApiUrl(path) {
  if (window.LinguaBackend && typeof window.LinguaBackend.apiUrl === "function") {
    return window.LinguaBackend.apiUrl(path);
  }
  return path;
}

function canonicalizeStoryAssetPath(path) {
  let clean = String(path || "").trim().replace(/\\/g, "/").replace(/^\.\//, "");
  if (!clean) return "";
  if (/^\/?assets\/images\/(story2-(?:poster|0[1-5]))\.jpg$/i.test(clean)) {
    clean = clean.replace(/^\/+/, "").replace(/\.jpg$/i, ".svg");
  }
  return clean;
}

function backendAssetUrl(path) {
  const canonical = canonicalizeStoryAssetPath(path);
  if (window.LinguaBackend && typeof window.LinguaBackend.assetUrl === "function") {
    return window.LinguaBackend.assetUrl(canonical);
  }
  return canonical;
}

function backendAvailable() {
  if (window.LinguaBackend && typeof window.LinguaBackend.hasBackend === "function") {
    return window.LinguaBackend.hasBackend();
  }
  return true;
}

function getStoryFallbackSvg(chinese, pinyin, english) {
  const c = escapeHTML(chinese || "中文故事");
  const p = escapeHTML(pinyin || "Zhōngwén Gùshì");
  const e = escapeHTML(english || "Chinese Story");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400" width="100%" height="100%">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#fff7ed" />
        <stop offset="100%" stop-color="#ffedd5" />
      </linearGradient>
    </defs>
    <rect width="600" height="400" fill="url(#g)" rx="16" />
    <circle cx="300" cy="130" r="54" fill="#fb923c" fill-opacity="0.2" />
    <text x="300" y="150" font-size="52" text-anchor="middle">📖</text>
    <text x="300" y="240" font-family="'Noto Serif SC', 'Songti SC', serif" font-weight="bold" font-size="34" fill="#9a3412" text-anchor="middle">${c}</text>
    <text x="300" y="285" font-family="system-ui, sans-serif" font-weight="600" font-size="18" fill="#ea580c" text-anchor="middle">${p}</text>
    <text x="300" y="325" font-family="system-ui, sans-serif" font-size="16" fill="#78350f" text-anchor="middle">${e}</text>
  </svg>`;
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}


function getValue(
  row,
  ...keys
) {

  for (const key of keys) {

    if (
      row[key] !== undefined &&
      row[key] !== null &&
      String(row[key]).trim() !== ""
    ) {

      return row[key];

    }

  }


  return "";

}


function filterByLesson(
  rows,
  lessonId
) {
  const norm = str => String(str || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  const targetNorm = norm(lessonId);

  return rows.filter(
    row => {
      const rowLessonId =
        getValue(
          row,
          "lessonId",
          "LessonId",
          "Lesson ID",
          "lessonID",
          "id",
          "ID"
        );
      const rNorm = norm(rowLessonId);
      return (
        rNorm === targetNorm ||
        rNorm === norm(`lesson-${targetNorm}`) ||
        rNorm === norm(`lesson-0${targetNorm}`) ||
        String(rowLessonId).trim().toLowerCase() === String(lessonId).trim().toLowerCase()
      );
    }
  );
}


function sortByOrder(
  rows
) {

  return [...rows].sort(
    (a, b) => {

      const orderA =
        Number(
          getValue(
            a,
            "order",
            "Order",
            "sequence",
            "Sequence"
          )
        ) || 0;


      const orderB =
        Number(
          getValue(
            b,
            "order",
            "Order",
            "sequence",
            "Sequence"
          )
        ) || 0;


      return orderA - orderB;

    }
  );

}


/* =========================================================
   MOBILE NAVIGATION
   ========================================================= */

function initializeMobileMenu() {
  // Handled universally by header.js via document-level event delegation
}


/* =========================================================
   AUDIO & SPEECH MANAGEMENT
   ========================================================= */

let currentPlayingButton = null;
let currentAudioInstance = null;

function stopCurrentStoryAudio() {

  if (currentAudioInstance) {

    try {

      currentAudioInstance.pause();
      currentAudioInstance.currentTime = 0;

    } catch (e) {
      /* ignore */
    }

    currentAudioInstance = null;

  }

  if ("speechSynthesis" in window) {

    window.speechSynthesis.cancel();

  }

  if (currentPlayingButton) {

    currentPlayingButton.textContent =
      currentPlayingButton.id === "fullStoryAudioBtn"
        ? "▶ Play Full Story"
        : "▶ Play";
    currentPlayingButton.classList.remove("playing");
    currentPlayingButton = null;

  }

}

function stopAllStoryPlayback() {
  stopCurrentStoryAudio();

  const videoElement = document.getElementById("lessonVideo");
  if (videoElement) {
    try {
      videoElement.pause();
      videoElement.currentTime = 0;
    } catch (e) {
      /* ignore */
    }
  }

  const fullStoryBtn = document.getElementById("fullStoryAudioBtn");
  if (fullStoryBtn) {
    fullStoryBtn.textContent = "▶ Play Full Story";
    fullStoryBtn.classList.remove("playing");
  }
}

function speakText(
  text,
  button
) {

  if (
    !("speechSynthesis" in window)
  ) {

    return;
  }

  stopCurrentStoryAudio();

  if (window.LinguaAudio) {
    if (button) {
      currentPlayingButton = button;
      button.textContent = "⏸ Playing...";
      button.classList.add("playing");
    }
    window.LinguaAudio.speak(
      text,
      () => {},
      () => {
        if (button) {
          button.textContent = "▶ Play";
          button.classList.remove("playing");
          if (currentPlayingButton === button) currentPlayingButton = null;
        }
      }
    );
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "zh-CN";
  utterance.rate = 0.82;
  utterance.pitch = 1;

  if (button) {
    currentPlayingButton = button;
    button.textContent = "⏸ Playing...";
    button.classList.add("playing");

    utterance.onend = () => {
      button.textContent = "▶ Play";
      button.classList.remove("playing");
      if (currentPlayingButton === button) {
        currentPlayingButton = null;
      }
    };

    utterance.onerror = () => {
      button.textContent = "▶ Play";
      button.classList.remove("playing");
      if (currentPlayingButton === button) {
        currentPlayingButton = null;
      }
    };
  }

  window.speechSynthesis.speak(utterance);
}


/* =========================================================
   AUDIO FEEDBACK SOUNDS (EXERCISES)
   ========================================================= */

function playFeedbackSound(isCorrect) {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      return;
    }

    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    if (isCorrect) {
      // Pleasant rising chime (D5 -> A5)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, now);
      osc.frequency.setValueAtTime(880.00, now + 0.12);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.45);
    } else {
      // Gentle soft descending tone (400Hz -> 310Hz)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.setValueAtTime(310, now + 0.14);

      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.38);
    }
  } catch (e) {
    /* AudioContext blocked or unsupported */
  }
}


/* =========================================================
   PLAY AUDIO
   ========================================================= */

function playAudio(
  audioPath,
  text,
  button
) {

  /* If already playing this exact button, clicking it toggles off */
  if (button && currentPlayingButton === button) {

    stopCurrentStoryAudio();
    return;

  }

  stopCurrentStoryAudio();

  if (window.LinguaAudio) {
    if (button) {
      currentPlayingButton = button;
      button.textContent = "⏸ Playing...";
      button.classList.add("playing");
    }
    window.LinguaAudio.playFile(
      audioPath,
      text,
      () => {},
      () => {
        if (button) {
          button.textContent = "▶ Play";
          button.classList.remove("playing");
          if (currentPlayingButton === button) currentPlayingButton = null;
        }
      }
    );
    return;
  }

  if (audioPath) {
    const audio = new Audio(backendAssetUrl(audioPath));
    currentAudioInstance = audio;

    if (button) {
      currentPlayingButton = button;
      button.textContent = "⏸ Playing...";
      button.classList.add("playing");

      audio.addEventListener("ended", () => {
        button.textContent = "▶ Play";
        button.classList.remove("playing");
        if (currentPlayingButton === button) {
          currentPlayingButton = null;
        }
        currentAudioInstance = null;
      });

      audio.addEventListener("error", () => {
        speakText(text, button);
      });
    }

    audio.play().catch(() => {
      speakText(text, button);
    });
    return;
  }

  speakText(text, button);

}


/* =========================================================
   RENDER LESSON HEADER
   ========================================================= */

function renderLessonHeader(
  lesson
) {

  const title =
    getValue(
      lesson,
      "title",
      "Title"
    );


  const chineseTitle =
    getValue(
      lesson,
      "chineseTitle",
      "ChineseTitle",
      "Chinese Title"
    );


  const pinyin =
    getValue(
      lesson,
      "pinyin",
      "Pinyin"
    );


  const meaning =
    getValue(
      lesson,
      "meaning",
      "Meaning"
    );


  const description =
    getValue(
      lesson,
      "description",
      "Description"
    );


  const titleElement =
    document.getElementById(
      "storyTitle"
    );


  const pinyinElement =
    document.getElementById(
      "storyPinyin"
    );


  const meaningElement =
    document.getElementById(
      "storyMeaning"
    );


  const descriptionElement =
    document.getElementById(
      "storyDescription"
    );


  if (titleElement) {

    titleElement.textContent =
      chineseTitle ||
      title ||
      "Chinese Story";

  }


  if (pinyinElement) {

    pinyinElement.textContent =
      pinyin;

  }


  if (meaningElement) {

    meaningElement.textContent =
      meaning;

  }


  if (descriptionElement) {

    descriptionElement.textContent =
      description ||
      "Watch the story, understand the images, read the sentences, learn the vocabulary, and complete the exercises.";

  }


  document.title =
    `JiedeEdu | ${title || "Chinese Story Lesson"}`;

}


/* =========================================================
   RENDER VIDEO
   ========================================================= */

function renderVideo(
  lesson,
  storyRows = []
) {

  const videoElement =
    document.getElementById(
      "lessonVideo"
    );


  const videoTitle =
    document.getElementById(
      "videoTitle"
    );


  const videoCard =
    videoElement ? videoElement.closest(".video-card") : null;


  const coverEl =
    document.getElementById(
      "storyVideoCover"
    );


  const coverImg =
    document.getElementById(
      "storyVideoCoverImg"
    );


  const coverLabel =
    document.getElementById(
      "storyVideoCoverLabel"
    );


  const coverPlayWrap =
    coverEl ? coverEl.querySelector(".story-video-cover-play") : null;


  const rawVideo =
    getValue(
      lesson,
      "video",
      "Video",
      "videoUrl",
      "video_url",
      "VideoUrl",
      "video_path",
      "videoPath",
      "VideoPath"
    );

  const rawId = String(getValue(lesson, "id", "ID", "lessonId") || "").trim().toLowerCase();
  const normalizedVideo = (() => {
    let clean = String(rawVideo || "").trim().replace(/\\/g, "/").replace(/^\.\//, "");
    if (!clean) return "";
    if (/^\/?public\/assets\/aistudio\//i.test(clean)) {
      if (/story[-_]?0?1/i.test(clean)) return "assets/video/story-01.mp4";
      if (/story[-_]?0?2/i.test(clean)) return "assets/video/story-02.mp4";
    }
    if (/^\/?assets\/video\/media-[a-z0-9]+/i.test(clean)) {
      if (rawId === "lesson-01" || rawId === "story_01" || rawId === "story-01") return "assets/video/story-01.mp4";
      if (rawId === "lesson-02" || rawId === "story_02" || rawId === "story-02") return "assets/video/story-02.mp4";
    }
    if (!/[/:]/.test(clean) && /\.(mp4|webm|mov|m4v)$/i.test(clean)) {
      return `assets/video/${clean}`;
    }
    return clean;
  })();

  const rawPoster =
    getValue(
      lesson,
      "poster",
      "Poster",
      "posterUrl",
      "poster_url",
      "PosterUrl",
      "thumbnail_path",
      "thumbnailPath"
    );


  const title =
    getValue(
      lesson,
      "title",
      "Title"
    );


  const chineseTitle =
    getValue(
      lesson,
      "chineseTitle",
      "ChineseTitle",
      "Chinese Title"
    );


  const pinyin =
    getValue(
      lesson,
      "pinyin",
      "Pinyin"
    );


  const meaning =
    getValue(
      lesson,
      "meaning",
      "Meaning"
    );


  const firstSceneImage = Array.isArray(storyRows)
    ? (() => {
        for (const r of storyRows) {
          const imgVal = getValue(r || {}, "image", "Image");
          if (imgVal) return imgVal;
        }
        return "";
      })()
    : "";


  const fallbackCoverSvg = getStoryFallbackSvg(
    chineseTitle || title || "中文故事",
    pinyin || "",
    meaning || title || "Chinese Story"
  );


  const coverCandidates = [];
  const pushCoverCandidate = (rawUrl) => {
    const clean = String(rawUrl || "").trim();
    if (!clean) return;
    const resolved = backendAssetUrl(clean);
    if (resolved && !coverCandidates.includes(resolved)) {
      coverCandidates.push(resolved);
    }
    if (/\.(jpg|jpeg|png)$/i.test(resolved) && !/^data:/i.test(resolved)) {
      const svgAlt = resolved.replace(/\.(jpg|jpeg|png)$/i, ".svg");
      if (!coverCandidates.includes(svgAlt)) {
        coverCandidates.push(svgAlt);
      }
    }
  };

  pushCoverCandidate(rawPoster);
  pushCoverCandidate(firstSceneImage);
  if (rawId === "lesson-02" || rawId === "story_02" || rawId === "story-02") {
    pushCoverCandidate("assets/images/story2-poster.svg");
  }
  pushCoverCandidate("assets/images/story-poster.jpg");
  coverCandidates.push(fallbackCoverSvg);


  if (videoCard) {
    const existingBanner = videoCard.querySelector("#lessonVideoStatusBanner");
    if (existingBanner) existingBanner.remove();
  }


  const showVideoStatus = (message, isError) => {
    if (!videoCard) return;
    let banner = videoCard.querySelector("#lessonVideoStatusBanner");
    if (!banner) {
      banner = document.createElement("div");
      banner.id = "lessonVideoStatusBanner";
      const captionEl = videoCard.querySelector(".video-caption");
      if (captionEl && captionEl.parentNode) {
        captionEl.parentNode.insertBefore(banner, captionEl);
      } else {
        videoCard.appendChild(banner);
      }
    }
    banner.className = isError ? "video-status-banner is-error" : "video-status-banner";
    banner.textContent = message;
  };


  const hideCoverOverlay = () => {
    if (!coverEl) return;
    coverEl.classList.add("is-hidden");
    coverEl.setAttribute("aria-hidden", "true");
  };

  const showCoverOverlay = () => {
    if (!coverEl) return;
    coverEl.hidden = false;
    coverEl.classList.remove("is-hidden");
    coverEl.setAttribute("aria-hidden", "false");
  };

  if (coverImg) {
    let candidateIdx = 0;
    const applyNextCover = () => {
      if (candidateIdx >= coverCandidates.length) {
        coverImg.onerror = null;
        return;
      }
      coverImg.src = coverCandidates[candidateIdx++];
    };
    coverImg.onerror = () => {
      applyNextCover();
    };
    coverImg.alt = `${title || chineseTitle || "Chinese Story"} cover preview`;
    applyNextCover();
  }

  if (coverLabel) {
    coverLabel.textContent = normalizedVideo
      ? `Watch: ${title || chineseTitle || "Chinese Story"}`
      : "Video Preview Unavailable";
  }
  if (coverPlayWrap) {
    coverPlayWrap.style.display = normalizedVideo ? "" : "none";
  }

  if (videoElement) {
    videoElement.onerror = null;
    videoElement.onloadedmetadata = null;
    videoElement.onplay = null;
    videoElement.onplaying = null;
    videoElement.setAttribute("playsinline", "");

    const resolvedPoster = coverCandidates[0] || "";
    if (resolvedPoster && !/^data:image\/svg\+xml/i.test(resolvedPoster)) {
      videoElement.poster = resolvedPoster;
    } else {
      videoElement.removeAttribute("poster");
    }

    if (normalizedVideo) {
      showCoverOverlay();
      const resolvedSrc = backendAssetUrl(normalizedVideo);
      videoElement.src = resolvedSrc;
      videoElement.onloadedmetadata = () => {
        if (videoCard) {
          const banner = videoCard.querySelector("#lessonVideoStatusBanner");
          if (banner) banner.remove();
        }
      };
      videoElement.onplay = hideCoverOverlay;
      videoElement.onplaying = hideCoverOverlay;
      videoElement.onerror = () => {
        hideCoverOverlay();
        showVideoStatus(
          `Video file could not be loaded (${normalizedVideo}). Confirm the file is committed under assets/ or the hosted URL is accessible.`,
          true
        );
      };

      if (coverEl) {
        const startVideoPlayback = () => {
          hideCoverOverlay();
          try {
            videoElement.focus({ preventScroll: true });
          } catch (_) {}
          videoElement.play().catch(() => {});
        };
        coverEl.onclick = startVideoPlayback;
        coverEl.onkeydown = (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            startVideoPlayback();
          }
        };
      }

      try {
        videoElement.load();
      } catch (e) {}
    } else {
      if (coverEl) {
        coverEl.onclick = null;
        coverEl.onkeydown = null;
      }
      showCoverOverlay();
      videoElement.removeAttribute("src");
      try {
        videoElement.load();
      } catch (e) {}
      showVideoStatus("No video is configured for this story yet.", false);
    }

  }


  if (videoTitle) {

    videoTitle.textContent =
      title ||
      "Chinese Story";

  }

  /*
    Full Story Audio Player
  */
  const fullStoryBtn =
    document.getElementById("fullStoryAudioBtn");

  if (fullStoryBtn) {
    const lessonId =
      getValue(lesson, "id", "ID", "lessonId") || "lesson-01";

    const fullAudioPath =
      getValue(lesson, "fullAudio", "FullAudio") ||
      (lessonId === "lesson-02"
        ? "assets/audio/lesson-02-full.mp3"
        : "assets/audio/lesson-01-full.mp3");

    const fullStoryText =
      getValue(lesson, "chineseTitle", "ChineseTitle", "title") ||
      "Chinese Story";

    fullStoryBtn.onclick = () => {
      playAudio(
        fullAudioPath,
        fullStoryText,
        fullStoryBtn
      );
    };
  }

}


/* =========================================================
   RENDER STORY IMAGES
   ========================================================= */

function renderStoryImages(
  storyRows
) {

  const container =
    document.getElementById(
      "storyImageGrid"
    );


  if (!container) {
    return;
  }


  const rows =
    storyRows.filter(
      row =>
        getValue(
          row,
          "image",
          "Image"
        )
    );


  if (!rows.length) {

    container.innerHTML = `

      <div class="empty-card">

        <h3>
          No story images yet
        </h3>

        <p>
          Add image paths to the
          <strong>Story</strong>
          sheet in lessons.xlsx.
        </p>

      </div>

    `;

    return;

  }


  container.innerHTML =
    rows.map(
      (row, index) => {

        const image =
          backendAssetUrl(
            getValue(
              row,
              "image",
              "Image"
            )
          );


        const chinese =
          getValue(
            row,
            "chinese",
            "Chinese"
          );


        const english =
          getValue(
            row,
            "english",
            "English"
          );


        const fallbackDataUri = getStoryFallbackSvg(chinese, getValue(row, "pinyin", "Pinyin"), english);

        return `
          <article class="story-image-card">
            <img
              src="${escapeHTML(image)}"
              alt="${escapeHTML(
                english || chinese || `Story scene ${index + 1}`
              )}"
              loading="lazy"
              data-fallback="${fallbackDataUri}"
              onerror="
                if (!this.dataset.step) {
                  this.dataset.step = '1';
                  if (this.src.endsWith('.jpg')) {
                    this.src = this.src.replace(/\\.jpg$/, '.svg');
                    return;
                  } else if (this.src.endsWith('.svg')) {
                    this.src = this.src.replace(/\\.svg$/, '.png');
                    return;
                  }
                }
                if (this.dataset.step === '1') {
                  this.dataset.step = '2';
                  if (this.src.endsWith('.svg')) {
                    this.src = this.src.replace(/\\.svg$/, '.png');
                    return;
                  }
                }
                this.onerror = null;
                this.src = this.dataset.fallback;
              "
            >


            <div class="story-image-content">

              ${
                chinese
                  ? `
                    <h3>
                      ${escapeHTML(chinese)}
                    </h3>
                  `
                  : ""
              }


              ${
                english
                  ? `
                    <p>
                      ${escapeHTML(english)}
                    </p>
                  `
                  : ""
              }

              <button
                type="button"
                class="audio-button understand-audio"
                data-audio="${escapeHTML(getValue(row, "audio", "Audio"))}"
                data-text="${escapeHTML(chinese)}"
                style="margin-top: 10px; font-size: 0.8rem; padding: 5px 12px; min-height: 32px;"
              >
                ▶ Play Sound
              </button>

            </div>

          </article>

        `;

      }
    ).join("");

  container
    .querySelectorAll(".understand-audio")
    .forEach(button => {
      button.addEventListener("click", (e) => {
        e.stopPropagation();
        playAudio(
          button.dataset.audio,
          button.dataset.text,
          button
        );
      });
    });

}


/* =========================================================
   RENDER STORY READING
   ========================================================= */

function renderStoryReading(
  storyRows
) {

  const container =
    document.getElementById(
      "storyContent"
    );


  if (!container) {
    return;
  }


  if (!storyRows.length) {

    container.innerHTML = `

      <div class="empty-card">

        <h3>
          No story content yet
        </h3>

        <p>
          Add sentences to the
          <strong>Story</strong>
          sheet in lessons.xlsx.
        </p>

      </div>

    `;

    return;

  }


  container.innerHTML =
    storyRows.map(
      (row, index) => {

        const chinese =
          getValue(
            row,
            "chinese",
            "Chinese"
          );


        const pinyin =
          getValue(
            row,
            "pinyin",
            "Pinyin"
          );


        const english =
          getValue(
            row,
            "english",
            "English"
          );


        const audio =
          getValue(
            row,
            "audio",
            "Audio"
          );


        return `

          <article class="reading-item">

            <div class="reading-number">
              ${String(index + 1).padStart(2, "0")}
            </div>


            <div class="reading-content">

              <div class="chinese-sentence chinese-kaiti" style="font-family: 'KaiTi', 'STKaiti', '楷体', 'Kaiti SC', 'Ma Shan Zheng', serif;">
                ${escapeHTML(chinese)}
              </div>


              ${
                pinyin
                  ? `
                    <div class="pinyin-sentence">
                      ${escapeHTML(pinyin)}
                    </div>
                  `
                  : ""
              }


              ${
                english
                  ? `
                    <div class="english-sentence">
                      ${escapeHTML(english)}
                    </div>
                  `
                  : ""
              }


              <button
                class="audio-button reading-audio"
                type="button"
                data-audio="${escapeHTML(audio)}"
                data-text="${escapeHTML(chinese)}"
              >
                ▶ Play
              </button>

            </div>

          </article>

        `;

      }
    ).join("");


  container
    .querySelectorAll(
      ".reading-audio"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          playAudio(
            button.dataset.audio,
            button.dataset.text,
            button
          );

        }
      );

    });

}


/* =========================================================
   RENDER VOCABULARY
   ========================================================= */

function renderVocabulary(
  vocabularyRows
) {

  const container =
    document.getElementById(
      "vocabularyContent"
    );


  if (!container) {
    return;
  }


  if (!vocabularyRows.length) {

    container.innerHTML = `

      <div class="empty-card">

        <h3>
          No vocabulary yet
        </h3>

        <p>
          Add vocabulary to the
          <strong>Vocabulary</strong>
          sheet in lessons.xlsx.
        </p>

      </div>

    `;

    return;

  }


  container.innerHTML =
    vocabularyRows.map(
      (row, index) => {

        const character =
          getValue(
            row,
            "character",
            "Character",
            "word",
            "Word"
          );


        const pinyin =
          getValue(
            row,
            "pinyin",
            "Pinyin"
          );


        const meaning =
          getValue(
            row,
            "meaning",
            "Meaning"
          );


        const audio =
          getValue(
            row,
            "audio",
            "Audio"
          );


        return `

          <article class="vocabulary-card">

            <div class="vocabulary-number">
              ${String(index + 1).padStart(2, "0")}
            </div>


            <div class="vocabulary-character chinese-kaiti" style="font-family: 'KaiTi', 'STKaiti', '楷体', 'Kaiti SC', 'Ma Shan Zheng', serif;">
              ${escapeHTML(character)}
            </div>


            <div class="vocabulary-pinyin">
              ${escapeHTML(pinyin)}
            </div>


            <div class="vocabulary-meaning">
              ${escapeHTML(meaning)}
            </div>


            <button
              class="audio-button vocabulary-audio"
              type="button"
              data-audio="${escapeHTML(audio)}"
              data-text="${escapeHTML(character)}"
            >
              ▶ Play
            </button>

          </article>

        `;

      }
    ).join("");


  container
    .querySelectorAll(
      ".vocabulary-audio"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          playAudio(
            button.dataset.audio,
            button.dataset.text,
            button
          );

        }
      );

    });

}


/* =========================================================
   NORMALIZE ANSWER
   ========================================================= */

function normalizeAnswer(
  value
) {

  return String(
    value ?? ""
  )
    .trim()
    .toLowerCase();

}


/* =========================================================
   RENDER EXERCISES
   ========================================================= */

function renderExercises(
  exerciseRows
) {

  const container =
    document.getElementById(
      "exerciseContent"
    );


  if (!container) {
    return;
  }


  if (!exerciseRows.length) {

    container.innerHTML = `

      <span class="section-label">
        05 · EXERCISES
      </span>

      <h2>
        Check Your Understanding
      </h2>

      <div class="empty-card">

        <h3>
          No exercises yet
        </h3>

        <p>
          Add exercises to the
          <strong>Exercises</strong>
          sheet in lessons.xlsx.
        </p>

      </div>

    `;

    return;

  }


  let html = `

    <span class="section-label">
      05 · EXERCISES
    </span>

    <h2>
      Check Your Understanding
    </h2>

    <p class="exercise-intro">
      Answer the questions below to check
      your understanding of the lesson.
    </p>

    <div class="exercise-list">

  `;


  exerciseRows.forEach(
    (row, index) => {

      const type =
        normalizeAnswer(
          getValue(
            row,
            "type",
            "Type"
          )
        );


      const question =
        getValue(
          row,
          "question",
          "Question"
        );


      const answer =
        getValue(
          row,
          "answer",
          "Answer"
        );


      const options = [

        getValue(
          row,
          "optionA",
          "OptionA",
          "Option A"
        ),

        getValue(
          row,
          "optionB",
          "OptionB",
          "Option B"
        ),

        getValue(
          row,
          "optionC",
          "OptionC",
          "Option C"
        ),

        getValue(
          row,
          "optionD",
          "OptionD",
          "Option D"
        )

      ].filter(
        option =>
          String(option).trim() !== ""
      );


      html += `

        <article
          class="exercise-item"
          data-answer="${escapeHTML(answer)}"
        >

          <div class="exercise-number">
            ${String(index + 1).padStart(2, "0")}
          </div>


          <div class="exercise-body">

            <h3>
              ${escapeHTML(question)}
            </h3>

      `;


      if (
        type === "multiple-choice" ||
        type === "multiple choice" ||
        options.length
      ) {

        html += `
          <div class="exercise-options">
        `;


        options.forEach(
          option => {

            html += `

              <button
                type="button"
                class="exercise-option"
                data-value="${escapeHTML(option)}"
              >
                ${escapeHTML(option)}
              </button>

            `;

          }
        );


        html += `
          </div>
        `;

      }


      html += `

            <div
              class="exercise-feedback"
              aria-live="polite"
            ></div>

          </div>

        </article>

      `;

    }
  );


  html += `
    </div>
    <div class="story-complete-review-bar">
      <div class="story-complete-review-copy">
        <strong>Finished this lesson?</strong>
        <span>Complete the story and share your feedback in a quick review.</span>
      </div>
      <button type="button" class="btn btn-primary" id="btnFinishStoryReview">
        ✓ Finish Lesson &amp; Leave Review
      </button>
    </div>
  `;


  container.innerHTML =
    html;

  const finishReviewBtn = document.getElementById("btnFinishStoryReview");
  if (finishReviewBtn) {
    finishReviewBtn.addEventListener("click", () => {
      finishStoryLessonAndReview();
    });
  }

  initializeExercises();

}


/* =========================================================
   EXERCISE INTERACTION
   ========================================================= */

function initializeExercises() {

  const exercises =
    document.querySelectorAll(
      ".exercise-item"
    );


  exercises.forEach(
    exercise => {

      const answer =
        normalizeAnswer(
          exercise.dataset.answer
        );


      const options =
        exercise.querySelectorAll(
          ".exercise-option"
        );


      const feedback =
        exercise.querySelector(
          ".exercise-feedback"
        );


      options.forEach(
        option => {

          option.addEventListener(
            "click",
            () => {

              options.forEach(
                button => {

                  button.classList.remove(
                    "correct",
                    "incorrect"
                  );

                }
              );


              const selected =
                normalizeAnswer(
                  option.dataset.value
                );


              const isCorrect =
                selected === answer;


              option.classList.add(
                isCorrect
                  ? "correct"
                  : "incorrect"
              );

              playFeedbackSound(isCorrect);

              const chineseMatch = (option.dataset.value || "").match(/[\u4e00-\u9fa5]+/);
              if (chineseMatch) {
                speakText(chineseMatch[0]);
              }

              if (feedback) {

                if (isCorrect) {

                  feedback.textContent =
                    "✓ Correct!";

                  feedback.className =
                    "exercise-feedback correct-feedback";

                  checkAllExercisesCompleted();

                } else {

                  feedback.textContent =
                    "Not quite. Try again.";

                  feedback.className =
                    "exercise-feedback incorrect-feedback";

                }

              }

            }
          );

        }
      );

    }
  );

}


/* =========================================================
   UPDATE LESSON NAVIGATION
   ========================================================= */

function updateLessonNavigation(
  story,
  vocabulary,
  exercises
) {

  const storyLink =
    document.querySelector(
      '.lesson-navigation a[href="#reading"]'
    );


  const vocabularyLink =
    document.querySelector(
      '.lesson-navigation a[href="#vocabulary"]'
    );


  const exerciseLink =
    document.querySelector(
      '.lesson-navigation a[href="#exercises"]'
    );


  if (storyLink) {

    storyLink.textContent =
      `03 Story (${story.length})`;

  }


  if (vocabularyLink) {

    vocabularyLink.textContent =
      `04 Vocabulary (${vocabulary.length})`;

  }


  if (exerciseLink) {

    exerciseLink.textContent =
      `05 Exercises (${exercises.length})`;

  }

}


/* =========================================================
   GET LESSON ID FROM URL
   ========================================================= */

function getLessonId() {
  try {
    const params = new URLSearchParams(window.location.search);
    const id =
      params.get("id") ||
      params.get("lesson") ||
      params.get("lessonId") ||
      params.get("story") ||
      params.get("storyId");
    if (id && String(id).trim() !== "") {
      return String(id).trim();
    }
  } catch (e) {
    console.warn("Could not read URL parameters:", e);
  }
  return "lesson-01";
}


/* =========================================================
   LOAD STORY DATA
   ========================================================= */

async function loadStoryLesson() {
  if (!document.getElementById("storyContent")) return;
  try {
    const lessonId = getLessonId();

    let workbook = null;
    let lessons = [];
    let allStoryRows = [];
    let allVocabularyRows = [];
    let allExerciseRows = [];
    let loaded = false;

    // Strategy 1: Shared Excel Content Store (Local Admin Draft -> Repository data/stories.xlsx -> .json fallback)
    if (window.LinguaContentStore && typeof window.LinguaContentStore.loadStoriesWorkbook === "function") {
      try {
        const storeRes = await window.LinguaContentStore.loadStoriesWorkbook();
        if (storeRes && storeRes.sheets) {
          lessons = storeRes.sheets["Lessons"] || [];
          allStoryRows = storeRes.sheets["Story"] || [];
          allVocabularyRows = storeRes.sheets["Vocabulary"] || [];
          allExerciseRows = storeRes.sheets["Exercises"] || [];
          if (lessons.length > 0 || allStoryRows.length > 0) {
            loaded = true;
          }
        }
      } catch (storeErr) {
        console.warn("Content store fallback note for story:", storeErr);
      }
    }

    // Strategy 2: Direct Excel parsing if XLSX is available in the browser
    if (!loaded && typeof XLSX !== "undefined") {
      try {
        const response = await fetch(EXCEL_FILE, { cache: "no-cache" });
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          workbook = XLSX.read(arrayBuffer, { type: "array" });

          if (workbook && workbook.SheetNames) {
            lessons = readSheet(workbook, "Lessons");
            allStoryRows = readSheet(workbook, "Story");
            allVocabularyRows = readSheet(workbook, "Vocabulary");
            allExerciseRows = readSheet(workbook, "Exercises");
            if (lessons.length > 0 || allStoryRows.length > 0) {
              loaded = true;
            }
          }
        }
      } catch (excelErr) {
        console.warn("Client-side story Excel parsing note:", excelErr);
      }
    }

    // Strategy 3: Static JSON file data/stories.json
    if (!loaded) {
      try {
        const jsonResponse = await fetch("data/stories.json", { cache: "no-cache" });
        if (jsonResponse.ok) {
          const jsonData = await jsonResponse.json();
          if (jsonData.sheets) {
            lessons = jsonData.sheets["Lessons"] || [];
            allStoryRows = jsonData.sheets["Story"] || [];
            allVocabularyRows = jsonData.sheets["Vocabulary"] || [];
            allExerciseRows = jsonData.sheets["Exercises"] || [];
            if (lessons.length > 0 || allStoryRows.length > 0) {
              loaded = true;
            }
          }
        }
      } catch (jsonErr) {
        console.warn("Static JSON fallback note for story:", jsonErr);
      }
    }

    // Strategy 4: Embedded fallback dataset directly matching data/lessons.xlsx
    if (!loaded) {
      console.info("Using embedded story lesson dataset.");
      lessons = [
        {
          id: "lesson-01",
          title: "Xiaoming's Day",
          chineseTitle: "小明的一天",
          pinyin: "Xiǎomíng de yì tiān",
          meaning: "Xiaoming's Day",
          level: "Beginner",
          description: "Learn Chinese through a simple story.",
          video: "assets/video/story-01.mp4",
          poster: "assets/images/story-poster.jpg"
        },
        {
          id: "lesson-02",
          title: "Xiaoming Buys Fruit",
          chineseTitle: "小明买水果",
          pinyin: "Xiǎomíng mǎi shuǐguǒ",
          meaning: "Xiaoming Buys Fruit",
          level: "Beginner",
          description: "Follow Xiaoming to the lively fruit market as he buys fresh sweet apples.",
          video: "assets/video/story-02.mp4",
          poster: "assets/images/story2-poster.svg"
        }
      ];
      allStoryRows = [
        { lessonId: "lesson-01", order: 1, chinese: "早上好！", pinyin: "Zǎoshang hǎo!", english: "Good morning!", image: "assets/images/story-01.jpg", audio: "assets/audio/story-01.mp3" },
        { lessonId: "lesson-01", order: 2, chinese: "小明起床了。", pinyin: "Xiǎomíng qǐchuáng le.", english: "Xiaoming gets up.", image: "assets/images/story-02.jpg", audio: "assets/audio/story-02.mp3" },
        { lessonId: "lesson-01", order: 3, chinese: "他吃早饭。", pinyin: "Tā chī zǎofàn.", english: "He eats breakfast.", image: "assets/images/story-03.jpg", audio: "assets/audio/story-03.mp3" },
        { lessonId: "lesson-01", order: 4, chinese: "然后，他去学校。", pinyin: "Ránhòu, tā qù xuéxiào.", english: "Then, he goes to school.", image: "assets/images/story-04.jpg", audio: "assets/audio/story-04.mp3" },
        { lessonId: "lesson-01", order: 5, chinese: "他很开心。", pinyin: "Tā hěn kāixīn.", english: "He is very happy.", image: "assets/images/story-05.jpg", audio: "assets/audio/story-05.mp3" },

        { lessonId: "lesson-02", order: 1, chinese: "今天天气真好！", pinyin: "Jīntiān tiānqì zhēn hǎo!", english: "The weather is really nice today!", image: "assets/images/story2-01.svg", audio: "assets/audio/story2-01.mp3" },
        { lessonId: "lesson-02", order: 2, chinese: "小明去水果市场。", pinyin: "Xiǎomíng qù shuǐguǒ shìchǎng.", english: "Xiaoming goes to the fruit market.", image: "assets/images/story2-02.svg", audio: "assets/audio/story2-02.mp3" },
        { lessonId: "lesson-02", order: 3, chinese: "市场里有很多新鲜的红苹果。", pinyin: "Shìchǎng lǐ yǒu hěn duō xīnxiān de hóng píngguǒ.", english: "There are many fresh red apples in the market.", image: "assets/images/story2-03.svg", audio: "assets/audio/story2-03.mp3" },
        { lessonId: "lesson-02", order: 4, chinese: "他买了三个大苹果。", pinyin: "Tā mǎi le sān gè dà píngguǒ.", english: "He bought three big apples.", image: "assets/images/story2-04.svg", audio: "assets/audio/story2-04.mp3" },
        { lessonId: "lesson-02", order: 5, chinese: "苹果又甜又好吃，他真开心！", pinyin: "Píngguǒ yòu tián yòu hǎochī, tā zhēn kāixīn!", english: "The apples are sweet and delicious, he is really happy!", image: "assets/images/story2-05.svg", audio: "assets/audio/story2-05.mp3" }
      ];
      allVocabularyRows = [
        { lessonId: "lesson-01", order: 1, character: "早上", pinyin: "zǎoshang", meaning: "morning", audio: "assets/audio/zaoshang.mp3" },
        { lessonId: "lesson-01", order: 2, character: "起床", pinyin: "qǐchuáng", meaning: "get up", audio: "assets/audio/qichuang.mp3" },
        { lessonId: "lesson-01", order: 3, character: "学校", pinyin: "xuéxiào", meaning: "school", audio: "assets/audio/xuexiao.mp3" },
        { lessonId: "lesson-01", order: 4, character: "开心", pinyin: "kāixīn", meaning: "happy", audio: "assets/audio/kaixin.mp3" },

        { lessonId: "lesson-02", order: 1, character: "水果", pinyin: "shuǐguǒ", meaning: "fruit", audio: "assets/audio/shuiguo.mp3" },
        { lessonId: "lesson-02", order: 2, character: "市场", pinyin: "shìchǎng", meaning: "market", audio: "assets/audio/shichang.mp3" },
        { lessonId: "lesson-02", order: 3, character: "苹果", pinyin: "píngguǒ", meaning: "apple", audio: "assets/audio/pingguo.mp3" },
        { lessonId: "lesson-02", order: 4, character: "新鲜", pinyin: "xīnxiān", meaning: "fresh", audio: "assets/audio/xinxian.mp3" }
      ];
      allExerciseRows = [
        { lessonId: "lesson-01", order: 1, type: "multiple-choice", question: "Where does Xiaoming go?", optionA: "家 — Home", optionB: "学校 — School", optionC: "商店 — Shop", answer: "学校 — School" },

        { lessonId: "lesson-02", order: 1, type: "multiple-choice", question: "Where does Xiaoming go today?", optionA: "水果市场 — Fruit market", optionB: "学校 — School", optionC: "电影院 — Cinema", answer: "水果市场 — Fruit market" },
        { lessonId: "lesson-02", order: 2, type: "multiple-choice", question: "What fruit did Xiaoming buy?", optionA: "苹果 — Apples", optionB: "香蕉 — Bananas", optionC: "西瓜 — Watermelon", answer: "苹果 — Apples" },
        { lessonId: "lesson-02", order: 3, type: "multiple-choice", question: "How do the apples taste?", optionA: "又甜又好吃 — Sweet and delicious", optionB: "很酸 — Very sour", optionC: "不新鲜 — Not fresh", answer: "又甜又好吃 — Sweet and delicious" }
      ];
      loaded = true;
    }

    cachedStoryWorkbook = {
      loaded: true,
      lessons,
      allStoryRows,
      allVocabularyRows,
      allExerciseRows
    };

    const currentLessonId = renderActiveStoryById(lessonId);

    console.log("Story lesson loaded successfully:", {
      lessonId: currentLessonId,
      lesson: currentLoadedLesson,
      storyCount: sortByOrder(filterByLesson(allStoryRows, currentLessonId)).length,
      vocabularyCount: sortByOrder(filterByLesson(allVocabularyRows, currentLessonId)).length,
      exerciseCount: sortByOrder(filterByLesson(allExerciseRows, currentLessonId)).length
    });

  } catch (error) {
    console.error("Story lesson loading error:", error);
    showPageError(error);
  }
}

function renderActiveStoryById(lessonId) {
  const lessons = cachedStoryWorkbook.lessons || [];
  const allStoryRows = cachedStoryWorkbook.allStoryRows || [];
  const allVocabularyRows = cachedStoryWorkbook.allVocabularyRows || [];
  const allExerciseRows = cachedStoryWorkbook.allExerciseRows || [];

  // Match lesson by ID or fall back to first lesson
  const lesson = lessons.find(row => {
    const id = getValue(row, "id", "ID", "lessonId");
    return storyIdsMatch(id, lessonId);
  }) || lessons[0];

  if (!lesson) {
    throw new Error(`Lesson "${lessonId}" was not found in the Lessons sheet.`);
  }

  const currentLessonId = getValue(lesson, "id", "ID", "lessonId") || lessonId;

  // Filter by active lesson ID
  let storyRows = sortByOrder(filterByLesson(allStoryRows, currentLessonId));
  let vocabularyRows = sortByOrder(filterByLesson(allVocabularyRows, currentLessonId));
  let exerciseRows = sortByOrder(filterByLesson(allExerciseRows, currentLessonId));

  // Fall back to all sheet rows only if there is only 1 lesson and filtering returned empty
  if (storyRows.length === 0 && allStoryRows.length > 0 && lessons.length <= 1) {
    storyRows = sortByOrder(allStoryRows);
  }
  if (vocabularyRows.length === 0 && allVocabularyRows.length > 0 && lessons.length <= 1) {
    vocabularyRows = sortByOrder(allVocabularyRows);
  }
  if (exerciseRows.length === 0 && allExerciseRows.length > 0 && lessons.length <= 1) {
    exerciseRows = sortByOrder(allExerciseRows);
  }

  currentLoadedLessonId = currentLessonId;
  currentLoadedLesson = lesson;
  currentLoadedAllLessons = lessons;

  // Render all page sections
  renderLessonHeader(lesson);
  renderVideo(lesson, storyRows);
  renderStoryImages(storyRows);
  renderStoryReading(storyRows);
  renderVocabulary(vocabularyRows);
  renderExercises(exerciseRows);
  updateLessonNavigation(storyRows, vocabularyRows, exerciseRows);
  renderStorySidebar(lessons, currentLessonId);
  renderStoryPagination(lessons, currentLessonId);
  setupStoryProgress(currentLessonId);

  return currentLessonId;
}

function switchStory(targetLessonId, updateUrl = true, shouldScroll = true) {
  if (!targetLessonId) return;

  stopAllStoryPlayback();

  if (!cachedStoryWorkbook.loaded) {
    if (updateUrl) {
      try {
        const nextUrl = new URL(window.location.href);
        nextUrl.searchParams.set("id", targetLessonId);
        window.history.pushState({ storyId: targetLessonId }, "", nextUrl.toString());
      } catch (e) {
        /* ignore */
      }
    }
    loadStoryLesson();
    return;
  }

  const resolvedId = renderActiveStoryById(targetLessonId);

  if (updateUrl) {
    try {
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.set("id", resolvedId);
      window.history.pushState({ storyId: resolvedId }, "", nextUrl.toString());
    } catch (e) {
      /* ignore */
    }
  }

  if (shouldScroll) {
    const mainStage = document.getElementById("storiesMainStage") || document.getElementById("stories-view");
    if (mainStage) {
      mainStage.classList.remove("is-switching");
      void mainStage.offsetWidth;
      mainStage.classList.add("is-switching");
      const rect = mainStage.getBoundingClientRect();
      const topOffset = window.innerWidth <= 900 ? 84 : 92;
      const targetTop = Math.max(0, window.pageYOffset + rect.top - topOffset);
      window.scrollTo({ top: targetTop, behavior: "smooth" });
    }
  }
}


/* =========================================================
   RENDER LEFT SIDEBAR STORY MENU & BOTTOM PAGINATION
   ========================================================= */

function renderStorySidebar(lessons, currentLessonId) {
  const sidebar = document.getElementById("storyCourseSidebar");
  if (!sidebar) return;

  if (!lessons || !lessons.length) {
    sidebar.innerHTML = "";
    return;
  }

  const itemsHtml = lessons.map((l, index) => {
    const lId = getValue(l, "id", "ID", "lessonId") || `lesson-0${index + 1}`;
    const cnTitle = getValue(l, "chineseTitle", "ChineseTitle") || getValue(l, "title", "Title") || `Story ${index + 1}`;
    const enTitle = getValue(l, "title", "Title");
    const showEnTitle = Boolean(enTitle && enTitle !== cnTitle);
    const isActive = storyIdsMatch(lId, currentLessonId);
    const prog = getStoryLessonProgress(lId);
    const isDone = isStoryLessonCompleted(lId);
    const isInProgress = !isDone && prog && prog.percent > 0;
    const statusClass = isDone ? "is-done" : (isInProgress ? "is-progress" : "");
    const statusLabel = isDone ? "✓ Done" : (isInProgress ? "In Progress" : "Unread");

    return `
      <button
        type="button"
        class="story-sidebar-btn ${isActive ? "active" : ""}"
        data-story-id="${escapeHTML(lId)}"
        ${isActive ? 'aria-current="page"' : ""}
      >
        <div class="story-sidebar-top">
          <span class="story-sidebar-index">Story ${index + 1}</span>
          <span class="story-sidebar-status ${statusClass}">${escapeHTML(statusLabel)}</span>
        </div>
        <span class="story-sidebar-title-cn">${escapeHTML(cnTitle)}</span>
        ${showEnTitle ? `<span class="story-sidebar-title-en">${escapeHTML(enTitle)}</span>` : ""}
      </button>
    `;
  }).join("");

  sidebar.innerHTML = `
    <div class="stories-sidebar-header">
      <span class="stories-sidebar-kicker">Stories</span>
      <h2 class="stories-sidebar-title">Story Library</h2>
    </div>
    <nav class="stories-nav" aria-label="Story Lessons">
      ${itemsHtml}
    </nav>
  `;

  sidebar.querySelectorAll(".story-sidebar-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-story-id");
      if (!targetId) return;
      switchStory(targetId, true, true);
    });
  });
}

function renderStoryPagination(lessons, currentLessonId) {
  const container = document.getElementById("storyPaginationCard");
  if (!container) return;

  if (!lessons || lessons.length <= 1) {
    container.innerHTML = `
      <div class="story-pagination-info">
        <h3>Keep Practicing</h3>
        <p>Return to the Learning Hub to discover more lessons and practice pronunciation.</p>
      </div>
      <div class="story-pagination-actions">
        <a href="index.html#lessons" class="btn btn-primary">
          Back to Learning Hub
        </a>
      </div>
    `;
    return;
  }

  const currentIndex = lessons.findIndex(l => {
    const lId = getValue(l, "id", "ID", "lessonId");
    return storyIdsMatch(lId, currentLessonId);
  });

  const prevLesson = currentIndex > 0 ? lessons[currentIndex - 1] : null;
  const nextLesson = currentIndex < lessons.length - 1 && currentIndex >= 0 ? lessons[currentIndex + 1] : null;

  let actionsHtml = "";
  if (prevLesson) {
    const prevId = getValue(prevLesson, "id", "ID", "lessonId");
    const prevTitle = getValue(prevLesson, "chineseTitle") || getValue(prevLesson, "title") || "Previous Story";
    actionsHtml += `
      <a href="story.html?id=${encodeURIComponent(prevId)}" data-story-nav="${escapeHTML(prevId)}" class="btn btn-secondary">
        &larr; Story ${currentIndex}: ${escapeHTML(prevTitle)}
      </a>
    `;
  }

  actionsHtml += `
    <a href="index.html#lessons" class="btn btn-outline">
      Learning Hub
    </a>
  `;

  if (nextLesson) {
    const nextId = getValue(nextLesson, "id", "ID", "lessonId");
    const nextTitle = getValue(nextLesson, "chineseTitle") || getValue(nextLesson, "title") || "Next Story";
    actionsHtml += `
      <a href="story.html?id=${encodeURIComponent(nextId)}" data-story-nav="${escapeHTML(nextId)}" class="btn btn-primary">
        Story ${currentIndex + 2}: ${escapeHTML(nextTitle)} &rarr;
      </a>
    `;
  }

  container.innerHTML = `
    <div class="story-pagination-info">
      <h3>Chinese Story Lessons</h3>
      <p>Currently viewing Story ${currentIndex >= 0 ? currentIndex + 1 : 1} of ${lessons.length}: <strong>${escapeHTML(getValue(lessons[currentIndex] || lessons[0], "title"))}</strong></p>
    </div>
    <div class="story-pagination-actions">
      ${actionsHtml}
    </div>
  `;

  container.querySelectorAll("[data-story-nav]").forEach(link => {
    link.addEventListener("click", (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      e.preventDefault();
      const targetId = link.getAttribute("data-story-nav");
      if (targetId) {
        switchStory(targetId, true, true);
      }
    });
  });
}


/* =========================================================
   READ SHEET
   ========================================================= */

function readSheet(
  workbook,
  sheetName
) {

  const sheet =
    workbook.Sheets[
      sheetName
    ];


  if (!sheet) {

    console.warn(
      `Sheet "${sheetName}" was not found.`
    );

    return [];

  }


  return XLSX.utils.sheet_to_json(
    sheet,
    {
      defval: ""
    }
  );

}


/* =========================================================
   ERROR DISPLAY
   ========================================================= */

function showPageError(
  error
) {

  const containers = [
    document.getElementById("storyImageGrid"),
    document.getElementById("storyContent"),
    document.getElementById("vocabularyContent"),
    document.getElementById("exerciseContent")
  ];


  containers.forEach(
    container => {

      if (!container) {
        return;
      }


      container.innerHTML = `

        <div class="error-card">

          <h3>
            Lesson data could not be loaded.
          </h3>

          <p>
            Please check that
            <strong>data/lessons.xlsx</strong>
            exists and that the page is being opened
            through a local web server.
          </p>

          <small>
            ${escapeHTML(error.message)}
          </small>

        </div>

      `;

    }
  );

}


/* =========================================================
   STORY PROGRESS TRACKING (LOCALSTORAGE PERSISTENCE)
   ========================================================= */

function isAuthenticatedMember() {
  return Boolean(window.LinguaAuth && typeof window.LinguaAuth.getState === "function" && window.LinguaAuth.getState().user);
}

function getScopedProgressKey() {
  const uid = window.LinguaAuth?.getState()?.user?.uid;
  return uid ? `linguapath_lesson_progress_${uid}` : "linguapath_lesson_progress";
}

function getCurrentStoryDisplayTitle() {
  if (currentLoadedLesson) {
    return currentLoadedLesson.title
      ? `${currentLoadedLesson.title}${currentLoadedLesson.chineseTitle ? ` (${currentLoadedLesson.chineseTitle})` : ""}`
      : currentLoadedLessonId;
  }
  return currentLoadedLessonId || "Chinese Story Lesson";
}

function getStoryLessonProgress(lessonId) {
  try {
    const raw = localStorage.getItem(getScopedProgressKey());
    const all = raw ? JSON.parse(raw) : {};
    const cleanId = String(lessonId || "").trim();
    return all[cleanId] || { completed: false, percent: 0 };
  } catch (e) {
    return { completed: false, percent: 0 };
  }
}

function saveStoryLessonProgress(lessonId, percent, completed) {
  try {
    const cleanId = String(lessonId || "").trim();
    const raw = localStorage.getItem(getScopedProgressKey());
    const all = raw ? JSON.parse(raw) : {};
    const isDone = Boolean(completed || percent >= 100);
    all[cleanId] = {
      percent: isDone ? 100 : Math.min(100, Math.max(0, percent)),
      completed: isDone,
      lastUpdated: Date.now()
    };
    localStorage.setItem(getScopedProgressKey(), JSON.stringify(all));
    if (isAuthenticatedMember() && window.LinguaAuth && typeof window.LinguaAuth.recordLessonCompletedProgress === "function") {
      if (isDone) {
        window.LinguaAuth.recordLessonCompletedProgress(cleanId, true).catch(() => {});
      } else if (completed === false) {
        window.LinguaAuth.recordLessonCompletedProgress(cleanId, false).catch(() => {});
      }
    }
    updateUserLevelUI();
  } catch (e) {
    console.warn("Could not save story progress to localStorage:", e);
  }
}

function isStoryLessonCompleted(lessonId) {
  const prog = getStoryLessonProgress(lessonId);
  if (prog && (prog.completed || prog.percent >= 100)) {
    return true;
  }
  if (isAuthenticatedMember() && window.LinguaAuth && typeof window.LinguaAuth.getUserProgress === "function") {
    const cloud = window.LinguaAuth.getUserProgress();
    if (cloud && Array.isArray(cloud.completedLessonIds)) {
      return cloud.completedLessonIds.some(id => storyIdsMatch(id, lessonId));
    }
  }
  return false;
}

function updateStoryProgressUI(lessonId) {
  const btn = document.getElementById("storyProgressToggleBtn");
  const icon = document.getElementById("storyProgressIcon");
  const text = document.getElementById("storyProgressText");
  if (!btn) return;

  const prog = getStoryLessonProgress(lessonId);
  const isDone = isStoryLessonCompleted(lessonId);

  if (isDone) {
    btn.classList.add("is-completed");
    if (icon) icon.textContent = "✓";
    if (text) text.textContent = "Completed";
    btn.setAttribute("title", "Lesson completed! Click to mark incomplete.");
  } else {
    btn.classList.remove("is-completed");
    if (icon) icon.textContent = "○";
    if (text) text.textContent = prog.percent > 0 ? `${prog.percent}% In Progress` : "Mark Complete";
    btn.setAttribute("title", "Click to mark lesson complete");
  }
}

function finishStoryLessonAndReview() {
  if (currentLoadedLessonId) {
    saveStoryLessonProgress(currentLoadedLessonId, 100, true);
    updateStoryProgressUI(currentLoadedLessonId);
    renderStorySidebar(currentLoadedAllLessons, currentLoadedLessonId);
    recordLessonCompletionStreak();
  }
  const title = getCurrentStoryDisplayTitle();
  if (window.LinguaReview && typeof window.LinguaReview.openLessonReviewModal === "function") {
    window.LinguaReview.openLessonReviewModal({
      lessonId: currentLoadedLessonId || "story-lesson",
      title,
      audience: "Story Lesson"
    });
  } else {
    showStoryCompletionModal(title, currentLoadedLessonId, currentLoadedAllLessons);
  }
}

function checkAllExercisesCompleted() {
  const allExercises = document.querySelectorAll(".exercise-item");
  if (!allExercises.length) return;

  const correctCount = document.querySelectorAll(".exercise-item .exercise-option.correct").length;
  if (correctCount >= allExercises.length) {
    const prog = getStoryLessonProgress(currentLoadedLessonId);
    if (!prog.completed) {
      finishStoryLessonAndReview();
    }
  }
}

function getTotalCompletedLessonsCount() {
  if (!isAuthenticatedMember()) return 0;
  if (window.LinguaAuth && typeof window.LinguaAuth.getUserProgress === "function") {
    const cloud = window.LinguaAuth.getUserProgress();
    if (cloud && Array.isArray(cloud.completedLessonIds)) {
      return cloud.completedLessonIds.length;
    }
  }
  try {
    const raw = localStorage.getItem(getScopedProgressKey());
    if (!raw) return 0;
    const all = JSON.parse(raw);
    let count = 0;
    for (const k of Object.keys(all)) {
      if (all[k] && (all[k].completed || all[k].percent >= 100)) {
        count++;
      }
    }
    return count;
  } catch (e) {
    return 0;
  }
}

function showStoryCompletionModal(lessonTitle, lessonId, lessons) {
  const modal = document.getElementById("completionModal");
  if (!modal) return;

  const isMember = isAuthenticatedMember();
  const count = isMember ? getTotalCompletedLessonsCount() : 0;
  const streakData = getDailyStreakData();
  const totalAvailable = (lessons && lessons.length) ? lessons.length : 2;
  const levelInfo = getUserLevelInfo(count);

  const statsBox = modal.querySelector(".completion-stats-box");
  if (statsBox) {
    statsBox.style.display = isMember ? "" : "none";
  }

  const titleEl = document.getElementById("completionLessonTitle");
  if (titleEl) {
    titleEl.textContent = lessonTitle ? `You completed ${lessonTitle}!` : "You completed this lesson!";
  }

  const countEl = document.getElementById("completionTotalCount");
  if (countEl) {
    countEl.textContent = String(count);
  }

  const streakEl = document.getElementById("completionStreakCount");
  if (streakEl) {
    const s = streakData.currentStreak;
    streakEl.textContent = `${s} ${s === 1 ? "Day" : "Days"}`;
  }

  const rankIconEl = document.getElementById("completionRankIcon");
  if (rankIconEl) {
    rankIconEl.textContent = levelInfo.icon;
  }

  const rankValEl = document.getElementById("completionRankValue");
  if (rankValEl) {
    rankValEl.textContent = `${levelInfo.rank}`;
  }

  const statusEl = document.getElementById("completionStatusMessage");
  if (statusEl) {
    if (count >= totalAvailable && totalAvailable > 0) {
      statusEl.textContent = `🌟 Outstanding achievement! You reached ${levelInfo.rank} rank and completed all ${totalAvailable} lessons! Keep up your streak!`;
    } else {
      statusEl.textContent = `You've completed ${count} of ${totalAvailable} lessons. Current rank: ${levelInfo.rank} (${levelInfo.chineseRank})!`;
    }
  }

  // Find next lesson if available
  const list = lessons || [];
  const currIdx = list.findIndex(l => storyIdsMatch(l.id || l.lessonId, lessonId));
  const nextLesson = (currIdx >= 0 && currIdx + 1 < list.length)
    ? list[currIdx + 1]
    : list.find(l => !storyIdsMatch(l.id || l.lessonId, lessonId));

  const actionsContainer = document.getElementById("completionModalActions");
  if (actionsContainer) {
    actionsContainer.innerHTML = "";

    const reviewBtn = document.createElement("button");
    reviewBtn.type = "button";
    reviewBtn.className = "btn btn-primary";
    reviewBtn.textContent = "⭐ Leave a Lesson Review";
    reviewBtn.addEventListener("click", () => {
      closeStoryCompletionModal();
      if (window.LinguaReview && typeof window.LinguaReview.openLessonReviewModal === "function") {
        window.LinguaReview.openLessonReviewModal({
          lessonId: lessonId || currentLoadedLessonId || "story-lesson",
          title: lessonTitle || getCurrentStoryDisplayTitle(),
          audience: "Story Lesson"
        });
      }
    });
    actionsContainer.appendChild(reviewBtn);

    if (nextLesson) {
      const nextId = nextLesson.id || nextLesson.lessonId;
      const nextBtn = document.createElement("a");
      nextBtn.href = `story.html?id=${encodeURIComponent(nextId)}`;
      nextBtn.className = "btn btn-secondary";
      nextBtn.textContent = `Next: ${nextLesson.title || "Next Lesson"} →`;
      nextBtn.addEventListener("click", (e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        closeStoryCompletionModal();
        switchStory(nextId, true, true);
      });
      actionsContainer.appendChild(nextBtn);
    }

    const hubBtn = document.createElement("a");
    hubBtn.href = "index.html#lessons";
    hubBtn.className = "btn btn-secondary";
    hubBtn.textContent = "Learning Hub";
    actionsContainer.appendChild(hubBtn);

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "btn btn-secondary";
    closeBtn.textContent = "Close";
    closeBtn.addEventListener("click", closeStoryCompletionModal);
    actionsContainer.appendChild(closeBtn);
  }

  modal.classList.add("active");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeStoryCompletionModal() {
  const modal = document.getElementById("completionModal");
  if (!modal) return;
  modal.classList.remove("active");
  modal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function setupStoryCompletionModalListeners() {
  const modal = document.getElementById("completionModal");
  const closeBtn = document.getElementById("closeCompletionModalBtn");

  if (closeBtn) {
    closeBtn.addEventListener("click", closeStoryCompletionModal);
  }
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        closeStoryCompletionModal();
      }
    });
  }
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal && modal.classList.contains("active")) {
      closeStoryCompletionModal();
    }
  });
}

function setupStoryProgress(lessonId) {
  const current = getStoryLessonProgress(lessonId);
  // Mark as started (e.g. 35% in progress) if not started yet
  if (!isStoryLessonCompleted(lessonId) && current.percent === 0) {
    saveStoryLessonProgress(lessonId, 35, false);
  }
  updateStoryProgressUI(lessonId);
  renderStorySidebar(currentLoadedAllLessons, lessonId);

  const btn = document.getElementById("storyProgressToggleBtn");
  if (btn && !btn.dataset.bound) {
    btn.dataset.bound = "true";
    btn.addEventListener("click", () => {
      const activeId = currentLoadedLessonId || lessonId;
      const isDone = isStoryLessonCompleted(activeId);
      const newDone = !isDone;
      saveStoryLessonProgress(activeId, newDone ? 100 : 35, newDone);
      updateStoryProgressUI(activeId);
      renderStorySidebar(currentLoadedAllLessons, activeId);

      if (newDone) {
        recordLessonCompletionStreak();
        const title = currentLoadedLesson
          ? (currentLoadedLesson.title ? `${currentLoadedLesson.title} (${currentLoadedLesson.chineseTitle || ""})` : activeId)
          : activeId;
        showStoryCompletionModal(title, activeId, currentLoadedAllLessons);
      }
    });
  }
}


/* =========================================================
   DAILY STREAK COUNTER (LOCALSTORAGE PERSISTENCE)
========================================================= */

const STREAK_STORAGE_KEY = "linguapath_daily_streak";

function getLocalDateString(date = new Date()) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDaysDifference(dateStr1, dateStr2) {
  if (!dateStr1 || !dateStr2) return Infinity;
  const d1 = new Date(dateStr1 + "T00:00:00");
  const d2 = new Date(dateStr2 + "T00:00:00");
  const diffTime = d2.getTime() - d1.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

function getDailyStreakData() {
  if (!isAuthenticatedMember()) {
    return { currentStreak: 0, lastCompletedDate: null, streakDates: [], bestStreak: 0 };
  }
  try {
    const cloud = window.LinguaAuth.getUserProgress();
    if (cloud) {
      return {
        currentStreak: Number(cloud.currentStreak) || 0,
        lastCompletedDate: cloud.lastCompletedDate || null,
        streakDates: Array.isArray(cloud.streakDates) ? cloud.streakDates : [],
        bestStreak: Number(cloud.bestStreak) || 0
      };
    }
    return { currentStreak: 0, lastCompletedDate: null, streakDates: [], bestStreak: 0 };
  } catch (e) {
    console.warn("Could not read streak data:", e);
    return { currentStreak: 0, lastCompletedDate: null, streakDates: [], bestStreak: 0 };
  }
}

function recordLessonCompletionStreak() {
  if (!isAuthenticatedMember()) {
    return { currentStreak: 0, lastCompletedDate: null, bestStreak: 0 };
  }
  updateHeaderStreakUI();
  return getDailyStreakData();
}

function updateHeaderStreakUI() {
  const streakData = getDailyStreakData();
  const countEl = document.getElementById("dailyStreakCount");
  const badgeEl = document.getElementById("dailyStreakBadge");
  const tooltipTitle = document.getElementById("streakTooltipTitle");
  const tooltipDesc = document.getElementById("streakTooltipDesc");

  const streak = streakData.currentStreak;

  if (countEl) {
    countEl.textContent = String(streak);
  }

  if (badgeEl) {
    if (streak > 0) {
      badgeEl.classList.add("is-active");
      badgeEl.setAttribute("aria-label", `Daily Streak: ${streak} ${streak === 1 ? 'day' : 'days'}`);
    } else {
      badgeEl.classList.remove("is-active");
      badgeEl.setAttribute("aria-label", "Daily Streak: 0 days. Complete a lesson today to start!");
    }
  }

  if (tooltipTitle && tooltipDesc) {
    const today = getLocalDateString();
    const isCompletedToday = streakData.lastCompletedDate === today;

    if (streak > 0) {
      tooltipTitle.textContent = `🔥 ${streak}-Day Streak!`;
      if (isCompletedToday) {
        tooltipDesc.textContent = `You completed a lesson today! Come back tomorrow to keep the flame alive. (Best: ${streakData.bestStreak || streak} days)`;
      } else {
        tooltipDesc.textContent = `Complete a lesson today to extend your streak to ${streak + 1} days!`;
      }
    } else {
      tooltipTitle.textContent = "🔥 Start Your Daily Streak";
      tooltipDesc.textContent = "Complete any lesson today to ignite your streak!";
    }
  }
}

function setupStreakBadgeInteractions() {
  const badgeEl = document.getElementById("dailyStreakBadge");
  if (!badgeEl) return;

  badgeEl.addEventListener("click", (e) => {
    e.stopPropagation();
    badgeEl.classList.toggle("show-tooltip");
  });

  document.addEventListener("click", (e) => {
    if (!badgeEl.contains(e.target)) {
      badgeEl.classList.remove("show-tooltip");
    }
  });

  window.addEventListener("storage", (e) => {
    if (e.key === STREAK_STORAGE_KEY || e.key === "linguapath_lesson_progress") {
      updateHeaderStreakUI();
      updateUserLevelUI();
    }
  });
}


/* =========================================================
   USER LEVEL & RANK PROGRESSION SYSTEM (Novice, Scholar, Master)
========================================================= */

const USER_LEVEL_DEFINITIONS = [
  { level: 1, rank: "Novice", chineseRank: "初学者", minCompleted: 0, icon: "🌱", class: "rank-novice", nextRequired: 1 },
  { level: 2, rank: "Scholar", chineseRank: "学者", minCompleted: 1, icon: "📚", class: "rank-scholar", nextRequired: 2 },
  { level: 3, rank: "Master", chineseRank: "大师", minCompleted: 2, icon: "👑", class: "rank-master", nextRequired: null }
];

function getUserLevelInfo(completedCount) {
  const count = typeof completedCount === "number" ? completedCount : getTotalCompletedLessonsCount();
  let current = USER_LEVEL_DEFINITIONS[0];
  for (let i = USER_LEVEL_DEFINITIONS.length - 1; i >= 0; i--) {
    if (count >= USER_LEVEL_DEFINITIONS[i].minCompleted) {
      current = USER_LEVEL_DEFINITIONS[i];
      break;
    }
  }

  let progressPercent = 100;
  let progressText = "Maximum Rank Achieved!";
  let nextRankName = "Max Rank";

  if (current.nextRequired !== null) {
    const prevMin = current.minCompleted;
    const nextReq = current.nextRequired;
    const numerator = Math.max(0, count - prevMin);
    const denominator = Math.max(1, nextReq - prevMin);
    progressPercent = Math.min(100, Math.round((numerator / denominator) * 100));
    progressText = `${count} / ${nextReq} completed`;
    const nextDef = USER_LEVEL_DEFINITIONS.find((d) => d.minCompleted === current.nextRequired);
    nextRankName = nextDef ? `Next: ${nextDef.rank}` : "Next Rank";
  }

  return {
    ...current,
    count,
    progressPercent,
    progressText,
    nextRankName
  };
}

function updateUserLevelUI() {
  const count = getTotalCompletedLessonsCount();
  const info = getUserLevelInfo(count);

  const badgeEl = document.getElementById("userLevelBadge");
  const iconEl = document.getElementById("userLevelIcon");
  const rankEl = document.getElementById("userLevelRank");
  const subEl = document.getElementById("userLevelSubtitle");
  const tooltipTitle = document.getElementById("levelTooltipTitle");
  const tooltipChinese = document.getElementById("levelTooltipChinese");
  const tooltipDesc = document.getElementById("levelTooltipDesc");
  const progressBar = document.getElementById("levelProgressBar");
  const progressText = document.getElementById("levelProgressText");
  const nextRankEl = document.getElementById("levelNextRank");

  if (badgeEl) {
    badgeEl.classList.remove("rank-novice", "rank-scholar", "rank-master");
    badgeEl.classList.add(info.class);
    badgeEl.setAttribute("aria-label", `User Level: ${info.rank} (Level ${info.level})`);
    badgeEl.setAttribute("title", `User Learning Rank: ${info.rank} (${info.chineseRank})`);
  }

  if (iconEl) iconEl.textContent = info.icon;
  if (rankEl) rankEl.textContent = info.rank;
  if (subEl) subEl.textContent = `Lvl ${info.level}`;

  if (tooltipTitle) tooltipTitle.textContent = `${info.icon} ${info.rank} (Level ${info.level})`;
  if (tooltipChinese) tooltipChinese.textContent = info.chineseRank;

  if (tooltipDesc) {
    if (info.nextRequired !== null) {
      const needed = Math.max(1, info.nextRequired - count);
      tooltipDesc.textContent = `Complete ${needed} more ${needed === 1 ? "lesson" : "lessons"} to reach ${info.nextRankName.replace("Next: ", "")} rank!`;
    } else {
      tooltipDesc.textContent = "Congratulations! You have reached Master rank by completing all available lessons!";
    }
  }

  if (progressBar) {
    progressBar.style.width = `${info.progressPercent}%`;
  }
  if (progressText) {
    progressText.textContent = info.progressText;
  }
  if (nextRankEl) {
    nextRankEl.textContent = info.nextRankName;
  }
}

function setupUserLevelInteractions() {
  const badgeEl = document.getElementById("userLevelBadge");
  if (!badgeEl) return;

  badgeEl.addEventListener("click", (e) => {
    e.stopPropagation();
    badgeEl.classList.toggle("show-tooltip");
  });

  document.addEventListener("click", (e) => {
    if (!badgeEl.contains(e.target)) {
      badgeEl.classList.remove("show-tooltip");
    }
  });
}


/* =========================================================
   DAILY STUDY REMINDER & BROWSER NOTIFICATION SYSTEM
========================================================= */

const DAILY_REMINDER_STORAGE_KEY = "linguapath_daily_reminder";

function getDailyReminderSettings() {
  if (!isAuthenticatedMember()) {
    return { enabled: false, time: "18:00", lastNotifiedDate: null };
  }
  const cloud = window.LinguaAuth.getUserProgress();
  if (cloud) {
    return {
      enabled: cloud.reminderEnabled !== false,
      time: cloud.reminderTime || "18:00",
      lastNotifiedDate: cloud.lastNotifiedDate || null
    };
  }
  return { enabled: true, time: "18:00", lastNotifiedDate: null };
}

function saveDailyReminderSettings(settings) {
  if (!isAuthenticatedMember()) return;
  if (window.LinguaAuth && typeof window.LinguaAuth.saveReminderPreferences === "function") {
    window.LinguaAuth.saveReminderPreferences({
      enabled: settings.enabled,
      time: settings.time,
      lastNotifiedDate: settings.lastNotifiedDate || ""
    }).catch(() => {});
  }
  updateReminderBellUI();
  updateReminderGoalStatusUI();
}

function hasCompletedDailyGoalToday() {
  const today = getLocalDateString();
  const streakData = getDailyStreakData();
  if (streakData && streakData.lastCompletedDate === today) {
    return true;
  }
  try {
    const raw = localStorage.getItem(getScopedProgressKey());
    if (raw) {
      const all = JSON.parse(raw);
      for (const k of Object.keys(all)) {
        if (all[k] && all[k].completed && all[k].lastUpdated) {
          const d = getLocalDateString(new Date(all[k].lastUpdated));
          if (d === today) return true;
        }
      }
    }
  } catch (e) {}
  return false;
}

function formatReminderTimeDisplay(timeStr) {
  if (!timeStr) return "06:00 PM";
  const [hStr, mStr] = timeStr.split(":");
  let h = parseInt(hStr, 10);
  const m = mStr || "00";
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  h = h ? h : 12;
  const displayH = String(h).padStart(2, "0");
  return `${displayH}:${m} ${ampm}`;
}

async function requestBrowserNotificationPermission(onResult) {
  if (!("Notification" in window)) {
    if (typeof onResult === "function") onResult("unsupported");
    return "unsupported";
  }
  try {
    const permission = await Notification.requestPermission();
    updatePermissionCardUI();
    if (typeof onResult === "function") onResult(permission);
    return permission;
  } catch (e) {
    console.warn("Notification.requestPermission failed:", e);
    if (typeof onResult === "function") onResult("denied");
    return "denied";
  }
}

function sendBrowserNotification(title, options = {}) {
  const bodyText = options.body || "Keep your learning streak going! Complete today's Chinese lesson.";
  const notifOptions = {
    body: bodyText,
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='25' fill='%23ea580c'/><text x='50' y='68' font-size='50' text-anchor='middle' fill='%23ffffff' font-family='sans-serif'>语</text></svg>",
    badge: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🔔</text></svg>",
    tag: options.tag || "linguapath-reminder",
    renotify: true
  };

  let sentNative = false;
  if ("Notification" in window && Notification.permission === "granted") {
    try {
      const notif = new Notification(title, notifOptions);
      notif.onclick = () => {
        window.focus();
        if (options.url) {
          window.location.href = options.url;
        }
        notif.close();
      };
      sentNative = true;
    } catch (e) {
      console.warn("Native Notification dispatch error (browser iframe policy):", e);
    }
  }

  // Always show in-app toast for visibility and fallback
  showInAppReminderToast(title, bodyText, options.url || "index.html#lessons");
  return sentNative;
}

function showInAppReminderToast(title, message, actionUrl) {
  const container = document.getElementById("reminderToastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = "reminder-toast";
  toast.setAttribute("role", "alert");
  toast.innerHTML = `
    <div class="reminder-toast-icon">🔔</div>
    <div class="reminder-toast-content">
      <div class="reminder-toast-title">${escapeHTML(title)}</div>
      <div class="reminder-toast-body">${escapeHTML(message)}</div>
      ${actionUrl ? `<a href="${actionUrl}" class="reminder-toast-action">Start Lesson →</a>` : ""}
    </div>
    <button type="button" class="reminder-toast-close" aria-label="Dismiss">✕</button>
  `;

  const closeBtn = toast.querySelector(".reminder-toast-close");
  const dismiss = () => {
    toast.classList.add("toast-hiding");
    setTimeout(() => toast.remove(), 260);
  };

  if (closeBtn) closeBtn.onclick = dismiss;
  const actionBtn = toast.querySelector(".reminder-toast-action");
  if (actionBtn) {
    actionBtn.addEventListener("click", () => {
      dismiss();
    });
  }

  container.appendChild(toast);

  setTimeout(() => {
    if (toast.parentNode) dismiss();
  }, 7500);
}

function checkAndTriggerDailyReminder() {
  if (!isAuthenticatedMember()) return;
  const settings = getDailyReminderSettings();
  if (!settings.enabled) return;

  // If already completed daily goal today, no need to remind!
  if (hasCompletedDailyGoalToday()) {
    updateReminderGoalStatusUI();
    return;
  }

  const today = getLocalDateString();
  if (settings.lastNotifiedDate === today) {
    // Already notified today
    return;
  }

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [hStr, mStr] = (settings.time || "18:00").split(":");
  const targetMinutes = (parseInt(hStr, 10) || 0) * 60 + (parseInt(mStr, 10) || 0);

  if (currentMinutes >= targetMinutes) {
    // Trigger notification!
    const targetUrl = typeof currentLoadedLessonId !== "undefined"
      ? `story.html?id=${encodeURIComponent(currentLoadedLessonId)}#exercises`
      : "index.html#lessons";

    sendBrowserNotification("JiedeEdu Daily Lesson Reminder 🎯", {
      body: "You haven't completed a lesson yet today! Practice now to keep your streak burning 🔥",
      tag: "daily-study-reminder-" + today,
      url: targetUrl
    });

    settings.lastNotifiedDate = today;
    saveDailyReminderSettings(settings);
    updateReminderGoalStatusUI();
  }
}

function startDailyReminderScheduler() {
  checkAndTriggerDailyReminder();
  setInterval(checkAndTriggerDailyReminder, 60000);
}

function updateReminderBellUI() {
  const settings = getDailyReminderSettings();
  const dot = document.getElementById("reminderStatusDot");
  const bellBtn = document.getElementById("reminderBellBtn");

  if (dot) {
    if (settings.enabled) {
      dot.classList.add("active");
    } else {
      dot.classList.remove("active");
    }
  }

  if (bellBtn) {
    const formatted = formatReminderTimeDisplay(settings.time);
    if (settings.enabled) {
      bellBtn.setAttribute("title", `Daily Study Reminder active for ${formatted}. Click to change settings.`);
    } else {
      bellBtn.setAttribute("title", "Daily Study Reminder is paused. Click to enable.");
    }
  }
}

function updatePermissionCardUI() {
  const card = document.getElementById("reminderPermissionCard");
  const icon = document.getElementById("permissionIcon");
  const title = document.getElementById("permissionTitle");
  const text = document.getElementById("permissionStatusText");
  const btn = document.getElementById("requestPermissionBtn");
  if (!card) return;

  if (!("Notification" in window)) {
    card.className = "reminder-permission-card";
    if (icon) icon.textContent = "ℹ️";
    if (title) title.textContent = "In-App Notifications";
    if (text) text.textContent = "Browser Notification API is not supported in this browser; in-app reminder toasts will be used.";
    if (btn) btn.style.display = "none";
    return;
  }

  const perm = Notification.permission;
  if (perm === "granted") {
    card.className = "reminder-permission-card is-granted";
    if (icon) icon.textContent = "✅";
    if (title) title.textContent = "Browser Notifications Active";
    if (text) text.textContent = "Notifications are allowed. You'll receive system alerts even when this tab is in the background.";
    if (btn) btn.style.display = "none";
  } else if (perm === "denied") {
    card.className = "reminder-permission-card is-denied";
    if (icon) icon.textContent = "⚠️";
    if (title) title.textContent = "Browser Notifications Blocked";
    if (text) text.textContent = "Notifications are blocked in your browser settings. In-app reminder alerts will be used instead.";
    if (btn) btn.style.display = "none";
  } else {
    card.className = "reminder-permission-card";
    if (icon) icon.textContent = "🔔";
    if (title) title.textContent = "Enable Browser Alerts";
    if (text) text.textContent = "Allow browser notifications so you never miss your daily Chinese practice goal.";
    if (btn) {
      btn.style.display = "inline-flex";
      btn.textContent = "Allow";
    }
  }
}

function updateReminderGoalStatusUI() {
  const statusCard = document.getElementById("reminderGoalStatus");
  const icon = document.getElementById("goalStatusIcon");
  const title = document.getElementById("goalStatusTitle");
  const desc = document.getElementById("goalStatusDesc");
  if (!statusCard) return;

  const isCompleted = hasCompletedDailyGoalToday();
  const settings = getDailyReminderSettings();
  const formattedTime = formatReminderTimeDisplay(settings.time);

  if (isCompleted) {
    if (icon) icon.textContent = "🎉";
    if (title) title.textContent = "Daily Goal Completed!";
    if (desc) desc.textContent = "Great job! You've already completed a lesson today. Your daily streak is safe!";
  } else {
    if (icon) icon.textContent = "⏳";
    if (title) title.textContent = "Daily Goal Pending";
    if (desc) {
      if (settings.enabled) {
        desc.textContent = `You'll be prompted at ${formattedTime} if you haven't finished a lesson today.`;
      } else {
        desc.textContent = "No lesson completed yet today. Enable the reminder above to receive an alert!";
      }
    }
  }
}

function openReminderModal() {
  if (!isAuthenticatedMember()) {
    if (window.LinguaAuthUI && typeof window.LinguaAuthUI.openAuthModal === "function") {
      window.LinguaAuthUI.openAuthModal("signin");
    }
    return;
  }
  const modal = document.getElementById("reminderModal");
  if (!modal) return;

  const settings = getDailyReminderSettings();

  const toggle = document.getElementById("reminderToggle");
  if (toggle) {
    toggle.checked = settings.enabled;
  }

  const customInput = document.getElementById("reminderCustomTime");
  if (customInput) {
    customInput.value = settings.time || "18:00";
  }

  const chips = document.querySelectorAll("#reminderTimePresets .time-chip");
  chips.forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.time === settings.time);
  });

  const timeSection = document.getElementById("reminderTimeSection");
  if (timeSection) {
    timeSection.style.opacity = settings.enabled ? "1" : "0.5";
    timeSection.style.pointerEvents = settings.enabled ? "auto" : "none";
  }

  updatePermissionCardUI();
  updateReminderGoalStatusUI();

  modal.classList.add("active");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeReminderModal() {
  const modal = document.getElementById("reminderModal");
  if (!modal) return;
  modal.classList.remove("active");
  modal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function setupReminderUI() {
  const modal = document.getElementById("reminderModal");
  const closeBtn = document.getElementById("closeReminderModalBtn");
  const saveBtn = document.getElementById("saveReminderBtn");
  const testBtn = document.getElementById("testNotificationBtn");
  const toggle = document.getElementById("reminderToggle");
  const customInput = document.getElementById("reminderCustomTime");
  const requestPermBtn = document.getElementById("requestPermissionBtn");
  const timePresets = document.querySelectorAll("#reminderTimePresets .time-chip");

  updateReminderBellUI();

  document.addEventListener("click", (e) => {
    const bellBtn = e.target.closest("#reminderBellBtn");
    if (bellBtn) {
      e.preventDefault();
      e.stopPropagation();
      if (typeof window.closeLinguaMenu === "function") {
        window.closeLinguaMenu();
      }
      openReminderModal();
    }
  });

  if (closeBtn) {
    closeBtn.addEventListener("click", closeReminderModal);
  }

  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        closeReminderModal();
      }
    });
  }

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal && modal.classList.contains("active")) {
      closeReminderModal();
    }
  });

  if (toggle) {
    toggle.addEventListener("change", () => {
      const timeSection = document.getElementById("reminderTimeSection");
      if (timeSection) {
        timeSection.style.opacity = toggle.checked ? "1" : "0.5";
        timeSection.style.pointerEvents = toggle.checked ? "auto" : "none";
      }
      if (toggle.checked && "Notification" in window && Notification.permission === "default") {
        requestBrowserNotificationPermission();
      }
    });
  }

  timePresets.forEach((chip) => {
    chip.addEventListener("click", () => {
      timePresets.forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      if (customInput) {
        customInput.value = chip.dataset.time;
      }
    });
  });

  if (customInput) {
    customInput.addEventListener("input", () => {
      timePresets.forEach((c) => {
        c.classList.toggle("active", c.dataset.time === customInput.value);
      });
    });
  }

  if (requestPermBtn) {
    requestPermBtn.addEventListener("click", () => {
      requestBrowserNotificationPermission();
    });
  }

  if (testBtn) {
    testBtn.addEventListener("click", async () => {
      if ("Notification" in window && Notification.permission === "default") {
        await requestBrowserNotificationPermission();
      }
      const timeVal = customInput ? customInput.value : "18:00";
      sendBrowserNotification("JiedeEdu Daily Reminder 🔔", {
        body: `Test successful! You'll be reminded at ${formatReminderTimeDisplay(timeVal)} if today's lesson isn't completed.`,
        url: typeof currentLoadedLessonId !== "undefined"
          ? `story.html?id=${encodeURIComponent(currentLoadedLessonId)}#exercises`
          : "index.html#lessons"
      });
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      const enabled = toggle ? toggle.checked : true;
      const time = customInput ? (customInput.value || "18:00") : "18:00";
      const settings = getDailyReminderSettings();
      settings.enabled = enabled;
      settings.time = time;
      saveDailyReminderSettings(settings);
      closeReminderModal();
      showInAppReminderToast("Reminder Saved", `Daily reminder is ${enabled ? `active for ${formatReminderTimeDisplay(time)}` : "paused"}.`);
    });
  }

  window.addEventListener("storage", (e) => {
    if (e.key === DAILY_REMINDER_STORAGE_KEY) {
      updateReminderBellUI();
    }
  });
}


/* =========================================================
   DARK / LIGHT THEME TOGGLE
   ========================================================= */

function setupThemeToggle() {
  if (window.getLinguaTheme && window.setLinguaTheme) {
    window.setLinguaTheme(window.getLinguaTheme(), false);
    return;
  }
}


/* =========================================================
   REELS & STORIES SYSTEM (2-TAB SUB-NAV & EXCEL SYNC)
========================================================= */

const REELS_EXCEL_FILE = "data/reels_stories.xlsx";
const REELS_STORAGE_FAVORITES_KEY = "linguapath_favorite_reels";

const FALLBACK_REELS_DATA = [
  {
    id: "cny_01",
    type: "reel",
    holiday_id: "cny",
    title: "红包拿来 - Red Packet Tradition",
    video_path: "assets/video/Reels Red Envelope.mp4",
    thumbnail_path: "assets/images/story-poster.jpg",
    duration_sec: 15,
    status: "active",
    text_cn: "过年好！恭喜发财，红包拿来！祝你新年快乐，身体健康，万事如意！",
    text_pinyin: "Guònián hǎo! Gōngxǐ fācái, hóngbāo nálái! Zhù nǐ xīnnián kuàilè, shēntǐ jiànkāng, wànshì rúyì!",
    text_en: "Happy New Year! Wishing you prosperity, hand over the red envelope! Happy New Year, good health, and may all your wishes come true!",
    text_my: "နှစ်သစ်မှာ မင်္ဂလာပါ! စီးပွားဥစ္စာ တိုးတက်ပါစေ၊ အင်ပါအိုနီပေးပါ! နှစ်သစ်မှာ ပျော်ရွှင်ပါစေ၊ ကျန်းမာပါစေ၊ လိုအင်ဆန္ဒ ပြည့်ဝပါစေ!"
  },
  {
    id: "lantern_01",
    type: "reel",
    holiday_id: "lantern",
    title: "元宵吃汤圆 - Lantern Festival Sweet Dumplings",
    video_path: "assets/video/lesson-01.mp4",
    thumbnail_path: "assets/images/story-01.jpg",
    duration_sec: 12,
    status: "active",
    text_cn: "元宵节快乐！我们要吃甜甜的汤圆，猜灯谜，赏花灯，团团圆圆！",
    text_pinyin: "Yuánxiāojié kuàilè! Wǒmen yào chī tiántián de tāngyuán, cāi dēngmí, shǎng huādēng, tuántuán yuányuán!",
    text_en: "Happy Lantern Festival! We eat sweet rice balls, guess lantern riddles, and enjoy colorful lanterns with family!",
    text_my: "မီးထွန်းပွဲတော် မင်္ဂလာပါ! အချိုလုံးစားကြမယ်၊ မီးပဟေဠိ ဖြေကြမယ်၊ မိသားစု စုံစုံလင်လင် ဆုံကြမယ်!"
  },
  {
    id: "dragonboat_01",
    type: "reel",
    holiday_id: "dragonboat",
    title: "端午安康 - Dragon Boat & Zongzi",
    video_path: "assets/video/Reels Red Envelope.mp4",
    thumbnail_path: "assets/images/story2-poster.svg",
    duration_sec: 18,
    status: "active",
    text_cn: "端午节安康！划龙舟，吃香甜的粽子，佩香囊，平平安安！",
    text_pinyin: "Duānwǔjié ānkāng! Huá lóngzhōu, chī xiāngtián de zòngzi, pèi xiāngnáng, píngpíng ān'ān!",
    text_en: "Wishing you health on Dragon Boat Festival! Row dragon boats, eat delicious sticky rice dumplings, and stay safe!",
    text_my: "နဂါးလှေပွဲတော် ကျန်းမာပါစေ! နဂါးလှေပြိုင်ကြမယ်၊ ကောက်ညှင်းထုပ် စားကြမယ်၊ အေးချမ်းသာယာပါစေ!"
  },
  {
    id: "midautumn_01",
    type: "reel",
    holiday_id: "midautumn",
    title: "中秋赏月 - Mid-Autumn Moon Festival",
    video_path: "assets/video/lesson-01.mp4",
    thumbnail_path: "assets/images/story2-01.svg",
    duration_sec: 15,
    status: "active",
    text_cn: "中秋节快乐！但愿人长久，千里共婵娟。一起吃月饼，看明亮的满月。",
    text_pinyin: "Zhōngqiūjié kuàilè! Dànyuàn rén chángjiǔ, qiānlǐ gòng chánjuān. Yìqǐ chī yuèbǐng, kàn míngliàng de mǎnyuè.",
    text_en: "Happy Mid-Autumn Festival! May we share the moon's beauty across miles. Let's eat mooncakes and admire the full moon.",
    text_my: "လပြည့်ညပွဲတော် မင်္ဂလာပါ! လမုန့်စားရင်း လပြည့်ဝန်းကို အတူကြည့်ကြမယ်။ အဝေးရောက် ချစ်ခင်သူများနဲ့အတူ ကြည်နူးရပါစေ။"
  },
  {
    id: "daily_01",
    type: "reel",
    holiday_id: "daily",
    title: "早安打招呼 - Morning Greetings",
    video_path: "assets/video/lesson-01.mp4",
    thumbnail_path: "assets/images/story-02.jpg",
    duration_sec: 10,
    status: "active",
    text_cn: "早上好！今天天气真好，你吃早饭了吗？祝你有美好的一天！",
    text_pinyin: "Zǎoshang hǎo! Jīntiān tiānqì zhēn hǎo, nǐ chī zǎofàn le ma? Zhù nǐ yǒu měihǎo de yì tiān!",
    text_en: "Good morning! The weather is lovely today, have you eaten breakfast? Have a wonderful day!",
    text_my: "မင်္ဂလာနံနက်ခင်းပါ! ဒီနေ့ ရာသီဥတု သိပ်ကောင်းတယ်၊ မနက်စာ စားပြီးပြီလား? ကောင်းသောနေ့လေး ဖြစ်ပါစေ!"
  },
  {
    id: "kids_01",
    type: "reel",
    holiday_id: "kids",
    title: "动物朋友 - Animal Names for Kids",
    video_path: "assets/video/Reels Red Envelope.mp4",
    thumbnail_path: "assets/images/story-03.jpg",
    duration_sec: 14,
    status: "active",
    text_cn: "小猫喵喵叫，小狗汪汪叫，大熊猫爱吃竹子，小兔子跳呀跳！",
    text_pinyin: "Xiǎomāo miāomiāo jiào, xiǎogǒu wāngwāng jiào, dàxióngmāo ài chī zhúzi, xiǎotùzi tiào ya tiào!",
    text_en: "Kittens meow, puppies bark, giant pandas love eating bamboo, and bunnies hop around!",
    text_my: "ကြောင်ကလေး မြောင်မြောင်အော်၊ ခွေးကလေး ဝုတ်ဝုတ်ဟောင်၊ ပန်ဒါဝက်ဝံ ဝါးပင်စား၊ ယုန်ကလေး ခုန်ဆွခုန်ဆွ!"
  },
  {
    id: "grammar_01",
    type: "reel",
    holiday_id: "grammar",
    title: "四声歌 - Mastering the 4 Chinese Tones",
    video_path: "assets/video/lesson-01.mp4",
    thumbnail_path: "assets/images/story2-03.svg",
    duration_sec: 20,
    status: "active",
    text_cn: "一声高高平又平，二声由低往上升，三声先降然后再扬起，四声重重从高降到低！",
    text_pinyin: "Yī shēng gāogāo píng yòu píng, èr shēng yóu dī wǎngshàng shēng, sān shēng xiān jiàng ránhòu zài yángqǐ, sì shēng zhòngzhòng cóng gāo jiàng dào dī!",
    text_en: "1st tone is high and flat, 2nd tone rises, 3rd tone dips then climbs, 4th tone drops sharply!",
    text_my: "အသံထွက် ၁ က မြင့်ပြီးညီတယ်၊ အသံ ၂ က အောက်ကနေ အပေါ်တက်တယ်၊ အသံ ၃ က ဆင်းပြီးမှ ပြန်တက်တယ်၊ အသံ ၄ က အမြင့်ကနေ ပြတ်ပြတ်ဆင်းတယ်!"
  },
  {
    id: "culture_01",
    type: "reel",
    holiday_id: "culture",
    title: "中国茶道 - Chinese Tea Etiquette",
    video_path: "assets/video/Reels Red Envelope.mp4",
    thumbnail_path: "assets/images/story-04.jpg",
    duration_sec: 16,
    status: "active",
    text_cn: "客来敬茶是中国的传统礼节。双手端茶，轻道一声请用茶，充满温情与敬意。",
    text_pinyin: "Kè lái jìng chá shì Zhōngguó de chuántǒng lǐjié. Shuāngshǒu duān chá, qīng dào yì shēng qǐng yòng chá, chōngmǎn wēnqíng yǔ jìngyì.",
    text_en: "Serving tea to guests is a cherished Chinese tradition. Present the cup with both hands to show warmth and respect.",
    text_my: "ဧည့်သည်ကို လက်ဖက်ရည် တည်ခင်းခြင်းသည် တရုတ်ရိုးရာယဉ်ကျေးမှုဖြစ်သည်။ လက်နှစ်ဖက်ဖြင့် ကမ်းပေးပြီး ရိုသေလေးစားမှုကို ပြသသည်။"
  },
  {
    id: "story_01",
    type: "story",
    holiday_id: "daily",
    title: "小明的一天 - Xiaoming's Day",
    video_path: "assets/video/story-01.mp4",
    thumbnail_path: "assets/images/story-poster.jpg",
    duration_sec: 45,
    status: "active",
    text_cn: "小明早上七点起床。他洗脸刷牙。他吃早饭。然后，他去学校。他很开心。",
    text_pinyin: "Xiǎomíng zǎoshang qī diǎn qǐchuáng. Tā xǐliǎn shuāyá. Tā chī zǎofàn. Ránhòu, tā qù xuéxiào. Tā hěn kāixīn.",
    text_en: "Xiaoming gets up at seven in the morning. He washes his face and brushes his teeth. He eats breakfast. Then he goes to school. He is very happy.",
    text_my: "ရှောင်မင်း မနက် ၇ နာရီမှာ အိပ်ရာထပါတယ်။ မျက်နှာသစ် သွားတိုက်ပြီး မနက်စာ စားပါတယ်။ ပြီးတော့ ကျောင်းသွားပါတယ်။ သူ အရမ်း ပျော်ရွှင်နေပါတယ်။"
  },
  {
    id: "story_02",
    type: "story",
    holiday_id: "daily",
    title: "小明买水果 - Xiaoming Buys Fruit",
    video_path: "assets/video/story-02.mp4",
    thumbnail_path: "assets/images/story2-poster.svg",
    duration_sec: 50,
    status: "active",
    text_cn: "今天天气真好！小明去水果市场。市场里有很多新鲜的红苹果。他买了三个大苹果。苹果又甜又好吃，他真开心！",
    text_pinyin: "Jīntiān tiānqì zhēn hǎo! Xiǎomíng qù shuǐguǒ shìchǎng. Shìchǎng lǐ yǒu hěn duō xīnxiān de hóng píngguǒ. Tā mǎi le sān gè dà píngguǒ. Píngguǒ yòu tián yòu hǎochī, tā zhēn kāixīn!",
    text_en: "The weather is great today! Xiaoming goes to the fruit market. There are many fresh red apples in the market. He bought three big apples. The apples are sweet and delicious, he is very happy!",
    text_my: "ဒီနေ့ ရာသီဥတု သိပ်ကောင်းတယ်! ရှောင်မင်း သစ်သီးဈေးကို သွားပါတယ်။ ဈေးထဲမှာ လတ်ဆတ်တဲ့ ပန်းသီးနီတွေ အများကြီးရှိတယ်။ သူ ပန်းသီးကြီး ၃ လုံး ဝယ်ခဲ့ပါတယ်။ ပန်းသီးတွေက ချိုပြီး အရသာရှိလို့ သူ အရမ်း ပျော်ရွှင်နေပါတယ်။"
  }
];

let allLoadedVideos = [];
let currentReelCategory = "all";
let currentActiveReelItem = null;

const subtitlePreferences = {
  cn: true,
  pinyin: true,
  en: true,
  my: true
};

// Category Info & Tag Mapping Helper
function getHolidayCategoryInfo(holidayId) {
  const norm = String(holidayId || "").trim().toLowerCase();
  switch (norm) {
    case "cny":
      return { label: "Spring Festival", badgeText: "🏮 CNY", filterGroup: "holidays", bgClass: "badge-cny" };
    case "lantern":
      return { label: "Lantern Festival", badgeText: "🏮 Lantern", filterGroup: "holidays", bgClass: "badge-lantern" };
    case "dragonboat":
      return { label: "Dragon Boat", badgeText: "🚣 Dragon Boat", filterGroup: "holidays", bgClass: "badge-dragonboat" };
    case "midautumn":
      return { label: "Mid-Autumn", badgeText: "🥮 Moon Fest", filterGroup: "holidays", bgClass: "badge-midautumn" };
    case "qixi":
      return { label: "Qixi Festival", badgeText: "✨ Qixi", filterGroup: "holidays", bgClass: "badge-qixi" };
    case "qingming":
      return { label: "Qingming", badgeText: "🌿 Qingming", filterGroup: "holidays", bgClass: "badge-qingming" };
    case "daily":
      return { label: "Daily Chinese", badgeText: "💬 Daily", filterGroup: "daily", bgClass: "badge-daily" };
    case "kids":
      return { label: "Kids & Fun", badgeText: "🐼 Kids", filterGroup: "kids", bgClass: "badge-kids" };
    case "grammar":
      return { label: "Grammar & Tones", badgeText: "🎼 Grammar", filterGroup: "grammar", bgClass: "badge-grammar" };
    case "culture":
      return { label: "Culture & Customs", badgeText: "🍵 Culture", filterGroup: "culture", bgClass: "badge-culture" };
    default:
      return { label: "Short Reel", badgeText: "🎬 Reel", filterGroup: "all", bgClass: "badge-default" };
  }
}

// Favorite persistence helpers
function getFavoriteReelIds() {
  try {
    const raw = localStorage.getItem(REELS_STORAGE_FAVORITES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function isReelFavorited(id) {
  const favs = getFavoriteReelIds();
  return favs.includes(String(id));
}

function toggleReelFavorite(id) {
  let favs = getFavoriteReelIds();
  const idStr = String(id);
  const isFav = favs.includes(idStr);
  if (isFav) {
    favs = favs.filter(x => x !== idStr);
  } else {
    favs.push(idStr);
  }
  try {
    localStorage.setItem(REELS_STORAGE_FAVORITES_KEY, JSON.stringify(favs));
  } catch (e) {}
  return !isFav;
}

// Share helper with Clipboard & Toast
async function shareReelItem(item) {
  const url = `${window.location.origin}${window.location.pathname}?tab=reels&reel=${encodeURIComponent(item.id)}`;
  const shareData = {
    title: `JiedeEdu Reel: ${item.title || "Mandarin Short Video"}`,
    text: `Watch "${item.title || "Chinese Short Reel"}" on JiedeEdu!`,
    url: url
  };

  if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
    try {
      await navigator.share(shareData);
      return;
    } catch (e) {
      /* User cancelled or fallback */
    }
  }

  // Fallback: Copy to clipboard
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(url);
      showInAppReminderToast("Link Copied! 🔗", "Reel link copied to your clipboard.");
    } else {
      const input = document.createElement("input");
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      showInAppReminderToast("Link Copied! 🔗", "Reel link copied to your clipboard.");
    }
  } catch (err) {
    showInAppReminderToast("Reel Link", url);
  }
}

// Tab Switching
function switchStoriesReelsTab(tabName, updateUrl = true) {
  const tabBtnStories = document.getElementById("tabBtnStories");
  const tabBtnReels = document.getElementById("tabBtnReels");
  const storiesView = document.getElementById("stories-view");
  const reelsView = document.getElementById("reels-view");

  if (!tabBtnStories || !tabBtnReels || !storiesView || !reelsView) return;

  const isReels = tabName === "reels";

  if (isReels) {
    tabBtnReels.classList.add("active");
    tabBtnReels.setAttribute("aria-selected", "true");
    tabBtnStories.classList.remove("active");
    tabBtnStories.setAttribute("aria-selected", "false");

    storiesView.style.display = "none";
    storiesView.classList.remove("active");
    reelsView.style.display = "block";
    reelsView.classList.add("active");

    // Pause story video & audio if playing
    stopCurrentStoryAudio();
    const storyVideo = document.getElementById("lessonVideo");
    if (storyVideo && !storyVideo.paused) {
      storyVideo.pause();
    }
  } else {
    tabBtnStories.classList.add("active");
    tabBtnStories.setAttribute("aria-selected", "true");
    tabBtnReels.classList.remove("active");
    tabBtnReels.setAttribute("aria-selected", "false");

    storiesView.style.display = "block";
    storiesView.classList.add("active");
    reelsView.style.display = "none";
    reelsView.classList.remove("active");

    // Pause reel modal video if playing
    closeReelModalPlayer();
  }

  if (updateUrl && window.history && window.history.replaceState) {
    const url = new URL(window.location.href);
    url.searchParams.set("tab", isReels ? "reels" : "stories");
    window.history.replaceState(null, "", url.toString());
  }
}

// Category Filter for Reels Grid
function setReelCategoryFilter(category, updateUrl = true) {
  currentReelCategory = category || "all";

  // Update active chip
  const chips = document.querySelectorAll("#reelsFilterChips .filter-chip");
  chips.forEach(chip => {
    chip.classList.toggle("active", chip.dataset.filter === currentReelCategory);
  });

  renderFilteredReelsGrid();

  if (updateUrl && window.history && window.history.replaceState) {
    const url = new URL(window.location.href);
    if (currentReelCategory === "all") {
      url.searchParams.delete("filter");
    } else {
      url.searchParams.set("filter", currentReelCategory);
    }
    window.history.replaceState(null, "", url.toString());
  }
}

function renderFilteredReelsGrid() {
  const container = document.getElementById("reelsVideoGrid");
  const countInfo = document.getElementById("reelsCountInfo");
  const emptyState = document.getElementById("reelsEmptyState");
  if (!container) return;

  const holidayList = ["cny", "lantern", "dragonboat", "midautumn", "qixi", "qingming"];

  // Filter active reels
  const reels = allLoadedVideos.filter(item => {
    const type = String(item.type || "").trim().toLowerCase();
    const status = String(item.status || "active").trim().toLowerCase();
    if (type !== "reel" || status !== "active") return false;

    const holId = String(item.holiday_id || "").trim().toLowerCase();

    if (currentReelCategory === "all") return true;
    if (currentReelCategory === "holidays") return holidayList.includes(holId);
    if (currentReelCategory === "daily") return holId === "daily";
    if (currentReelCategory === "kids") return holId === "kids";
    if (currentReelCategory === "grammar") return holId === "grammar";
    if (currentReelCategory === "culture") return holId === "culture";
    return holId === currentReelCategory;
  });

  if (countInfo) {
    countInfo.innerHTML = `Showing <strong>${reels.length}</strong> ${currentReelCategory === "all" ? "active reels" : `${currentReelCategory} videos`}`;
  }

  if (reels.length === 0) {
    container.innerHTML = "";
    if (emptyState) emptyState.style.display = "block";
    return;
  }

  if (emptyState) emptyState.style.display = "none";
  container.innerHTML = "";

  reels.forEach(item => {
    const card = createReelCardElement(item);
    container.appendChild(card);
  });
}

function createReelCardElement(item) {
  const card = document.createElement("article");
  card.className = "reel-video-card";
  card.id = `reel-card-${item.id}`;
  card.setAttribute("tabindex", "0");
  card.setAttribute("role", "button");
  card.setAttribute("aria-label", `Play short reel: ${item.title || "Mandarin Reel"}`);

  const catInfo = getHolidayCategoryInfo(item.holiday_id);
  const durationText = item.duration_sec ? `${item.duration_sec}s` : "15s";
  const isFav = isReelFavorited(item.id);

  const thumbSrc = backendAssetUrl(item.thumbnail_path || "assets/images/story-poster.jpg");
  const videoSrc = backendAssetUrl(item.video_path || "assets/video/lesson-01.mp4");

  card.innerHTML = `
    <div class="reel-card-thumb-wrap">
      <img
        src="${escapeHTML(thumbSrc)}"
        alt="${escapeHTML(item.title || "Reel thumbnail")}"
        class="reel-card-thumb-img"
        loading="lazy"
        onerror="this.onerror=null;this.src='assets/images/story-poster.jpg';"
      />

      <div class="reel-card-overlay-gradient"></div>

      <!-- Floating Badges -->
      <div class="reel-card-top-badges">
        <span class="reel-card-category-badge ${catInfo.bgClass}">${escapeHTML(catInfo.badgeText)}</span>
        <span class="reel-card-duration-badge">⏱ ${escapeHTML(durationText)}</span>
      </div>

      <!-- Center Play Icon with Animation -->
      <div class="reel-card-play-btn" aria-hidden="true">
        <span class="play-triangle">▶</span>
      </div>

      <!-- Quick Action Buttons -->
      <div class="reel-card-quick-actions">
        <button
          type="button"
          class="btn-reel-mini-action btn-reel-like ${isFav ? "active" : ""}"
          data-reel-id="${escapeHTML(item.id)}"
          aria-label="${isFav ? "Remove from Favorites" : "Add to Favorites"}"
          title="Favorite"
        >
          <span class="like-heart">${isFav ? "❤️" : "🤍"}</span>
        </button>

        <button
          type="button"
          class="btn-reel-mini-action btn-reel-share"
          data-reel-id="${escapeHTML(item.id)}"
          aria-label="Share this reel"
          title="Share"
        >
          <span>🔗</span>
        </button>
      </div>

      <!-- Card Caption Info at Bottom -->
      <div class="reel-card-bottom-info">
        <h3 class="reel-card-title">${escapeHTML(item.title || "Mandarin Short")}</h3>
        <p class="reel-card-pinyin">${escapeHTML(item.text_pinyin || "")}</p>
        <p class="reel-card-snippet">${escapeHTML(item.text_en || item.text_cn || "")}</p>
      </div>
    </div>
  `;

  // Open modal on card click (unless clicking mini actions)
  card.addEventListener("click", (e) => {
    if (e.target.closest(".btn-reel-mini-action")) return;
    openReelModalPlayer(item);
  });

  card.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      if (e.target.closest(".btn-reel-mini-action")) return;
      e.preventDefault();
      openReelModalPlayer(item);
    }
  });

  // Like button
  const likeBtn = card.querySelector(".btn-reel-like");
  if (likeBtn) {
    likeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const newStatus = toggleReelFavorite(item.id);
      likeBtn.classList.toggle("active", newStatus);
      const heart = likeBtn.querySelector(".like-heart");
      if (heart) heart.textContent = newStatus ? "❤️" : "🤍";
      showInAppReminderToast(
        newStatus ? "Added to Favorites ❤️" : "Removed from Favorites",
        `"${item.title}" saved to your personal study list.`
      );
    });
  }

  // Share button
  const shareBtn = card.querySelector(".btn-reel-share");
  if (shareBtn) {
    shareBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      shareReelItem(item);
    });
  }

  return card;
}

// Modal Video Player with Quad-Language Subtitles
function openReelModalPlayer(item) {
  if (!item) return;
  currentActiveReelItem = item;

  const modal = document.getElementById("reelPlayerModal");
  const video = document.getElementById("reelModalVideo");
  const title = document.getElementById("reelModalTitle");
  const badge = document.getElementById("reelModalBadge");
  const duration = document.getElementById("reelModalDuration");
  const subCn = document.getElementById("reelSubCn");
  const subPinyin = document.getElementById("reelSubPinyin");
  const subEn = document.getElementById("reelSubEn");
  const subMy = document.getElementById("reelSubMy");
  const likeBtn = document.getElementById("reelModalLikeBtn");
  const likeIcon = document.getElementById("reelModalLikeIcon");
  const likeLabel = document.getElementById("reelModalLikeLabel");

  if (!modal || !video) return;

  // Stop background narration / audio
  stopCurrentStoryAudio();

  const catInfo = getHolidayCategoryInfo(item.holiday_id);
  if (title) title.textContent = item.title || "Mandarin Short Reel";
  if (badge) {
    badge.textContent = catInfo.badgeText;
    badge.className = `reel-badge-pill ${catInfo.bgClass}`;
  }
  if (duration) duration.textContent = item.duration_sec ? `${item.duration_sec}s` : "15s";

  // Subtitles
  if (subCn) subCn.textContent = item.text_cn || "";
  if (subPinyin) subPinyin.textContent = item.text_pinyin || "";
  if (subEn) subEn.textContent = item.text_en || "";
  if (subMy) subMy.textContent = item.text_my || "";

  applySubtitleToggles();

  // Favorite button state
  const isFav = isReelFavorited(item.id);
  if (likeBtn) {
    likeBtn.classList.toggle("active", isFav);
    if (likeIcon) likeIcon.textContent = isFav ? "❤️" : "🤍";
    if (likeLabel) likeLabel.textContent = isFav ? "Favorited" : "Favorite";
  }

  // Set video source and play
  const videoSrc = backendAssetUrl(item.video_path || "assets/video/lesson-01.mp4");
  const posterSrc = backendAssetUrl(item.thumbnail_path || "assets/images/story-poster.jpg");
  const statusEl = document.getElementById("reelPlayerStatus");
  if (statusEl) {
    statusEl.hidden = true;
    statusEl.textContent = "";
  }

  video.onerror = null;
  video.onloadeddata = null;
  video.poster = posterSrc;
  const currentVideoAttr = video.getAttribute("src") || "";
  if (currentVideoAttr !== videoSrc) {
    video.src = videoSrc;
  }
  video.onerror = () => {
    if (statusEl) {
      statusEl.hidden = false;
      statusEl.textContent = "This reel video could not be loaded. Confirm the video asset or hosted URL is accessible.";
    }
  };
  video.currentTime = 0;
  video.play().catch(() => {});

  modal.classList.add("active");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeReelModalPlayer() {
  const modal = document.getElementById("reelPlayerModal");
  const video = document.getElementById("reelModalVideo");
  const statusEl = document.getElementById("reelPlayerStatus");
  if (!modal) return;

  if (statusEl) {
    statusEl.hidden = true;
    statusEl.textContent = "";
  }

  if (video) {
    video.onerror = null;
    video.onloadeddata = null;
    video.pause();
    video.removeAttribute("src");
    video.load();
  }

  modal.classList.remove("active");
  modal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function applySubtitleToggles() {
  const subCn = document.getElementById("reelSubCn");
  const subPinyin = document.getElementById("reelSubPinyin");
  const subEn = document.getElementById("reelSubEn");
  const subMy = document.getElementById("reelSubMy");

  if (subCn) subCn.style.display = subtitlePreferences.cn ? "block" : "none";
  if (subPinyin) subPinyin.style.display = subtitlePreferences.pinyin ? "block" : "none";
  if (subEn) subEn.style.display = subtitlePreferences.en ? "block" : "none";
  if (subMy) subMy.style.display = subtitlePreferences.my ? "block" : "none";

  document.querySelectorAll(".sub-chip").forEach(chip => {
    const lang = chip.dataset.lang;
    if (lang && typeof subtitlePreferences[lang] !== "undefined") {
      chip.classList.toggle("active", subtitlePreferences[lang]);
    }
  });
}

// Load Videos from Excel (Sheet: Videos in data/reels_stories.xlsx)
async function loadReelsAndStoriesWorkbook() {
  let loaded = false;

  // Strategy 1: Shared Excel Content Store (Local Admin Draft -> Repository data/reels_stories.xlsx -> .json fallback)
  if (window.LinguaContentStore && typeof window.LinguaContentStore.loadReelsWorkbook === "function") {
    try {
      const storeRes = await window.LinguaContentStore.loadReelsWorkbook();
      if (storeRes && storeRes.sheets && storeRes.sheets.Videos && storeRes.sheets.Videos.length > 0) {
        allLoadedVideos = storeRes.sheets.Videos;
        loaded = true;
      }
    } catch (e) {
      console.warn("Content store note for reels_stories:", e);
    }
  }

  // Strategy 2: Direct Excel parsing via SheetJS (XLSX)
  if (!loaded && typeof XLSX !== "undefined") {
    try {
      const response = await fetch(`${REELS_EXCEL_FILE}?t=${Date.now()}`);
      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        const wb = XLSX.read(arrayBuffer, { type: "array" });
        if (wb && wb.SheetNames && wb.SheetNames.includes("Videos")) {
          const rows = XLSX.utils.sheet_to_json(wb.Sheets["Videos"], { defval: "" });
          if (rows && rows.length > 0) {
            allLoadedVideos = rows;
            loaded = true;
          }
        }
      }
    } catch (e) {
      console.warn("Client XLSX parse for reels_stories.xlsx note:", e);
    }
  }

  // Strategy 3: Static JSON file data/reels_stories.json
  if (!loaded) {
    try {
      const jsonRes = await fetch(`data/reels_stories.json?t=${Date.now()}`);
      if (jsonRes.ok) {
        const jsonData = await jsonRes.json();
        if (jsonData && jsonData.sheets && jsonData.sheets.Videos && jsonData.sheets.Videos.length > 0) {
          allLoadedVideos = jsonData.sheets.Videos;
          loaded = true;
        }
      }
    } catch (e) {
      console.warn("Static JSON fallback for reels_stories note:", e);
    }
  }

  // Strategy 4: Embedded Fallback Dataset
  if (!loaded || !allLoadedVideos.length) {
    allLoadedVideos = FALLBACK_REELS_DATA;
    loaded = true;
  }

  renderFilteredReelsGrid();

  // Check URL parameters for deep linking
  handleUrlDeepLinking();
}

function handleUrlDeepLinking() {
  const urlParams = new URLSearchParams(window.location.search);
  const tabParam = urlParams.get("tab");
  const filterParam = urlParams.get("filter");
  const reelParam = urlParams.get("reel");

  const hasSwitcher = Boolean(document.getElementById("tabBtnStories") && document.getElementById("tabBtnReels"));
  if (hasSwitcher) {
    if (tabParam === "reels" || filterParam || reelParam || window.location.hash === "#reels") {
      switchStoriesReelsTab("reels", false);
    } else {
      switchStoriesReelsTab("stories", false);
    }
  }

  if (filterParam) {
    setReelCategoryFilter(filterParam, false);
  }

  if (reelParam) {
    const foundReel = allLoadedVideos.find(x => String(x.id).toLowerCase() === String(reelParam).toLowerCase());
    if (foundReel) {
      setTimeout(() => openReelModalPlayer(foundReel), 200);
    }
  }
}

function initStoriesAndReelsSystem() {
  if (!document.getElementById("reelsVideoGrid")) return;
  // Tab switch buttons (if switcher exists)
  const tabBtnStories = document.getElementById("tabBtnStories");
  const tabBtnReels = document.getElementById("tabBtnReels");

  if (tabBtnStories) {
    tabBtnStories.addEventListener("click", () => switchStoriesReelsTab("stories"));
  }
  if (tabBtnReels) {
    tabBtnReels.addEventListener("click", () => switchStoriesReelsTab("reels"));
  }

  // Category filter chips
  const chips = document.querySelectorAll("#reelsFilterChips .filter-chip, #reelsFilterChips .track-pill");
  chips.forEach(chip => {
    chip.addEventListener("click", () => {
      setReelCategoryFilter(chip.dataset.filter || "all");
    });
  });

  const resetBtn = document.getElementById("resetFilterBtn");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      setReelCategoryFilter("all");
    });
  }

  // Modal player event handlers
  const closeReelModalBtn = document.getElementById("closeReelModalBtn");
  const reelPlayerModal = document.getElementById("reelPlayerModal");
  const reelLikeBtn = document.getElementById("reelModalLikeBtn");
  const reelShareBtn = document.getElementById("reelModalShareBtn");
  const reelReplayBtn = document.getElementById("reelModalReplayBtn");
  const reelVideo = document.getElementById("reelModalVideo");

  if (closeReelModalBtn) {
    closeReelModalBtn.addEventListener("click", closeReelModalPlayer);
  }

  if (reelPlayerModal) {
    reelPlayerModal.addEventListener("click", (e) => {
      if (e.target === reelPlayerModal) {
        closeReelModalPlayer();
      }
    });
  }

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && reelPlayerModal && reelPlayerModal.classList.contains("active")) {
      closeReelModalPlayer();
    }
  });

  if (reelLikeBtn) {
    reelLikeBtn.addEventListener("click", () => {
      if (!currentActiveReelItem) return;
      const isFav = toggleReelFavorite(currentActiveReelItem.id);
      reelLikeBtn.classList.toggle("active", isFav);
      const icon = document.getElementById("reelModalLikeIcon");
      const label = document.getElementById("reelModalLikeLabel");
      if (icon) icon.textContent = isFav ? "❤️" : "🤍";
      if (label) label.textContent = isFav ? "Favorited" : "Favorite";

      // Also update any card in background
      const cardLike = document.querySelector(`#reel-card-${currentActiveReelItem.id} .btn-reel-like`);
      if (cardLike) {
        cardLike.classList.toggle("active", isFav);
        const heart = cardLike.querySelector(".like-heart");
        if (heart) heart.textContent = isFav ? "❤️" : "🤍";
      }

      showInAppReminderToast(
        isFav ? "Saved to Favorites ❤️" : "Removed from Favorites",
        `"${currentActiveReelItem.title}" updated in your collection.`
      );
    });
  }

  if (reelShareBtn) {
    reelShareBtn.addEventListener("click", () => {
      if (currentActiveReelItem) {
        shareReelItem(currentActiveReelItem);
      }
    });
  }

  if (reelReplayBtn && reelVideo) {
    reelReplayBtn.addEventListener("click", () => {
      reelVideo.currentTime = 0;
      reelVideo.play().catch(() => {});
    });
  }

  // Subtitle Language toggle chips
  document.querySelectorAll(".sub-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      const lang = chip.dataset.lang;
      if (lang && typeof subtitlePreferences[lang] !== "undefined") {
        subtitlePreferences[lang] = !subtitlePreferences[lang];
        applySubtitleToggles();
      }
    });
  });

  // Load workbook data
  loadReelsAndStoriesWorkbook();
}


/* =========================================================
   START
   ========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  () => {
    setupThemeToggle();
    initializeMobileMenu();
    setupStoryCompletionModalListeners();
    updateHeaderStreakUI();
    setupStreakBadgeInteractions();
    updateUserLevelUI();
    setupUserLevelInteractions();
    setupReminderUI();
    startDailyReminderScheduler();
    loadStoryLesson();
    initStoriesAndReelsSystem();

    window.addEventListener("popstate", () => {
      if (!document.getElementById("storyCourseSidebar")) return;
      const targetId = getLessonId();
      if (cachedStoryWorkbook.loaded) {
        switchStory(targetId, false, true);
      } else {
        loadStoryLesson();
      }
    });

    window.addEventListener("linguapath-content-change", () => {
      cachedStoryWorkbook.loaded = false;
      loadStoryLesson();
    });

    let workerSyncedStoryOnce = false;
    window.addEventListener("linguapath-worker-ready", () => {
      if (workerSyncedStoryOnce || !window.LinguaContentStore?.getDataSourceStatus) return;
      const storiesSrc = String((window.LinguaContentStore.getDataSourceStatus("stories") || {}).source || "");
      const reelsSrc = String((window.LinguaContentStore.getDataSourceStatus("reels") || {}).source || "");
      const needStories = document.getElementById("storyCourseSidebar") && storiesSrc.indexOf("cloudflare-d1") !== 0;
      const needReels = document.getElementById("reelsVideoGrid") && reelsSrc.indexOf("cloudflare-d1") !== 0;
      workerSyncedStoryOnce = true;
      if (needStories) {
        cachedStoryWorkbook.loaded = false;
        loadStoryLesson();
      }
      if (needReels) {
        loadReelsAndStoriesWorkbook();
      }
    });

    window.addEventListener("lingua-auth-change", () => {
      updateHeaderStreakUI();
      updateUserLevelUI();
      updateReminderBellUI();
      updateReminderGoalStatusUI();
      checkAndTriggerDailyReminder();
      if (currentLoadedLessonId) {
        updateStoryProgressUI(currentLoadedLessonId);
        renderStorySidebar(currentLoadedAllLessons, currentLoadedLessonId);
      }
    });
  }
);