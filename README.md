# 📖 English Saga

**English Saga** is a free, static, no-login vocabulary trainer that turns learning English into a story-driven adventure. Pick a name, dive into a chapter, and answer quiz questions to earn learning points and level up — all running entirely in your browser, with zero backend and zero accounts.

👉 **[Play it live](https://fbarresi.github.io/EnglishSaga/)** *(enable GitHub Pages on this repo to activate the link)*

## ✨ Features

- **No registration** — just type a name and start learning immediately.
- **Chapter-based sagas** — vocabulary is organized into themed chapters loaded from a simple JSON file.
- **Mixed quiz formats** — each round of 20 questions randomly mixes:
  - Multiple choice: translate **from** English
  - Multiple choice: translate **to** English
  - Free-text input: type the English translation
- **Points & levels** — 1 learning point per correct answer, a new level every 50 points.
- **Per-chapter progress** — see how many points you've earned in every chapter.
- **Everything persists locally** — your name and progress are saved in `localStorage`, right in your browser. No server, no database, no tracking.
- **Responsive UI** — designed mobile-first, and works great on phones, tablets, and desktops.

## 🗂️ How the data works

All vocabulary lives in [`data/saga.json`](data/saga.json). It's a simple JSON file so anyone can translate or extend it without touching any code:

```json
{
  "title": "The Beginner's Saga",
  "description": "A short example saga to get you started.",
  "baseLanguage": "de",
  "chapters": [
    {
      "id": "chapter-1",
      "title": "Chapter 1: Everyday Basics",
      "description": "Common everyday words to get you started.",
      "words": [
        { "en": "hello", "translation": "hallo" },
        { "en": "goodbye", "translation": "auf wiedersehen" }
      ]
    }
  ]
}
```

- `baseLanguage` is just a label for the UI (e.g. `de`, `fr`, `es`) describing the language of the `translation` field.
- Each chapter is an independent "round pool" — add as many chapters and words as you like.
- The example saga included here has **9 chapters and 183 words/phrases** (English → German) to help you get started quickly.

## 🍴 Make it your own!

This project is intentionally tiny and dependency-free so that **you can fork it and build your own learning app in minutes**:

1. **Fork this repository.**
2. Replace [`data/saga.json`](data/saga.json) with your own saga — any base language, any chapters, any words.
3. Tweak the branding in `index.html` / `css/styles.css` if you want a different look.
4. Enable GitHub Pages for your fork (**Settings → Pages → Source: GitHub Actions**) — the included workflow will build and deploy it automatically on every push to `main`.
5. Share your own vocabulary saga with the world! 🌍

No build tools, no frameworks, no bundlers required — just plain HTML, CSS, and JavaScript.

## 🛠️ Local development

Since the app loads `data/saga.json` via `fetch`, you need to serve the files over HTTP (opening `index.html` directly from disk will be blocked by the browser's CORS rules). Any static file server works, for example:

```bash
# Python
python -m http.server 8080

# Node (npx, no install required)
npx serve .
```

Then open `http://localhost:8080` in your browser.

## 🚀 Deployment

This repo ships with a ready-to-use GitHub Actions workflow at [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) that publishes the static site to GitHub Pages on every push to `main`. No build step is required — it simply packages the repository contents and deploys them.

To enable it on your fork:

1. Go to **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. Push to `main` (or run the workflow manually) and your site will be live within a minute.

## 📜 License

Feel free to use, modify, and distribute this project. Contributions and new saga files (for other languages!) are very welcome via pull request.
