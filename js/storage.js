window.App = window.App || {};

App.Storage = (function () {
  const KEY = "timeflow.state.v1";

  function defaultState() {
    const M = App.Model;
    const categories = M.defaultCategories();
    const base = M.defaultScenario(categories, "Aktueller Alltag", true);
    return {
      version: 1,
      categories: categories,
      scenarios: [base],
      baseScenarioId: base.id,
      activeScenarioId: base.id,
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.scenarios || !parsed.scenarios.length) {
        return defaultState();
      }
      return parsed;
    } catch (e) {
      console.error("Konnte gespeicherten Zustand nicht laden", e);
      return defaultState();
    }
  }

  function save(state) {
    localStorage.setItem(KEY, JSON.stringify(state));
  }

  function exportToFile(state) {
    const blob = new Blob([JSON.stringify(state, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = "timeflow-" + stamp + ".json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function importFromFile(file) {
    return file.text().then((text) => {
      const parsed = JSON.parse(text);
      if (!parsed || !Array.isArray(parsed.scenarios) || !Array.isArray(parsed.categories)) {
        throw new Error("Ungültiges Datenformat");
      }
      return parsed;
    });
  }

  return { defaultState, load, save, exportToFile, importFromFile };
})();
