window.App = window.App || {};

App.Scenarios = (function () {
  const M = App.Model;

  function render(container, state, onChange) {
    container.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "scenario-manager";

    const list = document.createElement("div");
    list.className = "scenario-list";

    state.scenarios.forEach((sc) => {
      const row = document.createElement("div");
      row.className = "scenario-row";
      if (sc.id === state.activeScenarioId) row.classList.add("scenario-row--active");

      const info = document.createElement("div");
      info.className = "scenario-row__info";
      const totals = M.computeCategoryTotals(sc, state.categories);
      const unplanned = totals[M.UNPLANNED_ID] || 0;
      info.innerHTML = `
        <div class="scenario-row__name">${escapeHtml(sc.name)} ${sc.isBase ? '<span class="badge">Basis</span>' : ""}</div>
        <div class="scenario-row__meta">Verplant: ${M.formatHours((M.MINUTES_PER_WEEK - unplanned) / 60)} / Woche</div>
      `;

      const actions = document.createElement("div");
      actions.className = "scenario-row__actions";

      const selectBtn = document.createElement("button");
      selectBtn.className = "btn-secondary";
      selectBtn.textContent = sc.id === state.activeScenarioId ? "Ausgewählt" : "Bearbeiten";
      selectBtn.disabled = sc.id === state.activeScenarioId;
      selectBtn.addEventListener("click", () => {
        state.activeScenarioId = sc.id;
        onChange();
      });
      actions.appendChild(selectBtn);

      const dupBtn = document.createElement("button");
      dupBtn.className = "btn-secondary";
      dupBtn.textContent = "Duplizieren";
      dupBtn.addEventListener("click", () => {
        promptName("Neues Szenario benennen", sc.name + " (Kopie)", (name) => {
          if (!name) return;
          const copy = {
            id: M.uid("sc"),
            name,
            isBase: false,
            createdAt: Date.now(),
            days: M.cloneWeek(sc.days),
          };
          state.scenarios.push(copy);
          state.activeScenarioId = copy.id;
          onChange();
        });
      });
      actions.appendChild(dupBtn);

      if (!sc.isBase) {
        const baseBtn = document.createElement("button");
        baseBtn.className = "btn-secondary";
        baseBtn.textContent = "Als Basis setzen";
        baseBtn.addEventListener("click", () => {
          state.scenarios.forEach((s) => (s.isBase = s.id === sc.id));
          state.baseScenarioId = sc.id;
          onChange();
        });
        actions.appendChild(baseBtn);

        const delBtn = document.createElement("button");
        delBtn.className = "btn-danger";
        delBtn.textContent = "Löschen";
        delBtn.addEventListener("click", () => {
          App.UI.confirm(
            `Szenario "${sc.name}" wirklich löschen?`,
            () => {
              state.scenarios = state.scenarios.filter((s) => s.id !== sc.id);
              if (state.activeScenarioId === sc.id) {
                state.activeScenarioId = state.baseScenarioId;
              }
              onChange();
            }
          );
        });
        actions.appendChild(delBtn);
      }

      const renameBtn = document.createElement("button");
      renameBtn.className = "btn-secondary";
      renameBtn.textContent = "Umbenennen";
      renameBtn.addEventListener("click", () => {
        promptName("Szenario umbenennen", sc.name, (name) => {
          if (!name) return;
          sc.name = name;
          onChange();
        });
      });
      actions.appendChild(renameBtn);

      row.appendChild(info);
      row.appendChild(actions);
      list.appendChild(row);
    });

    wrap.appendChild(list);

    const newBtn = document.createElement("button");
    newBtn.className = "btn-primary";
    newBtn.textContent = "Neues Szenario aus Basis erstellen";
    newBtn.addEventListener("click", () => {
      const base = state.scenarios.find((s) => s.id === state.baseScenarioId) || state.scenarios[0];
      promptName("Neues Szenario benennen", "Neues Szenario", (name) => {
        if (!name) return;
        const copy = {
          id: M.uid("sc"),
          name,
          isBase: false,
          createdAt: Date.now(),
          days: M.cloneWeek(base.days),
        };
        state.scenarios.push(copy);
        state.activeScenarioId = copy.id;
        onChange();
      });
    });
    wrap.appendChild(newBtn);

    container.appendChild(wrap);
  }

  function promptName(title, defaultValue, callback) {
    const body = document.createElement("div");
    body.className = "modal-form";
    const field = document.createElement("label");
    field.className = "field";
    field.innerHTML = "<span>Name</span>";
    const input = document.createElement("input");
    input.type = "text";
    input.value = defaultValue;
    field.appendChild(input);
    body.appendChild(field);

    App.UI.openModal({
      title,
      body,
      actions: [
        {
          label: "Speichern",
          primary: true,
          onClick: (close) => {
            callback(input.value.trim());
            close();
          },
        },
        { label: "Abbrechen", onClick: (close) => close() },
      ],
      onOpen: () => input.focus(),
    });
  }

  function escapeHtml(str) {
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
  }

  return { render };
})();
