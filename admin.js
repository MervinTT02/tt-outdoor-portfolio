const storage = window.TTStorage;
const PASSCODE_KEY = "tt_admin_passcode";
const DEFAULT_PASSCODE = "ttadmin";

let state = storage.getConfig();
let activeRouteId = state.routes[0] ? state.routes[0].id : "";
const imageOrientationCache = new Map();

function byId(id) {
  return document.getElementById(id);
}

function toAssetSrc(path) {
  if (typeof path !== "string") return "";
  if (path.startsWith("data:")) return path;
  return encodeURI(path);
}

function showMessage(id, text, isError = false) {
  const node = byId(id);
  if (!node) return;
  node.textContent = text;
  node.style.color = isError ? "#9d2435" : "#214a89";
}

function deepClone(value) {
  return storage.deepClone(value);
}

function getCurrentPasscode() {
  return localStorage.getItem(PASSCODE_KEY) || DEFAULT_PASSCODE;
}

function setCurrentPasscode(value) {
  localStorage.setItem(PASSCODE_KEY, value);
}

function collectSiteForm() {
  state.site.brandText = byId("f-brand-text").value.trim();
  state.site.heroTitle = byId("f-hero-title").value.trim();
  state.site.heroDesc = byId("f-hero-desc").value.trim();
  state.site.routesTitle = byId("f-routes-title").value.trim();
  state.site.galleryTitle = byId("f-gallery-title").value.trim();
  state.site.aboutTitle = byId("f-about-title").value.trim();
  state.site.aboutText = byId("f-about-text").value.trim();
}

function applySiteForm() {
  byId("f-brand-text").value = state.site.brandText || "";
  byId("f-hero-title").value = state.site.heroTitle || "";
  byId("f-hero-desc").value = state.site.heroDesc || "";
  byId("f-routes-title").value = state.site.routesTitle || "";
  byId("f-gallery-title").value = state.site.galleryTitle || "";
  byId("f-about-title").value = state.site.aboutTitle || "";
  byId("f-about-text").value = state.site.aboutText || "";
}

function collectHeroSettings() {
  state.hero.intervalMs = Number(byId("f-hero-interval").value) * 1000;
  state.hero.transitionMs = Number(byId("f-hero-transition").value);
  state.hero.playMode = byId("f-hero-play-mode").value;
  state.hero.showRouteLabel = byId("f-show-route-label").checked;
}

function applyHeroSettings() {
  byId("f-hero-interval").value = Math.round((state.hero.intervalMs || 7000) / 1000);
  byId("f-hero-transition").value = state.hero.transitionMs || 1150;
  byId("f-hero-play-mode").value = state.hero.playMode || "shuffle-once";
  byId("f-show-route-label").checked = state.hero.showRouteLabel !== false;
}

function refreshOverview() {
  const photoCount = state.routes.reduce(
    (sum, route) => sum + (Array.isArray(route.photos) ? route.photos.length : 0),
    0,
  );
  byId("stat-routes").textContent = String(state.routes.length);
  byId("stat-photos").textContent = String(photoCount);
  byId("stat-slides").textContent = String((state.hero.slides || []).length);
}

function routeNameMap() {
  return Object.fromEntries(state.routes.map((route) => [route.id, route.name]));
}

function renderSlidesTable() {
  const container = byId("slides-table");
  const nameMap = routeNameMap();
  const slides = state.hero.slides || [];

  if (slides.length === 0) {
    container.innerHTML = "<p>暂无轮播图。</p>";
    return;
  }

  container.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>预览</th>
          <th>路线</th>
          <th>图片路径</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        ${slides
          .map(
            (slide, index) => `
          <tr>
            <td><img src="${toAssetSrc(slide.src)}" alt="slide-${index}" /></td>
            <td>${nameMap[slide.routeId] || slide.routeName || "-"}</td>
            <td>${slide.src}</td>
            <td>
              <button class="btn" data-slide-action="up" data-index="${index}">上移</button>
              <button class="btn" data-slide-action="down" data-index="${index}">下移</button>
              <button class="btn danger" data-slide-action="remove" data-index="${index}">删除</button>
            </td>
          </tr>
        `,
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function populateSlideRouteOptions() {
  const select = byId("slide-route");
  select.innerHTML = state.routes
    .map((route) => `<option value="${route.id}">${route.name}</option>`)
    .join("");
  if (state.routes[0]) {
    select.value = state.routes[0].id;
  }
  populateSlidePhotoOptions();
}

function populateSlidePhotoOptions() {
  const routeId = byId("slide-route").value;
  const route = state.routes.find((item) => item.id === routeId);
  const photoSelect = byId("slide-photo");
  if (!route) {
    photoSelect.innerHTML = "";
    return;
  }
  photoSelect.innerHTML = (route.photos || [])
    .map((photo) => `<option value="${photo}">${photo}</option>`)
    .join("");
}

function addSlide() {
  const routeId = byId("slide-route").value;
  const src = byId("slide-photo").value;
  if (!routeId || !src) return;
  state.hero.slides.push({ src, routeId });
  renderSlidesTable();
  refreshOverview();
}

function handleSlideTableClick(event) {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) return;
  const action = target.getAttribute("data-slide-action");
  const index = Number(target.getAttribute("data-index"));
  if (Number.isNaN(index)) return;

  if (action === "remove") {
    state.hero.slides.splice(index, 1);
  } else if (action === "up" && index > 0) {
    [state.hero.slides[index - 1], state.hero.slides[index]] = [
      state.hero.slides[index],
      state.hero.slides[index - 1],
    ];
  } else if (action === "down" && index < state.hero.slides.length - 1) {
    [state.hero.slides[index + 1], state.hero.slides[index]] = [
      state.hero.slides[index],
      state.hero.slides[index + 1],
    ];
  }

  renderSlidesTable();
  refreshOverview();
}

function populateRoutePicker() {
  const picker = byId("route-picker");
  picker.innerHTML = state.routes
    .map((route) => `<option value="${route.id}">${route.name}</option>`)
    .join("");
  if (!state.routes.some((route) => route.id === activeRouteId)) {
    activeRouteId = state.routes[0] ? state.routes[0].id : "";
  }
  picker.value = activeRouteId;
}

function fillRouteForm(routeId) {
  const route = state.routes.find((item) => item.id === routeId);
  if (!route) return;
  activeRouteId = route.id;
  byId("r-name").value = route.name || "";
  byId("r-location").value = route.location || "";
  byId("r-effort").value = route.effort || "";
  byId("r-cover").value = route.cover || "";
  byId("r-highlight").value = route.highlight || "";
  byId("r-photos").value = (route.photos || []).join("\n");
  renderRoutePhotoList(route);
}

function getActiveRoute() {
  return state.routes.find((item) => item.id === activeRouteId) || null;
}

function syncRoutePhotosTextarea(route) {
  byId("r-photos").value = (route.photos || []).join("\n");
}

function renderRoutePhotoList(route) {
  const container = byId("r-photo-list");
  if (!container) return;

  if (!route || !Array.isArray(route.photos) || route.photos.length === 0) {
    container.innerHTML = "<p>当前路线暂无照片。</p>";
    return;
  }

  container.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>预览</th>
          <th>路径</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        ${route.photos
          .map(
            (photo, index) => `
          <tr>
            <td><img src="${toAssetSrc(photo)}" alt="route-photo-${index}" /></td>
            <td>${photo.startsWith("data:") ? "本地上传图片(data)" : photo}</td>
            <td><button class="btn danger" data-route-photo-action="remove" data-index="${index}">删除</button></td>
          </tr>
        `,
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function handleRoutePhotoListClick(event) {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) return;
  const action = target.getAttribute("data-route-photo-action");
  const index = Number(target.getAttribute("data-index"));
  if (action !== "remove" || Number.isNaN(index)) return;

  const route = getActiveRoute();
  if (!route) return;
  route.photos.splice(index, 1);
  syncRoutePhotosTextarea(route);
  renderRoutePhotoList(route);
  populateSlidePhotoOptions();
  refreshOverview();
}

function saveCurrentRoute() {
  const route = state.routes.find((item) => item.id === activeRouteId);
  if (!route) return;

  route.name = byId("r-name").value.trim();
  route.location = byId("r-location").value.trim();
  route.effort = byId("r-effort").value.trim();
  route.cover = byId("r-cover").value.trim();
  route.highlight = byId("r-highlight").value.trim();
  route.photos = byId("r-photos")
    .value.split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  populateRoutePicker();
  fillRouteForm(route.id);
  populateSlideRouteOptions();
  renderSlidesTable();
  refreshOverview();
  showMessage("save-msg", `已保存路线：${route.name}`);
}

function toRouteId(name) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9\\u4e00-\\u9fa5]+/g, "-")
    .replace(/(^-|-$)/g, "") || `route-${Date.now()}`;
  let id = base;
  let i = 1;
  while (state.routes.some((route) => route.id === id)) {
    id = `${base}-${i}`;
    i += 1;
  }
  return id;
}

function createRoute() {
  const name = window.prompt("输入新路线名称", "新路线");
  if (!name) return;
  const id = toRouteId(name);
  const newRoute = {
    id,
    name,
    location: "",
    effort: "",
    highlight: "",
    cover: "",
    photos: [],
  };
  state.routes.push(newRoute);
  activeRouteId = id;
  populateRoutePicker();
  fillRouteForm(id);
  populateSlideRouteOptions();
  refreshOverview();
}

function deleteRoute() {
  if (!activeRouteId) return;
  const route = state.routes.find((item) => item.id === activeRouteId);
  if (!route) return;
  const confirmed = window.confirm(`确认删除路线“${route.name}”？`);
  if (!confirmed) return;

  state.routes = state.routes.filter((item) => item.id !== activeRouteId);
  state.hero.slides = (state.hero.slides || []).filter(
    (slide) => slide.routeId !== activeRouteId,
  );

  activeRouteId = state.routes[0] ? state.routes[0].id : "";
  populateRoutePicker();
  if (activeRouteId) fillRouteForm(activeRouteId);
  populateSlideRouteOptions();
  renderSlidesTable();
  refreshOverview();
}

async function getImageSize(src) {
  if (imageOrientationCache.has(src)) return imageOrientationCache.get(src);
  const value = await new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = toAssetSrc(src);
  });
  imageOrientationCache.set(src, value);
  return value;
}

async function buildLandscapeSlides(count = 20) {
  const candidates = state.routes.flatMap((route) =>
    (route.photos || []).map((src) => ({ src, routeId: route.id })),
  );

  const checks = await Promise.all(
    candidates.map(async (item) => {
      const size = await getImageSize(item.src);
      if (!size) return null;
      return size.width >= size.height ? item : null;
    }),
  );

  const landscape = checks.filter(Boolean);
  if (landscape.length === 0) {
    showMessage("save-msg", "没有找到可用的横构图照片。", true);
    return;
  }

  for (let i = landscape.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [landscape[i], landscape[j]] = [landscape[j], landscape[i]];
  }

  state.hero.slides = landscape.slice(0, count);
  renderSlidesTable();
  refreshOverview();
  showMessage("save-msg", `已生成 ${state.hero.slides.length} 张横构图轮播。`);
}

function saveAll() {
  collectSiteForm();
  collectHeroSettings();
  saveCurrentRoute();
  try {
    storage.saveConfig(state);
    showMessage("save-msg", "已保存全部配置。刷新前台页面即可生效。");
  } catch (error) {
    showMessage("save-msg", "保存失败：浏览器存储空间可能不足，请先删除部分本地上传图片。", true);
  }
}

function exportConfig() {
  const blob = new Blob([JSON.stringify(state, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `tt-site-config-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importConfigFromFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result || "{}"));
      storage.saveConfig(parsed);
      state = storage.getConfig();
      hydrateAll();
      showMessage("save-msg", "配置导入成功。");
    } catch (error) {
      showMessage("save-msg", "导入失败：JSON 格式不正确。", true);
    }
  };
  reader.readAsText(file);
}

function resetToDefault() {
  const confirmed = window.confirm("确认恢复默认配置？当前自定义会被清空。");
  if (!confirmed) return;
  state = storage.resetConfig();
  hydrateAll();
  showMessage("save-msg", "已恢复默认配置。");
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("read-failed"));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image-load-failed"));
    img.src = dataUrl;
  });
}

async function compressImageFile(file, maxEdge = 3200, quality = 0.9) {
  const dataUrl = await readFileAsDataURL(file);
  const img = await loadImage(dataUrl);

  const ratio = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
  const targetW = Math.max(1, Math.round(img.naturalWidth * ratio));
  const targetH = Math.max(1, Math.round(img.naturalHeight * ratio));

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, targetW, targetH);
  return canvas.toDataURL("image/jpeg", quality);
}

async function uploadPhotosToCurrentRoute() {
  const route = getActiveRoute();
  const input = byId("r-upload-files");
  if (!route || !input || !input.files || input.files.length === 0) {
    showMessage("save-msg", "请先选择要上传的图片。", true);
    return;
  }

  const files = Array.from(input.files);
  let successCount = 0;
  for (const file of files) {
    try {
      const compressed = await compressImageFile(file, 3200, 0.9);
      route.photos.push(compressed);
      successCount += 1;
    } catch (error) {
      // Skip broken file
    }
  }
  syncRoutePhotosTextarea(route);
  renderRoutePhotoList(route);
  populateSlidePhotoOptions();
  refreshOverview();
  input.value = "";
  showMessage("save-msg", `已上传 ${successCount} 张到当前路线（请记得点“保存全部配置”）。`);
}

function changePasscode() {
  const oldPass = window.prompt("输入旧密码");
  if (oldPass !== getCurrentPasscode()) {
    showMessage("save-msg", "旧密码不正确。", true);
    return;
  }
  const newPass = window.prompt("输入新密码（至少 4 位）");
  if (!newPass || newPass.length < 4) {
    showMessage("save-msg", "新密码格式不正确。", true);
    return;
  }
  setCurrentPasscode(newPass);
  showMessage("save-msg", "后台密码已更新。");
}

function hydrateAll() {
  applySiteForm();
  applyHeroSettings();
  populateRoutePicker();
  if (activeRouteId) fillRouteForm(activeRouteId);
  populateSlideRouteOptions();
  renderSlidesTable();
  refreshOverview();
}

function bindEvents() {
  byId("slide-route").addEventListener("change", populateSlidePhotoOptions);
  byId("add-slide-btn").addEventListener("click", addSlide);
  byId("slides-table").addEventListener("click", handleSlideTableClick);

  byId("route-picker").addEventListener("change", (event) => {
    activeRouteId = event.target.value;
    fillRouteForm(activeRouteId);
  });
  byId("save-route-btn").addEventListener("click", saveCurrentRoute);
  byId("new-route-btn").addEventListener("click", createRoute);
  byId("delete-route-btn").addEventListener("click", deleteRoute);
  byId("r-upload-btn").addEventListener("click", uploadPhotosToCurrentRoute);
  byId("r-photo-list").addEventListener("click", handleRoutePhotoListClick);

  byId("build-20-landscape").addEventListener("click", async () => {
    await buildLandscapeSlides(20);
  });

  byId("save-all-btn").addEventListener("click", saveAll);
  byId("export-btn").addEventListener("click", exportConfig);
  byId("import-btn").addEventListener("click", () => byId("import-file").click());
  byId("import-file").addEventListener("change", (event) => {
    const file = event.target.files && event.target.files[0];
    if (file) importConfigFromFile(file);
    event.target.value = "";
  });
  byId("reset-btn").addEventListener("click", resetToDefault);
  byId("change-passcode-btn").addEventListener("click", changePasscode);
}

function setupLogin() {
  byId("login-btn").addEventListener("click", () => {
    const pass = byId("login-passcode").value;
    if (pass !== getCurrentPasscode()) {
      showMessage("login-msg", "密码错误。", true);
      return;
    }
    byId("admin-panel").classList.remove("hidden");
    byId("login-card").classList.add("hidden");
    byId("login-msg").textContent = "";
    hydrateAll();
  });
}

function init() {
  bindEvents();
  setupLogin();
}

document.addEventListener("DOMContentLoaded", init);
