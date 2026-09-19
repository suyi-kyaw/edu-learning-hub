/* =========================================================
   LinguaPath - Main JavaScript
   ========================================================= */


/* =========================================================
   MOBILE NAVIGATION
   ========================================================= */

function initializeMobileMenu() {

  const menuButton =
    document.getElementById("mobileMenuButton");

  const mobileMenu =
    document.getElementById("mobileMenu");


  if (!menuButton || !mobileMenu) {
    return;
  }


  menuButton.addEventListener("click", () => {

    const isOpen =
      mobileMenu.classList.toggle("open");

    menuButton.setAttribute(
      "aria-expanded",
      isOpen ? "true" : "false"
    );

    menuButton.setAttribute(
      "aria-label",
      isOpen
        ? "Close navigation"
        : "Open navigation"
    );

  });


  mobileMenu
    .querySelectorAll("a")
    .forEach(link => {

      link.addEventListener("click", () => {

        mobileMenu.classList.remove("open");

        menuButton.setAttribute(
          "aria-expanded",
          "false"
        );

        menuButton.setAttribute(
          "aria-label",
          "Open navigation"
        );

      });

    });

}


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

    audio:
      "./assets/audio/tones/ma-tone-1.mp3"

  },


  2: {

    syllable: "má",

    character: "麻",

    meaning: "hemp / numb",

    text: "Tone 2 — rising",

    path:
      "M20 70 C170 70 320 65 480 20",

    audio:
      "./assets/audio/tones/ma-tone-2.mp3"

  },


  3: {

    syllable: "mǎ",

    character: "马",

    meaning: "horse",

    text: "Tone 3 — dipping",

    path:
      "M20 35 C130 85 230 85 300 70 C370 55 420 30 480 25",

    audio:
      "./assets/audio/tones/ma-tone-3.mp3"

  },


  4: {

    syllable: "mà",

    character: "骂",

    meaning: "scold",

    text: "Tone 4 — falling",

    path:
      "M20 20 C180 25 330 65 480 85",

    audio:
      "./assets/audio/tones/ma-tone-4.mp3"

  }

};


/* =========================================================
   TONE DEMO
   ========================================================= */

function initializeToneDemo() {

  const toneButtons =
    document.querySelectorAll(".tone-button");

  const syllable =
    document.getElementById("toneSyllable");

  const character =
    document.getElementById("toneCharacter");

  const description =
    document.getElementById("toneDescription");

  const tonePath =
    document.getElementById("tonePath");

  const audio =
    document.getElementById("currentToneAudio");

  const audioButton =
    document.getElementById("toneAudioButton");


  if (!toneButtons.length) {
    return;
  }


  function selectTone(toneNumber) {

    const tone =
      toneData[toneNumber];

    if (!tone) {
      return;
    }


    toneButtons.forEach(button => {

      button.classList.toggle(
        "active",
        button.dataset.tone === String(toneNumber)
      );

    });


    if (syllable) {
      syllable.textContent =
        tone.syllable;
    }


    if (character) {
      character.textContent =
        tone.character;
    }


    if (description) {
      description.textContent =
        `${tone.text} · ${tone.meaning}`;
    }


    if (tonePath) {
      tonePath.setAttribute(
        "d",
        tone.path
      );
    }


    if (audio) {
      audio.src = tone.audio;
      audio.load();
    }

  }


  toneButtons.forEach(button => {

    button.addEventListener(
      "click",
      () => {

        selectTone(
          Number(button.dataset.tone)
        );

      }
    );

  });


  if (audioButton) {

    audioButton.addEventListener(
      "click",
      () => {

        const selectedButton =
          document.querySelector(
            ".tone-button.active"
          );

        const toneNumber =
          selectedButton
            ? Number(selectedButton.dataset.tone)
            : 1;

        const tone =
          toneData[toneNumber];


        if (!tone) {
          return;
        }


        if (
          tone.audio &&
          audio
        ) {

          audio.src =
            tone.audio;

          audio.play().catch(() => {

            speakText(
              tone.syllable,
              "zh-CN"
            );

          });

        } else {

          speakText(
            tone.syllable,
            "zh-CN"
          );

        }

      }
    );

  }


  selectTone(1);

}


/* =========================================================
   BROWSER SPEECH
   ========================================================= */

function speakText(
  text,
  language = "zh-CN"
) {

  if (
    !("speechSynthesis" in window)
  ) {

    return;

  }


  window.speechSynthesis.cancel();


  const utterance =
    new SpeechSynthesisUtterance(text);

  utterance.lang =
    language;

  utterance.rate =
    0.85;

  utterance.pitch =
    1;


  window.speechSynthesis.speak(
    utterance
  );

}


/* =========================================================
   SPEECH BUTTONS
   ========================================================= */

function initializeSpeechButtons() {

  const buttons =
    document.querySelectorAll(
      ".speech-button"
    );


  buttons.forEach(button => {

    button.addEventListener(
      "click",
      () => {

        const text =
          button.dataset.text;

        if (text) {

          speakText(
            text,
            "zh-CN"
          );

        }

      }
    );

  });

}


/* =========================================================
   MICRO QUIZ
   ========================================================= */

function initializeMicroQuiz() {

  const options =
    document.querySelectorAll(
      ".micro-options button"
    );

  const feedback =
    document.getElementById(
      "microQuizFeedback"
    );


  options.forEach(option => {

    option.addEventListener(
      "click",
      () => {

        options.forEach(button => {

          button.classList.remove(
            "correct",
            "incorrect"
          );

        });


        const answer =
          option.dataset.answer;


        if (answer === "correct") {

          option.classList.add(
            "correct"
          );

          if (feedback) {

            feedback.textContent =
              "Correct! 妈 (mā) means mother.";

            feedback.className =
              "quiz-feedback correct-feedback";

          }

        } else {

          option.classList.add(
            "incorrect"
          );

          if (feedback) {

            feedback.textContent =
              "Not quite. 妈 (mā) means mother.";

            feedback.className =
              "quiz-feedback incorrect-feedback";

          }

        }

      }
    );

  });

}


/* =========================================================
   EXCEL DATA
   ========================================================= */

const EXCEL_FILE =
  "data/lessons.xlsx";


let lessonData = {

  lessons: [],

  story: [],

  vocabulary: [],

  exercises: []

};


window.lessonData =
  lessonData;


/* =========================================================
   EXCEL SHEET READER
   ========================================================= */

function readExcelSheet(
  workbook,
  sheetName
) {

  const sheet =
    workbook.Sheets[sheetName];


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
   LOAD EXCEL
   ========================================================= */

async function loadExcelData() {

  const lessonGrid =
    document.getElementById(
      "lessonGrid"
    );


  try {

    if (
      typeof XLSX ===
      "undefined"
    ) {

      throw new Error(
        "SheetJS is not loaded."
      );

    }


    const response =
      await fetch(EXCEL_FILE);


    if (!response.ok) {

      throw new Error(
        `Could not load ${EXCEL_FILE}. HTTP status: ${response.status}`
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


    lessonData = {

      lessons:
        readExcelSheet(
          workbook,
          "Lessons"
        ),

      story:
        readExcelSheet(
          workbook,
          "Story"
        ),

      vocabulary:
        readExcelSheet(
          workbook,
          "Vocabulary"
        ),

      exercises:
        readExcelSheet(
          workbook,
          "Exercises"
        )

    };


    window.lessonData =
      lessonData;


    console.log(
      "LinguaPath Excel data loaded:",
      lessonData
    );


    renderLessonCards(
      lessonData.lessons
    );


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


    if (lessonGrid) {

      lessonGrid.innerHTML = `

        <div class="error-card">

          <h3>
            Lesson data could not be loaded.
          </h3>

          <p>
            Please make sure
            <strong>data/lessons.xlsx</strong>
            exists and is accessible.
          </p>

          <small>
            ${escapeHTML(error.message)}
          </small>

        </div>

      `;

    }

  }

}


/* =========================================================
   SAFE HTML
   ========================================================= */

function escapeHTML(value) {

  return String(value ?? "")
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );

}


/* =========================================================
   FLEXIBLE COLUMN READER
   ========================================================= */

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


/* =========================================================
   RENDER LESSON CARDS
   ========================================================= */

function renderLessonCards(
  lessons
) {

  const lessonGrid =
    document.getElementById(
      "lessonGrid"
    );


  if (!lessonGrid) {
    return;
  }


  if (!lessons.length) {

    lessonGrid.innerHTML = `

      <div class="empty-card">

        <h3>
          No lessons found
        </h3>

        <p>
          Add lessons to the Lessons sheet
          in data/lessons.xlsx.
        </p>

      </div>

    `;

    return;

  }


  lessonGrid.innerHTML =
    lessons.map(
      lesson => {

        const id =
          getValue(
            lesson,
            "id",
            "ID",
            "lessonId"
          );


        const title =
          getValue(
            lesson,
            "title",
            "Title"
          ) ||
          "Untitled Lesson";


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


        const level =
          getValue(
            lesson,
            "level",
            "Level"
          ) ||
          "Beginner";


        const description =
          getValue(
            lesson,
            "description",
            "Description"
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


        return `

          <article class="lesson-card">

            ${
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
                    文
                  </div>
                `
            }


            <div class="lesson-card-content">

              <span class="lesson-level">
                ${escapeHTML(level)}
              </span>


              <h3>
                ${escapeHTML(title)}
              </h3>


              ${
                chineseTitle
                  ? `
                    <div class="lesson-chinese-title">
                      ${escapeHTML(chineseTitle)}
                    </div>
                  `
                  : ""
              }


              ${
                pinyin
                  ? `
                    <div class="lesson-pinyin">
                      ${escapeHTML(pinyin)}
                    </div>
                  `
                  : ""
              }


              ${
                meaning
                  ? `
                    <div class="lesson-meaning">
                      ${escapeHTML(meaning)}
                    </div>
                  `
                  : ""
              }


              ${
                description
                  ? `
                    <p>
                      ${escapeHTML(description)}
                    </p>
                  `
                  : ""
              }


              <a
                class="primary-button lesson-button"
                href="story.html?id=${encodeURIComponent(id)}"
              >
                Open Lesson
              </a>

            </div>

          </article>

        `;

      }
    ).join("");

}


/* =========================================================
   INITIALIZE
   ========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  () => {

    initializeMobileMenu();

    initializeToneDemo();

    initializeSpeechButtons();

    initializeMicroQuiz();

    loadExcelData();

  }
);