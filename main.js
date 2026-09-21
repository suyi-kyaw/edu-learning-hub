
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


  if (toneDescription) {

    toneDescription.textContent =
      row.english ||
      "Select a tone to hear the pronunciation.";

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


  if (!conversationData.length) {

    container.innerHTML = `
      <div class="loading-message">
        No conversation data found.
      </div>
    `;

    return;
  }


  /*
    Each Excel row becomes one conversation line.
  */

  conversationData.forEach((row) => {

    const line =
      document.createElement("div");

    line.className =
      "conversation-line";


    /*
      Chinese
    */

    const chinese =
      document.createElement("div");

    chinese.className =
      "conversation-chinese";

    chinese.textContent =
      row.chinese || "";


    /*
      Pinyin
    */

    const pinyin =
      document.createElement("div");

    pinyin.className =
      "conversation-pinyin";

    pinyin.textContent =
      row.pinyin || "";


    /*
      English
    */

    const english =
      document.createElement("div");

    english.className =
      "conversation-english";

    english.textContent =
      row.english || "";


    line.appendChild(chinese);

    line.appendChild(pinyin);

    line.appendChild(english);


    /*
      Sound button
    */

    if (hasAudio(row.audio)) {

      const audioButton =
        document.createElement("button");

      audioButton.type = "button";

      audioButton.className =
        "audio-button conversation-audio-button";

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


      line.appendChild(
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


      speechButton.addEventListener(
        "click",
        () => {

          speakChinese(
            row.chinese,
            speechButton
          );

        }
      );


      line.appendChild(
        speechButton
      );

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
   LEARNING HUB
========================================================= */

function renderLearningHub() {

  const container =
    document.getElementById(
      "lessonGrid"
    );

  if (!container) {
    return;
  }


  container.innerHTML = "";


  if (!lessonData.length) {

    container.innerHTML = `
      <div class="loading-message">
        No lessons found.
      </div>
    `;

    return;
  }


  /*
    Render previous format of learning hub lessons
    with poster image, level, title, Chinese title,
    pinyin, meaning, description, and Open Lesson button.
  */

  lessonData.forEach((row, index) => {

    const card =
      document.createElement("article");

    card.className =
      "lesson-card";


    const lessonId =
      row.id ||
      row.lessonId ||
      row.lesson_id ||
      `lesson-0${index + 1}`;

    const title =
      row.title ||
      row.name ||
      row.lesson ||
      `Lesson ${index + 1}`;

    const chineseTitle =
      row.chineseTitle ||
      row.chinese_title ||
      row.chinese ||
      "";

    const pinyin =
      row.pinyin ||
      "";

    const meaning =
      row.meaning ||
      "";

    const description =
      row.description ||
      row.english ||
      "";

    const level =
      row.level ||
      row.category ||
      row.section ||
      "Beginner";

    const poster =
      row.poster ||
      row.image ||
      "assets/images/story-poster.jpg";


    card.innerHTML = `
      <div class="lesson-card-image">
        ${
          poster
            ? `<img src="${escapeHTML(poster)}" alt="${escapeHTML(title)}" loading="lazy" onerror="if (this.src.endsWith('.jpg')) { this.src = this.src.replace(/\\.jpg$/, '.svg'); } else if (this.src.endsWith('.svg')) { this.src = this.src.replace(/\\.svg$/, '.png'); } else { this.onerror=null; this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' viewBox=\\'0 0 800 450\\' width=\\'100%25\\' height=\\'100%25\\'><rect width=\\'800\\' height=\\'450\\' fill=\\'%23fff7ed\\'/><text x=\\'50%25\\' y=\\'45%25\\' font-size=\\'56\\' text-anchor=\\'middle\\'>📖</text><text x=\\'50%25\\' y=\\'65%25\\' font-size=\\'28\\' font-weight=\\'bold\\' fill=\\'%239a3412\\' text-anchor=\\'middle\\'>${encodeURIComponent(title || 'Chinese Lesson')}</text></svg>'; }">`
            : `<div class="lesson-card-placeholder">文</div>`
        }
      </div>

      <div class="lesson-card-content">
        <span class="lesson-level">
          ${escapeHTML(level)}
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

        <div class="lesson-card-actions">
          <a
            href="story.html?id=${encodeURIComponent(lessonId)}"
            class="btn btn-primary lesson-button"
          >
            Open Lesson
          </a>
        </div>
      </div>
    `;

    card.style.cursor = "pointer";
    card.addEventListener("click", (e) => {
      if (!e.target.closest("a") && !e.target.closest("button")) {
        window.location.href = `story.html?id=${encodeURIComponent(lessonId)}`;
      }
    });

    container.appendChild(card);

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
