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

  return rows.filter(
    row => {

      const rowLessonId =
        getValue(
          row,
          "lessonId",
          "LessonId",
          "Lesson ID",
          "lessonID",
          "id"
        );

      return String(
        rowLessonId
      ).trim() === String(
        lessonId
      ).trim();

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

      videoElement.poster =
        poster;

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


        return `

          <article class="story-image-card">

            <img
              src="${escapeHTML(image)}"
              alt="${escapeHTML(
                english || chinese || `Story scene ${index + 1}`
              )}"
              loading="lazy"
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
   LOAD STORY DATA
   ========================================================= */

async function loadStoryLesson() {

  const lessonId =
    getLessonId();


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
      await fetch(
        EXCEL_FILE
      );


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


    const lessons =
      readSheet(
        workbook,
        "Lessons"
      );


    const storyRows =
      sortByOrder(
        filterByLesson(
          readSheet(
            workbook,
            "Story"
          ),
          lessonId
        )
      );


    const vocabularyRows =
      sortByOrder(
        filterByLesson(
          readSheet(
            workbook,
            "Vocabulary"
          ),
          lessonId
        )
      );


    const exerciseRows =
      sortByOrder(
        filterByLesson(
          readSheet(
            workbook,
            "Exercises"
          ),
          lessonId
        )
      );


    const lesson =
      lessons.find(
        row => {

          const id =
            getValue(
              row,
              "id",
              "ID",
              "lessonId"
            );

          return String(id).trim() ===
            String(lessonId).trim();

        }
      );


    if (!lesson) {

      throw new Error(
        `Lesson "${lessonId}" was not found in the Lessons sheet.`
      );

    }


    renderLessonHeader(
      lesson
    );


    renderVideo(
      lesson
    );


    renderStoryImages(
      storyRows
    );


    renderStoryReading(
      storyRows
    );


    renderVocabulary(
      vocabularyRows
    );


    renderExercises(
      exerciseRows
    );


    updateLessonNavigation(
      storyRows,
      vocabularyRows,
      exerciseRows
    );


    console.log(
      "Story lesson loaded:",
      {
        lessonId,
        lesson,
        story: storyRows,
        vocabulary: vocabularyRows,
        exercises: exerciseRows
      }
    );


  } catch (error) {

    console.error(
      "Story lesson loading error:",
      error
    );


    showPageError(
      error
    );

  }

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

    document.getElementById(
      "storyContent"
    ),

    document.getElementById(
      "vocabularyContent"
    ),

    document.getElementById(
      "exerciseContent"
    )

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