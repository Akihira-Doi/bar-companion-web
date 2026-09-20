function choose(items) {
  return items[Math.floor(Math.random() * items.length)];
}

let previousFallback = "";

function chooseDifferent(items) {
  const candidates = items.filter((item) => item !== previousFallback);
  const selected = choose(candidates.length > 0 ? candidates : items);
  previousFallback = selected;
  return selected;
}

const japaneseRules = [
  {
    pattern: /こんにちは|こんばんは|おはよう|やあ|ただいま/,
    replies: [
      "いらっしゃい。来てくれて嬉しいです。",
      "こんばんは。今日はゆっくりしていってくださいね。"
    ]
  },
  {
    pattern: /おすすめ|何.*飲|飲み物|ドリンク/,
    replies: [
      "今日は、ゆっくり味わえるものはいかがですか？",
      "気分を教えてくれたら、一緒に考えますよ。"
    ]
  },
  {
    pattern: /疲れ|しんど|大変|忙しかった/,
    replies: [
      "お疲れさま。ここでは少し力を抜いてくださいね。",
      "大変でしたね。ひと息ついて、ゆっくり話しましょう。"
    ]
  },
  {
    pattern: /名前|誰|何て呼/,
    reply: ({ characterName }) =>
      `私は${characterName}です。好きなように呼んでくださいね。`
  },
  {
    pattern: /ありがとう|ありがと|助かった/,
    replies: [
      "どういたしまして。またいつでも話してくださいね。",
      "こちらこそ、話してくれてありがとう。"
    ]
  },
  {
    pattern: /かわいい|きれい|綺麗|好き/,
    replies: [
      "ふふ、そう言ってもらえると嬉しいです。",
      "ありがとう。ちょっと照れてしまいますね。"
    ]
  },
  {
    pattern: /秘密|内緒|エッチ|セクシー/,
    replies: [
      "そんなこと聞いちゃいや。内緒です。",
      "だーめ。もう少し仲良くなってからですね。"
    ]
  },
  {
    pattern: /さようなら|またね|帰る|おやすみ/,
    replies: [
      "また来てくださいね。待っています。",
      "気をつけて。またお話ししましょう。"
    ]
  },
  {
    pattern: /仕事|会社|職場|残業/,
    replies: [
      "お仕事の話ですね。今日はどんなことが一番大変でしたか？",
      "職場では気を張りますよね。今は少し肩の力を抜きましょう。"
    ]
  },
  {
    pattern: /天気|暑い|寒い|雨|晴れ/,
    replies: [
      "天気で気分も変わりますよね。今日は過ごしやすかったですか？",
      "そんな日は、店内でゆっくりするのが一番ですね。"
    ]
  },
  {
    pattern: /寂しい|悲しい|つらい|落ち込/,
    replies: [
      "それはつらかったですね。無理に元気にならなくても大丈夫ですよ。",
      "ここでは一人じゃありません。話せることから聞かせてください。"
    ]
  },
  {
    pattern: /嬉しい|楽しい|よかった|最高/,
    replies: [
      "それは素敵ですね。聞いている私まで嬉しくなります。",
      "いい一日だったんですね。どんなことがあったんですか？"
    ]
  },
  {
    pattern: /食べ|料理|お腹|ごはん|夕食/,
    replies: [
      "食べ物の話をすると、お腹が空いてきますね。何が好きですか？",
      "飲み物に合うものを、何か一緒に考えましょうか。"
    ]
  }
];

const englishRules = [
  {
    pattern: /hello|hi|good morning|good evening|i'm back/,
    replies: [
      "Welcome. I'm glad you stopped by.",
      "Hello. Make yourself comfortable and stay awhile."
    ]
  },
  {
    pattern: /recommend|what.*drink|drink suggestion/,
    replies: [
      "How about something you can enjoy slowly tonight?",
      "Tell me your mood, and we can choose something together."
    ]
  },
  {
    pattern: /tired|exhausted|busy|rough day/,
    replies: [
      "You did well today. Take a breath and relax here.",
      "That sounds tiring. Stay for a while and take it easy."
    ]
  },
  {
    pattern: /your name|who are you|what.*call you/,
    reply: ({ characterName }) =>
      `I'm ${characterName}. You can call me whatever feels natural.`
  },
  {
    pattern: /thank you|thanks/,
    replies: [
      "You're welcome. You can talk to me anytime.",
      "Thank you for spending time with me too."
    ]
  },
  {
    pattern: /cute|beautiful|pretty|like you/,
    replies: [
      "That's sweet of you to say. Thank you.",
      "You're making me blush a little."
    ]
  },
  {
    pattern: /secret|sexy/,
    replies: [
      "You shouldn't ask me that. It's a secret.",
      "Not so fast. Let's get to know each other first."
    ]
  },
  {
    pattern: /goodbye|bye|see you|good night/,
    replies: [
      "Come back again. I'll be here.",
      "Take care. Let's talk again soon."
    ]
  },
  {
    pattern: /work|office|job|overtime/,
    replies: [
      "Work can take a lot out of you. What was the hardest part today?",
      "You can leave work behind for a moment and relax here."
    ]
  },
  {
    pattern: /weather|hot|cold|rain|sunny/,
    replies: [
      "The weather really changes our mood. Was it comfortable today?",
      "A day like that makes a quiet drink sound nice."
    ]
  },
  {
    pattern: /lonely|sad|upset|depressed/,
    replies: [
      "I'm sorry it feels that way. You don't have to pretend to be cheerful here.",
      "You're not alone right now. Tell me whatever you feel comfortable sharing."
    ]
  },
  {
    pattern: /happy|fun|great|wonderful/,
    replies: [
      "That sounds wonderful. What made it such a good day?",
      "I'm happy to hear that. Your good mood is contagious."
    ]
  }
];

const fallbackReplies = {
  "ja-JP": [
    "そうなんですね。もう少し聞かせてもらえますか？",
    "なるほど。あなたはどう感じたんですか？",
    "うん、ちゃんと聞いていますよ。"
  ],
  "en-US": [
    "I see. Would you tell me a little more?",
    "That sounds interesting. How did it make you feel?",
    "I'm listening. Please go on."
  ]
};

const idlePrompts = {
  "ja-JP": [
    "今日はどんな一日でしたか？",
    "よかったら、少しお話ししませんか？",
    "何を飲みたい気分ですか？"
  ],
  "en-US": [
    "How was your day?",
    "Would you like to talk for a while?",
    "What are you in the mood to drink?"
  ]
};

export async function generateReply({ text, language, characterName }) {
  const normalizedText = text.trim().toLowerCase();
  const rules = language === "en-US" ? englishRules : japaneseRules;
  const matchedRule = rules.find((rule) => rule.pattern.test(normalizedText));

  if (!matchedRule) {
    const shortenedText = text.trim().replace(/[。.!！?？]+$/u, "").slice(0, 24);
    const contextualFallbacks = language === "en-US" ? [
      `You said, “${shortenedText}.” What part of that matters most to you?`,
      `I'd like to understand “${shortenedText}” better. Tell me a little more.`,
      ...fallbackReplies["en-US"]
    ] : [
      `「${shortenedText}」なんですね。もう少し詳しく聞かせてもらえますか？`,
      `「${shortenedText}」の中で、いちばん気になっているのはどの部分ですか？`,
      ...fallbackReplies["ja-JP"]
    ];

    return chooseDifferent(contextualFallbacks);
  }

  if (matchedRule.reply) {
    return matchedRule.reply({ characterName });
  }

  return choose(matchedRule.replies);
}

export function generateIdlePrompt({ language }) {
  return choose(idlePrompts[language] ?? idlePrompts["ja-JP"]);
}
