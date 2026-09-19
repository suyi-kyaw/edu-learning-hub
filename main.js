"use strict";


/* =========================================================
   CONFIGURATION
========================================================= */

const EXCEL_FILE = "data/lessons.xlsx";


/* =========================================================
   GLOBAL DATA
========================================================= */

let lessonData = {
  lessons: [],
  story: [],
  vocabulary: [],
  exercises: []
};


/* =========================================================
   TONE DATA
========================================================= */

const toneData = {

  1: {
    syllable: "mā",
    character: "妈",
    meaning: "mother",
    text: "Tone 1 — high and flat",
    path: "M20 30 L480 30",
    audio: "assets/audio/tones/ma-tone-1.mp3"
  },

  2: {
    syllable: "má",
    character: "麻",
    meaning: "hemp / numb",
    text: "Tone 2 — rising",
    path: "M20 70 C170 70 320 65 480 20",
    audio: "assets/audio/tones/ma-tone-2.mp3"
  },

  3: {
    syllable: "mǎ",
    character: "马",
    meaning: "horse",
    text: "Tone 3 — dipping",
    path: "M20 35 C130 85 230 85 300 70 C370 55 420 30 480 25",
    audio: "assets/audio/tones/ma-tone-3.mp3"
  },

  4: {
    syllable: "mà",
    character: "骂",
    meaning: "scold",
    text: "Tone 4 — falling",
    path: "M20 20 C180 25 330 65 480 85",
    audio: "assets/audio/tones/ma-tone-4.mp3"
  }

};


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

  window.speechSynthesis.speak(utterance);
}


/* =========================================================
   AUDIO FILE
========================================================= */

function playAudio(path, fallbackText = "") {

  if (path) {

    const audio = new Audio(path);

    audio.play().catch(() => {

      if (fallbackText) {
        speakChinese(fallbackText);
      }

    });

    return;
  }

  if (fallbackText) {
    speakChinese(fallbackText);
  }
}


/* =========================================================
   TONE DEMO
========================================================= */

function setupToneDemo() {

  const buttons =
    document.querySelectorAll(".tone-button");

  const character =
    document.getElementById("toneCharacter");

  const syllable =
    document.getElementById("toneSyllable");

  const meaning =
    document.getElementById("toneMeaning");

  const description =
    document.getElementById("toneDescription");

  const path =
    document.getElementById("tonePath");

  const playButton =
    document.getElementById("playToneButton");


  if (!buttons.length) {
    return;
  }


  function selectTone(toneNumber) {

    const data =
      toneData[toneNumber];

    if (!data) {
      return;
    }


    buttons.forEach(button => {

      button.classList.toggle(
        "active",
        button.dataset.tone === String(toneNumber)
      );

    });


    if (character) {
      character.textContent = data.character;
    }

    if (syllable) {
      syllable.textContent = data.syllable;
    }

    if (meaning) {
      meaning.textContent = data.meaning;
    }

    if (description) {
      description.textContent = data.text;
    }

    if (path) {
      path.setAttribute("d", data.path);
    }


    if (playButton) {

      playButton.onclick = () => {

        playAudio(
          data.audio,
          data.syllable
        );

      };

    }

  }


  buttons.forEach(button => {

    button.addEventListener("click", () => {

      selectTone(
        Number(button.dataset.tone)
      );

    });

  });


  selectTone(1);

}


/* =========================================================
   HERO SPEECH
========================================================= */

function setupSpeechButtons() {

  const heroButton =
    document.getElementById("heroSpeechButton");

  if (heroButton) {

    heroButton.addEventListener(
      "click",
      () => speakChinese("学")
    );

  }


  const greetingButton =
    document.getElementById(
      "greetingSpeechButton"
    );

  if (greetingButton) {

    greetingButton.addEventListener(
      "click",
      () => speakChinese("你好")
    );

  }

}


/* =========================================================
   MOBILE NAVIGATION
========================================================= */

function setupMobileMenu() {

  const button =
    document.getElementById(
      "mobileMenuButton"
    );

  const menu =
    document.getElementById(
      "mobileMenu"
    );


  if (!button || !menu) {
    return;
  }


  button.addEventListener("click", () => {

    menu.classList.toggle("open");

  });


  menu.querySelectorAll("a").forEach(link => {

    link.addEventListener("click", () => {

      menu.classList.remove("open");

    });

  });

}


/* =========================================================
   EXCEL HELPERS
========================================================= */

function normalizeKey(value) {

  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");

}


function getValue(row, ...keys) {

  for (const key of keys) {

    const normalizedTarget =
      normalizeKey(key);

    for (const actualKey of Object.keys(row)) {

      if (
        normalizeKey(actualKey) ===
        normalizedTarget
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
   LOAD EXCEL
========================================================= */

async function loadExcelData() {

  const status =
    document.getElementById(
      "lessonStatus"
    );


  try {

    if (typeof XLSX === "undefined") {

      throw new Error(
        "SheetJS could not be loaded."
      );

    }


    if (status) {
      status.textContent =
        "Loading lessons...";
    }


    const response =
      await fetch(EXCEL_FILE);


    if (!response.ok) {

      throw new Error(
        `Could not load ${EXCEL_FILE}. HTTP ${response.status}`
      );

    }


    const arrayBuffer =
      await response.arrayBuffer();


    const workbook =
      XLSX.read(
        arrayBuffer,
        {
          type: "array"
        }
      );


    lessonData.lessons =
      readSheet(
        workbook,
        "Lessons"
      );

    lessonData.story =
      readSheet(
        workbook,
        "Story"
      );

    lessonData.vocabulary =
      readSheet(
        workbook,
        "Vocabulary"
      );

    lessonData.exercises =
      readSheet(
        workbook,
        "Exercises"
      );


    window.lessonData =
      lessonData;


    renderLessons();


    if (status) {

      status.textContent =
        `${lessonData.lessons.length} lesson${lessonData.lessons.length === 1 ? "" : "s"} available`;

    }


    document.dispatchEvent(
      new CustomEvent(
        "lessonDataLoaded",
        {
          detail: lessonData
        }
      )
    );


  } catch (error) {

    console.error(
      "Excel loading error:",
      error
    );


    if (status) {

      status.innerHTML = `
        <strong>Lesson data could not be loaded.</strong>
        <span>
          Make sure <code>data/lessons.xlsx</code>
          exists and that the website is running
          through a local web server.
        </span>
      `;

      status.classList.add("error");

    }

  }

}


/* =========================================================
   RENDER LESSONS
========================================================= */

function renderLessons() {

  const container =
    document.getElementById(
      "lessonGrid"
    );


  if (!container) {
    return;
  }


  container.innerHTML = "";


  if (!lessonData.lessons.length) {

    container.innerHTML = `
      <div class="empty-state">
        <h3>No lessons found</h3>
        <p>
          Add lesson rows to the
          <strong>Lessons</strong> sheet
          in lessons.xlsx.
        </p>
      </div>
    `;

    return;
  }


  lessonData.lessons.forEach(
    (lesson, index) => {

      const id =
        getValue(
          lesson,
          "id",
          "lessonId"
        );


      const title =
        getValue(
          lesson,
          "title"
        ) ||
        `Lesson ${index + 1}`;


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


      const level =
        getValue(
          lesson,
          "level"
        ) ||
        "Beginner";


      const description =
        getValue(
          lesson,
          "description"
        );


      const poster =
        getValue(
          lesson,
          "poster",
          "image"
        );


      const card =
        document.createElement("article");


      card.className =
        "lesson-card";


      const imageHTML =
        poster
          ? `
            <div class="lesson-card-image">
              <img
                src="${escapeHTML(poster)}"
                alt="${escapeHTML(title)}"
                loading="lazy"
              >
            </div>
          `
          : `
            <div class="lesson-card-placeholder">
              <span>文</span>
            </div>
          `;


      card.innerHTML = `

        ${imageHTML}

        <div class="lesson-card-body">

          <div class="lesson-card-meta">

            <span>
              ${escapeHTML(level)}
            </span>

            <span>
              Lesson ${index + 1}
            </span>

          </div>

          <div class="lesson-chinese">
            ${escapeHTML(chineseTitle)}
          </div>

          <h3>
            ${escapeHTML(title)}
          </h3>

          ${
            pinyin
              ? `
                <p class="lesson-pinyin">
                  ${escapeHTML(pinyin)}
                </p>
              `
              : ""
          }

          ${
            meaning
              ? `
                <p class="lesson-meaning">
                  ${escapeHTML(meaning)}
                </p>
              `
              : ""
          }

          ${
            description
              ? `
                <p class="lesson-description">
                  ${escapeHTML(description)}
                </p>
              `
              : ""
          }

          <a
            class="lesson-button"
            href="story.html?id=${encodeURIComponent(id)}"
          >
            Start lesson
            <span>→</span>
          </a>

        </div>

      `;


      container.appendChild(card);

    }
  );

}


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHTML(value) {

  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

}


/* =========================================================
   START
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  () => {

    setupToneDemo();
    setupSpeechButtons();
    setupMobileMenu();
    loadExcelData();

  }
);