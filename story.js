(function () {

  "use strict";


  /* =========================================================
     CONFIGURATION
     ========================================================= */

  const EXCEL_FILE = "data/lessons.xlsx";


  /* =========================================================
     GET LESSON ID FROM URL
     
     Example:
     story.html?id=lesson-01
     ========================================================= */

  const params = new URLSearchParams(
    window.location.search
  );

  const lessonId =
    params.get("id") || "lesson-01";


  /* =========================================================
     HELPERS
     ========================================================= */

  function escapeHTML(value) {

    if (value === null || value === undefined) {
      return "";
    }

    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }


  function getValue(row, names) {

    for (const name of names) {

      if (
        row[name] !== undefined &&
        row[name] !== null &&
        String(row[name]).trim() !== ""
      ) {

        return String(row[name]).trim();

      }

    }

    return "";

  }


  function filterByLesson(rows) {

    return rows.filter(row => {

      const id = getValue(row, [
        "lessonId",
        "LessonId",
        "lesson_id",
        "Lesson ID",
        "ID"
      ]);

      return String(id).trim() === String(lessonId).trim();

    });

  }


  function sortByOrder(rows) {

    return [...rows].sort((a, b) => {

      const orderA = Number(
        getValue(a, ["order", "Order", "number", "Number"])
      ) || 0;

      const orderB = Number(
        getValue(b, ["order", "Order", "number", "Number"])
      ) || 0;

      return orderA - orderB;

    });

  }


  /* =========================================================
     LOAD EXCEL
     ========================================================= */

  async function loadStoryData() {

    try {

      console.log(
        "Loading lesson:",
        lessonId
      );

      console.log(
        "Excel file:",
        EXCEL_FILE
      );


      /* Make sure SheetJS exists */

      if (typeof XLSX === "undefined") {

        throw new Error(
          "SheetJS has not loaded. Check the XLSX script in story.html."
        );

      }


      /* Fetch Excel */

      const response =
        await fetch(
          EXCEL_FILE,
          {
            cache: "no-store"
          }
        );


      if (!response.ok) {

        throw new Error(
          `Cannot load ${EXCEL_FILE}. HTTP ${response.status}`
        );

      }


      const buffer =
        await response.arrayBuffer();


      if (!buffer.byteLength) {

        throw new Error(
          "lessons.xlsx is empty."
        );

      }


      /* Read workbook */

      const workbook =
        XLSX.read(
          buffer,
          {
            type: "array"
          }
        );


      console.log(
        "Excel sheets:",
        workbook.SheetNames
      );


      /* =====================================================
         READ SHEETS
         ===================================================== */

      const lessons =
        readSheet(
          workbook,
          "Lessons"
        );

      const story =
        readSheet(
          workbook,
          "Story"
        );

      const vocabulary =
        readSheet(
          workbook,
          "Vocabulary"
        );

      const exercises =
        readSheet(
          workbook,
          "Exercises"
        );


      console.log(
        "Lessons:",
        lessons
      );

      console.log(
        "Story:",
        story
      );

      console.log(
        "Vocabulary:",
        vocabulary
      );

      console.log(
        "Exercises:",
        exercises
      );


      /* =====================================================
         FIND CURRENT LESSON
         ===================================================== */

      const lesson =
        lessons.find(row => {

          const id =
            getValue(row, [
              "id",
              "ID",
              "lessonId",
              "LessonId",
              "lesson_id"
            ]);

          return String(id).trim() ===
            String(lessonId).trim();

        });


      if (!lesson) {

        throw new Error(
          `Lesson "${lessonId}" was not found in the Lessons sheet.`
        );

      }


      /* =====================================================
         FILTER CURRENT LESSON DATA
         ===================================================== */

      const lessonStory =
        sortByOrder(
          filterByLesson(story)
        );


      const lessonVocabulary =
        sortByOrder(
          filterByLesson(vocabulary)
        );


      const lessonExercises =
        sortByOrder(
          filterByLesson(exercises)
        );


      console.log(
        "Current lesson:",
        lesson
      );

      console.log(
        "Current story:",
        lessonStory
      );

      console.log(
        "Current vocabulary:",
        lessonVocabulary
      );

      console.log(
        "Current exercises:",
        lessonExercises
      );


      /* =====================================================
         RENDER EVERYTHING
         ===================================================== */

      renderLessonHeader(
        lesson
      );

      renderVideo(
        lesson
      );

      renderStoryImages(
        lessonStory
      );

      renderStoryReading(
        lessonStory
      );

      renderVocabulary(
        lessonVocabulary
      );

      renderExercises(
        lessonExercises
      );


      console.log(
        "✓ Story lesson rendered successfully."
      );

    }
    catch (error) {

      console.error(
        "Story loading error:",
        error
      );

      showError(
        error.message
      );

    }

  }


  /* =========================================================
     READ EXCEL SHEET
     ========================================================= */

  function readSheet(
    workbook,
    sheetName
  ) {

    const sheet =
      workbook.Sheets[sheetName];


    if (!sheet) {

      console.warn(
        `Sheet "${sheetName}" does not exist.`
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
     SECTION 01
     LESSON HEADER
     ========================================================= */

  function renderLessonHeader(
    lesson
  ) {

    const title =
      getValue(
        lesson,
        [
          "title",
          "Title"
        ]
      );

    const chineseTitle =
      getValue(
        lesson,
        [
          "chineseTitle",
          "ChineseTitle",
          "chinese_title",
          "Chinese Title"
        ]
      );

    const pinyin =
      getValue(
        lesson,
        [
          "pinyin",
          "Pinyin"
        ]
      );

    const meaning =
      getValue(
        lesson,
        [
          "meaning",
          "Meaning"
        ]
      );


    const storyTitle =
      document.getElementById(
        "storyTitle"
      );

    const storyPinyin =
      document.getElementById(
        "storyPinyin"
      );

    const storyMeaning =
      document.getElementById(
        "storyMeaning"
      );


    if (storyTitle) {

      storyTitle.textContent =
        chineseTitle ||
        title ||
        "Chinese Story";

    }


    if (storyPinyin) {

      storyPinyin.textContent =
        pinyin;

    }


    if (storyMeaning) {

      storyMeaning.textContent =
        meaning ||
        title;

    }


    document.title =
      `LinguaPath | ${
        chineseTitle ||
        title ||
        "Chinese Story"
      }`;

  }


  /* =========================================================
     SECTION 01
     VIDEO
     ========================================================= */

  function renderVideo(
    lesson
  ) {

    const video =
      document.getElementById(
        "lessonVideo"
      );

    const description =
      document.getElementById(
        "storyDescription"
      );

    const videoTitle =
      document.getElementById(
        "videoTitle"
      );


    const videoFile =
      getValue(
        lesson,
        [
          "video",
          "Video",
          "videoUrl",
          "VideoUrl",
          "video_url"
        ]
      );


    const poster =
      getValue(
        lesson,
        [
          "poster",
          "Poster",
          "image",
          "Image"
        ]
      );


    const lessonDescription =
      getValue(
        lesson,
        [
          "description",
          "Description"
        ]
      );


    if (video) {

      if (videoFile) {

        video.src =
          videoFile;

      }


      if (poster) {

        video.poster =
          poster;

      }

      video.load();

    }


    if (description && lessonDescription) {

      description.textContent =
        lessonDescription;

    }


    if (videoTitle) {

      videoTitle.textContent =
        getValue(
          lesson,
          [
            "chineseTitle",
            "ChineseTitle",
            "title",
            "Title"
          ]
        ) ||
        "Chinese Story";

    }

  }


  /* =========================================================
     SECTION 02
     STORY IMAGES
     ========================================================= */

  function renderStoryImages(
    rows
  ) {

    const container =
      document.getElementById(
        "storyImageGrid"
      );


    if (!container) {
      return;
    }


    if (!rows.length) {

      container.innerHTML = `
        <p>No story images found for this lesson.</p>
      `;

      return;

    }


    container.innerHTML =
      rows.map(
        (row, index) => {

          const image =
            getValue(
              row,
              [
                "image",
                "Image",
                "imageUrl",
                "ImageUrl",
                "image_url"
              ]
            );


          const chinese =
            getValue(
              row,
              [
                "chinese",
                "Chinese",
                "character",
                "Character"
              ]
            );


          const pinyin =
            getValue(
              row,
              [
                "pinyin",
                "Pinyin"
              ]
            );


          const english =
            getValue(
              row,
              [
                "english",
                "English",
                "meaning",
                "Meaning"
              ]
            );


          const number =
            String(index + 1)
              .padStart(2, "0");


          return `

            <article class="story-image-card">

              ${
                image
                  ? `
                    <img
                      src="${escapeHTML(image)}"
                      alt="${escapeHTML(
                        english || chinese
                      )}"
                      loading="lazy"
                    >
                  `
                  : `
                    <div
                      style="
                        min-height:220px;
                        display:flex;
                        align-items:center;
                        justify-content:center;
                        background:#f1f0ff;
                        font-size:4rem;
                      "
                    >
                      ${escapeHTML(chinese)}
                    </div>
                  `
              }

              <div class="story-image-content">

                <span class="image-number">
                  ${number}
                </span>

                <h3>
                  ${escapeHTML(chinese)}
                </h3>

                <p>
                  ${escapeHTML(pinyin)}
                </p>

                <span>
                  ${escapeHTML(english)}
                </span>

              </div>

            </article>

          `;

        }
      ).join("");

  }


  /* =========================================================
     SECTION 03
     STORY READING
     ========================================================= */

  function renderStoryReading(
    rows
  ) {

    const container =
      document.getElementById(
        "storyContent"
      );


    if (!container) {
      return;
    }


    if (!rows.length) {

      container.innerHTML = `
        <p>No story sentences found for this lesson.</p>
      `;

      return;

    }


    container.innerHTML =
      rows.map(
        (row, index) => {

          const chinese =
            getValue(
              row,
              [
                "chinese",
                "Chinese",
                "sentence",
                "Sentence"
              ]
            );


          const pinyin =
            getValue(
              row,
              [
                "pinyin",
                "Pinyin"
              ]
            );


          const english =
            getValue(
              row,
              [
                "english",
                "English",
                "meaning",
                "Meaning"
              ]
            );


          const audio =
            getValue(
              row,
              [
                "audio",
                "Audio",
                "audioUrl",
                "AudioUrl",
                "audio_url"
              ]
            );


          const number =
            String(index + 1)
              .padStart(2, "0");


          return `

            <article class="reading-line">

              <div class="reading-number">
                ${number}
              </div>


              <div class="reading-text">

                <div class="chinese-sentence">
                  ${escapeHTML(chinese)}
                </div>

                <div class="pinyin-sentence">
                  ${escapeHTML(pinyin)}
                </div>

                <div class="english-sentence">
                  ${escapeHTML(english)}
                </div>

              </div>


              ${
                audio
                  ? `
                    <button
                      class="reading-audio"
                      data-audio="${escapeHTML(audio)}"
                      data-text="${escapeHTML(chinese)}"
                      aria-label="Play sentence"
                    >
                      🔊
                    </button>
                  `
                  : `
                    <button
                      class="reading-audio"
                      data-text="${escapeHTML(chinese)}"
                      aria-label="Play sentence"
                    >
                      🔊
                    </button>
                  `
              }

            </article>

          `;

        }
      ).join("");


    attachAudioButtons();

  }


  /* =========================================================
     SECTION 04
     VOCABULARY
     ========================================================= */

  function renderVocabulary(
    rows
  ) {

    const container =
      document.getElementById(
        "vocabularyContent"
      );


    if (!container) {
      return;
    }


    if (!rows.length) {

      container.innerHTML = `
        <p>No vocabulary found for this lesson.</p>
      `;

      return;

    }


    container.innerHTML =
      rows.map(
        row => {

          const character =
            getValue(
              row,
              [
                "character",
                "Character",
                "chinese",
                "Chinese"
              ]
            );


          const pinyin =
            getValue(
              row,
              [
                "pinyin",
                "Pinyin"
              ]
            );


          const meaning =
            getValue(
              row,
              [
                "meaning",
                "Meaning",
                "english",
                "English"
              ]
            );


          const audio =
            getValue(
              row,
              [
                "audio",
                "Audio",
                "audioUrl",
                "AudioUrl",
                "audio_url"
              ]
            );


          return `

            <article class="vocabulary-card">

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
                class="vocabulary-audio"
                data-audio="${escapeHTML(audio)}"
                data-text="${escapeHTML(character)}"
              >
                🔊 Listen
              </button>

            </article>

          `;

        }
      ).join("");


    attachAudioButtons();

  }


  /* =========================================================
     SECTION 05
     EXERCISES
     ========================================================= */

  function renderExercises(
    rows
  ) {

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
          05 · Check Your Understanding
        </span>

        <h2>
          No exercise available.
        </h2>

        <p>
          Add an exercise for this lesson in the Exercises sheet.
        </p>

      `;

      return;

    }


    let html = `

      <span class="section-label">
        05 · Check Your Understanding
      </span>

    `;


    rows.forEach(
      (row, index) => {

        const type =
          getValue(
            row,
            [
              "type",
              "Type"
            ]
          ).toLowerCase();


        const question =
          getValue(
            row,
            [
              "question",
              "Question"
            ]
          );


        const options = [

          getValue(
            row,
            [
              "optionA",
              "OptionA",
              "option_a",
              "A"
            ]
          ),

          getValue(
            row,
            [
              "optionB",
              "OptionB",
              "option_b",
              "B"
            ]
          ),

          getValue(
            row,
            [
              "optionC",
              "OptionC",
              "option_c",
              "C"
            ]
          ),

          getValue(
            row,
            [
              "optionD",
              "OptionD",
              "option_d",
              "D"
            ]
          )

        ].filter(Boolean);


        const answer =
          getValue(
            row,
            [
              "answer",
              "Answer",
              "correctAnswer",
              "CorrectAnswer"
            ]
          );


        html += `

          <div
            class="story-exercise"
            data-answer="${escapeHTML(answer)}"
          >

            <h2>
              ${escapeHTML(question)}
            </h2>

            <p>
              Read the story again if you need help.
            </p>

            <div class="story-quiz-options">

        `;


        options.forEach(
          option => {

            html += `

              <button
                class="story-quiz-option"
                data-answer="${escapeHTML(option)}"
              >
                ${escapeHTML(option)}
              </button>

            `;

          }
        );


        html += `

            </div>

            <div
              class="story-quiz-feedback"
              aria-live="polite"
            ></div>

          </div>

        `;

      }
    );


    container.innerHTML =
      html;


    attachExerciseButtons();

  }


  /* =========================================================
     AUDIO
     ========================================================= */

  function playAudio(
    audioFile,
    text
  ) {

    /* Use actual audio file when available */

    if (audioFile) {

      const audio =
        new Audio(audioFile);

      audio.play()
        .catch(
          error => {

            console.warn(
              "Audio file could not be played:",
              error
            );

            speakChinese(text);

          }
        );

      return;

    }


    /* Otherwise use browser speech */

    speakChinese(text);

  }


  function speakChinese(
    text
  ) {

    if (
      !text ||
      !("speechSynthesis" in window)
    ) {
      return;
    }


    window.speechSynthesis.cancel();


    const utterance =
      new SpeechSynthesisUtterance(
        text
      );


    const voices =
      window.speechSynthesis
        .getVoices();


    const chineseVoice =
      voices.find(
        voice =>
          voice.lang
            .toLowerCase()
            .startsWith("zh")
      );


    if (chineseVoice) {

      utterance.voice =
        chineseVoice;

    }


    utterance.lang =
      "zh-CN";

    utterance.rate =
      0.75;

    utterance.pitch =
      1;


    window.speechSynthesis.speak(
      utterance
    );

  }


  function attachAudioButtons() {

    document
      .querySelectorAll(
        ".reading-audio, .vocabulary-audio"
      )
      .forEach(
        button => {

          button.addEventListener(
            "click",
            () => {

              playAudio(
                button.dataset.audio,
                button.dataset.text
              );

            }
          );

        }
      );

  }


  /* =========================================================
     EXERCISE BUTTONS
     ========================================================= */

  function attachExerciseButtons() {

    document
      .querySelectorAll(
        ".story-exercise"
      )
      .forEach(
        exercise => {

          const answer =
            exercise.dataset.answer
              .trim()
              .toLowerCase();


          const feedback =
            exercise.querySelector(
              ".story-quiz-feedback"
            );


          const options =
            exercise.querySelectorAll(
              ".story-quiz-option"
            );


          options.forEach(
            option => {

              option.addEventListener(
                "click",
                () => {

                  options.forEach(
                    item => {

                      item.classList.remove(
                        "correct",
                        "wrong"
                      );

                    }
                  );


                  const selected =
                    option.dataset.answer
                      .trim()
                      .toLowerCase();


                  if (
                    selected === answer
                  ) {

                    option.classList.add(
                      "correct"
                    );


                    feedback.innerHTML =
                      "✓ <strong>Correct!</strong>";

                  }
                  else {

                    option.classList.add(
                      "wrong"
                    );


                    feedback.innerHTML =
                      "✕ <strong>Not quite.</strong> Try again.";

                  }

                }
              );

            }
          );

        }
      );

  }


  /* =========================================================
     ERROR
     ========================================================= */

  function showError(
    message
  ) {

    const containers = [

      "storyImageGrid",
      "storyContent",
      "vocabularyContent"

    ];


    containers.forEach(
      id => {

        const element =
          document.getElementById(id);


        if (element) {

          element.innerHTML = `

            <div
              style="
                padding:20px;
                background:#fff1f1;
                color:#8b1e1e;
                border:1px solid #e5aaaa;
                border-radius:12px;
              "
            >

              <strong>
                Lesson data could not be loaded.
              </strong>

              <p>
                ${escapeHTML(message)}
              </p>

            </div>

          `;

        }

      }
    );

  }


  /* =========================================================
     START
     ========================================================= */

  function start() {

    loadStoryData();

  }


  if (
    document.readyState ===
    "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      start
    );

  }
  else {

    start();

  }


})();