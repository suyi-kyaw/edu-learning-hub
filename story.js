/* =========================================================
   LinguaPath - Story Lesson JavaScript
   ========================================================= */


/* =========================================================
   CONFIGURATION
   ========================================================= */

const EXCEL_FILE =
  "data/lessons.xlsx";


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

  const menuButton =
    document.getElementById("menuToggle") ||
    document.getElementById("mobileMenuButton");

  const mobileMenu =
    document.getElementById("mainNav") ||
    document.getElementById("mobileMenu");


  if (!menuButton || !mobileMenu) {
    return;
  }


  menuButton.addEventListener(
    "click",
    () => {

      const isOpen =
        mobileMenu.classList.toggle("active") ||
        mobileMenu.classList.toggle("open");


      menuButton.setAttribute(
        "aria-expanded",
        isOpen
          ? "true"
          : "false"
      );


      menuButton.setAttribute(
        "aria-label",
        isOpen
          ? "Close navigation"
          : "Open navigation"
      );

    }
  );


  mobileMenu
    .querySelectorAll("a")
    .forEach(link => {

      link.addEventListener(
        "click",
        () => {

          mobileMenu.classList.remove(
            "active",
            "open"
          );


          menuButton.setAttribute(
            "aria-expanded",
            "false"
          );

        }
      );

    });

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

    currentPlayingButton.textContent = "▶ Play";
    currentPlayingButton.classList.remove("playing");
    currentPlayingButton = null;

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


  const utterance =
    new SpeechSynthesisUtterance(
      text
    );


  utterance.lang =
    "zh-CN";

  utterance.rate =
    0.82;

  utterance.pitch =
    1;


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


  window.speechSynthesis.speak(
    utterance
  );

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

  if (audioPath) {

    const audio =
      new Audio(
        audioPath
      );

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

        /* Fallback to speech synthesis on audio error */
        speakText(
          text,
          button
        );

      });

    }

    audio.play().catch(
      () => {

        speakText(
          text,
          button
        );

      }
    );

    return;

  }


  speakText(
    text,
    button
  );

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
    `LinguaPath | ${title || "Chinese Story Lesson"}`;

}


/* =========================================================
   RENDER VIDEO
   ========================================================= */

function renderVideo(
  lesson
) {

  const videoElement =
    document.getElementById(
      "lessonVideo"
    );


  const videoTitle =
    document.getElementById(
      "videoTitle"
    );


  const video =
    getValue(
      lesson,
      "video",
      "Video"
    );


  const poster =
    getValue(
      lesson,
      "poster",
      "Poster"
    );


  const title =
    getValue(
      lesson,
      "title",
      "Title"
    );


  if (videoElement) {

    if (video) {

      videoElement.src =
        video;

    }


    if (poster) {
      videoElement.poster = poster;
      videoElement.onerror = () => {
        if (videoElement.poster.endsWith(".jpg")) {
          videoElement.poster = videoElement.poster.replace(/\.jpg$/, ".svg");
        } else if (videoElement.poster.endsWith(".svg")) {
          videoElement.poster = videoElement.poster.replace(/\.svg$/, ".png");
        }
      };
    }

  }


  if (videoTitle) {

    videoTitle.textContent =
      title ||
      "Chinese Story";

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
          getValue(
            row,
            "image",
            "Image"
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

            </div>

          </article>

        `;

      }
    ).join("");

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

              <div class="chinese-sentence">
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


            <div class="vocabulary-character">
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
  `;


  container.innerHTML =
    html;


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


              if (feedback) {

                if (isCorrect) {

                  feedback.textContent =
                    "✓ Correct!";

                  feedback.className =
                    "exercise-feedback correct-feedback";

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
  try {
    const lessonId = getLessonId();

    let workbook = null;
    let lessons = [];
    let allStoryRows = [];
    let allVocabularyRows = [];
    let allExerciseRows = [];
    let loaded = false;

    // Strategy 1: Direct Excel parsing if XLSX is available in the browser
    if (typeof XLSX !== "undefined") {
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

    // Strategy 2: Server API endpoint /api/lessons-data
    if (!loaded) {
      try {
        const apiResponse = await fetch("/api/lessons-data", { cache: "no-cache" });
        if (apiResponse.ok) {
          const apiData = await apiResponse.json();
          if (apiData.success && apiData.sheets) {
            lessons = apiData.sheets["Lessons"] || [];
            allStoryRows = apiData.sheets["Story"] || [];
            allVocabularyRows = apiData.sheets["Vocabulary"] || [];
            allExerciseRows = apiData.sheets["Exercises"] || [];
            if (lessons.length > 0 || allStoryRows.length > 0) {
              loaded = true;
            }
          }
        }
      } catch (apiErr) {
        console.warn("Server API fallback note for story:", apiErr);
      }
    }

    // Strategy 3: Static JSON file data/lessons.json
    if (!loaded) {
      try {
        const jsonResponse = await fetch("data/lessons.json", { cache: "no-cache" });
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
          video: "assets/video/lesson-01.mp4",
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
          video: "assets/video/lesson-02.mp4",
          poster: "assets/images/story2-poster.jpg"
        }
      ];
      allStoryRows = [
        { lessonId: "lesson-01", order: 1, chinese: "早上好！", pinyin: "Zǎoshang hǎo!", english: "Good morning!", image: "assets/images/story-01.jpg", audio: "assets/audio/story-01.mp3" },
        { lessonId: "lesson-01", order: 2, chinese: "小明起床了。", pinyin: "Xiǎomíng qǐchuáng le.", english: "Xiaoming gets up.", image: "assets/images/story-02.jpg", audio: "assets/audio/story-02.mp3" },
        { lessonId: "lesson-01", order: 3, chinese: "他吃早饭。", pinyin: "Tā chī zǎofàn.", english: "He eats breakfast.", image: "assets/images/story-03.jpg", audio: "assets/audio/story-03.mp3" },
        { lessonId: "lesson-01", order: 4, chinese: "然后，他去学校。", pinyin: "Ránhòu, tā qù xuéxiào.", english: "Then, he goes to school.", image: "assets/images/story-04.jpg", audio: "assets/audio/story-04.mp3" },
        { lessonId: "lesson-01", order: 5, chinese: "他很开心。", pinyin: "Tā hěn kāixīn.", english: "He is very happy.", image: "assets/images/story-05.jpg", audio: "assets/audio/story-05.mp3" },

        { lessonId: "lesson-02", order: 1, chinese: "今天天气真好！", pinyin: "Jīntiān tiānqì zhēn hǎo!", english: "The weather is really nice today!", image: "assets/images/story2-01.jpg", audio: "assets/audio/story2-01.mp3" },
        { lessonId: "lesson-02", order: 2, chinese: "小明去水果市场。", pinyin: "Xiǎomíng qù shuǐguǒ shìchǎng.", english: "Xiaoming goes to the fruit market.", image: "assets/images/story2-02.jpg", audio: "assets/audio/story2-02.mp3" },
        { lessonId: "lesson-02", order: 3, chinese: "市场里有很多新鲜的红苹果。", pinyin: "Shìchǎng lǐ yǒu hěn duō xīnxiān de hóng píngguǒ.", english: "There are many fresh red apples in the market.", image: "assets/images/story2-03.jpg", audio: "assets/audio/story2-03.mp3" },
        { lessonId: "lesson-02", order: 4, chinese: "他买了三个大苹果。", pinyin: "Tā mǎi le sān gè dà píngguǒ.", english: "He bought three big apples.", image: "assets/images/story2-04.jpg", audio: "assets/audio/story2-04.mp3" },
        { lessonId: "lesson-02", order: 5, chinese: "苹果又甜又好吃，他真开心！", pinyin: "Píngguǒ yòu tián yòu hǎochī, tā zhēn kāixīn!", english: "The apples are sweet and delicious, he is really happy!", image: "assets/images/story2-05.jpg", audio: "assets/audio/story2-05.mp3" }
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

    // Match lesson by ID or fall back to first lesson
    const norm = str => String(str || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    const targetNorm = norm(lessonId);
    const lesson = lessons.find(row => {
      const id = getValue(row, "id", "ID", "lessonId");
      const rNorm = norm(id);
      return (
        rNorm === targetNorm ||
        rNorm === norm(`lesson-${targetNorm}`) ||
        rNorm === norm(`lesson-0${targetNorm}`) ||
        String(id).trim().toLowerCase() === String(lessonId).trim().toLowerCase()
      );
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

    // Render all page sections
    renderLessonHeader(lesson);
    renderVideo(lesson);
    renderStoryImages(storyRows);
    renderStoryReading(storyRows);
    renderVocabulary(vocabularyRows);
    renderExercises(exerciseRows);
    updateLessonNavigation(storyRows, vocabularyRows, exerciseRows);
    renderStorySwitcher(lessons, currentLessonId);
    renderStoryPagination(lessons, currentLessonId);

    console.log("Story lesson loaded successfully:", {
      lessonId: currentLessonId,
      lesson,
      storyCount: storyRows.length,
      vocabularyCount: vocabularyRows.length,
      exerciseCount: exerciseRows.length
    });

  } catch (error) {
    console.error("Story lesson loading error:", error);
    showPageError(error);
  }
}


/* =========================================================
   RENDER STORY SWITCHER & PAGINATION
   ========================================================= */

function renderStorySwitcher(lessons, currentLessonId) {
  const container = document.getElementById("storySwitcher");
  if (!container) return;

  if (!lessons || lessons.length <= 1) {
    container.innerHTML = "";
    return;
  }

  const norm = str => String(str || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  const currentNorm = norm(currentLessonId);

  let html = "";
  lessons.forEach((l, index) => {
    const lId = getValue(l, "id", "ID", "lessonId") || `lesson-0${index + 1}`;
    const lTitle = getValue(l, "chineseTitle") || getValue(l, "title") || `Story ${index + 1}`;
    const isActive = norm(lId) === currentNorm || norm(`lesson-${currentNorm}`) === norm(lId);

    html += `
      <a
        href="story.html?id=${encodeURIComponent(lId)}"
        class="story-switcher-btn ${isActive ? "active" : ""}"
      >
        <span class="story-switcher-badge">Story ${index + 1}</span>
        <span>${escapeHTML(lTitle)}</span>
      </a>
    `;
  });

  container.innerHTML = html;
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

  const norm = str => String(str || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  const currentNorm = norm(currentLessonId);
  const currentIndex = lessons.findIndex(l => {
    const lId = getValue(l, "id", "ID", "lessonId");
    return norm(lId) === currentNorm || norm(`lesson-${currentNorm}`) === norm(lId);
  });

  const prevLesson = currentIndex > 0 ? lessons[currentIndex - 1] : null;
  const nextLesson = currentIndex < lessons.length - 1 && currentIndex >= 0 ? lessons[currentIndex + 1] : null;

  let actionsHtml = "";
  if (prevLesson) {
    const prevId = getValue(prevLesson, "id", "ID", "lessonId");
    const prevTitle = getValue(prevLesson, "chineseTitle") || getValue(prevLesson, "title") || "Previous Story";
    actionsHtml += `
      <a href="story.html?id=${encodeURIComponent(prevId)}" class="btn btn-secondary">
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
      <a href="story.html?id=${encodeURIComponent(nextId)}" class="btn btn-primary">
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
   START
   ========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  () => {

    initializeMobileMenu();

    loadStoryLesson();

  }
);