(function () {
  const cfg = window.AUTH_CONFIG || {};
  const sessionKey = cfg.sessionKey || "dpc:auth:ok";
  const roleKey = cfg.roleKey || "dpc:auth:role";
  const localUsersKey = cfg.localUsersKey || "dpc:auth:users";
  const roleOverridesKey = cfg.roleOverridesKey || "dpc:auth:roleOverrides";
  const disabledUsersKey = cfg.disabledUsersKey || "dpc:auth:disabledUsers";
  const redirectOnSuccess = cfg.redirectOnSuccess || "aufg.html";
  const users = Array.isArray(cfg.users) ? cfg.users : [];

  const toHex = (buffer) => Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const sha256 = async (value) => {
    const data = new TextEncoder().encode(String(value || ""));
    const digest = await crypto.subtle.digest("SHA-256", data);
    return toHex(digest);
  };

  const normalizeHash = (value) => String(value || "").trim().toLowerCase();
  const loadLocalUsers = () => {
    try {
      const raw = localStorage.getItem(localUsersKey);
      if (!raw) {
        return [];
      }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed.filter((entry) => entry && typeof entry === "object");
    } catch (error) {
      return [];
    }
  };
  const loadRoleOverrides = () => {
    try {
      const raw = localStorage.getItem(roleOverridesKey);
      if (!raw) {
        return {};
      }
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (error) {
      return {};
    }
  };
  const loadDisabledUsers = () => {
    try {
      const raw = localStorage.getItem(disabledUsersKey);
      if (!raw) {
        return [];
      }
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  };

  const isAuthenticated = () => sessionStorage.getItem(sessionKey) === "1";
  const setAuthenticated = (role) => {
    sessionStorage.setItem(sessionKey, "1");
    sessionStorage.setItem(roleKey, String(role || "Admin"));
  };

  // Helper for admins/devs to generate hashes quickly in browser console.
  window.AuthTools = {
    sha256
  };

  const form = document.getElementById("loginForm");
  const userInput = document.getElementById("loginUser");
  const passInput = document.getElementById("loginPassword");
  const msg = document.getElementById("loginMsg");

  if (!form || !userInput || !passInput || !msg) {
    return;
  }

  if (isAuthenticated()) {
    window.location.href = redirectOnSuccess;
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    msg.textContent = "";

    const usernameRaw = userInput.value.trim();
    const passwordRaw = passInput.value;
    if (!usernameRaw || !passwordRaw) {
      msg.textContent = "Bitte User und Passwort eingeben.";
      return;
    }

    try {
      const userHash = normalizeHash(await sha256(usernameRaw));
      const passHash = normalizeHash(await sha256(passwordRaw));
      const roleOverrides = loadRoleOverrides();
      const disabledUsers = new Set(loadDisabledUsers().map((hash) => normalizeHash(hash)));
      const runtimeUsers = [...users, ...loadLocalUsers()]
        .map((entry) => {
          const hash = normalizeHash(entry.usernameHash);
          const overrideRole = roleOverrides[hash];
          return {
            ...entry,
            role: overrideRole === "Admin" || overrideRole === "User"
              ? overrideRole
              : (entry.role || "User")
          };
        })
        .filter((entry) => !disabledUsers.has(normalizeHash(entry.usernameHash)));
      const matchedUser = runtimeUsers.find((entry) =>
        normalizeHash(entry.usernameHash) === userHash
        && normalizeHash(entry.passwordHash) === passHash
      );

      if (!matchedUser) {
        msg.textContent = "Ungültiger Benutzer oder Passwort.";
        return;
      }

      setAuthenticated(matchedUser.role || "Admin");
      window.location.href = redirectOnSuccess;
    } catch (error) {
      msg.textContent = "Login fehlgeschlagen.";
    }
  });
})();
