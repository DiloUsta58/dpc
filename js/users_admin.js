(function () {
  const cfg = window.AUTH_CONFIG || {};
  const sessionKey = cfg.sessionKey || "dpc:auth:ok";
  const roleKey = cfg.roleKey || "dpc:auth:role";
  const localUsersKey = cfg.localUsersKey || "dpc:auth:users";
  const roleOverridesKey = cfg.roleOverridesKey || "dpc:auth:roleOverrides";
  const disabledUsersKey = cfg.disabledUsersKey || "dpc:auth:disabledUsers";
  const staticUsers = Array.isArray(cfg.users) ? cfg.users : [];

  const body = document.getElementById("usersAdminBody");
  const backBtn = document.getElementById("usersAdminBackBtn");
  const reloadBtn = document.getElementById("usersAdminReloadBtn");
  const resetBtn = document.getElementById("usersAdminResetBtn");
  const statusEl = document.getElementById("usersAdminStatus");
  const dateTargets = document.querySelectorAll(".current-date");
  const deDateFormatter = new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });

  const setStatus = (text, type) => {
    if (!statusEl) {
      return;
    }
    statusEl.textContent = text;
    statusEl.classList.remove("ok", "error");
    if (type) {
      statusEl.classList.add(type);
    }
  };

  const normalizeHash = (value) => String(value || "").trim().toLowerCase();

  const readJson = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) {
        return fallback;
      }
      const parsed = JSON.parse(raw);
      return parsed;
    } catch (error) {
      return fallback;
    }
  };

  const writeJson = (key, value) => {
    localStorage.setItem(key, JSON.stringify(value));
  };

  const isAdmin = () => {
    try {
      return sessionStorage.getItem(sessionKey) === "1"
        && String(sessionStorage.getItem(roleKey) || "").toLowerCase() === "admin";
    } catch (error) {
      return false;
    }
  };

  if (!isAdmin()) {
    window.location.href = "index.html";
    return;
  }

  dateTargets.forEach((el) => {
    el.textContent = deDateFormatter.format(new Date());
  });

  const getLocalUsers = () => {
    const users = readJson(localUsersKey, []);
    return Array.isArray(users) ? users : [];
  };

  const getRoleOverrides = () => {
    const overrides = readJson(roleOverridesKey, {});
    return overrides && typeof overrides === "object" ? overrides : {};
  };

  const getDisabledUsers = () => {
    const list = readJson(disabledUsersKey, []);
    return Array.isArray(list) ? list : [];
  };

  const setRoleForUser = (entry, nextRole) => {
    const role = nextRole === "Admin" ? "Admin" : "User";
    const hash = normalizeHash(entry.usernameHash);
    if (entry.source === "local") {
      const localUsers = getLocalUsers().map((item) => {
        if (normalizeHash(item.usernameHash) !== hash) {
          return item;
        }
        return { ...item, role };
      });
      writeJson(localUsersKey, localUsers);
      const overrides = getRoleOverrides();
      delete overrides[hash];
      writeJson(roleOverridesKey, overrides);
    } else {
      const overrides = getRoleOverrides();
      overrides[hash] = role;
      writeJson(roleOverridesKey, overrides);
    }
  };

  const setDisabledForUser = (entry, disabled) => {
    const hash = normalizeHash(entry.usernameHash);
    const disabledList = new Set(getDisabledUsers().map((item) => normalizeHash(item)));
    if (disabled) {
      disabledList.add(hash);
    } else {
      disabledList.delete(hash);
    }
    writeJson(disabledUsersKey, Array.from(disabledList));
  };

  const deleteUser = (entry) => {
    const hash = normalizeHash(entry.usernameHash);
    if (entry.source === "local") {
      const nextLocal = getLocalUsers().filter((item) => normalizeHash(item.usernameHash) !== hash);
      writeJson(localUsersKey, nextLocal);
      const overrides = getRoleOverrides();
      delete overrides[hash];
      writeJson(roleOverridesKey, overrides);
      const disabledList = getDisabledUsers().filter((item) => normalizeHash(item) !== hash);
      writeJson(disabledUsersKey, disabledList);
      return;
    }
    setDisabledForUser(entry, true);
  };

  const buildRows = () => {
    const localUsers = getLocalUsers();
    const overrides = getRoleOverrides();
    const disabledUsers = new Set(getDisabledUsers().map((item) => normalizeHash(item)));

    const staticRows = staticUsers.map((entry) => {
      const hash = normalizeHash(entry.usernameHash);
      const overriddenRole = overrides[hash];
      return {
        source: "config",
        usernameHash: hash,
        role: overriddenRole === "Admin" || overriddenRole === "User" ? overriddenRole : (entry.role || "User"),
        active: !disabledUsers.has(hash)
      };
    });

    const localRows = localUsers.map((entry) => {
      const hash = normalizeHash(entry.usernameHash);
      return {
        source: "local",
        usernameHash: hash,
        role: entry.role === "Admin" ? "Admin" : "User",
        active: !disabledUsers.has(hash)
      };
    });

    const merged = [...staticRows, ...localRows];
    merged.sort((a, b) => a.usernameHash.localeCompare(b.usernameHash, "de"));
    return merged;
  };

  const render = () => {
    if (!body) {
      return;
    }
    const rows = buildRows();
    body.innerHTML = "";

    if (rows.length === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML = "<td colspan=\"5\">Keine Benutzer gefunden.</td>";
      body.appendChild(tr);
      return;
    }

    rows.forEach((entry) => {
      const tr = document.createElement("tr");
      const sourceLabel = entry.source === "local" ? "Lokal" : "Config";
      const hashShort = `${entry.usernameHash.slice(0, 16)}...`;
      tr.innerHTML = `
        <td>${sourceLabel}</td>
        <td title="${entry.usernameHash}">${hashShort}</td>
        <td></td>
        <td></td>
        <td></td>
      `;

      const roleTd = tr.children[2];
      const activeTd = tr.children[3];
      const actionTd = tr.children[4];

      const roleSelect = document.createElement("select");
      ["User", "Admin"].forEach((role) => {
        const option = document.createElement("option");
        option.value = role;
        option.textContent = role;
        roleSelect.appendChild(option);
      });
      roleSelect.value = entry.role;
      roleSelect.addEventListener("change", () => {
        setRoleForUser(entry, roleSelect.value);
        setStatus("Rolle gespeichert.", "ok");
        render();
      });
      roleTd.appendChild(roleSelect);

      const activeCheck = document.createElement("input");
      activeCheck.type = "checkbox";
      activeCheck.checked = entry.active;
      activeCheck.addEventListener("change", () => {
        setDisabledForUser(entry, !activeCheck.checked);
        setStatus("Aktiv-Status gespeichert.", "ok");
        render();
      });
      activeTd.appendChild(activeCheck);

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.textContent = "Löschen";
      deleteBtn.className = "menu-item";
      deleteBtn.style.padding = "4px 10px";
      deleteBtn.style.border = "1px solid #3a3a3a";
      deleteBtn.style.borderRadius = "8px";
      deleteBtn.style.background = "#313131";
      deleteBtn.style.color = "#f5f5f5";
      deleteBtn.addEventListener("click", () => {
        deleteUser(entry);
        setStatus("Benutzer entfernt/deaktiviert.", "ok");
        render();
      });
      actionTd.appendChild(deleteBtn);

      body.appendChild(tr);
    });
  };

  if (backBtn) {
    backBtn.addEventListener("click", () => {
      window.location.href = "aufg.html";
    });
  }
  if (reloadBtn) {
    reloadBtn.addEventListener("click", () => {
      render();
      setStatus("Neu geladen.", "ok");
    });
  }
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      localStorage.removeItem(roleOverridesKey);
      localStorage.removeItem(disabledUsersKey);
      render();
      setStatus("Overrides zurückgesetzt.", "ok");
    });
  }

  render();
})();
