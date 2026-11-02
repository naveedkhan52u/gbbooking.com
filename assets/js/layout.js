/* GBbooking shared layout loader and session-aware account navigation. */
(async function () {
  const components = [
    ["[data-shared-component='header']", "/components/site-header.html"],
    ["[data-shared-component='mobile-bottom-nav']", "/components/mobile-bottom-nav.html"],
    ["[data-shared-component='footer']", "/components/site-footer.html"]
  ];
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.onload = resolve;
      script.onerror = () => reject(new Error("Could not load " + src));
      document.head.appendChild(script);
    });
  }
  async function ensureSupabaseClient() {
    if (window.gbSupabase) return window.gbSupabase;
    if (!window.supabase?.createClient) {
      const sdk = document.querySelector('script[src*="supabase-js"]');
      if (sdk) {
        await new Promise((resolve, reject) => {
          if (window.supabase?.createClient) return resolve();
          sdk.addEventListener("load", resolve, { once: true });
          sdk.addEventListener("error", () => reject(new Error("Supabase SDK failed to load.")), { once: true });
        });
      } else await loadScript("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2");
    }
    if (!window.gbSupabase) {
      const config = document.querySelector('script[src*="/assets/js/supabase-client.js"]');
      if (config) {
        await new Promise((resolve, reject) => {
          if (window.gbSupabase) return resolve();
          config.addEventListener("load", resolve, { once: true });
          config.addEventListener("error", () => reject(new Error("Supabase client configuration failed.")), { once: true });
        });
      } else await loadScript("/assets/js/supabase-client.js");
    }
    if (!window.gbSupabase) throw new Error("Supabase client is unavailable.");
    return window.gbSupabase;
  }
  try {
    const loaded = await Promise.all(components.map(async ([selector, url]) => {
      const response = await fetch(url, { cache: "no-cache" });
      if (!response.ok) throw new Error("Could not load " + url + " (" + response.status + ")");
      return [selector, await response.text()];
    }));
    loaded.forEach(([selector, html]) => {
      const mount = document.querySelector(selector);
      if (mount) mount.outerHTML = html;
    });
    const menuButton = document.getElementById("mobileMenuBtn");
    const closeButton = document.getElementById("closeDrawerBtn");
    const drawer = document.getElementById("mobileDrawer");
    const drawerPanel = drawer?.firstElementChild;
    function closeDrawer(returnFocus = true) {
      if (!drawer) return;
      drawer.classList.add("hidden");
      document.body.style.overflow = "";
      menuButton?.setAttribute("aria-expanded", "false");
      if (returnFocus) menuButton?.focus();
    }
    menuButton?.setAttribute("aria-controls", "mobileDrawer");
    menuButton?.setAttribute("aria-expanded", "false");
    menuButton?.addEventListener("click", () => {
      drawer?.classList.remove("hidden");
      document.body.style.overflow = "hidden";
      menuButton.setAttribute("aria-expanded", "true");
      closeButton?.focus();
    });
    closeButton?.addEventListener("click", () => closeDrawer());
    drawer?.addEventListener("click", event => { if (event.target === drawer) closeDrawer(); });
    drawerPanel?.addEventListener("click", event => event.stopPropagation());
    drawer?.querySelectorAll(".drawer-link").forEach(link => link.addEventListener("click", () => closeDrawer(false)));
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && drawer && !drawer.classList.contains("hidden")) closeDrawer();
    });
    window.addEventListener("resize", () => {
      if (window.matchMedia("(min-width: 1024px)").matches && drawer && !drawer.classList.contains("hidden")) closeDrawer(false);
    });
    function markActiveNavigation() {
      const currentPath = window.location.pathname.replace(/\/$/, "") || "/";
      const currentHash = window.location.hash;
      const isHome = currentPath === "/" || currentPath.endsWith("/index.html");
      const isDashboard = /(?:^|\/)(?:provider-)?dashboard(?:\.html)?$/.test(currentPath);
      document.querySelectorAll(".gb-master-header nav a, #mobileDrawer a.drawer-link, .gb-master-bottom-nav a").forEach(link => {
        const rawHref = link.getAttribute("href");
        if (!rawHref || rawHref.startsWith("javascript:")) return;
        const target = new URL(rawHref, window.location.href);
        const targetPath = target.pathname.replace(/\/$/, "") || "/";
        const targetHash = target.hash;
        let active = targetPath === currentPath;
        if (isHome && (targetPath.endsWith("/index.html") || targetPath === "/")) {
          active = !targetHash || targetHash === "#home" ? (!currentHash || currentHash === "#home") : targetHash === currentHash;
        }
        if (isDashboard && targetPath.endsWith("/login.html")) active = false;
        if (targetHash && targetPath === currentPath && targetHash !== currentHash) active = false;
        if (active) { link.classList.add("gb-nav-active"); link.setAttribute("aria-current", "page"); }
        else { link.classList.remove("gb-nav-active"); link.removeAttribute("aria-current"); }
      });
    }
    markActiveNavigation();
    const accountLinks = () => Array.from(document.querySelectorAll("[data-account-link]"));
    function setAccountLinks(path, label) {
      accountLinks().forEach(link => {
        link.href = path;
        const labelNode = link.querySelector("[data-account-label]");
        if (labelNode) labelNode.textContent = label;
        if (link.hasAttribute("aria-label")) link.setAttribute("aria-label", label);
      });
    }
    function resetAccountLinks() { setAccountLinks("/login.html", "Login / Register"); }
    async function syncAccountLinks(session) {
      if (!session?.user?.id) { resetAccountLinks(); return; }
      try {
        const { data: profile, error } = await window.gbSupabase.from("profiles").select("role").eq("id", session.user.id).maybeSingle();
        if (error) throw error;
        const destinations = {
          customer: ["/dashboard.html", "Dashboard"],
          provider: ["/provider-dashboard.html", "Dashboard"],
          admin: ["/admin/dashboard.html", "Admin Dashboard"]
        };
        const destination = destinations[profile?.role];
        if (!destination) { resetAccountLinks(); return; }
        setAccountLinks(destination[0], destination[1]);
      } catch (error) {
        console.error("[GBbooking account navigation]", error);
        resetAccountLinks();
      }
    }
    try {
      const sb = await ensureSupabaseClient();
      const { data: listener } = sb.auth.onAuthStateChange((_event, session) => {
        Promise.resolve().then(() => syncAccountLinks(session));
      });
      const { data, error } = await sb.auth.getSession();
      if (error) throw error;
      await syncAccountLinks(data?.session || null);
      window.addEventListener("pagehide", () => listener?.subscription?.unsubscribe(), { once: true });
    } catch (error) {
      console.error("[GBbooking auth navigation]", error);
      resetAccountLinks();
    }
    document.dispatchEvent(new CustomEvent("gbbooking:layout-ready"));
  } catch (error) {
    console.error("[GBbooking layout]", error);
    document.documentElement.classList.add("layout-load-error");
  }
})();