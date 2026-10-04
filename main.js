
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
let vocabularyData = [];
let storyData = [];

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
  setupThemeToggle();
  setupMobileMenu();
  setupSearchAndFilter();
  setupDemoCardsClick();
  setupCompletionModalListeners();
  updateHeaderStreakUI();
  setupStreakBadgeInteractions();
  updateUserLevelUI();
  setupUserLevelInteractions();
  setupReminderUI();
  startDailyReminderScheduler();
  setupReviewMode();
  setupReelsInteractions();
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

          if (workbook.SheetNames.includes("Vocabulary")) {
            vocabularyData = XLSX.utils.sheet_to_json(
              workbook.Sheets["Vocabulary"],
              { defval: "" }
            );
          }

          if (workbook.SheetNames.includes("Story")) {
            storyData = XLSX.utils.sheet_to_json(
              workbook.Sheets["Story"],
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
          vocabularyData = apiData.sheets["Vocabulary"] || [];
          storyData = apiData.sheets["Story"] || [];

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
          vocabularyData = jsonData.sheets["Vocabulary"] || [];
          storyData = jsonData.sheets["Story"] || [];

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
    vocabularyData = getFallbackVocabularyData();
    storyData = getFallbackStoryData();
    loaded = true;
  }

  // Ensure vocabulary & story fallbacks are populated if sheets were empty
  if (!vocabularyData || !vocabularyData.length) {
    vocabularyData = getFallbackVocabularyData();
  }
  if (!storyData || !storyData.length) {
    storyData = getFallbackStoryData();
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

function getFallbackVocabularyData() {
  return [
    { lessonId: "lesson-01", order: 1, character: "早上", pinyin: "zǎoshang", meaning: "morning", audio: "assets/audio/zaoshang.mp3" },
    { lessonId: "lesson-01", order: 2, character: "起床", pinyin: "qǐchuáng", meaning: "get up", audio: "assets/audio/qichuang.mp3" },
    { lessonId: "lesson-01", order: 3, character: "学校", pinyin: "xuéxiào", meaning: "school", audio: "assets/audio/xuexiao.mp3" },
    { lessonId: "lesson-01", order: 4, character: "开心", pinyin: "kāixīn", meaning: "happy", audio: "assets/audio/kaixin.mp3" },

    { lessonId: "lesson-02", order: 1, character: "水果", pinyin: "shuǐguǒ", meaning: "fruit", audio: "assets/audio/shuiguo.mp3" },
    { lessonId: "lesson-02", order: 2, character: "市场", pinyin: "shìchǎng", meaning: "market", audio: "assets/audio/shichang.mp3" },
    { lessonId: "lesson-02", order: 3, character: "苹果", pinyin: "píngguǒ", meaning: "apple", audio: "assets/audio/pingguo.mp3" },
    { lessonId: "lesson-02", order: 4, character: "新鲜", pinyin: "xīnxiān", meaning: "fresh", audio: "assets/audio/xinxian.mp3" }
  ];
}

function getFallbackStoryData() {
  return [
    { lessonId: "lesson-01", order: 1, chinese: "小明早上七点起床。", pinyin: "Xiǎomíng zǎoshang qī diǎn qǐchuáng.", english: "Xiaoming gets up at seven in the morning.", image: "assets/images/story-01.jpg", audio: "assets/audio/story-01.mp3" },
    { lessonId: "lesson-01", order: 2, chinese: "他洗脸刷牙。", pinyin: "Tā xǐliǎn shuāyá.", english: "He washes his face and brushes his teeth.", image: "assets/images/story-02.jpg", audio: "assets/audio/story-02.mp3" },
    { lessonId: "lesson-01", order: 3, chinese: "他吃早饭。", pinyin: "Tā chī zǎofàn.", english: "He eats breakfast.", image: "assets/images/story-03.jpg", audio: "assets/audio/story-03.mp3" },
    { lessonId: "lesson-01", order: 4, chinese: "然后，他去学校。", pinyin: "Ránhòu, tā qù xuéxiào.", english: "Then, he goes to school.", image: "assets/images/story-04.jpg", audio: "assets/audio/story-04.mp3" },
    { lessonId: "lesson-01", order: 5, chinese: "他很开心。", pinyin: "Tā hěn kāixīn.", english: "He is very happy.", image: "assets/images/story-05.jpg", audio: "assets/audio/story-05.mp3" },

    { lessonId: "lesson-02", order: 1, chinese: "今天天气真好！", pinyin: "Jīntiān tiānqì zhēn hǎo!", english: "The weather is really nice today!", image: "assets/images/story2-01.jpg", audio: "assets/audio/story2-01.mp3" },
    { lessonId: "lesson-02", order: 2, chinese: "小明去水果市场。", pinyin: "Xiǎomíng qù shuǐguǒ shìchǎng.", english: "Xiaoming goes to the fruit market.", image: "assets/images/story2-02.jpg", audio: "assets/audio/story2-02.mp3" },
    { lessonId: "lesson-02", order: 3, chinese: "市场里有很多新鲜的红苹果。", pinyin: "Shìchǎng lǐ yǒu hěn duō xīnxiān de hóng píngguǒ.", english: "There are many fresh red apples in the market.", image: "assets/images/story2-03.jpg", audio: "assets/audio/story2-03.mp3" },
    { lessonId: "lesson-02", order: 4, chinese: "他买了三个大苹果。", pinyin: "Tā mǎi le sān gè dà píngguǒ.", english: "He bought three big apples.", image: "assets/images/story2-04.jpg", audio: "assets/audio/story2-04.mp3" },
    { lessonId: "lesson-02", order: 5, chinese: "苹果又甜又好吃，他真开心！", pinyin: "Píngguǒ yòu tián yòu hǎochī, tā zhēn kāixīn!", english: "The apples are sweet and delicious, he is really happy!", image: "assets/images/story2-05.jpg", audio: "assets/audio/story2-05.mp3" }
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


  const toneAriaLabels = [
    "Tone 1 high flat",
    "Tone 2 rising",
    "Tone 3 dipping",
    "Tone 4 falling",
    "Neutral tone"
  ];

  pronunciationData.forEach((row, index) => {

    const button =
      document.createElement("button");

    button.type = "button";

    button.className = "tone-button";

    button.setAttribute(
      "aria-label",
      toneAriaLabels[index] || `Tone ${index + 1}`
    );

    button.setAttribute(
      "aria-pressed",
      index === 0 ? "true" : "false"
    );

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

    const isActive = buttonIndex === index;
    button.classList.toggle(
      "active",
      isActive
    );
    button.setAttribute(
      "aria-pressed",
      isActive ? "true" : "false"
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
    Mandarin tone shapes matching viewBox 0 0 500 100
    Tone 1 = high flat
    Tone 2 = rising
    Tone 3 = dipping
    Tone 4 = falling
    Tone 5 = neutral
  */

  const tonePaths = [

    "M20 30 L480 30",

    "M20 80 Q250 75 480 25",

    "M20 40 Q160 85 250 85 Q350 85 480 30",

    "M20 25 Q240 50 480 85",

    "M180 50 L320 50"

  ];


  tonePath.setAttribute(
    "d",
    tonePaths[index] ||
    tonePaths[0]
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

  feedback.id =
    "microQuizFeedback";

  feedback.setAttribute(
    "aria-live",
    "polite"
  );


  optionValues.forEach(
    (optionValue) => {

      const option =
        document.createElement("button");

      option.type = "button";

      option.className =
        "quiz-option micro-options";

      option.setAttribute(
        "aria-pressed",
        "false"
      );

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

  if (selectedButton) {
    selectedButton.setAttribute("aria-pressed", "true");
  }


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


function showToneAudioFallbackNotice(message, isError = false) {
  const fallbackEl = document.getElementById("toneAudioFallback");
  if (!fallbackEl) {
    return;
  }
  fallbackEl.textContent = message;
  fallbackEl.className = isError
    ? "tone-audio-fallback tone-audio-error"
    : "tone-audio-fallback tone-audio-notice";
  fallbackEl.style.display = "block";
  setTimeout(() => {
    if (fallbackEl) {
      fallbackEl.style.display = "none";
    }
  }, 4000);
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
    Stop currently playing demo audio and cancel speech
  */
  stopAllDemoAudio();

  /*
    If there is no audio path, use speech fallback.
  */
  if (!hasAudio(audioPath)) {
    if (fallbackText && button) {
      showToneAudioFallbackNotice("Playing via speech synthesis fallback...");
      speakChinese(fallbackText, button);
    } else {
      showToneAudioFallbackNotice("Audio unavailable for this item.", true);
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

    button.setAttribute(
      "aria-busy",
      "true"
    );
  }

  const resetButton = () => {
    if (button) {
      button.textContent =
        defaultText;

      button.classList.remove(
        "playing"
      );

      button.removeAttribute(
        "aria-busy"
      );

      button.disabled = false;
    }
    if (window.linguaPathCurrentAudio === audio) {
      window.linguaPathCurrentAudio = null;
    }
  };

  audio.addEventListener(
    "ended",
    resetButton
  );

  audio.addEventListener(
    "error",
    () => {
      console.warn(
        "Could not play audio:",
        audioPath
      );

      if (fallbackText && button) {
        showToneAudioFallbackNotice("Audio file missing; switching to speech synthesis...");
        speakChinese(
          fallbackText,
          button
        );
      } else {
        resetButton();
        showToneAudioFallbackNotice("Audio playback failed.", true);
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
        showToneAudioFallbackNotice("Audio playback blocked; using speech synthesis...");
        speakChinese(
          fallbackText,
          button
        );
      } else {
        resetButton();
        showToneAudioFallbackNotice("Audio playback blocked by browser.", true);
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

  if ("speechSynthesis" in window) {
    try {
      window.speechSynthesis.cancel();
    } catch (e) {}
  }

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

      button.removeAttribute(
        "aria-busy"
      );

      button.disabled = false;

    });
}


/* =========================================================
   SPEECH SYNTHESIS FALLBACK
========================================================= */

function speakChinese(
  text,
  button
) {

  stopAllDemoAudio();

  if (
    !("speechSynthesis" in window)
  ) {
    showToneAudioFallbackNotice("Speech synthesis is not supported in this browser.", true);
    return;
  }

  try {
    window.speechSynthesis.cancel();
  } catch (e) {}

  const utterance =
    new SpeechSynthesisUtterance(text);

  utterance.lang =
    "zh-CN";

  utterance.rate =
    0.85;

  utterance.pitch =
    1;

  if (button) {
    button.textContent =
      "⏸ Speaking...";

    button.classList.add(
      "playing"
    );

    button.setAttribute(
      "aria-busy",
      "true"
    );

    button.disabled = true;
  }

  const resetSpeechButton = () => {
    if (button) {
      button.textContent =
        "▶ Play";

      button.classList.remove(
        "playing"
      );

      button.removeAttribute(
        "aria-busy"
      );

      button.disabled = false;
    }
  };

  utterance.onend = resetSpeechButton;

  utterance.onerror = (err) => {
    resetSpeechButton();
    showToneAudioFallbackNotice("Speech synthesis encountered an error.", true);
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
    updateUserLevelUI();
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
  const levelInfo = getUserLevelInfo(count);

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

  const rankIconEl = document.getElementById("completionRankIcon");
  if (rankIconEl) {
    rankIconEl.textContent = levelInfo.icon;
  }

  const rankValEl = document.getElementById("completionRankValue");
  if (rankValEl) {
    rankValEl.textContent = `${levelInfo.rank}`;
  }

  const statusEl = document.getElementById("completionStatusMessage");
  if (statusEl) {
    if (count >= totalAvailable && totalAvailable > 0) {
      statusEl.textContent = `🌟 Amazing achievement! You reached ${levelInfo.rank} rank and completed all ${totalAvailable} lessons! Keep up your streak!`;
    } else {
      statusEl.textContent = `You've completed ${count} of ${totalAvailable} lessons. Current rank: ${levelInfo.rank} (${levelInfo.chineseRank})!`;
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
      updateUserLevelUI();
    }
  });
}


/* =========================================================
   USER LEVEL & RANK PROGRESSION SYSTEM (Novice, Scholar, Master)
========================================================= */

const USER_LEVEL_DEFINITIONS = [
  { level: 1, rank: "Novice", chineseRank: "初学者", minCompleted: 0, icon: "🌱", class: "rank-novice", nextRequired: 1 },
  { level: 2, rank: "Scholar", chineseRank: "学者", minCompleted: 1, icon: "📚", class: "rank-scholar", nextRequired: 2 },
  { level: 3, rank: "Master", chineseRank: "大师", minCompleted: 2, icon: "👑", class: "rank-master", nextRequired: null }
];

function getUserLevelInfo(completedCount) {
  const count = typeof completedCount === "number" ? completedCount : getTotalCompletedLessonsCount();
  let current = USER_LEVEL_DEFINITIONS[0];
  for (let i = USER_LEVEL_DEFINITIONS.length - 1; i >= 0; i--) {
    if (count >= USER_LEVEL_DEFINITIONS[i].minCompleted) {
      current = USER_LEVEL_DEFINITIONS[i];
      break;
    }
  }

  let progressPercent = 100;
  let progressText = "Maximum Rank Achieved!";
  let nextRankName = "Max Rank";

  if (current.nextRequired !== null) {
    const prevMin = current.minCompleted;
    const nextReq = current.nextRequired;
    const numerator = Math.max(0, count - prevMin);
    const denominator = Math.max(1, nextReq - prevMin);
    progressPercent = Math.min(100, Math.round((numerator / denominator) * 100));
    progressText = `${count} / ${nextReq} completed`;
    const nextDef = USER_LEVEL_DEFINITIONS.find((d) => d.minCompleted === current.nextRequired);
    nextRankName = nextDef ? `Next: ${nextDef.rank}` : "Next Rank";
  }

  return {
    ...current,
    count,
    progressPercent,
    progressText,
    nextRankName
  };
}

function updateUserLevelUI() {
  const count = getTotalCompletedLessonsCount();
  const info = getUserLevelInfo(count);

  const badgeEl = document.getElementById("userLevelBadge");
  const iconEl = document.getElementById("userLevelIcon");
  const rankEl = document.getElementById("userLevelRank");
  const subEl = document.getElementById("userLevelSubtitle");
  const tooltipTitle = document.getElementById("levelTooltipTitle");
  const tooltipChinese = document.getElementById("levelTooltipChinese");
  const tooltipDesc = document.getElementById("levelTooltipDesc");
  const progressBar = document.getElementById("levelProgressBar");
  const progressText = document.getElementById("levelProgressText");
  const nextRankEl = document.getElementById("levelNextRank");

  if (badgeEl) {
    badgeEl.classList.remove("rank-novice", "rank-scholar", "rank-master");
    badgeEl.classList.add(info.class);
    badgeEl.setAttribute("aria-label", `User Level: ${info.rank} (Level ${info.level})`);
    badgeEl.setAttribute("title", `User Learning Rank: ${info.rank} (${info.chineseRank})`);
  }

  if (iconEl) iconEl.textContent = info.icon;
  if (rankEl) rankEl.textContent = info.rank;
  if (subEl) subEl.textContent = `Lvl ${info.level}`;

  if (tooltipTitle) tooltipTitle.textContent = `${info.icon} ${info.rank} (Level ${info.level})`;
  if (tooltipChinese) tooltipChinese.textContent = info.chineseRank;

  if (tooltipDesc) {
    if (info.nextRequired !== null) {
      const needed = Math.max(1, info.nextRequired - count);
      tooltipDesc.textContent = `Complete ${needed} more ${needed === 1 ? "lesson" : "lessons"} to reach ${info.nextRankName.replace("Next: ", "")} rank!`;
    } else {
      tooltipDesc.textContent = "Congratulations! You have reached Master rank by completing all available lessons!";
    }
  }

  if (progressBar) {
    progressBar.style.width = `${info.progressPercent}%`;
  }
  if (progressText) {
    progressText.textContent = info.progressText;
  }
  if (nextRankEl) {
    nextRankEl.textContent = info.nextRankName;
  }
}

function setupUserLevelInteractions() {
  const badgeEl = document.getElementById("userLevelBadge");
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
}


/* =========================================================
   DAILY STUDY REMINDER & BROWSER NOTIFICATION SYSTEM
========================================================= */

const DAILY_REMINDER_STORAGE_KEY = "linguapath_daily_reminder";

function getDailyReminderSettings() {
  try {
    const raw = localStorage.getItem(DAILY_REMINDER_STORAGE_KEY);
    if (!raw) {
      return {
        enabled: true,
        time: "18:00",
        lastNotifiedDate: null
      };
    }
    const data = JSON.parse(raw);
    return {
      enabled: data.enabled !== false,
      time: data.time || "18:00",
      lastNotifiedDate: data.lastNotifiedDate || null
    };
  } catch (e) {
    return { enabled: true, time: "18:00", lastNotifiedDate: null };
  }
}

function saveDailyReminderSettings(settings) {
  try {
    localStorage.setItem(DAILY_REMINDER_STORAGE_KEY, JSON.stringify(settings));
    updateReminderBellUI();
    updateReminderGoalStatusUI();
  } catch (e) {
    console.warn("Could not save reminder settings:", e);
  }
}

function hasCompletedDailyGoalToday() {
  const today = getLocalDateString();
  const streakData = getDailyStreakData();
  if (streakData && streakData.lastCompletedDate === today) {
    return true;
  }
  const progressAll = getAllLessonProgress();
  for (const key of Object.keys(progressAll)) {
    const item = progressAll[key];
    if (item && item.completed) {
      if (item.lastUpdated) {
        const updatedDate = getLocalDateString(new Date(item.lastUpdated));
        if (updatedDate === today) return true;
      }
    }
  }
  return false;
}

function formatReminderTimeDisplay(timeStr) {
  if (!timeStr) return "06:00 PM";
  const [hStr, mStr] = timeStr.split(":");
  let h = parseInt(hStr, 10);
  const m = mStr || "00";
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  h = h ? h : 12;
  const displayH = String(h).padStart(2, "0");
  return `${displayH}:${m} ${ampm}`;
}

async function requestBrowserNotificationPermission(onResult) {
  if (!("Notification" in window)) {
    if (typeof onResult === "function") onResult("unsupported");
    return "unsupported";
  }
  try {
    const permission = await Notification.requestPermission();
    updatePermissionCardUI();
    if (typeof onResult === "function") onResult(permission);
    return permission;
  } catch (e) {
    console.warn("Notification.requestPermission failed:", e);
    if (typeof onResult === "function") onResult("denied");
    return "denied";
  }
}

function sendBrowserNotification(title, options = {}) {
  const bodyText = options.body || "Keep your learning streak going! Complete today's Chinese lesson.";
  const notifOptions = {
    body: bodyText,
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='25' fill='%23ea580c'/><text x='50' y='68' font-size='50' text-anchor='middle' fill='%23ffffff' font-family='sans-serif'>语</text></svg>",
    badge: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🔔</text></svg>",
    tag: options.tag || "linguapath-reminder",
    renotify: true
  };

  let sentNative = false;
  if ("Notification" in window && Notification.permission === "granted") {
    try {
      const notif = new Notification(title, notifOptions);
      notif.onclick = () => {
        window.focus();
        if (options.url) {
          window.location.href = options.url;
        }
        notif.close();
      };
      sentNative = true;
    } catch (e) {
      console.warn("Native Notification dispatch error (browser iframe policy):", e);
    }
  }

  // Always show in-app toast for visibility and fallback
  showInAppReminderToast(title, bodyText, options.url || "index.html#lessons");
  return sentNative;
}

function showInAppReminderToast(title, message, actionUrl) {
  const container = document.getElementById("reminderToastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = "reminder-toast";
  toast.setAttribute("role", "alert");
  toast.innerHTML = `
    <div class="reminder-toast-icon">🔔</div>
    <div class="reminder-toast-content">
      <div class="reminder-toast-title">${escapeHTML(title)}</div>
      <div class="reminder-toast-body">${escapeHTML(message)}</div>
      ${actionUrl ? `<a href="${actionUrl}" class="reminder-toast-action">Start Lesson →</a>` : ""}
    </div>
    <button type="button" class="reminder-toast-close" aria-label="Dismiss">✕</button>
  `;

  const closeBtn = toast.querySelector(".reminder-toast-close");
  const dismiss = () => {
    toast.classList.add("toast-hiding");
    setTimeout(() => toast.remove(), 260);
  };

  if (closeBtn) closeBtn.onclick = dismiss;
  const actionBtn = toast.querySelector(".reminder-toast-action");
  if (actionBtn) {
    actionBtn.addEventListener("click", () => {
      dismiss();
    });
  }

  container.appendChild(toast);

  setTimeout(() => {
    if (toast.parentNode) dismiss();
  }, 7500);
}

function checkAndTriggerDailyReminder() {
  const settings = getDailyReminderSettings();
  if (!settings.enabled) return;

  // If already completed daily goal today, no need to remind!
  if (hasCompletedDailyGoalToday()) {
    updateReminderGoalStatusUI();
    return;
  }

  const today = getLocalDateString();
  if (settings.lastNotifiedDate === today) {
    // Already notified today
    return;
  }

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [hStr, mStr] = (settings.time || "18:00").split(":");
  const targetMinutes = (parseInt(hStr, 10) || 0) * 60 + (parseInt(mStr, 10) || 0);

  if (currentMinutes >= targetMinutes) {
    // Trigger notification!
    sendBrowserNotification("LinguaPath Daily Lesson Reminder 🎯", {
      body: "You haven't completed a lesson yet today! Practice now to keep your streak burning 🔥",
      tag: "daily-study-reminder-" + today,
      url: "index.html#lessons"
    });

    settings.lastNotifiedDate = today;
    saveDailyReminderSettings(settings);
    updateReminderGoalStatusUI();
  }
}

function startDailyReminderScheduler() {
  checkAndTriggerDailyReminder();
  setInterval(checkAndTriggerDailyReminder, 60000);
}

function updateReminderBellUI() {
  const settings = getDailyReminderSettings();
  const dot = document.getElementById("reminderStatusDot");
  const bellBtn = document.getElementById("reminderBellBtn");

  if (dot) {
    if (settings.enabled) {
      dot.classList.add("active");
    } else {
      dot.classList.remove("active");
    }
  }

  if (bellBtn) {
    const formatted = formatReminderTimeDisplay(settings.time);
    if (settings.enabled) {
      bellBtn.setAttribute("title", `Daily Study Reminder active for ${formatted}. Click to change settings.`);
    } else {
      bellBtn.setAttribute("title", "Daily Study Reminder is paused. Click to enable.");
    }
  }
}

function updatePermissionCardUI() {
  const card = document.getElementById("reminderPermissionCard");
  const icon = document.getElementById("permissionIcon");
  const title = document.getElementById("permissionTitle");
  const text = document.getElementById("permissionStatusText");
  const btn = document.getElementById("requestPermissionBtn");
  if (!card) return;

  if (!("Notification" in window)) {
    card.className = "reminder-permission-card";
    if (icon) icon.textContent = "ℹ️";
    if (title) title.textContent = "In-App Notifications";
    if (text) text.textContent = "Browser Notification API is not supported in this browser; in-app reminder toasts will be used.";
    if (btn) btn.style.display = "none";
    return;
  }

  const perm = Notification.permission;
  if (perm === "granted") {
    card.className = "reminder-permission-card is-granted";
    if (icon) icon.textContent = "✅";
    if (title) title.textContent = "Browser Notifications Active";
    if (text) text.textContent = "Notifications are allowed. You'll receive system alerts even when this tab is in the background.";
    if (btn) btn.style.display = "none";
  } else if (perm === "denied") {
    card.className = "reminder-permission-card is-denied";
    if (icon) icon.textContent = "⚠️";
    if (title) title.textContent = "Browser Notifications Blocked";
    if (text) text.textContent = "Notifications are blocked in your browser settings. In-app reminder alerts will be used instead.";
    if (btn) btn.style.display = "none";
  } else {
    card.className = "reminder-permission-card";
    if (icon) icon.textContent = "🔔";
    if (title) title.textContent = "Enable Browser Alerts";
    if (text) text.textContent = "Allow browser notifications so you never miss your daily Chinese practice goal.";
    if (btn) {
      btn.style.display = "inline-flex";
      btn.textContent = "Allow";
    }
  }
}

function updateReminderGoalStatusUI() {
  const statusCard = document.getElementById("reminderGoalStatus");
  const icon = document.getElementById("goalStatusIcon");
  const title = document.getElementById("goalStatusTitle");
  const desc = document.getElementById("goalStatusDesc");
  if (!statusCard) return;

  const isCompleted = hasCompletedDailyGoalToday();
  const settings = getDailyReminderSettings();
  const formattedTime = formatReminderTimeDisplay(settings.time);

  if (isCompleted) {
    if (icon) icon.textContent = "🎉";
    if (title) title.textContent = "Daily Goal Completed!";
    if (desc) desc.textContent = "Great job! You've already completed a lesson today. Your daily streak is safe!";
  } else {
    if (icon) icon.textContent = "⏳";
    if (title) title.textContent = "Daily Goal Pending";
    if (desc) {
      if (settings.enabled) {
        desc.textContent = `You'll be prompted at ${formattedTime} if you haven't finished a lesson today.`;
      } else {
        desc.textContent = "No lesson completed yet today. Enable the reminder above to receive an alert!";
      }
    }
  }
}

function openReminderModal() {
  const modal = document.getElementById("reminderModal");
  if (!modal) return;

  const settings = getDailyReminderSettings();

  const toggle = document.getElementById("reminderToggle");
  if (toggle) {
    toggle.checked = settings.enabled;
  }

  const customInput = document.getElementById("reminderCustomTime");
  if (customInput) {
    customInput.value = settings.time || "18:00";
  }

  const chips = document.querySelectorAll("#reminderTimePresets .time-chip");
  chips.forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.time === settings.time);
  });

  const timeSection = document.getElementById("reminderTimeSection");
  if (timeSection) {
    timeSection.style.opacity = settings.enabled ? "1" : "0.5";
    timeSection.style.pointerEvents = settings.enabled ? "auto" : "none";
  }

  updatePermissionCardUI();
  updateReminderGoalStatusUI();

  modal.classList.add("active");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeReminderModal() {
  const modal = document.getElementById("reminderModal");
  if (!modal) return;
  modal.classList.remove("active");
  modal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function setupReminderUI() {
  const bellBtn = document.getElementById("reminderBellBtn");
  const modal = document.getElementById("reminderModal");
  const closeBtn = document.getElementById("closeReminderModalBtn");
  const saveBtn = document.getElementById("saveReminderBtn");
  const testBtn = document.getElementById("testNotificationBtn");
  const toggle = document.getElementById("reminderToggle");
  const customInput = document.getElementById("reminderCustomTime");
  const requestPermBtn = document.getElementById("requestPermissionBtn");
  const timePresets = document.querySelectorAll("#reminderTimePresets .time-chip");

  updateReminderBellUI();

  if (bellBtn) {
    bellBtn.addEventListener("click", () => {
      openReminderModal();
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", closeReminderModal);
  }

  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        closeReminderModal();
      }
    });
  }

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal && modal.classList.contains("active")) {
      closeReminderModal();
    }
  });

  if (toggle) {
    toggle.addEventListener("change", () => {
      const timeSection = document.getElementById("reminderTimeSection");
      if (timeSection) {
        timeSection.style.opacity = toggle.checked ? "1" : "0.5";
        timeSection.style.pointerEvents = toggle.checked ? "auto" : "none";
      }
      if (toggle.checked && "Notification" in window && Notification.permission === "default") {
        requestBrowserNotificationPermission();
      }
    });
  }

  timePresets.forEach((chip) => {
    chip.addEventListener("click", () => {
      timePresets.forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      if (customInput) {
        customInput.value = chip.dataset.time;
      }
    });
  });

  if (customInput) {
    customInput.addEventListener("input", () => {
      timePresets.forEach((c) => {
        c.classList.toggle("active", c.dataset.time === customInput.value);
      });
    });
  }

  if (requestPermBtn) {
    requestPermBtn.addEventListener("click", () => {
      requestBrowserNotificationPermission();
    });
  }

  if (testBtn) {
    testBtn.addEventListener("click", async () => {
      if ("Notification" in window && Notification.permission === "default") {
        await requestBrowserNotificationPermission();
      }
      const timeVal = customInput ? customInput.value : "18:00";
      sendBrowserNotification("LinguaPath Daily Reminder 🔔", {
        body: `Test successful! You'll be reminded at ${formatReminderTimeDisplay(timeVal)} if today's lesson isn't completed.`,
        url: "index.html#lessons"
      });
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      const enabled = toggle ? toggle.checked : true;
      const time = customInput ? (customInput.value || "18:00") : "18:00";
      const settings = getDailyReminderSettings();
      settings.enabled = enabled;
      settings.time = time;
      saveDailyReminderSettings(settings);
      closeReminderModal();
      showInAppReminderToast("Reminder Saved", `Daily reminder is ${enabled ? `active for ${formatReminderTimeDisplay(time)}` : "paused"}.`);
    });
  }

  window.addEventListener("storage", (e) => {
    if (e.key === DAILY_REMINDER_STORAGE_KEY) {
      updateReminderBellUI();
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
  const count = getFavorites().length;
  const favCountEl = document.getElementById("favoriteCount");
  if (favCountEl) {
    favCountEl.textContent = count;
  }
  const reviewBadge = document.getElementById("reviewFavoritesBadge");
  if (reviewBadge) {
    reviewBadge.textContent = `${count} saved`;
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
  const menuToggle = document.getElementById("menuToggle");
  const mainNav = document.getElementById("mainNav");
  const closeBtn = document.getElementById("hideMenuCloseBtn");

  if (!menuToggle || !mainNav) {
    return;
  }

  function closeMenu() {
    mainNav.classList.remove("active");
    menuToggle.setAttribute("aria-expanded", "false");
  }

  function openMenu() {
    mainNav.classList.add("active");
    menuToggle.setAttribute("aria-expanded", "true");
  }

  menuToggle.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = mainNav.classList.contains("active");
    if (isOpen) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  if (closeBtn) {
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      closeMenu();
      menuToggle.focus();
    });
  }

  // Prevent clicks inside mainNav from closing it unintentionally
  mainNav.addEventListener("click", (e) => {
    e.stopPropagation();
  });

  // Close when clicking outside
  document.addEventListener("click", (e) => {
    if (mainNav.classList.contains("active")) {
      closeMenu();
    }
  });

  // Close on Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && mainNav.classList.contains("active")) {
      closeMenu();
      menuToggle.focus();
    }
  });

  /*
    Close menu after clicking a navigation link.
  */
  mainNav.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", () => {
      closeMenu();
    });
  });
}


/* =========================================================
   DARK / LIGHT THEME TOGGLE
========================================================= */

function setupThemeToggle() {
  const themeToggleBtn = document.getElementById("themeToggleBtn");
  if (!themeToggleBtn) {
    return;
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    const isDark = theme === "dark";
    themeToggleBtn.setAttribute(
      "aria-label",
      isDark ? "Switch to light mode" : "Switch to dark mode"
    );
    themeToggleBtn.setAttribute(
      "title",
      isDark ? "Switch to light mode" : "Switch to dark mode for late-night learning sessions"
    );
    themeToggleBtn.setAttribute("aria-pressed", isDark ? "true" : "false");
    try {
      localStorage.setItem("linguapath_theme", theme);
    } catch (e) {}
  }

  const savedTheme = localStorage.getItem("linguapath_theme");
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const initialTheme = savedTheme || (prefersDark ? "dark" : "light");
  applyTheme(initialTheme);

  themeToggleBtn.addEventListener("click", () => {
    const currentTheme = document.documentElement.getAttribute("data-theme") || "light";
    const nextTheme = currentTheme === "dark" ? "light" : "dark";
    applyTheme(nextTheme);
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
   REVIEW MODE FLASHCARDS QUEUE (FAVORITE LESSONS PRACTICE)
========================================================= */

let reviewQueue = [];
let currentReviewIndex = 0;
let masteredCardsCount = 0;
let practiceCardsCount = 0;
let firstTryMasteredCount = 0;
let totalCardsInSession = 0;
let cardAttemptsMap = {};
let isReviewFlipped = false;
let reviewModeInitialized = false;

function setupReviewMode() {
  updateFavoriteCountBadge();

  if (reviewModeInitialized) {
    return;
  }
  reviewModeInitialized = true;

  // Trigger buttons (filter bar & header navigation)
  const startBtn = document.getElementById("startReviewModeBtn");
  if (startBtn) {
    startBtn.addEventListener("click", (e) => {
      e.preventDefault();
      startReviewMode(false);
    });
  }

  const navBtn = document.getElementById("navReviewModeBtn");
  if (navBtn) {
    navBtn.addEventListener("click", (e) => {
      e.preventDefault();
      startReviewMode(false);
    });
  }

  // Close buttons
  const closeBtn = document.getElementById("closeReviewModalBtn");
  if (closeBtn) {
    closeBtn.addEventListener("click", closeReviewModal);
  }

  const emptyCloseBtn = document.getElementById("closeReviewEmptyBtn");
  if (emptyCloseBtn) {
    emptyCloseBtn.addEventListener("click", () => {
      closeReviewModal();
      const lessonsSec = document.getElementById("lessons");
      if (lessonsSec) {
        lessonsSec.scrollIntoView({ behavior: "smooth" });
      }
    });
  }

  const summaryCloseBtn = document.getElementById("summaryCloseBtn");
  if (summaryCloseBtn) {
    summaryCloseBtn.addEventListener("click", closeReviewModal);
  }

  // Fallback to all lessons when favorites empty
  const fallbackBtn = document.getElementById("reviewAllLessonsFallbackBtn");
  if (fallbackBtn) {
    fallbackBtn.addEventListener("click", () => {
      startReviewMode(true);
    });
  }

  // Reshuffle queue button
  const reshuffleBtn = document.getElementById("reshuffleQueueBtn");
  if (reshuffleBtn) {
    reshuffleBtn.addEventListener("click", handleReshuffleReviewQueue);
  }

  // Restart practice from summary
  const restartBtn = document.getElementById("summaryRestartShuffledBtn");
  if (restartBtn) {
    restartBtn.addEventListener("click", () => {
      startReviewMode(false);
    });
  }

  // Flip card controls
  const flipBtn = document.getElementById("reviewFlipCardBtn");
  if (flipBtn) {
    flipBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleFlashcardFlip();
    });
  }

  const flashcardContainer = document.getElementById("flashcardContainer");
  if (flashcardContainer) {
    flashcardContainer.addEventListener("click", (e) => {
      if (e.target.closest("button") || e.target.closest(".card-audio-btn")) {
        return;
      }
      toggleFlashcardFlip();
    });
  }

  // Got it & Need Practice action buttons
  const gotItBtn = document.getElementById("reviewGotItBtn");
  if (gotItBtn) {
    gotItBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      handleReviewGotIt();
    });
  }

  const needPracticeBtn = document.getElementById("reviewNeedPracticeBtn");
  if (needPracticeBtn) {
    needPracticeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      handleReviewNeedPractice();
    });
  }

  // Audio Pronunciation buttons
  const frontAudioBtn = document.getElementById("cardFrontAudioBtn");
  if (frontAudioBtn) {
    frontAudioBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      playCurrentReviewAudio(frontAudioBtn);
    });
  }

  const backAudioBtn = document.getElementById("cardBackAudioBtn");
  if (backAudioBtn) {
    backAudioBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      playCurrentReviewAudio(backAudioBtn);
    });
  }

  // Close when clicking modal backdrop
  const modal = document.getElementById("reviewModal");
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        closeReviewModal();
      }
    });
  }

  // Global Keyboard Shortcuts for Review Mode
  document.addEventListener("keydown", handleReviewKeyboardShortcuts);

  // Check URL hash for direct entry (#review)
  if (window.location.hash === "#review") {
    setTimeout(() => {
      startReviewMode(false);
    }, 250);
  }

  window.addEventListener("hashchange", () => {
    if (window.location.hash === "#review") {
      startReviewMode(false);
    }
  });
}

function startReviewMode(forceAll = false) {
  const modal = document.getElementById("reviewModal");
  if (!modal) return;

  updateFavoriteCountBadge();

  const favs = getFavorites();
  const targetIds = forceAll || favs.length === 0
    ? (forceAll ? (lessonData || []).map((l, i) => l.id || l.lessonId || `lesson-0${i + 1}`) : [])
    : favs;

  modal.classList.add("active");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";

  const emptyState = document.getElementById("reviewEmptyState");
  const cardArea = document.getElementById("reviewCardArea");
  const summaryScreen = document.getElementById("reviewSummaryScreen");

  if (!forceAll && favs.length === 0) {
    if (emptyState) emptyState.style.display = "block";
    if (cardArea) cardArea.style.display = "none";
    if (summaryScreen) summaryScreen.style.display = "none";

    const fill = document.getElementById("reviewProgressFill");
    if (fill) fill.style.width = "0%";
    const counter = document.getElementById("reviewCardCounter");
    if (counter) counter.textContent = "0 cards available";
    const mastered = document.getElementById("reviewMasteredCount");
    if (mastered) mastered.textContent = "0";
    const practice = document.getElementById("reviewPracticeCount");
    if (practice) practice.textContent = "0";
    return;
  }

  if (emptyState) emptyState.style.display = "none";
  if (summaryScreen) summaryScreen.style.display = "none";
  if (cardArea) cardArea.style.display = "block";

  // Gather cards
  const cards = getReviewCardsForFavorites(targetIds);
  if (cards.length === 0) {
    // If favorites returned no cards, fallback to all lessons
    const allLessonCards = getReviewCardsForFavorites(
      (lessonData || []).map((l, i) => l.id || l.lessonId || `lesson-0${i + 1}`)
    );
    reviewQueue = shuffleCardsArray(allLessonCards);
  } else {
    reviewQueue = shuffleCardsArray(cards);
  }

  totalCardsInSession = reviewQueue.length;
  currentReviewIndex = 0;
  masteredCardsCount = 0;
  practiceCardsCount = 0;
  firstTryMasteredCount = 0;
  cardAttemptsMap = {};

  renderCurrentReviewCard();
}

function closeReviewModal() {
  const modal = document.getElementById("reviewModal");
  if (modal) {
    modal.classList.remove("active");
    modal.setAttribute("aria-hidden", "true");
  }
  document.body.style.overflow = "";
  stopAllDemoAudio();

  if (window.location.hash === "#review") {
    if (window.history && window.history.pushState) {
      window.history.pushState(null, "", window.location.pathname + window.location.search);
    } else {
      window.location.hash = "";
    }
  }
}

function getReviewCardsForFavorites(favoriteIds) {
  const norm = (s) => String(s || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  const targetNorms = (favoriteIds || []).map(norm);
  const cards = [];

  // Match lessons
  (lessonData || []).forEach((row, index) => {
    const rawId = row.id || row.lessonId || `lesson-0${index + 1}`;
    const rNorm = norm(rawId);
    const isTarget = targetNorms.includes(rNorm) ||
      targetNorms.some(t => t && (rNorm.includes(t) || t.includes(rNorm)));

    if (!isTarget) return;

    const lessonTitle = row.title || row.chineseTitle || rawId;

    // 1. Gather vocabulary rows for this lesson
    const matchingVocab = (vocabularyData || []).filter((v) => {
      const vLesson = norm(v.lessonId || v.lesson_id || v.id);
      return vLesson === rNorm || vLesson.includes(rNorm) || rNorm.includes(vLesson);
    });

    if (matchingVocab.length > 0) {
      matchingVocab.forEach((v, vIndex) => {
        const char = v.character || v.chinese || "";
        // Find matching story sentence for context
        const matchingStory = (storyData || []).find((s) => {
          const sLesson = norm(s.lessonId || s.lesson_id || s.id);
          const sameLesson = sLesson === rNorm || sLesson.includes(rNorm) || rNorm.includes(sLesson);
          const sText = String(s.chinese || s.character || "");
          return sameLesson && sText.includes(char);
        });

        cards.push({
          id: `${rawId}-vocab-${v.order || vIndex + 1}`,
          lessonId: rawId,
          source: `${lessonTitle} • Vocabulary`,
          character: char,
          pinyin: v.pinyin || "",
          meaning: v.meaning || v.english || "",
          audio: v.audio || "",
          contextChinese: matchingStory ? matchingStory.chinese : "",
          contextEnglish: matchingStory ? matchingStory.english : ""
        });
      });
    } else {
      // Create flashcard from core lesson info
      cards.push({
        id: `${rawId}-core`,
        lessonId: rawId,
        source: `${lessonTitle} • Core Lesson`,
        character: row.chineseTitle || row.title || "",
        pinyin: row.pinyin || "",
        meaning: row.meaning || row.description || row.title || "",
        audio: row.audio || "",
        contextChinese: row.chineseTitle ? `${row.chineseTitle} - ${row.title || ""}` : "",
        contextEnglish: row.description || ""
      });
    }
  });

  return cards;
}

function shuffleCardsArray(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function renderCurrentReviewCard() {
  if (currentReviewIndex >= reviewQueue.length) {
    showReviewSummary();
    return;
  }

  const card = reviewQueue[currentReviewIndex];
  isReviewFlipped = false;

  const inner = document.getElementById("flashcardInner");
  if (inner) {
    inner.classList.remove("is-flipped");
  }

  // Front card
  const frontTag = document.getElementById("cardSourceTag");
  const frontChar = document.getElementById("cardFrontChar");
  if (frontTag) frontTag.textContent = card.source;
  if (frontChar) frontChar.textContent = card.character;

  // Back card
  const backTag = document.getElementById("cardBackSourceTag");
  const backChar = document.getElementById("cardBackChar");
  const backPinyin = document.getElementById("cardBackPinyin");
  const backMeaning = document.getElementById("cardBackMeaning");
  const contextBox = document.getElementById("cardBackContext");
  const contextZh = document.getElementById("cardContextChinese");
  const contextEn = document.getElementById("cardContextEnglish");

  if (backTag) backTag.textContent = card.source;
  if (backChar) backChar.textContent = card.character;
  if (backPinyin) backPinyin.textContent = card.pinyin;
  if (backMeaning) backMeaning.textContent = card.meaning;

  if (card.contextChinese) {
    if (contextBox) contextBox.style.display = "inline-flex";
    if (contextZh) contextZh.textContent = card.contextChinese;
    if (contextEn) contextEn.textContent = card.contextEnglish;
  } else {
    if (contextBox) contextBox.style.display = "none";
  }

  // Reset audio button states
  const frontAudioBtn = document.getElementById("cardFrontAudioBtn");
  const backAudioBtn = document.getElementById("cardBackAudioBtn");
  [frontAudioBtn, backAudioBtn].forEach((btn) => {
    if (btn) {
      btn.textContent = "🔊 Pronounce";
      btn.classList.remove("playing");
    }
  });

  // Progress Bar & Meta
  const fill = document.getElementById("reviewProgressFill");
  const counter = document.getElementById("reviewCardCounter");
  const mastered = document.getElementById("reviewMasteredCount");
  const practice = document.getElementById("reviewPracticeCount");

  const progressPercent = totalCardsInSession > 0
    ? Math.min(100, Math.round((currentReviewIndex / totalCardsInSession) * 100))
    : 0;

  if (fill) fill.style.width = `${progressPercent}%`;
  if (counter) counter.textContent = `Card ${currentReviewIndex + 1} of ${reviewQueue.length}`;
  if (mastered) mastered.textContent = masteredCardsCount;
  if (practice) practice.textContent = Math.max(0, reviewQueue.length - currentReviewIndex);

  const container = document.getElementById("flashcardContainer");
  if (container) {
    container.focus();
  }
}

function toggleFlashcardFlip() {
  const inner = document.getElementById("flashcardInner");
  if (!inner) return;
  isReviewFlipped = !isReviewFlipped;
  inner.classList.toggle("is-flipped", isReviewFlipped);
}

function handleReviewGotIt() {
  const card = reviewQueue[currentReviewIndex];
  if (!card) return;

  const priorAttempts = cardAttemptsMap[card.id] || 0;
  if (priorAttempts === 0) {
    firstTryMasteredCount++;
  }
  masteredCardsCount++;
  playFeedbackSound(true);

  currentReviewIndex++;
  renderCurrentReviewCard();
}

function handleReviewNeedPractice() {
  const card = reviewQueue[currentReviewIndex];
  if (!card) return;

  cardAttemptsMap[card.id] = (cardAttemptsMap[card.id] || 0) + 1;
  practiceCardsCount++;
  playFeedbackSound(false);

  // Re-queue card to end of queue for repeated practice
  reviewQueue.push(card);

  currentReviewIndex++;
  renderCurrentReviewCard();
}

function handleReshuffleReviewQueue() {
  if (currentReviewIndex >= reviewQueue.length) return;

  const currentAndRemaining = reviewQueue.slice(currentReviewIndex);
  const shuffled = shuffleCardsArray(currentAndRemaining);
  reviewQueue = [...reviewQueue.slice(0, currentReviewIndex), ...shuffled];

  renderCurrentReviewCard();

  const reshuffleBtn = document.getElementById("reshuffleQueueBtn");
  if (reshuffleBtn) {
    const originalText = reshuffleBtn.innerHTML;
    reshuffleBtn.innerHTML = "✨ Shuffled!";
    setTimeout(() => {
      reshuffleBtn.innerHTML = originalText;
    }, 1200);
  }
}

function playCurrentReviewAudio(button) {
  const card = reviewQueue[currentReviewIndex];
  if (!card) return;

  playAudioWithSpeechFallback(
    card.audio,
    button,
    "🔊 Pronounce",
    "🔊 Playing...",
    card.character
  );
}

function showReviewSummary() {
  const cardArea = document.getElementById("reviewCardArea");
  const summaryScreen = document.getElementById("reviewSummaryScreen");

  if (cardArea) cardArea.style.display = "none";
  if (summaryScreen) summaryScreen.style.display = "block";

  const totalEl = document.getElementById("summaryTotalCards");
  const masteredEl = document.getElementById("summaryMasteredCards");
  const accuracyEl = document.getElementById("summaryAccuracy");
  const fill = document.getElementById("reviewProgressFill");
  const counter = document.getElementById("reviewCardCounter");

  if (fill) fill.style.width = "100%";
  if (counter) counter.textContent = `Completed ${totalCardsInSession} of ${totalCardsInSession}`;

  if (totalEl) totalEl.textContent = totalCardsInSession;
  if (masteredEl) masteredEl.textContent = masteredCardsCount;

  const accuracy = totalCardsInSession > 0
    ? Math.round((firstTryMasteredCount / totalCardsInSession) * 100)
    : 100;
  if (accuracyEl) accuracyEl.textContent = `${accuracy}%`;

  // Celebratory sound
  playFeedbackSound(true);
}

function handleReviewKeyboardShortcuts(e) {
  const modal = document.getElementById("reviewModal");
  if (!modal || !modal.classList.contains("active")) {
    return;
  }

  // Ignore keystrokes when typing in inputs
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
    return;
  }

  const cardArea = document.getElementById("reviewCardArea");
  const isCardAreaVisible = cardArea && cardArea.style.display !== "none";

  if (e.key === "Escape") {
    e.preventDefault();
    closeReviewModal();
    return;
  }

  if (!isCardAreaVisible) {
    return;
  }

  if (e.code === "Space") {
    e.preventDefault();
    toggleFlashcardFlip();
  } else if (e.key === "ArrowRight" || e.key === "2") {
    e.preventDefault();
    handleReviewGotIt();
  } else if (e.key === "ArrowLeft" || e.key === "1") {
    e.preventDefault();
    handleReviewNeedPractice();
  } else if (e.key === "a" || e.key === "A") {
    e.preventDefault();
    const frontAudioBtn = document.getElementById("cardFrontAudioBtn");
    const backAudioBtn = document.getElementById("cardBackAudioBtn");
    const targetAudioBtn = isReviewFlipped ? backAudioBtn : frontAudioBtn;
    playCurrentReviewAudio(targetAudioBtn);
  }
}


/* =========================================================
   FEATURED REELS & VIDEO MODAL INTERACTIONS
========================================================= */

function setupReelsInteractions() {
  const reelCards = document.querySelectorAll(".reel-card");
  const modal = document.getElementById("reelModal");
  const modalVideo = document.getElementById("reelModalVideo");
  const modalTitle = document.getElementById("reelModalTitle");
  const modalDesc = document.getElementById("reelModalDesc");
  const closeBtn = document.getElementById("closeReelModalBtn");

  if (!reelCards.length) return;

  reelCards.forEach((card) => {
    const previewVideo = card.querySelector(".reel-preview-video");

    // Desktop hover preview (muted playback)
    card.addEventListener("mouseenter", () => {
      if (previewVideo && previewVideo.paused) {
        previewVideo.play().catch(() => {});
      }
    });

    card.addEventListener("mouseleave", () => {
      if (previewVideo && !previewVideo.paused) {
        previewVideo.pause();
      }
    });

    // Click to open Reel Video Player Modal
    card.addEventListener("click", () => {
      const videoSrc = card.dataset.video || (previewVideo && previewVideo.querySelector("source") ? previewVideo.querySelector("source").src : "");
      const title = card.dataset.title || "Chinese Reel Video";
      const desc = card.dataset.desc || "Bite-sized culture and Mandarin dialogue.";

      if (modal && modalVideo) {
        modalVideo.src = videoSrc;
        if (modalTitle) modalTitle.textContent = title;
        if (modalDesc) modalDesc.textContent = desc;

        modal.classList.add("active");
        modal.setAttribute("aria-hidden", "false");
        modalVideo.currentTime = 0;
        modalVideo.play().catch(() => {});
      }
    });
  });

  function closeReelModal() {
    if (!modal) return;
    modal.classList.remove("active");
    modal.setAttribute("aria-hidden", "true");
    if (modalVideo) {
      modalVideo.pause();
      modalVideo.removeAttribute("src");
      modalVideo.load();
    }
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      closeReelModal();
    });
  }

  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        closeReelModal();
      }
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal && modal.classList.contains("active")) {
      closeReelModal();
    }
  });
}


/* =========================================================
   GLOBAL DEBUG ACCESS
========================================================= */

window.linguaPath = {

  getWorkbook: () => workbook,

  getDemoData: () => demoData,

  getLessonData: () => lessonData,

  getVocabularyData: () => vocabularyData,

  getStoryData: () => storyData,

  getPronunciationData:
    () => pronunciationData,

  getEverydayChineseData:
    () => everydayChineseData,

  getConversationData:
    () => conversationData,

  getQuickCheckData:
    () => quickCheckData,

  startReviewMode: (forceAll = false) => startReviewMode(forceAll),

  closeReviewModal: () => closeReviewModal(),

  getReviewQueue: () => reviewQueue

};

