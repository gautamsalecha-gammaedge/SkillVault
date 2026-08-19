/* ============================================================
   SkillVault — admin dashboard
   ============================================================ */

(function () {
  if (!requireAdminSession()) return;
  applyLang();

  document.getElementById("btn-logout").addEventListener("click", logoutAdmin);

  /* ---------------- sidebar nav ---------------- */
  const navItems = {
    "pending-workers": document.getElementById("nav-pending-workers"),
    workers: document.getElementById("nav-workers"),
    knowledge: document.getElementById("nav-knowledge"),
    manuals: document.getElementById("nav-manuals"),
  };
  const panels = {
    "pending-workers": document.getElementById("panel-pending-workers"),
    workers: document.getElementById("panel-workers"),
    knowledge: document.getElementById("panel-knowledge"),
    manuals: document.getElementById("panel-manuals"),
  };

  function selectPanel(name) {
    Object.keys(navItems).forEach((k) => navItems[k].setAttribute("aria-selected", String(k === name)));
    Object.keys(panels).forEach((k) => panels[k].classList.toggle("is-active", k === name));
    document.getElementById("sidebar").classList.remove("is-open");
    if (name === "workers") loadWorkers();
    if (name === "manuals") loadManualsMachines();
    if (name === "knowledge") loadKnowledgeMachines();
  }
  Object.keys(navItems).forEach((k) => navItems[k].addEventListener("click", () => selectPanel(k)));

  document.getElementById("btn-menu-toggle").addEventListener("click", () => {
    document.getElementById("sidebar").classList.toggle("is-open");
  });

  /* ================= PENDING WORKERS ================= */
  const pendingWorkersList = document.getElementById("pending-workers-list");
  const countPendingWorkers = document.getElementById("count-pending-workers");

  function skeletonRows(n = 3) {
    return Array.from({ length: n })
      .map(() => `<div class="list-row"><div class="skeleton" style="width:100%;height:44px;"></div></div>`)
      .join("");
  }

  async function loadPendingWorkers() {
    pendingWorkersList.innerHTML = skeletonRows();
    try {
      const res = await Api.pendingWorkers();
      const pending = res.pending_workers || [];
      countPendingWorkers.textContent = pending.length;
      if (!pending.length) {
        pendingWorkersList.innerHTML = emptyState(t("pendingWorkersEmpty"), iconCheck());
        return;
      }
      pendingWorkersList.innerHTML = pending
        .map(
          (w) => `
        <div class="list-row" data-worker-id="${escapeHtml(w.worker_id)}">
          <div class="list-row-main">
            <strong>${escapeHtml(w.name)}</strong>
            <span class="sub">${escapeHtml(w.worker_id)}</span>
          </div>
          <div class="list-row-actions">
            <button class="btn btn--success btn--sm" data-approve>${t("approve")}</button>
            <button class="btn btn--danger btn--sm" data-reject>${t("reject")}</button>
          </div>
        </div>`
        )
        .join("");

      pendingWorkersList.querySelectorAll("[data-approve]").forEach((btn) =>
        btn.addEventListener("click", async (e) => {
          const row = e.currentTarget.closest(".list-row");
          const worker_id = row.dataset.workerId;
          const name = row.querySelector("strong").textContent;
          const ok = await confirmModal({
            title: t("confirmApproveWorkerTitle", { name }),
            body: t("confirmApproveWorkerBody"),
            confirmLabel: t("approve"),
          });
          if (!ok) return;
          try {
            await Api.approveWorker(worker_id);
            showToast(t("toastWorkerApproved", { name }), "success");
            loadPendingWorkers();
          } catch (err) {
            showToast(err.message || t("toastErrorGeneric"), "error");
          }
        })
      );
      pendingWorkersList.querySelectorAll("[data-reject]").forEach((btn) =>
        btn.addEventListener("click", async (e) => {
          const row = e.currentTarget.closest(".list-row");
          const worker_id = row.dataset.workerId;
          const name = row.querySelector("strong").textContent;
          const ok = await confirmModal({
            title: t("confirmRejectWorkerTitle", { name }),
            body: t("confirmRejectWorkerBody"),
            confirmLabel: t("reject"),
            danger: true,
          });
          if (!ok) return;
          try {
            await Api.rejectWorker(worker_id);
            showToast(t("toastWorkerRejected", { name }), "success");
            loadPendingWorkers();
          } catch (err) {
            showToast(err.message || t("toastErrorGeneric"), "error");
          }
        })
      );
    } catch (err) {
      pendingWorkersList.innerHTML = "";
      showToast(err.message || t("toastErrorGeneric"), "error");
    }
  }

  /* ================= WORKERS & MACHINES ================= */
  const workersList = document.getElementById("workers-list");
  let allMachinesCache = [];

  async function loadWorkers() {
    workersList.innerHTML = skeletonRows(3);
    try {
      const [workersRes, machinesRes] = await Promise.all([Api.allWorkers(), Api.allMachines()]);
      const workers = workersRes.workers || [];
      allMachinesCache = machinesRes.machine_ids || [];

      if (!workers.length) {
        workersList.innerHTML = emptyState(t("workersEmpty"), iconUsers());
        return;
      }

      workersList.innerHTML = workers
        .map(
          (w) => `
        <div class="card worker-card" data-worker-id="${escapeHtml(w.worker_id)}">
          <div class="worker-card-head">
            <div class="worker-avatar">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 12a4 4 0 100-8 4 4 0 000 8z"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/></svg>
            </div>
            <div style="flex:1;min-width:0;">
              <div class="row gap-1"><strong>${escapeHtml(w.name)}</strong></div>
              <span class="sub mono" style="font-size:12.5px;color:var(--text-faint);">${escapeHtml(w.worker_id)}</span>
            </div>
            <span class="badge ${w.is_approved ? "badge--green" : "badge--amber"}">
              <span class="led ${w.is_approved ? "led--green" : "led--amber"}"></span>
              ${w.is_approved ? t("statusApproved") : t("statusPending")}
            </span>
          </div>
          <div class="chip-row" data-chip-row><span class="skeleton" style="width:80px;height:22px;border-radius:999px;"></span></div>
          <div class="assign-row">
            <select class="select" data-assign-select>
              <option value="" data-i18n="selectMachinePlaceholder">${t("selectMachinePlaceholder")}</option>
              ${allMachinesCache.map((m) => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join("")}
            </select>
            <button class="btn btn--sm" data-assign-btn>${t("assignMachineBtn")}</button>
          </div>
        </div>`
        )
        .join("");

      workersList.querySelectorAll(".worker-card").forEach((card) => loadWorkerChips(card));

      workersList.querySelectorAll("[data-assign-btn]").forEach((btn) =>
        btn.addEventListener("click", async (e) => {
          const card = e.currentTarget.closest(".worker-card");
          const worker_id = card.dataset.workerId;
          const select = card.querySelector("[data-assign-select]");
          const machine_id = select.value;
          if (!machine_id) return;
          btn.disabled = true;
          try {
            await Api.assignMachine(worker_id, machine_id);
            showToast(t("toastAssigned"), "success");
            select.value = "";
            loadWorkerChips(card);
          } catch (err) {
            showToast(err.message || t("toastErrorGeneric"), "error");
          } finally {
            btn.disabled = false;
          }
        })
      );
    } catch (err) {
      workersList.innerHTML = "";
      showToast(err.message || t("toastErrorGeneric"), "error");
    }
  }

  async function loadWorkerChips(card) {
    const worker_id = card.dataset.workerId;
    const chipRow = card.querySelector("[data-chip-row]");
    try {
      const res = await Api.workerMachines(worker_id);
      const machineIds = res.machine_ids || [];
      chipRow.innerHTML = machineIds.length
        ? machineIds
            .map(
              (m) => `
        <span class="machine-tag">${escapeHtml(m)}
          <button data-unassign="${escapeHtml(m)}" aria-label="${escapeHtml(t("unassign"))}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </span>`
            )
            .join("")
        : `<span class="faint" style="font-size:12.5px;">${t("noAssignments")}</span>`;

      chipRow.querySelectorAll("[data-unassign]").forEach((btn) =>
        btn.addEventListener("click", async (e) => {
          const machine_id = e.currentTarget.dataset.unassign;
          const name = card.querySelector("strong").textContent;
          const ok = await confirmModal({
            title: t("confirmUnassignTitle", { machine: machine_id }),
            body: t("confirmUnassignBody", { name }),
            confirmLabel: t("unassign"),
            danger: true,
          });
          if (!ok) return;
          try {
            await Api.unassignMachine(worker_id, machine_id);
            showToast(t("toastUnassigned"), "success");
            loadWorkerChips(card);
          } catch (err) {
            showToast(err.message || t("toastErrorGeneric"), "error");
          }
        })
      );
    } catch (err) {
      chipRow.innerHTML = `<span class="faint" style="font-size:12.5px;">${t("toastErrorGeneric")}</span>`;
    }
  }

  /* ================= KNOWLEDGE REVIEW ================= */
  /* ================= KNOWLEDGE REVIEW ================= */
const knowledgeMachineSelect = document.getElementById("knowledge-machine-select");
const knowledgeList = document.getElementById("knowledge-list");
const countKnowledge = document.getElementById("count-knowledge");
const ttsAudioAdmin = document.getElementById("tts-audio-admin");
const ALL_MACHINES_VALUE = "__all__";

let knowledgeMachinesCache = [];

async function speakText(text, btnEl) {
  const original = btnEl.innerHTML;
  btnEl.disabled = true;
  btnEl.innerHTML = `<span class="spinner"></span>`;
  try {
    const { blob } = await Api.speak(text, typeof getLang === "function" ? getLang() : "en");
    const url = URL.createObjectURL(blob);
    ttsAudioAdmin.src = url;
    await ttsAudioAdmin.play();
    ttsAudioAdmin.onended = () => {
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

async function fetchPendingCounts(machines) {
  return Promise.all(
    machines.map((m) =>
      Api.pendingEntries(m).then((r) => (r.pending_entries || []).length).catch(() => 0)
    )
  );
}

function renderKnowledgeMachineOptions(counts) {
  const total = counts.reduce((s, c) => s + c, 0);
  const prevValue = knowledgeMachineSelect.value;
  knowledgeMachineSelect.innerHTML = [
    `<option value="${ALL_MACHINES_VALUE}">All machines${total ? ` (${total})` : ""}</option>`,
    ...knowledgeMachinesCache.map(
      (m, i) => `<option value="${escapeHtml(m)}">${escapeHtml(m)}${counts[i] ? ` (${counts[i]})` : ""}</option>`
    ),
  ].join("");
  if ([...knowledgeMachineSelect.options].some((o) => o.value === prevValue)) {
    knowledgeMachineSelect.value = prevValue;
  }
}

async function loadKnowledgeMachines() {
  try {
    const res = await Api.allMachines();
    knowledgeMachinesCache = res.machine_ids || [];
    if (!knowledgeMachinesCache.length) {
      knowledgeMachineSelect.innerHTML = "";
      knowledgeList.innerHTML = emptyState(t("knowledgeEmpty"), iconDoc());
      countKnowledge.textContent = "0";
      return;
    }
    const counts = await fetchPendingCounts(knowledgeMachinesCache);
    renderKnowledgeMachineOptions(counts);
    countKnowledge.textContent = counts.reduce((s, c) => s + c, 0);
    knowledgeMachineSelect.value = ALL_MACHINES_VALUE;
    loadKnowledgeEntries(ALL_MACHINES_VALUE);
  } catch (err) {
    showToast(err.message || t("toastErrorGeneric"), "error");
  }
}
knowledgeMachineSelect.addEventListener("change", () => loadKnowledgeEntries(knowledgeMachineSelect.value));

async function loadKnowledgeEntries(machine_id) {
  if (!machine_id) return;
  knowledgeList.innerHTML = skeletonRows(2);
  try {
    let entries;
    if (machine_id === ALL_MACHINES_VALUE) {
      const perMachine = await Promise.all(
        knowledgeMachinesCache.map((m) =>
          Api.pendingEntries(m)
            .then((r) => (r.pending_entries || []).map((en) => ({ ...en, machine_id: m })))
            .catch(() => [])
        )
      );
      entries = perMachine.flat();
    } else {
      const res = await Api.pendingEntries(machine_id);
      entries = (res.pending_entries || []).map((en) => ({ ...en, machine_id }));
    }

    if (!entries.length) {
      knowledgeList.innerHTML = emptyState(t("knowledgeEmpty"), iconDoc());
      return;
    }

    knowledgeList.innerHTML = entries
      .map(
        (en) => `
      <div class="card entry-card" data-entry-id="${escapeHtml(en.id)}">
        ${machine_id === ALL_MACHINES_VALUE ? `<span class="badge">${escapeHtml(en.machine_id)}</span>` : ""}
        <p class="entry-text">${escapeHtml(en.text)}</p>
        <div class="entry-meta">
          <button class="btn btn--ghost btn--sm" data-speak-entry title="Listen">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4"/></svg>
          </button>
          <span class="sub">${t("submittedBy", { name: en.worker_name || en.worker_id || "—" })}</span>
          <div class="entry-actions">
            <button class="btn btn--success btn--sm" data-approve-entry>${t("approve")}</button>
            <button class="btn btn--danger btn--sm" data-delete-entry>${t("deleteEntry")}</button>
          </div>
        </div>
      </div>`
      )
      .join("");

    knowledgeList.querySelectorAll("[data-speak-entry]").forEach((btn) =>
      btn.addEventListener("click", (e) => {
        const text = e.currentTarget.closest(".entry-card").querySelector(".entry-text").textContent;
        speakText(text, e.currentTarget);
      })
    );
    knowledgeList.querySelectorAll("[data-approve-entry]").forEach((btn) =>
      btn.addEventListener("click", async (e) => {
        const id = e.currentTarget.closest(".entry-card").dataset.entryId;
        const ok = await confirmModal({ title: t("confirmApproveEntryTitle"), body: t("confirmApproveEntryBody"), confirmLabel: t("approve") });
        if (!ok) return;
        try {
          await Api.approveEntry(id);
          showToast(t("toastEntryApproved"), "success");
          await refreshAfterEntryChange(machine_id);
        } catch (err) {
          showToast(err.message || t("toastErrorGeneric"), "error");
        }
      })
    );
    knowledgeList.querySelectorAll("[data-delete-entry]").forEach((btn) =>
      btn.addEventListener("click", async (e) => {
        const id = e.currentTarget.closest(".entry-card").dataset.entryId;
        const ok = await confirmModal({ title: t("confirmDeleteEntryTitle"), body: t("confirmDeleteEntryBody"), confirmLabel: t("deleteEntry"), danger: true });
        if (!ok) return;
        try {
          await Api.deleteEntry(id);
          showToast(t("toastEntryDeleted"), "success");
          await refreshAfterEntryChange(machine_id);
        } catch (err) {
          showToast(err.message || t("toastErrorGeneric"), "error");
        }
      })
    );
  } catch (err) {
    knowledgeList.innerHTML = "";
    showToast(err.message || t("toastErrorGeneric"), "error");
  }
}

async function refreshAfterEntryChange(currentSelection) {
  const counts = await fetchPendingCounts(knowledgeMachinesCache);
  renderKnowledgeMachineOptions(counts);
  countKnowledge.textContent = counts.reduce((s, c) => s + c, 0);
  loadKnowledgeEntries(currentSelection);
}

  /* ================= MANUALS ================= */
  const manualsMachineSelect = document.getElementById("manuals-machine-select");
  const manualsList = document.getElementById("manuals-list");
  const newMachineIdInput = document.getElementById("new-machine-id");
  const newMachineHint = document.getElementById("new-machine-hint");
  const dropzone = document.getElementById("dropzone");
  const dropzoneHint = document.getElementById("dropzone-hint");
  const fileInput = document.getElementById("file-input");
  const progressTrack = document.getElementById("upload-progress-track");
  const progressFill = document.getElementById("upload-progress-fill");

  const modeExistingBtn = document.getElementById("mode-existing-btn");
  const modeNewBtn = document.getElementById("mode-new-btn");
  const existingMachineRow = document.getElementById("existing-machine-row");
  const newMachineRow = document.getElementById("new-machine-row");

  // "existing" | "new" - the ONLY thing that decides where an upload goes.
  // No more silent fallback between two competing inputs.
  let manualsMode = "existing";
  let manualsMachinesCache = [];

  function setManualsMode(mode) {
    manualsMode = mode;
    modeExistingBtn.classList.toggle("is-active", mode === "existing");
    modeExistingBtn.setAttribute("aria-selected", String(mode === "existing"));
    modeNewBtn.classList.toggle("is-active", mode === "new");
    modeNewBtn.setAttribute("aria-selected", String(mode === "new"));
    existingMachineRow.style.display = mode === "existing" ? "" : "none";
    newMachineRow.style.display = mode === "new" ? "" : "none";
    newMachineHint.style.display = "none";
    if (mode === "new") {
      newMachineIdInput.value = "";
      newMachineIdInput.focus();
    }
  }
  modeExistingBtn.addEventListener("click", () => setManualsMode("existing"));
  modeNewBtn.addEventListener("click", () => setManualsMode("new"));

  async function loadManualsMachines() {
    try {
      const res = await Api.allMachines();
      manualsMachinesCache = res.machine_ids || [];
      manualsMachineSelect.innerHTML = manualsMachinesCache.map((m) => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join("");

      if (manualsMachinesCache.length) {
        setManualsMode("existing");
        loadManuals(manualsMachinesCache[0]);
      } else {
        // No machines exist yet at all - force "new machine" mode since
        // there's nothing to select from.
        setManualsMode("new");
        manualsList.innerHTML = emptyState(t("manualsEmpty"), iconDoc());
      }
    } catch (err) {
      showToast(err.message || t("toastErrorGeneric"), "error");
    }
  }
  manualsMachineSelect.addEventListener("change", () => loadManuals(manualsMachineSelect.value));

  /**
   * Resolves the machine_id an upload should go to, based on the explicit
   * mode toggle - not a fallback guess between two inputs.
   * Returns null (and shows an inline hint) if the current mode can't
   * produce a valid target, so handleUpload can bail out cleanly.
   */
  function resolveUploadTarget() {
    if (manualsMode === "existing") {
      return manualsMachineSelect.value || null;
    }

    // mode === "new"
    const typed = newMachineIdInput.value.trim();
    if (!typed) {
      newMachineHint.textContent = t("newMachineIdRequired") || "Type a machine ID first.";
      newMachineHint.style.display = "block";
      return null;
    }

    // Guard against accidental near-duplicates (e.g. "cnc-204" vs
    // "CNC-204") - machine_id isn't case-normalized anywhere in the
    // backend, so a typo here would silently create a phantom second
    // machine instead of adding to the existing one.
    const clash = manualsMachinesCache.find((m) => m.toLowerCase() === typed.toLowerCase());
    if (clash && clash !== typed) {
      newMachineHint.textContent =
        (t("newMachineIdClash") || 'A machine called "{existing}" already exists. Did you mean to add a manual to it instead?').replace(
          "{existing}",
          clash
        );
      newMachineHint.style.display = "block";
      return null;
    }

    newMachineHint.style.display = "none";
    return typed;
  }

  async function loadManuals(machine_id) {
    if (!machine_id) { manualsList.innerHTML = ""; return; }
    manualsList.innerHTML = skeletonRows(2);
    try {
      const res = await Api.manuals(machine_id);
      const manuals = res.manuals || [];
      if (!manuals.length) {
        manualsList.innerHTML = emptyState(t("manualsEmpty"), iconDoc());
        return;
      }
      manualsList.innerHTML = manuals
        .map((m) => {
          const filename = m.filename || m.name || String(m);
          const chunks = m.chunk_count ?? m.chunks ?? m.chunks_created;
          return `
        <div class="card manual-row" data-filename="${escapeHtml(filename)}">
          <div class="file-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/></svg></div>
          <div class="list-row-main">
            <strong>${escapeHtml(filename)}</strong>
            ${chunks != null ? `<span class="sub">${escapeHtml(t("chunksLabel", { n: chunks }))}</span>` : ""}
          </div>
          <button class="btn btn--danger btn--sm" data-delete-manual>${t("deleteManual")}</button>
        </div>`;
        })
        .join("");

      manualsList.querySelectorAll("[data-delete-manual]").forEach((btn) =>
        btn.addEventListener("click", async (e) => {
          const row = e.currentTarget.closest(".manual-row");
          const filename = row.dataset.filename;
          const ok = await confirmModal({
            title: t("confirmDeleteManualTitle", { name: filename }),
            body: t("confirmDeleteManualBody"),
            confirmLabel: t("deleteManual"),
            danger: true,
          });
          if (!ok) return;
          try {
            await Api.deleteManual(machine_id, filename);
            showToast(t("toastManualDeleted"), "success");
            loadManuals(machine_id);
          } catch (err) {
            showToast(err.message || t("toastErrorGeneric"), "error");
          }
        })
      );
    } catch (err) {
      manualsList.innerHTML = "";
      showToast(err.message || t("toastErrorGeneric"), "error");
    }
  }

  dropzone.addEventListener("click", () => fileInput.click());
  dropzone.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInput.click(); } });
  ["dragenter", "dragover"].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.add("is-dragover"); })
  );
  ["dragleave", "drop"].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.remove("is-dragover"); })
  );
  dropzone.addEventListener("drop", (e) => {
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  });
  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (file) handleUpload(file);
    fileInput.value = "";
  });

  async function handleUpload(file) {
    const machine_id = resolveUploadTarget();
    if (!machine_id) {
      // resolveUploadTarget already surfaced a specific inline hint
      // (empty field, or a likely-duplicate machine name) - don't also
      // fire a generic toast on top of that.
      return;
    }
    if (!file.name.toLowerCase().endsWith(".pdf")) { showToast(t("onlyPdf"), "error"); return; }

    progressTrack.style.display = "block";
    progressFill.style.width = "0%";
    dropzoneHint.textContent = t("uploading");

    try {
      const res = await Api.uploadManual(machine_id, file, (frac) => {
        progressFill.style.width = Math.round(frac * 100) + "%";
        if (frac >= 1) dropzoneHint.textContent = t("ingesting");
      });
      showToast(
        `${t("toastManualUploaded")} (${machine_id}) · ${t("chunksCreated", { n: res.chunks_created })}`,
        "success"
      );
      await loadManualsMachines();
      setManualsMode("existing");
      manualsMachineSelect.value = machine_id;
      loadManuals(machine_id);
    } catch (err) {
      showToast(err.message || t("toastErrorGeneric"), "error");
    } finally {
      progressTrack.style.display = "none";
      dropzoneHint.textContent = t("dragDropHint");
    }
  }

  /* ---------------- helpers ---------------- */
  function emptyState(message, icon) {
    return `<div class="empty-state">${icon}<p>${escapeHtml(message)}</p></div>`;
  }
  function iconCheck() {
    return `<div class="empty-icon"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="M9 12l2 2 4-4"/></svg></div>`;
  }
  function iconUsers() {
    return `<div class="empty-icon"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg></div>`;
  }
  function iconDoc() {
    return `<div class="empty-icon"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/></svg></div>`;
  }

  loadPendingWorkers();
})();