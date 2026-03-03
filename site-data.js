(function () {
  const STORAGE_KEY = "tt_site_config_v1";
  const REMOTE_CONFIG_PATH = "./site-config.json";
  const REMOVED_ASSETS = new Set([
    "./个人摄影集/梅里北坡/DSC01224.jpg",
    "./个人摄影集/梅里北坡/DSC01234.jpg",
    "./个人摄影集/梅里北坡/DSC01238.jpg",
    "./个人摄影集/梅里北坡/DSC01243.jpg",
    "./个人摄影集/梅里北坡/DSC01245-2.jpg",
  ]);

  const DEFAULT_CONFIG = {
    site: {
      brandMark: "TT",
      brandText: "Outdoors Journal",
      navRoutes: "徒步路线",
      navGallery: "摄影作品",
      navAbout: "关于我",
      heroEyebrow: "Personal Hiking & Photography Portfolio",
      heroTitle: "TT的户外摄影档案",
      heroDesc:
        "记录风、云、雪线和脚步。这个网站用来长期展示我在中国各地徒步时拍摄的作品，以及走过的路线记忆。",
      heroPrimaryCta: "浏览作品",
      heroSecondaryCta: "查看路线",
      statsPhotoLabel: "摄影作品",
      statsRouteLabel: "徒步路线",
      routesEyebrow: "Routes",
      routesTitle: "徒步路线",
      galleryEyebrow: "Photography",
      galleryTitle: "摄影作品",
      aboutEyebrow: "About TT",
      aboutTitle: "山野不止是目的地，也是观看世界的方式",
      aboutText:
        "我叫 TT，偏好高海拔徒步与轻量化穿越。这个站点会持续更新我的徒步摄影和路线记录，后续也可以继续加入 GPX 轨迹、海拔曲线和行程日志。",
      footerText: "TT Outdoors. Crafted for hiking memory.",
    },
    hero: {
      intervalMs: 7000,
      transitionMs: 1150,
      playMode: "shuffle-once",
      showRouteLabel: true,
      slides: [
        { src: "./个人摄影集/梅里北坡/DSC01221.jpg", routeId: "meili" },
        { src: "./个人摄影集/梅里北坡/DSC00483.jpg", routeId: "meili" },
        { src: "./个人摄影集/梅里北坡/DSC00696.jpg", routeId: "meili" },
        { src: "./个人摄影集/梅里北坡/DSC00874.jpg", routeId: "meili" },
        { src: "./个人摄影集/梅里北坡/DSC01254.jpg", routeId: "meili" },
        { src: "./个人摄影集/洛克线/微信图片_20241029225405.jpg", routeId: "rock" },
        { src: "./个人摄影集/洛克线/微信图片_20241029225542.jpg", routeId: "rock" },
        { src: "./个人摄影集/洛克线/微信图片_20241029225629.jpg", routeId: "rock" },
        { src: "./个人摄影集/洛克线/微信图片_20241029225727.jpg", routeId: "rock" },
        { src: "./个人摄影集/洛克线/微信图片_20241029225848.jpg", routeId: "rock" },
        { src: "./个人摄影集/武功山/20240720-DSC03047.jpg", routeId: "wugong" },
        { src: "./个人摄影集/武功山/20240720-DSC03063.jpg", routeId: "wugong" },
        { src: "./个人摄影集/武功山/20240720-DSC03081.jpg", routeId: "wugong" },
        { src: "./个人摄影集/武功山/20240720-DSC03083.jpg", routeId: "wugong" },
        { src: "./个人摄影集/武功山/20240720-DSC03102.jpg", routeId: "wugong" },
        { src: "./个人摄影集/郴州八面山/DSC06483.jpg", routeId: "bamian" },
        { src: "./个人摄影集/郴州八面山/DSC06494.jpg", routeId: "bamian" },
        { src: "./个人摄影集/郴州八面山/DSC06505.jpg", routeId: "bamian" },
        { src: "./个人摄影集/郴州八面山/DSC06518.jpg", routeId: "bamian" },
        { src: "./个人摄影集/郴州八面山/DSC06522.jpg", routeId: "bamian" },
      ],
    },
    gallery: {
      desktopColumnWidth: 320,
      mobileColumnWidth: 190,
      columnGap: 14,
    },
    routes: [
      {
        id: "meili",
        name: "云南德钦·梅里北坡",
        location: "高海拔雪山区域",
        effort: "多日重装穿越",
        highlight: "雪峰、草甸、河谷与冰川地貌",
        cover: "./个人摄影集/梅里北坡/DSC00483.jpg",
        photos: [
          "./个人摄影集/梅里北坡/DSC00483.jpg",
          "./个人摄影集/梅里北坡/DSC00696.jpg",
          "./个人摄影集/梅里北坡/DSC00745.jpg",
          "./个人摄影集/梅里北坡/DSC00855.jpg",
          "./个人摄影集/梅里北坡/DSC00874.jpg",
          "./个人摄影集/梅里北坡/DSC00918.jpg",
          "./个人摄影集/梅里北坡/DSC01046.jpg",
          "./个人摄影集/梅里北坡/DSC01196.jpg",
          "./个人摄影集/梅里北坡/DSC01209.jpg",
          "./个人摄影集/梅里北坡/DSC01213.jpg",
          "./个人摄影集/梅里北坡/DSC01214.jpg",
          "./个人摄影集/梅里北坡/DSC01217.jpg",
          "./个人摄影集/梅里北坡/DSC01221.jpg",
          "./个人摄影集/梅里北坡/DSC01254.jpg",
        ],
      },
      {
        id: "rock",
        name: "四川木里·洛克线",
        location: "高山草甸与垭口线",
        effort: "高强度连续徒步",
        highlight: "云海、风化岩体、纵深山谷",
        cover: "./个人摄影集/洛克线/微信图片_20241029225848.jpg",
        photos: [
          "./个人摄影集/洛克线/微信图片_20241029225405.jpg",
          "./个人摄影集/洛克线/微信图片_20241029225507.jpg",
          "./个人摄影集/洛克线/微信图片_20241029225538.jpg",
          "./个人摄影集/洛克线/微信图片_20241029225542.jpg",
          "./个人摄影集/洛克线/微信图片_20241029225547.jpg",
          "./个人摄影集/洛克线/微信图片_20241029225629.jpg",
          "./个人摄影集/洛克线/微信图片_20241029225717.jpg",
          "./个人摄影集/洛克线/微信图片_20241029225723.jpg",
          "./个人摄影集/洛克线/微信图片_20241029225727.jpg",
          "./个人摄影集/洛克线/微信图片_20241029225737.jpg",
          "./个人摄影集/洛克线/微信图片_20241029225804.jpg",
          "./个人摄影集/洛克线/微信图片_20241029225827.jpg",
          "./个人摄影集/洛克线/微信图片_20241029225848.jpg",
          "./个人摄影集/洛克线/微信图片_20241029225856.jpg",
          "./个人摄影集/洛克线/微信图片_20241029225900.jpg",
          "./个人摄影集/洛克线/微信图片_20241029225904.jpg",
          "./个人摄影集/洛克线/微信图片_20241029225911.jpg",
          "./个人摄影集/洛克线/微信图片_20241029225926.jpg",
        ],
      },
      {
        id: "wugong",
        name: "江西萍乡·武功山",
        location: "高山草甸经典线",
        effort: "周末强度徒步",
        highlight: "连绵草坡、云雾营地与日落层次",
        cover: "./个人摄影集/武功山/20240720-DSC03081.jpg",
        photos: [
          "./个人摄影集/武功山/20240720-DSC03047.jpg",
          "./个人摄影集/武功山/20240720-DSC03062.jpg",
          "./个人摄影集/武功山/20240720-DSC03063.jpg",
          "./个人摄影集/武功山/20240720-DSC03081.jpg",
          "./个人摄影集/武功山/20240720-DSC03082.jpg",
          "./个人摄影集/武功山/20240720-DSC03083.jpg",
          "./个人摄影集/武功山/20240720-DSC03101.jpg",
          "./个人摄影集/武功山/20240720-DSC03102.jpg",
        ],
      },
      {
        id: "bamian",
        name: "湖南郴州·八面山",
        location: "南方山地线",
        effort: "中高强度穿越",
        highlight: "丘陵光影、山脊线条与天气变化",
        cover: "./个人摄影集/郴州八面山/DSC06505.jpg",
        photos: [
          "./个人摄影集/郴州八面山/DSC06410.jpg",
          "./个人摄影集/郴州八面山/DSC06449.jpg",
          "./个人摄影集/郴州八面山/DSC06451.jpg",
          "./个人摄影集/郴州八面山/DSC06483.jpg",
          "./个人摄影集/郴州八面山/DSC06487.jpg",
          "./个人摄影集/郴州八面山/DSC06493.jpg",
          "./个人摄影集/郴州八面山/DSC06494.jpg",
          "./个人摄影集/郴州八面山/DSC06495.jpg",
          "./个人摄影集/郴州八面山/DSC06496.jpg",
          "./个人摄影集/郴州八面山/DSC06497.jpg",
          "./个人摄影集/郴州八面山/DSC06505.jpg",
          "./个人摄影集/郴州八面山/DSC06506.jpg",
          "./个人摄影集/郴州八面山/DSC06508.jpg",
          "./个人摄影集/郴州八面山/DSC06515.jpg",
          "./个人摄影集/郴州八面山/DSC06518.jpg",
          "./个人摄影集/郴州八面山/DSC06522.jpg",
        ],
      },
    ],
  };

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function sanitizeConfig(config) {
    const cleaned = deepClone(config);

    if (Array.isArray(cleaned.routes)) {
      cleaned.routes = cleaned.routes.map((route) => {
        const next = { ...route };
        next.photos = Array.isArray(next.photos)
          ? next.photos.filter((photo) => !REMOVED_ASSETS.has(photo))
          : [];
        if (next.cover && REMOVED_ASSETS.has(next.cover)) {
          next.cover = next.photos[0] || "";
        }
        return next;
      });
    }

    if (cleaned.hero && Array.isArray(cleaned.hero.slides)) {
      cleaned.hero.slides = cleaned.hero.slides.filter(
        (slide) => slide && typeof slide.src === "string" && !REMOVED_ASSETS.has(slide.src),
      );
    }

    return cleaned;
  }

  function mergeDefaults(base, incoming) {
    if (Array.isArray(base)) {
      return Array.isArray(incoming) ? incoming : deepClone(base);
    }
    if (base && typeof base === "object") {
      const output = {};
      const source = incoming && typeof incoming === "object" ? incoming : {};
      Object.keys(base).forEach((key) => {
        output[key] = mergeDefaults(base[key], source[key]);
      });
      Object.keys(source).forEach((key) => {
        if (!(key in output)) {
          output[key] = source[key];
        }
      });
      return output;
    }
    return incoming === undefined ? base : incoming;
  }

  function getConfig() {
    const fallback = deepClone(DEFAULT_CONFIG);
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return sanitizeConfig(fallback);
      const parsed = JSON.parse(raw);
      return sanitizeConfig(mergeDefaults(fallback, parsed));
    } catch (error) {
      return sanitizeConfig(fallback);
    }
  }

  function saveConfig(config) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  }

  function resetConfig() {
    localStorage.removeItem(STORAGE_KEY);
    return deepClone(DEFAULT_CONFIG);
  }

  function encodePath(path) {
    return String(path || "")
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/");
  }

  async function getRemoteConfig(path = REMOTE_CONFIG_PATH) {
    try {
      const cacheBusting = `v=${Date.now()}`;
      const normalizedPath = String(path || REMOTE_CONFIG_PATH).trim();
      const delimiter = normalizedPath.includes("?") ? "&" : "?";
      const response = await fetch(
        `${encodePath(normalizedPath).replace(/%2F/g, "/")}${delimiter}${cacheBusting}`,
        { cache: "no-store" },
      );
      if (!response.ok) return null;
      const parsed = await response.json();
      const merged = mergeDefaults(deepClone(DEFAULT_CONFIG), parsed);
      return sanitizeConfig(merged);
    } catch (error) {
      return null;
    }
  }

  async function getRuntimeConfig(options = {}) {
    const preferRemote = options.preferRemote !== false;
    const includeLocal = options.includeLocal !== false;
    const localConfig = includeLocal ? getConfig() : sanitizeConfig(deepClone(DEFAULT_CONFIG));
    if (!preferRemote) return localConfig;
    const remoteConfig = await getRemoteConfig(options.remotePath || REMOTE_CONFIG_PATH);
    if (!remoteConfig) return localConfig;
    return sanitizeConfig(mergeDefaults(localConfig, remoteConfig));
  }

  window.TT_DEFAULT_CONFIG = deepClone(DEFAULT_CONFIG);
  window.TTStorage = {
    STORAGE_KEY,
    REMOTE_CONFIG_PATH,
    getConfig,
    getRemoteConfig,
    getRuntimeConfig,
    saveConfig,
    resetConfig,
    deepClone,
  };
})();
