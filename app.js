import { generateIdlePrompt, generateReply } from "./conversation.js";

const characterImage = document.querySelector("#character-image");
const characterBackground = document.querySelector("#character-background");
const characterName = document.querySelector("#character-name");
const statusBadge = document.querySelector("#status-badge");
const motionToggle = document.querySelector("#motion-toggle");
const speechButton = document.querySelector("#speech-button");
const speechLanguage = document.querySelector("#speech-language");
const speechStatus = document.querySelector("#speech-status");
const speechTranscript = document.querySelector("#speech-transcript");
const characterReply = document.querySelector("#character-reply");
const replySpeaker = document.querySelector("#reply-speaker");
const voiceStyle = document.querySelector("#voice-style");
const voiceName = document.querySelector("#voice-name");
const voiceTestButton = document.querySelector("#voice-test-button");
const voiceStatus = document.querySelector("#voice-status");
const settingsToggle = document.querySelector("#settings-toggle");
const settingsPanel = document.querySelector("#settings-panel");
const settingsClose = document.querySelector("#settings-close");
const settingsBackdrop = document.querySelector("#settings-backdrop");
const characterSelect = document.querySelector("#character-select");
const characterStatus = document.querySelector("#character-status");
const speechPanelPosition = document.querySelector("#speech-panel-position");
const conversationMode = document.querySelector("#conversation-mode");

const motionStorageKey = "bar-companion-motion-paused";
const languageStorageKey = "bar-companion-speech-language";
const voiceStyleStorageKey = "bar-companion-voice-style";
const speechPanelPositionStorageKey = "bar-companion-speech-panel-position";
const characterStorageKey = "bar-companion-character";
const conversationModeStorageKey = "bar-companion-conversation-mode";
const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

let speechRecognition = null;
let isListening = false;
let finalTranscript = "";
let recognitionFailed = false;
let availableVoices = [];
let isSpeaking = false;
let availableCharacters = [];
let defaultCharacterId = "";
let currentCharacterId = "";
let isReplying = false;
let idleTimer = null;
let idlePromptAllowed = true;
let automaticConversationStarted = false;
let automaticRestartTimer = null;
let recognitionError = "";
let speechSynthesisUnlocked = false;

const idleDelayMs = 30_000;

function wait(milliseconds) {
  return new Promise((resolveWait) => {
    window.setTimeout(resolveWait, milliseconds);
  });
}

function unlockSpeechSynthesis() {
  if (
    speechSynthesisUnlocked ||
    !("speechSynthesis" in window) ||
    !("SpeechSynthesisUtterance" in window)
  ) {
    return;
  }

  const silentUtterance = new SpeechSynthesisUtterance(" ");
  silentUtterance.volume = 0;
  silentUtterance.lang = speechLanguage.value;
  window.speechSynthesis.speak(silentUtterance);
  window.speechSynthesis.resume();
  speechSynthesisUnlocked = true;
}

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
    clearIdlePromptTimer();
    clearAutomaticRestartTimer();
    if (isListening && speechRecognition) {
      speechRecognition.stop();
    }
  } else {
    idlePromptAllowed = true;
    scheduleIdlePrompt();
    scheduleAutomaticListening();
  }

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

function isAutomaticConversation() {
  return conversationMode.value === "automatic";
}

function updateSpeechButtonLabel() {
  if (isListening) {
    speechButton.textContent = isAutomaticConversation() ?
      "会話を止める" : "停止";
    return;
  }

  speechButton.textContent = isAutomaticConversation() ?
    "会話を始める" : "話す";
}

function restoreConversationMode() {
  const savedMode = localStorage.getItem(conversationModeStorageKey);
  conversationMode.value = savedMode === "push-to-talk" ?
    "push-to-talk" : "automatic";
  updateSpeechButtonLabel();
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
  updateSpeechButtonLabel();
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
    recognitionError = "";
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
    recognitionError = event.error;
    speechStatus.textContent = speechErrorMessages[event.error] ??
      `音声認識でエラーが発生しました（${event.error}）`;
  });

  speechRecognition.addEventListener("end", async () => {
    setListeningState(false);

    if (!recognitionFailed) {
      if (finalTranscript.trim()) {
        speechStatus.textContent = "認識完了";
        await handleRecognizedSpeech(finalTranscript.trim());
      } else {
        speechStatus.textContent =
          "音声を聞き取れませんでした。もう一度お試しください。";
        scheduleAutomaticListening();
      }
    } else {
      idlePromptAllowed = true;
      scheduleIdlePrompt();

      if (recognitionError === "no-speech") {
        scheduleAutomaticListening(1_000);
      } else {
        automaticConversationStarted = false;
        updateSpeechButtonLabel();
      }
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
  speechButton.disabled = speaking || isReplying || !SpeechRecognition;

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

function speakText(text, { test = false } = {}) {
  return new Promise((resolveSpeech) => {
    if (!("speechSynthesis" in window)) {
      resolveSpeech(false);
      return;
    }

    if (isListening && speechRecognition) {
      speechRecognition.stop();
    }

    refreshAvailableVoices();

    const language = speechLanguage.value;
    const profile = voiceProfiles[voiceStyle.value];
    const selectedVoice = selectVoice(language);
    const utterance = new SpeechSynthesisUtterance(text);
    const watchdogDelay = Math.min(
      30_000,
      Math.max(8_000, text.length * 280 + 4_000)
    );
    let finished = false;

    const finishSpeech = (success, message) => {
      if (finished) {
        return;
      }

      finished = true;
      window.clearTimeout(watchdogTimer);
      setSpeakingState(false);
      voiceStatus.textContent = message;
      resolveSpeech(success);
    };

    const watchdogTimer = window.setTimeout(() => {
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
      }

      finishSpeech(
        false,
        "読み上げの完了通知がないため、待機状態に戻りました"
      );
    }, watchdogDelay);

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
      if (!test) {
        speechStatus.textContent = "返事を読み上げています…";
      }
    });

    utterance.addEventListener("end", () => {
      finishSpeech(true, "読み上げが終わりました");
    });

    utterance.addEventListener("error", (event) => {
      finishSpeech(
        false,
        event.error === "canceled" ?
          "読み上げを停止しました" :
          "音声を再生できませんでした"
      );
    });

    window.speechSynthesis.cancel();
    window.speechSynthesis.resume();
    window.speechSynthesis.speak(utterance);
  });
}

function speakTestPhrase() {
  if (!("speechSynthesis" in window)) {
    return;
  }

  if (isSpeaking) {
    window.speechSynthesis.cancel();
    setSpeakingState(false);
    voiceStatus.textContent = "読み上げを停止しました";
    return;
  }

  void speakText(testPhrases[speechLanguage.value], { test: true });
}

function currentCharacterName() {
  return availableCharacters.find(
    (character) => character.id === currentCharacterId
  )?.name ?? "ちーママ";
}

function clearIdlePromptTimer() {
  if (idleTimer !== null) {
    window.clearTimeout(idleTimer);
    idleTimer = null;
  }
}

function clearAutomaticRestartTimer() {
  if (automaticRestartTimer !== null) {
    window.clearTimeout(automaticRestartTimer);
    automaticRestartTimer = null;
  }
}

function startListening() {
  if (
    !speechRecognition ||
    isListening ||
    isSpeaking ||
    isReplying ||
    settingsToggle.getAttribute("aria-expanded") === "true"
  ) {
    return;
  }

  clearIdlePromptTimer();
  clearAutomaticRestartTimer();
  finalTranscript = "";
  recognitionFailed = false;
  recognitionError = "";
  speechTranscript.textContent = "…";
  speechRecognition.lang = speechLanguage.value;

  try {
    speechRecognition.start();
  } catch (error) {
    console.error(error);
    automaticConversationStarted = false;
    updateSpeechButtonLabel();
    speechStatus.textContent =
      "音声認識を再開できませんでした。「会話を始める」を押してください。";
  }
}

function scheduleAutomaticListening(delay = 700) {
  clearAutomaticRestartTimer();

  if (
    !isAutomaticConversation() ||
    !automaticConversationStarted ||
    settingsToggle.getAttribute("aria-expanded") === "true"
  ) {
    return;
  }

  automaticRestartTimer = window.setTimeout(() => {
    automaticRestartTimer = null;
    startListening();
  }, delay);
}

function scheduleIdlePrompt(delay = idleDelayMs) {
  clearIdlePromptTimer();

  if (
    !idlePromptAllowed ||
    settingsToggle.getAttribute("aria-expanded") === "true"
  ) {
    return;
  }

  idleTimer = window.setTimeout(async () => {
    idleTimer = null;

    if (isListening || isSpeaking || isReplying) {
      scheduleIdlePrompt(2_000);
      return;
    }

    idlePromptAllowed = false;
    const prompt = generateIdlePrompt({ language: speechLanguage.value });
    replySpeaker.textContent = currentCharacterName();
    characterReply.textContent = prompt;
    speechStatus.textContent = "キャラクターから話しかけています";
    await speakText(prompt);
    speechStatus.textContent = "「話す」を押して返事をしてください";
  }, delay);
}

async function handleRecognizedSpeech(text) {
  clearIdlePromptTimer();
  isReplying = true;
  speechButton.disabled = true;
  speechStatus.textContent = "返事を考えています…";

  try {
    const reply = await generateReply({
      text,
      language: speechLanguage.value,
      characterName: currentCharacterName()
    });

    replySpeaker.textContent = currentCharacterName();
    characterReply.textContent = reply;
    await wait(350);
    await speakText(reply);
    speechStatus.textContent = "もう一度話せます";
  } catch (error) {
    console.error(error);
    speechStatus.textContent = "返事を作れませんでした。もう一度お試しください。";
  } finally {
    isReplying = false;
    setSpeakingState(false);
    idlePromptAllowed = true;
    scheduleIdlePrompt();
    scheduleAutomaticListening();
  }
}

function preloadImage(source) {
  return new Promise((resolveImage, rejectImage) => {
    const image = new Image();
    image.addEventListener("load", resolveImage, { once: true });
    image.addEventListener("error", rejectImage, { once: true });
    image.src = source;
  });
}

async function displayCharacter(character, saveSelection = true) {
  const backgroundSource = character.backgroundImage ?? character.image;
  const foregroundSource = character.foregroundImage ?? null;
  const sources = [backgroundSource, foregroundSource].filter(Boolean);

  if (!backgroundSource || sources.length === 0) {
    throw new Error(`Character ${character.id} has no usable image.`);
  }

  characterSelect.disabled = true;
  characterStatus.textContent = `${character.name}を読み込んでいます…`;

  try {
    await Promise.all(sources.map(preloadImage));

    characterBackground.src = backgroundSource;
    characterImage.hidden = !foregroundSource;

    if (foregroundSource) {
      characterImage.src = foregroundSource;
    } else {
      characterImage.removeAttribute("src");
    }

    characterImage.alt = character.name;
    characterName.textContent = character.name;
    replySpeaker.textContent = character.name;
    characterSelect.value = character.id;
    document.title = `${character.name} | Bar Companion`;
    currentCharacterId = character.id;
    characterStatus.textContent = `${character.name}を表示しています`;
    statusBadge.textContent = "待機中";

    if (saveSelection) {
      localStorage.setItem(characterStorageKey, character.id);
    }
  } finally {
    characterSelect.disabled = false;
  }
}

function populateCharacterOptions() {
  characterSelect.replaceChildren();

  for (const character of availableCharacters) {
    const option = document.createElement("option");
    option.value = character.id;
    option.textContent = character.name;
    characterSelect.append(option);
  }
}

async function loadCharacters() {
  try {
    const response = await fetch("./data/characters.json", {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`Character data request failed: ${response.status}`);
    }

    const data = await response.json();
    availableCharacters = data.characters.filter(
      (character) => character.enabled && character.id && character.name
    );
    defaultCharacterId = data.defaultCharacterId;

    const defaultCharacter = availableCharacters.find(
      (character) => character.id === defaultCharacterId
    );

    if (!defaultCharacter || availableCharacters.length === 0) {
      throw new Error("Default character was not found.");
    }

    populateCharacterOptions();

    const savedCharacterId = localStorage.getItem(characterStorageKey);
    const savedCharacter = availableCharacters.find(
      (character) => character.id === savedCharacterId
    );
    const initialCharacter = savedCharacter ?? defaultCharacter;

    if (savedCharacterId && !savedCharacter) {
      localStorage.removeItem(characterStorageKey);
    }

    try {
      await displayCharacter(initialCharacter, Boolean(savedCharacter));
    } catch (error) {
      if (initialCharacter.id === defaultCharacter.id) {
        throw error;
      }

      console.error(error);
      localStorage.removeItem(characterStorageKey);
      await displayCharacter(defaultCharacter, false);
      characterStatus.textContent =
        "保存したキャラクターを表示できないため、既定に戻しました";
    }
  } catch (error) {
    console.error(error);
    characterSelect.disabled = true;
    characterStatus.textContent = "キャラクター設定を読み込めませんでした";
    statusBadge.textContent = "設定を確認してください";
  } finally {
    document.body.classList.remove("character-loading");
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

conversationMode.addEventListener("change", () => {
  localStorage.setItem(conversationModeStorageKey, conversationMode.value);
  clearAutomaticRestartTimer();
  automaticConversationStarted = false;

  if (isListening && speechRecognition) {
    speechRecognition.stop();
  }

  updateSpeechButtonLabel();
  speechStatus.textContent = isAutomaticConversation() ?
    "最初に「会話を始める」を押してください" :
    "話すたびに「話す」を押してください";
});

characterSelect.addEventListener("change", async () => {
  const selectedCharacter = availableCharacters.find(
    (character) => character.id === characterSelect.value
  );

  if (!selectedCharacter || selectedCharacter.id === currentCharacterId) {
    return;
  }

  const previousCharacterId = currentCharacterId;

  try {
    await displayCharacter(selectedCharacter);
  } catch (error) {
    console.error(error);
    characterSelect.value = previousCharacterId;
    characterStatus.textContent =
      "画像を読み込めなかったため、表示を変更しませんでした";
  }
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
    automaticConversationStarted = false;
    clearAutomaticRestartTimer();
    speechRecognition.stop();
    speechStatus.textContent = "会話を停止しました";
    return;
  }

  unlockSpeechSynthesis();
  idlePromptAllowed = true;
  automaticConversationStarted = isAutomaticConversation();
  startListening();
});

document.addEventListener("pointerdown", unlockSpeechSynthesis, { once: true });

restoreMotionPreference();
restoreSpeechPanelPosition();
restoreConversationMode();
initializeSpeechRecognition();
initializeSpeechSynthesis();
loadCharacters().finally(() => scheduleIdlePrompt());
