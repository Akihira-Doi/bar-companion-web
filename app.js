const characterImage = document.querySelector("#character-image");
const characterBackground = document.querySelector("#character-background");
const characterName = document.querySelector("#character-name");
const statusBadge = document.querySelector("#status-badge");
const motionToggle = document.querySelector("#motion-toggle");
const speechButton = document.querySelector("#speech-button");
const speechLanguage = document.querySelector("#speech-language");
const speechStatus = document.querySelector("#speech-status");
const speechTranscript = document.querySelector("#speech-transcript");
const voiceStyle = document.querySelector("#voice-style");
const voiceName = document.querySelector("#voice-name");
const voiceTestButton = document.querySelector("#voice-test-button");
const voiceStatus = document.querySelector("#voice-status");
const settingsToggle = document.querySelector("#settings-toggle");
const settingsPanel = document.querySelector("#settings-panel");
const settingsClose = document.querySelector("#settings-close");
const settingsBackdrop = document.querySelector("#settings-backdrop");
const settingsCharacterName = document.querySelector("#settings-character-name");
const speechPanelPosition = document.querySelector("#speech-panel-position");

const motionStorageKey = "bar-companion-motion-paused";
const languageStorageKey = "bar-companion-speech-language";
const voiceStyleStorageKey = "bar-companion-voice-style";
const speechPanelPositionStorageKey = "bar-companion-speech-panel-position";
const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

let speechRecognition = null;
let isListening = false;
let finalTranscript = "";
let recognitionFailed = false;
let availableVoices = [];
let isSpeaking = false;

const voiceProfiles = {
  calm: {
    rate: 0.92,
    pitch: 1
  },
  friendly: {
    rate: 1.03,
    pitch: 1.07
  },
  low: {
    rate: 0.92,
    pitch: 0.92
  }
};

const testPhrases = {
  "ja-JP": "いらっしゃいませ。今日は何を飲みますか？",
  "en-US": "Welcome. What would you like to drink today?"
};

const speechErrorMessages = {
  "audio-capture": "マイクを利用できません。端末の設定を確認してください。",
  "language-not-supported": "選択した言語は、この端末で利用できません。",
  "network": "音声認識サービスへ接続できませんでした。",
  "no-speech": "音声を聞き取れませんでした。もう一度お試しください。",
  "not-allowed": "マイクの使用が許可されていません。",
  "service-not-allowed": "この端末では音声認識サービスを利用できません。"
};

function setSettingsOpen(open) {
  settingsToggle.setAttribute("aria-expanded", String(open));
  settingsToggle.querySelector(".visually-hidden").textContent =
    open ? "設定を閉じる" : "設定を開く";
  settingsPanel.setAttribute("aria-hidden", String(!open));
  settingsPanel.hidden = !open;
  settingsBackdrop.hidden = !open;
  document.body.classList.toggle("settings-open", open);

  if (open) {
    settingsClose.focus();
  } else {
    settingsToggle.focus();
  }
}

function setSpeechPanelPosition(position) {
  const selectedPosition = position === "top" ? "top" : "bottom";

  speechPanelPosition.value = selectedPosition;
  document.body.classList.toggle(
    "speech-panel-position-top",
    selectedPosition === "top"
  );
  localStorage.setItem(speechPanelPositionStorageKey, selectedPosition);
}

function restoreSpeechPanelPosition() {
  setSpeechPanelPosition(
    localStorage.getItem(speechPanelPositionStorageKey) ?? "bottom"
  );
}

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
  speechLanguage.disabled = listening || isSpeaking;

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

function refreshAvailableVoices() {
  if (!("speechSynthesis" in window)) {
    return;
  }

  availableVoices = window.speechSynthesis.getVoices();
  populateVoiceOptions();
}

function matchingVoicesForLanguage(language) {
  const languagePrefix = language.split("-")[0].toLowerCase();

  return availableVoices.filter((voice) =>
    voice.lang.toLowerCase().startsWith(languagePrefix)
  );
}

function voiceStorageKey(language) {
  return `bar-companion-voice-${language}`;
}

function populateVoiceOptions() {
  const language = speechLanguage.value;
  const matchingVoices = matchingVoicesForLanguage(language);
  const savedVoice = localStorage.getItem(voiceStorageKey(language));

  voiceName.replaceChildren();

  if (matchingVoices.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "端末の標準音声";
    voiceName.append(option);
    voiceName.disabled = true;
    return;
  }

  for (const voice of matchingVoices) {
    const option = document.createElement("option");
    option.value = voice.voiceURI;
    option.textContent = `${voice.name}（${voice.lang}）`;
    voiceName.append(option);
  }

  const savedVoiceExists = matchingVoices.some(
    (voice) => voice.voiceURI === savedVoice
  );

  voiceName.value = savedVoiceExists ? savedVoice : matchingVoices[0].voiceURI;
  voiceName.disabled = isSpeaking;
}

function selectVoice(language) {
  const matchingVoices = matchingVoicesForLanguage(language);
  const selectedVoice = matchingVoices.find(
    (voice) => voice.voiceURI === voiceName.value
  );

  return selectedVoice ??
    matchingVoices.find((voice) => voice.default) ??
    matchingVoices.find((voice) => voice.localService) ??
    matchingVoices[0] ??
    null;
}

function setSpeakingState(speaking) {
  isSpeaking = speaking;
  document.body.classList.toggle("speech-speaking", speaking);
  voiceTestButton.textContent = speaking ? "停止" : "声を試す";
  voiceStyle.disabled = speaking;
  voiceName.disabled = speaking || matchingVoicesForLanguage(
    speechLanguage.value
  ).length === 0;
  speechLanguage.disabled = speaking || isListening;
  speechButton.disabled = speaking || !SpeechRecognition;

  if (speaking) {
    statusBadge.textContent = "話しています";
  } else if (!isListening) {
    statusBadge.textContent = "待機中";
  }
}

function initializeSpeechSynthesis() {
  const savedVoiceStyle = localStorage.getItem(voiceStyleStorageKey);

  if (Object.hasOwn(voiceProfiles, savedVoiceStyle)) {
    voiceStyle.value = savedVoiceStyle;
  }

  if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
    voiceStyle.disabled = true;
    voiceName.disabled = true;
    voiceTestButton.disabled = true;
    voiceStatus.textContent = "このブラウザは音声読み上げに対応していません";
    return;
  }

  refreshAvailableVoices();
  window.speechSynthesis.addEventListener("voiceschanged", refreshAvailableVoices);
}

function speakTestPhrase() {
  if (!("speechSynthesis" in window)) {
    return;
  }

  if (isSpeaking || window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel();
    setSpeakingState(false);
    voiceStatus.textContent = "読み上げを停止しました";
    return;
  }

  if (isListening && speechRecognition) {
    speechRecognition.stop();
  }

  refreshAvailableVoices();

  const language = speechLanguage.value;
  const profile = voiceProfiles[voiceStyle.value];
  const selectedVoice = selectVoice(language);
  const utterance = new SpeechSynthesisUtterance(testPhrases[language]);

  utterance.lang = language;
  utterance.rate = profile.rate;
  utterance.pitch = profile.pitch;
  utterance.volume = 1;

  if (selectedVoice) {
    utterance.voice = selectedVoice;
  }

  utterance.addEventListener("start", () => {
    setSpeakingState(true);
    voiceStatus.textContent = selectedVoice ?
      `${selectedVoice.name}で読み上げています` :
      "端末の標準音声で読み上げています";
  });

  utterance.addEventListener("end", () => {
    setSpeakingState(false);
    voiceStatus.textContent = "読み上げが終わりました";
  });

  utterance.addEventListener("error", (event) => {
    setSpeakingState(false);
    voiceStatus.textContent = event.error === "canceled" ?
      "読み上げを停止しました" :
      "音声を再生できませんでした";
  });

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
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
    settingsCharacterName.textContent = selectedCharacter.name;
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

settingsToggle.addEventListener("click", () => {
  const isOpen = settingsToggle.getAttribute("aria-expanded") === "true";
  setSettingsOpen(!isOpen);
});

settingsClose.addEventListener("click", () => setSettingsOpen(false));
settingsBackdrop.addEventListener("click", () => setSettingsOpen(false));

speechPanelPosition.addEventListener("change", () => {
  setSpeechPanelPosition(speechPanelPosition.value);
});

document.addEventListener("keydown", (event) => {
  if (
    event.key === "Escape" &&
    settingsToggle.getAttribute("aria-expanded") === "true"
  ) {
    setSettingsOpen(false);
  }
});

speechLanguage.addEventListener("change", () => {
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
    setSpeakingState(false);
  }

  localStorage.setItem(languageStorageKey, speechLanguage.value);
  populateVoiceOptions();
  speechStatus.textContent = speechLanguage.value === "ja-JP" ?
    "日本語を選択しました" :
    "English selected";
});

voiceName.addEventListener("change", () => {
  localStorage.setItem(
    voiceStorageKey(speechLanguage.value),
    voiceName.value
  );
  voiceStatus.textContent = "端末の音声を変更しました。声を試せます。";
});

voiceStyle.addEventListener("change", () => {
  localStorage.setItem(voiceStyleStorageKey, voiceStyle.value);
  voiceStatus.textContent = "話し方を変更しました。声を試せます。";
});

voiceTestButton.addEventListener("click", speakTestPhrase);

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
restoreSpeechPanelPosition();
initializeSpeechRecognition();
initializeSpeechSynthesis();
loadDefaultCharacter();
