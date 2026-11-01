/* GBbooking shared layout loader.
   Edit components/site-header.html, components/mobile-bottom-nav.html and
   components/site-footer.html to update the site-wide layout once. */
(async function () {
  const components = [
    ["[data-shared-component='header']", "/components/site-header.html"],
    ["[data-shared-component='mobile-bottom-nav']", "/components/mobile-bottom-nav.html"],
    ["[data-shared-component='footer']", "/components/site-footer.html"]
  ];

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
    drawer?.addEventListener("click", event => {
      if (event.target === drawer) closeDrawer();
    });
    drawerPanel?.addEventListener("click", event => event.stopPropagation());
    drawer?.querySelectorAll(".drawer-link").forEach(link => {
      link.addEventListener("click", () => closeDrawer(false));
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && drawer && !drawer.classList.contains("hidden")) closeDrawer();
    });
    window.addEventListener("resize", () => {
      if (window.matchMedia("(min-width: 1024px)").matches && drawer && !drawer.classList.contains("hidden")) {
        closeDrawer(false);
      }
    });

    document.dispatchEvent(new CustomEvent("gbbooking:layout-ready"));
  } catch (error) {
    console.error("[GBbooking layout]", error);
    document.documentElement.classList.add("layout-load-error");
  }
})();