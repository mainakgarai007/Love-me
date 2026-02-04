const questionContainer = document.querySelector(".question-container");
const resultContainer = document.querySelector(".result-container");
const gifResult = document.querySelector(".gif-result");
const heartLoader = document.querySelector(".cssload-main");
const yesBtn = document.querySelector(".js-yes-btn");
const noBtn = document.querySelector(".js-no-btn");

// Function to play background music
function playBackgroundMusic() {
  const backgroundMusic = document.getElementById("background-music");
  if (backgroundMusic && backgroundMusic.paused) {
    backgroundMusic.play().catch(err => {
      console.log("Audio playback failed:", err);
    });
  }
}

// /change the postion of no button
noBtn.addEventListener("mouseover", () => {
  const newX = Math.floor(Math.random() * questionContainer.offsetWidth);
  const newY = Math.floor(Math.random() * questionContainer.offsetWidth);

  noBtn.style.left = `${newX}px`;
  noBtn.style.top = `${newY}px`;
});

// yes button functionality

yesBtn.addEventListener("click", () => {
  questionContainer.style.display = "none";
  heartLoader.style.display = "inherit";

  // Start background music on user interaction
  playBackgroundMusic();

  const timeoutId = setTimeout(() => {
    heartLoader.style.display = "none";
    resultContainer.style.display = "inherit";
    gifResult.play();
  }, 3000);
});

// Also try to play music on any user interaction with the no button
noBtn.addEventListener("click", () => {
  playBackgroundMusic();
});