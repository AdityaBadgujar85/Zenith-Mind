// src/setupAdminFetch.js
// Auto-attach Authorization to ALL /api/admin/* fetches (and send cookies).
(function patchAdminFetch() {
  if (typeof window === "undefined" || !window.fetch) return;

  const getToken = () =>
    localStorage.getItem("admin_token") ||
    localStorage.getItem("auth_token") ||
    localStorage.getItem("token") ||
    "";

  const originalFetch = window.fetch.bind(window);

  window.fetch = (input, init = {}) => {
    const url = typeof input === "string" ? input : (input?.url || "");

    if (url.includes("/api/admin/")) {
      const headers = new Headers(init.headers || {});
      const t = getToken();
      if (t && !headers.has("Authorization")) {
        headers.set("Authorization", `Bearer ${t}`);
      }
      if (!init.credentials) init.credentials = "include";
      init.headers = headers;
    }

    return originalFetch(input, init);
  };
})();
