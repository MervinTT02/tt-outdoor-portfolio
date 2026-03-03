const storage = window.TTStorage;
let config = window.TT_DEFAULT_CONFIG;
let site = {};
let heroConfig = {};
let galleryConfig = {};
let routes = [];
let routeNameById = {};
let allPhotos = [];
let cloudflareImagePolicy = null;

let activeFilter = "all";
let visiblePhotos = [];
let lightboxIndex = 0;

let heroSlideIndex = 0;
let heroSlideTimer = null;
let heroPlaybackOrder = [];

function applyConfig(nextConfig) {
  config = nextConfig && typeof nextConfig === "object" ? nextConfig : window.TT_DEFAULT_CONFIG;
  site = config.site || {};
  heroConfig = config.hero || {};
  galleryConfig = config.gallery || {};
  routes = Array.isArray(config.routes) ? config.routes : [];

  routeNameById = Object.fromEntries(routes.map((route) => [route.id, route.name]));
  allPhotos = routes.flatMap((route) =>
    (route.photos || []).map((src, index) => ({
      routeId: route.id,
      routeName: route.name,
      src,
      index: index + 1,
    })),
  );

  activeFilter = "all";
  visiblePhotos = allPhotos;
  cloudflareImagePolicy = getCloudflareImagePolicy();
}

function assetPath(path) {
  if (typeof path === "string" && path.startsWith("data:")) {
    return path;
  }
  return encodeURI(path).replace(/#/g, "%23");
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function isCloudflareImageUrl(path) {
  try {
    const url = new URL(String(path || ""), window.location.href);
    return url.hostname.includes("imagedelivery.net");
  } catch (error) {
    return false;
  }
}

function getCloudflareImagePolicy() {
  const enabled = galleryConfig.cloudflareResponsive === true;
  return {
    enabled,
    quality: clampNumber(galleryConfig.cloudflareQuality, 60, 95, 88),
    sharpen: clampNumber(galleryConfig.cloudflareSharpen, 0, 3, 1),
    heroMaxW: clampNumber(galleryConfig.cloudflareHeroMaxWidth, 800, 3840, 1920),
    galleryMaxW: clampNumber(galleryConfig.cloudflareGalleryMaxWidth, 600, 3200, 1400),
    lightboxMaxW: clampNumber(galleryConfig.cloudflareLightboxMaxWidth, 900, 4200, 2600),
  };
}

function buildCloudflareTransformedUrl(src, width, quality, sharpen) {
  try {
    const original = new URL(assetPath(src), window.location.href);
    const segments = original.pathname.split("/").filter(Boolean);
    if (segments.length < 3) return "";

    const accountHash = segments[0];
    const imageId = segments[1];
    const options = `width=${Math.round(width)},quality=${Math.round(
      quality,
    )},format=auto,fit=scale-down,sharpen=${Math.max(0, sharpen).toFixed(1)}`;
    const transformed = `${original.origin}/${accountHash}/${imageId}/${options}`;
    return `${transformed}${original.search}`;
  } catch (error) {
    return "";
  }
}

function applyCloudflareResponsiveImage(img, src, context = "gallery") {
  const policy = cloudflareImagePolicy || getCloudflareImagePolicy();
  const rawSrc = assetPath(src);
  if (!policy.enabled || !isCloudflareImageUrl(rawSrc)) {
    img.src = rawSrc;
    img.srcset = "";
    img.sizes = "";
    return;
  }

  const maxW =
    context === "hero"
      ? policy.heroMaxW
      : context === "lightbox"
        ? policy.lightboxMaxW
        : policy.galleryMaxW;

  const candidates =
    context === "hero"
      ? [960, 1280, 1600, 1920, 2400, 2880]
      : context === "lightbox"
        ? [1080, 1440, 1920, 2400, 3200, 3840]
        : [420, 640, 900, 1200, 1600, 2000];
  const widths = candidates.filter((w) => w <= maxW);
  if (!widths.includes(maxW)) widths.push(maxW);

  const srcset = widths
    .map((w) => {
      const url = buildCloudflareTransformedUrl(rawSrc, w, policy.quality, policy.sharpen);
      return url ? `${url} ${w}w` : "";
    })
    .filter(Boolean)
    .join(", ");

  if (!srcset) {
    img.src = rawSrc;
    img.srcset = "";
    img.sizes = "";
    return;
  }

  const sizes =
    context === "hero"
      ? "(min-width: 1080px) 48vw, 96vw"
      : context === "lightbox"
        ? "94vw"
        : "(min-width: 1200px) 29vw, (min-width: 760px) 46vw, 92vw";
  const best = buildCloudflareTransformedUrl(rawSrc, maxW, policy.quality, policy.sharpen);

  img.dataset.cfResponsive = "1";
  img.dataset.cfOriginal = rawSrc;
  if (!img.dataset.cfFallbackBound) {
    img.addEventListener("error", () => {
      if (img.dataset.cfResponsive !== "1") return;
      img.dataset.cfResponsive = "0";
      img.srcset = "";
      img.sizes = "";
      img.src = img.dataset.cfOriginal || "";
    });
    img.dataset.cfFallbackBound = "1";
  }

  img.srcset = srcset;
  img.sizes = sizes;
  img.src = best || rawSrc;
}

function normalizeSlides(slides) {
  if (!Array.isArray(slides)) return [];
  return slides
    .filter((slide) => slide && typeof slide.src === "string")
    .map((slide) => ({
      src: slide.src,
      routeId: slide.routeId || "",
      routeName: slide.routeName || "",
    }));
}

function shuffleIndices(length) {
  const order = Array.from({ length }, (_, index) => index);
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

function applySiteCopy() {
  const setText = (id, value) => {
    if (!value) return;
    const node = document.getElementById(id);
    if (node) node.textContent = value;
  };

  setText("brand-mark", site.brandMark);
  setText("brand-text", site.brandText);
  setText("nav-routes", site.navRoutes);
  setText("nav-gallery", site.navGallery);
  setText("nav-about", site.navAbout);

  setText("hero-eyebrow", site.heroEyebrow);
  setText("hero-title", site.heroTitle);
  setText("hero-desc", site.heroDesc);
  setText("hero-primary-cta", site.heroPrimaryCta);
  setText("hero-secondary-cta", site.heroSecondaryCta);

  setText("stat-photo-label", site.statsPhotoLabel);
  setText("stat-route-label", site.statsRouteLabel);

  setText("routes-eyebrow", site.routesEyebrow);
  setText("routes-title", site.routesTitle);
  setText("gallery-eyebrow", site.galleryEyebrow);
  setText("gallery-title", site.galleryTitle);

  setText("about-eyebrow", site.aboutEyebrow);
  setText("about-title", site.aboutTitle);
  setText("about-text", site.aboutText);

  setText("footer-text", site.footerText);
}

function applyGallerySettings() {
  const desktopWidth = clampNumber(galleryConfig.desktopColumnWidth, 220, 500, 320);
  const mobileWidth = clampNumber(galleryConfig.mobileColumnWidth, 140, 320, 190);
  const gap = clampNumber(galleryConfig.columnGap, 6, 30, 14);

  document.documentElement.style.setProperty("--gallery-column-width", `${desktopWidth}px`);
  document.documentElement.style.setProperty("--gallery-mobile-column-width", `${mobileWidth}px`);
  document.documentElement.style.setProperty("--gallery-gap", `${gap / 16}rem`);
}

function setStats() {
  const photoCountEl = document.getElementById("stat-photo-count");
  const routeCountEl = document.getElementById("stat-route-count");
  const footerYearEl = document.getElementById("footer-year");

  if (photoCountEl) photoCountEl.textContent = String(allPhotos.length);
  if (routeCountEl) routeCountEl.textContent = String(routes.length);
  if (footerYearEl) footerYearEl.textContent = String(new Date().getFullYear());
}

function getSlideRouteName(slide) {
  if (slide.routeId && routeNameById[slide.routeId]) {
    return routeNameById[slide.routeId];
  }
  if (slide.routeName) return slide.routeName;
  return site.routesTitle || "徒步路线";
}

function buildPlaybackOrder(slides, playMode) {
  if (slides.length === 0) return [];
  if (playMode === "sequential") {
    return Array.from({ length: slides.length }, (_, index) => index);
  }
  if (playMode === "shuffle-once") {
    return shuffleIndices(slides.length);
  }
  return Array.from({ length: slides.length }, (_, index) => index);
}

function startHeroSlideshow() {
  const hero = document.getElementById("hero-cover");
  const heroRouteLabel = document.getElementById("hero-route-label");
  const slides = normalizeSlides(heroConfig.slides);
  if (!hero || slides.length === 0) return;

  const intervalMs = clampNumber(heroConfig.intervalMs, 2000, 30000, 7000);
  const transitionMs = clampNumber(heroConfig.transitionMs, 300, 4000, 1150);
  const playMode = ["shuffle-once", "sequential", "random-each"].includes(
    heroConfig.playMode,
  )
    ? heroConfig.playMode
    : "shuffle-once";
  const showRouteLabel = heroConfig.showRouteLabel !== false;

  document.documentElement.style.setProperty("--hero-transition-ms", `${transitionMs}ms`);

  if (heroRouteLabel) {
    heroRouteLabel.style.display = showRouteLabel ? "inline-flex" : "none";
  }

  heroPlaybackOrder = buildPlaybackOrder(slides, playMode);
  heroSlideIndex = 0;

  const getCurrentSlide = () => {
    if (playMode === "random-each") {
      return slides[heroSlideIndex];
    }
    const mappedIndex = heroPlaybackOrder[heroSlideIndex] ?? 0;
    return slides[mappedIndex];
  };

  const nextRandomIndex = () => {
    if (slides.length < 2) return 0;
    let next = heroSlideIndex;
    while (next === heroSlideIndex) {
      next = Math.floor(Math.random() * slides.length);
    }
    return next;
  };

  const showSlide = (immediate = false) => {
    const slide = getCurrentSlide();
    if (!slide) return;

    hero.style.opacity = immediate ? "1" : "0.38";
    if (heroRouteLabel && showRouteLabel) {
      heroRouteLabel.style.opacity = "0";
    }

    window.setTimeout(() => {
      const routeName = getSlideRouteName(slide);
      applyCloudflareResponsiveImage(hero, slide.src, "hero");
      hero.alt = `${routeName} 主视觉`;
      if (heroRouteLabel && showRouteLabel) {
        heroRouteLabel.textContent = routeName;
        heroRouteLabel.style.opacity = "1";
      }
      hero.style.opacity = "1";
    }, immediate ? 0 : Math.round(transitionMs * 0.4));
  };

  if (playMode === "random-each") {
    heroSlideIndex = Math.floor(Math.random() * slides.length);
  }
  showSlide(true);

  if (heroSlideTimer) window.clearInterval(heroSlideTimer);
  heroSlideTimer = window.setInterval(() => {
    if (playMode === "random-each") {
      heroSlideIndex = nextRandomIndex();
    } else {
      heroSlideIndex = (heroSlideIndex + 1) % heroPlaybackOrder.length;
    }
    showSlide(false);
  }, intervalMs);
}

function renderRoutes() {
  const routeGrid = document.getElementById("route-grid");
  if (!routeGrid) return;
  routeGrid.innerHTML = "";

  routes.forEach((route) => {
    const card = document.createElement("article");
    card.className = "route-card";
    const cover = route.cover || (route.photos && route.photos[0]) || "";

    card.innerHTML = `
      <img alt="${route.name} 封面" loading="lazy" decoding="async" />
      <div class="route-body">
        <h3 class="route-name">${route.name}</h3>
        <p class="route-meta">${route.location || ""}</p>
        <p class="route-meta">${route.effort || ""}</p>
        <p class="route-highlight">${route.highlight || ""}</p>
        <button class="route-action" data-route-id="${route.id}">查看该路线作品（${(route.photos || []).length}）</button>
      </div>
    `;
    const routeImg = card.querySelector("img");
    if (routeImg) {
      applyCloudflareResponsiveImage(routeImg, cover, "gallery");
    }
    routeGrid.appendChild(card);
  });

  routeGrid.querySelectorAll(".route-action").forEach((button) => {
    button.addEventListener("click", () => {
      const routeId = button.getAttribute("data-route-id");
      if (!routeId) return;
      setFilter(routeId);
      const gallery = document.getElementById("gallery");
      if (gallery) {
        gallery.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });
}

function renderFilters() {
  const filterRow = document.getElementById("filter-row");
  if (!filterRow) return;
  filterRow.innerHTML = "";

  const allBtn = document.createElement("button");
  allBtn.className = `filter-btn ${activeFilter === "all" ? "active" : ""}`;
  allBtn.textContent = `全部 (${allPhotos.length})`;
  allBtn.addEventListener("click", () => setFilter("all"));
  filterRow.appendChild(allBtn);

  routes.forEach((route) => {
    const button = document.createElement("button");
    button.className = `filter-btn ${activeFilter === route.id ? "active" : ""}`;
    button.textContent = `${route.name} (${(route.photos || []).length})`;
    button.addEventListener("click", () => setFilter(route.id));
    filterRow.appendChild(button);
  });
}

function setFilter(routeId) {
  activeFilter = routeId;
  visiblePhotos =
    routeId === "all"
      ? allPhotos
      : allPhotos.filter((photo) => photo.routeId === routeId);
  renderFilters();
  renderGallery();
}

function renderGallery() {
  const gallery = document.getElementById("gallery-grid");
  if (!gallery) return;
  gallery.innerHTML = "";

  visiblePhotos.forEach((photo, index) => {
    const card = document.createElement("article");
    card.className = "photo-card";
    const img = document.createElement("img");
    img.alt = `${photo.routeName} 第 ${photo.index} 张`;
    img.loading = "lazy";
    img.decoding = "async";
    applyCloudflareResponsiveImage(img, photo.src, "gallery");
    card.appendChild(img);
    card.addEventListener("click", () => openLightbox(index));
    gallery.appendChild(card);
  });
}

function openLightbox(index) {
  lightboxIndex = index;
  const lightbox = document.getElementById("lightbox");
  if (!lightbox) return;
  lightbox.classList.add("open");
  lightbox.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  renderLightbox();
}

function closeLightbox() {
  const lightbox = document.getElementById("lightbox");
  if (!lightbox) return;
  lightbox.classList.remove("open");
  lightbox.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function renderLightbox() {
  const current = visiblePhotos[lightboxIndex];
  if (!current) return;
  const image = document.getElementById("lightbox-image");
  const caption = document.getElementById("lightbox-caption");
  if (!image || !caption) return;

  applyCloudflareResponsiveImage(image, current.src, "lightbox");
  image.alt = `${current.routeName} 大图预览`;
  caption.textContent = current.routeName;
}

function showPrev() {
  lightboxIndex =
    (lightboxIndex - 1 + visiblePhotos.length) % visiblePhotos.length;
  renderLightbox();
}

function showNext() {
  lightboxIndex = (lightboxIndex + 1) % visiblePhotos.length;
  renderLightbox();
}

function bindLightboxEvents() {
  const closeBtn = document.getElementById("lightbox-close");
  const prevBtn = document.getElementById("lightbox-prev");
  const nextBtn = document.getElementById("lightbox-next");
  const lightbox = document.getElementById("lightbox");

  if (closeBtn) closeBtn.addEventListener("click", closeLightbox);
  if (prevBtn) prevBtn.addEventListener("click", showPrev);
  if (nextBtn) nextBtn.addEventListener("click", showNext);

  if (lightbox) {
    lightbox.addEventListener("click", (event) => {
      if (event.target.id === "lightbox") closeLightbox();
    });
  }

  document.addEventListener("keydown", (event) => {
    if (!lightbox || !lightbox.classList.contains("open")) return;
    if (event.key === "Escape") closeLightbox();
    if (event.key === "ArrowLeft") showPrev();
    if (event.key === "ArrowRight") showNext();
  });
}

function initReveal() {
  const targets = document.querySelectorAll(".reveal");
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 },
  );
  targets.forEach((target) => observer.observe(target));
}

async function loadRuntimeConfig() {
  if (!storage) return window.TT_DEFAULT_CONFIG;
  if (typeof storage.getRuntimeConfig === "function") {
    return storage.getRuntimeConfig({ preferRemote: true, includeLocal: false });
  }
  return storage.getConfig();
}

async function init() {
  const runtimeConfig = await loadRuntimeConfig();
  applyConfig(runtimeConfig);

  applySiteCopy();
  applyGallerySettings();
  setStats();
  startHeroSlideshow();
  renderRoutes();
  renderFilters();
  renderGallery();
  bindLightboxEvents();
  initReveal();
}

document.addEventListener("DOMContentLoaded", () => {
  init();
});
