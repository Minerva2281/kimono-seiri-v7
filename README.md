# Kimono Dialogue App (V7) — the capture side of Kimono Biography & Registry

A small web app in which an AI listener ("KOTODAMA") helps a kimono owner talk through the facts, memories, and feelings attached to one kimono, and save the owner's own words as a memo.

Live (Japanese UI): https://kimono-seiri-v7.vercel.app

## Where it fits

```
AI dialogue → owner-reviewed Kimono Biography → Registry → anyone can verify the same filed Biography
└──── this repository ────┘                     └──── kimono-registry ────┘
```

- **This repository** is the dialogue / capture side. It does not write anything to a blockchain.
- The owner's words from the dialogue are the material for a **Kimono Biography**, which is compiled outside this app and reviewed by the owner.
- Filing and verification (Irys + Solana devnet) happen in the separate public repository **[kimono-registry](https://github.com/Minerva2281/kimono-registry)**.

## What the AI does

- Asks one short question at a time (e.g. who used the kimono and when, what scenes come to mind).
- Helps the owner put their own memories and information into words.
- Gently points to possible next steps the owner can take themselves: measuring the kimono, looking for certificate labels or notes inside the wrapping paper or collar, or consulting a knowledgeable person with the memo.
- Treats "not deciding now" as a valid choice.

## What the AI deliberately does not do

- It does not state the kimono's type, grade, quality, age, price, or appraised value — not even as an estimate. When asked (e.g. "How much could I sell it for now?"), it says it cannot make judgments about the kimono.
- It does not recommend selling or disposing of the kimono, and it does not hurry the owner.
- It does not give medical, legal, religious, or financial advice, and it does not hide that it is an AI.

These rules are enforced in [`api/kotodama.js`](api/kotodama.js) in three layers: the system prompt; a check of each reply for banned words (including kimono type names and appraisal words the owner has not used), with one request to rephrase; and a fixed safe reply if the rephrased answer still fails the check.

## How it works (current implementation)

- **Front end** — static HTML/CSS/JS ([`index.html`](index.html), [`app.js`](app.js), [`style.css`](style.css)). Screens: entrance → talk → memory memo → "digital kiri-tansu" (a gallery of the kimono the owner has saved in this browser).
- **AI function** — a Vercel serverless function ([`api/kotodama.js`](api/kotodama.js)) that holds the API key and calls whichever provider key is configured (Anthropic, OpenAI, or Google Gemini). Each reply is limited to 400 tokens.
- **Practice mode** — if the AI function is unavailable, a fixed one-question-at-a-time script in `app.js` keeps the experience working.
- **Memory memo** — lists the owner's own typed words from the dialogue (the AI's replies are not included), plus fixed notes on what may help when consulting an expert. It can be saved as a text file.
- **Photos** — optional; resized in the browser.
- **Storage** — the conversation, memos, and photos are stored only in the browser (`localStorage`) on the owner's device. The app has no account system and no database. During a conversation, the messages are sent through the serverless function to the AI provider to generate replies.
- Owners can use the browser's or smartphone's own voice input to speak instead of typing.

## Hackathon disclosure

This dialogue app **predates the Colosseum hackathon**: the first commit in this repository is from **2026-07-29**. During the hackathon period, only small changes were made here (on 2026-09-20: a page-analytics tag, a gallery photo-zoom fix, resetting the talk screen after saving a kimono, and a "next kimono" button). The registry work built during the hackathon is in [kimono-registry](https://github.com/Minerva2281/kimono-registry).

## Other files

- `kotodama.js` (repository root) — an older copy of the serverless function; the deployed function is `api/kotodama.js`.
- `cards.html` — a pitch-practice page used by the founder; not part of the app.
- `README_デプロイ手順.md`, `文言一覧_監修待ち.md` — Japanese working notes (deployment steps without any keys, and a wording list awaiting review).

## Deployment

Deployed on Vercel as a static site plus one serverless function. One of `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, or `GEMINI_API_KEY` is set as an environment variable in Vercel; no key is stored in this repository.
