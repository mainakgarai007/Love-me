(() => {
  "use strict";

  const questionContainer = document.querySelector(".question-container");
  const resultContainer = document.querySelector(".result-container");
  const gifResult = document.querySelector(".gif-result");
  const heartLoader = document.querySelector(".cssload-main");
  const yesBtn = document.querySelector(".js-yes-btn");
  const noBtn = document.querySelector(".js-no-btn");
  const buttonContainer = document.querySelector(".button-container");
  const backgroundMusic = document.getElementById("background-music");

  if (!questionContainer || !resultContainer || !yesBtn || !noBtn || !heartLoader) {
    console.error("Love-me: required page elements are missing.");
    return;
  }

  let answered = false;

  function playSoftLoveMusic() {
    if (!backgroundMusic) return;
    backgroundMusic.volume = 0.35;
    if (!backgroundMusic.paused) return;

    const playback = backgroundMusic.play();
    if (playback && typeof playback.catch === "function") {
      playback.catch(() => {
        // Audio can be blocked by browser settings; the result still appears.
      });
    }
  }

  function moveNoButton() {
    const area = (buttonContainer || questionContainer).getBoundingClientRect();
    const button = noBtn.getBoundingClientRect();
    const padding = 8;
    const maxX = Math.max(padding, area.width - button.width - padding);
    const maxY = Math.max(padding, area.height - button.height - padding);

    noBtn.style.position = "absolute";
    noBtn.style.left = `${padding + Math.random() * (maxX - padding)}px`;
    noBtn.style.top = `${padding + Math.random() * (maxY - padding)}px`;
    noBtn.style.right = "auto";
  }

  // The No button dodges the pointer and cannot be selected.
  noBtn.addEventListener("pointerenter", (event) => {
    if (!answered && event.pointerType === "mouse") moveNoButton();
  });

  noBtn.addEventListener("pointerdown", (event) => {
    if (answered) return;
    event.preventDefault();
    moveNoButton();
  });

  noBtn.addEventListener("touchstart", (event) => {
    if (answered) return;
    event.preventDefault();
    moveNoButton();
  }, { passive: false });

  noBtn.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!answered) moveNoButton();
  });

  yesBtn.addEventListener("click", () => {
    if (answered) return;
    answered = true;

    questionContainer.hidden = true;
    heartLoader.style.display = "block";
    playSoftLoveMusic();

    window.setTimeout(() => {
      heartLoader.style.display = "none";
      resultContainer.style.display = "block";

      if (gifResult) {
        gifResult.muted = true;
        const playback = gifResult.play();
        if (playback && typeof playback.catch === "function") playback.catch(() => {});
      }
    }, 1800);
  });
})();