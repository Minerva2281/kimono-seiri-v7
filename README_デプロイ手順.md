# V7 デプロイ手順(GitHub + Vercel)

V6と同じ流れです。V6はそのまま残し、**V7は別リポジトリ・別URL**にします(実証2はV6で行うため)。

## 1. GitHubに新リポジトリを作る

1. github.com → New repository → 名前 `kimono-seiri-v7` → Create
2. この `v7` フォルダの中身(index.html, style.css, app.js, api/ フォルダ, README)をアップロード
   - ブラウザからなら「uploading an existing file」でフォルダごとドラッグ

## 2. Vercelでデプロイ

1. vercel.com → Add New → Project → `kimono-seiri-v7` を Import
2. Framework Preset は「Other」のまま → Deploy
3. デプロイ完了後、**Settings → Environment Variables** で追加。**次の3つのうち、持っているキーを1つだけ**設定すればよい(複数あればClaude優先で自動選択):
   - `ANTHROPIC_API_KEY`(Claude)
   - `OPENAI_API_KEY`(ChatGPT)
   - `GEMINI_API_KEY`(Google Gemini。**無料枠あり=カード決済なしで開始できる**。aistudio.google.com →「Get API key」→ Googleアカウントで作成)
   - 環境: Production / Preview / Development すべてチェック
4. キー追加後、**Deployments → 最新のデプロイ → Redeploy**(環境変数を反映させるため)

## 3. 動作確認

- 公開URLを開く → 玄関口 → 語り場 → 何か話しかける
- **実AIモード:** KOTODAMAが文脈に応じて返す(一度に一問)
- **練習モード:** APIキー未設定・障害時は、自動で台本モードに切り替わる(デモが止まらない保険)
- どちらのモードかは画面には出ません(利用者を混乱させないため)。区別したいときは、台本と違う自由な応答が返ってくるかで判断できます

## 4. 費用の安全弁

- console.anthropic.com → Billing で残高を確認できます
- サーバー関数側で1回の返答を最大400トークンに制限済み。会話履歴も直近20往復までしか送りません

## 憲章とのつながり(なぜこの作りか)

- APIキーをサーバー関数に置くのは、キー漏えい=他人による乱用(利用者に無関係な課金)を防ぐため
- 検閲(censor)は、AIの断定・禁止語を**コードで**止める仕組み。思想の遵守を「AIへのお願い」で終わらせない(不変条項1)
- 練習モードは、実証・発表の場でネットワークやAPIが落ちても体験が止まらないための保険
