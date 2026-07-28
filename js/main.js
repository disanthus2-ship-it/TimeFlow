window.App = window.App || {};

App.UI = (function () {
  function openModal({ title, body, actions, onOpen }) {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";

    const modal = document.createElement("div");
    modal.className = "modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");

    const header = document.createElement("div");
    header.className = "modal__header";
    const h = document.createElement("h3");
    h.textContent = title;
    header.appendChild(h);
    modal.appendChild(header);

    const bodyWrap = document.createElement("div");
    bodyWrap.className = "modal__body";
    bodyWrap.appendChild(body);
    modal.appendChild(bodyWrap);

    const footer = document.createElement("div");
    footer.className = "modal__footer";

    function close() {
      overlay.remove();
      document.removeEventListener("keydown", onKeydown);
    }

    (actions || []).forEach((action) => {
      const btn = document.createElement("button");
      btn.textContent = action.label;
      btn.className = action.primary
        ? "btn-primary"
        : action.danger
        ? "btn-danger"
        : "btn-secondary";
      btn.addEventListener("click", () => action.onClick(close));
      footer.appendChild(btn);
    });
    modal.appendChild(footer);

    overlay.appendChild(modal);
    overlay.addEventListener("mousedown", (evt) => {
      if (evt.target === overlay) close();
    });

    function onKeydown(evt) {
      if (evt.key === "Escape") close();
    }
    document.addEventListener("keydown", onKeydown);

    document.body.appendChild(overlay);
    if (onOpen) onOpen();
    return close;
  }

  function confirm(message, onConfirm) {
    const body = document.createElement("p");
    body.textContent = message;
    openModal({
      title: "Bestätigen",
      body,
      actions: [
        {
          label: "Löschen",
          danger: true,
          onClick: (close) => {
            onConfirm();
            close();
          },
        },
        { label: "Abbrechen", onClick: (close) => close() },
      ],
    });
  }

  function toast(message) {
    let host = document.getElementById("toast-host");
    if (!host) {
      host = document.createElement("div");
      host.id = "toast-host";
      document.body.appendChild(host);
    }
    const node = document.createElement("div");
    node.className = "toast";
    node.textContent = message;
    host.appendChild(node);
    setTimeout(() => node.classList.add("toast--visible"), 10);
    setTimeout(() => {
      node.classList.remove("toast--visible");
      setTimeout(() => node.remove(), 300);
    }, 2200);
  }

  return { openModal, confirm, toast };
})();

(function () {
  const M = App.Model;
  let state = App.Storage.load();
  let currentTab = "plan";

  const tabs = document.querySelectorAll(".tab-btn");
  const panels = {
    plan: document.getElementById("panel-plan"),
    scenarios: document.getElementById("panel-scenarios"),
    analysis: document.getElementById("panel-analysis"),
    settings: document.getElementById("panel-settings"),
  };

  function persist() {
    App.Storage.save(state);
  }

  function renderAll() {
    renderScenarioSwitcher();
    if (currentTab === "plan") renderPlan();
    if (currentTab === "scenarios") renderScenarios();
    if (currentTab === "analysis") renderAnalysis();
    if (currentTab === "settings") renderSettings();
  }

  function onChange() {
    persist();
    renderAll();
  }

  function renderScenarioSwitcher() {
    const host = document.getElementById("active-scenario-select");
    host.innerHTML = "";
    const select = document.createElement("select");
    state.scenarios.forEach((sc) => {
      const opt = document.createElement("option");
      opt.value = sc.id;
      opt.textContent = sc.name + (sc.isBase ? " (Basis)" : "");
      if (sc.id === state.activeScenarioId) opt.selected = true;
      select.appendChild(opt);
    });
    select.addEventListener("change", () => {
      state.activeScenarioId = select.value;
      onChange();
    });
    host.appendChild(select);
  }

  function renderPlan() {
    const scenario = state.scenarios.find((s) => s.id === state.activeScenarioId);
    App.Editor.render(panels.plan, scenario, state.categories, onChange);
  }

  function renderScenarios() {
    App.Scenarios.render(panels.scenarios, state, onChange);
  }

  function renderAnalysis() {
    App.Analysis.render(panels.analysis, state, onChange);
  }

  function renderSettings() {
    panels.settings.innerHTML = "";

    const catSection = document.createElement("section");
    catSection.className = "settings-section";
    catSection.innerHTML = "<h3>Kategorien</h3>";
    const catHost = document.createElement("div");
    catSection.appendChild(catHost);
    panels.settings.appendChild(catSection);
    App.Categories.render(catHost, state, onChange);

    const dataSection = document.createElement("section");
    dataSection.className = "settings-section";
    dataSection.innerHTML = "<h3>Daten</h3><p class='settings-hint'>Alle Daten werden ausschließlich lokal in deinem Browser gespeichert (localStorage). Nutze Export/Import, um sie zu sichern oder zu übertragen.</p>";

    const btnRow = document.createElement("div");
    btnRow.className = "field-row";

    const exportBtn = document.createElement("button");
    exportBtn.className = "btn-secondary";
    exportBtn.textContent = "Als Datei exportieren";
    exportBtn.addEventListener("click", () => App.Storage.exportToFile(state));
    btnRow.appendChild(exportBtn);

    const importLabel = document.createElement("label");
    importLabel.className = "btn-secondary file-input-label";
    importLabel.textContent = "Aus Datei importieren";
    const importInput = document.createElement("input");
    importInput.type = "file";
    importInput.accept = "application/json";
    importInput.style.display = "none";
    importInput.addEventListener("change", () => {
      const file = importInput.files[0];
      if (!file) return;
      App.Storage.importFromFile(file)
        .then((data) => {
          state = data;
          persist();
          renderAll();
          App.UI.toast("Daten importiert.");
        })
        .catch(() => App.UI.toast("Import fehlgeschlagen: ungültige Datei."));
      importInput.value = "";
    });
    importLabel.appendChild(importInput);
    btnRow.appendChild(importLabel);

    const resetBtn = document.createElement("button");
    resetBtn.className = "btn-danger";
    resetBtn.textContent = "Alle Daten zurücksetzen";
    resetBtn.addEventListener("click", () => {
      App.UI.confirm("Wirklich alle Daten löschen und auf den Standard zurücksetzen?", () => {
        state = App.Storage.defaultState();
        persist();
        renderAll();
      });
    });
    btnRow.appendChild(resetBtn);

    dataSection.appendChild(btnRow);
    panels.settings.appendChild(dataSection);
  }

  tabs.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabs.forEach((b) => b.classList.remove("tab-btn--active"));
      btn.classList.add("tab-btn--active");
      Object.values(panels).forEach((p) => p.classList.remove("panel--active"));
      currentTab = btn.dataset.tab;
      panels[currentTab].classList.add("panel--active");
      renderAll();
    });
  });

  const themeToggle = document.getElementById("theme-toggle");
  const THEME_KEY = "timeflow.theme";
  function applyTheme(theme) {
    if (theme === "system") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", theme);
    }
    themeToggle.textContent = { system: "🌓 System", light: "☀️ Hell", dark: "🌙 Dunkel" }[theme];
    localStorage.setItem(THEME_KEY, theme);
  }
  let theme = localStorage.getItem(THEME_KEY) || "system";
  applyTheme(theme);
  themeToggle.addEventListener("click", () => {
    theme = theme === "system" ? "light" : theme === "light" ? "dark" : "system";
    applyTheme(theme);
    renderAll();
  });

  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(renderAll, 150);
  });

  renderAll();
})();
