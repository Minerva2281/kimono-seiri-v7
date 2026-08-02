// ============================================================================
// 着物判断支援ナビ V7(試作)
// 思想: 物を大切にする。手放す人の心を大切にする。
// KOTODAMA(対話AI)の約束:
//   1) 一度に一つだけ聞く  2) 着物の種類・品質・年代・価格を語らない
//   3) 事実への橋(寸法・証紙・使い手の記憶)は架ける  4) 保留は第一級の選択肢
//   5) 断定しない・急がせない・擬人化しない
// APIが未接続でも「練習モード」で全体験が動く(ライブデモの保険)。
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  const STORAGE_KEY = 'kimono-navi-v7';

  let state = {
    messages: [],      // {role:'ai'|'user', text}
    photo: null,       // dataURL(縮小済み)
    memos: [],         // {date, text, photo}
    stage: 0,          // 練習モードの進行
    apiMode: null      // null=未判定 / true / false
  };

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.messages)) state = Object.assign(state, saved);
  } catch (e) { /* 初回 */ }

  const save = () => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {} };

  // --------------------------------------------------------------------------
  // 画面遷移
  // --------------------------------------------------------------------------
  const screens = ['screen-entrance', 'screen-talk', 'screen-memo', 'screen-tansu'];
  function show(id) {
    screens.forEach(s => document.getElementById(s).classList.toggle('active', s === id));
    document.body.classList.toggle('tansu-mode', id === 'screen-tansu');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (id === 'screen-tansu') renderTansu();
  }
  document.querySelectorAll('.back-link').forEach(b =>
    b.addEventListener('click', () => show(b.getAttribute('data-target'))));
  document.getElementById('go-talk').addEventListener('click', () => { show('screen-talk'); startTalkIfNeeded(); });
  document.getElementById('go-tansu').addEventListener('click', () => show('screen-tansu'));

  // --------------------------------------------------------------------------
  // 語り場: チャット描画
  // --------------------------------------------------------------------------
  const chatLog = document.getElementById('chat-log');
  const chatInput = document.getElementById('chat-input');
  const sendBtn = document.getElementById('send-btn');

  function addMsg(role, text, persist = true) {
    const div = document.createElement('div');
    div.className = 'msg ' + role;
    const who = role === 'ai' ? 'KOTODAMA(AI)' : 'あなた';
    div.innerHTML = `<div class="who">${who}</div><div class="bubble"></div>`;
    div.querySelector('.bubble').textContent = text;
    chatLog.appendChild(div);
    chatLog.scrollTop = chatLog.scrollHeight;
    if (persist) { state.messages.push({ role, text }); save(); }
  }

  function restoreChat() {
    chatLog.innerHTML = '';
    state.messages.forEach(m => addMsg(m.role, m.text, false));
  }
  restoreChat();

  // --------------------------------------------------------------------------
  // KOTODAMA 練習モード(APIなしで動く一問一答。質問は一度に一つだけ)
  // 質問設計の出典: 実証1(「持ち主の年齢から推定する」)、事例001(寸法という事実)、
  // 松丸先生7/25(証紙があれば言える)、ことばの設計書。
  // --------------------------------------------------------------------------
  const SCRIPT = [
    'こんにちは。今日は、お話しに来てくださってありがとうございます。急がなくて大丈夫です。\n今日は、どのような気持ちで、この画面を開かれましたか。',
    'そうでしたか。聞かせてくださって、ありがとうございます。\nその一枚は、どなたが、いつ頃お使いだったものですか。分かる範囲で大丈夫です。',
    'その方のことで、最初に思い浮かぶ場面は、どんな場面ですか。',
    'いいお話ですね。ここからは、分かっていることを少しだけ確かめさせてください。\nその着物、あなたが羽織ってみたら、丈や袖はどんな感じでしたか。測らなくても、感じだけで大丈夫です。',
    'ありがとうございます。寸法の感じは、これからを考えるときの大切な手がかりになります。\nもう一つだけ。たとう紙や衿の内側などに、証紙(しょうし)や書き付けは見当たりましたか。見当たらなくても、それも大切な手がかりです。',
    'ここまでで、思い出メモにできることが揃ってきました。\n今日はうまくまとまらなくても、大丈夫です。下の「思い出メモにまとめる」を押すと、今日の言葉が形になります。続きは、またゆっくり。'
  ];

  function startTalkIfNeeded() {
    if (state.messages.length === 0) {
      addMsg('ai', SCRIPT[0]);
      state.stage = 1; save();
    }
  }

  async function kotodamaReply(userText) {
    // 毎回まずAPIを試す(過去に失敗していても、次の送信で必ず試し直す)。だめなら練習モードへ。
    try {
      const res = await fetch('/api/kotodama', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: state.messages.slice(-20) })
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.reply) {
          state.apiMode = true; save();
          return data.reply;
        }
      }
    } catch (e) { /* 接続失敗。今回は練習モードで応じる */ }
    state.apiMode = false; save();
    // 練習モード: 台本を一つずつ。終端では静かに受け止める。
    const idx = Math.min(state.stage, SCRIPT.length - 1);
    state.stage = Math.min(state.stage + 1, SCRIPT.length - 1);
    save();
    return SCRIPT[idx];
  }

  async function send() {
    const text = chatInput.value.trim();
    if (!text) return;
    chatInput.value = '';
    sendBtn.disabled = true;
    addMsg('user', text);
    const reply = await kotodamaReply(text);
    addMsg('ai', reply);
    sendBtn.disabled = false;
    chatInput.focus();
  }
  sendBtn.addEventListener('click', send);
  chatInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); }
  });

  // --------------------------------------------------------------------------
  // 写真(任意。V6と同じく縮小して端末に保存)
  // --------------------------------------------------------------------------
  const photoInput = document.getElementById('photo-input');
  const talkPhoto = document.getElementById('talk-photo');
  document.getElementById('add-photo-btn').addEventListener('click', () => photoInput.click());
  photoInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        const MAX = 900;
        let w = img.width, h = img.height;
        if (w >= h && w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
        else if (h > w && h > MAX) { w = Math.round(w * MAX / h); h = MAX; }
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        state.photo = c.toDataURL('image/jpeg', 0.75);
        save(); renderPhoto();
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });
  function renderPhoto() {
    if (state.photo) {
      talkPhoto.classList.remove('empty');
      talkPhoto.innerHTML = `<img src="${state.photo}" alt="着物の写真">`;
    }
  }
  renderPhoto();

  // --------------------------------------------------------------------------
  // 思い出メモ(紹介状) — 対話の言葉を、所有者のものとして整える
  // --------------------------------------------------------------------------
  const memoBody = document.getElementById('memo-body');

  function buildMemoText() {
    const userLines = state.messages.filter(m => m.role === 'user').map(m => m.text);
    const d = new Date();
    const date = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
    let t = `思い出メモ(${date})\n`;
    t += '─────────────────────\n\n';
    if (userLines.length === 0) {
      t += '今日は、画面を開いてみました。それも、大切な一歩です。\n';
    } else {
      t += '【今日、語られたこと】\n';
      userLines.forEach(l => { t += `・${l}\n`; });
      t += '\n【詳しい方に相談するとき、役に立つこと】\n';
      t += '・上の言葉のなかの、使っていた方・時期・寸法の感じ・証紙の有無\n';
      t += '・写真(畳んだままでも大丈夫です)\n';
    }
    t += '\n【今の向き合い方】\n';
    t += '・今は決めない、も大切な判断のひとつです。\n';
    t += '\n決めたことも、決めなかったことも、今日のあなたの大切な一歩です。\n';
    t += '続きは、またゆっくり。\n';
    return t;
  }

  document.getElementById('make-memo-btn').addEventListener('click', () => {
    memoBody.textContent = buildMemoText();
    show('screen-memo');
  });
  document.getElementById('end-today-btn').addEventListener('click', () => {
    memoBody.textContent = buildMemoText();
    show('screen-memo');
  });

  document.getElementById('save-memo-btn').addEventListener('click', () => {
    const d = new Date();
    const blob = new Blob([memoBody.textContent + '\n着物判断支援ナビ — 物を大切にする。手放す人の心を大切にする。\n'],
      { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `思い出メモ_${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.txt`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  });

  document.getElementById('to-tansu-btn').addEventListener('click', () => {
    const d = new Date();
    state.memos.push({
      date: `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`,
      text: firstStoryLine(),
      photo: state.photo
    });
    save();
    show('screen-tansu');
  });

  function firstStoryLine() {
    // 桐箪笥に浮かべる言葉: 利用者自身の言葉から、いちばん物語らしい一文を選ぶ(単純に最長の発言)
    const lines = state.messages.filter(m => m.role === 'user').map(m => m.text);
    if (lines.length === 0) return '今日は、ここまで来られました。';
    return lines.sort((a, b) => b.length - a.length)[0];
  }

  // --------------------------------------------------------------------------
  // デジタル桐箪笥 — 近づくと、思い出の言葉が浮かぶ(枚数は数えない・比べない)
  // --------------------------------------------------------------------------
  const tansuRoom = document.getElementById('tansu-room');
  function renderTansu() {
    tansuRoom.innerHTML = '';
    if (state.memos.length === 0) {
      tansuRoom.innerHTML = `<div class="tansu-empty">まだ、静かなままです。<br>語り場で話した一枚を、ここに飾ることができます。</div>`;
      return;
    }
    state.memos.forEach(m => {
      const item = document.createElement('div');
      item.className = 'tansu-item';
      const frame = m.photo
        ? `<div class="kimono-frame"><img src="${m.photo}" alt="着物"></div>`
        : `<div class="kimono-frame">一枚</div>`;
      item.innerHTML = `${frame}<div class="tansu-words"></div>`;
      item.querySelector('.tansu-words').textContent = m.text;
      // タップでも「近づく」(スマホ対応)
      item.addEventListener('click', () => item.classList.toggle('near'));
      tansuRoom.appendChild(item);
    });
  }
});
