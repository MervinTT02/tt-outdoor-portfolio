const storage = window.TTStorage;
const PASSCODE_KEY = "tt_admin_passcode";
const DEFAULT_PASSCODE = "ttadmin";
const ADMIN_AUTH_KEY = "tt_admin_logged_in_v1";
const PUBLISH_SETTINGS_KEY = "tt_publish_settings_v1";
const REPO_UPLOAD_PREFIX = "个人摄影集/后台上传/";
const DEFAULT_PUBLISH_SETTINGS = {
  owner: "MervinTT02",
  repo: "tt-outdoor-portfolio",
  branch: "main",
  token: "",
  commitMessage: "chore: update site config from admin panel",
};

let state = storage.getConfig();
let activeRouteId = state.routes[0] ? state.routes[0].id : "";
const imageOrientationCache = new Map();
let publishSettings = loadPublishSettings();

function byId(id) {
  return document.getElementById(id);
}

function toAssetSrc(path) {
  if (typeof path !== "string") return "";
  if (path.startsWith("data:")) return path;
  return encodeURI(path);
}

function isDataUrl(path) {
  if (typeof path !== "string") return false;
  const normalized = path.trim().toLowerCase();
  return normalized.startsWith("data:image/") || normalized.includes(";base64,");
}

function isPlaceholderLine(line) {
  return String(line || "").trim().startsWith("[本地上传图片");
}

function extractFileName(path) {
  const text = String(path || "").trim();
  if (!text) return "";
  const normalized = text.replace(/\\/g, "/");
  const segment = normalized.split("/").pop() || normalized;
  try {
    return decodeURIComponent(segment);
  } catch (error) {
    return segment;
  }
}

function readDataUrlName(dataUrl) {
  if (!isDataUrl(dataUrl)) return "";
  const marker = ";name=";
  const start = dataUrl.indexOf(marker);
  if (start === -1) return "";
  const from = start + marker.length;
  const end = dataUrl.indexOf(";base64,", from);
  const raw = end === -1 ? dataUrl.slice(from) : dataUrl.slice(from, end);
  try {
    return decodeURIComponent(raw);
  } catch (error) {
    return raw;
  }
}

function getPhotoLabel(photo, index = 0) {
  if (isDataUrl(photo)) {
    return readDataUrlName(photo) || `本地上传图片_${index + 1}.jpg`;
  }
  return extractFileName(photo);
}

function normalizeUploadBaseName(name) {
  const raw = extractFileName(name).replace(/\.[^.]+$/, "");
  const normalized = raw
    .normalize("NFKD")
    .replace(/[^\w\u4e00-\u9fa5-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/(^-|-$)/g, "");
  return normalized || "photo";
}

function buildUploadAssetPath(route, fileName) {
  const date = new Date();
  const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(
    date.getDate(),
  ).padStart(2, "0")}-${String(date.getHours()).padStart(2, "0")}${String(
    date.getMinutes(),
  ).padStart(2, "0")}${String(date.getSeconds()).padStart(2, "0")}`;
  const random = Math.random().toString(36).slice(2, 7);
  const safeExt = "jpg";
  const base = normalizeUploadBaseName(fileName);
  const routeFolder = route && route.id ? route.id : "route";
  return `个人摄影集/后台上传/${routeFolder}/${stamp}-${random}-${base}.${safeExt}`;
}

function normalizeAssetPath(path) {
  return String(path || "").trim().replace(/^\.\/+/, "");
}

function isRepoManagedUploadPhoto(path) {
  if (isDataUrl(path)) return false;
  return normalizeAssetPath(path).startsWith(REPO_UPLOAD_PREFIX);
}

function photosToTextareaLines(photos) {
  let localUploadIndex = 0;
  return (Array.isArray(photos) ? photos : []).map((photo) => {
    if (isDataUrl(photo)) {
      localUploadIndex += 1;
      return `[本地上传图片 ${localUploadIndex}] ${getPhotoLabel(photo, localUploadIndex - 1)}`;
    }
    return photo;
  });
}

function parseTextareaPhotos(value) {
  return String(value || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !isPlaceholderLine(line))
    .filter((line) => !isDataUrl(line));
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

function getCookieValue(key) {
  const prefix = `${key}=`;
  const found = document.cookie
    .split("; ")
    .find((item) => item.startsWith(prefix));
  return found ? decodeURIComponent(found.slice(prefix.length)) : "";
}

function getCurrentPasscode() {
  const localPass = localStorage.getItem(PASSCODE_KEY);
  if (localPass) return localPass;
  const cookiePass = getCookieValue(PASSCODE_KEY);
  return cookiePass || DEFAULT_PASSCODE;
}

function setCurrentPasscode(value) {
  const safeValue = String(value || "").trim() || DEFAULT_PASSCODE;
  localStorage.setItem(PASSCODE_KEY, safeValue);
  document.cookie = `${PASSCODE_KEY}=${encodeURIComponent(
    safeValue,
  )}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
}

function setAdminLoggedIn(value) {
  localStorage.setItem(ADMIN_AUTH_KEY, value ? "1" : "0");
  if (value) {
    document.cookie = `${ADMIN_AUTH_KEY}=1; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
  } else {
    document.cookie = `${ADMIN_AUTH_KEY}=0; path=/; max-age=0; SameSite=Lax`;
  }
}

function isAdminLoggedIn() {
  if (localStorage.getItem(ADMIN_AUTH_KEY) === "1") return true;
  return document.cookie.split("; ").some((item) => item === `${ADMIN_AUTH_KEY}=1`);
}

function loadPublishSettings() {
  try {
    const raw = localStorage.getItem(PUBLISH_SETTINGS_KEY);
    if (!raw) return deepClone(DEFAULT_PUBLISH_SETTINGS);
    const parsed = JSON.parse(raw);
    return { ...deepClone(DEFAULT_PUBLISH_SETTINGS), ...(parsed || {}) };
  } catch (error) {
    return deepClone(DEFAULT_PUBLISH_SETTINGS);
  }
}

function persistPublishSettings() {
  localStorage.setItem(PUBLISH_SETTINGS_KEY, JSON.stringify(publishSettings));
}

function collectPublishForm() {
  publishSettings.owner = byId("gh-owner").value.trim();
  publishSettings.repo = byId("gh-repo").value.trim();
  publishSettings.branch = byId("gh-branch").value.trim() || "main";
  publishSettings.token = byId("gh-token").value.trim();
  publishSettings.commitMessage =
    byId("gh-commit-message").value.trim() || DEFAULT_PUBLISH_SETTINGS.commitMessage;
  persistPublishSettings();
}

function applyPublishForm() {
  byId("gh-owner").value = publishSettings.owner || "";
  byId("gh-repo").value = publishSettings.repo || "";
  byId("gh-branch").value = publishSettings.branch || "main";
  byId("gh-token").value = publishSettings.token || "";
  byId("gh-commit-message").value =
    publishSettings.commitMessage || DEFAULT_PUBLISH_SETTINGS.commitMessage;
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
  syncRoutePhotosTextarea(route);
  renderRoutePhotoList(route);
}

function getActiveRoute() {
  return state.routes.find((item) => item.id === activeRouteId) || null;
}

function syncRoutePhotosTextarea(route) {
  byId("r-photos").value = photosToTextareaLines(route.photos).join("\n");
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
          <th>图片名称</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        ${route.photos
          .map(
            (photo, index) => `
          <tr>
            <td><img src="${toAssetSrc(photo)}" alt="route-photo-${index}" /></td>
            <td>${getPhotoLabel(photo, index)}</td>
            <td><button class="btn danger" data-route-photo-action="remove" data-index="${index}">删除</button></td>
          </tr>
        `,
          )
          .join("")}
      </tbody>
    </table>
  `;
}

async function handleRoutePhotoListClick(event) {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) return;
  const action = target.getAttribute("data-route-photo-action");
  const index = Number(target.getAttribute("data-index"));
  if (action !== "remove" || Number.isNaN(index)) return;

  const route = getActiveRoute();
  if (!route) return;
  const photo = route.photos[index];
  if (!photo) return;

  let deletedFromRepo = false;
  if (isRepoManagedUploadPhoto(photo)) {
    const alsoDeleteRemote = window.confirm(
      "是否同时删除 GitHub 仓库中的原图文件？\n确定：同时删除仓库文件\n取消：仅从当前路线移除",
    );
    if (alsoDeleteRemote) {
      const refs = countAssetReferences(photo);
      if (refs > 1) {
        showMessage(
          "save-msg",
          "该图片仍被其他路线/轮播/封面引用，已仅从当前路线移除，未删除仓库文件。",
          true,
        );
      } else {
        try {
          showMessage("save-msg", `正在删除仓库文件：${extractFileName(photo)}...`);
          deletedFromRepo = await deleteUploadedPhotoFromGitHub(photo);
        } catch (error) {
          const removeOnly = window.confirm(
            `仓库文件删除失败：${error.message || "未知错误"}\n是否仅从当前路线移除该图片？`,
          );
          if (!removeOnly) return;
        }
      }
    }
  }

  route.photos.splice(index, 1);
  syncRoutePhotosTextarea(route);
  renderRoutePhotoList(route);
  populateSlidePhotoOptions();
  refreshOverview();
  if (deletedFromRepo) {
    showMessage("save-msg", "已从当前路线移除，并删除仓库中的原图文件。");
  }
}

function saveCurrentRoute(showNotice = true) {
  const route = state.routes.find((item) => item.id === activeRouteId);
  if (!route) return;

  route.name = byId("r-name").value.trim();
  route.location = byId("r-location").value.trim();
  route.effort = byId("r-effort").value.trim();
  route.cover = byId("r-cover").value.trim();
  route.highlight = byId("r-highlight").value.trim();
  const manualPhotos = parseTextareaPhotos(byId("r-photos").value);
  const uploadedPhotos = (route.photos || []).filter((photo) => isDataUrl(photo));
  route.photos = Array.from(new Set([...manualPhotos, ...uploadedPhotos]));

  populateRoutePicker();
  fillRouteForm(route.id);
  populateSlideRouteOptions();
  renderSlidesTable();
  refreshOverview();
  if (showNotice) {
    showMessage("save-msg", `已保存路线：${route.name}`);
  }
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
  collectPublishForm();
  saveCurrentRoute(false);
  try {
    storage.saveConfig(state);
    showMessage("save-msg", "已保存全部配置。刷新前台页面即可生效。");
  } catch (error) {
    showMessage("save-msg", "保存失败：浏览器存储空间可能不足，请先删除部分本地上传图片。", true);
  }
}

function encodeUtf8Base64(content) {
  const bytes = new TextEncoder().encode(content);
  let binary = "";
  bytes.forEach((value) => {
    binary += String.fromCharCode(value);
  });
  return btoa(binary);
}

function encodeBinaryBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function encodeGitHubPath(path) {
  return String(path || "")
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function githubHeaders(token) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

function validateGitHubPublishSettings() {
  collectPublishForm();
  if (!publishSettings.owner || !publishSettings.repo || !publishSettings.branch) {
    throw new Error("请先完整填写 GitHub 仓库配置。");
  }
  if (!publishSettings.token) {
    throw new Error("请先填写 GitHub Token。");
  }
}

async function putRepoFile({ owner, repo, branch, token, path, base64Content, message, sha = "" }) {
  const payload = {
    message,
    content: base64Content,
    branch,
  };
  if (sha) payload.sha = sha;

  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeGitHubPath(path)}`;
  const response = await fetch(url, {
    method: "PUT",
    headers: githubHeaders(token),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.message || "上传文件到 GitHub 失败。");
  }
  return response.json().catch(() => ({}));
}

async function getRepoFileShaByPath({ owner, repo, branch, token, path }) {
  const ref = encodeURIComponent(branch);
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeGitHubPath(path)}?ref=${ref}`;
  const response = await fetch(url, {
    headers: githubHeaders(token),
  });

  if (response.status === 404) return "";
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.message || "读取仓库文件失败。");
  }

  const payload = await response.json();
  return payload.sha || "";
}

async function deleteRepoFile({ owner, repo, branch, token, path, sha, message }) {
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeGitHubPath(path)}`;
  const response = await fetch(url, {
    method: "DELETE",
    headers: githubHeaders(token),
    body: JSON.stringify({
      message,
      sha,
      branch,
    }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.message || "删除仓库文件失败。");
  }
  return response.json().catch(() => ({}));
}

async function getConfigFileSha(settings) {
  const configPath = (storage && storage.REMOTE_CONFIG_PATH) || "site-config.json";
  return getRepoFileShaByPath({
    owner: settings.owner,
    repo: settings.repo,
    branch: settings.branch,
    token: settings.token,
    path: configPath,
  });
}

async function publishToGitHub() {
  collectSiteForm();
  collectHeroSettings();
  collectPublishForm();
  saveCurrentRoute(false);

  if (!publishSettings.owner || !publishSettings.repo || !publishSettings.branch) {
    showMessage("save-msg", "请先完整填写 GitHub 仓库配置。", true);
    return;
  }
  if (!publishSettings.token) {
    showMessage("save-msg", "请先填写 GitHub Token。", true);
    return;
  }

  try {
    storage.saveConfig(state);
  } catch (error) {
    showMessage("save-msg", "本地保存失败，请先减少上传图片数量后重试。", true);
    return;
  }

  showMessage("save-msg", "正在推送到 GitHub...");

  try {
    const sha = await getConfigFileSha(publishSettings);
    const content = `${JSON.stringify(state, null, 2)}\n`;
    const payload = {
      message: publishSettings.commitMessage || DEFAULT_PUBLISH_SETTINGS.commitMessage,
      content: encodeUtf8Base64(content),
      branch: publishSettings.branch,
    };
    if (sha) payload.sha = sha;

    const configPath = (storage && storage.REMOTE_CONFIG_PATH) || "site-config.json";
    const path = encodeGitHubPath(configPath);
    const url = `https://api.github.com/repos/${encodeURIComponent(publishSettings.owner)}/${encodeURIComponent(publishSettings.repo)}/contents/${path}`;
    const response = await fetch(url, {
      method: "PUT",
      headers: githubHeaders(publishSettings.token),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.message || "推送失败，请检查 Token 与仓库权限。");
    }

    showMessage("save-msg", "已推送到 GitHub，Cloudflare Pages 将自动开始部署。");
  } catch (error) {
    showMessage("save-msg", `推送失败：${error.message || "未知错误"}`, true);
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

function loadImageFromUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image-load-failed"));
    img.src = url;
  });
}

async function compressImageFileToBase64(file, maxEdge = 4096, quality = 0.92) {
  const objectUrl = URL.createObjectURL(file);
  let img;
  try {
    img = await loadImageFromUrl(objectUrl);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }

  const ratio = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
  const targetW = Math.max(1, Math.round(img.naturalWidth * ratio));
  const targetH = Math.max(1, Math.round(img.naturalHeight * ratio));

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas-context-failed");
  ctx.drawImage(img, 0, 0, targetW, targetH);

  const blob = await new Promise((resolve) => {
    canvas.toBlob((value) => resolve(value), "image/jpeg", quality);
  });

  if (!blob) {
    const fallback = canvas.toDataURL("image/jpeg", quality);
    const commaIndex = fallback.indexOf(",");
    if (commaIndex === -1) throw new Error("encode-failed");
    return fallback.slice(commaIndex + 1);
  }

  const bytes = new Uint8Array(await blob.arrayBuffer());
  return encodeBinaryBase64(bytes);
}

async function uploadRoutePhotoToGitHub(route, file) {
  validateGitHubPublishSettings();
  const uploadPath = buildUploadAssetPath(route, file.name);
  const base64 = await compressImageFileToBase64(file, 4096, 0.92);
  await putRepoFile({
    owner: publishSettings.owner,
    repo: publishSettings.repo,
    branch: publishSettings.branch,
    token: publishSettings.token,
    path: uploadPath,
    base64Content: base64,
    message: `chore: upload photo ${extractFileName(file.name)} for ${route.name || route.id}`,
  });
  return `./${uploadPath}`;
}

function countAssetReferences(path) {
  const normalized = normalizeAssetPath(path);
  if (!normalized) return 0;

  let count = 0;
  state.routes.forEach((route) => {
    if (normalizeAssetPath(route.cover) === normalized) count += 1;
    (route.photos || []).forEach((photo) => {
      if (normalizeAssetPath(photo) === normalized) count += 1;
    });
  });
  (state.hero.slides || []).forEach((slide) => {
    if (normalizeAssetPath(slide.src) === normalized) count += 1;
  });

  return count;
}

async function deleteUploadedPhotoFromGitHub(photoPath) {
  validateGitHubPublishSettings();
  const repoPath = normalizeAssetPath(photoPath);
  const sha = await getRepoFileShaByPath({
    owner: publishSettings.owner,
    repo: publishSettings.repo,
    branch: publishSettings.branch,
    token: publishSettings.token,
    path: repoPath,
  });
  if (!sha) return false;

  await deleteRepoFile({
    owner: publishSettings.owner,
    repo: publishSettings.repo,
    branch: publishSettings.branch,
    token: publishSettings.token,
    path: repoPath,
    sha,
    message: `chore: remove uploaded photo ${extractFileName(repoPath)}`,
  });
  return true;
}

async function uploadPhotosToCurrentRoute() {
  const route = getActiveRoute();
  const input = byId("r-upload-files");
  const uploadBtn = byId("r-upload-btn");
  if (!route || !input || !input.files || input.files.length === 0) {
    showMessage("save-msg", "请先选择要上传的图片。", true);
    return;
  }

  const files = Array.from(input.files);
  if (uploadBtn) uploadBtn.disabled = true;
  let successCount = 0;
  try {
    validateGitHubPublishSettings();
    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
      showMessage("save-msg", `正在上传 ${i + 1}/${files.length}: ${extractFileName(file.name)}...`);
      try {
        const uploadedPath = await uploadRoutePhotoToGitHub(route, file);
        route.photos.push(uploadedPath);
        successCount += 1;
      } catch (error) {
        // Skip broken file and continue with remaining files
      }
    }
  } catch (error) {
    showMessage("save-msg", error.message || "上传前校验失败。", true);
    if (uploadBtn) uploadBtn.disabled = false;
    return;
  }

  route.photos = Array.from(new Set(route.photos));
  syncRoutePhotosTextarea(route);
  renderRoutePhotoList(route);
  fillRouteForm(route.id);
  populateSlidePhotoOptions();
  refreshOverview();
  input.value = "";
  if (uploadBtn) uploadBtn.disabled = false;
  if (successCount > 0) {
    showMessage(
      "save-msg",
      `已上传 ${successCount} 张到仓库并加入当前路线。下一步请点“保存并推送到 GitHub”发布配置。`,
    );
  } else {
    showMessage("save-msg", "上传失败：请检查 Token 权限、网络，或重试。", true);
  }
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
  applyPublishForm();
  populateRoutePicker();
  if (activeRouteId) fillRouteForm(activeRouteId);
  populateSlideRouteOptions();
  renderSlidesTable();
  refreshOverview();
}

async function refreshStateFromRuntime() {
  if (storage && typeof storage.getRuntimeConfig === "function") {
    state = await storage.getRuntimeConfig({ preferRemote: true, includeLocal: true });
  } else {
    state = storage.getConfig();
  }
  if (!state.routes.some((route) => route.id === activeRouteId)) {
    activeRouteId = state.routes[0] ? state.routes[0].id : "";
  }
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
  byId("r-photos").addEventListener("blur", () => {
    const route = getActiveRoute();
    if (!route) return;
    const manualPhotos = parseTextareaPhotos(byId("r-photos").value);
    const uploadedPhotos = (route.photos || []).filter((photo) => isDataUrl(photo));
    route.photos = Array.from(new Set([...manualPhotos, ...uploadedPhotos]));
    syncRoutePhotosTextarea(route);
  });

  byId("build-20-landscape").addEventListener("click", async () => {
    await buildLandscapeSlides(20);
  });

  byId("save-all-btn").addEventListener("click", saveAll);
  byId("publish-github-btn").addEventListener("click", publishToGitHub);
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
  const openAdminPanel = async () => {
    await refreshStateFromRuntime();
    publishSettings = loadPublishSettings();
    byId("admin-panel").classList.remove("hidden");
    byId("login-card").classList.add("hidden");
    byId("login-msg").textContent = "";
    hydrateAll();
  };

  byId("login-btn").addEventListener("click", async () => {
    const pass = byId("login-passcode").value;
    if (pass !== getCurrentPasscode()) {
      setAdminLoggedIn(false);
      showMessage("login-msg", "密码错误。", true);
      return;
    }
    setAdminLoggedIn(true);
    await openAdminPanel();
  });

  if (isAdminLoggedIn()) {
    openAdminPanel();
  }
}

function init() {
  bindEvents();
  setupLogin();
}

document.addEventListener("DOMContentLoaded", init);
