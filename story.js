"use strict";


/* =========================================================
   CONFIGURATION
========================================================= */

const EXCEL_FILE = "data/lessons.xlsx";


/* =========================================================
   GET LESSON ID
========================================================= */

const urlParams =
  new URLSearchParams(
    window.location.search
  );


const lessonId =
  urlParams.get("id") ||
  "lesson-01";


/* =========================================================
   HELPERS
========================================================= */

function normalizeKey(value) {

  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");

}


function getValue(row, ...keys) {

  for (const key of keys) {

    const target =
      normalizeKey(key);


    for (const actualKey of Object.keys(row)) {

      if (
        normalizeKey(actualKey) ===
        target
      ) {

        const value = row[actualKey];

        if (
          value !== undefined &&
          value !== null &&
          String(value).trim() !== ""
        ) {

          return value;

        }

      }

    }

  }

  return "";

}


function escapeHTML(value) {

  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

}


function sortByOrder(rows) {

  return [...rows].sort(
    (a, b) => {

      const orderA =
        Number(
          getValue(
            a,
            "order",
            "sortOrder"
          )
        ) || 0;


      const orderB =
        Number(
          getValue(
            b,
            "order",
            "sortOrder"
          )
        ) || 0;


      return orderA - orderB;

    }
  );

}


function filterByLesson(rows) {

  return rows.filter(row => {

    const rowLessonId =
      getValue(
        row,
        "lessonId",
        "lesson",
        "id"
      );

    return (
      String(rowLessonId).trim() ===
      String(lessonId).trim()
    );

  });

}


function readSheet(workbook, sheetName) {

  const sheet =
    workbook.Sheets[sheetName];

  if (!sheet) {
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
   SPEECH
========================================================= */

function speakChinese(text) {

  if (!("speechSynthesis" in window)) {
    return;
  }

  window.speechSynthesis.cancel();

  const utterance =
    new SpeechSynthesisUtterance(text);

  utterance.lang = "zh-CN";
  utterance.rate = 0.8;
  utterance.pitch = 1;

  window.speechSynthesis.speak(
    utterance
  );

}


function playAudio(
  audioPath,
  chineseText
) {

  if (audioPath) {

    const audio =
      new Audio(audioPath);


    audio.play().catch(() => {

      if (chineseText) {
        speakChinese(chineseText);
      }

    });

    return;

  }


  if (chineseText) {
    speakChinese(chineseText);
  }

}


/* =========================================================
   LOAD WORKBOOK
========================================================= */

async function loadWorkbook() {

  const response =
    await fetch(EXCEL_FILE);


  if (!response.ok) {

    throw new Error(
      `Could not load ${EXCEL_FILE}. HTTP ${response.status}`
    );

  }


  const arrayBuffer =
    await response.arrayBuffer();


  return XLSX.read(
    arrayBuffer,
    {
      type: "array"
    }
  );

}


/* =========================================================
   RENDER LESSON HEADER
========================================================= */

function renderLessonHeader(lesson) {

  const title =
    getValue(
      lesson,
      "title"
    );


  const chineseTitle =
    getValue(
      lesson,
      "chineseTitle",
      "chinese"
    );


  const pinyin =
    getValue(
      lesson,
      "pinyin"
    );


  const meaning =
    getValue(
      lesson,
      "meaning"
    );


  const description =
    getValue(
      lesson,
      "description"
    );


  const video =
    getValue(
      lesson,
      "video"
    );


  const poster =
    getValue(
      lesson,
      "poster"
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


  const videoElement =
    document.getElementById(
      "lessonVideo"
    );


  const videoTitle =
    document.getElementById(
      "videoTitle"
    );


  if (titleElement) {

    titleElement.textContent =
      chineseTitle || title;

  }


  if (pinyinElement) {

    pinyinElement.textContent =
      pinyin;

  }


  if (meaningElement) {

    meaningElement.textContent =
      meaning;

  }


  if (descriptionElement && description) {

    descriptionElement.textContent =
      description;

  }


  if (videoTitle) {

    videoTitle.textContent =
      title ||
      chineseTitle ||
      "Chinese Story";

  }


  if (videoElement && video) {

    video.src = video;

    if (poster) {
      video.poster = poster;
    }

  }

}


/* =========================================================
   RENDER STORY IMAGES
========================================================= */

function renderStoryImages(rows) {

  const container =
    document.getElementById(
      "storyImageGrid"
    );


  if (!container) {
    return;
  }


  container.innerHTML = "";


  if (!rows.length) {

    container.innerHTML = `
      <div class="empty-state">
        <h3>No story images</h3>
        <p>
          Add image rows to the Story sheet
          in lessons.xlsx.
        </p>
      </div>
    `;

    return;

  }


  rows.forEach((row, index) => {

    const chinese =
      getValue(
        row,
        "chinese",
        "sentence"
      );


    const pinyin =
      getValue(
        row,
        "pinyin"
      );


    const english =
      getValue(
        row,
        "english",
        "meaning",
        "translation"
      );


    const image =
      getValue(
        row,
        "image",
        "imageUrl"
      );


    const card =
      document.createElement(
        "article"
      );


    card.className =
      "story-image-card";


    card.innerHTML = `

      ${
        image
          ? `
            <div class="story-image">
              <img
                src="${escapeHTML(image)}"
                alt="${escapeHTML(english || chinese)}"
                loading="lazy"
              >
            </div>
          `
          : `
            <div class="story-image-placeholder">
              <span>${index + 1}</span>
            </div>
          `
      }

      <div class="story-image-content">

        <span class="story-image-number">
          SCENE ${String(index + 1).padStart(2, "0")}
        </span>

        ${
          chinese
            ? `
              <h3 class="chinese-sentence">
                ${escapeHTML(chinese)}
              </h3>
            `
            : ""
        }

        ${
          pinyin
            ? `
              <p class="pinyin-sentence">
                ${escapeHTML(pinyin)}
              </p>
            `
            : ""
        }

        ${
          english
            ? `
              <p class="english-sentence">
                ${escapeHTML(english)}
              </p>
            `
            : ""
        }

      </div>

    `;


    container.appendChild(card);

  });

}


/* =========================================================
   RENDER READING
========================================================= */

function renderStory(rows) {

  const container =
    document.getElementById(
      "storyContent"
    );


  if (!container) {
    return;
  }


  container.innerHTML = "";


  if (!rows.length) {

    container.innerHTML = `
      <div class="empty-state">
        <h3>No story content</h3>
        <p>
          Add sentences to the Story sheet.
        </p>
      </div>
    `;

    return;

  }


  rows.forEach((row, index) => {

    const chinese =
      getValue(
        row,
        "chinese",
        "sentence"
      );


    const pinyin =
      getValue(
        row,
        "pinyin"
      );


    const english =
      getValue(
        row,
        "english",
        "translation",
        "meaning"
      );


    const audio =
      getValue(
        row,
        "audio",
        "audioUrl"
      );


    const item =
      document.createElement(
        "article"
      );


    item.className =
      "reading-item";


    item.innerHTML = `

      <div class="reading-number">
        ${String(index + 1).padStart(2, "0")}
      </div>

      <div class="reading-main">

        <div class="reading-chinese-row">

          <div>

            <div class="reading-chinese">
              ${escapeHTML(chinese)}
            </div>

            ${
              pinyin
                ? `
                  <div class="reading-pinyin">
                    ${escapeHTML(pinyin)}
                  </div>
                `
                : ""
            }

          </div>

          <button
            class="reading-audio"
            type="button"
            aria-label="Listen to sentence"
          >
            🔊
          </button>

        </div>

        ${
          english
            ? `
              <div class="reading-english">
                ${escapeHTML(english)}
              </div>
            `
            : ""
        }

      </div>

    `;


    const audioButton =
      item.querySelector(
        ".reading-audio"
      );


    audioButton.addEventListener(
      "click",
      () => {

        playAudio(
          audio,
          chinese
        );

      }
    );


    container.appendChild(item);

  });

}


/* =========================================================
   RENDER VOCABULARY
========================================================= */

function renderVocabulary(rows) {

  const container =
    document.getElementById(
      "vocabularyContent"
    );


  if (!container) {
    return;
  }


  container.innerHTML = "";


  if (!rows.length) {

    container.innerHTML = `
      <div class="empty-state">
        <h3>No vocabulary found</h3>
        <p>
          Add vocabulary rows to the
          Vocabulary sheet.
        </p>
      </div>
    `;

    return;

  }


  rows.forEach(row => {

    const character =
      getValue(
        row,
        "character",
        "chinese",
        "word"
      );


    const pinyin =
      getValue(
        row,
        "pinyin"
      );


    const meaning =
      getValue(
        row,
        "meaning",
        "english"
      );


    const audio =
      getValue(
        row,
        "audio",
        "audioUrl"
      );


    const card =
      document.createElement(
        "article"
      );


    card.className =
      "vocabulary-card";


    card.innerHTML = `

      <div class="vocabulary-top">

        <div class="vocabulary-character">
          ${escapeHTML(character)}
        </div>

        <button
          class="vocabulary-audio"
          type="button"
          aria-label="Listen to vocabulary"
        >
          🔊
        </button>

      </div>

      <div class="vocabulary-pinyin">
        ${escapeHTML(pinyin)}
      </div>

      <div class="vocabulary-meaning">
        ${escapeHTML(meaning)}
      </div>

    `;


    const audioButton =
      card.querySelector(
        ".vocabulary-audio"
      );


    audioButton.addEventListener(
      "click",
      () => {

        playAudio(
          audio,
          character
        );

      }
    );


    container.appendChild(card);

  });

}


/* =========================================================
   RENDER EXERCISES
========================================================= */

function renderExercises(rows) {

  const container =
    document.getElementById(
      "exerciseContent"
    );


  if (!container) {
    return;
  }


  if (!rows.length) {

    container.innerHTML = `

      <span class="section-label">
        05 · CHECK YOUR UNDERSTANDING
      </span>

      <h2>
        No exercises yet.
      </h2>

      <p>
        Add exercises to the Exercises sheet
        in lessons.xlsx.
      </p>

    `;

    return;

  }


  container.innerHTML = `

    <span class="section-label">
      05 · CHECK YOUR UNDERSTANDING
    </span>

    <h2>
      Test what you understood.
    </h2>

    <p class="quiz-intro">
      Choose the answer that best matches
      the story.
    </p>

    <div class="exercise-list"></div>

  `;


  const list =
    container.querySelector(
      ".exercise-list"
    );


  rows.forEach((row, index) => {

    const question =
      getValue(
        row,
        "question"
      );


    const answer =
      getValue(
        row,
        "answer",
        "correctAnswer"
      );


    const options = [

      getValue(
        row,
        "optionA"
      ),

      getValue(
        row,
        "optionB"
      ),

      getValue(
        row,
        "optionC"
      ),

      getValue(
        row,
        "optionD"
      )

    ].filter(
      option =>
        String(option).trim() !== ""
    );


    const item =
      document.createElement(
        "div"
      );


    item.className =
      "exercise-item";


    item.innerHTML = `

      <div class="exercise-question">

        <span>
          Question ${index + 1}
        </span>

        <h3>
          ${escapeHTML(question)}
        </h3>

      </div>

      <div class="exercise-options">

        ${
          options.map(
            (option, optionIndex) => `

              <button
                type="button"
                class="exercise-option"
                data-value="${escapeHTML(option)}"
              >

                <span>
                  ${String.fromCharCode(65 + optionIndex)}
                </span>

                ${escapeHTML(option)}

              </button>

            `
          ).join("")
        }

      </div>

      <div class="exercise-feedback"></div>

    `;


    const optionButtons =
      item.querySelectorAll(
        ".exercise-option"
      );


    const feedback =
      item.querySelector(
        ".exercise-feedback"
      );


    optionButtons.forEach(button => {

      button.addEventListener(
        "click",
        () => {

          optionButtons.forEach(
            option => {
              option.classList.remove(
                "selected",
                "correct",
                "incorrect"
              );
            }
          );


          const selected =
            button.dataset.value;


          const correct =
            String(selected).trim() ===
            String(answer).trim();


          button.classList.add(
            "selected"
          );


          if (correct) {

            button.classList.add(
              "correct"
            );

            feedback.textContent =
              "✓ Correct! Well done.";

            feedback.className =
              "exercise-feedback correct-feedback";

          } else {

            button.classList.add(
              "incorrect"
            );

            feedback.textContent =
              `Not quite. The answer is: ${answer}`;

            feedback.className =
              "exercise-feedback incorrect-feedback";

          }

        }
      );

    });


    list.appendChild(item);

  });

}


/* =========================================================
   ERROR PAGE
========================================================= */

function renderError(message) {

  const ids = [

    "storyTitle",
    "storyPinyin",
    "storyMeaning"

  ];


  const title =
    document.getElementById(
      "storyTitle"
    );


  if (title) {
    title.textContent =
      "Lesson unavailable";
  }


  ids.slice(1).forEach(id => {

    const element =
      document.getElementById(id);

    if (element) {
      element.textContent = "";
    }

  });


  const containers = [

    "storyImageGrid",
    "storyContent",
    "vocabularyContent"

  ];


  containers.forEach(id => {

    const element =
      document.getElementById(id);

    if (element) {

      element.innerHTML = `

        <div class="empty-state error-state">

          <h3>
            We couldn't load this lesson.
          </h3>

          <p>
            ${escapeHTML(message)}
          </p>

          <a
            href="index.html#learning-hub"
            class="button button-primary"
          >
            Back to Learning Hub
          </a>

        </div>

      `;

    }

  });


  const exercise =
    document.getElementById(
      "exerciseContent"
    );


  if (exercise) {

    exercise.innerHTML = `

      <span class="section-label">
        LESSON ERROR
      </span>

      <h2>
        Lesson could not be loaded.
      </h2>

      <p>
        ${escapeHTML(message)}
      </p>

    `;

  }

}


/* =========================================================
   MAIN INITIALIZATION
========================================================= */

async function initializeStoryPage() {

  try {

    if (typeof XLSX === "undefined") {

      throw new Error(
        "SheetJS could not be loaded."
      );

    }


    const workbook =
      await loadWorkbook();


    const lessons =
      readSheet(
        workbook,
        "Lessons"
      );


    const storyRows =
      readSheet(
        workbook,
        "Story"
      );


    const vocabularyRows =
      readSheet(
        workbook,
        "Vocabulary"
      );


    const exerciseRows =
      readSheet(
        workbook,
        "Exercises"
      );


    const lesson =
      lessons.find(row => {

        const id =
          getValue(
            row,
            "id",
            "lessonId"
          );

        return (
          String(id).trim() ===
          String(lessonId).trim()
        );

      });


    if (!lesson) {

      throw new Error(
        `Lesson "${lessonId}" was not found in the Lessons sheet.`
      );

    }


    const story =
      sortByOrder(
        filterByLesson(
          storyRows
        )
      );


    const vocabulary =
      sortByOrder(
        filterByLesson(
          vocabularyRows
        )
      );


    const exercises =
      sortByOrder(
        filterByLesson(
          exerciseRows
        )
      );


    renderLessonHeader(
      lesson
    );


    renderStoryImages(
      story
    );


    renderStory(
      story
    );


    renderVocabulary(
      vocabulary
    );


    renderExercises(
      exercises
    );


    document.title =
      `LinguaPath | ${
        getValue(
          lesson,
          "title"
        ) || "Story Lesson"
      }`;


  } catch (error) {

    console.error(
      "Story loading error:",
      error
    );


    renderError(
      error.message
    );

  }

}


/* =========================================================
   START
========================================================= */

if (
  document.readyState ===
  "loading"
) {

  document.addEventListener(
    "DOMContentLoaded",
    initializeStoryPage
  );

} else {

  initializeStoryPage();

}