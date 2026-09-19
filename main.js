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
              "Correct!";

            feedback.className =
              "quiz-feedback correct-feedback";

          }

        } else {

          option.classList.add(
            "incorrect"
          );

          if (feedback) {

            feedback.textContent =
              "Not quite. Try again!";

            feedback.className =
              "quiz-feedback incorrect-feedback";

          }

        }

      }
    );

  });

}


/* =========================================================
   EXCEL DATA & STATE
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
   LOAD EXCEL & POPULATE DEMOS
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


    // Render standard lesson cards into the main grid
    renderLessonCards(
      lessonData.lessons
    );

    // Populate Demo Lessons Section with Excel Data
    populateDemoSectionFromExcel(workbook);


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
   POPULATE DEMO SECTION FROM EXCEL WORKBOOK
   ========================================================= */

function populateDemoSectionFromExcel(workbook) {

  // 1. Everyday Chinese (Phrases / Vocabulary Sheet)
  const phrasesSheet = workbook.Sheets['Phrases'] || workbook.Sheets['Vocabulary'] || workbook.Sheets[workbook.SheetNames[1]];
  if (phrasesSheet) {
    const phrases = XLSX.utils.sheet_to_json(phrasesSheet, { defval: "" });
    if (phrases.length > 0) {
      const item = phrases[0];
      const chinese = getValue(item, "chinese", "Chinese", "Text", "text") || "你好";
      const pinyin = getValue(item, "pinyin", "Pinyin") || "Nǐ hǎo";
      const meaning = getValue(item, "meaning", "Meaning", "English", "english") || "Hello";

      const chineseEl = document.getElementById('demoGreetingChinese');
      const pinyinEl = document.getElementById('demoGreetingPinyin');
      const meaningEl = document.getElementById('demoGreetingMeaning');
      const speechBtn = document.getElementById('demoGreetingSpeechButton');

      if (chineseEl) chineseEl.textContent = chinese;
      if (pinyinEl) pinyinEl.textContent = pinyin;
      if (meaningEl) meaningEl.textContent = meaning;
      if (speechBtn) speechBtn.dataset.text = `${chinese}。${pinyin}.`;
    }
  }

  // 2. Mini Dialogue (Story / Dialogues Sheet)
  const dialogueSheet = workbook.Sheets['Dialogues'] || workbook.Sheets['Story'] || workbook.Sheets[workbook.SheetNames[2]];
  if (dialogueSheet) {
    const dialogueLines = XLSX.utils.sheet_to_json(dialogueSheet, { defval: "" });
    const container = document.getElementById('demoDialogueContainer');
    
    if (dialogueLines.length > 0 && container) {
      // Pick up to first 2 dialogue lines for demo display
      const linesToShow = dialogueLines.slice(0, 2);
      
      container.innerHTML = linesToShow.map((line, idx) => {
        const speaker = getValue(line, "speaker", "Speaker") || (idx === 0 ? "A" : "B");
        const chinese = getValue(line, "chinese", "Chinese", "text", "Text") || "";
        const pinyin = getValue(line, "pinyin", "Pinyin") || "";
        const meaning = getValue(line, "meaning", "Meaning", "english", "English") || "";

        return `
          <div class="dialogue-line">
            <span class="dialogue-speaker">${escapeHTML(speaker)}</span>
            <div>
              <strong>${escapeHTML(chinese)}</strong>
              <small>${escapeHTML(pinyin)}</small>
              <em>${escapeHTML(meaning)}</em>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // 3. Quick Check Quiz (Exercises / Quiz Sheet)
  const quizSheet = workbook.Sheets['Exercises'] || workbook.Sheets['Quiz'] || workbook.Sheets[workbook.SheetNames[3]];
  if (quizSheet) {
    const quizData = XLSX.utils.sheet_to_json(quizSheet, { defval: "" });
    if (quizData.length > 0) {
      const q = quizData[0];
      const questionText = getValue(q, "question", "Question", "prompt", "Prompt");
      const word = getValue(q, "word", "Word", "chinese", "Chinese");
      const correctAnswer = getValue(q, "correctAnswer", "CorrectAnswer", "answer", "Answer");
      const option1 = getValue(q, "option1", "Option1", "opt1");
      const option2 = getValue(q, "option2", "Option2", "opt2");
      const option3 = getValue(q, "option3", "Option3", "opt3");

      const questionEl = document.getElementById('demoQuizQuestion');
      const optionsContainer = document.getElementById('demoQuizOptions');

      if (questionEl) {
        if (questionText) {
          questionEl.innerHTML = escapeHTML(questionText);
        } else if (word) {
          questionEl.innerHTML = `What does <strong>${escapeHTML(word)}</strong> mean?`;
        }
      }

      if (optionsContainer && (option1 || option2 || option3)) {
        optionsContainer.innerHTML = `
          <button type="button" data-answer="${String(option1).trim() === String(correctAnswer).trim() ? 'correct' : 'wrong'}">${escapeHTML(option1)}</button>
          <button type="button" data-answer="${String(option2).trim() === String(correctAnswer).trim() ? 'correct' : 'wrong'}">${escapeHTML(option2)}</button>
          <button type="button" data-answer="${String(option3).trim() === String(correctAnswer).trim() ? 'correct' : 'wrong'}">${escapeHTML(option3)}</button>
        `;

        // Re-bind click event handlers for the newly inserted options
        initializeMicroQuiz();
      }
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