import {
  generateIdlePrompt,
  generateReply as generateLocalReply
} from "./conversation.js";

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
const reactionSelect = document.querySelector("#reaction-select");
const reactionTestButton = document.querySelector("#reaction-test-button");
const speechPanelPosition = document.querySelector("#speech-panel-position");
const conversationMode = document.querySelector("#conversation-mode");
const customerBadge = document.querySelector("#customer-badge");
const customerOverlay = document.querySelector("#customer-overlay");
const customerNumber = document.querySelector("#customer-number");
const customerStatus = document.querySelector("#customer-status");
const customerLookup = document.querySelector("#customer-lookup");
const customerRegisterOpen = document.querySelector("#customer-register-open");
const customerRegisterForm = document.querySelector("#customer-register-form");
const customerNameInput = document.querySelector("#customer-name-input");
const customerDrinkInput = document.querySelector("#customer-drink-input");
const customerBirthdayInput = document.querySelector("#customer-birthday-input");
const customerPersonalityInput = document.querySelector("#customer-personality-input");
const customerAttributeInput = document.querySelector("#customer-attribute-input");
const customerGuest = document.querySelector("#customer-guest");
const customerLogout = document.querySelector("#customer-logout");
const adminPinOverlay = document.querySelector("#admin-pin-overlay");
const adminPinForm = document.querySelector("#admin-pin-form");
const adminPinInput = document.querySelector("#admin-pin-input");
const adminPinStatus = document.querySelector("#admin-pin-status");
const adminPinCancel = document.querySelector("#admin-pin-cancel");
const customerList = document.querySelector("#customer-list");
const customerListStatus = document.querySelector("#customer-list-status");
const customerListRefresh = document.querySelector("#customer-list-refresh");

const motionStorageKey = "bar-companion-motion-paused";
const languageStorageKey = "bar-companion-speech-language";
const voiceStyleStorageKey = "bar-companion-voice-style";
const speechPanelPositionStorageKey = "bar-companion-speech-panel-position";
const characterStorageKey = "bar-companion-character";
const conversationModeStorageKey = "bar-companion-conversation-mode";
const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;
const isAppleMobileBrowser =
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
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
let recognitionStopReason = null;
let recognitionStopTimer = null;
let isRecognitionStopping = false;
let noSpeechStreak = 0;
let appleConversationPaused = false;
let androidWakeLock = null;
let androidWakeLockTimer = null;
let pageWasHidden = false;
let reactionTimer = null;
let blinkTimer = null;
let blinkSequenceId = 0;
let mouthTimer = null;
let mouthSequenceId = 0;
let isReactionActive = false;
let cloudAudio = null;
let cloudAudioUnlocked = false;
let currentCustomer = null;
let activeAdminPin = "";

const idleDelayMs = 30_000;

function wait(milliseconds) {
  return new Promise((resolveWait) => {
    window.setTimeout(resolveWait, milliseconds);
  });
}

function fourDigits(value) {
  return value.replace(/\D/gu, "").slice(0, 4);
}

function setCurrentCustomer(customer, previousVisitAt = null) {
  currentCustomer = customer ? { ...customer, previousVisitAt } : null;
  customerOverlay.hidden = true;
  customerRegisterForm.hidden = true;

  if (!customer) {
    customerBadge.textContent = "ゲスト";
    customerLogout.hidden = true;
    speechStatus.textContent = "ゲストとして利用します";
    return;
  }

  customerBadge.textContent = customer.name;
  customerLogout.hidden = false;
  speechStatus.textContent = previousVisitAt ?
    `${customer.name}、おかえりなさい` : `${customer.name}、登録しました`;
}

async function customerRequest(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {})
    }
  });
  const body = response.status === 204 ? {} : await response.json();

  if (!response.ok) {
    throw new Error(body.error ?? "処理できませんでした。");
  }

  return body;
}

async function lookupCustomer() {
  customerStatus.textContent = "確認しています…";
  try {
    const body = await customerRequest("/api/customers/lookup", {
      method: "POST",
      body: JSON.stringify({ number: customerNumber.value })
    });
    setCurrentCustomer(body.customer, body.previousVisitAt);
    await celebrateBirthday(body.isBirthdayToday);
  } catch (error) {
    customerStatus.textContent = error.message;
  }
}

async function registerCustomer(event) {
  event.preventDefault();
  customerStatus.textContent = "登録しています…";
  try {
    const body = await customerRequest("/api/customers", {
      method: "POST",
      body: JSON.stringify({
        number: customerNumber.value,
        name: customerNameInput.value,
        favoriteDrink: customerDrinkInput.value,
        birthday: customerBirthdayInput.value,
        personality: customerPersonalityInput.value,
        attribute: customerAttributeInput.value
      })
    });
    setCurrentCustomer(body.customer, null);
    await celebrateBirthday(body.isBirthdayToday);
  } catch (error) {
    customerStatus.textContent = error.message;
  }
}

function openCustomerOverlay() {
  customerOverlay.hidden = false;
  customerStatus.textContent = "";
  customerNumber.value = "";
  customerNameInput.value = "";
  customerDrinkInput.value = "";
  customerBirthdayInput.value = "";
  customerPersonalityInput.value = "";
  customerAttributeInput.value = "";
  customerRegisterForm.hidden = true;
  customerNumber.focus();
}

function logoutCustomer() {
  automaticConversationStarted = false;
  clearAutomaticRestartTimer();
  clearIdlePromptTimer();
  if (isListening || isRecognitionStopping) {
    requestRecognitionStop("manual");
  }
  if (cloudAudio) {
    cloudAudio.pause();
  }
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
  setSpeakingState(false);
  setCurrentCustomer(null);
  speechTranscript.textContent = "認識した言葉がここに表示されます";
  characterReply.textContent = "話しかけてくれるのを待っています";
  openCustomerOverlay();
}

function openAdminPinOverlay() {
  adminPinOverlay.hidden = false;
  adminPinInput.value = "";
  adminPinStatus.textContent = "";
  adminPinInput.focus();
}

async function loadCustomerList() {
  customerListStatus.textContent = "読み込み中…";
  customerList.replaceChildren();

  try {
    const body = await customerRequest("/api/admin/customers", {
      headers: { "X-Admin-Pin": activeAdminPin }
    });

    if (body.customers.length === 0) {
      customerListStatus.textContent = "登録済みのお客様はいません";
      return;
    }

    customerListStatus.textContent = `${body.customers.length}件を表示しています`;
    for (const customer of body.customers) {
      const item = document.createElement("article");
      item.className = "customer-list-item";
      const title = document.createElement("strong");
      title.textContent = `${customer.name}（${customer.number}）`;
      const details = document.createElement("p");
      const legacyPersonality = customer.personality || customer.traits || "登録なし";
      details.textContent = [
        `好きなお酒：${customer.favoriteDrink || "登録なし"}`,
        `誕生日：${displayBirthday(customer.birthday)}`,
        `個性：${legacyPersonality}`,
        `属性：${customer.attribute || "登録なし"}`
      ].join(" / ");
      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "customer-delete-button";
      deleteButton.textContent = "登録を削除";
      deleteButton.dataset.customerNumber = customer.number;
      deleteButton.dataset.customerName = customer.name;
      item.append(title, details, deleteButton);
      customerList.append(item);
    }
  } catch (error) {
    customerListStatus.textContent = error.message;
  }
}

function displayBirthday(value) {
  if (!value) {
    return "登録なし";
  }

  const compactMatch = /^(\d{2})(\d{2})$/u.exec(value);
  if (compactMatch) {
    return `${Number(compactMatch[1])}月${Number(compactMatch[2])}日`;
  }

  const legacyMatch = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  return legacyMatch ?
    `${Number(legacyMatch[2])}月${Number(legacyMatch[3])}日` : "登録なし";
}

async function celebrateBirthday(isBirthdayToday) {
  if (!isBirthdayToday) {
    return;
  }

  const greeting = "お誕生日おめでとうー！";
  replySpeaker.textContent = currentCharacterName();
  characterReply.textContent = greeting;
  speechStatus.textContent = "誕生日をお祝いしています";
  await speakText(greeting);
  speechStatus.textContent = "今日は素敵な誕生日にしましょう";
}

async function verifyAdminPin(event) {
  event.preventDefault();
  adminPinStatus.textContent = "確認しています…";

  try {
    await customerRequest("/api/admin/verify", {
      method: "POST",
      body: JSON.stringify({ pin: adminPinInput.value })
    });
    activeAdminPin = adminPinInput.value;
    adminPinOverlay.hidden = true;
    setSettingsOpen(true);
    await loadCustomerList();
  } catch (error) {
    adminPinStatus.textContent = error.message;
  }
}

function unlockSpeechSynthesis() {
  if (
    isAppleMobileBrowser ||
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
      requestRecognitionStop("settings");
    }
  } else {
    activeAdminPin = "";
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
  if (isRecognitionStopping) {
    speechButton.textContent = "停止中…";
    return;
  }

  if (isAutomaticConversation()) {
    speechButton.textContent = automaticConversationStarted ?
      "会話を止める" : "会話を始める";
    return;
  }

  speechButton.textContent = isListening ? "停止" : "話す";
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

  if (isPaused) {
    stopBlinking(!isReactionActive);
    stopMouthAnimation(!isReactionActive);
  } else if (isSpeaking) {
    startMouthAnimation();
  } else {
    scheduleBlink();
  }
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
  speechButton.disabled = isRecognitionStopping || isSpeaking || isReplying;

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

  if (isAppleMobileBrowser) {
    speechButton.disabled = true;
    conversationMode.disabled = true;
    speechButton.textContent = "iOS音声は次版対応";
    speechStatus.textContent =
      "第1版の音声会話はAndroid・PC対応です。iPhone・iPadは次版で対応します。";
    return;
  }

  if (!SpeechRecognition) {
    speechButton.disabled = true;
    speechLanguage.disabled = true;
    speechStatus.textContent = "このブラウザは音声認識に対応していません";
    speechTranscript.textContent = "別のブラウザまたは端末でお試しください。";
    return;
  }

  const recognition = new SpeechRecognition();
  speechRecognition = recognition;
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  recognition.addEventListener("start", () => {
    if (recognition !== speechRecognition) {
      return;
    }

    recognitionFailed = false;
    recognitionError = "";
    setListeningState(true);
  });

  recognition.addEventListener("result", (event) => {
    if (recognition !== speechRecognition) {
      return;
    }

    if (isAppleMobileBrowser && appleConversationPaused) {
      return;
    }

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

  recognition.addEventListener("error", (event) => {
    if (recognition !== speechRecognition) {
      return;
    }

    if (isAppleMobileBrowser && appleConversationPaused) {
      return;
    }

    if (event.error === "aborted" && (recognitionStopReason || document.hidden)) {
      if (!recognitionStopReason && document.hidden) {
        recognitionStopReason = "hidden";
      }
      return;
    }

    if (
      event.error === "aborted" &&
      automaticConversationStarted &&
      !document.hidden
    ) {
      recognitionFailed = true;
      recognitionError = event.error;
      speechStatus.textContent = "音声認識を再接続しています…";
      return;
    }

    recognitionFailed = true;
    recognitionError = event.error;
    speechStatus.textContent = speechErrorMessages[event.error] ??
      `音声認識でエラーが発生しました（${event.error}）`;
  });

  recognition.addEventListener("end", async () => {
    if (recognition !== speechRecognition) {
      return;
    }

    const stopReason = recognitionStopReason;
    finishRecognitionStop();
    setListeningState(false);

    if (
      isAppleMobileBrowser &&
      appleConversationPaused &&
      !automaticConversationStarted
    ) {
      finalTranscript = "";
      initializeSpeechRecognition();
      speechStatus.textContent = "会話を停止しました";
      return;
    }

    if (stopReason) {
      finalTranscript = "";
      initializeSpeechRecognition();

      if (stopReason === "manual") {
        speechStatus.textContent = "会話を停止しました";
      } else if (stopReason === "hidden") {
        speechStatus.textContent =
          "画面がスリープしたため会話を一時停止しました";
      }
      return;
    }

    if (!recognitionFailed) {
      if (finalTranscript.trim()) {
        noSpeechStreak = 0;
        speechStatus.textContent = "認識完了";
        await handleRecognizedSpeech(finalTranscript.trim());
      } else {
        handleNoSpeech();
      }
    } else {
      idlePromptAllowed = true;
      scheduleIdlePrompt();

      if (recognitionError === "no-speech") {
        handleNoSpeech();
      } else if (
        recognitionError === "aborted" &&
        automaticConversationStarted &&
        !document.hidden
      ) {
        initializeSpeechRecognition();
        speechStatus.textContent = "音声認識を再接続しています…";
        scheduleAutomaticListening(1_500);
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
  speechButton.disabled =
    speaking || isReplying || isRecognitionStopping || !SpeechRecognition;

  if (speaking) {
    statusBadge.textContent = "話しています";
    stopBlinking(!isReactionActive);
    startMouthAnimation();
  } else {
    stopMouthAnimation(!isReactionActive);
    scheduleBlink();

    if (!isListening) {
      statusBadge.textContent = "待機中";
    }
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
    voiceStatus.textContent = "通常音声はOpenAI marinです";
    return;
  }

  refreshAvailableVoices();
  window.speechSynthesis.addEventListener("voiceschanged", refreshAvailableVoices);
  voiceStatus.textContent = "通常音声はOpenAI marinです";
}

function speakWithDevice(text, { test = false } = {}) {
  return new Promise((resolveSpeech) => {
    if (!("speechSynthesis" in window)) {
      resolveSpeech(false);
      return;
    }

    if (isListening && speechRecognition) {
      requestRecognitionStop("speech-output");
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

async function speakWithCloud(text, { test = false } = {}) {
  if (isListening && speechRecognition) {
    requestRecognitionStop("speech-output");
  }

  voiceStatus.textContent = "marin音声を生成しています…";

  const response = await fetch("/api/speech", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      language: speechLanguage.value
    })
  });

  if (!response.ok) {
    throw new Error(`Cloud speech failed with HTTP ${response.status}`);
  }

  const audioUrl = URL.createObjectURL(await response.blob());
  const audio = cloudAudio ?? new Audio();
  cloudAudio = audio;
  audio.src = audioUrl;

  return new Promise((resolveSpeech) => {
    let finished = false;

    const finishSpeech = (success, message) => {
      if (finished) {
        return;
      }

      finished = true;
      audio.pause();
      audio.onplay = null;
      audio.onended = null;
      audio.onerror = null;
      audio.removeAttribute("src");
      audio.load();
      URL.revokeObjectURL(audioUrl);
      setSpeakingState(false);
      voiceStatus.textContent = message;
      resolveSpeech(success);
    };

    audio.onplay = () => {
      setSpeakingState(true);
      voiceStatus.textContent = "OpenAI marinで読み上げています";
      if (!test) {
        speechStatus.textContent = "返事を読み上げています…";
      }
    };

    audio.onended = () => {
      finishSpeech(true, "読み上げが終わりました");
    };

    audio.onerror = () => {
      finishSpeech(false, "クラウド音声を再生できませんでした");
    };

    audio.play().catch(() => {
      finishSpeech(false, "クラウド音声の自動再生が許可されませんでした");
    });
  });
}

async function unlockCloudAudio() {
  if (cloudAudioUnlocked) {
    return true;
  }

  const silentWav =
    "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQQAAACAgICA";
  const audio = cloudAudio ?? new Audio();
  cloudAudio = audio;
  audio.setAttribute("playsinline", "");
  audio.src = silentWav;
  audio.volume = 0.01;

  try {
    const playResult = Promise.resolve(audio.play()).then(
      () => true,
      () => false
    );
    const didStart = await Promise.race([
      playResult,
      wait(400).then(() => !audio.paused)
    ]);
    cloudAudioUnlocked = didStart;
    return didStart;
  } catch (error) {
    console.error("Cloud audio unlock failed:", error);
    return false;
  } finally {
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    audio.volume = 1;
  }
}

async function speakText(text, options = {}) {
  try {
    const success = await speakWithCloud(text, options);
    if (success) {
      return true;
    }
  } catch (error) {
    console.error(error);
  }

  voiceStatus.textContent = "端末の音声へ切り替えています…";
  return speakWithDevice(text, options);
}

async function speakTestPhrase() {
  if (isSpeaking) {
    if (cloudAudio) {
      cloudAudio.pause();
    }
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setSpeakingState(false);
    voiceStatus.textContent = "読み上げを停止しました";
    return;
  }

  await unlockCloudAudio();
  void speakText(testPhrases[speechLanguage.value], { test: true });
}

async function requestAiReply({
  text,
  language,
  characterName,
  customerName,
  customerFavoriteDrink,
  customerPersonality,
  customerAttribute,
  customerTraits,
  previousVisitAt
}) {
  const response = await fetch("/api/reply", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      language,
      characterName,
      customerName,
      customerFavoriteDrink,
      customerPersonality,
      customerAttribute,
      customerTraits,
      previousVisitAt
    })
  });

  if (!response.ok) {
    throw new Error(`AI reply failed with HTTP ${response.status}`);
  }

  const body = await response.json();
  if (typeof body.reply !== "string" || !body.reply.trim()) {
    throw new Error("AI reply was empty.");
  }

  return body.reply.trim();
}

function recordActivity(event) {
  void fetch("/api/activity", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event }),
    keepalive: true
  }).catch((error) => {
    console.info("Activity logging was unavailable.", error);
  });
}

function currentCharacterName() {
  return availableCharacters.find(
    (character) => character.id === currentCharacterId
  )?.name ?? "ちーママ";
}

function currentCharacter() {
  return availableCharacters.find(
    (character) => character.id === currentCharacterId
  ) ?? null;
}

function clearReactionTimer() {
  if (reactionTimer !== null) {
    window.clearTimeout(reactionTimer);
    reactionTimer = null;
  }
}

function blinkSources(character = currentCharacter()) {
  const half = character?.blinkImages?.half;
  const closed = character?.blinkImages?.closed;
  return half && closed ? { half, closed } : null;
}

function mouthSources(character = currentCharacter()) {
  const small = character?.mouthImages?.small;
  const open = character?.mouthImages?.open;
  return small && open ? { small, open } : null;
}

function stopBlinking(restoreNormalImage = false) {
  if (blinkTimer !== null) {
    window.clearTimeout(blinkTimer);
    blinkTimer = null;
  }

  blinkSequenceId += 1;

  if (restoreNormalImage) {
    const character = currentCharacter();
    if (character?.foregroundImage) {
      characterImage.src = character.foregroundImage;
    }
  }
}

function scheduleBlink(delayMs = 2800 + Math.random() * 4200) {
  if (
    document.body.classList.contains("motion-paused") ||
    isSpeaking ||
    isReactionActive ||
    !blinkSources()
  ) {
    return;
  }

  if (blinkTimer !== null) {
    window.clearTimeout(blinkTimer);
  }

  blinkTimer = window.setTimeout(runBlink, delayMs);
}

function runBlink() {
  const character = currentCharacter();
  const sources = blinkSources(character);

  if (
    !sources ||
    isReactionActive ||
    document.body.classList.contains("motion-paused")
  ) {
    scheduleBlink();
    return;
  }

  blinkTimer = null;
  const sequenceId = ++blinkSequenceId;
  const frames = [
    { source: sources.half, durationMs: 70 },
    { source: sources.closed, durationMs: 95 },
    { source: sources.half, durationMs: 70 },
    { source: character.foregroundImage, durationMs: 0 }
  ];
  let frameIndex = 0;

  function showNextFrame() {
    if (sequenceId !== blinkSequenceId || isReactionActive) {
      return;
    }

    const frame = frames[frameIndex];
    characterImage.src = frame.source;
    frameIndex += 1;

    if (frameIndex < frames.length) {
      blinkTimer = window.setTimeout(showNextFrame, frame.durationMs);
    } else {
      blinkTimer = null;
      scheduleBlink();
    }
  }

  showNextFrame();
}

function stopMouthAnimation(restoreNormalImage = false) {
  if (mouthTimer !== null) {
    window.clearTimeout(mouthTimer);
    mouthTimer = null;
  }

  mouthSequenceId += 1;

  if (restoreNormalImage) {
    const character = currentCharacter();
    if (character?.foregroundImage) {
      characterImage.src = character.foregroundImage;
    }
  }
}

function startMouthAnimation() {
  const character = currentCharacter();
  const sources = mouthSources(character);

  stopMouthAnimation(false);

  if (
    !isSpeaking ||
    !sources ||
    isReactionActive ||
    document.body.classList.contains("motion-paused")
  ) {
    return;
  }

  const sequenceId = mouthSequenceId;
  const frames = [
    character.foregroundImage,
    sources.small,
    character.foregroundImage,
    sources.open,
    sources.small
  ];
  let frameIndex = 0;

  function showNextMouthFrame() {
    if (
      sequenceId !== mouthSequenceId ||
      !isSpeaking ||
      isReactionActive
    ) {
      return;
    }

    characterImage.src = frames[frameIndex];
    frameIndex = (frameIndex + 1) % frames.length;
    mouthTimer = window.setTimeout(showNextMouthFrame, 350);
  }

  showNextMouthFrame();
}

function resetReactionImage() {
  clearReactionTimer();
  isReactionActive = false;
  characterImage.classList.remove(
    "reaction-bounce",
    "reaction-gentle",
    "reaction-nod"
  );

  const character = currentCharacter();
  if (character?.foregroundImage) {
    characterImage.src = character.foregroundImage;
  }

  if (isSpeaking) {
    startMouthAnimation();
  } else {
    scheduleBlink();
  }
}

function populateReactionOptions(character) {
  const reactions = Array.isArray(character.reactions) ?
    character.reactions.filter(
      (reaction) => reaction.id && reaction.name && reaction.image
    ) : [];

  reactionSelect.replaceChildren();

  if (reactions.length === 0 || !character.foregroundImage) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "登録なし";
    reactionSelect.append(option);
    reactionSelect.disabled = true;
    reactionTestButton.disabled = true;
    return;
  }

  for (const reaction of reactions) {
    const option = document.createElement("option");
    option.value = reaction.id;
    option.textContent = reaction.name;
    reactionSelect.append(option);
  }

  reactionSelect.disabled = false;
  reactionTestButton.disabled = false;
}

function automaticReactionForText(text, character = currentCharacter()) {
  const normalizedText = text.normalize("NFKC").toLocaleLowerCase();
  const reactions = Array.isArray(character?.reactions) ?
    character.reactions : [];

  return reactions.find((reaction) =>
    Array.isArray(reaction.triggers) && reaction.triggers.some((trigger) =>
      normalizedText.includes(
        String(trigger).normalize("NFKC").toLocaleLowerCase()
      )
    )
  )?.id ?? null;
}

async function showReaction(reactionId) {
  const character = currentCharacter();
  const reaction = character?.reactions?.find(
    (candidate) => candidate.id === reactionId
  );

  if (!character?.foregroundImage || !reaction) {
    resetReactionImage();
    return;
  }

  clearReactionTimer();
  stopBlinking(false);
  stopMouthAnimation(false);
  isReactionActive = true;

  try {
    await preloadImage(reaction.image);
    characterImage.classList.remove(
      "reaction-bounce",
      "reaction-gentle",
      "reaction-nod"
    );
    characterImage.src = reaction.image;
    void characterImage.offsetWidth;

    const motionClass = {
      bounce: "reaction-bounce",
      gentle: "reaction-gentle",
      nod: "reaction-nod"
    }[reaction.motion];

    if (motionClass) {
      characterImage.classList.add(motionClass);
    }

    characterStatus.textContent = `${character.name}：${reaction.name}`;
    reactionTimer = window.setTimeout(() => {
      resetReactionImage();
      characterStatus.textContent = `${character.name}を表示しています`;
    }, Number(reaction.durationMs) || 2400);
  } catch (error) {
    console.error(error);
    resetReactionImage();
    characterStatus.textContent = "リアクション画像を読み込めませんでした";
  }
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

function clearRecognitionStopTimer() {
  if (recognitionStopTimer !== null) {
    window.clearTimeout(recognitionStopTimer);
    recognitionStopTimer = null;
  }
}

function clearAndroidWakeLockTimer() {
  if (androidWakeLockTimer !== null) {
    window.clearTimeout(androidWakeLockTimer);
    androidWakeLockTimer = null;
  }
}

async function releaseAndroidWakeLock() {
  clearAndroidWakeLockTimer();

  if (!androidWakeLock) {
    return;
  }

  const activeWakeLock = androidWakeLock;
  androidWakeLock = null;

  try {
    await activeWakeLock.release();
  } catch (error) {
    console.info("画面スリープ抑止の解除に失敗しました。", error);
  }
}

async function keepAndroidAwakeForConversation() {
  if (
    !("wakeLock" in navigator) ||
    document.hidden
  ) {
    return;
  }

  clearAndroidWakeLockTimer();

  if (!androidWakeLock) {
    try {
      androidWakeLock = await navigator.wakeLock.request("screen");
      androidWakeLock.addEventListener("release", () => {
        androidWakeLock = null;
      }, { once: true });
    } catch (error) {
      console.info("画面スリープの抑止を利用できませんでした。", error);
      return;
    }
  }

  androidWakeLockTimer = window.setTimeout(() => {
    void releaseAndroidWakeLock();
  }, 120_000);
}

function finishRecognitionStop() {
  clearRecognitionStopTimer();
  recognitionStopReason = null;
  isRecognitionStopping = false;
  updateSpeechButtonLabel();
  speechButton.disabled = isSpeaking || isReplying || !SpeechRecognition;
}

function requestRecognitionStop(reason) {
  if (!speechRecognition || (!isListening && !isRecognitionStopping)) {
    return;
  }

  recognitionStopReason = reason;
  isRecognitionStopping = true;
  clearAutomaticRestartTimer();
  updateSpeechButtonLabel();
  speechButton.disabled = true;

  try {
    if (reason === "hidden") {
      speechRecognition.abort();
    } else {
      speechRecognition.stop();
    }
  } catch (error) {
    console.error(error);
  }

  clearRecognitionStopTimer();
  recognitionStopTimer = window.setTimeout(() => {
    if (!isRecognitionStopping) {
      return;
    }

    initializeSpeechRecognition();
    finishRecognitionStop();
    setListeningState(false);

    if (reason === "manual") {
      speechStatus.textContent = "会話を停止しました";
    } else if (reason === "hidden") {
      speechStatus.textContent =
        "画面がスリープしたため会話を一時停止しました";
    }
  }, 2_000);
}

function handleNoSpeech() {
  noSpeechStreak += 1;

  if (!isAutomaticConversation() || !automaticConversationStarted) {
    speechStatus.textContent =
      "音声を聞き取れませんでした。もう一度お試しください。";
    idlePromptAllowed = true;
    scheduleIdlePrompt();
    return;
  }

  if (noSpeechStreak >= 3) {
    automaticConversationStarted = false;
    clearAutomaticRestartTimer();
    clearIdlePromptTimer();
    speechStatus.textContent =
      "声を確認できないため待機しています。「会話を始める」を押してください。";
    statusBadge.textContent = "待機中";
    updateSpeechButtonLabel();
    return;
  }

  const retryDelay = Math.min(10_000, 1_500 * (2 ** (noSpeechStreak - 1)));
  speechStatus.textContent = "声を待っています…";
  scheduleAutomaticListening(retryDelay);
}

function startListening() {
  if (
    !speechRecognition ||
    isListening ||
    isRecognitionStopping ||
    isSpeaking ||
    isReplying ||
    document.hidden ||
    settingsToggle.getAttribute("aria-expanded") === "true"
  ) {
    return;
  }

  if (isAppleMobileBrowser) {
    initializeSpeechRecognition();
  }

  clearIdlePromptTimer();
  clearAutomaticRestartTimer();
  finalTranscript = "";
  recognitionFailed = false;
  recognitionError = "";
  speechTranscript.textContent = "…";
  statusBadge.textContent = "準備中";
  speechStatus.textContent = "マイクを準備しています…";
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

function scheduleAutomaticListening(
  delay = isAppleMobileBrowser ? 1_800 : 700
) {
  clearAutomaticRestartTimer();

  if (
    !isAutomaticConversation() ||
    !automaticConversationStarted ||
    document.hidden ||
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
    isAppleMobileBrowser ||
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
  void keepAndroidAwakeForConversation();
  isReplying = true;
  speechButton.disabled = true;
  speechStatus.textContent = "返事を考えています…";

  try {
    let reply;

    try {
      reply = await requestAiReply({
        text,
        language: speechLanguage.value,
        characterName: currentCharacterName(),
        customerName: currentCustomer?.name ?? "",
        customerFavoriteDrink: currentCustomer?.favoriteDrink ?? "",
        customerPersonality: currentCustomer?.personality ?? "",
        customerAttribute: currentCustomer?.attribute ?? "",
        customerTraits: currentCustomer?.traits ?? "",
        previousVisitAt: currentCustomer?.previousVisitAt ?? null
      });
    } catch (error) {
      console.error(error);
      reply = await generateLocalReply({
        text,
        language: speechLanguage.value,
        characterName: currentCharacterName()
      });
      speechStatus.textContent = "AIに接続できないため、端末内の返事を使います";
    }

    replySpeaker.textContent = currentCharacterName();
    characterReply.textContent = reply;
    const automaticReactionId = automaticReactionForText(text);
    if (automaticReactionId) {
      await showReaction(automaticReactionId);
    }
    await wait(350);
    await speakText(reply);
    speechStatus.textContent = "もう一度話せます";
  } catch (error) {
    console.error(error);
    speechStatus.textContent = "返事を作れませんでした。もう一度お試しください。";
  } finally {
    isReplying = false;
    setSpeakingState(false);
    void keepAndroidAwakeForConversation();
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
  const reactionSources = Array.isArray(character.reactions) ?
    character.reactions.map((reaction) => reaction.image).filter(Boolean) : [];
  const characterBlinkSources = blinkSources(character);
  const characterMouthSources = mouthSources(character);
  const sources = [
    backgroundSource,
    foregroundSource,
    characterBlinkSources?.half,
    characterBlinkSources?.closed,
    characterMouthSources?.small,
    characterMouthSources?.open,
    ...reactionSources
  ].filter(Boolean);

  if (!backgroundSource || sources.length === 0) {
    throw new Error(`Character ${character.id} has no usable image.`);
  }

  characterSelect.disabled = true;
  characterStatus.textContent = `${character.name}を読み込んでいます…`;

  try {
    clearReactionTimer();
    stopBlinking(false);
    stopMouthAnimation(false);
    isReactionActive = false;
    characterImage.classList.remove(
      "reaction-bounce",
      "reaction-gentle",
      "reaction-nod"
    );
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
    populateReactionOptions(character);
    if (isSpeaking) {
      startMouthAnimation();
    } else {
      scheduleBlink();
    }
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
  if (isOpen) {
    setSettingsOpen(false);
    return;
  }
  openAdminPinOverlay();
});

settingsClose.addEventListener("click", () => setSettingsOpen(false));
settingsBackdrop.addEventListener("click", () => setSettingsOpen(false));

customerNumber.addEventListener("input", () => {
  customerNumber.value = fourDigits(customerNumber.value);
});
customerBirthdayInput.addEventListener("input", () => {
  customerBirthdayInput.value = fourDigits(customerBirthdayInput.value);
});
adminPinInput.addEventListener("input", () => {
  adminPinInput.value = fourDigits(adminPinInput.value);
});
customerLookup.addEventListener("click", lookupCustomer);
customerRegisterOpen.addEventListener("click", () => {
  if (customerNumber.value.length !== 4) {
    customerStatus.textContent = "先に4桁のお客様番号を入力してください。";
    return;
  }
  customerStatus.textContent = "";
  customerRegisterForm.hidden = false;
  customerNameInput.focus();
});
customerRegisterForm.addEventListener("submit", registerCustomer);
customerGuest.addEventListener("click", () => setCurrentCustomer(null));
customerBadge.addEventListener("click", openCustomerOverlay);
customerLogout.addEventListener("click", logoutCustomer);
adminPinForm.addEventListener("submit", verifyAdminPin);
adminPinCancel.addEventListener("click", () => {
  adminPinOverlay.hidden = true;
});
customerListRefresh.addEventListener("click", loadCustomerList);
customerList.addEventListener("click", async (event) => {
  const button = event.target.closest(".customer-delete-button");
  if (!button) {
    return;
  }

  const { customerNumber: number, customerName: name } = button.dataset;
  if (!window.confirm(`${name}（${number}）の登録を削除しますか？`)) {
    return;
  }

  try {
    await customerRequest(`/api/admin/customers/${number}`, {
      method: "DELETE",
      headers: { "X-Admin-Pin": activeAdminPin }
    });
    if (currentCustomer?.number === number) {
      setCurrentCustomer(null);
    }
    await loadCustomerList();
  } catch (error) {
    customerListStatus.textContent = error.message;
  }
});

speechPanelPosition.addEventListener("change", () => {
  setSpeechPanelPosition(speechPanelPosition.value);
});

conversationMode.addEventListener("change", () => {
  localStorage.setItem(conversationModeStorageKey, conversationMode.value);
  clearAutomaticRestartTimer();
  automaticConversationStarted = false;

  if (isListening && speechRecognition) {
    requestRecognitionStop("mode-change");
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

reactionTestButton.addEventListener("click", () => {
  const selectedReactionId = reactionSelect.value;
  setSettingsOpen(false);
  window.setTimeout(() => {
    void showReaction(selectedReactionId);
  }, 180);
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

speechButton.addEventListener("click", async () => {
  if (!speechRecognition) {
    return;
  }

  if (
    (isAutomaticConversation() && automaticConversationStarted) ||
    (!isAutomaticConversation() && isListening)
  ) {
    recordActivity("conversation_stopped");
    automaticConversationStarted = false;
    clearAutomaticRestartTimer();
    noSpeechStreak = 0;

    if (isAppleMobileBrowser && isAutomaticConversation() && isListening) {
      appleConversationPaused = true;
      finalTranscript = "";
      speechTranscript.textContent = "…";
      speechStatus.textContent = "会話を停止しました";
      updateSpeechButtonLabel();
      return;
    }

    if (isListening || isRecognitionStopping) {
      requestRecognitionStop("manual");
    } else {
      speechStatus.textContent = "会話を停止しました";
      updateSpeechButtonLabel();
    }
    return;
  }

  recordActivity("conversation_started");
  idlePromptAllowed = true;
  automaticConversationStarted = isAutomaticConversation();
  appleConversationPaused = false;
  noSpeechStreak = 0;
  updateSpeechButtonLabel();
  void keepAndroidAwakeForConversation();
  speechStatus.textContent = "音声を準備しています…";
  await unlockCloudAudio();
  if (isAppleMobileBrowser) {
    await wait(700);
  }
  if (!isAppleMobileBrowser) {
    unlockSpeechSynthesis();
  }

  if (isAppleMobileBrowser && isListening) {
    speechStatus.textContent = "話してください…";
    updateSpeechButtonLabel();
    return;
  }

  startListening();
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    pageWasHidden = true;
    automaticConversationStarted = false;
    clearAutomaticRestartTimer();
    void releaseAndroidWakeLock();

    if (isAppleMobileBrowser) {
      appleConversationPaused = true;
      finalTranscript = "";
      speechStatus.textContent =
        "画面がスリープしたため会話を一時停止しました";
      updateSpeechButtonLabel();
      return;
    }

    if (isListening || isRecognitionStopping) {
      requestRecognitionStop("hidden");
    } else {
      speechStatus.textContent =
        "画面がスリープしたため会話を一時停止しました";
      updateSpeechButtonLabel();
    }
    return;
  }

  if (isAppleMobileBrowser && pageWasHidden) {
    window.location.reload();
    return;
  }

  pageWasHidden = false;

  if (!isListening && !isSpeaking && !isReplying) {
    speechStatus.textContent = isAutomaticConversation() ?
      "「会話を始める」を押して再開してください" :
      "「話す」を押してください";
    updateSpeechButtonLabel();
  }
});

document.addEventListener("pointerdown", unlockSpeechSynthesis, { once: true });

restoreMotionPreference();
restoreSpeechPanelPosition();
restoreConversationMode();
initializeSpeechRecognition();
initializeSpeechSynthesis();
loadCharacters().finally(() => scheduleIdlePrompt());
