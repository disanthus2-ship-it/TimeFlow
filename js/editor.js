window.App = window.App || {};

App.Editor = (function () {
  const M = App.Model;
  const HOUR_PX = 36;
  const SNAP_MIN = 15;
  const DAY_PX = 24 * HOUR_PX;

  function snap(min) {
    return Math.round(min / SNAP_MIN) * SNAP_MIN;
  }

  function clampMinutes(min) {
    return Math.max(0, Math.min(M.MINUTES_PER_DAY, min));
  }

  function render(container, scenario, categories, onChange) {
    container.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "week-editor";

    const header = document.createElement("div");
    header.className = "week-editor__header";
    const axisHeadSpacer = document.createElement("div");
    axisHeadSpacer.className = "week-editor__axis-spacer";
    header.appendChild(axisHeadSpacer);

    const totals = M.computeCategoryTotals(scenario, categories);

    M.DAYS.forEach((day) => {
      const dayTotal = (scenario.days[day.id] || []).reduce(
        (sum, b) => sum + (b.end - b.start),
        0
      );
      const col = document.createElement("div");
      col.className = "week-editor__day-head";
      col.innerHTML = `<span class="day-name">${day.short}</span><span class="day-total">${M.formatHours(dayTotal / 60)}</span>`;
      const addBtn = document.createElement("button");
      addBtn.type = "button";
      addBtn.className = "btn-icon";
      addBtn.title = "Block hinzufügen";
      addBtn.textContent = "+";
      addBtn.addEventListener("click", () => {
        openBlockModal(categories, null, (result) => {
          if (!result) return;
          scenario.days[day.id].push(
            Object.assign({ id: M.uid("blk") }, result)
          );
          M.sortDay(scenario.days[day.id]);
          onChange();
        });
      });
      col.appendChild(addBtn);
      header.appendChild(col);
    });
    wrap.appendChild(header);

    const body = document.createElement("div");
    body.className = "week-editor__body";

    const axis = document.createElement("div");
    axis.className = "week-editor__axis";
    axis.style.height = DAY_PX + "px";
    for (let h = 0; h <= 24; h++) {
      const tick = document.createElement("div");
      tick.className = "week-editor__axis-tick";
      tick.style.top = h * HOUR_PX + "px";
      tick.textContent = String(h).padStart(2, "0") + ":00";
      axis.appendChild(tick);
    }
    body.appendChild(axis);

    M.DAYS.forEach((day) => {
      const col = document.createElement("div");
      col.className = "week-editor__day";
      col.style.height = DAY_PX + "px";
      col.dataset.day = day.id;

      for (let h = 0; h <= 24; h++) {
        const line = document.createElement("div");
        line.className = "week-editor__gridline";
        line.style.top = h * HOUR_PX + "px";
        col.appendChild(line);
      }

      (scenario.days[day.id] || []).forEach((block) => {
        col.appendChild(renderBlock(block, day, scenario, categories, onChange));
      });

      attachCreateHandlers(col, day, scenario, categories, onChange);
      body.appendChild(col);
    });

    wrap.appendChild(body);
    container.appendChild(wrap);
  }

  function renderBlock(block, day, scenario, categories, onChange) {
    const cat = categories.find((c) => c.id === block.catId);
    const mode = App.Charts.currentMode();
    const div = document.createElement("div");
    div.className = "week-block";
    div.style.top = (block.start / 60) * HOUR_PX + "px";
    div.style.height = Math.max(6, ((block.end - block.start) / 60) * HOUR_PX) + "px";
    div.style.background = cat ? M.slotColor(cat.colorIndex, mode) : "#898781";
    div.tabIndex = 0;
    const durationH = (block.end - block.start) / 60;
    div.setAttribute(
      "aria-label",
      `${block.label || (cat ? cat.name : "")}, ${M.minutesToTime(block.start)} bis ${M.minutesToTime(block.end)}`
    );
    if (durationH >= 0.75) {
      div.innerHTML = `<span class="week-block__label">${block.label || (cat ? cat.name : "")}</span><span class="week-block__time">${M.minutesToTime(block.start)}–${M.minutesToTime(block.end)}</span>`;
    }

    const topHandle = document.createElement("div");
    topHandle.className = "week-block__handle week-block__handle--top";
    const bottomHandle = document.createElement("div");
    bottomHandle.className = "week-block__handle week-block__handle--bottom";
    div.appendChild(topHandle);
    div.appendChild(bottomHandle);

    let dragMoved = false;

    const open = (evt) => {
      evt.stopPropagation();
      openBlockModal(categories, block, (result, remove) => {
        if (remove) {
          const idx = scenario.days[day.id].findIndex((b) => b.id === block.id);
          if (idx >= 0) scenario.days[day.id].splice(idx, 1);
          onChange();
          return;
        }
        if (!result) return;
        Object.assign(block, result);
        M.sortDay(scenario.days[day.id]);
        onChange();
      });
    };

    attachMoveHandlers(div, block, day, scenario, onChange, (moved) => {
      dragMoved = moved;
    });
    attachResizeHandlers(topHandle, block, day, scenario, onChange, "top");
    attachResizeHandlers(bottomHandle, block, day, scenario, onChange, "bottom");

    div.addEventListener("click", (evt) => {
      if (dragMoved) return;
      open(evt);
    });
    div.addEventListener("keydown", (evt) => {
      if (evt.key === "Enter" || evt.key === " ") {
        evt.preventDefault();
        open(evt);
      }
    });
    return div;
  }

  function attachMoveHandlers(div, block, day, scenario, onChange, onMovedChange) {
    let drag = null;

    div.addEventListener("pointerdown", (evt) => {
      if (evt.target.closest(".week-block__handle")) return;
      evt.stopPropagation();
      drag = {
        startClientX: evt.clientX,
        startClientY: evt.clientY,
        origStart: block.start,
        duration: block.end - block.start,
        currentDayId: day.id,
        moved: false,
        previewStart: block.start,
        previewEnd: block.end,
      };
      div.setPointerCapture(evt.pointerId);
    });

    div.addEventListener("pointermove", (evt) => {
      if (!drag) return;
      const dx = evt.clientX - drag.startClientX;
      const dy = evt.clientY - drag.startClientY;
      if (!drag.moved) {
        if (Math.abs(dx) + Math.abs(dy) < 4) return;
        drag.moved = true;
        onMovedChange(true);
        div.classList.add("week-block--dragging");
      }

      const deltaMin = snap((dy / HOUR_PX) * 60);
      const maxStart = M.MINUTES_PER_DAY - drag.duration;
      const newStart = Math.max(0, Math.min(maxStart, drag.origStart + deltaMin));
      const newEnd = newStart + drag.duration;
      drag.previewStart = newStart;
      drag.previewEnd = newEnd;

      const under = document.elementFromPoint(evt.clientX, evt.clientY);
      const col = under && under.closest(".week-editor__day");
      if (col && col.dataset.day !== drag.currentDayId) {
        col.appendChild(div);
        drag.currentDayId = col.dataset.day;
      }

      div.style.top = (newStart / 60) * HOUR_PX + "px";
      const timeEl = div.querySelector(".week-block__time");
      if (timeEl) {
        timeEl.textContent = `${M.minutesToTime(newStart)}–${M.minutesToTime(newEnd)}`;
      }
    });

    div.addEventListener("pointerup", () => {
      if (!drag) return;
      const wasMoved = drag.moved;
      div.classList.remove("week-block--dragging");
      if (wasMoved) {
        const targetDayId = drag.currentDayId;
        block.start = drag.previewStart;
        block.end = drag.previewEnd;
        if (targetDayId !== day.id) {
          const idx = scenario.days[day.id].findIndex((b) => b.id === block.id);
          if (idx >= 0) scenario.days[day.id].splice(idx, 1);
          scenario.days[targetDayId].push(block);
          M.sortDay(scenario.days[targetDayId]);
        } else {
          M.sortDay(scenario.days[day.id]);
        }
        onChange();
      }
      drag = null;
      setTimeout(() => onMovedChange(false), 0);
    });
  }

  function attachResizeHandlers(handle, block, day, scenario, onChange, edge) {
    let drag = null;

    handle.addEventListener("pointerdown", (evt) => {
      evt.stopPropagation();
      drag = { startClientY: evt.clientY, origStart: block.start, origEnd: block.end };
      handle.setPointerCapture(evt.pointerId);
    });

    handle.addEventListener("pointermove", (evt) => {
      if (!drag) return;
      evt.stopPropagation();
      const dy = evt.clientY - drag.startClientY;
      const deltaMin = snap((dy / HOUR_PX) * 60);
      if (edge === "top") {
        block.start = Math.min(clampMinutes(drag.origStart + deltaMin), drag.origEnd - SNAP_MIN);
      } else {
        block.end = Math.max(clampMinutes(drag.origEnd + deltaMin), drag.origStart + SNAP_MIN);
      }

      const parentBlock = handle.parentElement;
      parentBlock.style.top = (block.start / 60) * HOUR_PX + "px";
      parentBlock.style.height = Math.max(6, ((block.end - block.start) / 60) * HOUR_PX) + "px";
      const timeEl = parentBlock.querySelector(".week-block__time");
      if (timeEl) {
        timeEl.textContent = `${M.minutesToTime(block.start)}–${M.minutesToTime(block.end)}`;
      }
    });

    handle.addEventListener("pointerup", (evt) => {
      if (!drag) return;
      evt.stopPropagation();
      drag = null;
      M.sortDay(scenario.days[day.id]);
      onChange();
    });

    handle.addEventListener("click", (evt) => evt.stopPropagation());
  }

  function attachCreateHandlers(col, day, scenario, categories, onChange) {
    let dragging = null;

    col.addEventListener("pointerdown", (evt) => {
      if (evt.target !== col) return;
      const rect = col.getBoundingClientRect();
      const startMin = clampMinutes(snap(((evt.clientY - rect.top) / HOUR_PX) * 60));
      dragging = { startMin, endMin: startMin, preview: document.createElement("div") };
      dragging.preview.className = "week-block week-block--preview";
      col.appendChild(dragging.preview);
      col.setPointerCapture(evt.pointerId);
      updatePreview(col, dragging);
    });

    col.addEventListener("pointermove", (evt) => {
      if (!dragging) return;
      const rect = col.getBoundingClientRect();
      const curMin = clampMinutes(snap(((evt.clientY - rect.top) / HOUR_PX) * 60));
      dragging.endMin = curMin;
      updatePreview(col, dragging);
    });

    col.addEventListener("pointerup", () => {
      if (!dragging) return;
      const start = Math.min(dragging.startMin, dragging.endMin);
      const end = Math.max(dragging.startMin, dragging.endMin);
      dragging.preview.remove();
      const finalEnd = end - start < SNAP_MIN ? start + 60 : end;
      dragging = null;
      openBlockModal(
        categories,
        { start, end: Math.min(finalEnd, M.MINUTES_PER_DAY) },
        (result) => {
          if (!result) return;
          scenario.days[day.id].push(Object.assign({ id: M.uid("blk") }, result));
          M.sortDay(scenario.days[day.id]);
          onChange();
        }
      );
    });
  }

  function updatePreview(col, dragging) {
    const start = Math.min(dragging.startMin, dragging.endMin);
    const end = Math.max(dragging.startMin, dragging.endMin);
    dragging.preview.style.top = (start / 60) * HOUR_PX + "px";
    dragging.preview.style.height = Math.max(4, ((end - start) / 60) * HOUR_PX) + "px";
  }

  function openBlockModal(categories, block, callback) {
    const isEdit = !!(block && block.id);
    const body = document.createElement("div");
    body.className = "modal-form";

    const catField = document.createElement("label");
    catField.className = "field";
    catField.innerHTML = `<span>Kategorie</span>`;
    const catSelect = document.createElement("select");
    categories.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.name;
      if (block && block.catId === c.id) opt.selected = true;
      catSelect.appendChild(opt);
    });
    catField.appendChild(catSelect);

    const labelField = document.createElement("label");
    labelField.className = "field";
    labelField.innerHTML = `<span>Bezeichnung (optional)</span>`;
    const labelInput = document.createElement("input");
    labelInput.type = "text";
    labelInput.placeholder = categories[0] ? categories[0].name : "";
    labelInput.value = (block && block.label) || "";
    labelField.appendChild(labelInput);

    const timeRow = document.createElement("div");
    timeRow.className = "field-row";
    const startField = document.createElement("label");
    startField.className = "field";
    startField.innerHTML = "<span>Von</span>";
    const startInput = document.createElement("input");
    startInput.type = "time";
    startInput.step = 900;
    startInput.value = M.minutesToTime(block ? block.start : 540);
    startField.appendChild(startInput);

    const endField = document.createElement("label");
    endField.className = "field";
    endField.innerHTML = "<span>Bis</span>";
    const endInput = document.createElement("input");
    endInput.type = "time";
    endInput.step = 900;
    endInput.value = M.minutesToTime(block ? block.end : 600);
    endField.appendChild(endInput);

    timeRow.appendChild(startField);
    timeRow.appendChild(endField);

    body.appendChild(catField);
    body.appendChild(labelField);
    body.appendChild(timeRow);

    const errorMsg = document.createElement("p");
    errorMsg.className = "field-error";
    errorMsg.hidden = true;
    body.appendChild(errorMsg);

    const actions = [
      {
        label: isEdit ? "Speichern" : "Hinzufügen",
        primary: true,
        onClick: (close) => {
          let start = M.timeToMinutes(startInput.value);
          let end = M.timeToMinutes(endInput.value);
          if (end <= start) end = M.MINUTES_PER_DAY;
          if (end - start < SNAP_MIN) {
            errorMsg.textContent = "Der Block muss mindestens 15 Minuten lang sein.";
            errorMsg.hidden = false;
            return;
          }
          callback({
            catId: catSelect.value,
            label: labelInput.value.trim(),
            start,
            end,
          });
          close();
        },
      },
      { label: "Abbrechen", onClick: (close) => close() },
    ];
    if (isEdit) {
      actions.unshift({
        label: "Löschen",
        danger: true,
        onClick: (close) => {
          callback(null, true);
          close();
        },
      });
    }

    App.UI.openModal({
      title: isEdit ? "Zeitblock bearbeiten" : "Zeitblock hinzufügen",
      body,
      actions,
    });
  }

  return { render };
})();
