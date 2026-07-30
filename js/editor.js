window.App = window.App || {};

App.Editor = (function () {
  const M = App.Model;
  const HOUR_PX = 36;
  const SNAP_MIN = 15;
  const DAY_PX = 24 * HOUR_PX;
  const LONG_PRESS_MS = 350;
  const TOUCH_SLOP = 8;
  const MOUSE_SLOP = 3;

  let activeDayId = M.DAYS[0].id;

  function isNarrow() {
    return window.matchMedia("(max-width: 720px)").matches;
  }

  function snap(min) {
    return Math.round(min / SNAP_MIN) * SNAP_MIN;
  }

  function clampMinutes(min) {
    return Math.max(0, Math.min(M.MINUTES_PER_DAY, min));
  }

  /* While a drag is active, touch scrolling must stop — but only then, so the
     plan stays scrollable with a normal swipe the rest of the time. */
  let scrollLocks = 0;

  function blockTouchScroll(evt) {
    evt.preventDefault();
  }

  function lockScroll() {
    scrollLocks += 1;
    if (scrollLocks === 1) {
      document.addEventListener("touchmove", blockTouchScroll, { passive: false });
      document.body.classList.add("is-dragging");
    }
  }

  function unlockScroll() {
    scrollLocks = Math.max(0, scrollLocks - 1);
    if (scrollLocks === 0) {
      document.removeEventListener("touchmove", blockTouchScroll, { passive: false });
      document.body.classList.remove("is-dragging");
    }
  }

  /* Mouse drags start as soon as the pointer moves; touch drags need a long
     press first, so a swipe over a block scrolls instead of dragging it. */
  function attachDragGesture(el, handlers) {
    let ctx = null;
    let pending = null;

    function clearPending() {
      if (pending && pending.timer) clearTimeout(pending.timer);
      pending = null;
    }

    function activate(origin) {
      ctx = handlers.begin(origin) || {};
      lockScroll();
    }

    el.addEventListener("pointerdown", (evt) => {
      if (evt.button > 0) return;
      if (handlers.shouldStart && !handlers.shouldStart(evt)) return;
      evt.stopPropagation();
      try {
        el.setPointerCapture(evt.pointerId);
      } catch (e) {
        /* capture is best-effort */
      }
      const origin = { clientX: evt.clientX, clientY: evt.clientY, target: evt.target };
      pending = { origin, touch: evt.pointerType === "touch", timer: null };
      if (pending.touch) {
        pending.timer = setTimeout(() => {
          if (!pending) return;
          clearPending();
          activate(origin);
        }, LONG_PRESS_MS);
      }
    });

    el.addEventListener("pointermove", (evt) => {
      if (ctx) {
        evt.preventDefault();
        handlers.move(evt, ctx);
        return;
      }
      if (!pending) return;
      const dist =
        Math.abs(evt.clientX - pending.origin.clientX) +
        Math.abs(evt.clientY - pending.origin.clientY);
      if (pending.touch) {
        if (dist > TOUCH_SLOP) clearPending();
      } else if (dist > MOUSE_SLOP) {
        const origin = pending.origin;
        clearPending();
        activate(origin);
        handlers.move(evt, ctx);
      }
    });

    function finish(cancelled) {
      clearPending();
      if (!ctx) return;
      const current = ctx;
      ctx = null;
      unlockScroll();
      handlers.end(current, !cancelled);
    }

    el.addEventListener("pointerup", () => finish(false));
    el.addEventListener("pointercancel", () => finish(true));
  }

  function dayTotalMinutes(scenario, dayId) {
    return (scenario.days[dayId] || []).reduce((sum, b) => sum + (b.end - b.start), 0);
  }

  function render(container, scenario, categories, onChange) {
    container.innerHTML = "";

    const narrow = isNarrow();
    if (!M.DAYS.some((d) => d.id === activeDayId)) activeDayId = M.DAYS[0].id;
    const days = narrow ? M.DAYS.filter((d) => d.id === activeDayId) : M.DAYS;
    const axisWidth = narrow ? 48 : 64;
    const columns = axisWidth + "px repeat(" + days.length + ", minmax(0, 1fr))";

    const rerender = () => render(container, scenario, categories, onChange);

    const wrap = document.createElement("div");
    wrap.className = "week-editor" + (narrow ? " week-editor--single" : "");

    if (narrow) {
      wrap.appendChild(renderDaySwitcher(scenario, rerender));
    }

    const header = document.createElement("div");
    header.className = "week-editor__header";
    header.style.gridTemplateColumns = columns;
    const axisHeadSpacer = document.createElement("div");
    axisHeadSpacer.className = "week-editor__axis-spacer";
    header.appendChild(axisHeadSpacer);

    days.forEach((day) => {
      const col = document.createElement("div");
      col.className = "week-editor__day-head";
      col.innerHTML =
        `<span class="day-name">${narrow ? day.label : day.short}</span>` +
        `<span class="day-total">${M.formatHours(dayTotalMinutes(scenario, day.id) / 60)}</span>`;
      const addBtn = document.createElement("button");
      addBtn.type = "button";
      addBtn.className = "btn-icon";
      addBtn.title = "Block hinzufügen";
      addBtn.setAttribute("aria-label", "Zeitblock in " + day.label + " hinzufügen");
      addBtn.textContent = "+";
      addBtn.addEventListener("click", () => {
        openBlockModal(categories, { dayIds: [day.id] }, (result) => {
          if (!result) return;
          addBlocks(scenario, result);
          onChange();
        });
      });
      col.appendChild(addBtn);
      header.appendChild(col);
    });
    wrap.appendChild(header);

    const body = document.createElement("div");
    body.className = "week-editor__body";
    body.style.gridTemplateColumns = columns;

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

    days.forEach((day) => {
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

    const hint = document.createElement("p");
    hint.className = "editor-hint";
    hint.textContent = narrow
      ? "Tippen zum Bearbeiten · Lange drücken zum Verschieben oder in der Dauer ändern · „+“ für einen neuen Block"
      : "Klicken zum Bearbeiten · Ziehen zum Verschieben · Ränder ziehen für die Dauer · Auf freie Fläche ziehen für einen neuen Block";
    container.appendChild(hint);
  }

  function renderDaySwitcher(scenario, rerender) {
    const nav = document.createElement("div");
    nav.className = "day-switcher";
    nav.setAttribute("role", "tablist");
    nav.setAttribute("aria-label", "Wochentag auswählen");

    M.DAYS.forEach((day) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "day-chip";
      chip.setAttribute("role", "tab");
      const isActive = day.id === activeDayId;
      chip.setAttribute("aria-selected", String(isActive));
      if (isActive) chip.classList.add("day-chip--active");
      chip.innerHTML =
        `<span class="day-chip__name">${day.short}</span>` +
        `<span class="day-chip__total">${M.formatHours(dayTotalMinutes(scenario, day.id) / 60, 0)}</span>`;
      chip.addEventListener("click", () => {
        activeDayId = day.id;
        rerender();
      });
      nav.appendChild(chip);
    });

    return nav;
  }

  function blockFrom(result) {
    return {
      id: M.uid("blk"),
      catId: result.catId,
      label: result.label,
      start: result.start,
      end: result.end,
    };
  }

  /* One dialog can seed several days at once, so every creation path funnels
     through here and reports how many blocks it actually made. */
  function addBlocks(scenario, result) {
    result.dayIds.forEach((dayId) => {
      scenario.days[dayId].push(blockFrom(result));
      M.sortDay(scenario.days[dayId]);
    });
    announceCreated(result.dayIds.length);
  }

  function announceCreated(count) {
    if (count > 1) {
      App.UI.toast(count + " Zeitblöcke angelegt.");
    }
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

    let suppressClick = false;

    const open = (evt) => {
      evt.stopPropagation();
      openBlockModal(
        categories,
        Object.assign({ dayIds: [day.id] }, block),
        (result, remove) => {
          if (remove) {
            removeBlock(scenario, day.id, block.id);
            onChange();
            return;
          }
          if (!result) return;

          /* The edited block keeps its own day when that day is still
             selected, otherwise it moves to the first one; any further day
             gets a copy. */
          const primary = result.dayIds.includes(day.id) ? day.id : result.dayIds[0];
          if (primary !== day.id) {
            removeBlock(scenario, day.id, block.id);
            scenario.days[primary].push(block);
          }
          block.catId = result.catId;
          block.label = result.label;
          block.start = result.start;
          block.end = result.end;
          M.sortDay(scenario.days[primary]);

          const copies = result.dayIds.filter((id) => id !== primary);
          copies.forEach((dayId) => {
            scenario.days[dayId].push(blockFrom(result));
            M.sortDay(scenario.days[dayId]);
          });
          if (copies.length) {
            App.UI.toast("Auf " + copies.length + " weiteren Tagen kopiert.");
          }
          onChange();
        }
      );
    };

    attachDragGesture(div, {
      shouldStart: (evt) => !evt.target.closest(".week-block__handle"),
      begin: (origin) => {
        div.classList.add("week-block--dragging");
        suppressClick = true;
        return {
          origStart: block.start,
          duration: block.end - block.start,
          dayId: day.id,
          newStart: block.start,
          startClientY: origin.clientY,
        };
      },
      move: (evt, ctx) => {
        const deltaMin = snap(((evt.clientY - ctx.startClientY) / HOUR_PX) * 60);
        const maxStart = M.MINUTES_PER_DAY - ctx.duration;
        ctx.newStart = Math.max(0, Math.min(maxStart, ctx.origStart + deltaMin));

        const under = document.elementFromPoint(evt.clientX, evt.clientY);
        const col = under && under.closest(".week-editor__day");
        if (col && col.dataset.day !== ctx.dayId) {
          col.appendChild(div);
          ctx.dayId = col.dataset.day;
        }

        div.style.top = (ctx.newStart / 60) * HOUR_PX + "px";
        const timeEl = div.querySelector(".week-block__time");
        if (timeEl) {
          timeEl.textContent = `${M.minutesToTime(ctx.newStart)}–${M.minutesToTime(ctx.newStart + ctx.duration)}`;
        }
      },
      end: (ctx, committed) => {
        div.classList.remove("week-block--dragging");
        if (committed) {
          block.start = ctx.newStart;
          block.end = ctx.newStart + ctx.duration;
          if (ctx.dayId !== day.id) {
            removeBlock(scenario, day.id, block.id);
            scenario.days[ctx.dayId].push(block);
          }
          M.sortDay(scenario.days[ctx.dayId]);
          onChange();
        }
        setTimeout(() => {
          suppressClick = false;
        }, 0);
      },
    });

    attachResizeHandlers(topHandle, div, block, day, scenario, onChange, "top");
    attachResizeHandlers(bottomHandle, div, block, day, scenario, onChange, "bottom");

    div.addEventListener("click", (evt) => {
      if (suppressClick) return;
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

  function removeBlock(scenario, dayId, blockId) {
    const idx = scenario.days[dayId].findIndex((b) => b.id === blockId);
    if (idx >= 0) scenario.days[dayId].splice(idx, 1);
  }

  function attachResizeHandlers(handle, div, block, day, scenario, onChange, edge) {
    attachDragGesture(handle, {
      begin: (origin) => {
        div.classList.add("week-block--dragging");
        return {
          origStart: block.start,
          origEnd: block.end,
          startClientY: origin.clientY,
          start: block.start,
          end: block.end,
        };
      },
      move: (evt, ctx) => {
        const deltaMin = snap(((evt.clientY - ctx.startClientY) / HOUR_PX) * 60);
        if (edge === "top") {
          ctx.start = Math.min(
            clampMinutes(ctx.origStart + deltaMin),
            ctx.origEnd - SNAP_MIN
          );
        } else {
          ctx.end = Math.max(
            clampMinutes(ctx.origEnd + deltaMin),
            ctx.origStart + SNAP_MIN
          );
        }
        div.style.top = (ctx.start / 60) * HOUR_PX + "px";
        div.style.height = Math.max(6, ((ctx.end - ctx.start) / 60) * HOUR_PX) + "px";
        const timeEl = div.querySelector(".week-block__time");
        if (timeEl) {
          timeEl.textContent = `${M.minutesToTime(ctx.start)}–${M.minutesToTime(ctx.end)}`;
        }
      },
      end: (ctx, committed) => {
        div.classList.remove("week-block--dragging");
        if (committed) {
          block.start = ctx.start;
          block.end = ctx.end;
          M.sortDay(scenario.days[day.id]);
          onChange();
        }
      },
    });

    handle.addEventListener("click", (evt) => evt.stopPropagation());
  }

  function attachCreateHandlers(col, day, scenario, categories, onChange) {
    attachDragGesture(col, {
      shouldStart: (evt) => evt.target === col,
      begin: (origin) => {
        const rect = col.getBoundingClientRect();
        const startMin = clampMinutes(snap(((origin.clientY - rect.top) / HOUR_PX) * 60));
        const preview = document.createElement("div");
        preview.className = "week-block week-block--preview";
        col.appendChild(preview);
        const ctx = { startMin, endMin: startMin, preview };
        updatePreview(ctx);
        return ctx;
      },
      move: (evt, ctx) => {
        const rect = col.getBoundingClientRect();
        ctx.endMin = clampMinutes(snap(((evt.clientY - rect.top) / HOUR_PX) * 60));
        updatePreview(ctx);
      },
      end: (ctx, committed) => {
        ctx.preview.remove();
        if (!committed) return;
        const start = Math.min(ctx.startMin, ctx.endMin);
        const rawEnd = Math.max(ctx.startMin, ctx.endMin);
        const end = rawEnd - start < SNAP_MIN ? start + 60 : rawEnd;
        openBlockModal(
          categories,
          { start, end: Math.min(end, M.MINUTES_PER_DAY), dayIds: [day.id] },
          (result) => {
            if (!result) return;
            addBlocks(scenario, result);
            onChange();
          }
        );
      },
    });
  }

  function updatePreview(ctx) {
    const start = Math.min(ctx.startMin, ctx.endMin);
    const end = Math.max(ctx.startMin, ctx.endMin);
    ctx.preview.style.top = (start / 60) * HOUR_PX + "px";
    ctx.preview.style.height = Math.max(4, ((end - start) / 60) * HOUR_PX) + "px";
  }

  /* Multi-select day picker: real checkboxes behind chip styling, so keyboard
     and screen-reader behaviour comes for free. */
  function buildDayPicker(selectedIds, isEdit) {
    const field = document.createElement("fieldset");
    field.className = "field field--days";
    const legend = document.createElement("legend");
    legend.textContent = "Tage";
    field.appendChild(legend);

    const picker = document.createElement("div");
    picker.className = "day-picker";
    const boxes = {};

    M.DAYS.forEach((d) => {
      const toggle = document.createElement("label");
      toggle.className = "day-toggle";
      toggle.title = d.label;
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.value = d.id;
      cb.checked = selectedIds.indexOf(d.id) >= 0;
      const text = document.createElement("span");
      text.textContent = d.short;
      toggle.appendChild(cb);
      toggle.appendChild(text);
      const sync = () => toggle.classList.toggle("day-toggle--on", cb.checked);
      cb.addEventListener("change", sync);
      sync();
      picker.appendChild(toggle);
      boxes[d.id] = { input: cb, sync };
    });
    field.appendChild(picker);

    const allIds = M.DAYS.map((d) => d.id);
    const presets = document.createElement("div");
    presets.className = "day-presets";
    [
      { label: "Werktage", ids: allIds.slice(0, 5) },
      { label: "Wochenende", ids: allIds.slice(5) },
      { label: "Alle", ids: allIds },
    ].forEach((preset) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn-secondary btn-small";
      btn.textContent = preset.label;
      btn.addEventListener("click", () => {
        allIds.forEach((id) => {
          boxes[id].input.checked = preset.ids.indexOf(id) >= 0;
          boxes[id].sync();
        });
      });
      presets.appendChild(btn);
    });
    field.appendChild(presets);

    if (isEdit) {
      const hint = document.createElement("p");
      hint.className = "field-hint";
      hint.textContent =
        "Zusätzlich ausgewählte Tage erhalten eine Kopie dieses Blocks.";
      field.appendChild(hint);
    }

    return {
      node: field,
      getSelected: () => allIds.filter((id) => boxes[id].input.checked),
    };
  }

  /* Category chooser that can also mint a new category inline, so a missing
     category does not force a detour through the settings tab. */
  function buildCategoryPicker(categories, selectedId) {
    const NEW_VALUE = "__new__";
    const mode = App.Charts.currentMode();

    const field = document.createElement("div");
    field.className = "field";
    const legend = document.createElement("span");
    legend.textContent = "Kategorie";
    field.appendChild(legend);

    const select = document.createElement("select");
    categories.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.name;
      if (c.id === selectedId) opt.selected = true;
      select.appendChild(opt);
    });
    const newOpt = document.createElement("option");
    newOpt.value = NEW_VALUE;
    newOpt.textContent = "+ Neue Kategorie …";
    select.appendChild(newOpt);
    if (!categories.length) newOpt.selected = true;
    field.appendChild(select);

    const creator = document.createElement("div");
    creator.className = "new-category";
    const swatch = document.createElement("span");
    swatch.className = "category-swatch";
    swatch.style.background = M.slotColor(M.nextColorIndex(categories), mode);
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.placeholder = "Name der neuen Kategorie";
    nameInput.setAttribute("aria-label", "Name der neuen Kategorie");
    creator.appendChild(swatch);
    creator.appendChild(nameInput);
    field.appendChild(creator);

    const nameListeners = [];
    function currentName() {
      if (select.value === NEW_VALUE) return nameInput.value.trim();
      const cat = categories.find((c) => c.id === select.value);
      return cat ? cat.name : "";
    }
    function notify() {
      const name = currentName();
      nameListeners.forEach((fn) => fn(name));
    }

    function syncMode() {
      const creating = select.value === NEW_VALUE;
      creator.hidden = !creating;
      if (creating) nameInput.focus();
      notify();
    }
    select.addEventListener("change", syncMode);
    nameInput.addEventListener("input", notify);
    creator.hidden = select.value !== NEW_VALUE;

    return {
      node: field,
      onNameChange: (fn) => {
        nameListeners.push(fn);
        fn(currentName());
      },
      resolve: () => {
        if (select.value !== NEW_VALUE) return { catId: select.value };
        const name = nameInput.value.trim();
        if (!name) {
          nameInput.focus();
          return { error: "Gib der neuen Kategorie einen Namen." };
        }
        const clash = categories.some(
          (c) => c.name.toLowerCase() === name.toLowerCase()
        );
        if (clash) {
          nameInput.focus();
          return { error: `Die Kategorie "${name}" gibt es bereits.` };
        }
        const cat = {
          id: M.uid("cat"),
          name: name,
          type: "custom",
          colorIndex: M.nextColorIndex(categories),
        };
        categories.push(cat);
        App.UI.toast(`Kategorie "${name}" angelegt.`);
        return { catId: cat.id };
      },
    };
  }

  function openBlockModal(categories, block, callback) {
    const isEdit = !!(block && block.id);
    const body = document.createElement("div");
    body.className = "modal-form";

    const dayPicker = buildDayPicker((block && block.dayIds) || [M.DAYS[0].id], isEdit);

    const catPicker = buildCategoryPicker(categories, block && block.catId);

    const labelField = document.createElement("label");
    labelField.className = "field";
    labelField.innerHTML = `<span>Bezeichnung (optional)</span>`;
    const labelInput = document.createElement("input");
    labelInput.type = "text";
    labelInput.value = (block && block.label) || "";
    labelField.appendChild(labelInput);
    catPicker.onNameChange((name) => {
      labelInput.placeholder = name;
    });

    const timeRow = document.createElement("div");
    timeRow.className = "field-row";
    const startField = document.createElement("label");
    startField.className = "field";
    startField.innerHTML = "<span>Von</span>";
    const startInput = document.createElement("input");
    startInput.type = "time";
    startInput.step = 900;
    startInput.value = M.minutesToTime(block && block.start !== undefined ? block.start : 540);
    startField.appendChild(startInput);

    const endField = document.createElement("label");
    endField.className = "field";
    endField.innerHTML = "<span>Bis</span>";
    const endInput = document.createElement("input");
    endInput.type = "time";
    endInput.step = 900;
    endInput.value = M.minutesToTime(block && block.end !== undefined ? block.end : 600);
    endField.appendChild(endInput);

    timeRow.appendChild(startField);
    timeRow.appendChild(endField);

    body.appendChild(dayPicker.node);
    body.appendChild(catPicker.node);
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
          const dayIds = dayPicker.getSelected();
          if (!dayIds.length) {
            errorMsg.textContent = "Wähle mindestens einen Tag aus.";
            errorMsg.hidden = false;
            return;
          }
          let start = M.timeToMinutes(startInput.value);
          let end = M.timeToMinutes(endInput.value);
          if (end <= start) end = M.MINUTES_PER_DAY;
          if (end - start < SNAP_MIN) {
            errorMsg.textContent = "Der Block muss mindestens 15 Minuten lang sein.";
            errorMsg.hidden = false;
            return;
          }

          /* A category typed into this dialog is only created once the block
             itself is saved, so cancelling leaves nothing behind. */
          const resolved = catPicker.resolve();
          if (resolved.error) {
            errorMsg.textContent = resolved.error;
            errorMsg.hidden = false;
            return;
          }

          callback({
            dayIds,
            catId: resolved.catId,
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
