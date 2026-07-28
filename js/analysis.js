window.App = window.App || {};

App.Analysis = (function () {
  const M = App.Model;

  let simCategoryId = null;
  let simWeeks = 12;
  let simUnitMinutes = 60;
  let simUnitName = "Einheiten";

  function render(container, state, onChange) {
    container.innerHTML = "";

    if (state.scenarios.length < 2) {
      const empty = document.createElement("p");
      empty.className = "empty-hint";
      empty.textContent =
        "Lege in \"Szenarien\" mindestens ein weiteres Szenario an, um es mit deiner Basis zu vergleichen.";
      container.appendChild(empty);
      return;
    }

    const wrap = document.createElement("div");
    wrap.className = "analysis";

    const selectRow = document.createElement("div");
    selectRow.className = "analysis__selectors";

    const baseSelect = buildScenarioSelect(state, state.baseScenarioId);
    const otherDefault =
      state.activeScenarioId !== state.baseScenarioId
        ? state.activeScenarioId
        : (state.scenarios.find((s) => s.id !== state.baseScenarioId) || state.scenarios[0]).id;
    const otherSelect = buildScenarioSelect(state, otherDefault);

    selectRow.appendChild(labeledField("Basis", baseSelect));
    selectRow.appendChild(labeledField("Vergleich", otherSelect));
    wrap.appendChild(selectRow);

    const compareSection = document.createElement("div");
    const simSection = document.createElement("div");

    function refresh() {
      const base = state.scenarios.find((s) => s.id === baseSelect.value);
      const other = state.scenarios.find((s) => s.id === otherSelect.value);
      renderComparison(compareSection, state, base, other);
      renderSimulation(simSection, state, base, other);
    }

    baseSelect.addEventListener("change", refresh);
    otherSelect.addEventListener("change", refresh);

    wrap.appendChild(compareSection);
    wrap.appendChild(simSection);
    container.appendChild(wrap);
    refresh();
  }

  function buildScenarioSelect(state, selectedId) {
    const select = document.createElement("select");
    state.scenarios.forEach((sc) => {
      const opt = document.createElement("option");
      opt.value = sc.id;
      opt.textContent = sc.name + (sc.isBase ? " (Basis)" : "");
      if (sc.id === selectedId) opt.selected = true;
      select.appendChild(opt);
    });
    return select;
  }

  function labeledField(label, node) {
    const field = document.createElement("label");
    field.className = "field field--inline";
    const span = document.createElement("span");
    span.textContent = label;
    field.appendChild(span);
    field.appendChild(node);
    return field;
  }

  function renderComparison(container, state, base, other) {
    container.innerHTML = "";
    if (!base || !other) return;

    const categoryIds = state.categories.map((c) => c.id).concat(M.UNPLANNED_ID);
    const baseTotals = M.computeCategoryTotals(base, state.categories);
    const otherTotals = M.computeCategoryTotals(other, state.categories);
    const rows = M.compareScenarios(baseTotals, otherTotals, categoryIds);

    const heading = document.createElement("h3");
    heading.textContent = "Vergleich pro Woche";
    container.appendChild(heading);

    const tiles = document.createElement("div");
    tiles.className = "stat-tiles";
    rows
      .filter((r) => r.id !== M.UNPLANNED_ID)
      .forEach((row) => {
        const cat = state.categories.find((c) => c.id === row.id);
        const tile = document.createElement("div");
        tile.className = "stat-tile";
        const sign = row.delta > 0 ? "+" : "";
        const deltaClass = row.delta > 0 ? "stat-tile__delta--up" : row.delta < 0 ? "stat-tile__delta--down" : "";
        tile.innerHTML = `
          <div class="stat-tile__label">${cat ? cat.name : row.id}</div>
          <div class="stat-tile__value">${M.formatHours(row.other / 60)}</div>
          <div class="stat-tile__delta ${deltaClass}">${sign}${M.formatHours(row.delta / 60)} ggü. Basis</div>
        `;
        tiles.appendChild(tile);
      });
    container.appendChild(tiles);

    const chartsGrid = document.createElement("div");
    chartsGrid.className = "charts-grid";

    const compareBox = document.createElement("div");
    compareBox.className = "chart-box";
    compareBox.innerHTML = "<h4>Stunden pro Woche im Vergleich</h4>";
    const compareChart = document.createElement("div");
    compareBox.appendChild(compareChart);
    chartsGrid.appendChild(compareBox);

    const deltaBox = document.createElement("div");
    deltaBox.className = "chart-box";
    deltaBox.innerHTML = "<h4>Veränderung pro Kategorie</h4>";
    const deltaChart = document.createElement("div");
    deltaBox.appendChild(deltaChart);
    chartsGrid.appendChild(deltaBox);

    container.appendChild(chartsGrid);

    App.Charts.renderComparisonChart(compareChart, rows, state.categories, {
      baseLabel: base.name,
      otherLabel: other.name,
    });
    App.Charts.renderDeltaChart(deltaChart, rows, state.categories);
  }

  function renderSimulation(container, state, base, other) {
    container.innerHTML = "";
    if (!base || !other) return;

    const categoryIds = state.categories.map((c) => c.id).concat(M.UNPLANNED_ID);
    const baseTotals = M.computeCategoryTotals(base, state.categories);
    const otherTotals = M.computeCategoryTotals(other, state.categories);
    const rows = M.compareScenarios(baseTotals, otherTotals, categoryIds);

    if (!simCategoryId || !rows.find((r) => r.id === simCategoryId)) {
      const firstNonZero = rows.find((r) => r.delta !== 0) || rows[0];
      simCategoryId = firstNonZero.id;
    }

    const heading = document.createElement("h3");
    heading.textContent = "Simulation: gewonnene / verlorene Zeit über die Zeit";
    container.appendChild(heading);

    const controls = document.createElement("div");
    controls.className = "analysis__selectors";

    const catSelect = document.createElement("select");
    rows.forEach((r) => {
      const cat = state.categories.find((c) => c.id === r.id);
      const opt = document.createElement("option");
      opt.value = r.id;
      opt.textContent = cat ? cat.name : "Nicht verplant";
      if (r.id === simCategoryId) opt.selected = true;
      catSelect.appendChild(opt);
    });
    catSelect.addEventListener("change", () => {
      simCategoryId = catSelect.value;
      renderSimulation(container, state, base, other);
    });

    const weeksSelect = document.createElement("select");
    [4, 12, 26, 52].forEach((w) => {
      const opt = document.createElement("option");
      opt.value = w;
      opt.textContent = w + " Wochen";
      if (w === simWeeks) opt.selected = true;
      weeksSelect.appendChild(opt);
    });
    weeksSelect.addEventListener("change", () => {
      simWeeks = Number(weeksSelect.value);
      renderSimulation(container, state, base, other);
    });

    controls.appendChild(labeledField("Kategorie", catSelect));
    controls.appendChild(labeledField("Zeitraum", weeksSelect));
    container.appendChild(controls);

    const row = rows.find((r) => r.id === simCategoryId);
    const points = M.buildProjection(row.delta, simWeeks);
    const totalHours = (row.delta * simWeeks) / 60;

    const headline = document.createElement("div");
    headline.className = "sim-headline";
    const sign = totalHours >= 0 ? "+" : "";
    const catName =
      simCategoryId === M.UNPLANNED_ID
        ? "Nicht verplante Zeit"
        : (state.categories.find((c) => c.id === simCategoryId) || {}).name;
    headline.innerHTML = `Nach <strong>${simWeeks} Wochen</strong> hat sich <strong>${catName}</strong> um <strong>${sign}${M.formatHours(totalHours)}</strong> verändert.`;
    container.appendChild(headline);

    const chartBox = document.createElement("div");
    chartBox.className = "chart-box";
    container.appendChild(chartBox);
    App.Charts.renderProjectionChart(chartBox, points, {});

    const equivBox = document.createElement("div");
    equivBox.className = "equivalence-box";
    equivBox.innerHTML = `<h4>Was bedeutet das?</h4>`;

    const equivForm = document.createElement("div");
    equivForm.className = "field-row";

    const minutesInput = document.createElement("input");
    minutesInput.type = "number";
    minutesInput.min = "1";
    minutesInput.value = simUnitMinutes;

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.value = simUnitName;

    equivForm.appendChild(labeledField("Minuten pro Einheit", minutesInput));
    equivForm.appendChild(labeledField("Bezeichnung", nameInput));
    equivBox.appendChild(equivForm);

    const equivResult = document.createElement("p");
    equivResult.className = "equivalence-result";
    equivBox.appendChild(equivResult);

    function updateEquivalence() {
      simUnitMinutes = Math.max(1, Number(minutesInput.value) || 60);
      simUnitName = nameInput.value.trim() || "Einheiten";
      const totalMinutes = Math.abs(row.delta * simWeeks);
      const units = totalMinutes / simUnitMinutes;
      equivResult.textContent = `≈ ${units.toLocaleString("de-DE", { maximumFractionDigits: 1 })} × ${simUnitName} (${simUnitMinutes} min) in ${simWeeks} Wochen`;
    }
    minutesInput.addEventListener("input", updateEquivalence);
    nameInput.addEventListener("input", updateEquivalence);
    updateEquivalence();

    container.appendChild(equivBox);
  }

  return { render };
})();
