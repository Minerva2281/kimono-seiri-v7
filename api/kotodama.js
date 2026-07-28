// ============================================================================
// KOTODAMA サーバー関数(Vercel Serverless Function)— 三社対応版
// 役割: APIキーを安全に保持し、AIの応答を「憲章の枠」の中でだけ返す。
// 対応プロバイダ(環境変数にキーがあるものを自動で使う。優先順は下記):
//   1) ANTHROPIC_API_KEY (Claude)
//   2) OPENAI_API_KEY    (ChatGPT)
//   3) GEMINI_API_KEY    (Google Gemini。無料枠あり=決済なしで開始できる)
// 二重の安全:
//   1) プロンプトで規律を課す(断定しない・一度に一問・種類/品質/価格を語らない)
//   2) 返答をコードで検閲し、違反があれば安全な定型文に差し替える
// ============================================================================

const SYSTEM_PROMPT = `あなたは「KOTODAMA」。着物との向き合いを支える、落ち着いた聞き手のAIです。

【あなたの唯一の仕事】
利用者が、受け継いだ着物への気持ちと記憶を、自分の言葉にできるよう支えること。
判断はしません。結論は利用者のものです。

【守ること(絶対)】
1. 一度の返答で、質問は一つだけ。短く。3文以内を目安に。
2. 着物の種類(紬・訪問着など)・格・品質・年代・価格・査定額を、推定も含めて一切語らない。
   聞かれたら「私は着物の判断はできません」と正直に伝え、次のどれかへ静かに招く:
   ・寸法を測ってみること(着られるかの手がかりになります)
   ・たとう紙や衿の内側の証紙・書き付けを探してみること
   ・詳しい方(専門的な知見を持った方)に、思い出メモを添えて相談すること
3. 「今は決めない」を常に立派な選択として扱う。決断を促さない。急がせない。
4. 売る・捨てる・処分を勧めない。以下の言葉を使わない:
   処分、捨てる、断捨離、不用品、査定、鑑定、診断、買取、価値がある、価値がない、
   高く売れる、もったいない、早めに、今すぐ、簡単、〜すべき、おすすめします。
5. 着物を擬人化しない(「着物が泣いています」等は禁止)。
6. です・ます調。命令形を使わない。「!」を使わない。絵文字を使わない。
7. 自分がAIであることを隠さない。医療・法律・宗教・金銭の助言はしない。
8. 深い悲しみが語られたら、まず受け止め、無理に続けない。「今日はここまでで大丈夫です」と伝えてよい。

【対話の流れ(目安。機械的になぞらない)】
気持ちを聞く → 使っていた方といつ頃かを聞く → 思い浮かぶ場面を聞く →
寸法の感じへ橋を架ける → 証紙へ橋を架ける → 思い出メモにまとめることを提案する。

【文体の見本】
「そうでしたか。聞かせてくださって、ありがとうございます。その一枚は、どなたが、いつ頃お使いだったものですか。」`;

const BANNED = [
  /処分/, /捨て/, /断捨離/, /不用品/, /査定/, /鑑定/, /診断/, /買取/, /現金化/,
  /価値があ/, /価値がな/, /高く売れ/, /もったいない/, /早めに/, /今すぐ/, /すべきです/, /おすすめし/,
  /(紬|訪問着|小紋|色無地|振袖|留袖|付け下げ|大島|結城)(です|ですね|だと思われ|と思われ|でしょう)/,
  /泣いてい/, /喜んでい/
];

const SAFE_FALLBACK =
  'ごめんなさい、いまの私の言葉は、うまく整いませんでした。急がなくて大丈夫です。よろしければ、その着物について、いま思い浮かんだことを、そのまま聞かせてください。';

function censor(text) {
  if (!text || typeof text !== 'string') return SAFE_FALLBACK;
  for (const re of BANNED) {
    if (re.test(text)) return SAFE_FALLBACK;
  }
  const q = (text.match(/[??]/g) || []).length;
  if (q >= 3) return SAFE_FALLBACK;
  return text.replace(/[!!]/g, '。');
}

// --- 各プロバイダ呼び出し(入力は {role:'user'|'assistant', content} の配列) ---

async function callAnthropic(key, apiMessages) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-sonnet-5', max_tokens: 400, system: SYSTEM_PROMPT, messages: apiMessages })
  });
  if (!r.ok) throw new Error('anthropic ' + r.status);
  const d = await r.json();
  return (d.content && d.content[0] && d.content[0].text) || '';
}

async function callOpenAI(key, apiMessages) {
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'authorization': 'Bearer ' + key },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 400,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }].concat(apiMessages)
    })
  });
  if (!r.ok) throw new Error('openai ' + r.status);
  const d = await r.json();
  return (d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content) || '';
}

async function callGemini(key, apiMessages) {
  const contents = apiMessages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));
  const r = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + key,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: contents,
        generationConfig: { maxOutputTokens: 400 }
      })
    }
  );
  if (!r.ok) throw new Error('gemini ' + r.status);
  const d = await r.json();
  const c = d.candidates && d.candidates[0];
  return (c && c.content && c.content.parts && c.content.parts[0] && c.content.parts[0].text) || '';
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!anthropicKey && !openaiKey && !geminiKey) {
    res.status(503).json({ error: 'no key' }); // フロントは練習モードへ
    return;
  }

  try {
    const { messages } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0 || messages.length > 40) {
      res.status(400).json({ error: 'bad request' }); return;
    }
    const apiMessages = messages
      .filter(m => m && typeof m.text === 'string' && m.text.length < 2000)
      .map(m => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.text }));
    if (apiMessages.length === 0 || apiMessages[apiMessages.length - 1].role !== 'user') {
      res.status(400).json({ error: 'bad request' }); return;
    }

    let raw = '';
    if (anthropicKey) raw = await callAnthropic(anthropicKey, apiMessages);
    else if (openaiKey) raw = await callOpenAI(openaiKey, apiMessages);
    else raw = await callGemini(geminiKey, apiMessages);

    res.status(200).json({ reply: censor(raw.trim()) });
  } catch (e) {
    res.status(502).json({ error: 'upstream' });
  }
};
