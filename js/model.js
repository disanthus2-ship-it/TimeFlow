window.App = window.App || {};

App.Model = (function () {
  const DAYS = [
    { id: "mo", label: "Montag", short: "Mo" },
    { id: "di", label: "Dienstag", short: "Di" },
    { id: "mi", label: "Mittwoch", short: "Mi" },
    { id: "do", label: "Donnerstag", short: "Do" },
    { id: "fr", label: "Freitag", short: "Fr" },
    { id: "sa", label: "Samstag", short: "Sa" },
    { id: "so", label: "Sonntag", short: "So" },
  ];

  const MINUTES_PER_DAY = 24 * 60;
  const MINUTES_PER_WEEK = MINUTES_PER_DAY * 7;

  const COLOR_SLOTS = [
    { light: "#2a78d6", dark: "#3987e5" },
    { light: "#eb6834", dark: "#d95926" },
    { light: "#1baf7a", dark: "#199e70" },
    { light: "#eda100", dark: "#c98500" },
    { light: "#e87ba4", dark: "#d55181" },
    { light: "#008300", dark: "#008300" },
    { light: "#4a3aa7", dark: "#9085e9" },
    { light: "#e34948", dark: "#e66767" },
  ];

  const UNPLANNED_ID = "__unplanned__";

  function uid(prefix) {
    return (
      (prefix || "id") +
      "_" +
      Date.now().toString(36) +
      Math.random().toString(36).slice(2, 8)
    );
  }

  function timeToMinutes(hhmm) {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  }

  function minutesToTime(min) {
    min = ((min % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
  }

  function formatHours(hours, decimals) {
    decimals = decimals === undefined ? 1 : decimals;
    return (
      hours.toLocaleString("de-DE", {
        minimumFractionDigits: 0,
        maximumFractionDigits: decimals,
      }) + " h"
    );
  }

  function slotColor(index, mode) {
    const slot = COLOR_SLOTS[index % COLOR_SLOTS.length];
    return mode === "dark" ? slot.dark : slot.light;
  }

  function nextColorIndex(categories) {
    const used = new Set(categories.map((c) => c.colorIndex));
    for (let i = 0; i < COLOR_SLOTS.length; i++) {
      if (!used.has(i)) return i;
    }
    return categories.length % COLOR_SLOTS.length;
  }

  function blankWeek() {
    const days = {};
    DAYS.forEach((d) => (days[d.id] = []));
    return days;
  }

  function cloneWeek(days) {
    const out = {};
    DAYS.forEach((d) => {
      out[d.id] = (days[d.id] || []).map((b) => Object.assign({}, b));
    });
    return out;
  }

  function sortDay(blocks) {
    blocks.sort((a, b) => a.start - b.start);
  }

  function computeCategoryTotals(scenario, categories) {
    const totals = {};
    categories.forEach((c) => (totals[c.id] = 0));
    let scheduled = 0;
    DAYS.forEach((d) => {
      (scenario.days[d.id] || []).forEach((b) => {
        const dur = Math.max(0, b.end - b.start);
        if (totals[b.catId] === undefined) totals[b.catId] = 0;
        totals[b.catId] += dur;
        scheduled += dur;
      });
    });
    totals[UNPLANNED_ID] = Math.max(0, MINUTES_PER_WEEK - scheduled);
    return totals;
  }

  function compareScenarios(baseTotals, otherTotals, categoryIds) {
    const rows = [];
    categoryIds.forEach((id) => {
      const base = baseTotals[id] || 0;
      const other = otherTotals[id] || 0;
      rows.push({ id, base, other, delta: other - base });
    });
    return rows;
  }

  function buildProjection(weeklyDeltaMinutes, weeks) {
    const points = [];
    for (let w = 0; w <= weeks; w++) {
      points.push({ week: w, minutes: weeklyDeltaMinutes * w });
    }
    return points;
  }

  function defaultCategories() {
    const defs = [
      { name: "Arbeit", type: "arbeit" },
      { name: "Freizeit", type: "freizeit" },
      { name: "Sport", type: "sport" },
      { name: "Schlaf", type: "schlaf" },
      { name: "Haushalt & Pflichten", type: "pflicht" },
      { name: "Sonstiges", type: "sonstiges" },
    ];
    return defs.map((d, i) =>
      Object.assign({ id: uid("cat"), colorIndex: i }, d)
    );
  }

  function defaultScenario(categories, name, isBase) {
    const catByType = {};
    categories.forEach((c) => (catByType[c.type] = c.id));
    const scenario = {
      id: uid("sc"),
      name: name,
      isBase: !!isBase,
      createdAt: Date.now(),
      days: blankWeek(),
    };
    const workdays = ["mo", "di", "mi", "do", "fr"];
    workdays.forEach((d) => {
      scenario.days[d].push({
        id: uid("blk"),
        catId: catByType.arbeit,
        start: timeToMinutes("09:00"),
        end: timeToMinutes("17:00"),
        label: "Arbeit",
      });
    });
    DAYS.forEach((d) => {
      scenario.days[d.id].push({
        id: uid("blk"),
        catId: catByType.schlaf,
        start: timeToMinutes("23:00"),
        end: timeToMinutes("24:00"),
        label: "Schlaf",
      });
      scenario.days[d.id].push({
        id: uid("blk"),
        catId: catByType.schlaf,
        start: timeToMinutes("00:00"),
        end: timeToMinutes("07:00"),
        label: "Schlaf",
      });
    });
    Object.values(scenario.days).forEach(sortDay);
    return scenario;
  }

  return {
    DAYS,
    MINUTES_PER_DAY,
    MINUTES_PER_WEEK,
    UNPLANNED_ID,
    COLOR_SLOTS,
    uid,
    timeToMinutes,
    minutesToTime,
    formatHours,
    slotColor,
    nextColorIndex,
    blankWeek,
    cloneWeek,
    sortDay,
    computeCategoryTotals,
    compareScenarios,
    buildProjection,
    defaultCategories,
    defaultScenario,
  };
})();
