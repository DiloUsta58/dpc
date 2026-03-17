document.addEventListener("DOMContentLoaded", () => {
  const parseNumber = (value) => {
    const normalized = String(value).trim().replace(",", ".");
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const formatNumber = (value) => {
    if (!Number.isFinite(value)) {
      return "";
    }
    const rounded = Math.round(value * 100) / 100;
    if (Number.isInteger(rounded)) {
      return String(rounded);
    }
    return String(rounded).replace(".", ",");
  };

  const calculateBereitst = (istMaxRaw) => {
    const raw = String(istMaxRaw || "").trim();
    const parts = raw.split("/");
    if (parts.length !== 2) {
      return "";
    }

    const istPart = parts[0].trim();
    const maxPart = parts[1].trim();
    const max = parseNumber(maxPart);
    if (max === null) {
      return "";
    }

    if (istPart === "") {
      return "";
    }

    const ist = parseNumber(istPart);
    if (ist === null) {
      return "";
    }

    return formatNumber(max - ist);
  };

  const calculateOrDash = (istMaxRaw) => {
    const result = calculateBereitst(istMaxRaw);
    return result === "" ? "-" : result;
  };

  const clampIstToRange = (istRaw, maxValue) => {
    const normalized = String(istRaw || "").trim().replace(",", ".");
    if (normalized === "") {
      return "";
    }

    const istParsed = Number.parseFloat(normalized);
    if (!Number.isFinite(istParsed)) {
      return "";
    }

    const clamped = Math.min(maxValue, Math.max(0, istParsed));
    return formatNumber(clamped);
  };

  const extractPosNumberFromLabel = (rowLabel) => {
    const match = String(rowLabel || "").toUpperCase().match(/POS\.?\s*(\d+)/);
    if (!match) {
      return null;
    }
    const parsed = Number.parseInt(match[1], 10);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const deDateFormatter = new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
  const weekdayFormatter = new Intl.DateTimeFormat("de-DE", { weekday: "short" });

  const toIsoLocal = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const fromIsoLocal = (iso) => {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d);
  };

  const getWeekMonday = (date) => {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return d;
  };

  const getIsoWeekNumber = (date) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  };

  const getIsoWeeksInYear = (year) => {
    const dec28 = new Date(year, 11, 28);
    return getIsoWeekNumber(dec28);
  };

  const getDateFromIsoWeek = (year, week, weekday) => {
    const jan4 = new Date(year, 0, 4);
    const jan4Day = jan4.getDay() || 7;
    const mondayWeek1 = new Date(year, 0, 4 - (jan4Day - 1));
    const target = new Date(mondayWeek1);
    target.setDate(mondayWeek1.getDate() + (week - 1) * 7 + (weekday - 1));
    return target;
  };

  const getWorkWeekByIso = (year, week) => {
    return [1, 2, 3, 4, 5].map((weekday) => getDateFromIsoWeek(year, week, weekday));
  };

  const todayDate = new Date();
  const todayIso = toIsoLocal(todayDate);
  const appVersion = "1.0.37";
  const appVersionFile = "app-version.json";
  const selectedDateStateKey = "dpc:selectedDate";
  const uiSettingsKey = "dpc:settings";
  const defaultUiSettings = {
    btnFs: "13",
    dateFs: "11.5",
    infoFs: "12",
    thFs: "14",
    tdFs: "14",
    allowPastEdit: "0"
  };
  let buildInfoCache = null;
  let selectedIso = todayIso;
  try {
    const storedSelectedIso = localStorage.getItem(selectedDateStateKey);
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(storedSelectedIso || ""))) {
      selectedIso = String(storedSelectedIso);
    }
  } catch (error) {
    selectedIso = todayIso;
  }

  const dateTargets = document.querySelectorAll(".current-date");
  const applyUiSettings = (settings) => {
    const s = settings || defaultUiSettings;
    const root = document.documentElement;
    root.style.setProperty("--fs-btn", `${s.btnFs || defaultUiSettings.btnFs}px`);
    root.style.setProperty("--fs-date", `${s.dateFs || defaultUiSettings.dateFs}px`);
    root.style.setProperty("--fs-info", `${s.infoFs || defaultUiSettings.infoFs}px`);
    root.style.setProperty("--fs-th", `${s.thFs || defaultUiSettings.thFs}px`);
    root.style.setProperty("--fs-td", `${s.tdFs || defaultUiSettings.tdFs}px`);
  };

  const readUiSettings = () => {
    try {
      const raw = localStorage.getItem(uiSettingsKey);
      if (!raw) {
        return { ...defaultUiSettings };
      }
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") {
        return { ...defaultUiSettings };
      }
      return {
        btnFs: String(parsed.btnFs || defaultUiSettings.btnFs),
        dateFs: String(parsed.dateFs || defaultUiSettings.dateFs),
        infoFs: String(parsed.infoFs || defaultUiSettings.infoFs),
        thFs: String(parsed.thFs || defaultUiSettings.thFs),
        tdFs: String(parsed.tdFs || defaultUiSettings.tdFs),
        allowPastEdit: String(
          parsed.allowPastEdit === "1" || parsed.allowPastEdit === 1 || parsed.allowPastEdit === true ? "1" : "0"
        )
      };
    } catch (error) {
      return { ...defaultUiSettings };
    }
  };

  const saveUiSettings = (settings) => {
    localStorage.setItem(uiSettingsKey, JSON.stringify(settings));
  };

  let uiSettings = readUiSettings();
  applyUiSettings(uiSettings);
  const canEditPastDays = () => String(uiSettings.allowPastEdit || "0") === "1";
  const getCurrentWeekFridayIso = () => {
    const monday = getWeekMonday(todayDate);
    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);
    return toIsoLocal(friday);
  };
  const renderSelectedDate = () => {
    const label = deDateFormatter.format(fromIsoLocal(selectedIso));
    dateTargets.forEach((el) => {
      el.textContent = label;
    });
    updateWeingInfo();
  };

  const getBuildInfo = async () => {
    if (buildInfoCache) {
      return buildInfoCache;
    }

    try {
      const response = await fetch(`${appVersionFile}?t=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) {
        return null;
      }
      const info = await response.json();
      if (!info || typeof info !== "object") {
        return null;
      }
      buildInfoCache = info;
      return buildInfoCache;
    } catch (error) {
      return null;
    }
  };

  const initFooter = async () => {
    const lastUpdateEl = document.getElementById("lastUpdate");
    const footerVersionEl = document.getElementById("footerVersion");
    const info = await getBuildInfo();

    if (lastUpdateEl) {
      const rawUpdatedAt = info && typeof info.updatedAt === "string" ? info.updatedAt : "";
      const parsedDate = rawUpdatedAt ? new Date(rawUpdatedAt) : null;
      if (parsedDate && Number.isFinite(parsedDate.getTime())) {
        const stamp = new Intl.DateTimeFormat("de-DE", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        }).format(parsedDate);
        lastUpdateEl.textContent = `Letztes Update: ${stamp}`;
      } else {
        lastUpdateEl.textContent = "Letztes Update: unbekannt";
      }
    }
    if (footerVersionEl) {
      const version = info && typeof info.version === "string" ? info.version : appVersion;
      footerVersionEl.textContent = `Version: ${version}`;
    }
  };

  const compareVersions = (a, b) => {
    const parse = (v) => String(v).split(".").map((part) => Number.parseInt(part, 10) || 0);
    const va = parse(a);
    const vb = parse(b);
    const maxLen = Math.max(va.length, vb.length);
    for (let i = 0; i < maxLen; i += 1) {
      const da = va[i] || 0;
      const db = vb[i] || 0;
      if (da > db) {
        return 1;
      }
      if (da < db) {
        return -1;
      }
    }
    return 0;
  };

  const checkForAppUpdate = async () => {
    try {
      const info = await getBuildInfo();
      if (!info || typeof info.version !== "string") {
        return;
      }

      if (compareVersions(info.version, appVersion) > 0) {
        const onceKey = `dpc:update-applied:${info.version}`;
        if (sessionStorage.getItem(onceKey) === "1") {
          return;
        }

        sessionStorage.setItem(onceKey, "1");
        const url = new URL(window.location.href);
        url.searchParams.set("appv", info.version);
        url.searchParams.set("upd", String(Date.now()));
        window.location.replace(url.toString());
      }
    } catch (error) {
      // Ignore update-check failures and continue app startup
    }
  };

  const persistSelectedDate = () => {
    try {
      localStorage.setItem(selectedDateStateKey, selectedIso);
    } catch (error) {
      // ignore storage errors in private mode / quota
    }
  };

  const readSelectedDateFromState = () => {
    try {
      const stored = localStorage.getItem(selectedDateStateKey);
      if (/^\d{4}-\d{2}-\d{2}$/.test(String(stored || ""))) {
        return String(stored);
      }
    } catch (error) {
      // ignore
    }
    return selectedIso;
  };

  checkForAppUpdate();

  let saveAutoWvorbeRows = () => {};
  let updateTableDoneState = () => {};
  let suppressRemarkPropagation = false;
  const sonderRowsData = [];
  const stockRowsData = [];
  const stockRows = document.querySelectorAll("table.tight tbody tr");
  const waTableBody = document.querySelector("table.tbl-wa tbody");
  const waControlsRow = waTableBody ? waTableBody.querySelector("tr.wa-row-controls") : null;
  const getWaDataRows = () => {
    if (!waTableBody) {
      return [];
    }
    return Array.from(waTableBody.querySelectorAll("tr")).filter((row) => !row.classList.contains("wa-row-controls"));
  };

  const propagateNvToSamePosition = (sourceRowLabel, sourceBemerkInput) => {
    if (suppressRemarkPropagation) {
      return;
    }

    const sourceValue = String(sourceBemerkInput?.value || "").trim().toLowerCase();
    if (sourceValue !== "n.v.") {
      return;
    }

    const sourcePos = extractPosNumberFromLabel(sourceRowLabel);
    if (sourcePos === null) {
      return;
    }

    suppressRemarkPropagation = true;
    try {
      stockRowsData.forEach((entry) => {
        if (!entry.bemerkInput || entry.bemerkInput === sourceBemerkInput) {
          return;
        }
        if (extractPosNumberFromLabel(entry.rowLabel) !== sourcePos) {
          return;
        }
        const targetValue = String(entry.bemerkInput.value || "").trim().toLowerCase();
        if (targetValue === "n.v.") {
          return;
        }
        entry.bemerkInput.value = "n.v.";
        entry.bemerkInput.dispatchEvent(new Event("change", { bubbles: true }));
      });
    } finally {
      suppressRemarkPropagation = false;
    }
  };

  const bindWaRowBehaviors = (row) => {
    if (!row || row.dataset.waBound === "1") {
      return;
    }
    row.dataset.waBound = "1";

    const check = row.querySelector(".status-check");
    const materialInput = row.querySelector("td:nth-child(1) input[type='text']");
    const mengeInput = row.querySelector("td:nth-child(2) input[type='text']");
    const bereitstInput = row.querySelector("td:nth-child(3) input[type='text']");
    const remarkInput = row.querySelector(".bemerk-cell input[type='text']");

    const getRemarkType = (value) => {
      const raw = String(value || "").trim();
      if (raw === "") {
        return "";
      }
      const normalized = raw.toLowerCase().replace(/\s+/g, "").replace(/[.!]/g, "");
      if (normalized === "nv" || normalized === "n.v." || normalized === "n.v") {
        return "nv";
      }
      if (normalized === "freigabeerforderlich" || normalized.startsWith("frei")) {
        return "freigabe";
      }
      return "other";
    };

    const sync = () => {
      const remarkType = getRemarkType(remarkInput?.value || "");
      const remarkIsNv = remarkType === "nv";
      const remarkNeedsRelease = remarkType === "freigabe";
      if (check) {
        if (remarkIsNv && check.checked) {
          check.checked = false;
        }
        check.disabled = remarkIsNv;
        row.classList.toggle("row-done", check.checked);
        row.classList.toggle("row-nv-done", check.checked && remarkIsNv);
      }
      row.classList.toggle("row-not-available", remarkIsNv);
      row.classList.toggle("row-release-required", remarkNeedsRelease);
      updateTableDoneState(row.closest("table.tight"));
      saveAutoWvorbeRows();
    };

    if (check) {
      check.addEventListener("change", sync);
    }
    if (remarkInput) {
      remarkInput.addEventListener("input", () => {
        if (/^\s*frei/i.test(String(remarkInput.value || ""))) {
          remarkInput.value = "Freigabe erforderlich!";
        }
        const remarkType = getRemarkType(remarkInput.value || "");
        row.classList.toggle("row-not-available", remarkType === "nv");
        row.classList.toggle("row-release-required", remarkType === "freigabe");
        updateTableDoneState(row.closest("table.tight"));
      });
      remarkInput.addEventListener("change", sync);
      remarkInput.addEventListener("blur", sync);
    }
    [materialInput, mengeInput, bereitstInput].forEach((input) => {
      if (!input) {
        return;
      }
      input.addEventListener("input", () => {
        updateTableDoneState(row.closest("table.tight"));
        saveAutoWvorbeRows();
      });
      input.addEventListener("change", () => {
        updateTableDoneState(row.closest("table.tight"));
        saveAutoWvorbeRows();
      });
    });
    sync();
  };

  const createWaDataRow = () => {
    const row = document.createElement("tr");
    row.innerHTML = "<td class=\"editable-cell\"><input type=\"text\" value=\"\" /></td><td class=\"editable-cell\"><input type=\"text\" value=\"\" /></td><td class=\"editable-cell\"><input type=\"text\" value=\"\" /></td><td class=\"erld-cell\"><input class=\"status-check\" type=\"checkbox\" /></td><td class=\"bemerk-cell\"><input type=\"text\" value=\"\" /></td>";
    bindWaRowBehaviors(row);
    return row;
  };

  const ensureWaRowCount = (targetCount) => {
    if (!waTableBody) {
      return;
    }
    const safeTarget = Math.max(5, Number.parseInt(String(targetCount || 0), 10) || 5);
    while (getWaDataRows().length < safeTarget) {
      const newRow = createWaDataRow();
      waTableBody.insertBefore(newRow, waControlsRow || null);
    }
    while (getWaDataRows().length > safeTarget) {
      const rows = getWaDataRows();
      const last = rows[rows.length - 1];
      if (!last) {
        break;
      }
      last.remove();
    }
    updateTableDoneState(document.querySelector("table.tbl-wa"));
  };

  stockRows.forEach((row) => {
    const cells = row.querySelectorAll("td");
    if (cells.length < 5) {
      return;
    }

    const istMaxInput = cells[1].querySelector("input[type='text']");
    const bereitstInput = cells[2].querySelector("input[type='text']");
    if (!istMaxInput || !bereitstInput) {
      return;
    }

    const initialValue = String(istMaxInput.value || "").trim();
    const fixedMaxMatch = initialValue.match(/^\/\s*([0-9]+(?:[.,][0-9]+)?)$/);
    const fixedMax = fixedMaxMatch ? fixedMaxMatch[1].replace(",", ".") : null;
    const table = row.closest("table");
    const tableTitleRaw = table ? (table.querySelector("thead th.section")?.textContent || "") : "";
    const tableTitle = tableTitleRaw.replace(/\s+/g, " ").trim().toUpperCase();
    const rowLabel = (cells[0].textContent || "").replace(/\s+/g, " ").trim();
    const rowName = rowLabel.toUpperCase();
    const isSonder = tableTitle.includes("SONDERBEST");
    const materialInput = cells[0].querySelector("input[type='text']");

    if (fixedMax) {
      istMaxInput.dataset.baseMax = fixedMax;
      istMaxInput.dataset.currentMax = fixedMax;
    }

    const istCell = cells[1];
    if (istCell && fixedMax) {
      const wrap = document.createElement("div");
      wrap.className = "istmax-wrap";

      const maxSuffix = document.createElement("span");
      maxSuffix.className = "max-suffix";
      maxSuffix.textContent = `/${fixedMax.replace(".", ",")}`;

      istMaxInput.classList.add("ist-only-input");
      istMaxInput.value = "";

      istCell.insertBefore(wrap, istMaxInput);
      wrap.appendChild(istMaxInput);
      wrap.appendChild(maxSuffix);
    }

    const lockMaxPart = () => {
      const currentMaxStr = istMaxInput.dataset.currentMax || istMaxInput.dataset.baseMax || "";
      const currentMaxValue = Number.parseFloat(String(currentMaxStr).replace(",", "."));
      if (!Number.isFinite(currentMaxValue)) {
        return;
      }

      const rawIst = String(istMaxInput.value || "");
      const safeIst = clampIstToRange(rawIst, currentMaxValue);
      istMaxInput.value = safeIst;
    };

    if (!isSonder) {
      istMaxInput.addEventListener("input", lockMaxPart);
      istMaxInput.addEventListener("change", lockMaxPart);
      lockMaxPart();

      bereitstInput.readOnly = true;
      bereitstInput.tabIndex = -1;
      bereitstInput.classList.add("auto-bereitst");
      bereitstInput.value = "-";

      const syncBereitst = () => {
        const currentMaxStr = istMaxInput.dataset.currentMax || istMaxInput.dataset.baseMax || "";
        const combined = `${String(istMaxInput.value || "").trim()}/${String(currentMaxStr).replace(".", ",")}`;
        bereitstInput.value = calculateOrDash(combined);
        saveAutoWvorbeRows();
      };

      istMaxInput.addEventListener("input", syncBereitst);
      istMaxInput.addEventListener("change", syncBereitst);
    } else {
      const validateSonderBereitst = () => {
        const raw = String(bereitstInput.value || "").trim();
        if (raw === "") {
          bereitstInput.setCustomValidity("");
          return;
        }
        const withUnit = /^[-+]?\d+(?:[.,]\d+)?\s*[A-Za-zÄÖÜäöü]+\.?$/.test(raw);
        const numberOnly = /^[-+]?\d+(?:[.,]\d+)?$/.test(raw);
        if (!withUnit && !numberOnly) {
          bereitstInput.setCustomValidity("Nur Zahl oder Zahl mit Einheit erlaubt, z.B. 4 oder 50 Stk.");
          bereitstInput.reportValidity();
          return;
        }
        bereitstInput.setCustomValidity("");
      };

      istMaxInput.addEventListener("input", saveAutoWvorbeRows);
      istMaxInput.addEventListener("change", saveAutoWvorbeRows);
      bereitstInput.addEventListener("input", () => {
        validateSonderBereitst();
        saveAutoWvorbeRows();
      });
      bereitstInput.addEventListener("blur", validateSonderBereitst);
      if (materialInput) {
        materialInput.addEventListener("input", saveAutoWvorbeRows);
      }
      sonderRowsData.push({
        materialInput,
        mengeInput: istMaxInput,
        bereitstInput
      });
    }

    const bemerkInput = cells[4].querySelector("input[type='text']");
    const statusCheckInRow = row.querySelector(".status-check");
    if (bemerkInput) {
      const detectRemarkType = (value) => {
        const raw = String(value || "").trim();
        if (raw === "") {
          return "";
        }
        const normalized = raw.toLowerCase().replace(/\s+/g, "").replace(/[.!]/g, "");
        if (normalized === "nv" || normalized === "n.v." || normalized === "n.v") {
          return "nv";
        }
        if (normalized === "freigabeerforderlich" || normalized.startsWith("frei")) {
          return "freigabe";
        }
        return "other";
      };

      const normalizeBemerkValue = (value) => {
        const raw = String(value || "").trim();
        if (raw === "") {
          return "";
        }
        if (/^\s*frei/i.test(raw)) {
          return "Freigabe erforderlich!";
        }
        if (isSonder) {
          return raw;
        }
        const remarkType = detectRemarkType(raw);
        if (remarkType === "nv") {
          return "n.v.";
        }
        if (remarkType === "freigabe") {
          return "Freigabe erforderlich!";
        }
        return "";
      };

      const syncRemarkLockState = (normalizedValue) => {
        if (!statusCheckInRow) {
          return;
        }
        const isNotAvailable = detectRemarkType(normalizedValue) === "nv";
        if (isNotAvailable && statusCheckInRow.checked) {
          statusCheckInRow.checked = false;
          statusCheckInRow.dispatchEvent(new Event("change", { bubbles: true }));
        }
        statusCheckInRow.disabled = isNotAvailable;
      };

      const syncBemerkState = () => {
        if (/^\s*frei/i.test(String(bemerkInput.value || ""))) {
          bemerkInput.value = "Freigabe erforderlich!";
        }
        const value = String(bemerkInput.value || "").trim();
        const remarkType = detectRemarkType(value);
        const isNotAvailable = remarkType === "nv";
        const isFreigabe = remarkType === "freigabe";
        row.classList.toggle("row-not-available", isNotAvailable);
        row.classList.toggle("row-release-required", isFreigabe);
        row.classList.toggle("row-nv-done", isNotAvailable);
        syncRemarkLockState(isNotAvailable ? "n.v." : "");
        if (isNotAvailable) {
          propagateNvToSamePosition(rowLabel, bemerkInput);
        }
        updateTableDoneState(row.closest("table.tight"));
      };

      const validateBemerkValue = () => {
        const normalized = normalizeBemerkValue(bemerkInput.value);
        bemerkInput.value = normalized;
        const remarkType = detectRemarkType(normalized);
        row.classList.toggle("row-not-available", remarkType === "nv");
        row.classList.toggle("row-release-required", remarkType === "freigabe");
        row.classList.toggle("row-nv-done", remarkType === "nv");
        syncRemarkLockState(normalized);
        if (remarkType === "nv") {
          propagateNvToSamePosition(rowLabel, bemerkInput);
        }
        saveAutoWvorbeRows();
        updateTableDoneState(row.closest("table.tight"));
      };

      bemerkInput.addEventListener("input", syncBemerkState);
      bemerkInput.addEventListener("change", validateBemerkValue);
      bemerkInput.addEventListener("blur", validateBemerkValue);
      validateBemerkValue();
    }

    const statusCheck = row.querySelector(".status-check");

    stockRowsData.push({
      istMaxInput,
      bereitstInput,
      row,
      tableTitle,
      rowName,
      rowLabel,
      statusCheck,
      bemerkInput
    });
  });

  getWaDataRows().forEach((row) => bindWaRowBehaviors(row));

  const extractDeptCode = (tableTitle) => {
    const normalized = String(tableTitle || "").replace(/\s+/g, " ").trim().toUpperCase();
    if (normalized.includes("SONDERBESTELLUNG")) {
      return "WA";
    }
    if (normalized.includes("SONDERBEST. MATERIAL")) {
      return "WA";
    }
    const match = normalized.match(/ABT\.\s*:\s*([A-Z]+)/);
    return match ? match[1] : "";
  };

  const isExcludedForAutoWvorbe = (tableTitle) => {
    const t = String(tableTitle || "").toUpperCase();
    return false;
  };

  const isFmRegalTable = (tableTitle) => {
    const t = String(tableTitle || "").toUpperCase();
    return /FM-\s*REGAL/.test(t);
  };

  const isFmPowergrTable = (tableTitle) => {
    const t = String(tableTitle || "").toUpperCase();
    return t.includes("POWERGR");
  };

  const isFmStrahlhausTable = (tableTitle) => {
    const t = String(tableTitle || "").toUpperCase();
    return t.includes("STRAHLHAUS");
  };

  const isSonderbestTable = (tableTitle) => {
    const t = String(tableTitle || "").toUpperCase();
    return t.includes("SONDERBEST");
  };

  const packSizeByPosition = {
    1: 250,
    2: 250,
    3: 250,
    4: 250,
    5: 50,
    6: 100,
    7: 100,
    8: 10,
    9: 20,
    10: 20,
    11: 100,
    12: 50,
    13: 50,
    14: 20,
    15: 20,
    16: 50,
    17: 250,
    18: 100,
    19: 20,
    20: 20,
    25: 5
  };

  const sonderMaterialConstants = {
    FR60: { factor: 12.5, outputUnit: "Kg" },
    COAL: { factor: 20, outputUnit: "Kg" },
    IPA: { factor: 150, outputUnit: "Kg" },
    LUDOX: { factor: 255, outputUnit: "Kg" },
    W640: { factor: 60, outputUnit: "Kg" },
    910: { factor: 50, outputUnit: "Stk." },
    688: { factor: 50, outputUnit: "Stk." },
    PLATTEM: { factor: 40, outputUnit: "Stk." }
  };

  const normalizeSonderMaterialKey = (value) => String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

  const extractPositionNumber = (rowLabel) => extractPosNumberFromLabel(rowLabel);

  const buildAutoWvorbeRows = () => {
    const rows = [];
    const fmRegalTotals = new Map();
    stockRowsData.forEach((entry) => {
      if (isExcludedForAutoWvorbe(entry.tableTitle)) {
        return;
      }

      if (!entry.statusCheck || !entry.statusCheck.checked) {
        return;
      }

      const dept = extractDeptCode(entry.tableTitle);
      if (!dept) {
        return;
      }

      if (isSonderbestTable(entry.tableTitle)) {
        return;
      }
      
      if (entry.row.classList.contains("wa-row-controls")) {
        return;
      }

      const material = String(entry.rowLabel || "").replace(/\s+/g, " ").trim();
      if (!material) {
        return;
      }

      const maxRaw = entry.istMaxInput.dataset.currentMax || entry.istMaxInput.dataset.baseMax || "";
      const maxValue = parseNumber(maxRaw);
      const istValue = parseNumber(entry.istMaxInput.value);
      if (maxValue === null || istValue === null) {
        return;
      }

      const diff = Math.max(0, maxValue - istValue);
      if (diff <= 0) {
        return;
      }

      const normalizedMaterial = material.toUpperCase();
      const isRhosealMaterial = normalizedMaterial === "RHOSEAL" || normalizedMaterial === "RHOSEAL HT";
      if (isRhosealMaterial) {
        const totalKg = diff * 25;
        rows.push([
          dept,
          material,
          "",
          "",
          `${formatNumber(totalKg)} Kg`
        ]);
        return;
      }

      if (isFmRegalTable(entry.tableTitle)) {
        const posNo = extractPositionNumber(entry.rowLabel);
        if (posNo === null) {
          return;
        }
        const previous = fmRegalTotals.get(posNo) || 0;
        fmRegalTotals.set(posNo, previous + diff);
        return;
      }

      if (isFmPowergrTable(entry.tableTitle)) {
        const totalPieces = diff * 5;
        rows.push([
          dept,
          material,
          "",
          "",
          `${formatNumber(totalPieces)} Stk.`
        ]);
        return;
      }

      if (isFmStrahlhausTable(entry.tableTitle)) {
        const normalized = material.toUpperCase();
        if (normalized !== "NK60" && normalized !== "NK90") {
          return;
        }
        const totalKg = diff * 1000;
        rows.push([
          dept,
          material,
          "",
          "",
          `${formatNumber(totalKg)} Kg`
        ]);
        return;
      }

      const integerDiff = Math.round(diff);
      if (Math.abs(diff - integerDiff) < 1e-9) {
        for (let i = 0; i < integerDiff; i += 1) {
          rows.push([
            dept,
            material,
            "",
            "",
            "1000 Kg"
          ]);
        }
        return;
      }

      rows.push([
        dept,
        material,
        "",
        "",
        `${formatNumber(diff)}`
      ]);
    });

    Array.from(fmRegalTotals.keys())
      .sort((a, b) => a - b)
      .forEach((posNo) => {
        const totalDiff = fmRegalTotals.get(posNo) || 0;
        if (totalDiff <= 0) {
          return;
        }

        const packSize = packSizeByPosition[posNo];
        if (!packSize) {
          return;
        }

        const totalPieces = totalDiff * packSize;
        rows.push([
          "FM",
          `Pos. ${posNo}`,
          "",
          "",
          `${formatNumber(totalPieces)} Stk.`
        ]);
      });

    getWaDataRows().forEach((row) => {
      const check = row.querySelector(".status-check");
      if (!check || !check.checked) {
        return;
      }
      const materialText = String(row.querySelector("td:nth-child(1) input[type='text']")?.value || "").trim();
      const menge = parseNumber(row.querySelector("td:nth-child(2) input[type='text']")?.value || "");
      const bereitRaw = String(row.querySelector("td:nth-child(3) input[type='text']")?.value || "").trim();
      if (!materialText || menge === null || menge <= 0 || bereitRaw === "") {
        return;
      }
      const withUnitMatch = bereitRaw.match(/^([-+]?\d+(?:[.,]\d+)?)\s*([A-Za-zÄÖÜäöü]+\.?)$/);
      const numberOnlyMatch = bereitRaw.match(/^([-+]?\d+(?:[.,]\d+)?)$/);
      if (!withUnitMatch && !numberOnlyMatch) {
        return;
      }
      const bereitNum = parseNumber(withUnitMatch ? withUnitMatch[1] : numberOnlyMatch?.[1] || "");
      const unit = withUnitMatch ? String(withUnitMatch[2] || "").trim() : "Stk";
      if (bereitNum === null) {
        return;
      }
      const total = menge * bereitNum;
      const materialKey = normalizeSonderMaterialKey(materialText);
      const constantCfg = sonderMaterialConstants[materialKey];
      if (constantCfg) {
        const converted = total * constantCfg.factor;
        rows.push([
          "",
          materialText,
          "",
          "",
          `${formatNumber(total)} Stk (${formatNumber(converted)} ${constantCfg.outputUnit})`
        ]);
        return;
      }
      rows.push([
        "",
        materialText,
        "",
        "",
        `${formatNumber(total)} ${unit}`
      ]);
    });

    return rows;
  };

  saveAutoWvorbeRows = () => {
    if (stockRowsData.length === 0) {
      return;
    }
    try {
      const rows = buildAutoWvorbeRows();
      const payload = {
        date: deDateFormatter.format(fromIsoLocal(selectedIso)),
        savedAt: new Date().toISOString(),
        source: "index-auto",
        rows
      };
      const autoKey = `dpc:auto:wvorbe:${selectedIso}`;
      localStorage.setItem(autoKey, JSON.stringify(payload));
    } catch (error) {
      // ignore storage errors
    }
  };

  const applyDateBasedDefaults = (isoDate, resetValues) => {
    const date = fromIsoLocal(isoDate);
    const isFriday = date.getDay() === 5;

    stockRowsData.forEach((entry) => {
      const baseMax = entry.istMaxInput.dataset.baseMax;
      if (!baseMax) {
        return;
      }

      let targetMax = baseMax;
      if (isFriday && entry.tableTitle.includes("ABT.: KE") && (entry.rowName === "RHOSEAL" || entry.rowName === "RHOSEAL HT")) {
        targetMax = "15";
      }
      if (isFriday && entry.tableTitle.includes("STRAHLHAUS")) {
        targetMax = "2";
      }
      if (isFriday && entry.tableTitle.includes("POWERGR") && entry.rowName === "POS. 25") {
        targetMax = "15";
      }

      entry.istMaxInput.dataset.currentMax = targetMax;
      const suffix = entry.istMaxInput.closest(".istmax-wrap")?.querySelector(".max-suffix");
      if (suffix) {
        suffix.textContent = `/${targetMax.replace(".", ",")}`;
      }
      if (resetValues) {
        entry.istMaxInput.value = "";
      }
      entry.istMaxInput.dispatchEvent(new Event("input", { bubbles: true }));
    });
    saveAutoWvorbeRows();
  };

  updateTableDoneState = (table) => {
    if (!table) {
      return;
    }
    const headCheck = table.querySelector("thead .section input[type='checkbox']");
    const isSonderbestTableEl = table.classList.contains("tbl-wa");
    const rows = Array.from(table.querySelectorAll("tbody tr")).filter((tr) => !tr.classList.contains("wa-row-controls"));
    if (rows.length === 0) {
      table.classList.remove("table-done");
      table.classList.remove("table-nv-done");
      return;
    }
    let hasNv = false;
    const allDone = rows.every((tr) => {
      const check = tr.querySelector(".status-check");
      const materialInput = tr.querySelector("td:nth-child(1) input[type='text']");
      const mengeInput = tr.querySelector("td:nth-child(2) input[type='text']");
      const bereitInput = tr.querySelector("td:nth-child(3) input[type='text']");
      const remarkInput = tr.querySelector(".bemerk-cell input[type='text']");
      const materialValue = materialInput ? String(materialInput.value || "").trim() : "";
      const mengeValue = mengeInput ? String(mengeInput.value || "").trim() : "";
      const bereitRaw = bereitInput ? String(bereitInput.value || "").trim() : "";
      const remarkIsNv = remarkInput && String(remarkInput.value || "").trim().toLowerCase() === "n.v.";
      if (remarkIsNv) {
        hasNv = true;
      }
      const rowIsEmptySonderbest = isSonderbestTableEl
        && materialValue === ""
        && mengeValue === ""
        && bereitRaw === ""
        && !remarkIsNv
        && !(check && check.checked);
      if (rowIsEmptySonderbest) {
        return true;
      }
      const bereitVal = bereitInput ? parseNumber(String(bereitRaw).replace(",", ".")) : null;
      const bereitZero = bereitVal !== null && bereitVal <= 0;
      const checkDone = check && (check.checked || check.disabled);
      return checkDone || bereitZero || remarkIsNv;
    });
    const tableEnabled = !headCheck || headCheck.checked;
    table.classList.toggle("table-done", tableEnabled && allDone);
    table.classList.toggle("table-nv-done", tableEnabled && allDone && hasNv);
  };

  const headChecks = Array.from(document.querySelectorAll(".status-checkKE, .status-checkFM1, .status-checkFM2, .status-checkFM3, .status-checkFM4, .status-checkFM5, .status-checkFMStrahlhaus, .status-checkWA, .status-checkFMpowergr"));
  const statusChecks = document.querySelectorAll(".status-check");
  statusChecks.forEach((check) => {
    const row = check.closest("tr");
    if (!row) {
      return;
    }
    const table = row.closest("table.tight");

    const syncRowState = () => {
      const remarkInput = row.querySelector(".bemerk-cell input[type='text']");
      const remarkIsNv = remarkInput && String(remarkInput.value || "").trim().toLowerCase() === "n.v.";
      const done = check.checked;
      row.classList.toggle("row-done", done);
      row.classList.toggle("row-nv-done", done && remarkIsNv);
      saveAutoWvorbeRows();
      updateTableDoneState(table);
    };

    check.addEventListener("change", syncRowState);
    syncRowState();
  });

  headChecks.forEach((check) => {
    const table = check.closest("table.tight");
    const syncHeadState = () => {
      updateTableDoneState(table);
    };

    check.addEventListener("change", syncHeadState);
    syncHeadState();
  });

  const saveBtn = document.getElementById("saveBtn");
  const loadBtn = document.getElementById("loadBtn");
  const yearDownBtn = document.getElementById("yearDownBtn");
  const yearUpBtn = document.getElementById("yearUpBtn");
  const yearValue = document.getElementById("yearValue");
  const kwSelect = document.getElementById("kwSelect");
  const daySelect = document.getElementById("daySelect");

  if (kwSelect || daySelect) {
    selectedIso = canEditPastDays() ? getCurrentWeekFridayIso() : todayIso;
  }
  const saveStatus = document.getElementById("saveStatus");
  const menuBtn = document.getElementById("menuBtn");
  const menuDropdown = document.getElementById("menuDropdown");
  const exportLocalFileBtn = document.getElementById("exportLocalFileBtn");
  const importLocalFileBtn = document.getElementById("importLocalFileBtn");
  const importFileInput = document.getElementById("importFileInput");
  const weingInfoEl = document.getElementById("weingInfo");
  const addWaRowBtn = document.getElementById("addWaRowBtn");
  const removeWaRowBtn = document.getElementById("removeWaRowBtn");
  const notesCells = Array.from(document.querySelectorAll(".notes-table td[contenteditable='true']"));
  const getIstInputs = () => Array.from(document.querySelectorAll("table.tight tbody tr td:nth-child(2) input[type='text']"));
  const getSonderMaterialInputs = () => Array.from(document.querySelectorAll("table.tbl-wa tbody tr:not(.wa-row-controls) td:nth-child(1) input[type='text']"));
  const getSonderBereitstInputs = () => Array.from(document.querySelectorAll("table.tbl-wa tbody tr:not(.wa-row-controls) td:nth-child(3) input[type='text']"));
  const getChecks = () => Array.from(document.querySelectorAll(".status-check"));
  const getRemarkInputs = () => Array.from(document.querySelectorAll("table.tight tbody tr td:nth-child(5) input[type='text']"));

  const getSnapshot = () => {
    const istInputs = getIstInputs();
    const checks = getChecks();
    const remarkInputs = getRemarkInputs();
    const sonderMaterialInputs = getSonderMaterialInputs();
    const sonderBereitstInputs = getSonderBereitstInputs();
    const istMaxValues = istInputs.map((el) => {
      const max = String(el.dataset.currentMax || el.dataset.baseMax || "").replace(".", ",");
      const ist = String(el.value || "").trim();
      return `${ist}/${max}`;
    });
    const checksValues = checks.map((el) => el.checked);
    const remarkValues = remarkInputs.map((el) => el.value);
    const notes = notesCells.map((el) => el.textContent || "");
    const sonderMaterials = sonderMaterialInputs.map((el) => el.value || "");
    const sonderBereitstValues = sonderBereitstInputs.map((el) => el.value || "");
    const headCheckValues = headChecks.map((el) => el.checked);

    return {
      date: deDateFormatter.format(fromIsoLocal(selectedIso)),
      savedAt: new Date().toISOString(),
      istMaxValues,
      checks: checksValues,
      headChecks: headCheckValues,
      remarkValues,
      notes,
      sonderMaterials,
      sonderBereitstValues,
      waRowCount: getWaDataRows().length,
      autoWvorbeRows: buildAutoWvorbeRows()
    };
  };

  const hasMeaningfulWeingRows = (rows) => {
    if (!Array.isArray(rows)) {
      return false;
    }
    return rows.some((row) => {
      if (!Array.isArray(row)) {
        return false;
      }
      // Neues Format (8 Spalten): nur fachliche Felder zählen, nicht die 3 Probe-Checkbox-Spalten.
      if (row.length >= 8) {
        return row.slice(3, 8).some((cell) => String(cell || "").trim() !== "");
      }
      // Altes Format (5 Spalten): normale Inhaltsprüfung.
      return row.some((cell) => String(cell || "").trim() !== "");
    });
  };

  const updateWeingInfo = () => {
    if (!weingInfoEl) {
      return;
    }
    try {
      const raw = localStorage.getItem(`dpc:weing:${selectedIso}`);
      if (!raw) {
        weingInfoEl.hidden = true;
        return;
      }
      const data = JSON.parse(raw);
      const rows = Array.isArray(data?.rows) ? data.rows : [];
      weingInfoEl.hidden = !hasMeaningfulWeingRows(rows);
    } catch (error) {
      weingInfoEl.hidden = true;
    }
  };

  if (menuBtn && menuDropdown) {
    const closeMenu = () => {
      menuDropdown.classList.remove("open");
      menuDropdown.setAttribute("aria-hidden", "true");
      menuBtn.setAttribute("aria-expanded", "false");
    };

    menuBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      const isOpen = menuDropdown.classList.toggle("open");
      menuDropdown.setAttribute("aria-hidden", isOpen ? "false" : "true");
      menuBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });

    document.addEventListener("click", (event) => {
      if (!menuDropdown.contains(event.target) && event.target !== menuBtn) {
        closeMenu();
      }
    });
  }

  if (addWaRowBtn && waTableBody) {
    addWaRowBtn.addEventListener("click", () => {
      ensureWaRowCount(getWaDataRows().length + 1);
      setReadonlyForPastDays();
      saveAutoWvorbeRows();
    });
  }

  if (removeWaRowBtn && waTableBody) {
    removeWaRowBtn.addEventListener("click", () => {
      ensureWaRowCount(getWaDataRows().length - 1);
      setReadonlyForPastDays();
      saveAutoWvorbeRows();
    });
  }

  const applySnapshot = (data) => {
    if (!data || typeof data !== "object") {
      return;
    }

    if (Number.isFinite(Number(data.waRowCount))) {
      ensureWaRowCount(Number(data.waRowCount));
    }

    const istInputs = getIstInputs();
    const checks = getChecks();
    const remarkInputs = getRemarkInputs();
    const sonderMaterialInputs = getSonderMaterialInputs();
    const sonderBereitstInputs = getSonderBereitstInputs();

    if (Array.isArray(data.istMaxValues)) {
      istInputs.forEach((input, index) => {
        if (typeof data.istMaxValues[index] !== "string") {
          return;
        }
        const raw = data.istMaxValues[index];
        const parts = raw.split("/");
        if (parts.length === 2) {
          const nextIst = parts[0].trim();
          const nextMax = parts[1].trim().replace(",", ".");
          if (nextMax !== "") {
            input.dataset.currentMax = nextMax;
            const suffix = input.closest(".istmax-wrap")?.querySelector(".max-suffix");
            if (suffix) {
              suffix.textContent = `/${nextMax.replace(".", ",")}`;
            }
          }
          input.value = nextIst;
        } else {
          input.value = raw;
        }
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
    }

    if (Array.isArray(data.checks)) {
      checks.forEach((check, index) => {
        if (typeof data.checks[index] !== "boolean") {
          return;
        }
        check.checked = data.checks[index];
        check.dispatchEvent(new Event("change", { bubbles: true }));
      });
    }

    if (Array.isArray(data.remarkValues)) {
      remarkInputs.forEach((input, index) => {
        if (typeof data.remarkValues[index] !== "string") {
          return;
        }
        input.value = data.remarkValues[index];
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
    }

    if (Array.isArray(data.headChecks)) {
      headChecks.forEach((check, index) => {
        if (typeof data.headChecks[index] !== "boolean") {
          return;
        }
        check.checked = data.headChecks[index];
        check.dispatchEvent(new Event("change", { bubbles: true }));
      });
    }

    if (Array.isArray(data.sonderMaterials)) {
      sonderMaterialInputs.forEach((input, index) => {
        if (typeof data.sonderMaterials[index] !== "string") {
          return;
        }
        input.value = data.sonderMaterials[index];
      });
    }

    if (Array.isArray(data.sonderBereitstValues)) {
      sonderBereitstInputs.forEach((input, index) => {
        if (typeof data.sonderBereitstValues[index] !== "string") {
          return;
        }
        input.value = data.sonderBereitstValues[index];
      });
    }

    if (Array.isArray(data.notes)) {
      notesCells.forEach((cell, index) => {
        if (typeof data.notes[index] !== "string") {
          return;
        }
        cell.textContent = data.notes[index];
      });
    }
    saveAutoWvorbeRows();
  };

  const setStatus = (text, isError) => {
    if (!saveStatus) {
      return;
    }
    saveStatus.textContent = text;
    saveStatus.classList.toggle("error", Boolean(isError));
  };

  const backupKeyPrefixes = [
    "dpc:index:",
    "dpc:wvorbe:",
    "dpc:weing:",
    "dpc:auto:wvorbe:",
    "dpc:selectedDate",
    "dpc:settings"
  ];

  const isBackupKey = (key) => backupKeyPrefixes.some((prefix) => String(key).startsWith(prefix));

  const listDpcKeys = () => {
    const keys = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (typeof key === "string" && isBackupKey(key)) {
        keys.push(key);
      }
    }
    return keys.sort();
  };

  const buildBackupPayload = () => {
    const storage = {};
    const keys = listDpcKeys();
    keys.forEach((key) => {
      const value = localStorage.getItem(key);
      if (value !== null) {
        storage[key] = value;
      }
    });
    return {
      app: "dpc",
      version: 2,
      exportedAt: new Date().toISOString(),
      keyCount: keys.length,
      storage
    };
  };

  const applyBackupPayload = (payload) => {
    if (!payload || typeof payload !== "object" || !payload.storage || typeof payload.storage !== "object") {
      throw new Error("Ungültiges Backup-Format");
    }
    if (payload.app && payload.app !== "dpc") {
      throw new Error("Falsche App-Backup-Datei");
    }

    const incomingEntries = Object.entries(payload.storage)
      .filter(([key]) => isBackupKey(String(key)))
      .map(([key, value]) => [String(key), typeof value === "string" ? value : JSON.stringify(value)]);
    if (incomingEntries.length === 0) {
      throw new Error("Backup enthält keine DPC-Daten");
    }

    const existingSnapshot = {};
    listDpcKeys().forEach((key) => {
      const value = localStorage.getItem(key);
      if (value !== null) {
        existingSnapshot[key] = value;
      }
    });

    try {
      listDpcKeys().forEach((key) => localStorage.removeItem(key));
      incomingEntries.forEach(([key, value]) => {
        localStorage.setItem(key, value);
      });
    } catch (error) {
      listDpcKeys().forEach((key) => localStorage.removeItem(key));
      Object.entries(existingSnapshot).forEach(([key, value]) => {
        localStorage.setItem(key, value);
      });
      throw error;
    }
  };

  if (exportLocalFileBtn) {
    exportLocalFileBtn.addEventListener("click", () => {
      try {
        const payload = buildBackupPayload();
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 16);
        const a = document.createElement("a");
        a.href = url;
        a.download = `dpc-backup-${stamp}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        setStatus("Lokale JSON-Datei gespeichert", false);
      } catch (error) {
        setStatus("Datei speichern fehlgeschlagen", true);
      }
    });
  }

  if (importLocalFileBtn && importFileInput) {
    importLocalFileBtn.addEventListener("click", () => {
      importFileInput.click();
    });

    importFileInput.addEventListener("change", async () => {
      const file = importFileInput.files && importFileInput.files[0];
      if (!file) {
        return;
      }

      try {
        const text = await file.text();
        const payload = JSON.parse(text);
        applyBackupPayload(payload);
        setStatus("Lokale JSON-Datei geladen", false);
        window.location.reload();
      } catch (error) {
        setStatus("Datei laden fehlgeschlagen", true);
      } finally {
        importFileInput.value = "";
      }
    });
  }

  const initSettingsPage = () => {
    const saveBtnLocal = document.getElementById("settingsSaveBtn");
    const loadBtnLocal = document.getElementById("settingsLoadBtn");
    const resetBtnLocal = document.getElementById("settingsResetBtn");
    const backBtnLocal = document.getElementById("settingsBackBtn");
    const statusEl = document.getElementById("settingsStatus");
    const btnFsEl = document.getElementById("setBtnFs");
    const dateFsEl = document.getElementById("setDateFs");
    const infoFsEl = document.getElementById("setInfoFs");
    const thFsEl = document.getElementById("setThFs");
    const tdFsEl = document.getElementById("setTdFs");
    const allowPastEditEl = document.getElementById("setAllowPastEdit");

    if (!btnFsEl || !dateFsEl || !infoFsEl || !thFsEl || !tdFsEl || !allowPastEditEl) {
      return;
    }

    const setStatusLocal = (text, isError) => {
      if (!statusEl) {
        return;
      }
      statusEl.textContent = text;
      statusEl.classList.toggle("error", Boolean(isError));
    };

    const fillSelect = (select, options) => {
      select.innerHTML = "";
      options.forEach((value) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = `${value}px`;
        select.appendChild(option);
      });
    };

    const pxOptions = Array.from({ length: 15 }, (_, i) => String(10 + i));
    const datePxOptions = Array.from({ length: 29 }, (_, i) => String(10 + (i * 0.5)));
    fillSelect(btnFsEl, pxOptions);
    fillSelect(dateFsEl, datePxOptions);
    fillSelect(infoFsEl, pxOptions);
    fillSelect(thFsEl, pxOptions);
    fillSelect(tdFsEl, pxOptions);
    allowPastEditEl.innerHTML = "";
    [
      { value: "0", label: "Nein" },
      { value: "1", label: "Ja" }
    ].forEach((item) => {
      const option = document.createElement("option");
      option.value = item.value;
      option.textContent = item.label;
      allowPastEditEl.appendChild(option);
    });

    const applyToForm = (settings) => {
      btnFsEl.value = String(settings.btnFs);
      dateFsEl.value = String(settings.dateFs);
      infoFsEl.value = String(settings.infoFs);
      thFsEl.value = String(settings.thFs);
      tdFsEl.value = String(settings.tdFs);
      allowPastEditEl.value = String(settings.allowPastEdit || "0");
    };

    const readFromForm = () => ({
      btnFs: btnFsEl.value,
      dateFs: dateFsEl.value,
      infoFs: infoFsEl.value,
      thFs: thFsEl.value,
      tdFs: tdFsEl.value,
      allowPastEdit: allowPastEditEl.value
    });

    const syncPreview = () => {
      applyUiSettings(readFromForm());
    };

    [btnFsEl, dateFsEl, infoFsEl, thFsEl, tdFsEl, allowPastEditEl].forEach((el) => {
      el.addEventListener("change", syncPreview);
    });

    applyToForm(uiSettings);
    syncPreview();

    if (saveBtnLocal) {
      saveBtnLocal.addEventListener("click", () => {
        try {
          const settings = readFromForm();
          saveUiSettings(settings);
          uiSettings = settings;
          applyUiSettings(settings);
          setStatusLocal("Einstellungen gespeichert", false);
        } catch (error) {
          setStatusLocal("Speichern fehlgeschlagen", true);
        }
      });
    }

    if (loadBtnLocal) {
      loadBtnLocal.addEventListener("click", () => {
        try {
          const settings = readUiSettings();
          uiSettings = settings;
          applyToForm(settings);
          applyUiSettings(settings);
          setStatusLocal("Einstellungen geladen", false);
        } catch (error) {
          setStatusLocal("Laden fehlgeschlagen", true);
        }
      });
    }

    if (resetBtnLocal) {
      resetBtnLocal.addEventListener("click", () => {
        try {
          applyToForm(defaultUiSettings);
          applyUiSettings(defaultUiSettings);
          saveUiSettings(defaultUiSettings);
          uiSettings = { ...defaultUiSettings };
          setStatusLocal("Auf Standard zurückgesetzt", false);
        } catch (error) {
          setStatusLocal("Reset fehlgeschlagen", true);
        }
      });
    }

    if (backBtnLocal) {
      backBtnLocal.addEventListener("click", () => {
        window.location.href = "index.html";
      });
    }
  };

  initSettingsPage();

  const setReadonlyForPastDays = () => {
    const isPastDay = selectedIso < todayIso && !canEditPastDays();

    getIstInputs().forEach((input) => {
      input.readOnly = isPastDay;
      input.classList.toggle("locked-field", isPastDay);
    });

    getChecks().forEach((check) => {
      check.disabled = isPastDay;
      check.classList.toggle("locked-field", isPastDay);
    });

    getRemarkInputs().forEach((input) => {
      input.readOnly = isPastDay;
      input.classList.toggle("locked-field", isPastDay);
    });

    notesCells.forEach((cell) => {
      cell.contentEditable = isPastDay ? "false" : "true";
      cell.classList.toggle("locked-field", isPastDay);
    });

    if (saveBtn) {
      saveBtn.disabled = isPastDay;
    }
    if (addWaRowBtn) {
      addWaRowBtn.disabled = isPastDay;
    }
    if (removeWaRowBtn) {
      const noRemovableRows = getWaDataRows().length <= 5;
      removeWaRowBtn.disabled = isPastDay || noRemovableRows;
    }
  };

  const getStorageKey = (iso) => `dpc:index:${iso}`;
  const defaultSnapshot = getSnapshot();

  const loadFromStorage = () => {
    const storageKey = getStorageKey(selectedIso);
    applySnapshot(defaultSnapshot);
    applyDateBasedDefaults(selectedIso, true);

    const raw = localStorage.getItem(storageKey);
    const selectedLabel = deDateFormatter.format(fromIsoLocal(selectedIso));
    if (raw) {
      applySnapshot(JSON.parse(raw));
      applyDateBasedDefaults(selectedIso, false);
      setStatus(`Daten von ${selectedLabel} geladen`, false);
      updateWeingInfo();
      return true;
    }
    setStatus(`Keine Daten für ${selectedLabel}`, true);
    updateWeingInfo();
    return false;
  };

  const minYear = 2026;
  const selectedDateInitial = fromIsoLocal(selectedIso);
  let selectedYear = Math.max(minYear, selectedDateInitial.getFullYear());
  const currentIsoWeek = getIsoWeekNumber(todayDate);
  let selectedWeek = getIsoWeekNumber(selectedDateInitial);

  const fillDaysForKw = (year, week) => {
    if (!daySelect) {
      return;
    }

    const weekDays = getWorkWeekByIso(year, week);
    daySelect.innerHTML = "";

    weekDays.forEach((date) => {
      const iso = toIsoLocal(date);
      const weekday = weekdayFormatter.format(date).replace(".", "");
      const label = `${weekday} ${deDateFormatter.format(date)}`;
      const option = document.createElement("option");
      option.value = iso;
      option.textContent = label;
      daySelect.appendChild(option);
    });

    const hasSelected = weekDays.some((d) => toIsoLocal(d) === selectedIso);
    const hasToday = weekDays.some((d) => toIsoLocal(d) === todayIso);
    if (hasSelected) {
      selectedIso = selectedIso;
    } else if (hasToday && year === todayDate.getFullYear()) {
      selectedIso = todayIso;
    } else {
      selectedIso = toIsoLocal(weekDays[0]);
    }
    daySelect.value = selectedIso;
  };

  const fillKwForYear = (year) => {
    if (!kwSelect) {
      return;
    }

    const weeksInYear = getIsoWeeksInYear(year);
    const todayYear = todayDate.getFullYear();
    const maxVisibleWeek = year < todayYear ? weeksInYear : (year === todayYear ? currentIsoWeek : 1);
    kwSelect.innerHTML = "";

    for (let week = 1; week <= maxVisibleWeek; week += 1) {
      const option = document.createElement("option");
      option.value = String(week);
      option.textContent = `KW ${String(week).padStart(2, "0")}`;
      kwSelect.appendChild(option);
    }

    if (selectedWeek > maxVisibleWeek) {
      selectedWeek = maxVisibleWeek;
    }
    if (selectedWeek < 1) {
      selectedWeek = 1;
    }

    kwSelect.value = String(selectedWeek);
    fillDaysForKw(year, selectedWeek);
  };

  const renderYear = () => {
    if (yearValue) {
      yearValue.textContent = String(selectedYear);
    }
    if (yearDownBtn) {
      yearDownBtn.disabled = selectedYear <= minYear;
    }
  };

  if (kwSelect) {
    if (selectedYear === todayDate.getFullYear()) {
      selectedWeek = currentIsoWeek;
    } else {
      selectedWeek = 1;
    }
    fillKwForYear(selectedYear);
  } else if (daySelect) {
    fillDaysForKw(selectedYear, selectedWeek);
  }

  renderYear();

  renderSelectedDate();
  initFooter();
  persistSelectedDate();
  setReadonlyForPastDays();

  try {
    loadFromStorage();
  } catch (error) {
    setStatus("Laden fehlgeschlagen", true);
  }

  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      try {
        const storageKey = getStorageKey(selectedIso);
        localStorage.setItem(storageKey, JSON.stringify(getSnapshot()));
        saveAutoWvorbeRows();
        setStatus(`Gespeichert (${deDateFormatter.format(fromIsoLocal(selectedIso))})`, false);
      } catch (error) {
        setStatus("Speichern fehlgeschlagen", true);
      }
    });
  }

  if (loadBtn) {
    loadBtn.addEventListener("click", () => {
      try {
        loadFromStorage();
      } catch (error) {
        setStatus("Laden fehlgeschlagen", true);
      }
    });
  }

  if (daySelect) {
    daySelect.addEventListener("change", () => {
      selectedIso = daySelect.value;
      renderSelectedDate();
      persistSelectedDate();
      setReadonlyForPastDays();
      try {
        loadFromStorage();
      } catch (error) {
        setStatus("Laden fehlgeschlagen", true);
      }
    });
  }

  if (kwSelect) {
    kwSelect.addEventListener("change", () => {
      const parsedWeek = Number.parseInt(kwSelect.value, 10);
      if (!Number.isFinite(parsedWeek) || parsedWeek < 1) {
        return;
      }

      selectedWeek = parsedWeek;
      fillDaysForKw(selectedYear, selectedWeek);
      renderSelectedDate();
      persistSelectedDate();
      setReadonlyForPastDays();
      try {
        loadFromStorage();
      } catch (error) {
        setStatus("Laden fehlgeschlagen", true);
      }
    });
  }

  if (yearDownBtn) {
    yearDownBtn.addEventListener("click", () => {
      if (selectedYear <= minYear) {
        return;
      }
      selectedYear -= 1;
      selectedWeek = 1;
      renderYear();
      fillKwForYear(selectedYear);
      renderSelectedDate();
      persistSelectedDate();
      setReadonlyForPastDays();
      try {
        loadFromStorage();
      } catch (error) {
        setStatus("Laden fehlgeschlagen", true);
      }
    });
  }

  if (yearUpBtn) {
    yearUpBtn.addEventListener("click", () => {
      selectedYear += 1;
      if (selectedYear === todayDate.getFullYear()) {
        selectedWeek = currentIsoWeek;
      } else {
        selectedWeek = 1;
      }
      renderYear();
      fillKwForYear(selectedYear);
      renderSelectedDate();
      persistSelectedDate();
      setReadonlyForPastDays();
      try {
        loadFromStorage();
      } catch (error) {
        setStatus("Laden fehlgeschlagen", true);
      }
    });
  }

  const initSimpleTablePage = (config) => {
    const table = document.getElementById(config.tableId);
    if (!table) {
      return;
    }

    const saveBtnLocal = document.getElementById(config.saveBtnId);
    const loadBtnLocal = document.getElementById(config.loadBtnId);
    const statusEl = document.getElementById(config.statusId);
    const addRowBtn = document.getElementById(config.addRowBtnId);
    const removeRowBtn = document.getElementById(config.removeRowBtnId);
    const backBtn = document.getElementById(config.backBtnId);
    const addRowLine = table.querySelector(".add-row-line");
    let hasUnsavedChanges = false;
    let selectedRow = null;
    const supportsRowSelection = Boolean(removeRowBtn);
    const columnDefs = Array.isArray(config.columnDefs) && config.columnDefs.length > 0
      ? config.columnDefs
      : ["text", "text", "text", "text", "text"];

    const setStatusLocal = (text, isError) => {
      if (!statusEl) {
        return;
      }
      statusEl.textContent = text;
      statusEl.classList.toggle("error", Boolean(isError));
    };

    const setDirty = (dirty) => {
      hasUnsavedChanges = dirty;
    };

    const laborMischprobeMaterials = new Set([
      "0.1-0.15",
      "0.25-0.50",
      "0.25-0.5",
      "0.5-1.0",
      "0.5-1",
      "14/28",
      "0.6-1",
      "0.6-1.0",
      "Q1",
      "F240",
      "F280",
      "NABALOX",
      "RHOSEAL",
      "RHOSEALHT",
      "LUDOX",
      "A800",
      "SF6000",
      "ZFG"
    ]);

    const laborProbeMaterials = new Set([
      "F240",
      "F280",
      "NABALOX",
      "Q1",
      "RHOSEAL",
      "RHOSEALHT",
      "SF6000",
      "AMOSILFW4",
      "COAL",
      "ZFG"
    ]);

    const keProbeMaterials = new Set([
      "0.1-0.15",
      "0.25-0.50",
      "0.25-0.5",
      "0.5-1.0",
      "0.5-1",
      "14/28",
      "0.6-1",
      "0.6-1.0"
    ]);

    const normalizeProbeMaterial = (value) => String(value || "")
      .toUpperCase()
      .replace(/,/g, ".")
      .replace(/\s+/g, "")
      .replace(/NO\./g, "NO")
      .replace(/[^A-Z0-9./-]/g, "");

    const normalizeToKey = (normalized) => {
      if (normalized.startsWith("NABALOX")) {
        return "NABALOX";
      }
      return normalized;
    };
    const parsePalletCount = (value) => {
      const raw = String(value || "").trim();
      if (!raw) {
        return 0;
      }
      const rangeMatch = raw.match(/^\s*(\d+)\s*-\s*(\d+)\s*$/);
      if (rangeMatch) {
        const start = Number.parseInt(rangeMatch[1], 10);
        const end = Number.parseInt(rangeMatch[2], 10);
        if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
          return (end - start) + 1;
        }
        return 0;
      }
      const singleMatch = raw.match(/^\s*(\d+)\s*$/);
      if (singleMatch) {
        const count = Number.parseInt(singleMatch[1], 10);
        return Number.isFinite(count) ? Math.max(0, count) : 0;
      }
      return 0;
    };

    const isInMaterialSet = (normalized, set) => {
      const key = normalizeToKey(normalized);
      return set.has(key);
    };
    const normalizeChargeToken = (value) => String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "");
    const hasPalletNoOne = (value) => {
      const numbers = String(value || "").match(/\d+/g) || [];
      return numbers.some((part) => Number.parseInt(part, 10) === 1);
    };
    const parseDeDateToIso = (value) => {
      const match = String(value || "").trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
      if (!match) {
        return "";
      }
      const [, dd, mm, yyyy] = match;
      return `${yyyy}-${mm}-${dd}`;
    };
    let knownChargesCacheIso = "";
    let knownChargesCache = new Set();

    const extractChargeFromRowValues = (rowValues) => {
      if (!Array.isArray(rowValues)) {
        return "";
      }
      if (rowValues.length >= 8) {
        return String(rowValues[5] || "");
      }
      if (rowValues.length >= 3) {
        return String(rowValues[2] || "");
      }
      return "";
    };

    const buildKnownChargesSet = () => {
      const known = new Set();
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith("dpc:weing:")) {
          continue;
        }
        const raw = localStorage.getItem(key);
        if (!raw) {
          continue;
        }
        try {
          const payload = JSON.parse(raw);
          const keyIso = key.replace("dpc:weing:", "");
          const payloadIso = parseDeDateToIso(payload?.date || "");
          const rowIso = keyIso || payloadIso;
          if (!rowIso || rowIso >= selectedIso) {
            continue;
          }
          const rows = Array.isArray(payload?.rows) ? payload.rows : [];
          rows.forEach((rowValues) => {
            const charge = normalizeChargeToken(extractChargeFromRowValues(rowValues));
            if (charge) {
              known.add(charge);
            }
          });
        } catch (error) {
          // ignore malformed keys
        }
      }

      try {
        const rawManual = localStorage.getItem("dpc:chargen:manual");
        if (rawManual) {
          const manualRows = JSON.parse(rawManual);
          if (Array.isArray(manualRows)) {
            manualRows.forEach((row) => {
              const charge = normalizeChargeToken(row?.charge || "");
              const iso = parseDeDateToIso(row?.date || "");
              if (!charge) {
                return;
              }
              if (iso && iso >= selectedIso) {
                return;
              }
              known.add(charge);
            });
          }
        }
      } catch (error) {
        // ignore malformed manual rows
      }

      return known;
    };

    const getKnownChargesSet = () => {
      if (knownChargesCacheIso !== selectedIso) {
        knownChargesCache = buildKnownChargesSet();
        knownChargesCacheIso = selectedIso;
      }
      return knownChargesCache;
    };

    const isDataRow = (row) => !!row && row.tagName === "TR" && !row.classList.contains("add-row-line");
    const refreshAllProbeRows = () => {
      if (config.storagePrefix !== "weing" || columnDefs.length !== 8) {
        return;
      }
      knownChargesCacheIso = "";
      const rows = table.querySelectorAll("tbody tr:not(.add-row-line)");
      rows.forEach((row) => updateProbeRowState(row));
    };

    const getCellTextValue = (cell) => {
      if (!cell) {
        return "";
      }
      const clone = cell.cloneNode(true);
      clone.querySelectorAll(".row-remove-inline").forEach((btn) => btn.remove());
      return clone.textContent || "";
    };

    const serializeRow = (row) => {
      const cells = Array.from(row.querySelectorAll("td"));
      if (columnDefs.length === 8 && cells.length === 5) {
        return ["0", "0", "0", ...cells.map((cell) => getCellTextValue(cell))];
      }
      return columnDefs.map((def, index) => {
        const cell = cells[index];
        if (!cell) {
          return "";
        }
        if (def === "check") {
          const input = cell.querySelector("input[type='checkbox']");
          return input && input.checked ? "1" : "0";
        }
        return getCellTextValue(cell);
      });
    };

    const initialRows = Array.from(table.querySelectorAll("tbody tr:not(.add-row-line)")).map((row) => serializeRow(row));

    const selectRow = (row) => {
      if (!supportsRowSelection) {
        return;
      }
      if (selectedRow && selectedRow !== row) {
        selectedRow.classList.remove("row-selected");
      }
      selectedRow = isDataRow(row) ? row : null;
      if (selectedRow) {
        selectedRow.classList.add("row-selected");
      }
      const isPastDay = selectedIso < todayIso && !canEditPastDays();
      if (removeRowBtn) {
        removeRowBtn.disabled = isPastDay || !selectedRow;
      }
    };

    const attachInlineRemoveButton = (row) => {
      if (!config.enableInlineRowRemove || !isDataRow(row)) {
        return;
      }
      const targetCell = row.querySelector("td:last-child");
      if (!targetCell || targetCell.querySelector(".row-remove-inline")) {
        return;
      }
      const inlineBtn = document.createElement("button");
      inlineBtn.type = "button";
      inlineBtn.className = "row-remove-inline";
      inlineBtn.textContent = "-";
      inlineBtn.title = "Zeile entfernen";
      inlineBtn.setAttribute("aria-label", "Diese Zeile entfernen");
      inlineBtn.contentEditable = "false";
      inlineBtn.addEventListener("mousedown", (event) => {
        event.preventDefault();
      });
      inlineBtn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        row.remove();
        setDirty(true);
        const nextRow = table.querySelector("tbody tr:not(.add-row-line)");
        selectRow(nextRow || null);
        setReadonlyLocal();
      });
      targetCell.appendChild(inlineBtn);
    };

    const bindRowInteractions = (row) => {
      if (!isDataRow(row)) {
        return;
      }
      if (row.dataset.rowBound === "1") {
        return;
      }
      row.dataset.rowBound = "1";
      attachInlineRemoveButton(row);
      row.addEventListener("click", (event) => {
        if (event.target instanceof HTMLElement && event.target.closest(".row-remove-inline")) {
          return;
        }
        selectRow(row);
      });
      refreshAllProbeRows();
    };

    const updateProbeRowState = (row) => {
      if (!isDataRow(row) || config.storagePrefix !== "weing" || columnDefs.length !== 8) {
        return;
      }
      const materialCell = row.querySelector("td:nth-child(5)");
      const chargeCell = row.querySelector("td:nth-child(6)");
      const palletCell = row.querySelector("td:nth-child(7)");
      const amountCell = row.querySelector("td:nth-child(8)");
      const materialValue = String(materialCell?.textContent || "").trim();
      const chargeValue = String(chargeCell?.textContent || "").trim();
      const palletValue = String(palletCell?.textContent || "").trim();
      const chargeToken = normalizeChargeToken(chargeValue);
      const normalizedMaterial = normalizeProbeMaterial(materialValue);
      const materialKey = normalizeToKey(normalizedMaterial);
      const isPastDay = selectedIso < todayIso && !canEditPastDays();
      const checks = row.querySelectorAll("td input.probe-check");
      const knownCharges = getKnownChargesSet();
      const rows = Array.from(table.querySelectorAll("tbody tr:not(.add-row-line)"));
      const isKnownCharge = chargeToken !== "" && knownCharges.has(chargeToken);

      const sameChargeRows = chargeToken === ""
        ? []
        : rows.filter((tableRow) => {
            const tableChargeCell = tableRow.querySelector("td:nth-child(6)");
            const tableToken = normalizeChargeToken(tableChargeCell?.textContent || "");
            return tableToken !== "" && tableToken === chargeToken;
          });

      const groupPal1MischChecked = sameChargeRows.some((tableRow) => {
        const tableMaterialCell = tableRow.querySelector("td:nth-child(5)");
        const tablePalletCell = tableRow.querySelector("td:nth-child(7)");
        const tableMaterial = String(tableMaterialCell?.textContent || "").trim();
        const tableNormalizedMaterial = normalizeProbeMaterial(tableMaterial);
        if (!tableMaterial || !isInMaterialSet(tableNormalizedMaterial, laborMischprobeMaterials)) {
          return false;
        }
        if (!hasPalletNoOne(String(tablePalletCell?.textContent || "").trim())) {
          return false;
        }
        const probeChecks = tableRow.querySelectorAll("td input.probe-check");
        const mischCheck = probeChecks[2];
        return Boolean(mischCheck && mischCheck.checked);
      });

      const laborRequired = materialValue !== "" && isInMaterialSet(normalizedMaterial, laborProbeMaterials);
      const keRequired = materialValue !== "" && isInMaterialSet(normalizedMaterial, keProbeMaterials);
      const isLudox = materialValue !== "" && materialKey === "LUDOX";
      if (amountCell && isLudox) {
        const palletCount = parsePalletCount(palletValue);
        amountCell.dataset.autoLudox = "1";
        amountCell.textContent = palletCount > 0 ? `${palletCount * 255} Kg` : "";
      } else if (amountCell && amountCell.dataset.autoLudox === "1") {
        amountCell.textContent = "";
        delete amountCell.dataset.autoLudox;
      }
      const mischRequired = materialValue !== ""
        && isInMaterialSet(normalizedMaterial, laborMischprobeMaterials)
        && (isLudox || (chargeToken !== "" && (!isKnownCharge || groupPal1MischChecked)));

      const requirements = [laborRequired, keRequired, mischRequired];
      const anyRequired = requirements.some(Boolean);

      checks.forEach((check, index) => {
        const required = requirements[index] || false;
        check.disabled = isPastDay || !required;
        if (!required) {
          check.checked = false;
        }
        check.style.visibility = required ? "visible" : "hidden";
      });

      if (chargeCell) {
        chargeCell.classList.toggle("charge-known", chargeToken !== "" && isKnownCharge);
        chargeCell.classList.toggle("charge-new", chargeToken !== "" && !isKnownCharge);
        if (chargeToken === "") {
          chargeCell.removeAttribute("title");
        } else {
          chargeCell.title = isKnownCharge ? "Charge bereits vorhanden" : "Neue Charge";
        }
      }

      row.classList.toggle("probe-not-required", !anyRequired);
      if (!anyRequired) {
        row.classList.remove("probe-done");
        row.classList.remove("probe-pending");
        return;
      }

      const done = requirements.every((required, index) => !required || (checks[index] && checks[index].checked));
      row.classList.toggle("probe-done", done);
      row.classList.toggle("probe-pending", !done);
    };

    const focusEditableCell = (cell) => {
      if (!cell || cell.getAttribute("contenteditable") !== "true") {
        return;
      }
      cell.focus();
      const selection = window.getSelection();
      if (!selection) {
        return;
      }
      const range = document.createRange();
      range.selectNodeContents(cell);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    };

    const createRow = (values, isAutoGenerated = false) => {
      const row = document.createElement("tr");
      if (isAutoGenerated) {
        row.dataset.autoGenerated = "1";
      }
      const normalizedValues = Array.isArray(values) ? values : [];
      for (let i = 0; i < columnDefs.length; i += 1) {
        const def = columnDefs[i];
        const td = document.createElement("td");
        const value = typeof normalizedValues[i] === "string" ? normalizedValues[i] : "";
        if (def === "check") {
          td.classList.add("probe-check-cell");
          td.contentEditable = "false";
          const check = document.createElement("input");
          check.type = "checkbox";
          check.className = "probe-check";
          check.checked = value === "1" || value.toLowerCase() === "true" || value.toLowerCase() === "x";
          td.appendChild(check);
        } else {
          td.textContent = value;
        }
        row.appendChild(td);
      }
      return row;
    };

    const setReadonlyLocal = () => {
      const isPastDay = selectedIso < todayIso && !canEditPastDays();
      const editableRows = table.querySelectorAll("tbody tr:not(.add-row-line)");
      editableRows.forEach((row) => {
        row.querySelectorAll("td").forEach((cell, index) => {
          const def = columnDefs[index] || "text";
          if (def === "check") {
            cell.contentEditable = "false";
            const check = cell.querySelector("input[type='checkbox']");
            if (check) {
              check.disabled = isPastDay;
              check.classList.toggle("locked-field", isPastDay);
            }
            cell.classList.toggle("locked-field", isPastDay);
            return;
          }
          cell.contentEditable = isPastDay ? "false" : "true";
          cell.classList.toggle("locked-field", isPastDay);
        });
      });
      refreshAllProbeRows();

      if (addRowBtn) {
        addRowBtn.disabled = isPastDay;
      }
      if (removeRowBtn) {
        removeRowBtn.disabled = isPastDay || !selectedRow;
      }
      if (config.enableInlineRowRemove) {
        const inlineButtons = table.querySelectorAll(".row-remove-inline");
        inlineButtons.forEach((btn) => {
          btn.disabled = isPastDay;
        });
      }
      if (saveBtnLocal) {
        saveBtnLocal.disabled = isPastDay;
      }
    };

    const applyRows = (rows, autoRows = []) => {
      const existingRows = Array.from(table.querySelectorAll("tbody tr:not(.add-row-line)"));
      existingRows.forEach((row) => row.remove());
      selectedRow = null;

      const hasManual = Array.isArray(rows) && rows.length > 0;
      const hasAuto = Array.isArray(autoRows) && autoRows.length > 0;
      const sourceRows = hasManual ? rows : (hasAuto ? [] : initialRows);
      sourceRows.forEach((values) => {
        const row = createRow(values, false);
        if (addRowLine && addRowLine.parentNode) {
          addRowLine.parentNode.insertBefore(row, addRowLine);
        }
        bindRowInteractions(row);
      });

      if (hasAuto) {
        autoRows.forEach((values) => {
          const row = createRow(values, true);
          if (addRowLine && addRowLine.parentNode) {
            addRowLine.parentNode.insertBefore(row, addRowLine);
          }
          bindRowInteractions(row);
        });
      }

      const firstRow = table.querySelector("tbody tr:not(.add-row-line)");
      selectRow(firstRow || null);
      setReadonlyLocal();
      refreshAllProbeRows();
    };

    const getRows = (excludeAutoGenerated) => {
      const rows = Array.from(table.querySelectorAll("tbody tr:not(.add-row-line)"));
      const filteredRows = excludeAutoGenerated
        ? rows.filter((row) => row.dataset.autoGenerated !== "1")
        : rows;
      return filteredRows.map((row) => serializeRow(row));
    };

    const normalizeRows = (rows) => {
      if (!Array.isArray(rows)) {
        return [];
      }
      const isCheckLike = (value) => {
        const v = String(value || "").trim().toLowerCase();
        return v === "" || v === "0" || v === "1" || v === "true" || v === "false" || v === "x";
      };

      const migrateWeingLegacyRow = (row) => {
        const cells = row.map((cell) => String(cell || ""));
        if (columnDefs.length !== 8) {
          return cells;
        }

        // Altformat vor Proben-Spalten: [Abt, Material, Charge, Pal, Menge]
        if (cells.length === 5) {
          return ["0", "0", "0", ...cells];
        }

        if (cells.length < 8) {
          return [...cells, ...Array.from({ length: 8 - cells.length }, () => "")];
        }

        // Bereits 8 Spalten, aber ggf. verschoben gespeichert (alte/beta Zwischenstände)
        const firstThreeAreChecks = isCheckLike(cells[0]) && isCheckLike(cells[1]) && isCheckLike(cells[2]);
        if (!firstThreeAreChecks) {
          // Nimm die ersten 5 fachlichen Felder und mappe sie auf Abt..Menge
          const business = cells.slice(0, 5);
          return ["0", "0", "0", ...business];
        }

        return cells.slice(0, 8);
      };

      return rows
        .filter((row) => Array.isArray(row))
        .map((row) => migrateWeingLegacyRow(row));
    };

    const sortRowsByDept = (rows) => {
      if (!Array.isArray(rows)) {
        return [];
      }
      return rows
        .map((row, index) => ({ row, index }))
        .sort((a, b) => {
          const deptA = String(a.row[0] || "").trim().toLowerCase();
          const deptB = String(b.row[0] || "").trim().toLowerCase();
          const aEmpty = deptA === "";
          const bEmpty = deptB === "";
          if (aEmpty && !bEmpty) {
            return 1;
          }
          if (!aEmpty && bEmpty) {
            return -1;
          }
          if (deptA < deptB) {
            return -1;
          }
          if (deptA > deptB) {
            return 1;
          }

          const materialA = String(a.row[1] || "").trim().toLowerCase();
          const materialB = String(b.row[1] || "").trim().toLowerCase();
          if (materialA < materialB) {
            return -1;
          }
          if (materialA > materialB) {
            return 1;
          }

          return a.index - b.index;
        })
        .map((item) => item.row);
    };

    const sortRowsByCharge = (rows) => {
      if (!Array.isArray(rows)) {
        return [];
      }
      return rows
        .map((row, index) => ({ row, index }))
        .sort((a, b) => {
          const chargeA = String(a.row[5] || "").trim();
          const chargeB = String(b.row[5] || "").trim();
          const aEmpty = chargeA === "";
          const bEmpty = chargeB === "";
          if (aEmpty && !bEmpty) {
            return 1;
          }
          if (!aEmpty && bEmpty) {
            return -1;
          }
          const numA = Number.parseFloat(chargeA.replace(",", "."));
          const numB = Number.parseFloat(chargeB.replace(",", "."));
          const aIsNum = Number.isFinite(numA) && String(numA) === chargeA.replace(",", ".");
          const bIsNum = Number.isFinite(numB) && String(numB) === chargeB.replace(",", ".");
          if (aIsNum && bIsNum) {
            if (numA < numB) return -1;
            if (numA > numB) return 1;
          } else {
            const cmp = chargeA.localeCompare(chargeB, "de");
            if (cmp !== 0) return cmp;
          }

          const palA = String(a.row[6] || "").trim();
          const palB = String(b.row[6] || "").trim();
          const palAEmpty = palA === "";
          const palBEmpty = palB === "";
          if (palAEmpty && !palBEmpty) return 1;
          if (!palAEmpty && palBEmpty) return -1;
          const palNumA = Number.parseFloat(palA.replace(",", "."));
          const palNumB = Number.parseFloat(palB.replace(",", "."));
          const palAIsNum = Number.isFinite(palNumA) && String(palNumA) === palA.replace(",", ".");
          const palBIsNum = Number.isFinite(palNumB) && String(palNumB) === palB.replace(",", ".");
          if (palAIsNum && palBIsNum) {
            if (palNumA < palNumB) return -1;
            if (palNumA > palNumB) return 1;
          } else {
            const palCmp = palA.localeCompare(palB, "de");
            if (palCmp !== 0) return palCmp;
          }
          return a.index - b.index;
        })
        .map((item) => item.row);
    };

    const getRowKey = (row) => {
      if (!Array.isArray(row)) {
        return "";
      }
      return row.map((cell) => String(cell || "").trim().toLowerCase()).join("|");
    };

    const getMaterialKey = (row) => {
      if (!Array.isArray(row)) {
        return "";
      }
      const abt = String(row[0] || "").trim().toLowerCase();
      const material = String(row[1] || "").trim().toLowerCase();
      if (!abt || !material) {
        return "";
      }
      return `${abt}|${material}`;
    };

    const getMaterialOnlyKey = (row) => {
      if (!Array.isArray(row)) {
        return "";
      }
      const material = String(row[1] || "").trim().toLowerCase();
      return material || "";
    };

    const getStorageKeyLocal = () => `dpc:${config.storagePrefix}:${selectedIso}`;
    const getAutoStorageKeyLocal = () => config.autoStoragePrefix ? `dpc:auto:${config.autoStoragePrefix}:${selectedIso}` : "";
    const syncSelectedDateLocal = () => {
      selectedIso = readSelectedDateFromState();
      renderSelectedDate();
    };

    const hasMeaningfulRows = (rows) => {
      if (!Array.isArray(rows)) {
        return false;
      }
      return rows.some((row) => Array.isArray(row) && row.some((cell) => String(cell || "").trim() !== ""));
    };

    const loadLocal = () => {
      syncSelectedDateLocal();
      const key = getStorageKeyLocal();
      const autoKey = getAutoStorageKeyLocal();
      const indexKey = `dpc:index:${selectedIso}`;
      const selectedLabel = deDateFormatter.format(fromIsoLocal(selectedIso));
      const raw = localStorage.getItem(key);
      let autoRows = null;
      if (autoKey) {
        const autoRaw = localStorage.getItem(autoKey);
        if (autoRaw) {
          const autoData = JSON.parse(autoRaw);
          autoRows = Array.isArray(autoData.rows) ? autoData.rows : [];
        }
      }

      if (config.storagePrefix === "wvorbe" && !hasMeaningfulRows(autoRows)) {
        const indexRaw = localStorage.getItem(indexKey);
        if (indexRaw) {
          const indexData = JSON.parse(indexRaw);
          const indexAutoRows = Array.isArray(indexData.autoWvorbeRows) ? indexData.autoWvorbeRows : [];
          if (hasMeaningfulRows(indexAutoRows)) {
            autoRows = indexAutoRows;
          }
        }
      }

      const normalizedAutoRows = normalizeRows(autoRows);

      if (raw) {
        const data = JSON.parse(raw);
        const manualRows = Array.isArray(data.rows) ? data.rows : [];
        const normalizedManualRows = normalizeRows(manualRows);
        if (hasMeaningfulRows(manualRows)) {
          if (config.storagePrefix === "wvorbe" && hasMeaningfulRows(normalizedAutoRows)) {
            const manualKeys = new Set(normalizedManualRows.map((row) => getRowKey(row)).filter((key) => key !== ""));
            const lockedMaterialKeys = new Set(
              normalizedManualRows
                .filter((row) => String(row[2] || "").trim() !== "" || String(row[3] || "").trim() !== "")
                .map((row) => getMaterialKey(row))
                .filter((key) => key !== "")
            );
            const manualMaterialOnlyKeys = new Set(
              normalizedManualRows
                .map((row) => getMaterialOnlyKey(row))
                .filter((key) => key !== "")
            );
            const filteredAutoRows = normalizedAutoRows.filter((row) => {
              const rowKey = getRowKey(row);
              const materialKey = getMaterialKey(row);
              const materialOnlyKey = getMaterialOnlyKey(row);
              if (manualKeys.has(rowKey)) {
                return false;
              }
              if (materialKey && lockedMaterialKeys.has(materialKey)) {
                return false;
              }
              if (materialOnlyKey && manualMaterialOnlyKeys.has(materialOnlyKey)) {
                return false;
              }
              return true;
            });
            const combinedRows = sortRowsByDept([...normalizedManualRows, ...filteredAutoRows]);
            applyRows(combinedRows);
            setStatusLocal(`Daten + Auto-Daten von ${selectedLabel} geladen`, false);
            return true;
          }
          const sortedManualRows = config.storagePrefix === "wvorbe"
            ? sortRowsByDept(normalizedManualRows)
            : (config.storagePrefix === "weing" ? sortRowsByCharge(normalizedManualRows) : normalizedManualRows);
          applyRows(sortedManualRows);
          setStatusLocal(`Daten von ${selectedLabel} geladen`, false);
          return true;
        }

        if (hasMeaningfulRows(normalizedAutoRows)) {
          const sortedAutoRows = config.storagePrefix === "wvorbe"
            ? sortRowsByDept(normalizedAutoRows)
            : (config.storagePrefix === "weing" ? sortRowsByCharge(normalizedAutoRows) : normalizedAutoRows);
          applyRows(sortedAutoRows);
          setStatusLocal(`Auto-Daten von ${selectedLabel} geladen`, false);
          return true;
        }
      }

      if (hasMeaningfulRows(normalizedAutoRows)) {
        const sortedAutoRows = config.storagePrefix === "wvorbe"
          ? sortRowsByDept(normalizedAutoRows)
          : (config.storagePrefix === "weing" ? sortRowsByCharge(normalizedAutoRows) : normalizedAutoRows);
        applyRows(sortedAutoRows);
        setStatusLocal(`Auto-Daten von ${selectedLabel} geladen`, false);
        return true;
      }

      applyRows([]);
      setStatusLocal(`Keine Daten für ${selectedLabel}`, true);
      return false;
    };

    const saveLocal = () => {
      syncSelectedDateLocal();
      const key = getStorageKeyLocal();
      const payload = {
        date: deDateFormatter.format(fromIsoLocal(selectedIso)),
        savedAt: new Date().toISOString(),
        rows: getRows(config.storagePrefix === "wvorbe")
      };
      localStorage.setItem(key, JSON.stringify(payload));
      setStatusLocal(`Gespeichert (${payload.date})`, false);
      setDirty(false);
    };

    applyRows(initialRows);
    try {
      loadLocal();
      setDirty(false);
    } catch (error) {
      setStatusLocal("Laden fehlgeschlagen", true);
    }

    if (addRowBtn) {
      addRowBtn.addEventListener("click", () => {
        const newRow = createRow([], false);
        if (addRowLine && addRowLine.parentNode) {
          addRowLine.parentNode.insertBefore(newRow, addRowLine);
          bindRowInteractions(newRow);
          selectRow(newRow);
          const isPastDay = selectedIso < todayIso && !canEditPastDays();
          newRow.querySelectorAll("td").forEach((cell) => {
            cell.contentEditable = isPastDay ? "false" : "true";
            cell.classList.toggle("locked-field", isPastDay);
          });
          const firstCell = newRow.querySelector("td");
          if (firstCell && !isPastDay) {
            firstCell.focus();
          }
        }
        setDirty(true);
        setReadonlyLocal();
      });
    }

    if (removeRowBtn) {
      removeRowBtn.addEventListener("click", () => {
        if (!selectedRow || !isDataRow(selectedRow)) {
          return;
        }
        const next = selectedRow.nextElementSibling && !selectedRow.nextElementSibling.classList.contains("add-row-line")
          ? selectedRow.nextElementSibling
          : selectedRow.previousElementSibling;
        selectedRow.remove();
        setDirty(true);
        selectRow(isDataRow(next) ? next : table.querySelector("tbody tr:not(.add-row-line)"));
        setReadonlyLocal();
      });
    }

    table.addEventListener("input", (event) => {
      if (event.target instanceof HTMLElement && event.target.closest("td[contenteditable='true']")) {
        const row = event.target.closest("tr");
        if (row && row.dataset.autoGenerated === "1") {
          delete row.dataset.autoGenerated;
        }
        if (row) {
          refreshAllProbeRows();
        }
        setDirty(true);
      }
    });

    table.addEventListener("change", (event) => {
      if (!(event.target instanceof HTMLInputElement)) {
        return;
      }
      if (event.target.type !== "checkbox") {
        return;
      }
      const row = event.target.closest("tr");
      if (row && row.dataset.autoGenerated === "1") {
        delete row.dataset.autoGenerated;
      }
      if (row) {
        refreshAllProbeRows();
      }
      setDirty(true);
    });

    table.addEventListener("click", (event) => {
      if (!(event.target instanceof HTMLElement)) {
        return;
      }
      if (event.target.closest(".row-remove-inline")) {
        return;
      }
      const cell = event.target.closest("td[contenteditable='true']");
      if (!cell) {
        return;
      }
      focusEditableCell(cell);
    });

    if (saveBtnLocal) {
      saveBtnLocal.addEventListener("click", () => {
        try {
          saveLocal();
        } catch (error) {
          setStatusLocal("Speichern fehlgeschlagen", true);
        }
      });
    }

    if (loadBtnLocal) {
      loadBtnLocal.addEventListener("click", () => {
        try {
          loadLocal();
          setDirty(false);
        } catch (error) {
          setStatusLocal("Laden fehlgeschlagen", true);
        }
      });
    }

    const tryLeavePage = () => {
      window.location.href = "index.html";
    };

    if (backBtn) {
      backBtn.addEventListener("click", () => {
        syncSelectedDateLocal();
        if (!hasUnsavedChanges) {
          tryLeavePage();
          return;
        }

        const saveNow = window.confirm("Ungespeicherte Änderungen gefunden. Jetzt speichern?");
        if (saveNow) {
          try {
            saveLocal();
            tryLeavePage();
          } catch (error) {
            setStatusLocal("Speichern fehlgeschlagen", true);
          }
          return;
        }

        const leaveWithoutSave = window.confirm("Ohne Speichern zurück zur Startseite?");
        if (leaveWithoutSave) {
          tryLeavePage();
        }
      });
    }

    window.addEventListener("beforeunload", (event) => {
      if (!hasUnsavedChanges) {
        return;
      }
      event.preventDefault();
      event.returnValue = "";
    });

    window.addEventListener("storage", (event) => {
      if (event.key !== selectedDateStateKey) {
        return;
      }
      try {
        loadLocal();
      } catch (error) {
        setStatusLocal("Laden fehlgeschlagen", true);
      }
    });
  };

  initSimpleTablePage({
    tableId: "wvorbeTable",
    saveBtnId: "wvorbeSaveBtn",
    loadBtnId: "wvorbeLoadBtn",
    statusId: "wvorbeStatus",
    addRowBtnId: "addWvorbeRowBtn",
    removeRowBtnId: "removeWvorbeRowBtn",
    enableInlineRowRemove: false,
    backBtnId: "wvorbeBackBtn",
    storagePrefix: "wvorbe",
    autoStoragePrefix: "wvorbe"
  });

  initSimpleTablePage({
    tableId: "weingTable",
    saveBtnId: "weingSaveBtn",
    loadBtnId: "weingLoadBtn",
    statusId: "weingStatus",
    addRowBtnId: "addWeingRowBtn",
    removeRowBtnId: "removeWeingRowBtn",
    enableInlineRowRemove: false,
    backBtnId: "weingBackBtn",
    storagePrefix: "weing",
    columnDefs: ["check", "check", "check", "text", "text", "text", "text", "text"]
  });

  const initWeingBackLink = () => {
    const weingBackBtn = document.getElementById("weingBackBtn");
    const weingDataBackBtn = document.getElementById("weingDataBackBtn");
    if (!weingBackBtn || !weingDataBackBtn) {
      return;
    }
    const returnFlag = localStorage.getItem("dpc:weing:returnToPreview") === "1";
    if (returnFlag) {
      weingBackBtn.hidden = true;
      weingDataBackBtn.hidden = false;
      weingDataBackBtn.addEventListener("click", () => {
        const iso = localStorage.getItem("dpc:weing:returnToPreviewDate") || "";
        localStorage.setItem(selectedDateStateKey, iso);
        localStorage.removeItem("dpc:weing:returnToPreview");
        window.location.href = "weingData.html";
      });
    } else {
      weingBackBtn.hidden = false;
      weingDataBackBtn.hidden = true;
    }
  };

  initWeingBackLink();

  const initWeingDataPage = () => {
    const kwSelect = document.getElementById("weingDataKwSelect");
    const daysBody = document.getElementById("weingDataDaysBody");
    const previewBody = document.getElementById("weingDataPreviewBody");
    const backBtn = document.getElementById("weingDataBackBtn");
    const openWeingLink = document.getElementById("weingDataOpenWeing");
    const kwTitle = document.getElementById("weingDataKwTitle");
    if (!kwSelect || !daysBody || !previewBody) {
      return;
    }

    const currentWeek = getIsoWeekNumber(todayDate);
    const currentYear = todayDate.getFullYear();
    const maxWeek = Math.min(getIsoWeeksInYear(currentYear), currentWeek);

    kwSelect.innerHTML = "";
    for (let week = 1; week <= maxWeek; week += 1) {
      const option = document.createElement("option");
      option.value = String(week);
      option.textContent = `KW ${String(week).padStart(2, "0")}`;
      kwSelect.appendChild(option);
    }
    kwSelect.value = String(currentWeek);

    const normalizeWeingRow = (row) => {
      if (!Array.isArray(row)) {
        return null;
      }
      if (row.length >= 8) {
        return row.slice(3, 8).map((cell) => String(cell || ""));
      }
      if (row.length === 5) {
        return row.map((cell) => String(cell || ""));
      }
      if (row.length < 5) {
        return [...row.map((cell) => String(cell || "")), ...Array.from({ length: 5 - row.length }, () => "")];
      }
      return row.slice(0, 5).map((cell) => String(cell || ""));
    };

    const getMeaningfulWeingRows = (rows) => {
      if (!Array.isArray(rows)) {
        return [];
      }
      return rows
        .map(normalizeWeingRow)
        .filter(Boolean)
        .filter((row) => row.some((cell) => String(cell || "").trim() !== ""));
    };

    const getWeingRowsForIso = (isoDate) => {
      const key = `dpc:weing:${isoDate}`;
      const raw = localStorage.getItem(key);
      try {
        if (raw) {
          const data = JSON.parse(raw);
          return getMeaningfulWeingRows(Array.isArray(data.rows) ? data.rows : []);
        }

        const parseDeToIso = (value) => {
          const match = String(value || "").trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
          if (!match) {
            return null;
          }
          const [, dd, mm, yyyy] = match;
          return `${yyyy}-${mm}-${dd}`;
        };

        for (let i = 0; i < localStorage.length; i += 1) {
          const storageKey = localStorage.key(i);
          if (!storageKey || !storageKey.startsWith("dpc:weing:")) {
            continue;
          }
          const value = localStorage.getItem(storageKey);
          if (!value) {
            continue;
          }
          const data = JSON.parse(value);
          const payloadIso = parseDeToIso(data?.date);
          if (payloadIso === isoDate) {
            return getMeaningfulWeingRows(Array.isArray(data.rows) ? data.rows : []);
          }
        }
        return [];
      } catch (error) {
        return [];
      }
    };

    const renderPreview = (isoDate) => {
      previewBody.innerHTML = "";
      const rows = getWeingRowsForIso(isoDate);
      if (openWeingLink) {
        openWeingLink.setAttribute("aria-disabled", rows.length === 0 ? "true" : "false");
        openWeingLink.classList.toggle("disabled", rows.length === 0);
        openWeingLink.onclick = rows.length === 0
          ? (event) => event.preventDefault()
          : () => {
            localStorage.setItem(selectedDateStateKey, isoDate);
            localStorage.setItem("dpc:weing:returnToPreview", "1");
            localStorage.setItem("dpc:weing:returnToPreviewDate", isoDate);
          };
      }
      if (rows.length === 0) {
        const tr = document.createElement("tr");
        tr.innerHTML = "<td class=\"weing-data-note\" colspan=\"5\">Keine Daten vorhanden</td>";
        previewBody.appendChild(tr);
        return;
      }
      rows.slice(0, 10).forEach((row) => {
        const tr = document.createElement("tr");
        tr.innerHTML = row.map((cell) => `<td>${cell}</td>`).join("");
        previewBody.appendChild(tr);
      });
      if (rows.length > 10) {
        const tr = document.createElement("tr");
        tr.innerHTML = "<td class=\"weing-data-note\" colspan=\"5\">Mehrere Eingänge vorhanden ...</td>";
        previewBody.appendChild(tr);
      }
    };

    const renderDays = (week) => {
      if (kwTitle) {
        kwTitle.textContent = `Kalenderwoche (${String(week).padStart(2, "0")})`;
      }
      daysBody.innerHTML = "";
      const days = getWorkWeekByIso(currentYear, week);
      const weekdays = ["Mo", "Di", "Mi", "Do", "Fr"];
      let firstWithData = null;
      days.forEach((date, index) => {
        const iso = toIsoLocal(date);
        const tr = document.createElement("tr");
        tr.className = "weing-data-day";
        tr.dataset.iso = iso;
        tr.innerHTML = `<td>${weekdays[index]} ${deDateFormatter.format(date)}</td>`;
        const hasData = getWeingRowsForIso(iso).length > 0;
        tr.classList.toggle("has-data", hasData);
        if (hasData && !firstWithData) {
          firstWithData = tr;
        }
        tr.addEventListener("click", () => {
          Array.from(daysBody.querySelectorAll("tr")).forEach((row) => row.classList.remove("active"));
          tr.classList.add("active");
          renderPreview(iso);
        });
        daysBody.appendChild(tr);
      });
      const initial = firstWithData || daysBody.querySelector("tr");
      if (initial) {
        initial.classList.add("active");
        renderPreview(initial.dataset.iso || toIsoLocal(days[0]));
      }
    };

    kwSelect.addEventListener("change", () => {
      const week = Number.parseInt(kwSelect.value, 10);
      if (!Number.isFinite(week)) {
        return;
      }
      renderDays(week);
    });

    if (backBtn) {
      backBtn.addEventListener("click", () => {
        window.location.href = "index.html";
      });
    }

    renderDays(currentWeek);
  };

  initWeingDataPage();

  const initChargenDataPage = () => {
    const tableBody = document.getElementById("chargeTableBody");
    const backBtn = document.getElementById("chargenBackBtn");
    const addBtn = document.getElementById("chargenAddBtn");
    const removeBtn = document.getElementById("chargenRemoveBtn");
    const searchInput = document.getElementById("chargeSearch");
    if (!tableBody) {
      return;
    }

    const normalizeWeingRow = (row) => {
      if (!Array.isArray(row)) {
        return null;
      }
      if (row.length >= 8) {
        return row.slice(3, 8).map((cell) => String(cell || ""));
      }
      if (row.length === 5) {
        return row.map((cell) => String(cell || ""));
      }
      if (row.length < 5) {
        return [...row.map((cell) => String(cell || "")), ...Array.from({ length: 5 - row.length }, () => "")];
      }
      return row.slice(0, 5).map((cell) => String(cell || ""));
    };

    const parseDeToIso = (value) => {
      const match = String(value || "").trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
      if (!match) {
        return "";
      }
      const [, dd, mm, yyyy] = match;
      return `${yyyy}-${mm}-${dd}`;
    };

    const parseChargeNumber = (value) => {
      const cleaned = String(value || "").trim();
      const num = Number.parseFloat(cleaned.replace(",", "."));
      return Number.isFinite(num) ? num : null;
    };

    const normalizeChargeKey = (value) => String(value || "").trim().toLowerCase().replace(/\s+/g, "");
    const rowsByCharge = new Map();

    for (let i = 0; i < localStorage.length; i += 1) {
      const storageKey = localStorage.key(i);
      if (!storageKey || !storageKey.startsWith("dpc:weing:")) {
        continue;
      }
      const raw = localStorage.getItem(storageKey);
      if (!raw) {
        continue;
      }
      try {
        const data = JSON.parse(raw);
        const dateLabel = data && typeof data.date === "string" ? data.date : "";
        const isoDate = parseDeToIso(dateLabel) || storageKey.replace("dpc:weing:", "");
        const rows = Array.isArray(data?.rows) ? data.rows : [];
        rows.forEach((row) => {
          const normalized = normalizeWeingRow(row);
          if (!normalized) {
            return;
          }
          const [abt, material, charge] = normalized;
          const rawCharge = String(charge || "").trim();
          const chargeKey = normalizeChargeKey(rawCharge);
          if (!chargeKey) {
            return;
          }
          if (rowsByCharge.has(chargeKey)) {
            return;
          }
          rowsByCharge.set(chargeKey, {
            charge: rawCharge,
            material: String(material || "").trim(),
            date: isoDate ? deDateFormatter.format(fromIsoLocal(isoDate)) : dateLabel
          });
        });
      } catch (error) {
        // ignore malformed entries
      }
    }

    const entries = Array.from(rowsByCharge.values());
    entries.sort((a, b) => {
      const numA = parseChargeNumber(a.charge);
      const numB = parseChargeNumber(b.charge);
      if (numA !== null && numB !== null && numA !== numB) {
        return numA - numB;
      }
      return a.charge.localeCompare(b.charge, "de");
    });

    const manualKey = "dpc:chargen:manual";
    const loadManual = () => {
      try {
        const raw = localStorage.getItem(manualKey);
        if (!raw) {
          return [];
        }
        const data = JSON.parse(raw);
        return Array.isArray(data)
          ? data.map((row) => ({ ...row, _manual: true }))
          : [];
      } catch (error) {
        return [];
      }
    };
    const saveManual = (rows) => {
      try {
        localStorage.setItem(manualKey, JSON.stringify(rows));
      } catch (error) {
        // ignore
      }
    };

    const manualRows = loadManual();
    const manualByCharge = new Map();
    const manualWithoutCharge = [];
    manualRows.forEach((row) => {
      const chargeRaw = String(row?.charge || "").trim();
      const key = normalizeChargeKey(chargeRaw);
      if (!key) {
        manualWithoutCharge.push(row);
        return;
      }
      if (!manualByCharge.has(key)) {
        manualByCharge.set(key, row);
      }
    });

    const dateSortable = (value) => {
      const iso = parseDeToIso(value);
      return iso || "";
    };
    const sortByMaterial = (a, b) => {
      const ma = String(a?.material || "").trim().toLowerCase();
      const mb = String(b?.material || "").trim().toLowerCase();
      if (ma !== mb) {
        return ma.localeCompare(mb, "de");
      }
      const da = dateSortable(a?.date || "");
      const db = dateSortable(b?.date || "");
      if (da && db && da !== db) {
        return da.localeCompare(db);
      }
      if (da && !db) return -1;
      if (!da && db) return 1;
      return String(a?.charge || "").localeCompare(String(b?.charge || ""), "de");
    };

    const entriesFiltered = entries
      .filter((entry) => !manualByCharge.has(normalizeChargeKey(entry.charge)));
    const manualEntries = [...manualByCharge.values(), ...manualWithoutCharge];

    entriesFiltered.sort(sortByMaterial);
    manualEntries.sort(sortByMaterial);

    const rebuildManual = () => {
      manualByCharge.clear();
      manualWithoutCharge.length = 0;
      manualRows.forEach((row) => {
        const chargeRaw = String(row?.charge || "").trim();
        const key = normalizeChargeKey(chargeRaw);
        if (!key) {
          manualWithoutCharge.push(row);
          return;
        }
        if (!manualByCharge.has(key)) {
          manualByCharge.set(key, row);
        }
      });
      manualEntries.length = 0;
      manualEntries.push(...manualByCharge.values(), ...manualWithoutCharge);
    };

    const renderRows = (filterValue) => {
      const q = String(filterValue || "").trim().toLowerCase();
      const sourceRows = [...manualEntries, ...entriesFiltered].sort(sortByMaterial);
      const filtered = q
        ? sourceRows.filter((entry) => {
            const combined = `${entry.charge} ${entry.material} ${entry.date}`.toLowerCase();
            return combined.includes(q);
          })
        : sourceRows;

      tableBody.innerHTML = "";
      if (filtered.length === 0) {
        const tr = document.createElement("tr");
        tr.innerHTML = "<td class=\"weing-data-note\" colspan=\"3\">Keine Chargen vorhanden</td>";
        tableBody.appendChild(tr);
        return;
      }
      filtered.forEach((entry) => {
        const tr = document.createElement("tr");
        const isManual = entry && entry._manual === true;
        tr.dataset.source = isManual ? "manual" : "auto";
        tr.dataset.id = String(entry?.id || "");
        if (isManual) {
          tr.innerHTML = `<td contenteditable="true">${entry.charge || ""}</td><td contenteditable="true">${entry.material || ""}</td><td contenteditable="true">${entry.date || ""}</td>`;
        } else {
          tr.innerHTML = `<td>${entry.charge}</td><td>${entry.material}</td><td>${entry.date}</td>`;
        }
        tr.addEventListener("click", () => {
          Array.from(tableBody.querySelectorAll("tr")).forEach((row) => row.classList.remove("row-selected"));
          tr.classList.add("row-selected");
        });
        if (isManual) {
          tr.querySelectorAll("td[contenteditable='true']").forEach(() => {
            tr.addEventListener("input", () => {
              const id = tr.dataset.id;
              const updated = manualRows.map((row) => {
                if (String(row.id) !== String(id)) {
                  return row;
                }
                const [c1, c2, c3] = tr.querySelectorAll("td");
                return {
                  ...row,
                  charge: c1?.textContent?.trim() || "",
                  material: c2?.textContent?.trim() || "",
                  date: c3?.textContent?.trim() || ""
                };
              });
              saveManual(updated);
            });
          });
        }
        tableBody.appendChild(tr);
      });
    };

    renderRows("");

    if (searchInput) {
      searchInput.addEventListener("input", () => {
        renderRows(searchInput.value);
      });
    }

    if (addBtn) {
      addBtn.addEventListener("click", () => {
        const id = `m-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const newRow = { id, charge: "", material: "", date: "", _manual: true };
        manualRows.push(newRow);
        saveManual(manualRows);
        rebuildManual();
        renderRows(searchInput ? searchInput.value : "");
        const rowEl = tableBody.querySelector(`tr[data-id="${id}"]`);
        if (rowEl) {
          Array.from(tableBody.querySelectorAll("tr")).forEach((row) => row.classList.remove("row-selected"));
          rowEl.classList.add("row-selected");
          const firstCell = rowEl.querySelector("td[contenteditable='true']");
          if (firstCell) {
            firstCell.focus();
          }
        }
      });
    }

    if (removeBtn) {
      removeBtn.addEventListener("click", () => {
        const selected = tableBody.querySelector("tr.row-selected");
        if (!selected) {
          return;
        }
        if (selected.dataset.source !== "manual") {
          alert("Nur manuell hinzugefügte Chargen können entfernt werden.");
          return;
        }
        const id = selected.dataset.id;
        const filtered = manualRows.filter((row) => String(row.id) !== String(id));
        manualRows.length = 0;
        manualRows.push(...filtered);
        saveManual(manualRows);
        rebuildManual();
        renderRows(searchInput ? searchInput.value : "");
      });
    }

    if (backBtn) {
      backBtn.addEventListener("click", () => {
        window.location.href = "index.html";
      });
    }
  };

  initChargenDataPage();
});

function printWvorbe() {
    window.print();
}
