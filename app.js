const characterImage = document.querySelector("#character-image");
const characterBackground = document.querySelector("#character-background");
const characterName = document.querySelector("#character-name");
const statusBadge = document.querySelector("#status-badge");
const motionToggle = document.querySelector("#motion-toggle");

const motionStorageKey = "bar-companion-motion-paused";

function setMotionPaused(isPaused) {
  document.body.classList.toggle("motion-paused", isPaused);
  motionToggle.setAttribute("aria-pressed", String(isPaused));
  motionToggle.textContent = isPaused ? "動きを再開" : "動きを止める";
  localStorage.setItem(motionStorageKey, String(isPaused));
}

function restoreMotionPreference() {
  const savedPreference = localStorage.getItem(motionStorageKey);

  if (savedPreference !== null) {
    setMotionPaused(savedPreference === "true");
    return;
  }

  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  setMotionPaused(prefersReducedMotion);
}

async function loadDefaultCharacter() {
  try {
    const response = await fetch("./data/characters.json", {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`Character data request failed: ${response.status}`);
    }

    const data = await response.json();
    const selectedCharacter = data.characters.find(
      (character) =>
        character.id === data.defaultCharacterId &&
        character.enabled
    );

    if (!selectedCharacter) {
      throw new Error("Default character was not found.");
    }

    characterBackground.src = selectedCharacter.backgroundImage;
    characterImage.src = selectedCharacter.foregroundImage;
    characterImage.alt = selectedCharacter.name;
    characterName.textContent = selectedCharacter.name;
    document.title = `${selectedCharacter.name} | Bar Companion`;
    statusBadge.textContent = "待機中";
  } catch (error) {
    console.error(error);
    statusBadge.textContent = "設定を確認してください";
  }
}

motionToggle.addEventListener("click", () => {
  const isCurrentlyPaused =
    document.body.classList.contains("motion-paused");

  setMotionPaused(!isCurrentlyPaused);
});

restoreMotionPreference();
loadDefaultCharacter();
