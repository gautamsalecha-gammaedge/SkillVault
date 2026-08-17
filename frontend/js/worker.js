/* ============================================================
   SkillVault — worker dashboard
   ============================================================ */

(function () {
  if (!requireWorkerSession()) return;
  applyLang();

  const greeting = document.getElementById("greeting");
  greeting.textContent = t("dashboardGreeting", { name: getWorkerName() });

  document.getElementById("btn-logout").addEventListener("click", logoutWorker);

  const machineBar = document.getElementById("machine-bar");
  const machineSelect = document.getElementById("machine-select");
  const workspace = document.getElementById("workspace");
  const noMachines = document.getElementById("no-machines");

  let currentMachine = null;
  let machines = [];
  let chatHistory = [];
  let tipDraft = { originalText: "", round: 1, question: null };

  /* ---------------- boot: load machines ---------------- */
  (async function init() {
    try {
      const res = await Api.myMachines();
      machines = res.machine_ids || [];
    } catch (err) {
      showToast(err.message || t("errorGeneric"), "error");
      machines = [];
    }

    if (!machines.length) {
      noMachines.style.display = "flex";
      return;
    }

    machineBar.style.display = "flex";
    workspace.style.display = "flex";
    machineSelect.innerHTML = machines
      .map((m) => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`)
      .join("");

    const saved = localStorage.getItem("sv_selected_machine");
    currentMachine = machines.includes(saved) ? saved : machines[0];
    machineSelect.value = currentMachine;

    renderExampleChips();
    updateAskEmptyTitle();

    machineSelect.addEventListener("change", () => {
      currentMachine = machineSelect.value;
      localStorage.setItem("sv_selected_machine", currentMachine);
      resetChat();
      updateAskEmptyTitle();
      resetTipFlow();
    });
  })();

  function updateAskEmptyTitle() {
    document.getElementById("ask-empty-title").textContent =
      t("askEmptyTitle", { machine: currentMachine || "" });
  }

  /* ---------------- mode tabs ---------------- */
  const modeTabAsk = document.getElementById("mode-tab-ask");
  const modeTabTip = document.getElementById("mode-tab-tip");
  const panelAsk = document.getElementById("panel-ask");
  const panelTip = document.getElementById("panel-tip");

  function selectMode(mode) {
    const isAsk = mode === "ask";

    modeTabAsk.setAttribute("aria-selected", String(isAsk));
    modeTabTip.setAttribute("aria-selected", String(!isAsk));

    panelAsk.classList.toggle("is-active", isAsk);
    panelTip.classList.toggle("is-active", !isAsk);
  }

  modeTabAsk.addEventListener("click", () => selectMode("ask"));
  modeTabTip.addEventListener("click", () => selectMode("tip"));

  /* ================= ASK / CHAT ================= */
  const chatScroll = document.getElementById("chat-scroll");
  const askEmpty = document.getElementById("ask-empty");
  const askForm = document.getElementById("ask-form");
  const askInput = document.getElementById("ask-input");
  const askSendBtn = document.getElementById("ask-send-btn");
  const exampleChips = document.getElementById("example-chips");
  const ttsAudio = document.getElementById("tts-audio");

  function renderExampleChips() {
    exampleChips.innerHTML = "";

    ["exampleQ1", "exampleQ2", "exampleQ3"].forEach((key) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "example-chip";
      btn.textContent = t(key);

      btn.addEventListener("click", () => {
        askInput.value = t(key);
        submitQuestion();
      });

      exampleChips.appendChild(btn);
    });
  }

  function resetChat() {
    chatHistory = [];
    chatScroll.innerHTML = "";
    chatScroll.appendChild(askEmpty);
    askEmpty.style.display = "flex";
  }

  askInput.addEventListener("input", () => {
    askInput.style.height = "auto";
    askInput.style.height = Math.min(askInput.scrollHeight, 140) + "px";
  });

  askInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submitQuestion();
    }
  });

  askForm.addEventListener("submit", (e) => {
    e.preventDefault();
    submitQuestion();
  });

  function appendUserBubble(text) {
    askEmpty.style.display = "none";

    const el = document.createElement("div");
    el.className = "chat-msg from-user";

    el.innerHTML = `
      <div class="chat-avatar">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2">
          <path d="M12 12a4 4 0 100-8 4 4 0 000 8z"/>
          <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>
        </svg>
      </div>
      <div class="chat-bubble">${escapeHtml(text)}</div>
    `;

    chatScroll.appendChild(el);
    chatScroll.scrollTop = chatScroll.scrollHeight;
  }

  function appendTypingIndicator() {
    const el = document.createElement("div");
    el.className = "chat-msg from-ai";
    el.id = "typing-indicator";

    el.innerHTML = `
      <div class="chat-avatar">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
             stroke="#17130a" stroke-width="2.2">
          <path d="M12 2L4 6v6c0 5 3.4 8.4 8 10 4.6-1.6 8-5 8-10V6l-8-4z"/>
        </svg>
      </div>
      <div class="chat-bubble">
        <span class="typing-dots">
          <span></span><span></span><span></span>
        </span>
      </div>
    `;

    chatScroll.appendChild(el);
    chatScroll.scrollTop = chatScroll.scrollHeight;
  }

  function removeTypingIndicator() {
    const el = document.getElementById("typing-indicator");
    if (el) el.remove();
  }

  function appendAiBubble(answer, sourcesUsed) {
    const el = document.createElement("div");
    el.className = "chat-msg from-ai";

    el.innerHTML = `
      <div class="chat-avatar">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
             stroke="#17130a" stroke-width="2.2">
          <path d="M12 2L4 6v6c0 5 3.4 8.4 8 10 4.6-1.6 8-5 8-10V6l-8-4z"/>
        </svg>
      </div>

      <div>
        <div class="chat-bubble">${escapeHtml(answer)}</div>

        <div class="chat-meta">
          <button class="btn btn--ghost"
                  data-speak-btn
                  data-text="${escapeHtml(answer)}">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2">
              <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
              <path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4"/>
            </svg>
            <span>${t("speakAnswer")}</span>
          </button>

          <span class="chat-sources">
            ${
              sourcesUsed > 0
                ? t("sourcesUsed", { n: sourcesUsed })
                : t("sourcesNone")
            }
          </span>
        </div>
      </div>
    `;

    chatScroll.appendChild(el);
    chatScroll.scrollTop = chatScroll.scrollHeight;

    el.querySelector("[data-speak-btn]").addEventListener("click", (e) => {
      speakText(answer, e.currentTarget);
    });
  }

  function appendErrorBubble(message) {
    const el = document.createElement("div");
    el.className = "chat-msg from-ai";

    el.innerHTML = `
      <div class="chat-avatar">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2.2">
          <circle cx="12" cy="12" r="9"/>
          <path d="M12 8v4M12 16h.01"/>
        </svg>
      </div>

      <div class="chat-bubble"
           style="border-color:#de646455;color:var(--red);">
        ${escapeHtml(message)}
      </div>
    `;

    chatScroll.appendChild(el);
    chatScroll.scrollTop = chatScroll.scrollHeight;
  }

  async function submitQuestion() {
    const question = askInput.value.trim();

    if (!question) return;

    if (!currentMachine) {
      showToast(t("selectMachineFirst"), "error");
      return;
    }

    appendUserBubble(question);

    askInput.value = "";
    askInput.style.height = "auto";

    askSendBtn.disabled = true;
    appendTypingIndicator();

    try {
      const res = await Api.ask(question, currentMachine);

      removeTypingIndicator();
      appendAiBubble(res.answer, res.sources_used || 0);
    } catch (err) {
      removeTypingIndicator();
      appendErrorBubble(err.message || t("askErrorGeneric"));
    } finally {
      askSendBtn.disabled = false;
      askInput.focus();
    }
  }

  async function speakText(text, btnEl) {
    const original = btnEl.innerHTML;

    btnEl.disabled = true;
    btnEl.innerHTML =
      `<span class="spinner"></span><span>${t("playingAnswer")}</span>`;

    try {
      const { blob } = await Api.speak(text, getLang());
      const url = URL.createObjectURL(blob);

      ttsAudio.src = url;
      await ttsAudio.play();

      ttsAudio.onended = () => {
        btnEl.disabled = false;
        btnEl.innerHTML = original;
        URL.revokeObjectURL(url);
      };
    } catch (err) {
      showToast(err.message || t("errorGeneric"), "error");

      btnEl.disabled = false;
      btnEl.innerHTML = original;
    }
  }

  /* ============================================================
     VOICE INPUT (Ask + Tip + Clarify)
     ============================================================ */

  let recognition = null;
  let isRecording = false;
  let currentTarget = null;
  let finalTranscript = "";

  function initSpeechRecognition() {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn("Speech Recognition not supported in this browser");
      return;
    }

    recognition = new SpeechRecognition();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = getLang() || "en-IN";

    recognition.onstart = function () {
      isRecording = true;
      updateVoiceUI(true);
      console.log("Recording started");
    };

    recognition.onresult = function (event) {
      let interim = "";

      for (
        let i = event.resultIndex;
        i < event.results.length;
        i++
      ) {
        const transcript = event.results[i][0].transcript;

        if (event.results[i].isFinal) {
          finalTranscript += transcript + " ";
        } else {
          interim += transcript;
        }
      }

      const fullText = (finalTranscript + interim).trim();

      if (currentTarget === "ask") {
        const input = document.getElementById("ask-input");

        if (input) {
          input.value = fullText;
          input.dispatchEvent(new Event("input"));
        }
      }

      if (currentTarget === "tip") {
        const input = document.getElementById("tip-text");

        if (input) {
          input.value = fullText;
        }
      }

      if (currentTarget === "clarify") {
        const input = document.getElementById("clarify-answer");

        if (input) {
          input.value = fullText;
        }
      }
    };

    recognition.onerror = function (event) {
      console.error("Speech recognition error:", event.error);

      stopRecording();

      if (event.error === "not-allowed") {
        showToast(
          "Microphone permission denied. Please allow mic access.",
          "error"
        );
      } else if (event.error === "no-speech") {
        // ignore
      } else {
        showToast(
          "Speech recognition error. Try again.",
          "error"
        );
      }
    };

    recognition.onend = function () {
      console.log("Recognition ended");

      if (isRecording) {
        try {
          recognition.start();
        } catch (e) {
          console.log("Could not restart recognition");
        }
      }
    };
  }

  function startRecording(target) {
    if (!recognition) {
      showToast(
        "Speech recognition not supported. Please use Chrome.",
        "error"
      );
      return;
    }

    stopRecording();

    currentTarget = target;
    isRecording = true;
    finalTranscript = "";

    if (target === "ask") {
      const val = document.getElementById("ask-input")?.value.trim();

      if (val) {
        finalTranscript = val + " ";
      }
    }

    if (target === "tip") {
      const val = document.getElementById("tip-text")?.value.trim();

      if (val) {
        finalTranscript = val + " ";
      }
    }

    if (target === "clarify") {
      const val = document.getElementById("clarify-answer")?.value.trim();

      if (val) {
        finalTranscript = val + " ";
      }
    }

    try {
      recognition.lang = getLang() || "en-IN";
      recognition.start();

      console.log("Started recording for:", target);
    } catch (err) {
      console.error("Failed to start recognition:", err);

      showToast(
        "Could not start microphone. Try again.",
        "error"
      );

      isRecording = false;
      updateVoiceUI(false);
    }
  }

  function stopRecording() {
    isRecording = false;
    currentTarget = null;

    if (recognition) {
      try {
        recognition.stop();
      } catch (e) {}
    }

    updateVoiceUI(false);
    console.log("Recording stopped");
  }

  function updateVoiceUI(recording) {
    const askBar = document.getElementById("ask-voice-bar");
    const askMic = document.getElementById("ask-mic-btn");
    const askStatus = document.getElementById("ask-voice-status");
    const askStop = document.getElementById("ask-stop-btn");

    const tipBar = document.getElementById("tip-voice-bar");
    const tipMic = document.getElementById("tip-mic-btn");
    const tipStatus = document.getElementById("tip-voice-status");
    const tipStop = document.getElementById("tip-stop-btn");

    const clarifyMic = document.getElementById("clarify-mic-btn");

    if (recording) {
      askBar?.classList.add("recording");
      askMic?.classList.add("listening");

      if (askStatus) {
        askStatus.innerHTML =
          `<span class="listening">Listening… Speak now</span>`;
      }

      if (askStop) {
        askStop.style.display = "inline-block";
      }

      tipBar?.classList.add("recording");
      tipMic?.classList.add("listening");

      if (tipStatus) {
        tipStatus.innerHTML =
          `<span class="listening">Listening… Speak now</span>`;
      }

      if (tipStop) {
        tipStop.style.display = "inline-block";
      }

      clarifyMic?.classList.add("listening");
    } else {
      askBar?.classList.remove("recording");
      askMic?.classList.remove("listening");

      if (askStatus) {
        askStatus.textContent =
          "Tap mic to speak your question";
      }

      if (askStop) {
        askStop.style.display = "none";
      }

      tipBar?.classList.remove("recording");
      tipMic?.classList.remove("listening");

      if (tipStatus) {
        tipStatus.textContent =
          "Tap mic to speak your tip";
      }

      if (tipStop) {
        tipStop.style.display = "none";
      }

      clarifyMic?.classList.remove("listening");
    }
  }

  initSpeechRecognition();

  /* ---------------- Ask mic ---------------- */

  document
    .getElementById("ask-mic-btn")
    ?.addEventListener("click", function () {
      if (isRecording && currentTarget === "ask") {
        stopRecording();
      } else {
        startRecording("ask");
      }
    });

  document
    .getElementById("ask-stop-btn")
    ?.addEventListener("click", stopRecording);

  /* ---------------- Tip mic ---------------- */

  document
    .getElementById("tip-mic-btn")
    ?.addEventListener("click", function () {
      if (isRecording && currentTarget === "tip") {
        stopRecording();
      } else {
        startRecording("tip");
      }
    });

  document
    .getElementById("tip-stop-btn")
    ?.addEventListener("click", stopRecording);

  /* ---------------- Clarify mic ---------------- */

  document
    .getElementById("clarify-mic-btn")
    ?.addEventListener("click", function () {
      if (isRecording && currentTarget === "clarify") {
        stopRecording();
      } else {
        startRecording("clarify");
      }
    });

  /* ================= SHARE A TIP ================= */

  const tipSteps = {
    write: document.getElementById("tip-step-write"),
    clarify: document.getElementById("tip-step-clarify"),
    polish: document.getElementById("tip-step-polish"),
    success: document.getElementById("tip-step-success"),
  };

  function showTipStep(name) {
    Object.values(tipSteps).forEach((el) =>
      el.classList.remove("is-active")
    );

    tipSteps[name].classList.add("is-active");
  }

  const tipText = document.getElementById("tip-text");
  const tipReviewBtn = document.getElementById("tip-review-btn");
  const clarifyQuestion = document.getElementById("clarify-question");
  const clarifyAnswer = document.getElementById("clarify-answer");
  const clarifyContinueBtn =
    document.getElementById("clarify-continue-btn");
  const polishedText = document.getElementById("polished-text");
  const tipSaveBtn = document.getElementById("tip-save-btn");
  const tipAnotherBtn = document.getElementById("tip-another-btn");
  const tipSpeakConfirmBtn =
    document.getElementById("tip-speak-confirm-btn");

  /* Added for clarification question TTS */
  const clarifySpeakBtn =
    document.getElementById("clarify-speak-btn");

  function resetTipFlow() {
    tipDraft = {
      originalText: "",
      round: 1,
      question: null
    };

    tipText.value = "";
    clarifyAnswer.value = "";
    polishedText.value = "";

    showTipStep("write");
  }

  tipReviewBtn.addEventListener("click", async () => {
    const text = tipText.value.trim();

    if (!text) return;

    if (!currentMachine) {
      showToast(t("selectMachineFirst"), "error");
      return;
    }

    tipDraft.originalText = text;
    tipDraft.round = 1;

    tipReviewBtn.disabled = true;

    tipReviewBtn.innerHTML =
      `<span class="spinner"></span><span>${t("tipReviewing")}</span>`;

    try {
      const res = await Api.checkKnowledge(
        text,
        currentMachine,
        1
      );

      if (!res.complete) {
        tipDraft.question = res.question;
        clarifyQuestion.textContent = res.question;

        showTipStep("clarify");

        if (clarifySpeakBtn) {
          clarifySpeakBtn.onclick = (e) =>
            speakText(res.question, e.currentTarget);
        }
      } else {
        polishedText.value =
          res.polished_text || text;

        showTipStep("polish");
      }
    } catch (err) {
      showToast(
        err.message || t("tipErrorGeneric"),
        "error"
      );
    } finally {
      tipReviewBtn.disabled = false;

      tipReviewBtn.innerHTML =
        `<span data-i18n="tipSubmit">${t("tipSubmit")}</span>`;
    }
  });

  clarifyContinueBtn.addEventListener(
    "click",
    async () => {
      const answer =
        clarifyAnswer.value.trim();

      const combinedText = answer
        ? `${tipDraft.originalText}\n\n${clarifyQuestion.textContent}\n${answer}`
        : tipDraft.originalText;

      clarifyContinueBtn.disabled = true;

      clarifyContinueBtn.innerHTML =
        `<span class="spinner"></span><span>${t("tipReviewing")}</span>`;

      try {
        const res =
          await Api.checkKnowledge(
            combinedText,
            currentMachine,
            2
          );

        polishedText.value =
          res.polished_text || combinedText;

        showTipStep("polish");
      } catch (err) {
        showToast(
          err.message || t("tipErrorGeneric"),
          "error"
        );
      } finally {
        clarifyContinueBtn.disabled = false;

        clarifyContinueBtn.innerHTML =
          `<span data-i18n="tipAnswerSubmit">${t("tipAnswerSubmit")}</span>`;
      }
    }
  );

  let lastConfirmation = "";

  tipSaveBtn.addEventListener(
    "click",
    async () => {
      const finalText =
        polishedText.value.trim();

      if (!finalText) return;

      tipSaveBtn.disabled = true;

      tipSaveBtn.innerHTML =
        `<span class="spinner"></span><span>${t("tipSaving")}</span>`;

      try {
        const res =
          await Api.addKnowledge(
            finalText,
            currentMachine,
            getLang()
          );

        lastConfirmation =
          res.spoken_confirmation || "";

        showTipStep("success");

        showToast(
          t("tipSuccessTitle"),
          "success"
        );

        if (
          lastConfirmation &&
          tipSpeakConfirmBtn
        ) {
          tipSpeakConfirmBtn.style.display =
            "inline-flex";

          tipSpeakConfirmBtn.onclick = (e) =>
            speakText(
              lastConfirmation,
              e.currentTarget
            );
        } else if (tipSpeakConfirmBtn) {
          tipSpeakConfirmBtn.style.display =
            "none";
        }
      } catch (err) {
        showToast(
          err.message || t("tipErrorGeneric"),
          "error"
        );
      } finally {
        tipSaveBtn.disabled = false;

        tipSaveBtn.innerHTML =
          `<span data-i18n="tipAcceptSubmit">${t("tipAcceptSubmit")}</span>`;
      }
    }
  );

  tipAnotherBtn.addEventListener(
    "click",
    resetTipFlow
  );
})();