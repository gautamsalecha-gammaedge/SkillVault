/* ============================================================
   SkillVault — login page logic
   ============================================================ */

(function () {
  // If already logged in, skip straight to the right dashboard.
  if (getWorkerToken()) { window.location.href = "worker.html"; return; }
  if (getAdminToken()) { window.location.href = "admin.html"; return; }

  const steps = {
    lang: document.getElementById("step-lang"),
    role: document.getElementById("step-role"),
    worker: document.getElementById("step-worker"),
    admin: document.getElementById("step-admin"),
    registered: document.getElementById("step-registered"),
  };

  function showStep(name) {
    Object.values(steps).forEach((el) => el.classList.remove("is-active"));
    steps[name].classList.add("is-active");
  }

  document.querySelectorAll("[data-back]").forEach((btn) => {
    btn.addEventListener("click", () => showStep(btn.dataset.back.replace("step-", "")));
  });

  /* ---- Step 1: language list ---- */
  const langList = document.getElementById("lang-list");
  SUPPORTED_LANGS.forEach((lang) => {
    const btn = document.createElement("button");
    btn.className = "option-tile";
    btn.innerHTML = `
      <span class="tile-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 3 2.5 15 0 18M12 3c-2.5 3-2.5 15 0 18" /></svg></span>
      <span class="tile-text"><strong>${lang.label}</strong></span>
      <span class="tile-native">${lang.native}</span>`;
    btn.addEventListener("click", () => {
      setLang(lang.code);
      showStep("role");
    });
    langList.appendChild(btn);
  });

  /* ---- Step 2: role ---- */
  document.getElementById("role-worker").addEventListener("click", () => showStep("worker"));
  document.getElementById("role-admin").addEventListener("click", () => showStep("admin"));

  /* ---- Step 3: worker tabs ---- */
  const tabLogin = document.getElementById("tab-login");
  const tabRegister = document.getElementById("tab-register");
  const formLogin = document.getElementById("form-worker-login");
  const formRegister = document.getElementById("form-worker-register");
  const workerError = document.getElementById("worker-error");

  function selectWorkerTab(which) {
    workerError.classList.remove("is-visible");
    const isLogin = which === "login";
    tabLogin.setAttribute("aria-selected", String(isLogin));
    tabRegister.setAttribute("aria-selected", String(!isLogin));
    formLogin.style.display = isLogin ? "block" : "none";
    formRegister.style.display = isLogin ? "none" : "block";
  }
  tabLogin.addEventListener("click", () => selectWorkerTab("login"));
  tabRegister.addEventListener("click", () => selectWorkerTab("register"));

  function setBusy(btn, busy, label) {
    btn.disabled = busy;
    btn.innerHTML = busy
      ? `<span class="spinner"></span><span>${t("loading")}</span>`
      : `<span>${label}</span>`;
  }

  formLogin.addEventListener("submit", async (e) => {
    e.preventDefault();
    workerError.classList.remove("is-visible");
    const worker_id = document.getElementById("login-worker-id").value.trim();
    const password = document.getElementById("login-password").value;
    if (!worker_id || !password) {
      workerError.textContent = t("fieldRequired");
      workerError.classList.add("is-visible");
      return;
    }
    const btn = document.getElementById("btn-worker-login");
    setBusy(btn, true);
    try {
      const res = await Api.workerLogin(worker_id, password);
      setWorkerSession(res.token, res.name, worker_id);
      window.location.href = "worker.html";
    } catch (err) {
      workerError.textContent =
        err.status === 401 ? t("errorInvalidCredentials") :
        err.status === 403 ? t("errorNotApproved") :
        err.message || t("errorGeneric");
      workerError.classList.add("is-visible");
    } finally {
      setBusy(btn, false, t("loginBtn"));
    }
  });

  formRegister.addEventListener("submit", async (e) => {
    e.preventDefault();
    workerError.classList.remove("is-visible");
    const name = document.getElementById("reg-name").value.trim();
    const worker_id = document.getElementById("reg-worker-id").value.trim();
    const password = document.getElementById("reg-password").value;
    if (!name || !worker_id || !password) {
      workerError.textContent = t("fieldRequired");
      workerError.classList.add("is-visible");
      return;
    }
    const btn = document.getElementById("btn-worker-register");
    setBusy(btn, true);
    try {
      await Api.workerRegister(worker_id, password, name);
      showStep("registered");
      formRegister.reset();
    } catch (err) {
      workerError.textContent = err.status === 400 ? t("errorAlreadyRegistered") : (err.message || t("errorGeneric"));
      workerError.classList.add("is-visible");
    } finally {
      setBusy(btn, false, t("registerBtn"));
    }
  });

  document.getElementById("btn-back-to-login").addEventListener("click", () => {
    selectWorkerTab("login");
    showStep("worker");
  });

  /* ---- Step 4: admin ---- */
  const adminError = document.getElementById("admin-error");
  document.getElementById("form-admin-login").addEventListener("submit", async (e) => {
    e.preventDefault();
    adminError.classList.remove("is-visible");
    const username = document.getElementById("admin-username").value.trim();
    const password = document.getElementById("admin-password").value;
    if (!username || !password) {
      adminError.textContent = t("fieldRequired");
      adminError.classList.add("is-visible");
      return;
    }
    const btn = document.getElementById("btn-admin-login");
    setBusy(btn, true);
    try {
      const res = await Api.adminLogin(username, password);
      setAdminSession(res.token);
      window.location.href = "admin.html";
    } catch (err) {
      adminError.textContent = err.status === 401 ? t("errorAdminCredentials") : (err.message || t("errorGeneric"));
      adminError.classList.add("is-visible");
    } finally {
      setBusy(btn, false, t("adminLoginBtn"));
    }
  });

  // Land on the role step directly if a language is already saved.
  if (localStorage.getItem("sv_lang")) {
    applyLang();
    showStep("role");
  }
})();
