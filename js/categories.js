window.App = window.App || {};

App.Categories = (function () {
  const M = App.Model;

  function render(container, state, onChange) {
    container.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "category-manager";

    const list = document.createElement("div");
    list.className = "category-list";

    state.categories.forEach((cat) => {
      const mode = App.Charts.currentMode();
      const row = document.createElement("div");
      row.className = "category-row";

      const swatch = document.createElement("span");
      swatch.className = "category-swatch";
      swatch.style.background = M.slotColor(cat.colorIndex, mode);
      row.appendChild(swatch);

      const nameInput = document.createElement("input");
      nameInput.type = "text";
      nameInput.value = cat.name;
      nameInput.className = "category-name-input";
      nameInput.addEventListener("change", () => {
        cat.name = nameInput.value.trim() || cat.name;
        onChange();
      });
      row.appendChild(nameInput);

      const delBtn = document.createElement("button");
      delBtn.className = "btn-danger";
      delBtn.textContent = "Löschen";
      delBtn.addEventListener("click", () => {
        const usageCount = countUsage(state, cat.id);
        const msg =
          usageCount > 0
            ? `"${cat.name}" wird in ${usageCount} Zeitblöcken verwendet. Diese Blöcke werden ebenfalls gelöscht.`
            : `Kategorie "${cat.name}" wirklich löschen?`;
        App.UI.confirm(msg, () => {
          state.categories = state.categories.filter((c) => c.id !== cat.id);
          state.scenarios.forEach((sc) => {
            M.DAYS.forEach((d) => {
              sc.days[d.id] = sc.days[d.id].filter((b) => b.catId !== cat.id);
            });
          });
          onChange();
        });
      });
      row.appendChild(delBtn);

      list.appendChild(row);
    });

    wrap.appendChild(list);

    const addRow = document.createElement("div");
    addRow.className = "category-add-row";
    const addInput = document.createElement("input");
    addInput.type = "text";
    addInput.placeholder = "Neue Kategorie …";
    const addBtn = document.createElement("button");
    addBtn.className = "btn-primary";
    addBtn.textContent = "Hinzufügen";
    addBtn.addEventListener("click", () => {
      const name = addInput.value.trim();
      if (!name) return;
      state.categories.push({
        id: M.uid("cat"),
        name,
        type: "custom",
        colorIndex: M.nextColorIndex(state.categories),
      });
      addInput.value = "";
      onChange();
    });
    addRow.appendChild(addInput);
    addRow.appendChild(addBtn);
    wrap.appendChild(addRow);

    container.appendChild(wrap);
  }

  function countUsage(state, catId) {
    let count = 0;
    state.scenarios.forEach((sc) => {
      M.DAYS.forEach((d) => {
        count += sc.days[d.id].filter((b) => b.catId === catId).length;
      });
    });
    return count;
  }

  return { render };
})();
