/* ==================== TONE DATA ==================== */

const toneData = {
  1: {
    syllable: "mā",
    character: "妈",
    meaning: "mother",
    text: "Tone 1 — high and flat",
    path: "M20 30 L480 30",
    audio: "./assets/audio/tones/ma-tone-1.mp3"
  },

  2: {
    syllable: "má",
    character: "麻",
    meaning: "hemp / numb",
    text: "Tone 2 — rising",
    path: "M20 70 C170 70 320 65 480 20",
    audio: "./assets/audio/tones/ma-tone-2.mp3"
  },

  3: {
    syllable: "mǎ",
    character: "马",
    meaning: "horse",
    text: "Tone 3 — dipping",
    path: "M20 35 C130 85 230 85 300 70 C370 55 420 30 480 25",
    audio: "./assets/audio/tones/ma-tone-3.mp3"
  },

  4: {
    syllable: "mà",
    character: "骂",
    meaning: "scold",
    text: "Tone 4 — falling",
    path: "M20 20 C180 25 330 65 480 85",
    audio: "./assets/audio/tones/ma-tone-4.mp3"
  }
};


/* ==================== TONE ELEMENTS ==================== */

const toneButtons =
  document.querySelectorAll(".tone-button");

const tonePath =
  document.getElementById("tonePath");

const toneDescription =
  document.getElementById("toneDescription");

let currentToneAudio = null;


/* ==================== PLAY TONE ==================== */

function playTone(number, button) {

  const data = toneData[number];

  if (!data) {
    console.error("Tone data not found:", number);
    return;
  }


  /* Remove active state */
  toneButtons.forEach(item => {
    item.classList.remove("active");
  });


  /* Activate selected button */
  button.classList.add("active");


  /* Update tone curve */
  if (tonePath) {
    tonePath.setAttribute("d", data.path);
  }


  /* Update description */
  if (toneDescription) {
    toneDescription.innerHTML =
      `<strong>${data.syllable}</strong> — ${data.character} — ${data.meaning}<br>
       ${data.text}`;
  }


  /* Stop previous tone */
  if (currentToneAudio) {
    currentToneAudio.pause();
    currentToneAudio.currentTime = 0;
    currentToneAudio = null;
  }


  /* Create audio */
  currentToneAudio = new Audio();

  currentToneAudio.preload = "auto";
  currentToneAudio.src = data.audio;


  /* Error handling */
  currentToneAudio.addEventListener("error", () => {

    console.error(
      "Could not load audio file:",
      data.audio
    );

    alert(
      `Audio file could not be loaded:\n${data.audio}\n\n` +
      `Please check that the MP3 exists in the correct folder ` +
      `and that the filename is exactly correct.`
    );

  });


  /* Play */
  currentToneAudio.play()
    .then(() => {

      console.log(
        `Playing ${data.syllable}:`,
        data.audio
      );

    })
    .catch(error => {

      console.error(
        "Audio playback failed:",
        error
      );

    });

}


/* ==================== TONE BUTTONS ==================== */

toneButtons.forEach(button => {

  button.addEventListener("click", () => {

    const toneNumber =
      Number(button.dataset.tone);

    playTone(
      toneNumber,
      button
    );

  });

});


/* ==================== INITIAL TONE ==================== */

if (tonePath && toneDescription) {

  tonePath.setAttribute(
    "d",
    toneData[1].path
  );

  toneDescription.innerHTML =
    `<strong>${toneData[1].syllable}</strong> — ${toneData[1].character} — ${toneData[1].meaning}<br>
     ${toneData[1].text}`;

}