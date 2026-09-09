
/* =========================================================
   LINGUAPATH LEARNING HUB
   Main JavaScript
   ========================================================= */


/* ==================== TEXT TO SPEECH ==================== */

/*
  Uses the browser's built-in Speech Synthesis API.

  This is useful for the demo.
  For a production language-learning platform,
  replace this with professionally recorded native audio.
*/

function speak(text) {

  if (!("speechSynthesis" in window)) {
    alert("Your browser does not support text-to-speech.");
    return;
  }

  // Stop any speech currently playing.
  window.speechSynthesis.cancel();

  const utterance =
    new SpeechSynthesisUtterance(text);

  const voices =
    window.speechSynthesis.getVoices();

  // Try to find a Chinese voice.
  const chineseVoice =
    voices.find(
      voice =>
        voice.lang
          .toLowerCase()
          .startsWith("zh")
    );

  if (chineseVoice) {
    utterance.voice = chineseVoice;
  }

  utterance.lang = "zh-CN";

  // Slightly slower pronunciation
  // is useful for a learning demo.
  utterance.rate = 0.75;

  utterance.pitch = 1;

  window.speechSynthesis.speak(
    utterance
  );
}


/* ==================== HERO AUDIO ==================== */

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


/* ==================== GREETING AUDIO ==================== */

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


/* ==================== TONE DATA ==================== */

const toneData = {
  1: {
    text: "Tone 1 — high and flat",
    path: "M20 30 L480 30",
    audio: "assets/audio/tones/ma-tone-1.mp3"
  },

  2: {
    text: "Tone 2 — rising",
    path: "M20 70 C170 70 320 65 480 20",
    audio: "assets/audio/tones/ma-tone-2.mp3"
  },

  3: {
    text: "Tone 3 — dipping",
    path: "M20 35 C130 85 230 85 300 70 C370 55 420 30 480 25",
    audio: "assets/audio/tones/ma-tone-3.mp3"
  },

  4: {
    text: "Tone 4 — falling",
    path: "M20 20 C180 25 330 65 480 85",
    audio: "assets/audio/tones/ma-tone-4.mp3"
  }
};


/* ==================== TONE AUDIO PLAYER ==================== */

let currentToneAudio = null;

function playTone(number, button) {

  const data = toneData[number];

  if (!data) {
    return;
  }


  /* Remove active state */
  toneButtons.forEach(item => {
    item.classList.remove("active");
  });


  /* Activate selected tone */
  button.classList.add("active");


  /* Update tone curve */
  if (tonePath) {
    tonePath.setAttribute(
      "d",
      data.path
    );
  }


  /* Update description */
  if (toneDescription) {
    toneDescription.textContent =
      data.text;
  }


  /* Stop previous audio */
  if (currentToneAudio) {
    currentToneAudio.pause();
    currentToneAudio.currentTime = 0;
  }


  /* Play the actual native recording */
  currentToneAudio =
    new Audio(data.audio);


  currentToneAudio.play()
    .catch(error => {
      console.error(
        "Unable to play tone audio:",
        error
      );
    });

}


/* ==================== TONE BUTTONS ==================== */

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


toneButtons.forEach(button => {

  button.addEventListener(
    "click",
    () => {

      const toneNumber =
        Number(button.dataset.tone);

      playTone(
        toneNumber,
        button
      );

    }
  );

});


/* ==================== QUIZ ==================== */

const quizOptions =
  document.querySelectorAll(
    ".quiz-option"
  );

const quizFeedback =
  document.getElementById(
    "quizFeedback"
  );


quizOptions.forEach(option => {

  option.addEventListener(
    "click",
    () => {

      const isCorrect =
        option.dataset.correct === "true";


      // Reset previous selections.
      quizOptions.forEach(item => {

        item.classList.remove(
          "correct",
          "wrong"
        );

      });


      if (isCorrect) {

        option.classList.add(
          "correct"
        );

        if (quizFeedback) {

          quizFeedback.innerHTML =
            "✓ <strong>Correct!</strong> 妈 (mā) uses the first tone: a high, flat pitch.";

        }

        speak("妈");

      } else {

        option.classList.add(
          "wrong"
        );

        if (quizFeedback) {

          quizFeedback.innerHTML =
            "✕ <strong>Not quite.</strong> 妈 (mā) uses the first tone, which stays high and flat.";

        }

      }

    }
  );

});


/* ==================== DIALOGUE ==================== */

let dialogueTimer = null;


const speakerOne =
  document.getElementById(
    "speaker1"
  );

const speakerTwo =
  document.getElementById(
    "speaker2"
  );

const playDialogueButton =
  document.getElementById(
    "playDialogueButton"
  );

const stopDialogueButton =
  document.getElementById(
    "stopDialogueButton"
  );


/*
  Start the sample dialogue.
*/
function playDialogue() {

  stopDialogue();


  // Highlight Speaker A.
  if (speakerOne) {
    speakerOne.classList.add(
      "active"
    );
  }

  if (speakerTwo) {
    speakerTwo.classList.remove(
      "active"
    );
  }


  // Play Speaker A.
  speak(
    "你好！你好吗？"
  );


  /*
    Move the highlight to Speaker B
    after the first line.
  */
  dialogueTimer =
    setTimeout(() => {

      if (speakerOne) {
        speakerOne.classList.remove(
          "active"
        );
      }

      if (speakerTwo) {
        speakerTwo.classList.add(
          "active"
        );
      }

      speak(
        "我很好，谢谢！"
      );

    }, 2500);

}


/*
  Stop dialogue playback.
*/
function stopDialogue() {

  // Clear pending timer.
  if (dialogueTimer) {

    clearTimeout(
      dialogueTimer
    );

    dialogueTimer = null;

  }


  // Stop speech.
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }


  // Remove highlighting.
  if (speakerOne) {
    speakerOne.classList.remove(
      "active"
    );
  }

  if (speakerTwo) {
    speakerTwo.classList.remove(
      "active"
    );
  }

}


/* ==================== DIALOGUE BUTTONS ==================== */

if (playDialogueButton) {

  playDialogueButton.addEventListener(
    "click",
    playDialogue
  );

}


if (stopDialogueButton) {

  stopDialogueButton.addEventListener(
    "click",
    stopDialogue
  );

}


/* ==================== SPEECH VOICE LOADING ==================== */

/*
  Some browsers load available voices
  asynchronously.

  Calling getVoices() after voiceschanged
  makes Chinese voice detection more reliable.
*/

if ("speechSynthesis" in window) {

  window.speechSynthesis.onvoiceschanged =
    () => {

      window.speechSynthesis.getVoices();

    };

}


/* ==================== INITIALIZATION ==================== */

/*
  Make sure the first tone is displayed
  correctly when the page loads.
*/

if (tonePath && toneDescription) {

  tonePath.setAttribute(
    "d",
    toneData[1].path
  );

  toneDescription.textContent =
    toneData[1].text;

}
