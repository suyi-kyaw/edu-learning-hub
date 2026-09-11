// ============================================
// LinguaPath Story Lesson
// Loads lesson content from Excel
// ============================================

const EXCEL_FILE = "./data/lessons.xlsx";

let data = {
  lessons: [],
  story: [],
  vocabulary: [],
  exercises: []
};


// --------------------------------------------
// Load Excel
// --------------------------------------------

async function loadExcel() {

  const response = await fetch(EXCEL_FILE);

  if (!response.ok) {
    throw new Error("Could not load lessons.xlsx");
  }

  const buffer = await response.arrayBuffer();

  const workbook = XLSX.read(buffer, {
    type: "array"
  });

  data.lessons =
    readSheet(workbook, "Lessons");

  data.story =
    readSheet(workbook, "Story");

  data.vocabulary =
    readSheet(workbook, "Vocabulary");

  data.exercises =
    readSheet(workbook, "Exercises");
}


function readSheet(workbook, name) {

  const sheet = workbook.Sheets[name];

  if (!sheet) return [];

  return XLSX.utils.sheet_to_json(sheet, {
    defval: ""
  });
}


// --------------------------------------------
// Find lesson
// --------------------------------------------

function getLessonId() {

  const params =
    new URLSearchParams(window.location.search);

  return params.get("id") || "lesson-01";
}


function getLesson(id) {

  return data.lessons.find(
    lesson => String(lesson.id) === String(id)
  );
}


// --------------------------------------------
// Render lesson
// --------------------------------------------

function renderLesson(lesson) {

  if (!lesson) {

    document.body.innerHTML = `
      <main style="padding:40px;text-align:center;">
        <h1>Lesson not found</h1>
        <p>Please check the lesson ID.</p>
        <a href="index.html">Back to LinguaPath</a>
      </main>
    `;

    return;
  }


  // Title

  const title =
    document.getElementById("storyTitle");

  if (title) {
    title.textContent = lesson.chineseTitle;
  }


  const pinyin =
    document.getElementById("storyPinyin");

  if (pinyin) {
    pinyin.textContent = lesson.pinyin;
  }


  const meaning =
    document.getElementById("storyMeaning");

  if (meaning) {
    meaning.textContent = lesson.meaning;
  }


  const description =
    document.getElementById("storyDescription");

  if (description) {
    description.textContent =
      lesson.description;
  }


  // Video

  const video =
    document.getElementById("lessonVideo");

  if (video && lesson.video) {

    video.src = lesson.video;

    if (lesson.poster) {
      video.poster = lesson.poster;
    }

    video.load();
  }


  renderStory(lesson.id);

  renderVocabulary(lesson.id);

  renderExercises(lesson.id);
}


// --------------------------------------------
// Story
// --------------------------------------------

function renderStory(lessonId) {

  const container =
    document.getElementById("storyContent");

  if (!container) return;

  const rows =
    data.story
      .filter(row =>
        String(row.lessonId) === String(lessonId)
      )
      .sort((a, b) =>
        Number(a.order) - Number(b.order)
      );


  container.innerHTML = rows.map(row => `

    <article class="story-line">

      ${
        row.image
          ? `
            <img
              src="${row.image}"
              alt=""
              class="story-image"
              loading="lazy"
            >
          `
          : ""
      }

      <div class="story-text">

        <h3>${row.chinese}</h3>

        <p class="pinyin">
          ${row.pinyin}
        </p>

        <p>
          ${row.english}
        </p>

        ${
          row.audio
            ? `
              <button
                class="audio-button"
                onclick="playAudio('${row.audio}')"
              >
                🔊 Listen
              </button>
            `
            : `
              <button
                class="audio-button"
                onclick="speak('${escapeText(row.chinese)}')"
              >
                🔊 Listen
              </button>
            `
        }

      </div>

    </article>

  `).join("");
}


// --------------------------------------------
// Vocabulary
// --------------------------------------------

function renderVocabulary(lessonId) {

  const container =
    document.getElementById("vocabularyContent");

  if (!container) return;


  const rows =
    data.vocabulary
      .filter(row =>
        String(row.lessonId) === String(lessonId)
      )
      .sort((a, b) =>
        Number(a.order) - Number(b.order)
      );


  container.innerHTML = rows.map(row => `

    <div class="vocabulary-card">

      <div class="character">
        ${row.character}
      </div>

      <div class="pinyin">
        ${row.pinyin}
      </div>

      <div>
        ${row.meaning}
      </div>

      ${
        row.audio
          ? `
            <button
              onclick="playAudio('${row.audio}')"
            >
              🔊
            </button>
          `
          : ""
      }

    </div>

  `).join("");
}


// --------------------------------------------
// Exercises
// --------------------------------------------

function renderExercises(lessonId) {

  const container =
    document.getElementById("exerciseContent");

  if (!container) return;


  const rows =
    data.exercises
      .filter(row =>
        String(row.lessonId) === String(lessonId)
      )
      .sort((a, b) =>
        Number(a.order) - Number(b.order)
      );


  container.innerHTML = rows.map((row, index) => `

    <div
      class="exercise"
      data-answer="${row.answer}"
    >

      <h3>
        ${index + 1}. ${row.question}
      </h3>

      <div class="exercise-options">

        ${[
          row.optionA,
          row.optionB,
          row.optionC,
          row.optionD
        ]
          .filter(Boolean)
          .map(option => `
            <button
              class="exercise-option"
              onclick="checkAnswer(this)"
            >
              ${option}
            </button>
          `)
          .join("")}

      </div>

      <p class="exercise-feedback"></p>

    </div>

  `).join("");
}


// --------------------------------------------
// Exercise checking
// --------------------------------------------

function checkAnswer(button) {

  const exercise =
    button.closest(".exercise");

  const answer =
    exercise.dataset.answer;

  const feedback =
    exercise.querySelector(
      ".exercise-feedback"
    );

  if (button.textContent.trim() === answer.trim()) {

    button.classList.add("correct");

    feedback.textContent =
      "✓ Correct!";

  } else {

    button.classList.add("incorrect");

    feedback.textContent =
      "Try again.";

  }
}


// --------------------------------------------
// Audio
// --------------------------------------------

function playAudio(url) {

  const audio = new Audio(url);

  audio.play().catch(error => {
    console.error(
      "Audio playback failed:",
      error
    );
  });
}


// --------------------------------------------
// Speech fallback
// --------------------------------------------

function speak(text) {

  if (!window.speechSynthesis) return;

  window.speechSynthesis.cancel();

  const utterance =
    new SpeechSynthesisUtterance(text);

  utterance.lang = "zh-CN";
  utterance.rate = 0.8;

  window.speechSynthesis.speak(
    utterance
  );
}


// Prevent quotes from breaking onclick

function escapeText(text) {

  return String(text)
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"');
}


// --------------------------------------------
// Start
// --------------------------------------------

document.addEventListener(
  "DOMContentLoaded",
  async () => {

    try {

      await loadExcel();

      const lessonId =
        getLessonId();

      const lesson =
        getLesson(lessonId);

      renderLesson(lesson);

    } catch (error) {

      console.error(error);

      document.body.innerHTML = `
        <main style="padding:40px;text-align:center;">
          <h1>Unable to load lesson</h1>
          <p>
            Please make sure lessons.xlsx
            is inside the data folder.
          </p>
        </main>
      `;
    }

  }
);