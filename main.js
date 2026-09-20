
/* =========================================================
   LinguaPath - Main JavaScript
   ---------------------------------------------------------
   Excel source:
   data/lessons.xlsx

   Sheets used:
   - Demo
   - Lessons

   Demo columns:
   section
   order
   chinese
   pinyin
   english
   audio
   question
   optionA
   optionB
   optionC
   optionD
   answer
========================================================= */


/* =========================================================
   GLOBAL DATA
========================================================= */

let workbook = null;

let demoData = [];
let lessonData = [];

let pronunciationData = [];
let everydayChineseData = [];
let conversationData = [];
let quickCheckData = [];

let currentToneIndex = 0;


/* =========================================================
   PAGE INITIALIZATION
========================================================= */

document.addEventListener("DOMContentLoaded", () => {

  setupMobileMenu();
  setupSpeechButtons();

  loadExcelData();

});


/* =========================================================
   LOAD EXCEL FILE
========================================================= */

async function loadExcelData() {

  try {

    showLoadingState();

    const response = await fetch("data/lessons.xlsx");

    if (!response.ok) {
      throw new Error(
        `Could not load Excel file: ${response.status}`
      );
    }

    const arrayBuffer = await response.arrayBuffer();

    workbook = XLSX.read(arrayBuffer, {
      type: "array"
    });


    /* -----------------------------------------
       Read Demo sheet
    ----------------------------------------- */

    if (workbook.SheetNames.includes("Demo")) {

      const demoSheet =
        workbook.Sheets["Demo"];

      demoData = XLSX.utils.sheet_to_json(
        demoSheet,
        {
          defval: ""
        }
      );

    } else {

      console.warn(
        "Demo sheet was not found in lessons.xlsx"
      );

      demoData = [];

    }


    /* -----------------------------------------
       Read Lessons sheet
    ----------------------------------------- */

    if (workbook.SheetNames.includes("Lessons")) {

      const lessonsSheet =
        workbook.Sheets["Lessons"];

      lessonData = XLSX.utils.sheet_to_json(
        lessonsSheet,
        {
          defval: ""
        }
      );

    } else {

      console.warn(
        "Lessons sheet was not found in lessons.xlsx"
      );

      lessonData = [];

    }


    /* -----------------------------------------
       Prepare Demo data
    ----------------------------------------- */

    prepareDemoData();


    /* -----------------------------------------
       Render Demo Lessons
    ----------------------------------------- */

    renderPronunciation();
    renderEverydayChinese();
    renderConversation();
    renderQuickCheck();


    /* -----------------------------------------
       Render Learning Hub
    ----------------------------------------- */

    renderLessons();


    console.log(
      "LinguaPath Excel data loaded successfully."
    );

  } catch (error) {

    console.error(
      "Error loading lessons.xlsx:",
      error
    );

    showGlobalError();

  }

}


/* =========================================================
   PREPARE DEMO DATA
========================================================= */

function prepareDemoData() {

  pronunciationData =
    demoData
      .filter(row =>
        normalize(row.section) === "pronunciation"
      )
      .sort(sortByOrder);


  everydayChineseData =
    demoData
      .filter(row =>
        normalize(row.section) === "everyday chinese"
      )
      .sort(sortByOrder);


  conversationData =
    demoData
      .filter(row =>
        normalize(row.section) === "conversation"
      )
      .sort(sortByOrder);


  quickCheckData =
    demoData
      .filter(row =>
        normalize(row.section) === "quick check"
      )
      .sort(sortByOrder);

}


/* =========================================================
   PRONUNCIATION
========================================================= */

function renderPronunciation() {

  const buttonContainer =
    document.getElementById("toneButtons");

  if (!buttonContainer) {
    return;
  }


  if (pronunciationData.length === 0) {

    buttonContainer.innerHTML = `
      <div class="loading-card">
        No pronunciation data found.
      </div>
    `;

    return;

  }


  buttonContainer.innerHTML = "";


  pronunciationData.forEach(
    (item, index) => {

      const button =
        document.createElement("button");

      button.type = "button";

      button.className =
        "tone-button";

      button.dataset.index = index;

      button.innerHTML = `
        <span class="tone-button-character">
          ${escapeHTML(item.chinese)}
        </span>

        <span class="tone-button-pinyin">
          ${escapeHTML(item.pinyin)}
        </span>
      `;


      button.addEventListener(
        "click",
        () => {

          selectTone(index);

        }
      );


      buttonContainer.appendChild(button);

    }
  );


  /* -----------------------------------------
     Select first pronunciation item
  ----------------------------------------- */

  selectTone(0);

}


/* =========================================================
   SELECT TONE
========================================================= */

function selectTone(index) {

  if (
    index < 0 ||
    index >= pronunciationData.length
  ) {
    return;
  }


  currentToneIndex = index;

  const item =
    pronunciationData[index];


  /* -----------------------------------------
     Update active button
  ----------------------------------------- */

  document
    .querySelectorAll(".tone-button")
    .forEach((button, buttonIndex) => {

      button.classList.toggle(
        "active",
        buttonIndex === index
      );

    });


  /* -----------------------------------------
     Update character
  ----------------------------------------- */

  const character =
    document.getElementById(
      "toneCharacter"
    );

  if (character) {

    character.textContent =
      item.chinese || "";

  }


  /* -----------------------------------------
     Update pinyin
  ----------------------------------------- */

  const syllable =
    document.getElementById(
      "toneSyllable"
    );

  if (syllable) {

    syllable.textContent =
      item.pinyin || "";

  }


  /* -----------------------------------------
     Update description
  ----------------------------------------- */

  const description =
    document.getElementById(
      "toneDescription"
    );

  if (description) {

    description.textContent =
      item.english || "";

  }


  /* -----------------------------------------
     Update tone graph
  ----------------------------------------- */

  updateToneGraph(item.pinyin);


  /* -----------------------------------------
     Update audio
  ----------------------------------------- */

  const audio =
    document.getElementById(
      "currentToneAudio"
    );

  const audioButton =
    document.getElementById(
      "toneAudioButton"
    );


  if (audio) {

    if (item.audio) {

      audio.src = item.audio;

      audio.load();

    } else {

      audio.removeAttribute("src");

    }

  }


  if (audioButton) {

    audioButton.disabled =
      !item.audio;

    audioButton.innerHTML =
      item.audio
        ? "🔊 Listen"
        : "No audio";

  }

}


/* =========================================================
   TONE GRAPH
========================================================= */

function updateToneGraph(pinyin) {

  const path =
    document.getElementById(
      "tonePath"
    );

  if (!path) {
    return;
  }


  const tone =
    getToneNumber(pinyin);


  /*
    Mandarin tone shapes:

    1 = high and level
    2 = rising
    3 = falling then rising
    4 = falling
    5 = neutral
  */

  const paths = {

    1:
      "M20 25 L480 25",

    2:
      "M20 80 Q250 65 480 20",

    3:
      "M20 30 Q125 90 250 80 Q370 70 480 25",

    4:
      "M20 20 Q250 40 480 90",

    5:
      "M20 55 L480 55"

  };


  path.setAttribute(
    "d",
    paths[tone] || paths[5]
  );

}


/* =========================================================
   GET TONE NUMBER FROM PINYIN
========================================================= */

function getToneNumber(pinyin) {

  if (!pinyin) {
    return 5;
  }


  const text =
    String(pinyin).toLowerCase();


  /*
    Tone marks
  */

  if (
    /[āēīōūǖ]/.test(text)
  ) {
    return 1;
  }


  if (
    /[áéíóúǘ]/.test(text)
  ) {
    return 2;
  }


  if (
    /[ǎěǐǒǔǚ]/.test(text)
  ) {
    return 3;
  }


  if (
    /[àèìòùǜ]/.test(text)
  ) {
    return 4;
  }


  /*
    Tone numbers:
    ma1
    ma2
    ma3
    ma4
  */

  const match =
    text.match(/[1-5]$/);

  if (match) {

    return Number(
      match[0]
    );

  }


  return 5;

}


/* =========================================================
   TONE AUDIO BUTTON
========================================================= */

document.addEventListener(
  "click",
  event => {

    const button =
      event.target.closest(
        "#toneAudioButton"
      );

    if (!button) {
      return;
    }


    const audio =
      document.getElementById(
        "currentToneAudio"
      );

    if (!audio || !audio.src) {
      return;
    }


    audio.currentTime = 0;

    audio.play().catch(error => {

      console.warn(
        "Could not play pronunciation audio:",
        error
      );

    });

  }
);


/* =========================================================
   EVERYDAY CHINESE
========================================================= */

function renderEverydayChinese() {

  const container =
    document.getElementById(
      "everydayChineseDemo"
    );

  if (!container) {
    return;
  }


  if (everydayChineseData.length === 0) {

    container.innerHTML = `
      <div class="loading-card">
        No Everyday Chinese data found.
      </div>
    `;

    return;

  }


  container.innerHTML =
    everydayChineseData
      .map(item => {

        return `

          <div class="language-example-content">

            <div class="example-chinese">
              ${escapeHTML(item.chinese)}
            </div>

            <div class="example-pinyin">
              ${escapeHTML(item.pinyin)}
            </div>

            <div class="example-english">
              ${escapeHTML(item.english)}
            </div>

          </div>

        `;

      })
      .join("");

}


/* =========================================================
   CONVERSATION
========================================================= */

function renderConversation() {

  const container =
    document.getElementById(
      "conversationDemo"
    );

  if (!container) {
    return;
  }


  if (conversationData.length === 0) {

    container.innerHTML = `
      <div class="loading-card">
        No conversation data found.
      </div>
    `;

    return;

  }


  container.innerHTML =
    conversationData
      .map(item => {

        return `

          <div class="dialogue-line">

            <div class="dialogue-chinese">
              ${escapeHTML(item.chinese)}
            </div>

            <div class="dialogue-pinyin">
              ${escapeHTML(item.pinyin)}
            </div>

            <div class="dialogue-english">
              ${escapeHTML(item.english)}
            </div>

          </div>

        `;

      })
      .join("");

}


/* =========================================================
   QUICK CHECK
========================================================= */

function renderQuickCheck() {

  const container =
    document.getElementById(
      "quickCheckDemo"
    );

  if (!container) {
    return;
  }


  if (quickCheckData.length === 0) {

    container.innerHTML = `
      <div class="loading-card">
        No Quick Check questions found.
      </div>
    `;

    return;

  }


  container.innerHTML = "";


  quickCheckData.forEach(
    (item, index) => {

      const question =
        document.createElement("div");

      question.className =
        "quiz-question";


      const questionNumber =
        index + 1;


      const options = [
        item.optionA,
        item.optionB,
        item.optionC,
        item.optionD
      ].filter(
        option =>
          option !== undefined &&
          option !== null &&
          String(option).trim() !== ""
      );


      question.innerHTML = `

        <div class="quiz-question-text">

          <span class="quiz-number">
            ${questionNumber}
          </span>

          <span>
            ${escapeHTML(item.question)}
          </span>

        </div>


        <div class="quiz-options">

          ${options
            .map((option, optionIndex) => {

              const letter =
                String.fromCharCode(
                  65 + optionIndex
                );

              return `

                <button
                  type="button"
                  class="quiz-option"
                  data-question="${index}"
                  data-option="${escapeAttribute(option)}"
                >

                  <span class="quiz-option-letter">
                    ${letter}
                  </span>

                  <span>
                    ${escapeHTML(option)}
                  </span>

                </button>

              `;

            })
            .join("")}

        </div>


        <div
          class="quiz-feedback"
          id="quizFeedback${index}"
          aria-live="polite"
        ></div>

      `;


      container.appendChild(
        question
      );

    }
  );


  setupQuizButtons();

}


/* =========================================================
   QUICK CHECK BUTTONS
========================================================= */

function setupQuizButtons() {

  const buttons =
    document.querySelectorAll(
      ".quiz-option"
    );


  buttons.forEach(button => {

    button.addEventListener(
      "click",
      () => {

        const questionIndex =
          Number(
            button.dataset.question
          );


        const question =
          quickCheckData[
            questionIndex
          ];


        if (!question) {
          return;
        }


        const selected =
          button.dataset.option;


        const correct =
          getCorrectAnswer(question);


        const questionContainer =
          button.closest(
            ".quiz-question"
          );


        const allOptions =
          questionContainer
            ? questionContainer.querySelectorAll(
                ".quiz-option"
              )
            : [];


        /*
          Prevent multiple selections
          after the question is answered.
        */

        allOptions.forEach(
          optionButton => {

            optionButton.disabled =
              true;

          }
        );


        const feedback =
          document.getElementById(
            `quizFeedback${questionIndex}`
          );


        const isCorrect =
          normalize(selected) ===
          normalize(correct);


        if (isCorrect) {

          button.classList.add(
            "correct"
          );


          if (feedback) {

            feedback.textContent =
              "✓ Correct!";

            feedback.className =
              "quiz-feedback correct";

          }

        } else {

          button.classList.add(
            "incorrect"
          );


          /*
            Highlight the correct answer
          */

          allOptions.forEach(
            optionButton => {

              const optionValue =
                optionButton.dataset.option;

              if (
                normalize(optionValue) ===
                normalize(correct)
              ) {

                optionButton.classList.add(
                  "correct"
                );

              }

            }
          );


          if (feedback) {

            feedback.textContent =
              `✗ Not quite. The correct answer is: ${correct}`;

            feedback.className =
              "quiz-feedback incorrect";

          }

        }

      }
    );

  });

}


/* =========================================================
   GET CORRECT ANSWER
========================================================= */

function getCorrectAnswer(question) {

  /*
    Preferred:
    use the Excel "answer" column.
  */

  if (
    question.answer !== undefined &&
    question.answer !== null &&
    String(question.answer).trim() !== ""
  ) {

    return String(
      question.answer
    ).trim();

  }


  /*
    Fallback:

    If the answer column is empty,
    compare against optionD only when
    optionD is explicitly supplied.

    This prevents the JavaScript from
    inventing an answer.
  */

  if (
    question.optionD !== undefined &&
    question.optionD !== null &&
    String(question.optionD).trim() !== ""
  ) {

    return String(
      question.optionD
    ).trim();

  }


  return "";

}


/* =========================================================
   LEARNING HUB
   LOAD LESSONS SHEET
========================================================= */

function renderLessons() {

  const container =
    document.getElementById(
      "lessonGrid"
    );

  if (!container) {
    return;
  }


  if (lessonData.length === 0) {

    container.innerHTML = `
      <div class="loading-card">
        No lessons found.
      </div>
    `;

    return;

  }


  container.innerHTML = "";


  lessonData.forEach(
    lesson => {

      const card =
        document.createElement(
          "article"
        );

      card.className =
        "lesson-card";


      card.innerHTML = `

        <div class="lesson-poster">

          ${
            lesson.poster
              ? `
                <img
                  src="${escapeAttribute(
                    lesson.poster
                  )}"
                  alt="${escapeAttribute(
                    lesson.title || "Lesson"
                  )}"
                >
              `
              : `
                <div class="lesson-poster-placeholder">
                  文
                </div>
              `
          }

        </div>


        <div class="lesson-card-content">

          <span class="lesson-level">
            ${escapeHTML(
              lesson.level || ""
            )}
          </span>


          <h3>
            ${escapeHTML(
              lesson.title || ""
            )}
          </h3>


          ${
            lesson.chineseTitle
              ? `
                <div class="lesson-chinese-title">
                  ${escapeHTML(
                    lesson.chineseTitle
                  )}
                </div>
              `
              : ""
          }


          ${
            lesson.pinyin
              ? `
                <div class="lesson-pinyin">
                  ${escapeHTML(
                    lesson.pinyin
                  )}
                </div>
              `
              : ""
          }


          ${
            lesson.meaning
              ? `
                <div class="lesson-meaning">
                  ${escapeHTML(
                    lesson.meaning
                  )}
                </div>
              `
              : ""
          }


          ${
            lesson.description
              ? `
                <p>
                  ${escapeHTML(
                    lesson.description
                  )}
                </p>
              `
              : ""
          }


          <div class="lesson-card-actions">

            <a
              href="story.html?id=${encodeURIComponent(
                lesson.id || ""
              )}"
              class="primary-button"
            >
              Open Lesson
            </a>

          </div>

        </div>

      `;


      container.appendChild(
        card
      );

    }
  );

}


/* =========================================================
   MOBILE MENU
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


  button.addEventListener(
    "click",
    () => {

      const isOpen =
        menu.classList.toggle(
          "open"
        );


      button.setAttribute(
        "aria-expanded",
        String(isOpen)
      );


      button.setAttribute(
        "aria-label",
        isOpen
          ? "Close navigation"
          : "Open navigation"
      );

    }
  );


  menu
    .querySelectorAll("a")
    .forEach(link => {

      link.addEventListener(
        "click",
        () => {

          menu.classList.remove(
            "open"
          );

          button.setAttribute(
            "aria-expanded",
            "false"
          );

          button.setAttribute(
            "aria-label",
            "Open navigation"
          );

        }
      );

    });

}


/* =========================================================
   SPEECH BUTTONS
========================================================= */

function setupSpeechButtons() {

  document.addEventListener(
    "click",
    event => {

      const button =
        event.target.closest(
          ".speech-button"
        );


      if (!button) {
        return;
      }


      const text =
        button.dataset.text;


      if (!text) {
        return;
      }


      speakText(text);

    }
  );

}


/* =========================================================
   BROWSER TEXT-TO-SPEECH
========================================================= */

function speakText(text) {

  if (
    !("speechSynthesis" in window)
  ) {

    console.warn(
      "Speech synthesis is not supported by this browser."
    );

    return;

  }


  window.speechSynthesis.cancel();


  const utterance =
    new SpeechSynthesisUtterance(
      text
    );


  utterance.lang =
    "zh-CN";


  utterance.rate =
    0.85;


  utterance.pitch =
    1;


  window.speechSynthesis.speak(
    utterance
  );

}


/* =========================================================
   LOADING STATE
========================================================= */

function showLoadingState() {

  const containers = [

    "toneButtons",
    "everydayChineseDemo",
    "conversationDemo",
    "quickCheckDemo",
    "lessonGrid"

  ];


  containers.forEach(id => {

    const element =
      document.getElementById(id);

    if (!element) {
      return;
    }


    if (
      !element.innerHTML.trim()
    ) {

      element.innerHTML = `
        <div class="loading-card">
          Loading...
        </div>
      `;

    }

  });

}


/* =========================================================
   GLOBAL ERROR
========================================================= */

function showGlobalError() {

  const message = `
    <div class="loading-card">
      <strong>Unable to load lesson data.</strong>
      <br>
      Please make sure
      <code>data/lessons.xlsx</code>
      exists and that the page is being opened
      through a local web server.
    </div>
  `;


  const containers = [

    "toneButtons",
    "everydayChineseDemo",
    "conversationDemo",
    "quickCheckDemo",
    "lessonGrid"

  ];


  containers.forEach(id => {

    const element =
      document.getElementById(id);

    if (element) {

      element.innerHTML =
        message;

    }

  });

}


/* =========================================================
   HELPERS
========================================================= */

function normalize(value) {

  return String(
    value ?? ""
  )
    .trim()
    .toLowerCase();

}


function sortByOrder(a, b) {

  return (
    Number(a.order || 0) -
    Number(b.order || 0)
  );

}


/* =========================================================
   HTML ESCAPING
   Prevents Excel content from being interpreted
   as HTML.
========================================================= */

function escapeHTML(value) {

  return String(
    value ?? ""
  )
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


function escapeAttribute(value) {

  return escapeHTML(
    value
  );

}
