(() => {
  "use strict";

  const questionContainer = document.querySelector(".question-container");
  const resultContainer = document.querySelector(".result-container");
  const gifResult = document.querySelector(".gif-result");
  const heartLoader = document.querySelector(".cssload-main");
  const yesBtn = document.querySelector(".js-yes-btn");
  const noBtn = document.querySelector(".js-no-btn");
  const backgroundMusic = document.getElementById("background-music");

  if (!questionContainer || !resultContainer || !yesBtn || !noBtn || !heartLoader) {
    console.error("Love-me: required page elements are missing.");
    return;
  }

  let answered = false;

  function playBackgroundMusic() {
    if (!backgroundMusic || !backgroundMusic.paused) return;
    const playback = backgroundMusic.play();
    if (playback && typeof playback.catch === "function") {
      playback.catch(() => {
        // Browsers may block audio until a user gesture; the page still works.
      });
    }
  }

  function moveNoButton() {
    const area = questionContainer.getBoundingClientRect();
    const button = noBtn.getBoundingClientRect();
    const padding = 8;
    const maxX = Math.max(padding, area.width - button.width - padding);
    const maxY = Math.max(padding, area.height - button.height - padding);
    noBtn.style.position = "absolute";
    noBtn.style.left = `${padding + Math.random() * (maxX - padding)}px`;
    noBtn.style.top = `${padding + Math.random() * (maxY - padding)}px`;
    noBtn.style.right = "auto";
  }

  noBtn.addEventListener("pointerenter", (event) => {
    if (!answered && event.pointerType === "mouse") moveNoButton();
  });

  noBtn.addEventListener("touchstart", () => {
    if (!answered) moveNoButton();
  }, { passive: true });

  noBtn.addEventListener("click", () => {
    playBackgroundMusic();
  });

  yesBtn.addEventListener("click", () => {
    if (answered) return;
    answered = true;
    questionContainer.hidden = true;
    heartLoader.style.display = "block";
    playBackgroundMusic();

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