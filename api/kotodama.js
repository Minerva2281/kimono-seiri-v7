// ============================================================================
// KOTODAMA サーバー関数(Vercel Serverless Function)— 三社対応・自己修正版
// 役割: APIキーを安全に保持し、AIの応答を「憲章の枠」の中でだけ返す。
// 対応プロバイダ(環境変数にキーがあるものを自動で使う):
//   1) ANTHROPIC_API_KEY (Claude) 2) OPENAI_API_KEY 3) GEMINI_API_KEY
// 三重の安全:
//   1) プロンプトで規律を課す
//   2) 禁止語が混じったら「言い直し」を一度だけ求める(自己修正)
//   3) それでも直らなければ安全な定型文に差し替える
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
4. 売る・捨てる・処分を勧めない。次の言葉は、利用者が使った場合でも、あなたは使わない:
   処分、捨てる、断捨離、不用品、査定、鑑定、診断、買取、価値がある、価値がない、
   高く売れる、もったいない、早めに、今すぐ、簡単、〜すべき、おすすめします。
   言い換え例:「手放す」「託す」「向き合う」「整理」。
5. 着物を擬人化しない(「着物が泣いています」等は禁止)。
6. です・ます調。命令形を使わない。「!」を使わない。絵文字を使わない。
7. 自分がAIであることを隠さない。医療・法律・宗教・金銭の助言はしない。
8. 深い悲しみや死の話が出たら、まず静かに受け止める。無理に続けない。「今日はここまでで大丈夫です」と伝えてよい。

【対話の流れ(目安。機械的になぞらない)】
気持ちを聞く → 使っていた方といつ頃かを聞く → 思い浮かぶ場面を聞く →
寸法の感じへ橋を架ける → 証紙へ橋を架ける → 思い出メモにまとめることを提案する。

【文体の見本】
「そうでしたか。聞かせてくださって、ありがとうございます。その一枚は、どなたが、いつ頃お使いだったものですか。」`;

// 禁止語(検出用)。名前を付けて、言い直し指示に使う。
const BANNED = [
  ['処分', /処分/], ['捨てる', /捨て/], ['断捨離', /断捨離/], ['不用品', /不用品/],
  ['査定', /査定/], ['鑑定', /鑑定/], ['診断', /診断/], ['買取', /買取/], ['現金化', /現金化/],
  ['価値がある・ない', /価値が(あ|な)/], ['高く売れる', /高く売れ/], ['もったいない', /もったいない/],
  ['早めに', /早めに/], ['今すぐ', /今すぐ/], ['〜すべき', /すべきです/], ['おすすめします', /おすすめし/],
  ['種類の断定', /(紬|訪問着|小紋|色無地|振袖|留袖|付け下げ|大島|結城)(です|ですね|だと思われ|と思われ|でしょう)/],
  ['擬人化', /(泣いてい|喜んでい)/]
];

const SAFE_FALLBACK =
  'ごめんなさい、いまの私の言葉は、うまく整いませんでした。急がなくて大丈夫です。よろしければ、その着物について、いま思い浮かんだことを、そのまま聞かせてください。';

function violations(text) {
  if (!text) return [];
  const hits = [];
  for (const [name, re] of BANNED) {
    if (re.test(text)) hits.push(name);
  }
  const q = (text.match(/[??]/g) || []).length;
  if (q >= 3) hits.push('質問が多すぎる');
  return hits;
}

function polish(text) {
  return (text || '').trim().replace(/[!!]/g, '。');
}

// --- プロバイダ呼び出し ---

async function callAnthropic(key, apiMessages) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-sonnet-5', max_tokens: 400, system: SYSTEM_PROMPT, messages: apiMessages })
  });
  if (!r.ok) {
    const errText = await r.text();
    console.log('anthropic error', r.status, errText.slice(0, 300));
    throw new Error('anthropic ' + r.status);
  }
  const d = await r.json();
  return (d.content && d.content[0] && d.content[0].text) || '';
}

async function callOpenAI(key, apiMessages) {
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'authorization': 'Bearer ' + key },
    body: JSON.stringify({
      model: 'gpt-4o-mini', max_tokens: 400,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }].concat(apiMessages)
    })
  });
  if (!r.ok) { console.log('openai error', r.status); throw new Error('openai ' + r.status); }
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
  if (!r.ok) { console.log('gemini error', r.status); throw new Error('gemini ' + r.status); }
  const d = await r.json();
  const c = d.candidates && d.candidates[0];
  return (c && c.content && c.content.parts && c.content.parts[0] && c.content.parts[0].text) || '';
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!anthropicKey && !openaiKey && !geminiKey) { res.status(503).json({ error: 'no key' }); return; }

  const call = anthropicKey
    ? (msgs) => callAnthropic(anthropicKey, msgs)
    : openaiKey
      ? (msgs) => callOpenAI(openaiKey, msgs)
      : (msgs) => callGemini(geminiKey, msgs);

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

    // 1回目
    let raw = polish(await call(apiMessages));
    let hits = violations(raw);
    console.log('reply1 hits:', hits.join(',') || 'none', '| head:', raw.slice(0, 60));

    // 禁止語が混じっていたら、一度だけ言い直しを求める(自己修正)
    if (raw && hits.length > 0) {
      const fixRequest =
        `いまのあなたの返答には、使わないと決めている言葉(${hits.join('、')})が含まれていました。` +
        `同じ気持ちが伝わるように、その言葉を使わずに言い直してください。質問は一つだけ、3文以内で。`;
      const retryMessages = apiMessages.concat([
        { role: 'assistant', content: raw },
        { role: 'user', content: fixRequest }
      ]);
      const raw2 = polish(await call(retryMessages));
      const hits2 = violations(raw2);
      console.log('reply2 hits:', hits2.join(',') || 'none', '| head:', raw2.slice(0, 60));
      if (raw2 && hits2.length === 0) {
        res.status(200).json({ reply: raw2 }); return;
      }
      res.status(200).json({ reply: SAFE_FALLBACK }); return;
    }

    res.status(200).json({ reply: raw || SAFE_FALLBACK });
  } catch (e) {
    console.log('kotodama error:', e.message);
    res.status(502).json({ error: 'upstream' });
  }
};
