const characterImage = document.querySelector("#character-image");
const characterBackground = document.querySelector("#character-background");
const characterName = document.querySelector("#character-name");
const statusBadge = document.querySelector("#status-badge");
const motionToggle = document.querySelector("#motion-toggle");
const speechButton = document.querySelector("#speech-button");
const speechLanguage = document.querySelector("#speech-language");
const speechStatus = document.querySelector("#speech-status");
const speechTranscript = document.querySelector("#speech-transcript");

const motionStorageKey = "bar-companion-motion-paused";
const languageStorageKey = "bar-companion-speech-language";
const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

let speechRecognition = null;
let isListening = false;
let finalTranscript = "";
let recognitionFailed = false;

const speechErrorMessages = {
  "audio-capture": "マイクを利用できません。端末の設定を確認してください。",
  "language-not-supported": "選択した言語は、この端末で利用できません。",
  "network": "音声認識サービスへ接続できませんでした。",
  "no-speech": "音声を聞き取れませんでした。もう一度お試しください。",
  "not-allowed": "マイクの使用が許可されていません。",
  "service-not-allowed": "この端末では音声認識サービスを利用できません。"
};

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

function setListeningState(listening) {
  isListening = listening;
  document.body.classList.toggle("speech-listening", listening);
  speechButton.textContent = listening ? "停止" : "話す";
  speechLanguage.disabled = listening;

  if (listening) {
    statusBadge.textContent = "聞いています";
    speechStatus.textContent = "話してください…";
  } else {
    statusBadge.textContent = "待機中";
  }
}

function initializeSpeechRecognition() {
  const savedLanguage = localStorage.getItem(languageStorageKey);

  if (["ja-JP", "en-US"].includes(savedLanguage)) {
    speechLanguage.value = savedLanguage;
  }

  if (!SpeechRecognition) {
    speechButton.disabled = true;
    speechLanguage.disabled = true;
    speechStatus.textContent = "このブラウザは音声認識に対応していません";
    speechTranscript.textContent = "別のブラウザまたは端末でお試しください。";
    return;
  }

  speechRecognition = new SpeechRecognition();
  speechRecognition.continuous = false;
  speechRecognition.interimResults = true;
  speechRecognition.maxAlternatives = 1;

  speechRecognition.addEventListener("start", () => {
    recognitionFailed = false;
    setListeningState(true);
  });

  speechRecognition.addEventListener("result", (event) => {
    let interimTranscript = "";

    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const transcript = event.results[index][0].transcript;

      if (event.results[index].isFinal) {
        finalTranscript += transcript;
      } else {
        interimTranscript += transcript;
      }
    }

    speechTranscript.textContent = finalTranscript || interimTranscript;
    speechStatus.textContent = finalTranscript ? "認識しました" : "認識中…";
  });

  speechRecognition.addEventListener("error", (event) => {
    recognitionFailed = true;
    speechStatus.textContent = speechErrorMessages[event.error] ??
      `音声認識でエラーが発生しました（${event.error}）`;
  });

  speechRecognition.addEventListener("end", () => {
    setListeningState(false);

    if (!recognitionFailed) {
      speechStatus.textContent = finalTranscript ?
        "認識完了。もう一度話せます。" :
        "音声を聞き取れませんでした。もう一度お試しください。";
    }
  });

  if (!window.isSecureContext) {
    speechStatus.textContent =
      "この接続ではマイクが制限される場合があります。HTTPSでお試しください。";
  }
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

speechLanguage.addEventListener("change", () => {
  localStorage.setItem(languageStorageKey, speechLanguage.value);
  speechStatus.textContent = speechLanguage.value === "ja-JP" ?
    "日本語を選択しました" :
    "English selected";
});

speechButton.addEventListener("click", () => {
  if (!speechRecognition) {
    return;
  }

  if (isListening) {
    speechRecognition.stop();
    return;
  }

  finalTranscript = "";
  recognitionFailed = false;
  speechTranscript.textContent = "…";
  speechRecognition.lang = speechLanguage.value;

  try {
    speechRecognition.start();
  } catch (error) {
    console.error(error);
    speechStatus.textContent = "音声認識を開始できませんでした。";
  }
});

restoreMotionPreference();
initializeSpeechRecognition();
loadDefaultCharacter();
