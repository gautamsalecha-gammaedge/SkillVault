/* ============================================================
   SkillVault — toasts & confirm modal
   ============================================================ */

function ensureToastRoot() {
  let root = document.getElementById("toast-root");
  if (!root) {
    root = document.createElement("div");
    root.id = "toast-root";
    root.setAttribute("aria-live", "polite");
    document.body.appendChild(root);
  }
  return root;
}

/**
 * @param {string} message
 * @param {'info'|'success'|'error'} type
 */
function showToast(message, type = "info") {
  const root = ensureToastRoot();
  const el = document.createElement("div");
  el.className = `toast toast--${type}`;
  el.setAttribute("role", type === "error" ? "alert" : "status");
  el.innerHTML = `<p>${escapeHtml(message)}</p>`;
  root.appendChild(el);
  setTimeout(() => {
    el.style.transition = "opacity 0.25s ease";
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 260);
  }, 4200);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Shows a confirmation modal. Resolves true/false.
 * @param {{title: string, body: string, confirmLabel?: string, danger?: boolean}} opts
 */
function confirmModal({ title, body, confirmLabel, danger = false }) {
  return new Promise((resolve) => {
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    backdrop.innerHTML = `
      <div class="modal" role="alertdialog" aria-modal="true" aria-labelledby="modal-title">
        <h3 id="modal-title">${escapeHtml(title)}</h3>
        <p>${escapeHtml(body)}</p>
        <div class="modal-actions">
          <button class="btn btn--ghost" data-action="cancel">${escapeHtml(t("cancel"))}</button>
          <button class="btn ${danger ? "btn--danger" : "btn--primary"}" data-action="confirm">${escapeHtml(confirmLabel || t("confirm"))}</button>
        </div>
      </div>`;
    document.body.appendChild(backdrop);

    const cleanup = (result) => {
      backdrop.remove();
      document.removeEventListener("keydown", onKey);
      resolve(result);
    };
    const onKey = (e) => { if (e.key === "Escape") cleanup(false); };
    document.addEventListener("keydown", onKey);

    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) cleanup(false);
    });
    backdrop.querySelector('[data-action="cancel"]').addEventListener("click", () => cleanup(false));
    backdrop.querySelector('[data-action="confirm"]').addEventListener("click", () => cleanup(true));
    backdrop.querySelector('[data-action="confirm"]').focus();
  });
}
