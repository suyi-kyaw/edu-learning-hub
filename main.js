/* =========================================================
   LINGUAPATH - MAIN.JS
   =========================================================
   
   This file handles:
   1. Excel lesson data loading
   2. Pinyin tone buttons
   3. Tone curves
   4. Native tone MP3 playback
   5. Chinese speech synthesis
   ========================================================= */


/* =========================================================
   EXCEL DATA
   ========================================================= */

const EXCEL_FILE = "./data/lessons.xlsx";

/*
   All lesson data loaded from Excel will be stored here.

   Expected Excel sheets:

   Lessons
   Story
   Vocabulary
   Exercises
*/

let lessonData = {
  lessons: [],
  story: [],
  vocabulary: [],
  exercises: []
};


/* =========================================================
   LOAD EXCEL DATA
   ========================================================= */

async function loadExcelData() {

  try {

    /* Check that SheetJS is available */

    if (typeof XLSX === "undefined") {

      console.error(
        "SheetJS is not loaded. " +
        "Make sure this is included before main.js:"
      );

      console.error(
        '<script src="https://cdn.jsdelivr.net/npm/xlsx/dist/xlsx.full.min.js"></script>'
      );

      return null;
    }


    /* Download Excel file */

    const response =
      await fetch(EXCEL_FILE);


    if (!response.ok) {

      throw new Error(
        `Could not load ${EXCEL_FILE}. ` +
        `HTTP status: ${response.status}`
      );

    }


    /* Convert file to ArrayBuffer */

    const arrayBuffer =
      await response.arrayBuffer();


    /* Read Excel workbook */

    const workbook =
      XLSX.read(arrayBuffer, {
        type: "array"
      });


    /* Read each sheet */

    lessonData.lessons =
      readExcelSheet(
        workbook,
        "Lessons"
      );


    lessonData.story =
      readExcelSheet(
        workbook,
        "Story"
      );


    lessonData.vocabulary =
      readExcelSheet(
        workbook,
        "Vocabulary"
      );


    lessonData.exercises =
      readExcelSheet(
        workbook,
        "Exercises"
      );


    console.log(
      "LinguaPath Excel data loaded successfully."
    );

    console.log(
      "Lessons:",
      lessonData.lessons
    );

    console.log(
      "Story:",
      lessonData.story
    );

    console.log(
      "Vocabulary:",
      lessonData.vocabulary
    );

    console.log(
      "Exercises:",
      lessonData.exercises
    );


    /*
       Make data available globally.

       Other JS files can use:

       window.lessonData.lessons
       window.lessonData.story
       window.lessonData.vocabulary
       window.lessonData.exercises
    */

    window.lessonData =
      lessonData;


    /*
       Optional event for other scripts.

       Example:

       document.addEventListener(
         "lessonDataLoaded",
         () => {
           // Do something
         }
       );
    */

    document.dispatchEvent(
      new CustomEvent(
        "lessonDataLoaded",
        {
          detail: lessonData
        }
      )
    );


    return lessonData;


  } catch (error) {

    console.error(
      "Error loading Excel lesson data:",
      error
    );


    /*
       Show a warning only if the Excel file
       is expected on this page.
    */

    showExcelError();


    return null;
  }
}


/* =========================================================
   READ EXCEL SHEET
   ========================================================= */

function readExcelSheet(
  workbook,
  sheetName
) {

  const sheet =
    workbook.Sheets[sheetName];


  /*
     If the sheet doesn't exist,
     return an empty array instead
     of breaking the whole website.
  */

  if (!sheet) {

    console.warn(
      `Excel sheet "${sheetName}" was not found.`
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
   EXCEL ERROR MESSAGE
   ========================================================= */

function showExcelError() {

  /*
     Don't create duplicate messages.
  */

  if (
    document.getElementById(
      "excelDataError"
    )
  ) {
    return;
  }


  const message =
    document.createElement("div");


  message.id =
    "excelDataError";


  message.style.cssText = `
    position: fixed;
    left: 20px;
    right: 20px;
    bottom: 20px;
    z-index: 9999;

    background: #fff1f2;
    color: #9f1239;

    border: 1px solid #fecdd3;
    border-radius: 12px;

    padding: 16px 20px;

    font-family: system-ui, sans-serif;
    font-size: 14px;

    box-shadow:
      0 10px 30px rgba(0,0,0,0.12);
  `;


  message.innerHTML = `
    <strong>Lesson data could not be loaded.</strong>
    <br>
    Please make sure
    <code>data/lessons.xlsx</code>
    exists and is accessible.
  `;


  document.body.appendChild(
    message
  );
}


/* =========================================================
   TONE DATA
   ========================================================= */

const toneData = {

  1: {

    syllable: "mā",

    character: "妈",

    meaning: "mother",

    text:
      "Tone 1 — high and flat",

    path:
      "M20 30 L480 30",

    audio:
      "./assets/audio/tones/ma-tone-1.mp3"
  },


  2: {

    syllable: "má",

    character: "麻",

    meaning: "hemp / numb",

    text:
      "Tone 2 — rising",

    path:
      "M20 70 C170 70 320 65 480 20",

    audio:
      "./assets/audio/tones/ma-tone-2.mp3"
  },


  3: {

    syllable: "mǎ",

    character: "马",

    meaning: "horse",

    text:
      "Tone 3 — dipping",

    path:
      "M20 35 C130 85 230 85 300 70 C370 55 420 30 480 25",

    audio:
      "./assets/audio/tones/ma-tone-3.mp3"
  },


  4: {

    syllable: "mà",

    character: "骂",

    meaning: "scold",

    text:
      "Tone 4 — falling",

    path:
      "M20 20 C180 25 330 65 480 85",

    audio:
      "./assets/audio/tones/ma-tone-4.mp3"
  }

};


/* =========================================================
   TONE ELEMENTS
   ========================================================= */

const toneButtons =
  document.querySelectorAll(
    ".tone-button"
  );


const tonePath =
  document.getElementById(
    "tonePath"
  );


const toneDescription =
  document.getElementById(
    "toneDescription"
  );


let currentToneAudio =
  null;


/* =========================================================
   PLAY TONE
   ========================================================= */

function playTone(
  number,
  button
) {

  const tone =
    toneData[number];


  if (!tone) {

    console.error(
      "Tone data not found:",
      number
    );

    return;
  }


  /* -------------------------------------------------------
     Remove active state
     ------------------------------------------------------- */

  toneButtons.forEach(
    item => {

      item.classList.remove(
        "active"
      );

    }
  );


  /* -------------------------------------------------------
     Activate selected button
     ------------------------------------------------------- */

  if (button) {

    button.classList.add(
      "active"
    );

  }


  /* -------------------------------------------------------
     Update tone curve
     ------------------------------------------------------- */

  if (tonePath) {

    tonePath.setAttribute(
      "d",
      tone.path
    );

  }


  /* -------------------------------------------------------
     Update description
     ------------------------------------------------------- */

  if (toneDescription) {

    toneDescription.innerHTML =
      `<strong>${tone.syllable}</strong> — ` +
      `${tone.character} — ` +
      `${tone.meaning}<br>` +
      `${tone.text}`;

  }


  /* -------------------------------------------------------
     Stop previous audio
     ------------------------------------------------------- */

  if (currentToneAudio) {

    currentToneAudio.pause();

    currentToneAudio.currentTime = 0;

    currentToneAudio = null;
  }


  /* -------------------------------------------------------
     Create new audio
     ------------------------------------------------------- */

  currentToneAudio =
    new Audio();


  currentToneAudio.preload =
    "auto";


  currentToneAudio.src =
    tone.audio;


  /* -------------------------------------------------------
     Audio error
     ------------------------------------------------------- */

  currentToneAudio.addEventListener(
    "error",
    () => {

      console.error(
        "Could not load audio file:",
        tone.audio
      );


      alert(
        `Audio file could not be loaded:\n\n` +
        `${tone.audio}\n\n` +
        `Please check that the MP3 exists ` +
        `and that the filename is exactly correct.`
      );

    }
  );


  /* -------------------------------------------------------
     Play audio
     ------------------------------------------------------- */

  currentToneAudio
    .play()
    .then(() => {

      console.log(
        `Playing ${tone.syllable}:`,
        tone.audio
      );

    })
    .catch(error => {

      console.error(
        "Audio playback failed:",
        error
      );

    });

}


/* =========================================================
   TONE BUTTONS
   ========================================================= */

toneButtons.forEach(
  button => {

    button.addEventListener(
      "click",
      () => {

        const toneNumber =
          Number(
            button.dataset.tone
          );


        playTone(
          toneNumber,
          button
        );

      }
    );

  }
);


/* =========================================================
   INITIAL TONE
   ========================================================= */

if (
  tonePath &&
  toneDescription
) {

  tonePath.setAttribute(
    "d",
    toneData[1].path
  );


  toneDescription.innerHTML =
    `<strong>${toneData[1].syllable}</strong> — ` +
    `${toneData[1].character} — ` +
    `${toneData[1].meaning}<br>` +
    `${toneData[1].text}`;

}


/* =========================================================
   CHINESE SPEECH
   ========================================================= */

function speak(text) {

  if (
    !("speechSynthesis" in window)
  ) {

    console.warn(
      "Speech synthesis is not supported."
    );

    return;
  }


  /*
     Stop anything currently speaking.
  */

  window.speechSynthesis.cancel();


  const utterance =
    new SpeechSynthesisUtterance(
      text
    );


  utterance.lang =
    "zh-CN";


  utterance.rate =
    0.8;


  utterance.pitch =
    1;


  /*
     Try to find a Chinese voice.
  */

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


  window.speechSynthesis.speak(
    utterance
  );
}


/* =========================================================
   HERO AUDIO
   ========================================================= */

const heroAudioButton =
  document.getElementById(
    "heroAudioButton"
  );


if (heroAudioButton) {

  heroAudioButton.addEventListener(
    "click",
    () => {

      speak("学");

    }
  );

}


/* =========================================================
   GREETING AUDIO
   ========================================================= */

const greetingAudioButton =
  document.getElementById(
    "greetingAudioButton"
  );


if (greetingAudioButton) {

  greetingAudioButton.addEventListener(
    "click",
    () => {

      speak("你好");

    }
  );

}


/* =========================================================
   LOAD CHINESE VOICES
   ========================================================= */

if (
  "speechSynthesis" in window
) {

  window.speechSynthesis
    .addEventListener(
      "voiceschanged",
      () => {

        window.speechSynthesis
          .getVoices();

      }
    );

}


/* =========================================================
   INITIALIZE
   ========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  () => {

    /*
       Load Excel after the page
       has loaded.

       This does NOT interfere with
       your tone buttons.
    */

    loadExcelData();

  }
);