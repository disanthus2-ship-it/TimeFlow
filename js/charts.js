window.App = window.App || {};

App.Charts = (function () {
  const M = App.Model;
  const SVG_NS = "http://www.w3.org/2000/svg";

  function currentMode() {
    const themeAttr = document.documentElement.getAttribute("data-theme");
    if (themeAttr === "dark") return "dark";
    if (themeAttr === "light") return "light";
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  function el(tag, attrs) {
    const node = document.createElementNS(SVG_NS, tag);
    if (attrs) {
      Object.keys(attrs).forEach((k) => node.setAttribute(k, attrs[k]));
    }
    return node;
  }

  function ensureTooltip() {
    let tip = document.getElementById("chart-tooltip");
    if (!tip) {
      tip = document.createElement("div");
      tip.id = "chart-tooltip";
      tip.className = "chart-tooltip";
      tip.setAttribute("role", "status");
      tip.hidden = true;
      document.body.appendChild(tip);
    }
    return tip;
  }

  function showTooltip(evt, html) {
    const tip = ensureTooltip();
    tip.innerHTML = html;
    tip.hidden = false;
    positionTooltip(evt);
  }

  function positionTooltip(evt) {
    const tip = ensureTooltip();
    const pad = 14;
    let x = evt.clientX + pad;
    let y = evt.clientY + pad;
    const rect = tip.getBoundingClientRect();
    if (x + rect.width > window.innerWidth) x = evt.clientX - rect.width - pad;
    if (y + rect.height > window.innerHeight) y = evt.clientY - rect.height - pad;
    tip.style.left = x + "px";
    tip.style.top = y + "px";
  }

  function hideTooltip() {
    const tip = document.getElementById("chart-tooltip");
    if (tip) tip.hidden = true;
  }

  function attachHover(node, htmlFn) {
    node.addEventListener("mousemove", (evt) => showTooltip(evt, htmlFn()));
    node.addEventListener("mouseenter", (evt) => showTooltip(evt, htmlFn()));
    node.addEventListener("mouseleave", hideTooltip);
    node.addEventListener("focus", (evt) => {
      const rect = node.getBoundingClientRect();
      showTooltip(
        { clientX: rect.left + rect.width / 2, clientY: rect.top },
        htmlFn()
      );
    });
    node.addEventListener("blur", hideTooltip);
  }

  function categoryLabel(categories, id) {
    if (id === M.UNPLANNED_ID) return "Nicht verplant";
    const c = categories.find((c) => c.id === id);
    return c ? c.name : id;
  }

  function categoryColor(categories, id, mode) {
    if (id === M.UNPLANNED_ID) return mode === "dark" ? "#898781" : "#c3c2b7";
    const c = categories.find((c) => c.id === id);
    if (!c) return mode === "dark" ? "#898781" : "#c3c2b7";
    return M.slotColor(c.colorIndex, mode);
  }

  function ink(mode, role) {
    const map = {
      primary: { light: "#0b0b0b", dark: "#ffffff" },
      secondary: { light: "#52514e", dark: "#c3c2b7" },
      muted: { light: "#898781", dark: "#898781" },
      grid: { light: "#e1e0d9", dark: "#2c2c2a" },
      baseline: { light: "#c3c2b7", dark: "#383835" },
    };
    return map[role][mode];
  }

  function renderComparisonChart(container, rows, categories, opts) {
    container.innerHTML = "";
    const mode = currentMode();
    const width = container.clientWidth || 640;
    const rowH = 46;
    const topPad = 28;
    const leftPad = 150;
    const rightPad = 56;
    const height = topPad + rows.length * rowH + 16;
    const maxVal = Math.max(1, ...rows.map((r) => Math.max(r.base, r.other)));
    const scaleW = width - leftPad - rightPad;

    const svg = el("svg", {
      width: "100%",
      height: height,
      viewBox: `0 0 ${width} ${height}`,
      role: "img",
      "aria-label": "Vergleich der Stunden pro Kategorie zwischen Basis und Szenario",
    });

    const legend = el("g", { transform: `translate(${leftPad}, 14)` });
    const baseColor = mode === "dark" ? "#898781" : "#898781";
    const otherColor = mode === "dark" ? "#3987e5" : "#2a78d6";
    [
      { label: opts.baseLabel, color: baseColor, x: 0 },
      { label: opts.otherLabel, color: otherColor, x: 140 },
    ].forEach((item) => {
      const g = el("g", { transform: `translate(${item.x}, 0)` });
      g.appendChild(el("rect", { width: 12, height: 12, rx: 3, fill: item.color }));
      const t = el("text", { x: 18, y: 10, fill: ink(mode, "secondary"), "font-size": 12 });
      t.textContent = item.label;
      g.appendChild(t);
      legend.appendChild(g);
    });
    svg.appendChild(legend);

    rows.forEach((row, i) => {
      const y = topPad + i * rowH;
      const label = el("text", {
        x: leftPad - 12,
        y: y + rowH / 2 - 6,
        "text-anchor": "end",
        fill: ink(mode, "primary"),
        "font-size": 13,
      });
      label.textContent = categoryLabel(categories, row.id);
      svg.appendChild(label);

      const barPairs = [
        { val: row.base, color: baseColor, dy: -13, name: opts.baseLabel },
        { val: row.other, color: otherColor, dy: 1, name: opts.otherLabel },
      ];

      barPairs.forEach((bar) => {
        const w = Math.max(2, (bar.val / maxVal) * scaleW);
        const barH = 11;
        const rect = el("rect", {
          x: leftPad,
          y: y + rowH / 2 - 6 + bar.dy,
          width: w,
          height: barH,
          rx: 4,
          fill: bar.color,
          tabindex: "0",
          "aria-label": `${categoryLabel(categories, row.id)}, ${bar.name}: ${M.formatHours(bar.val / 60)}`,
        });
        attachHover(rect, () =>
          `<strong>${categoryLabel(categories, row.id)}</strong><br>${bar.name}: ${M.formatHours(bar.val / 60)}`
        );
        svg.appendChild(rect);

        const valText = el("text", {
          x: leftPad + w + 6,
          y: y + rowH / 2 - 6 + bar.dy + barH - 2,
          fill: ink(mode, "secondary"),
          "font-size": 11,
        });
        valText.textContent = M.formatHours(bar.val / 60);
        svg.appendChild(valText);
      });
    });

    container.appendChild(svg);
  }

  function renderDeltaChart(container, rows, categories) {
    container.innerHTML = "";
    const mode = currentMode();
    const width = container.clientWidth || 640;
    const rowH = 40;
    const topPad = 10;
    const leftPad = 150;
    const rightPad = 70;
    const height = topPad + rows.length * rowH + 10;
    const maxAbs = Math.max(1, ...rows.map((r) => Math.abs(r.delta)));
    const scaleW = (width - leftPad - rightPad) / 2;
    const labelGutter = 50;
    const barScaleW = Math.max(20, scaleW - labelGutter);
    const zeroX = leftPad + scaleW;

    const svg = el("svg", {
      width: "100%",
      height: height,
      viewBox: `0 0 ${width} ${height}`,
      role: "img",
      "aria-label": "Veränderung der Stunden pro Kategorie",
    });

    svg.appendChild(
      el("line", {
        x1: zeroX,
        x2: zeroX,
        y1: topPad,
        y2: height - 10,
        stroke: ink(mode, "baseline"),
        "stroke-width": 1,
      })
    );

    rows.forEach((row, i) => {
      const y = topPad + i * rowH;
      const label = el("text", {
        x: leftPad - 12,
        y: y + rowH / 2 + 4,
        "text-anchor": "end",
        fill: ink(mode, "primary"),
        "font-size": 13,
      });
      label.textContent = categoryLabel(categories, row.id);
      svg.appendChild(label);

      const w = Math.max(2, (Math.abs(row.delta) / maxAbs) * barScaleW);
      const gain = row.delta >= 0;
      const color = gain
        ? mode === "dark" ? "#3987e5" : "#2a78d6"
        : mode === "dark" ? "#e66767" : "#e34948";
      const x = gain ? zeroX : zeroX - w;
      const rect = el("rect", {
        x: x,
        y: y + rowH / 2 - 8,
        width: w,
        height: 16,
        rx: 4,
        fill: color,
        tabindex: "0",
        "aria-label": `${categoryLabel(categories, row.id)}: ${gain ? "+" : ""}${M.formatHours(row.delta / 60)} pro Woche`,
      });
      attachHover(rect, () => {
        const sign = gain ? "+" : "";
        return `<strong>${categoryLabel(categories, row.id)}</strong><br>${sign}${M.formatHours(row.delta / 60)} / Woche`;
      });
      svg.appendChild(rect);

      const valText = el("text", {
        x: gain ? x + w + 6 : x - 6,
        y: y + rowH / 2 + 4,
        "text-anchor": gain ? "start" : "end",
        fill: ink(mode, "secondary"),
        "font-size": 11,
      });
      valText.textContent = (gain ? "+" : "") + M.formatHours(row.delta / 60);
      svg.appendChild(valText);
    });

    container.appendChild(svg);
  }

  function renderProjectionChart(container, points, opts) {
    container.innerHTML = "";
    const mode = currentMode();
    const width = container.clientWidth || 640;
    const height = 260;
    const pad = { top: 20, right: 24, bottom: 34, left: 56 };
    const innerW = width - pad.left - pad.right;
    const innerH = height - pad.top - pad.bottom;

    const maxHours = Math.max(1, ...points.map((p) => Math.abs(p.minutes) / 60));
    const minWeek = points[0].week;
    const maxWeek = points[points.length - 1].week;

    const x = (week) =>
      pad.left + ((week - minWeek) / (maxWeek - minWeek || 1)) * innerW;
    const zeroY = pad.top + innerH / 2;
    const yScale = innerH / 2 / maxHours;
    const y = (hours) => zeroY - hours * yScale;

    const svg = el("svg", {
      width: "100%",
      height: height,
      viewBox: `0 0 ${width} ${height}`,
      role: "img",
      "aria-label": "Simulation der kumulierten Zeitveränderung über die Zeit",
    });

    svg.appendChild(
      el("line", {
        x1: pad.left,
        x2: width - pad.right,
        y1: zeroY,
        y2: zeroY,
        stroke: ink(mode, "baseline"),
        "stroke-width": 1,
      })
    );

    const ticks = 4;
    for (let t = 0; t <= ticks; t++) {
      const week = Math.round(minWeek + (t / ticks) * (maxWeek - minWeek));
      const gx = x(week);
      svg.appendChild(
        el("line", {
          x1: gx,
          x2: gx,
          y1: pad.top,
          y2: height - pad.bottom,
          stroke: ink(mode, "grid"),
          "stroke-width": 1,
        })
      );
      const label = el("text", {
        x: gx,
        y: height - pad.bottom + 16,
        "text-anchor": "middle",
        fill: ink(mode, "muted"),
        "font-size": 11,
      });
      label.textContent = "W" + week;
      svg.appendChild(label);
    }

    const lineColor = mode === "dark" ? "#3987e5" : "#2a78d6";
    const areaColor = mode === "dark" ? "rgba(57,135,229,0.18)" : "rgba(42,120,214,0.14)";

    const linePath = points
      .map((p, i) => `${i === 0 ? "M" : "L"} ${x(p.week)} ${y(p.minutes / 60)}`)
      .join(" ");
    const areaPath =
      `M ${x(points[0].week)} ${zeroY} ` +
      points.map((p) => `L ${x(p.week)} ${y(p.minutes / 60)}`).join(" ") +
      ` L ${x(points[points.length - 1].week)} ${zeroY} Z`;

    svg.appendChild(el("path", { d: areaPath, fill: areaColor, stroke: "none" }));
    svg.appendChild(
      el("path", { d: linePath, fill: "none", stroke: lineColor, "stroke-width": 2 })
    );

    points.forEach((p) => {
      const cx = x(p.week);
      const cy = y(p.minutes / 60);
      const dot = el("circle", {
        cx,
        cy,
        r: 8,
        fill: "transparent",
        tabindex: "0",
        "aria-label": `Woche ${p.week}: ${M.formatHours(p.minutes / 60)}`,
      });
      attachHover(dot, () => `<strong>Woche ${p.week}</strong><br>${M.formatHours(p.minutes / 60)} kumuliert`);
      svg.appendChild(dot);
      svg.appendChild(el("circle", { cx, cy, r: 3, fill: lineColor }));
    });

    container.appendChild(svg);
  }

  return { renderComparisonChart, renderDeltaChart, renderProjectionChart, currentMode };
})();
