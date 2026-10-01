
/* =========================================================
   LINGUAPATH
   Main JavaScript
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


/* =========================================================
   DOM READY
========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  setupMobileMenu();
  setupSearchAndFilter();
  setupDemoCardsClick();
  setupCompletionModalListeners();
  updateHeaderStreakUI();
  setupStreakBadgeInteractions();
  loadWorkbook();
});


/* =========================================================
   LOAD EXCEL WORKBOOK & LESSON DATA
========================================================= */

async function loadWorkbook() {
  let loaded = false;

  // Strategy 1: Direct Excel parsing if SheetJS (XLSX) is present
  if (typeof XLSX !== "undefined") {
    try {
      const response = await fetch("data/lessons.xlsx");

      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();

        workbook = XLSX.read(arrayBuffer, {
          type: "array"
        });

        if (workbook && workbook.SheetNames) {
          if (workbook.SheetNames.includes("Demo")) {
            demoData = XLSX.utils.sheet_to_json(
              workbook.Sheets["Demo"],
              { defval: "" }
            );
          }

          if (workbook.SheetNames.includes("Lessons")) {
            lessonData = XLSX.utils.sheet_to_json(
              workbook.Sheets["Lessons"],
              { defval: "" }
            );
          }

          if (demoData.length > 0 || lessonData.length > 0) {
            loaded = true;
          }
        }
      }
    } catch (excelError) {
      console.warn("Client-side Excel parsing note:", excelError);
    }
  }

  // Strategy 2: Server API endpoint /api/lessons-data (parsed from data/lessons.xlsx)
  if (!loaded) {
    try {
      const apiResponse = await fetch("/api/lessons-data");

      if (apiResponse.ok) {
        const apiData = await apiResponse.json();

        if (apiData.success && apiData.sheets) {
          demoData = apiData.sheets["Demo"] || [];
          lessonData = apiData.sheets["Lessons"] || [];

          if (demoData.length > 0 || lessonData.length > 0) {
            loaded = true;
          }
        }
      }
    } catch (apiError) {
      console.warn("Server API fallback note:", apiError);
    }
  }

  // Strategy 3: Static JSON file data/lessons.json
  if (!loaded) {
    try {
      const jsonResponse = await fetch("data/lessons.json");

      if (jsonResponse.ok) {
        const jsonData = await jsonResponse.json();

        if (jsonData.sheets) {
          demoData = jsonData.sheets["Demo"] || [];
          lessonData = jsonData.sheets["Lessons"] || [];

          if (demoData.length > 0 || lessonData.length > 0) {
            loaded = true;
          }
        }
      }
    } catch (jsonError) {
      console.warn("Static JSON fallback note:", jsonError);
    }
  }

  // Strategy 4: Embedded fallback data matching data/lessons.xlsx
  if (!loaded) {
    console.info("Using embedded lesson dataset.");
    demoData = getFallbackDemoData();
    lessonData = getFallbackLessonData();
    loaded = true;
  }

  if (loaded) {
    /*
      Prepare Demo sections
    */
    prepareDemoData();

    /*
      Render the page
    */
    renderPronunciation();
    renderEverydayChinese();
    renderConversation();
    renderQuickCheck();
    renderLearningHub();
  } else {
    showWorkbookError();
  }
}

/* =========================================================
   FALLBACK DATASETS (mirrors data/lessons.xlsx)
========================================================= */

function getFallbackDemoData() {
  return [
    {
      section: "Pronunciation",
      order: 1,
      chinese: "妈",
      pinyin: "mā",
      english: "mother",
      audio: "assets/audio/tones/ma-tone-1.mp3"
    },
    {
      section: "Pronunciation",
      order: 2,
      chinese: "麻",
      pinyin: "má",
      english: "hemp; numb",
      audio: "assets/audio/tones/ma-tone-2.mp3"
    },
    {
      section: "Pronunciation",
      order: 3,
      chinese: "马",
      pinyin: "mǎ",
      english: "horse",
      audio: "assets/audio/tones/ma-tone-3.mp3"
    },
    {
      section: "Pronunciation",
      order: 4,
      chinese: "骂",
      pinyin: "mà",
      english: "scold",
      audio: "assets/audio/tones/ma-tone-4.mp3"
    },
    {
      section: "Pronunciation",
      order: 5,
      chinese: "吗",
      pinyin: "ma",
      english: "question particle",
      audio: "assets/audio/tones/ma-tone-5.mp3"
    },
    {
      section: "Everyday Chinese",
      order: 1,
      chinese: "你好",
      pinyin: "Nǐ hǎo",
      english: "Hello",
      audio: "assets/audio/hello.mp3"
    },
    {
      section: "Conversation",
      order: 1,
      chinese: "你好！你好吗？",
      pinyin: "Nǐ hǎo! Nǐ hǎo ma?",
      english: "Hello! How are you?",
      audio: "assets/audio/nihao-conversation.mp3"
    },
    {
      section: "Conversation",
      order: 2,
      chinese: "早上好 !",
      pinyin: "Zǎo Shang hǎo!",
      english: "Good Morning !",
      audio: "assets/audio/morning-conversation.mp3"
    },
    {
      section: "Quick Check",
      order: 1,
      question: "How do you say “Hello” in Chinese?",
      optionA: "你好",
      optionB: "谢谢",
      optionC: "再见",
      answer: "你好"
    },
    {
      section: "Quick Check",
      order: 2,
      question: "What does “你好吗？” mean?",
      optionA: "What's your name?",
      optionB: "How are you?",
      optionC: "Where are you?",
      answer: "How are you?"
    }
  ];
}

function getFallbackLessonData() {
  return [
    {
      id: "lesson-01",
      title: "Xiaoming's Day",
      chineseTitle: "小明的一天",
      pinyin: "Xiǎomíng de yì tiān",
      meaning: "Xiaoming's Day",
      level: "Beginner",
      description: "Learn Chinese through a simple story.",
      video: "assets/video/lesson-01.mp4",
      poster: "assets/images/story-poster.jpg",
      keywords: "morning, routine, breakfast, school, happy, day, get up, early, 早上, 起床, 学校, 早饭, 开心"
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
      poster: "assets/images/story2-poster.jpg",
      keywords: "fruit, market, apple, shopping, fresh, sweet, delicious, red, buy, 水果, 市场, 苹果, 买, 甜, 好吃"
    }
  ];
}


/* =========================================================
   PREPARE DEMO DATA
========================================================= */

function prepareDemoData() {

  pronunciationData = getDemoSection(
    "Pronunciation"
  );

  everydayChineseData = getDemoSection(
    "Everyday Chinese"
  );

  conversationData = getDemoSection(
    "Conversation"
  );

  quickCheckData = getDemoSection(
    "Quick Check"
  );
}


/* =========================================================
   GET DEMO SECTION
========================================================= */

function getDemoSection(sectionName) {

  return demoData
    .filter(row => {
      return normalizeText(row.section) ===
        normalizeText(sectionName);
    })
    .sort((a, b) => {
      return Number(a.order || 0) -
        Number(b.order || 0);
    });
}


/* =========================================================
   PRONUNCIATION
========================================================= */

function renderPronunciation() {

  const toneButtons =
    document.getElementById("toneButtons");

  const toneSyllable =
    document.getElementById("toneSyllable");

  const toneCharacter =
    document.getElementById("toneCharacter");

  const toneDescription =
    document.getElementById("toneDescription");

  const toneAudioButton =
    document.getElementById("toneAudioButton");

  const currentToneAudio =
    document.getElementById("currentToneAudio");


  if (!toneButtons) {
    return;
  }


  toneButtons.innerHTML = "";


  if (!pronunciationData.length) {

    toneButtons.innerHTML = `
      <p class="loading-message">
        No pronunciation data found.
      </p>
    `;

    return;
  }


  pronunciationData.forEach((row, index) => {

    const button =
      document.createElement("button");

    button.type = "button";

    button.className = "tone-button";

    button.textContent =
      row.pinyin ||
      row.chinese ||
      `Tone ${index + 1}`;

    button.addEventListener(
      "click",
      () => {
        selectTone(index, true);
      }
    );

    toneButtons.appendChild(button);
  });


  /*
    Select first tone automatically (without auto-playing on page load)
  */
  selectTone(0, false);


  /*
    Play selected tone
  */
  if (toneAudioButton) {

    toneAudioButton.addEventListener(
      "click",
      () => {

        const row =
          pronunciationData[currentToneIndex];

        if (!row) {
          return;
        }

        playExcelAudio(
          row.audio,
          toneAudioButton,
          "▶ Play",
          "⏸ Playing...",
          row.chinese
        );

      }
    );

  }


  /*
    Keep references available
  */
  window.currentToneAudio =
    currentToneAudio;
}


/* =========================================================
   SELECT TONE
========================================================= */

function selectTone(index, shouldPlay = false) {

  if (
    index < 0 ||
    index >= pronunciationData.length
  ) {
    return;
  }


  currentToneIndex = index;

  const row =
    pronunciationData[index];


  const toneSyllable =
    document.getElementById("toneSyllable");

  const toneCharacter =
    document.getElementById("toneCharacter");

  const toneDescription =
    document.getElementById("toneDescription");


  /*
    Update buttons
  */
  const buttons =
    document.querySelectorAll(
      "#toneButtons .tone-button"
    );

  buttons.forEach((button, buttonIndex) => {

    button.classList.toggle(
      "active",
      buttonIndex === index
    );

  });


  /*
    Update text
  */
  if (toneSyllable) {

    toneSyllable.textContent =
      row.pinyin ||
      "";

  }


  if (toneCharacter) {
    toneCharacter.textContent =
      row.chinese ||
      "";
  }

  const toneTranslation =
    document.getElementById("toneTranslation");

  if (toneTranslation) {
    toneTranslation.textContent =
      row.english ? `(${row.english})` : "";
  }

  if (toneDescription) {
    const toneGuides = [
      "1st Tone: High & flat pitch contour",
      "2nd Tone: Rising pitch like asking a question",
      "3rd Tone: Dipping pitch that drops then rises",
      "4th Tone: Falling pitch like giving a command",
      "Neutral Tone: Light and short de-emphasized pitch"
    ];
    toneDescription.textContent =
      toneGuides[index] || "Select a tone to hear the pronunciation.";
  }


  /*
    Update tone graph
  */
  updateToneGraph(index);

  /*
    Play sound if user explicitly clicked tone button
  */
  if (shouldPlay && row) {
    const toneAudioButton =
      document.getElementById("toneAudioButton");

    playExcelAudio(
      row.audio,
      toneAudioButton,
      "▶ Play",
      "⏸ Playing...",
      row.chinese
    );
  }

}


/* =========================================================
   TONE GRAPH
========================================================= */

function updateToneGraph(index) {

  const tonePath =
    document.getElementById("tonePath");

  if (!tonePath) {
    return;
  }


  /*
    Standard Mandarin tone shapes.

    1 = high level
    2 = rising
    3 = dipping
    4 = falling
    5 = neutral
  */

  const tonePaths = [

    "M10 28 L290 28",

    "M10 72 Q150 72 290 25",

    "M10 35 Q85 85 150 78 Q220 72 290 30",

    "M10 25 Q150 25 290 80",

    "M10 52 L290 52"

  ];


  tonePath.setAttribute(
    "d",
    tonePaths[index] ||
    tonePaths[4]
  );
}


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


  container.innerHTML = "";


  if (!everydayChineseData.length) {

    container.innerHTML = `
      <div class="loading-message">
        No Everyday Chinese data found.
      </div>
    `;

    return;
  }


  /*
    Usually the first row represents
    the Everyday Chinese demo.
  */

  const row =
    everydayChineseData[0];


  const wrapper =
    document.createElement("div");

  wrapper.className =
    "everyday-demo-content";


  /*
    Chinese
  */

  const chinese =
    document.createElement("div");

  chinese.className =
    "demo-word";

  chinese.textContent =
    row.chinese || "";


  /*
    Pinyin
  */

  const pinyin =
    document.createElement("div");

  pinyin.className =
    "demo-pinyin";

  pinyin.textContent =
    row.pinyin || "";


  /*
    English
  */

  const english =
    document.createElement("div");

  english.className =
    "demo-english";

  english.textContent =
    row.english || "";


  wrapper.appendChild(chinese);

  wrapper.appendChild(pinyin);

  wrapper.appendChild(english);


  /*
    Audio button

    IMPORTANT:
    The audio path comes from the
    Excel "audio" column.
  */

  if (hasAudio(row.audio)) {

    const audioButton =
      document.createElement("button");

    audioButton.type = "button";

    audioButton.className =
      "audio-button demo-audio-button";

    audioButton.textContent =
      "▶ Play";


    audioButton.addEventListener(
      "click",
      () => {

        playExcelAudio(
          row.audio,
          audioButton,
          "▶ Play",
          "⏸ Playing...",
          row.chinese
        );

      }
    );


    wrapper.appendChild(
      audioButton
    );

  } else {

    /*
      If Excel has no audio path,
      do not create a fake audio path.

      Instead provide browser speech synthesis
      as a fallback when Chinese text exists.
    */

    if (row.chinese) {

      const speechButton =
        document.createElement("button");

      speechButton.type = "button";

      speechButton.className =
        "audio-button demo-audio-button";

      speechButton.textContent =
        "▶ Play";


      speechButton.addEventListener(
        "click",
        () => {

          speakChinese(
            row.chinese,
            speechButton
          );

        }
      );


      wrapper.appendChild(
        speechButton
      );

    }

  }


  container.appendChild(wrapper);
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


  container.innerHTML = "";
  container.className = "dynamic-demo-content conversation-list";


  if (!conversationData.length) {

    container.innerHTML = `
      <div class="loading-message">
        No conversation data found.
      </div>
    `;

    return;
  }


  /*
    Each Excel row becomes one conversation line:
    Line 1: Chinese text with the play button right beside it
    Line 2: Pinyin
    Line 3: English
  */

  conversationData.forEach((row) => {

    const line =
      document.createElement("div");

    line.className =
      "conversation-line";


    /*
      Line 1: Chinese row with Play button beside Chinese
    */

    const chineseRow =
      document.createElement("div");

    chineseRow.className =
      "conversation-chinese-row";

    const chinese =
      document.createElement("span");

    chinese.className =
      "conversation-chinese";

    chinese.textContent =
      row.chinese || "";

    chineseRow.appendChild(chinese);


    /*
      Sound button placed directly beside Chinese
    */

    if (hasAudio(row.audio)) {

      const audioButton =
        document.createElement("button");

      audioButton.type = "button";

      audioButton.className =
        "audio-button conversation-audio-button";

      audioButton.textContent =
        "▶ Play";

      audioButton.setAttribute("aria-label", `Listen to: ${row.chinese || "phrase"}`);

      audioButton.addEventListener(
        "click",
        () => {

          playExcelAudio(
            row.audio,
            audioButton,
            "▶ Play",
            "⏸ Playing...",
            row.chinese
          );

        }
      );

      chineseRow.appendChild(
        audioButton
      );

    } else if (row.chinese) {

      /*
        Browser speech fallback
        when audio is blank in Excel.
      */

      const speechButton =
        document.createElement("button");

      speechButton.type = "button";

      speechButton.className =
        "audio-button conversation-audio-button";

      speechButton.textContent =
        "▶ Play";

      speechButton.setAttribute("aria-label", `Listen to: ${row.chinese}`);

      speechButton.addEventListener(
        "click",
        () => {

          speakChinese(
            row.chinese,
            speechButton
          );

        }
      );

      chineseRow.appendChild(
        speechButton
      );

    }

    line.appendChild(chineseRow);


    /*
      Line 2: Pinyin
    */

    if (row.pinyin) {
      const pinyin =
        document.createElement("div");

      pinyin.className =
        "conversation-pinyin";

      pinyin.textContent =
        row.pinyin;

      line.appendChild(pinyin);
    }


    /*
      Line 3: English
    */

    if (row.english) {
      const english =
        document.createElement("div");

      english.className =
        "conversation-english";

      english.textContent =
        row.english;

      line.appendChild(english);
    }


    container.appendChild(line);

  });

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


  container.innerHTML = "";


  if (!quickCheckData.length) {

    container.innerHTML = `
      <div class="loading-message">
        No quiz questions found.
      </div>
    `;

    return;
  }


  quickCheckData.forEach(
    (row, questionIndex) => {

      renderQuizQuestion(
        container,
        row,
        questionIndex
      );

    }
  );

}


/* =========================================================
   RENDER ONE QUIZ QUESTION
========================================================= */

function renderQuizQuestion(
  container,
  row,
  questionIndex
) {

  const block =
    document.createElement("div");

  block.className =
    "quiz-block";


  /*
    Question
  */

  const question =
    document.createElement("div");

  question.className =
    "quiz-question";

  question.textContent =
    row.question ||
    `Question ${questionIndex + 1}`;


  block.appendChild(question);


  /*
    Options
  */

  const optionsContainer =
    document.createElement("div");

  optionsContainer.className =
    "quiz-options";


  const optionValues = [
    row.optionA,
    row.optionB,
    row.optionC,
    row.optionD
  ].filter(value => {
    return normalizeText(value) !== "";
  });


  /*
    Determine answer.

    Preferred:
    Excel "answer" column.

    Fallback:
    optionD for compatibility with
    older workbook data.
  */

  let correctAnswer =
    row.answer || "";


  if (!correctAnswer && row.optionD) {
    correctAnswer = row.optionD;
  }


  const feedback =
    document.createElement("div");

  feedback.className =
    "quiz-feedback";


  optionValues.forEach(
    (optionValue) => {

      const option =
        document.createElement("button");

      option.type = "button";

      option.className =
        "quiz-option";

      option.textContent =
        optionValue;


      option.addEventListener(
        "click",
        () => {

          checkQuizAnswer(
            option,
            optionValue,
            correctAnswer,
            optionsContainer,
            feedback
          );

        }
      );


      optionsContainer.appendChild(
        option
      );

    }
  );


  block.appendChild(
    optionsContainer
  );

  block.appendChild(
    feedback
  );

  container.appendChild(
    block
  );
}


/* =========================================================
   CHECK QUIZ ANSWER
========================================================= */

function checkQuizAnswer(
  selectedButton,
  selectedAnswer,
  correctAnswer,
  optionsContainer,
  feedback
) {

  /*
    Prevent repeated selection
  */

  const buttons =
    optionsContainer.querySelectorAll(
      ".quiz-option"
    );


  buttons.forEach(button => {
    button.disabled = true;
  });


  /*
    Compare normalized text
  */

  const isCorrect =
    normalizeText(selectedAnswer) ===
    normalizeText(correctAnswer);


  if (isCorrect) {

    selectedButton.classList.add(
      "correct"
    );

    feedback.className =
      "quiz-feedback correct";

    feedback.textContent =
      "✓ Correct!";

    playFeedbackSound(true);

  } else {

    selectedButton.classList.add(
      "incorrect"
    );

    feedback.className =
      "quiz-feedback incorrect";

    feedback.textContent =
      `✗ Correct answer: ${correctAnswer}`;

    playFeedbackSound(false);

    /*
      Highlight correct option
    */

    buttons.forEach(button => {

      if (
        normalizeText(button.textContent) ===
        normalizeText(correctAnswer)
      ) {

        button.classList.add(
          "correct"
        );

      }

    });

  }

}


/* =========================================================
   AUDIO FEEDBACK SOUNDS (QUIZ / EXERCISES)
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
   PLAY AUDIO FROM EXCEL
========================================================= */

function playExcelAudio(
  audioPath,
  button,
  defaultText = "▶ Play",
  playingText = "⏸ Playing...",
  fallbackText = ""
) {

  /*
    If this button is already playing, clicking it stops audio.
  */
  if (button && button.classList.contains("playing")) {
    stopAllDemoAudio();
    return;
  }

  /*
    Stop currently playing demo audio.
  */
  stopAllDemoAudio();

  /*
    If there is no audio path, use speech fallback.
  */
  if (!hasAudio(audioPath)) {
    if (fallbackText && button) {
      speakChinese(fallbackText, button);
    }
    return;
  }

  const audio =
    new Audio(audioPath);

  if (button) {
    button.textContent =
      playingText;

    button.classList.add(
      "playing"
    );
  }

  audio.addEventListener(
    "ended",
    () => {
      if (button) {
        button.textContent =
          defaultText;

        button.classList.remove(
          "playing"
        );
      }

      if (window.linguaPathCurrentAudio === audio) {
        window.linguaPathCurrentAudio = null;
      }
    }
  );

  audio.addEventListener(
    "error",
    () => {
      console.warn(
        "Could not play audio:",
        audioPath
      );

      if (fallbackText && button) {
        speakChinese(
          fallbackText,
          button
        );
      } else if (button) {
        button.textContent =
          defaultText;

        button.classList.remove(
          "playing"
        );
      }
    }
  );

  audio.play()
    .catch(error => {
      console.warn(
        "Audio playback was blocked or failed:",
        error
      );

      if (fallbackText && button) {
        speakChinese(
          fallbackText,
          button
        );
      } else if (button) {
        button.textContent =
          defaultText;

        button.classList.remove(
          "playing"
        );
      }
    });

  /*
    Store reference so other demo audio can stop it.
  */
  window.linguaPathCurrentAudio =
    audio;
}


/* =========================================================
   STOP CURRENT DEMO AUDIO
========================================================= */

function stopAllDemoAudio() {

  if (
    window.linguaPathCurrentAudio
  ) {

    try {

      window.linguaPathCurrentAudio.pause();

      window.linguaPathCurrentAudio.currentTime = 0;

    } catch (error) {

      console.warn(
        "Could not stop audio.",
        error
      );

    }


    window.linguaPathCurrentAudio =
      null;
  }


  /*
    Reset any playing button.
  */

  document
    .querySelectorAll(
      ".audio-button.playing, " +
      ".demo-audio-button.playing, " +
      ".conversation-audio-button.playing"
    )
    .forEach(button => {

      button.textContent =
        "▶ Play";

      button.classList.remove(
        "playing"
      );

    });
}


/* =========================================================
   SPEECH SYNTHESIS FALLBACK
========================================================= */

function speakChinese(
  text,
  button
) {

  if (
    !("speechSynthesis" in window)
  ) {

    alert(
      "Audio is not available for this lesson."
    );

    return;
  }


  stopAllDemoAudio();

  window.speechSynthesis.cancel();


  const utterance =
    new SpeechSynthesisUtterance(text);


  utterance.lang =
    "zh-CN";

  utterance.rate =
    0.85;

  utterance.pitch =
    1;


  button.textContent =
    "⏸ Speaking...";

  button.classList.add(
    "playing"
  );


  utterance.onend = () => {

    button.textContent =
      "▶ Play";

    button.classList.remove(
      "playing"
    );

  };


  utterance.onerror = () => {

    button.textContent =
      "▶ Play";

    button.classList.remove(
      "playing"
    );

  };


  window.speechSynthesis.speak(
    utterance
  );
}


/* =========================================================
   LESSON PROGRESS TRACKING (LOCALSTORAGE PERSISTENCE)
========================================================= */

function getAllLessonProgress() {
  try {
    const raw = localStorage.getItem("linguapath_lesson_progress");
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function getLessonProgress(lessonId) {
  const all = getAllLessonProgress();
  const cleanId = String(lessonId || "").trim();
  return all[cleanId] || { completed: false, percent: 0 };
}

function saveLessonProgress(lessonId, percent, completed) {
  const cleanId = String(lessonId || "").trim();
  const all = getAllLessonProgress();
  const isDone = Boolean(completed || percent >= 100);
  all[cleanId] = {
    percent: isDone ? 100 : Math.min(100, Math.max(0, percent)),
    completed: isDone,
    lastUpdated: Date.now()
  };
  try {
    localStorage.setItem("linguapath_lesson_progress", JSON.stringify(all));
  } catch (e) {
    console.warn("Could not save progress to localStorage:", e);
  }
}

function toggleLessonCompletion(lessonId) {
  const cleanId = String(lessonId || "").trim();
  const current = getLessonProgress(cleanId);
  const newCompleted = !current.completed;
  const newPercent = newCompleted ? 100 : 0;
  saveLessonProgress(cleanId, newPercent, newCompleted);
  renderLearningHub();

  if (newCompleted) {
    recordLessonCompletionStreak();
    const lesson = (lessonData || []).find((l) => {
      const lid = l.id || l.lessonId || l.lesson_id;
      return String(lid).trim().toLowerCase() === cleanId.toLowerCase();
    });
    const lessonTitle = lesson
      ? (lesson.title ? `${lesson.title} (${lesson.chineseTitle || ""})` : cleanId)
      : cleanId;
    showCompletionModal(lessonTitle, cleanId);
  }
}

function getTotalCompletedLessonsCount() {
  const all = getAllLessonProgress();
  let count = 0;
  for (const k of Object.keys(all)) {
    if (all[k] && (all[k].completed || all[k].percent >= 100)) {
      count++;
    }
  }
  return count;
}

function showCompletionModal(lessonTitle, lessonId) {
  const modal = document.getElementById("completionModal");
  if (!modal) return;

  const count = getTotalCompletedLessonsCount();
  const streakData = getDailyStreakData();
  const totalAvailable = (lessonData && lessonData.length) ? lessonData.length : 2;

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

  const statusEl = document.getElementById("completionStatusMessage");
  if (statusEl) {
    if (count >= totalAvailable && totalAvailable > 0) {
      statusEl.textContent = `🌟 Amazing achievement! You have completed all ${totalAvailable} lessons! Keep up your streak!`;
    } else {
      statusEl.textContent = `You've completed ${count} of ${totalAvailable} lessons. Keep up your daily streak!`;
    }
  }

  const primaryBtn = document.getElementById("completionPrimaryBtn");
  if (primaryBtn) {
    primaryBtn.textContent = "Continue Learning";
    primaryBtn.onclick = () => closeCompletionModal();
  }

  modal.classList.add("active");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeCompletionModal() {
  const modal = document.getElementById("completionModal");
  if (!modal) return;
  modal.classList.remove("active");
  modal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function setupCompletionModalListeners() {
  const modal = document.getElementById("completionModal");
  const closeBtn = document.getElementById("closeCompletionModalBtn");
  const secondaryBtn = document.getElementById("completionSecondaryBtn");

  if (closeBtn) {
    closeBtn.addEventListener("click", closeCompletionModal);
  }
  if (secondaryBtn) {
    secondaryBtn.addEventListener("click", closeCompletionModal);
  }
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        closeCompletionModal();
      }
    });
  }
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal && modal.classList.contains("active")) {
      closeCompletionModal();
    }
  });
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
  try {
    const raw = localStorage.getItem(STREAK_STORAGE_KEY);
    const today = getLocalDateString();

    if (!raw) {
      // Check if user has previously completed lessons
      const totalCompleted = getTotalCompletedLessonsCount();
      if (totalCompleted > 0) {
        return {
          currentStreak: 1,
          lastCompletedDate: today,
          streakDates: [today],
          bestStreak: 1
        };
      }
      return {
        currentStreak: 0,
        lastCompletedDate: null,
        streakDates: [],
        bestStreak: 0
      };
    }

    const data = JSON.parse(raw);
    const currentStreak = Number(data.currentStreak) || 0;
    const lastCompletedDate = data.lastCompletedDate || null;
    const streakDates = Array.isArray(data.streakDates) ? data.streakDates : [];
    const bestStreak = Number(data.bestStreak) || currentStreak;

    if (!lastCompletedDate) {
      return { currentStreak: 0, lastCompletedDate: null, streakDates, bestStreak };
    }

    const diff = getDaysDifference(lastCompletedDate, today);
    if (diff === 0) {
      // Completed today
      return { currentStreak: Math.max(1, currentStreak), lastCompletedDate, streakDates, bestStreak };
    } else if (diff === 1) {
      // Completed yesterday, streak intact awaiting today
      return { currentStreak: Math.max(1, currentStreak), lastCompletedDate, streakDates, bestStreak };
    } else {
      // Missed days
      return { currentStreak: 0, lastCompletedDate, streakDates, bestStreak };
    }
  } catch (e) {
    console.warn("Could not read streak data:", e);
    return { currentStreak: 0, lastCompletedDate: null, streakDates: [], bestStreak: 0 };
  }
}

function recordLessonCompletionStreak() {
  try {
    const today = getLocalDateString();
    const streakData = getDailyStreakData();
    let currentStreak = streakData.currentStreak;
    let streakDates = [...(streakData.streakDates || [])];

    if (!streakData.lastCompletedDate) {
      currentStreak = 1;
      streakDates = [today];
    } else {
      const diff = getDaysDifference(streakData.lastCompletedDate, today);
      if (diff === 0) {
        currentStreak = Math.max(1, currentStreak);
        if (!streakDates.includes(today)) streakDates.push(today);
      } else if (diff === 1) {
        currentStreak = currentStreak + 1;
        if (!streakDates.includes(today)) streakDates.push(today);
      } else {
        currentStreak = 1;
        if (!streakDates.includes(today)) streakDates.push(today);
      }
    }

    const bestStreak = Math.max(streakData.bestStreak || 0, currentStreak);
    const updated = {
      currentStreak,
      lastCompletedDate: today,
      streakDates,
      bestStreak,
      lastUpdated: Date.now()
    };

    localStorage.setItem(STREAK_STORAGE_KEY, JSON.stringify(updated));
    updateHeaderStreakUI();
    return updated;
  } catch (e) {
    console.warn("Could not save streak data:", e);
    return { currentStreak: 1, lastCompletedDate: getLocalDateString(), bestStreak: 1 };
  }
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
    }
  });
}


/* =========================================================
   FAVORITES MANAGEMENT (LOCALSTORAGE PERSISTENCE)
========================================================= */

function getFavorites() {
  try {
    const raw = localStorage.getItem("linguapath_favorites");
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function isLessonFavorited(lessonId) {
  const favs = getFavorites();
  const norm = String(lessonId || "").trim().toLowerCase();
  return favs.some((id) => String(id).trim().toLowerCase() === norm);
}

function toggleFavorite(lessonId) {
  const cleanId = String(lessonId || "").trim();
  let favs = getFavorites();
  const norm = cleanId.toLowerCase();
  const existingIndex = favs.findIndex((id) => String(id).trim().toLowerCase() === norm);

  if (existingIndex > -1) {
    favs.splice(existingIndex, 1);
  } else {
    favs.push(cleanId);
  }

  try {
    localStorage.setItem("linguapath_favorites", JSON.stringify(favs));
  } catch (e) {
    console.warn("Could not save to localStorage:", e);
  }

  updateFavoriteCountBadge();
  renderLearningHub();
}

function updateFavoriteCountBadge() {
  const favCountEl = document.getElementById("favoriteCount");
  if (favCountEl) {
    favCountEl.textContent = getFavorites().length;
  }
}


/* =========================================================
   SEARCH & FILTER STATE
========================================================= */

let activeSearchQuery = "";
let activeTopicFilter = "all";
let searchFilterInitialized = false;

function setupSearchAndFilter() {
  updateFavoriteCountBadge();

  if (searchFilterInitialized) {
    return;
  }

  const searchInput = document.getElementById("lessonSearchInput");
  const clearBtn = document.getElementById("clearSearchBtn");
  const keywordChips = document.querySelectorAll(".keyword-chip");

  if (!searchInput) {
    return;
  }

  searchFilterInitialized = true;

  // Real-time search filter input
  searchInput.addEventListener("input", (e) => {
    activeSearchQuery = String(e.target.value || "").trim();

    if (clearBtn) {
      clearBtn.style.display = activeSearchQuery ? "inline-flex" : "none";
    }

    renderLearningHub();
  });

  // Clear on Escape key
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      clearSearch();
    }
  });

  // Clear button click
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      clearSearch();
    });
  }

  // Quick topic filter chips (including Favorites)
  keywordChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      const topic = chip.getAttribute("data-filter") || "all";
      activeTopicFilter = topic;

      keywordChips.forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");

      renderLearningHub();
    });
  });
}

function clearSearch() {
  activeSearchQuery = "";
  const searchInput = document.getElementById("lessonSearchInput");
  const clearBtn = document.getElementById("clearSearchBtn");

  if (searchInput) {
    searchInput.value = "";
    searchInput.focus();
  }

  if (clearBtn) {
    clearBtn.style.display = "none";
  }

  renderLearningHub();
}

function resetAllFilters() {
  activeSearchQuery = "";
  activeTopicFilter = "all";

  const searchInput = document.getElementById("lessonSearchInput");
  const clearBtn = document.getElementById("clearSearchBtn");
  const keywordChips = document.querySelectorAll(".keyword-chip");

  if (searchInput) {
    searchInput.value = "";
  }

  if (clearBtn) {
    clearBtn.style.display = "none";
  }

  keywordChips.forEach((chip) => {
    if (chip.getAttribute("data-filter") === "all") {
      chip.classList.add("active");
    } else {
      chip.classList.remove("active");
    }
  });

  renderLearningHub();
}

function applySearchSuggestion(term) {
  activeSearchQuery = term;
  const searchInput = document.getElementById("lessonSearchInput");
  const clearBtn = document.getElementById("clearSearchBtn");

  if (searchInput) {
    searchInput.value = term;
    searchInput.focus();
  }

  if (clearBtn) {
    clearBtn.style.display = "inline-flex";
  }

  renderLearningHub();
}


/* =========================================================
   LEARNING HUB (WITH INSTANT SEARCH & FAVORITES FILTERING)
========================================================= */

function renderLearningHub() {
  const container = document.getElementById("lessonGrid");
  const countIndicator = document.getElementById("searchResultsCount");

  if (!container) {
    return;
  }

  // Ensure search listeners & favorite badge are ready
  setupSearchAndFilter();

  container.innerHTML = "";

  if (!lessonData.length) {
    container.innerHTML = `
      <div class="loading-message">
        No lessons available.
      </div>
    `;
    if (countIndicator) {
      countIndicator.textContent = "No lessons found.";
    }
    return;
  }

  // Inferred keywords dictionary for lessons
  const defaultKeywordsMap = {
    "lesson-01": "morning routine breakfast school happy day get up early 早上 起床 学校 早饭 开心",
    "lesson-02": "fruit market apple shopping fresh sweet delicious red buy 水果 市场 苹果 买 甜 好吃"
  };

  // Filter lessons based on activeSearchQuery and activeTopicFilter
  const queryWords = activeSearchQuery
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  const filteredLessons = lessonData.filter((row, index) => {
    const rawId = row.id || row.lessonId || `lesson-0${index + 1}`;
    const lessonId = String(rawId).toLowerCase();
    const title = String(row.title || row.name || row.lesson || "");
    const chineseTitle = String(row.chineseTitle || row.chinese_title || row.chinese || "");
    const pinyin = String(row.pinyin || "");
    const meaning = String(row.meaning || "");
    const description = String(row.description || row.english || "");
    const level = String(row.level || row.category || row.section || "Beginner");
    const keywords = String(row.keywords || "");
    const inferred = defaultKeywordsMap[lessonId] || "";

    // 1. Check Topic / Favorites Filter
    if (activeTopicFilter !== "all") {
      let topicMatches = false;

      if (activeTopicFilter === "favorites") {
        topicMatches = isLessonFavorited(rawId);
      } else if (activeTopicFilter === "morning") {
        topicMatches = /morning|routine|breakfast|起床|早上|早饭|school/.test([title, description, keywords, inferred].join(" ").toLowerCase());
      } else if (activeTopicFilter === "fruit") {
        topicMatches = /fruit|market|apple|shopping|sweet|delicious|水果|苹果|买/.test([title, description, keywords, inferred].join(" ").toLowerCase());
      } else if (activeTopicFilter === "school") {
        topicMatches = /school|学校|xuéxiào/.test([title, description, keywords, inferred].join(" ").toLowerCase());
      } else if (activeTopicFilter === "beginner") {
        topicMatches = /beginner|初级/.test(level.toLowerCase());
      } else {
        topicMatches = [title, chineseTitle, pinyin, meaning, description, level, keywords, inferred].join(" ").toLowerCase().includes(activeTopicFilter.toLowerCase());
      }

      if (!topicMatches) {
        return false;
      }
    }

    // 2. Check Search Query Words (every word must match in combined text)
    if (queryWords.length > 0) {
      const combinedSearchable = [
        title,
        chineseTitle,
        pinyin,
        meaning,
        description,
        level,
        keywords,
        inferred
      ].join(" ").toLowerCase();

      const allWordsMatch = queryWords.every((word) => combinedSearchable.includes(word));
      if (!allWordsMatch) {
        return false;
      }
    }

    return true;
  });

  // Update Result Status Indicator
  if (countIndicator) {
    if (activeTopicFilter === "favorites") {
      countIndicator.textContent = `Showing ${filteredLessons.length} saved ${filteredLessons.length === 1 ? "lesson" : "lessons"}`;
    } else if (activeSearchQuery && activeTopicFilter !== "all") {
      countIndicator.textContent = `Found ${filteredLessons.length} ${filteredLessons.length === 1 ? "lesson" : "lessons"} matching "${activeSearchQuery}" in topic`;
    } else if (activeSearchQuery) {
      countIndicator.textContent = `Found ${filteredLessons.length} ${filteredLessons.length === 1 ? "lesson" : "lessons"} matching "${activeSearchQuery}"`;
    } else if (activeTopicFilter !== "all") {
      countIndicator.textContent = `Showing ${filteredLessons.length} ${filteredLessons.length === 1 ? "lesson" : "lessons"} for topic`;
    } else {
      countIndicator.textContent = `Showing all ${filteredLessons.length} ${filteredLessons.length === 1 ? "lesson" : "lessons"}`;
    }
  }

  // Handle Empty State
  if (filteredLessons.length === 0) {
    const emptyState = document.createElement("div");
    emptyState.className = "search-empty-state";

    if (activeTopicFilter === "favorites") {
      emptyState.innerHTML = `
        <div class="empty-icon">❤️</div>
        <h3>No Saved Lessons Yet</h3>
        <p>You haven't added any lessons to your favorites yet. Click the 🤍 heart icon on any lesson card to save it here for quick practice!</p>
        <button type="button" class="btn btn-primary" id="viewAllLessonsBtn">
          Browse All Lessons
        </button>
      `;

      const viewAllBtn = emptyState.querySelector("#viewAllLessonsBtn");
      if (viewAllBtn) {
        viewAllBtn.addEventListener("click", () => {
          resetAllFilters();
        });
      }
    } else {
      emptyState.innerHTML = `
        <div class="empty-icon">🔍</div>
        <h3>No lessons found</h3>
        <p>We couldn't find any lessons matching "<strong>${escapeHTML(activeSearchQuery || activeTopicFilter)}</strong>".</p>
        <div class="empty-suggestions">
          <span>Try searching:</span>
          <button type="button" class="suggestion-chip" data-search="fruit">🍎 Fruit</button>
          <button type="button" class="suggestion-chip" data-search="morning">🌅 Morning</button>
          <button type="button" class="suggestion-chip" data-search="school">🏫 School</button>
          <button type="button" class="suggestion-chip" data-search="beginner">⭐ Beginner</button>
        </div>
        <button type="button" class="btn btn-secondary reset-search-btn" id="resetSearchBtn">
          Reset Search &amp; Filters
        </button>
      `;

      emptyState.querySelectorAll(".suggestion-chip").forEach((btn) => {
        btn.addEventListener("click", () => {
          const term = btn.getAttribute("data-search") || "";
          applySearchSuggestion(term);
        });
      });

      const resetBtn = emptyState.querySelector("#resetSearchBtn");
      if (resetBtn) {
        resetBtn.addEventListener("click", () => {
          resetAllFilters();
        });
      }
    }

    container.appendChild(emptyState);
    return;
  }

  // Render Lesson Cards
  filteredLessons.forEach((row, index) => {
    const card = document.createElement("article");
    card.className = "lesson-card";

    const lessonId = row.id || row.lessonId || row.lesson_id || `lesson-0${index + 1}`;
    const title = row.title || row.name || row.lesson || `Lesson ${index + 1}`;
    const chineseTitle = row.chineseTitle || row.chinese_title || row.chinese || "";
    const pinyin = row.pinyin || "";
    const meaning = row.meaning || "";
    const description = row.description || row.english || "";
    const level = row.level || row.category || row.section || "Beginner";
    const poster = row.poster || row.image || "assets/images/story-poster.jpg";
    const isFav = isLessonFavorited(lessonId);
    const progress = getLessonProgress(lessonId);
    const isCompleted = progress.completed || (progress.percent >= 100);
    const progressPercent = isCompleted ? 100 : (progress.percent || 0);

    // Determine topic tags for visual display
    let tagList = [];
    if (lessonId.includes("01") || title.toLowerCase().includes("day") || description.toLowerCase().includes("simple story")) {
      tagList = ["🌅 Morning", "🏫 School", "🍳 Routine"];
    } else if (lessonId.includes("02") || title.toLowerCase().includes("fruit") || description.toLowerCase().includes("market")) {
      tagList = ["🍎 Fruit", "🛒 Market", "😋 Delicious"];
    }

    const tagsHtml = tagList.length
      ? `<div class="lesson-keywords">
          ${tagList.map(tag => `<span class="lesson-keyword-badge">${escapeHTML(tag)}</span>`).join("")}
        </div>`
      : "";

    const progressHtml = `
      <div class="lesson-progress-box" data-lesson-id="${escapeHTML(lessonId)}">
        <div class="progress-bar-meta">
          <span class="progress-status-label ${isCompleted ? 'is-completed' : ''}">
            ${isCompleted ? '✓ Completed' : (progressPercent > 0 ? `${progressPercent}% in progress` : '○ Not started')}
          </span>
          <button
            type="button"
            class="progress-toggle-btn ${isCompleted ? 'is-done' : ''}"
            data-lesson-id="${escapeHTML(lessonId)}"
            title="${isCompleted ? 'Mark as incomplete' : 'Mark as complete'}"
            aria-label="${isCompleted ? 'Mark as incomplete' : 'Mark as complete'}"
          >
            ${isCompleted ? '✓ Done' : '○ Mark Done'}
          </button>
        </div>
        <div class="progress-bar-track" role="progressbar" aria-valuenow="${progressPercent}" aria-valuemin="0" aria-valuemax="100">
          <div class="progress-bar-fill ${isCompleted ? 'completed-fill' : ''}" style="width: ${progressPercent}%;"></div>
        </div>
      </div>
    `;

    card.innerHTML = `
      <div class="lesson-card-image">
        ${
          poster
            ? `<img src="${escapeHTML(poster)}" alt="${escapeHTML(title)}" loading="lazy" onerror="if (this.src.endsWith('.jpg')) { this.src = this.src.replace(/\\.jpg$/, '.svg'); } else if (this.src.endsWith('.svg')) { this.src = this.src.replace(/\\.svg$/, '.png'); } else { this.onerror=null; this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' viewBox=\\'0 0 800 450\\' width=\\'100%25\\' height=\\'100%25\\'><rect width=\\'800\\' height=\\'450\\' fill=\\'%23fff7ed\\'/><text x=\\'50%25\\' y=\\'45%25\\' font-size=\\'56\\' text-anchor=\\'middle\\'>📖</text><text x=\\'50%25\\' y=\\'65%25\\' font-size=\\'28\\' font-weight=\\'bold\\' fill=\\'%23ea580c\\' text-anchor=\\'middle\\'>${encodeURIComponent(title || 'Chinese Lesson')}</text></svg>'; }">`
            : `<div class="lesson-card-placeholder">文</div>`
        }
        <button
          type="button"
          class="lesson-favorite-btn ${isFav ? 'active' : ''}"
          data-lesson-id="${escapeHTML(lessonId)}"
          title="${isFav ? 'Remove from saved favorites' : 'Save to favorites'}"
          aria-label="${isFav ? 'Remove from saved favorites' : 'Save to favorites'}"
        >
          <span class="heart-icon">${isFav ? '❤️' : '🤍'}</span>
        </button>
      </div>

      <div class="lesson-card-content">
        <span class="lesson-level">
          ⭐ ${escapeHTML(level)}
        </span>

        <h3>
          ${escapeHTML(title)}
        </h3>

        ${
          chineseTitle
            ? `<div class="lesson-chinese-title">${escapeHTML(chineseTitle)}</div>`
            : ""
        }

        ${
          pinyin
            ? `<div class="lesson-pinyin">${escapeHTML(pinyin)}</div>`
            : ""
        }

        ${
          meaning
            ? `<div class="lesson-meaning">${escapeHTML(meaning)}</div>`
            : ""
        }

        ${
          description
            ? `<p class="lesson-description">${escapeHTML(description)}</p>`
            : ""
        }

        ${tagsHtml}

        ${progressHtml}

        <div class="lesson-card-actions">
          <a
            href="story.html?id=${encodeURIComponent(lessonId)}"
            class="btn btn-primary lesson-button"
          >
            ${isCompleted ? 'Review Lesson →' : (progressPercent > 0 ? 'Continue Lesson →' : 'Start Lesson →')}
          </a>
        </div>
      </div>
    `;

    // Heart favorite toggle button listener
    const favBtn = card.querySelector(".lesson-favorite-btn");
    if (favBtn) {
      favBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();
        toggleFavorite(lessonId);
      });
    }

    // Progress toggle button listener
    const progressToggle = card.querySelector(".progress-toggle-btn");
    if (progressToggle) {
      progressToggle.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();
        toggleLessonCompletion(lessonId);
      });
    }

    // Card click redirects to respective story page to continue
    card.addEventListener("click", (e) => {
      if (!e.target.closest("button")) {
        window.location.href = `story.html?id=${encodeURIComponent(lessonId)}`;
      }
    });

    container.appendChild(card);
  });
}


/* =========================================================
   DEMO CARDS CLICK TO CONTINUE
========================================================= */

function setupDemoCardsClick() {
  const cards = document.querySelectorAll(".demo-card[data-target]");
  cards.forEach((card) => {
    card.addEventListener("click", (e) => {
      // Do not navigate if user clicked interactive buttons or audio
      if (
        e.target.closest("button") ||
        e.target.closest(".audio-button") ||
        e.target.closest(".tone-button") ||
        e.target.closest(".quiz-option") ||
        e.target.closest("audio")
      ) {
        return;
      }

      const target = card.getAttribute("data-target");
      if (target) {
        window.location.href = target;
      }
    });
  });
}


/* =========================================================
   MOBILE MENU
========================================================= */

function setupMobileMenu() {

  const menuToggle =
    document.getElementById(
      "menuToggle"
    );

  const mainNav =
    document.getElementById(
      "mainNav"
    );


  if (
    !menuToggle ||
    !mainNav
  ) {
    return;
  }


  menuToggle.addEventListener(
    "click",
    () => {

      const isOpen =
        mainNav.classList.toggle(
          "active"
        );


      menuToggle.setAttribute(
        "aria-expanded",
        String(isOpen)
      );

    }
  );


  /*
    Close menu after clicking a link.
  */

  mainNav
    .querySelectorAll("a")
    .forEach(link => {

      link.addEventListener(
        "click",
        () => {

          mainNav.classList.remove(
            "active"
          );

          menuToggle.setAttribute(
            "aria-expanded",
            "false"
          );

        }
      );

    });

}


/* =========================================================
   WORKBOOK ERROR
========================================================= */

function showWorkbookError() {

  const containers = [

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


    element.innerHTML = `
      <div class="loading-message">
        Unable to load lesson data.
        Please check that
        <strong>data/lessons.xlsx</strong>
        is available.
      </div>
    `;

  });

}


/* =========================================================
   HELPERS
========================================================= */

function normalizeText(value) {

  return String(value ?? "")
    .trim()
    .toLowerCase();

}


function hasAudio(value) {

  return (
    typeof value === "string" &&
    value.trim() !== ""
  );

}


/* =========================================================
   GLOBAL DEBUG ACCESS
========================================================= */

window.linguaPath = {

  getWorkbook: () => workbook,

  getDemoData: () => demoData,

  getLessonData: () => lessonData,

  getPronunciationData:
    () => pronunciationData,

  getEverydayChineseData:
    () => everydayChineseData,

  getConversationData:
    () => conversationData,

  getQuickCheckData:
    () => quickCheckData

};
