(function () {
  const cfg = window.AUTH_CONFIG || {};
  const sessionKey = cfg.sessionKey || "dpc:auth:ok";
  const roleKey = cfg.roleKey || "dpc:auth:role";
  const localUsersKey = cfg.localUsersKey || "dpc:auth:users";
  const staticUsers = Array.isArray(cfg.users) ? cfg.users : [];

  const form = document.getElementById("registerForm");
  const userEl = document.getElementById("regUser");
  const passEl = document.getElementById("regPass");
  const pass2El = document.getElementById("regPass2");
  const roleEl = document.getElementById("regRole");
  const msgEl = document.getElementById("registerMsg");

  if (!form || !userEl || !passEl || !pass2El || !roleEl || !msgEl) {
    return;
  }

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

  const toHex = (buffer) => Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const sha256 = async (value) => {
    const data = new TextEncoder().encode(String(value || ""));
    const digest = await crypto.subtle.digest("SHA-256", data);
    return toHex(digest);
  };

  const normalizeHash = (value) => String(value || "").trim().toLowerCase();

  const readLocalUsers = () => {
    try {
      const raw = localStorage.getItem(localUsersKey);
      if (!raw) {
        return [];
      }
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  };

  const writeLocalUsers = (users) => {
    localStorage.setItem(localUsersKey, JSON.stringify(users));
  };

  const setMsg = (text, ok) => {
    msgEl.textContent = text;
    msgEl.classList.toggle("ok", Boolean(ok));
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setMsg("", false);

    const username = String(userEl.value || "").trim();
    const password = String(passEl.value || "");
    const password2 = String(pass2El.value || "");
    const role = roleEl.value === "Admin" ? "Admin" : "User";

    if (!username || !password || !password2) {
      setMsg("Bitte alle Felder ausfüllen.", false);
      return;
    }
    if (password !== password2) {
      setMsg("Passwörter stimmen nicht überein.", false);
      return;
    }
    if (password.length < 6) {
      setMsg("Passwort muss mindestens 6 Zeichen haben.", false);
      return;
    }

    try {
      const usernameHash = normalizeHash(await sha256(username));
      const passwordHash = normalizeHash(await sha256(password));

      const localUsers = readLocalUsers();
      const allUsers = [...staticUsers, ...localUsers];
      const exists = allUsers.some((entry) => normalizeHash(entry.usernameHash) === usernameHash);
      if (exists) {
        setMsg("Benutzername existiert bereits.", false);
        return;
      }

      localUsers.push({
        role,
        usernameHash,
        passwordHash
      });
      writeLocalUsers(localUsers);
      form.reset();
      roleEl.value = "User";
      setMsg("Benutzer gespeichert. Jetzt mit Login anmelden.", true);
    } catch (error) {
      setMsg("Speichern fehlgeschlagen.", false);
    }
  });
})();
