/**
 * English Saga - vocabulary learning app
 * Fully static, persists progress in localStorage, no backend required.
 */
(() => {
  "use strict";

  const STORAGE_KEY = "englishSaga.state.v1";
  const SAGA_DATA_URL = "data/saga.json";
  const QUESTIONS_PER_ROUND = 20;
  const POINTS_PER_LEVEL = 50;
  const AUTO_ADVANCE_CORRECT_MS = 1100;

  const QUESTION_TYPES = {
    MC_TO_BASE: "mc_to_base", // show english, choose base-language translation
    MC_TO_ENGLISH: "mc_to_english", // show base-language translation, choose english
    TEXT_TO_ENGLISH: "text_to_english", // show base-language translation, type english
  };

  /** @type {{ saga: object|null, state: object, round: object|null }} */
  const appState = {
    saga: null,
    state: null,
    round: null,
  };

  let autoAdvanceTimer = null;

  // ------------------------------------------------------------------
  // Persistence
  // ------------------------------------------------------------------

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (err) {
      console.warn("Failed to load saved state", err);
      return null;
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(appState.state));
    } catch (err) {
      console.warn("Failed to save state", err);
    }
  }

  function createDefaultState() {
    return {
      username: null,
      totalPoints: 0,
      chapterPoints: {}, // chapterId -> points earned
    };
  }

  // ------------------------------------------------------------------
  // DOM references
  // ------------------------------------------------------------------

  const el = {
    profileMenuWrapper: document.getElementById("profileMenuWrapper"),
    profileBadge: document.getElementById("profileBadge"),
    profileDropdown: document.getElementById("profileDropdown"),
    profileLevel: document.getElementById("profileLevel"),
    profileName: document.getElementById("profileName"),
    profileTotalPoints: document.getElementById("profileTotalPoints"),
    deleteAccountBtn: document.getElementById("deleteAccountBtn"),

    deleteAccountModal: document.getElementById("deleteAccountModal"),
    deleteModalUsername: document.getElementById("deleteModalUsername"),
    cancelDeleteBtn: document.getElementById("cancelDeleteBtn"),
    confirmDeleteBtn: document.getElementById("confirmDeleteBtn"),

    screens: {
      onboarding: document.getElementById("screen-onboarding"),
      chapters: document.getElementById("screen-chapters"),
      quiz: document.getElementById("screen-quiz"),
      summary: document.getElementById("screen-summary"),
    },

    onboardingForm: document.getElementById("onboardingForm"),
    usernameInput: document.getElementById("usernameInput"),

    sagaTitle: document.getElementById("sagaTitle"),
    sagaDescription: document.getElementById("sagaDescription"),
    chapterList: document.getElementById("chapterList"),

    quitQuizBtn: document.getElementById("quitQuizBtn"),
    quizProgressFill: document.getElementById("quizProgressFill"),
    quizProgressLabel: document.getElementById("quizProgressLabel"),
    quizScore: document.getElementById("quizScore"),
    questionKicker: document.getElementById("questionKicker"),
    questionPrompt: document.getElementById("questionPrompt"),
    choicesArea: document.getElementById("choicesArea"),
    textAnswerForm: document.getElementById("textAnswerForm"),
    textAnswerInput: document.getElementById("textAnswerInput"),
    feedbackArea: document.getElementById("feedbackArea"),
    feedbackText: document.getElementById("feedbackText"),
    nextQuestionBtn: document.getElementById("nextQuestionBtn"),
    autoAdvanceBar: document.getElementById("autoAdvanceBar"),
    autoAdvanceFill: document.getElementById("autoAdvanceFill"),
    cancelAutoAdvanceBtn: document.getElementById("cancelAutoAdvanceBtn"),

    summaryScore: document.getElementById("summaryScore"),
    summaryTotal: document.getElementById("summaryTotal"),
    summaryLevelUp: document.getElementById("summaryLevelUp"),
    summaryNewLevel: document.getElementById("summaryNewLevel"),
    retryChapterBtn: document.getElementById("retryChapterBtn"),
    backToChaptersBtn: document.getElementById("backToChaptersBtn"),
  };

  // ------------------------------------------------------------------
  // Utilities
  // ------------------------------------------------------------------

  function shuffle(array) {
    const copy = array.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function pickRandom(array, count, excludeIndexes = []) {
    const pool = array.filter((_, idx) => !excludeIndexes.includes(idx));
    return shuffle(pool).slice(0, count);
  }

  function levelForPoints(points) {
    return Math.floor(points / POINTS_PER_LEVEL) + 1;
  }

  function normalizeAnswer(str) {
    return str.trim().toLowerCase().replace(/\s+/g, " ");
  }

  function showScreen(name) {
    Object.entries(el.screens).forEach(([key, node]) => {
      node.hidden = key !== name;
    });
  }

  // ------------------------------------------------------------------
  // Profile / header rendering
  // ------------------------------------------------------------------

  function renderProfileBadge() {
    const { state } = appState;
    if (!state || !state.username) {
      el.profileMenuWrapper.hidden = true;
      closeProfileDropdown();
      return;
    }
    el.profileMenuWrapper.hidden = false;
    el.profileName.textContent = state.username;
    el.profileTotalPoints.textContent = state.totalPoints;
    el.profileLevel.textContent = `Lv.${levelForPoints(state.totalPoints)}`;
  }

  // ------------------------------------------------------------------
  // Profile dropdown menu
  // ------------------------------------------------------------------

  function toggleProfileDropdown() {
    const isOpen = !el.profileDropdown.hidden;
    if (isOpen) closeProfileDropdown();
    else openProfileDropdown();
  }

  function openProfileDropdown() {
    el.profileDropdown.hidden = false;
    el.profileBadge.setAttribute("aria-expanded", "true");
    document.addEventListener("click", handleOutsideDropdownClick, { capture: true });
  }

  function closeProfileDropdown() {
    el.profileDropdown.hidden = true;
    el.profileBadge.setAttribute("aria-expanded", "false");
    document.removeEventListener("click", handleOutsideDropdownClick, { capture: true });
  }

  function handleOutsideDropdownClick(event) {
    if (!el.profileMenuWrapper.contains(event.target)) closeProfileDropdown();
  }

  // ------------------------------------------------------------------
  // Delete account / progress
  // ------------------------------------------------------------------

  function openDeleteAccountModal() {
    closeProfileDropdown();
    el.deleteModalUsername.textContent = appState.state.username || "your";
    el.deleteAccountModal.hidden = false;
  }

  function closeDeleteAccountModal() {
    el.deleteAccountModal.hidden = true;
  }

  function confirmDeleteAccount() {
    localStorage.removeItem(STORAGE_KEY);
    appState.state = createDefaultState();
    appState.round = null;
    closeDeleteAccountModal();
    renderProfileBadge();
    el.usernameInput.value = "";
    showScreen("onboarding");
  }

  // ------------------------------------------------------------------
  // Chapters screen
  // ------------------------------------------------------------------

  function renderChaptersScreen() {
    const { saga, state } = appState;
    el.sagaTitle.textContent = saga.title;
    el.sagaDescription.textContent = saga.description || "";
    el.chapterList.innerHTML = "";

    saga.chapters.forEach((chapter) => {
      const points = state.chapterPoints[chapter.id] || 0;
      const maxPoints = chapter.words.length * 5; // soft cap used only for progress bar visuals
      const pct = Math.min(100, Math.round((points / maxPoints) * 100)) || 0;

      const card = document.createElement("div");
      card.className = "chapter-card";
      card.innerHTML = `
        <h3>${escapeHtml(chapter.title)}</h3>
        <p>${escapeHtml(chapter.description || "")}</p>
        <div class="chapter-points">🌟 ${points} learning points</div>
        <div class="chapter-progress-bar"><div class="chapter-progress-fill" style="width:${pct}%"></div></div>
        <button class="btn btn-primary" data-chapter-id="${chapter.id}">Start Round</button>
      `;
      card.querySelector("button").addEventListener("click", () => startRound(chapter.id));
      el.chapterList.appendChild(card);
    });
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // ------------------------------------------------------------------
  // Round / quiz logic
  // ------------------------------------------------------------------

  function buildQuestions(chapter) {
    const words = chapter.words;
    const questions = [];
    const indexPool = shuffle(words.map((_, idx) => idx));

    for (let i = 0; i < QUESTIONS_PER_ROUND; i++) {
      const wordIndex = indexPool[i % indexPool.length];
      const word = words[wordIndex];
      const type = shuffle(Object.values(QUESTION_TYPES))[0];
      questions.push(buildQuestion(words, wordIndex, word, type));
    }
    return questions;
  }

  function buildQuestion(words, wordIndex, word, type) {
    const distractorCount = 3;
    const base = { type, word };

    if (type === QUESTION_TYPES.TEXT_TO_ENGLISH) {
      return { ...base, prompt: word.translation, answer: word.en };
    }

    if (type === QUESTION_TYPES.MC_TO_BASE) {
      const distractors = pickRandom(words, distractorCount, [wordIndex]).map((w) => w.translation);
      const options = shuffle([word.translation, ...distractors]);
      return { ...base, prompt: word.en, answer: word.translation, options };
    }

    // MC_TO_ENGLISH
    const distractors = pickRandom(words, distractorCount, [wordIndex]).map((w) => w.en);
    const options = shuffle([word.en, ...distractors]);
    return { ...base, prompt: word.translation, answer: word.en, options };
  }

  function startRound(chapterId) {
    const chapter = appState.saga.chapters.find((c) => c.id === chapterId);
    if (!chapter) return;

    appState.round = {
      chapterId,
      questions: buildQuestions(chapter),
      currentIndex: 0,
      score: 0,
      answered: false,
    };

    showScreen("quiz");
    renderQuestion();
  }

  function currentQuestion() {
    const { round } = appState;
    return round.questions[round.currentIndex];
  }

  function renderQuestion() {
    const { round } = appState;
    const question = currentQuestion();

    el.quizScore.textContent = round.score;
    el.quizProgressLabel.textContent = `Question ${round.currentIndex + 1} / ${round.questions.length}`;
    el.quizProgressFill.style.width = `${(round.currentIndex / round.questions.length) * 100}%`;

    el.feedbackArea.hidden = true;
    cancelAutoAdvance();
    round.answered = false;

    const baseLangLabel = (appState.saga.baseLanguage || "base").toUpperCase();

    if (question.type === QUESTION_TYPES.MC_TO_BASE) {
      el.questionKicker.textContent = `English → ${baseLangLabel}`;
    } else if (question.type === QUESTION_TYPES.MC_TO_ENGLISH) {
      el.questionKicker.textContent = `${baseLangLabel} → English (choose)`;
    } else {
      el.questionKicker.textContent = `${baseLangLabel} → English (type)`;
    }

    el.questionPrompt.textContent = question.prompt;

    if (question.type === QUESTION_TYPES.TEXT_TO_ENGLISH) {
      el.choicesArea.hidden = true;
      el.choicesArea.innerHTML = "";
      el.textAnswerForm.hidden = false;
      el.textAnswerInput.value = "";
      el.textAnswerInput.disabled = false;
      setTimeout(() => el.textAnswerInput.focus(), 50);
    } else {
      el.textAnswerForm.hidden = true;
      el.choicesArea.hidden = false;
      el.choicesArea.innerHTML = "";
      question.options.forEach((option) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "choice-btn";
        btn.textContent = option;
        btn.addEventListener("click", () => handleChoiceAnswer(option, btn));
        el.choicesArea.appendChild(btn);
      });
    }
  }

  function handleChoiceAnswer(selected, btnEl) {
    const { round } = appState;
    if (round.answered) return;
    round.answered = true;

    const question = currentQuestion();
    const isCorrect = selected === question.answer;

    Array.from(el.choicesArea.children).forEach((btn) => {
      btn.disabled = true;
      if (btn.textContent === question.answer) btn.classList.add("correct");
      else if (btn === btnEl && !isCorrect) btn.classList.add("incorrect");
    });

    finishQuestion(isCorrect);
  }

  function handleTextAnswer(event) {
    event.preventDefault();
    const { round } = appState;
    if (round.answered) return;
    round.answered = true;

    const question = currentQuestion();
    const isCorrect = normalizeAnswer(el.textAnswerInput.value) === normalizeAnswer(question.answer);
    el.textAnswerInput.disabled = true;

    finishQuestion(isCorrect, question.answer);
  }

  function finishQuestion(isCorrect, correctAnswerForText) {
    const { round, state } = appState;

    if (isCorrect) {
      round.score += 1;
      state.totalPoints += 1;
      state.chapterPoints[round.chapterId] = (state.chapterPoints[round.chapterId] || 0) + 1;
      saveState();
      renderProfileBadge();
    }

    el.feedbackArea.hidden = false;
    el.feedbackText.className = isCorrect ? "correct" : "incorrect";
    if (isCorrect) {
      el.feedbackText.textContent = "✅ Correct!";
    } else if (correctAnswerForText) {
      el.feedbackText.textContent = `❌ Not quite. Correct answer: "${correctAnswerForText}"`;
    } else {
      el.feedbackText.textContent = "❌ Not quite.";
    }

    el.quizScore.textContent = round.score;
    const isLastQuestion = round.currentIndex === round.questions.length - 1;
    el.nextQuestionBtn.textContent = isLastQuestion ? "Finish →" : "Next →";

    if (isCorrect) {
      startAutoAdvance(AUTO_ADVANCE_CORRECT_MS);
    } else {
      cancelAutoAdvance();
    }
  }

  // ------------------------------------------------------------------
  // Auto-advance (with cancel option)
  // ------------------------------------------------------------------

  function startAutoAdvance(delayMs) {
    cancelAutoAdvance();
    el.autoAdvanceBar.hidden = false;
    el.autoAdvanceFill.style.transition = "none";
    el.autoAdvanceFill.style.transform = "scaleX(1)";
    // Force reflow so the subsequent transition actually animates.
    void el.autoAdvanceFill.offsetWidth;
    el.autoAdvanceFill.style.transition = `transform ${delayMs}ms linear`;
    el.autoAdvanceFill.style.transform = "scaleX(0)";
    autoAdvanceTimer = setTimeout(() => {
      autoAdvanceTimer = null;
      goToNextQuestion();
    }, delayMs);
  }

  function cancelAutoAdvance() {
    if (autoAdvanceTimer) {
      clearTimeout(autoAdvanceTimer);
      autoAdvanceTimer = null;
    }
    el.autoAdvanceBar.hidden = true;
    el.autoAdvanceFill.style.transition = "none";
    el.autoAdvanceFill.style.transform = "scaleX(1)";
  }

  function goToNextQuestion() {
    cancelAutoAdvance();
    const { round } = appState;
    if (round.currentIndex < round.questions.length - 1) {
      round.currentIndex += 1;
      renderQuestion();
    } else {
      finishRound();
    }
  }

  function finishRound() {
    const { round, state } = appState;
    el.quizProgressFill.style.width = "100%";

    const levelBefore = levelForPoints(state.totalPoints - round.score);
    const levelAfter = levelForPoints(state.totalPoints);

    el.summaryScore.textContent = round.score;
    el.summaryTotal.textContent = round.questions.length;

    if (levelAfter > levelBefore) {
      el.summaryLevelUp.hidden = false;
      el.summaryNewLevel.textContent = `Lv.${levelAfter}`;
    } else {
      el.summaryLevelUp.hidden = true;
    }

    showScreen("summary");
  }

  function quitRound() {
    cancelAutoAdvance();
    appState.round = null;
    renderChaptersScreen();
    showScreen("chapters");
  }

  // ------------------------------------------------------------------
  // Onboarding
  // ------------------------------------------------------------------

  function handleOnboardingSubmit(event) {
    event.preventDefault();
    const name = el.usernameInput.value.trim();
    if (!name) return;

    appState.state.username = name;
    saveState();
    renderProfileBadge();
    renderChaptersScreen();
    showScreen("chapters");
  }

  // ------------------------------------------------------------------
  // Bootstrap
  // ------------------------------------------------------------------

  async function loadSaga() {
    const res = await fetch(SAGA_DATA_URL);
    if (!res.ok) throw new Error(`Failed to load saga data: ${res.status}`);
    return res.json();
  }

  function wireEvents() {
    el.onboardingForm.addEventListener("submit", handleOnboardingSubmit);
    el.textAnswerForm.addEventListener("submit", handleTextAnswer);
    el.nextQuestionBtn.addEventListener("click", goToNextQuestion);
    el.cancelAutoAdvanceBtn.addEventListener("click", cancelAutoAdvance);
    el.quitQuizBtn.addEventListener("click", quitRound);
    el.retryChapterBtn.addEventListener("click", () => startRound(appState.round.chapterId));
    el.backToChaptersBtn.addEventListener("click", quitRound);

    el.profileBadge.addEventListener("click", toggleProfileDropdown);
    el.deleteAccountBtn.addEventListener("click", openDeleteAccountModal);
    el.cancelDeleteBtn.addEventListener("click", closeDeleteAccountModal);
    el.confirmDeleteBtn.addEventListener("click", confirmDeleteAccount);
    el.deleteAccountModal.addEventListener("click", (event) => {
      if (event.target === el.deleteAccountModal) closeDeleteAccountModal();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeProfileDropdown();
        closeDeleteAccountModal();
      }
    });
  }

  async function init() {
    appState.state = loadState() || createDefaultState();

    try {
      appState.saga = await loadSaga();
    } catch (err) {
      console.error(err);
      el.sagaTitle.textContent = "Could not load saga data";
      el.sagaDescription.textContent = String(err.message || err);
      showScreen("chapters");
      return;
    }

    wireEvents();
    renderProfileBadge();

    if (appState.state.username) {
      renderChaptersScreen();
      showScreen("chapters");
    } else {
      showScreen("onboarding");
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
