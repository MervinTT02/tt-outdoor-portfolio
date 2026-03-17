const storage = window.TTStorage;
const PASSCODE_KEY = "tt_admin_passcode";
const DEFAULT_PASSCODE = "Zxcvbnm123.";
const ADMIN_AUTH_KEY = "tt_admin_logged_in_v1";
const PUBLISH_SETTINGS_KEY = "tt_publish_settings_v1";
const UPLOAD_SETTINGS_KEY = "tt_upload_settings_v1";
const REPO_UPLOAD_PREFIX = "uploads/";
const CLOUDFLARE_IMAGES_HOST = "imagedelivery.net";

const DEFAULT_PUBLISH_SETTINGS = {
  owner: "MervinTT02",
  repo: "tt-outdoor-portfolio",
  branch: "main",
  token: "",
};
const DEFAULT_PUBLISH_COMMIT_MESSAGE = "chore: update site config from admin panel";

const DEFAULT_UPLOAD_SETTINGS = {
  provider: "github",
  cloudflareAccountId: "",
  cloudflareImagesToken: "",
};

let state = storage.getConfig();
let activeRouteId = state.routes[0] ? state.routes[0].id : "";
let publishSettings = loadPublishSettings();
let uploadSettings = loadUploadSettings();

function byId(id) {
  return document.getElementById(id);
}

function deepClone(value) {
  return storage.deepClone(value);
}

function normalizePasscode(value) {
  const text = String(value || "").trim();
  return text || DEFAULT_PASSCODE;
}

function ensureAdminConfig(target = state) {
  if (!target || typeof target !== "object") return;
  if (!target.admin || typeof target.admin !== "object") {
    target.admin = {};
  }
  const fallback = localStorage.getItem(PASSCODE_KEY) || getCookieValue(PASSCODE_KEY) || DEFAULT_PASSCODE;
  target.admin.passcode = normalizePasscode(target.admin.passcode || fallback);
}

function getCookieValue(key) {
  const prefix = `${key}=`;
  const found = document.cookie.split("; ").find((item) => item.startsWith(prefix));
  return found ? decodeURIComponent(found.slice(prefix.length)) : "";
}

function getCurrentPasscode() {
  const statePass = String(state && state.admin ? state.admin.passcode || "" : "").trim();
  if (statePass) return statePass;
  return localStorage.getItem(PASSCODE_KEY) || getCookieValue(PASSCODE_KEY) || DEFAULT_PASSCODE;
}

function setCurrentPasscode(value, options = {}) {
  const safeValue = normalizePasscode(value);
  if (options.syncState !== false) {
    ensureAdminConfig(state);
    state.admin.passcode = safeValue;
  }
  localStorage.setItem(PASSCODE_KEY, safeValue);
  document.cookie = `${PASSCODE_KEY}=${encodeURIComponent(safeValue)}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
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

function showMessage(id, text, isError = false) {
  const node = byId(id);
  if (!node) return;
  node.textContent = text;
  node.style.color = isError ? "#cc2842" : "#1f50b7";
}

function setInputValue(id, value) {
  const node = byId(id);
  if (!node || typeof node.value !== "string") return;
  node.value = value;
}

function getInputValue(id, fallback = "") {
  const node = byId(id);
  if (!node || typeof node.value !== "string") return fallback;
  return node.value;
}

function sanitizePhotoList(photos) {
  const seen = new Set();
  const result = [];
  (Array.isArray(photos) ? photos : []).forEach((photo) => {
    const text = String(photo || "").trim();
    if (!text || seen.has(text)) return;
    seen.add(text);
    result.push(text);
  });
  return result;
}

function sanitizeAllRoutes() {
  state.routes = (state.routes || []).map((route) => ({ ...route, photos: sanitizePhotoList(route.photos) }));
}

function toAssetSrc(path) {
  if (typeof path !== "string") return "";
  if (path.startsWith("data:")) return path;
  return encodeURI(path);
}

function escapeHtmlAttr(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function getUrlParam(path, key) {
  try {
    const url = new URL(String(path || ""), window.location.origin);
    return url.searchParams.get(key) || "";
  } catch (error) {
    return "";
  }
}

function extractFileName(path) {
  const text = String(path || "").trim();
  if (!text) return "";
  const named = getUrlParam(text, "n");
  if (named) return named;
  const normalized = text.replace(/\\/g, "/");
  const withoutQuery = normalized.split(/[?#]/)[0];
  const segment = withoutQuery.split("/").pop() || withoutQuery;
  try {
    return decodeURIComponent(segment);
  } catch (error) {
    return segment;
  }
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
  const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}-${String(date.getHours()).padStart(2, "0")}${String(date.getMinutes()).padStart(2, "0")}${String(date.getSeconds()).padStart(2, "0")}`;
  const random = Math.random().toString(36).slice(2, 7);
  const base = normalizeUploadBaseName(fileName);
  const routeFolder = route && route.id ? route.id : "route";
  return `${REPO_UPLOAD_PREFIX}${routeFolder}/${stamp}-${random}-${base}.jpg`;
}

function normalizeAssetPath(path) {
  const text = String(path || "").trim();
  if (!text) return "";
  const withoutQuery = text.split(/[?#]/)[0];
  return withoutQuery.replace(/^\.\/+/, "");
}

function buildGitHubRawAssetUrl(path) {
  const repoPath = normalizeAssetPath(path);
  if (!repoPath) return "";
  if (!publishSettings.owner || !publishSettings.repo || !publishSettings.branch) return "";
  const encoded = encodeGitHubPath(repoPath);
  return `https://raw.githubusercontent.com/${encodeURIComponent(
    publishSettings.owner,
  )}/${encodeURIComponent(publishSettings.repo)}/${encodeURIComponent(publishSettings.branch)}/${encoded}`;
}

function isRepoManagedUploadPhoto(path) {
  return normalizeAssetPath(path).startsWith(REPO_UPLOAD_PREFIX);
}

function isCloudflareManagedUploadPhoto(path) {
  return Boolean(getUrlParam(path, "cfid"));
}

function getActiveRoute() {
  return state.routes.find((route) => route.id === activeRouteId) || null;
}

function toRouteId(name) {
  const base =
    String(name || "")
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

function toggleNewRoutePanel(show) {
  const panel = byId("new-route-panel");
  if (!panel) return;
  panel.classList.toggle("hidden", !show);
}

function resetNewRouteForm() {
  setInputValue("nr-name", "");
  setInputValue("nr-location", "");
  setInputValue("nr-effort", "");
  setInputValue("nr-highlight", "");
}

function openCreateRoutePanel() {
  resetNewRouteForm();
  toggleNewRoutePanel(true);
  const nameInput = byId("nr-name");
  if (nameInput) nameInput.focus();
}

function createRouteFromPanel() {
  const name = getInputValue("nr-name", "").trim();
  if (!name) {
    showMessage("save-msg", "请先填写路线名称", true);
    return;
  }

  const route = {
    id: toRouteId(name),
    name,
    location: getInputValue("nr-location", "").trim(),
    effort: getInputValue("nr-effort", "").trim(),
    highlight: getInputValue("nr-highlight", "").trim(),
    cover: "",
    photos: [],
  };

  state.routes.push(route);
  activeRouteId = route.id;
  toggleNewRoutePanel(false);
  populateRoutePicker();
  fillRouteContentForm(route);
  renderRoutePhotoList();
  showMessage("save-msg", `已新建路线：${name}，记得点击“发布到 GitHub”`);
}

function fillRouteContentForm(route) {
  setInputValue("r-name", route && route.name ? route.name : "");
  setInputValue("r-location", route && route.location ? route.location : "");
  setInputValue("r-effort", route && route.effort ? route.effort : "");
  setInputValue("r-highlight", route && route.highlight ? route.highlight : "");
  populateCoverPhotoOptions(route);
}

function populateCoverPhotoOptions(route) {
  const select = byId("r-cover-select");
  if (!select) return;

  const photos = sanitizePhotoList(route && Array.isArray(route.photos) ? route.photos : []);
  const cover = route && typeof route.cover === "string" ? route.cover : "";

  select.innerHTML = "";

  const emptyOption = document.createElement("option");
  emptyOption.value = "";
  emptyOption.textContent = "不设置封面";
  select.appendChild(emptyOption);

  if (cover && !photos.includes(cover)) {
    const missingOption = document.createElement("option");
    missingOption.value = cover;
    missingOption.textContent = `当前封面(已不在本路线图片中) · ${extractFileName(cover)}`;
    select.appendChild(missingOption);
  }

  photos.forEach((photo, index) => {
    const option = document.createElement("option");
    option.value = photo;
    option.textContent = `${String(index + 1).padStart(2, "0")} · ${extractFileName(photo)}`;
    select.appendChild(option);
  });

  select.value = cover;
  const noChoice = photos.length === 0 && !cover;
  select.disabled = noChoice;
  if (noChoice) {
    emptyOption.textContent = "当前路线暂无图片（先上传图片）";
  }
}

function saveCurrentRouteContent(showNotice = true) {
  const route = getActiveRoute();
  if (!route) {
    showMessage("save-msg", "未找到当前路线，无法保存路线内容", true);
    return false;
  }

  const nextName = getInputValue("r-name", "").trim();
  if (!nextName) {
    showMessage("save-msg", "路线名称不能为空", true);
    return false;
  }

  route.name = nextName;
  route.location = getInputValue("r-location", "").trim();
  route.effort = getInputValue("r-effort", "").trim();
  route.highlight = getInputValue("r-highlight", "").trim();
  route.cover = getInputValue("r-cover-select", "").trim();

  populateRoutePicker();
  fillRouteContentForm(route);
  if (showNotice) {
    showMessage("save-msg", `已保存路线内容：${route.name}`);
  }
  return true;
}

function populateRoutePicker() {
  const picker = byId("route-picker");
  if (!picker) return;

  picker.innerHTML = state.routes.map((route) => `<option value="${route.id}">${route.name}</option>`).join("");
  if (!state.routes.some((route) => route.id === activeRouteId)) {
    activeRouteId = state.routes[0] ? state.routes[0].id : "";
  }
  picker.value = activeRouteId;
}

function renderRoutePhotoList() {
  const route = getActiveRoute();
  const container = byId("r-photo-list");
  const countNode = byId("photo-count");
  if (!container) return;
  populateCoverPhotoOptions(route);

  if (!route || !Array.isArray(route.photos) || route.photos.length === 0) {
    container.innerHTML = '<p class="message">当前路线暂无图片</p>';
    if (countNode) countNode.textContent = "0 张";
    return;
  }

  if (countNode) countNode.textContent = `${route.photos.length} 张`;

  container.innerHTML = route.photos
    .map(
      (photo, index) => `
      <article class="photo-item">
        <img src="${toAssetSrc(photo)}" alt="photo-${index}" data-photo-src="${escapeHtmlAttr(photo)}" />
        <div class="photo-meta">
          <p class="photo-name" title="${extractFileName(photo)}">${extractFileName(photo)}</p>
          <div class="photo-actions">
            <button class="btn btn-danger" data-route-photo-action="remove" data-index="${index}">删除</button>
          </div>
        </div>
      </article>
    `,
    )
    .join("");

  const images = container.querySelectorAll("img[data-photo-src]");
  images.forEach((img) => {
    img.addEventListener("error", () => {
      if (img.dataset.fallbackApplied === "1") return;
      const photoPath = img.getAttribute("data-photo-src") || "";
      if (!isRepoManagedUploadPhoto(photoPath)) return;
      const fallback = buildGitHubRawAssetUrl(photoPath);
      if (!fallback) return;
      img.dataset.fallbackApplied = "1";
      img.src = fallback;
    });
  });
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

function encodeUtf8Base64(content) {
  const bytes = new TextEncoder().encode(content);
  return encodeBinaryBase64(bytes);
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

function cloudflareHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
  };
}

function loadPublishSettings() {
  try {
    const raw = localStorage.getItem(PUBLISH_SETTINGS_KEY);
    if (!raw) return deepClone(DEFAULT_PUBLISH_SETTINGS);
    return { ...deepClone(DEFAULT_PUBLISH_SETTINGS), ...(JSON.parse(raw) || {}) };
  } catch (error) {
    return deepClone(DEFAULT_PUBLISH_SETTINGS);
  }
}

function persistPublishSettings() {
  localStorage.setItem(PUBLISH_SETTINGS_KEY, JSON.stringify(publishSettings));
}

function loadUploadSettings() {
  try {
    const raw = localStorage.getItem(UPLOAD_SETTINGS_KEY);
    if (!raw) return deepClone(DEFAULT_UPLOAD_SETTINGS);
    return { ...deepClone(DEFAULT_UPLOAD_SETTINGS), ...(JSON.parse(raw) || {}) };
  } catch (error) {
    return deepClone(DEFAULT_UPLOAD_SETTINGS);
  }
}

function persistUploadSettings() {
  localStorage.setItem(UPLOAD_SETTINGS_KEY, JSON.stringify(uploadSettings));
}

function collectProviderSettings() {
  const nextCfToken = getInputValue("cf-images-token", "").trim();
  const nextGhToken = getInputValue("gh-token", "").trim();
  uploadSettings.provider = (getInputValue("upload-provider", "github") || "github").trim();
  uploadSettings.cloudflareAccountId = getInputValue("cf-account-id", "").trim();
  if (nextCfToken) {
    uploadSettings.cloudflareImagesToken = nextCfToken;
  }
  publishSettings.owner = getInputValue("gh-owner", "").trim();
  publishSettings.repo = getInputValue("gh-repo", "").trim();
  publishSettings.branch = getInputValue("gh-branch", "main").trim() || "main";
  if (nextGhToken) {
    publishSettings.token = nextGhToken;
  }
  persistUploadSettings();
  persistPublishSettings();
}

function applyProviderSettings() {
  setInputValue("upload-provider", uploadSettings.provider || "github");
  setInputValue("cf-account-id", uploadSettings.cloudflareAccountId || "");
  setInputValue("cf-images-token", uploadSettings.cloudflareImagesToken || "");
  setInputValue("gh-owner", publishSettings.owner || "");
  setInputValue("gh-repo", publishSettings.repo || "");
  setInputValue("gh-branch", publishSettings.branch || "main");
  setInputValue("gh-token", publishSettings.token || "");
  updateUploadProviderUI();
}

function updateUploadProviderUI() {
  const provider = (getInputValue("upload-provider", "github") || "github").trim();
  const githubFields = byId("github-fields");
  const cfFields = byId("cf-fields");
  if (provider === "cloudflare-images") {
    if (cfFields) cfFields.classList.remove("hidden");
    if (githubFields) githubFields.classList.add("hidden");
  } else {
    if (githubFields) githubFields.classList.remove("hidden");
    if (cfFields) cfFields.classList.add("hidden");
  }
}

function validateGitHubSettings() {
  collectProviderSettings();
  if (!publishSettings.owner || !publishSettings.repo || !publishSettings.branch) {
    throw new Error("请先填写 GitHub Owner/Repo/Branch");
  }
  if (!publishSettings.token) {
    throw new Error("请先填写 GitHub Token");
  }
}

function validateCloudflareSettings() {
  collectProviderSettings();
  if (!uploadSettings.cloudflareAccountId) {
    throw new Error("请先填写 Cloudflare Account ID");
  }
  if (!uploadSettings.cloudflareImagesToken) {
    throw new Error("请先填写 Cloudflare Images Token");
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
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.message || "上传到 GitHub 失败");
  }
}

async function getRepoFileShaByPath({ owner, repo, branch, token, path }) {
  const ref = encodeURIComponent(branch);
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeGitHubPath(path)}?ref=${ref}`;
  const response = await fetch(url, { headers: githubHeaders(token) });

  if (response.status === 404) return "";
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.message || "读取仓库文件失败");
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
    throw new Error(payload.message || "删除 GitHub 文件失败");
  }
}

function loadImageFromUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image-load-failed"));
    img.src = url;
  });
}

async function compressImageFileToBlob(file, maxEdge = 4096, quality = 0.92) {
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

  if (!blob) throw new Error("encode-failed");
  return blob;
}

async function compressImageFileToBase64(file, maxEdge = 4096, quality = 0.92) {
  const blob = await compressImageFileToBlob(file, maxEdge, quality);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return encodeBinaryBase64(bytes);
}

async function uploadRoutePhotoToGitHub(route, file) {
  validateGitHubSettings();
  const uploadPath = buildUploadAssetPath(route, file.name);
  const base64 = await compressImageFileToBase64(file, 4096, 0.92);
  await putRepoFile({
    owner: publishSettings.owner,
    repo: publishSettings.repo,
    branch: publishSettings.branch,
    token: publishSettings.token,
    path: uploadPath,
    base64Content: base64,
    message: `chore: upload ${extractFileName(file.name)} for ${route.id}`,
  });
  return `./${uploadPath}`;
}

function buildCloudflarePhotoUrl(variantUrl, fileName, imageId) {
  const separator = variantUrl.includes("?") ? "&" : "?";
  return `${variantUrl}${separator}n=${encodeURIComponent(extractFileName(fileName))}&cfid=${encodeURIComponent(imageId)}`;
}

async function uploadRoutePhotoToCloudflareImages(route, file) {
  validateCloudflareSettings();
  const blob = await compressImageFileToBlob(file, 4096, 0.92);

  const form = new FormData();
  form.append("file", blob, `${normalizeUploadBaseName(file.name)}.jpg`);
  form.append(
    "metadata",
    JSON.stringify({ routeId: route.id || "", routeName: route.name || "", sourceName: extractFileName(file.name) }),
  );

  const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(uploadSettings.cloudflareAccountId)}/images/v1`;
  const response = await fetch(url, {
    method: "POST",
    headers: cloudflareHeaders(uploadSettings.cloudflareImagesToken),
    body: form,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) {
    const errMsg =
      (payload.errors && payload.errors[0] && payload.errors[0].message) || payload.message || "上传到 Cloudflare 失败";
    throw new Error(errMsg);
  }

  const result = payload.result || {};
  const imageId = result.id || "";
  const variants = Array.isArray(result.variants) ? result.variants : [];
  const variantUrl = variants[0] || "";
  if (!imageId || !variantUrl) {
    throw new Error("Cloudflare 返回内容缺失");
  }

  return buildCloudflarePhotoUrl(variantUrl, file.name, imageId);
}

function countAssetReferences(path) {
  const normalized = normalizeAssetPath(path);
  if (!normalized) return 0;

  let count = 0;
  (state.routes || []).forEach((route) => {
    if (normalizeAssetPath(route.cover) === normalized) count += 1;
    (route.photos || []).forEach((photo) => {
      if (normalizeAssetPath(photo) === normalized) count += 1;
    });
  });
  ((state.hero && state.hero.slides) || []).forEach((slide) => {
    if (normalizeAssetPath(slide.src) === normalized) count += 1;
  });

  return count;
}

async function deleteUploadedPhotoFromGitHub(photoPath) {
  validateGitHubSettings();
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
    message: `chore: remove ${extractFileName(repoPath)}`,
  });
  return true;
}

function getCloudflareImageId(photoPath) {
  const fromQuery = getUrlParam(photoPath, "cfid");
  if (fromQuery) return fromQuery;

  try {
    const url = new URL(String(photoPath || "").trim(), window.location.origin);
    const parts = url.pathname.split("/").filter(Boolean);
    if (url.hostname.includes(CLOUDFLARE_IMAGES_HOST) && parts.length >= 3) {
      return parts[1] || "";
    }
  } catch (error) {
    return "";
  }
  return "";
}

async function deleteUploadedPhotoFromCloudflare(photoPath) {
  validateCloudflareSettings();
  const imageId = getCloudflareImageId(photoPath);
  if (!imageId) return false;

  const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(uploadSettings.cloudflareAccountId)}/images/v1/${encodeURIComponent(imageId)}`;
  const response = await fetch(url, {
    method: "DELETE",
    headers: cloudflareHeaders(uploadSettings.cloudflareImagesToken),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) {
    const errMsg =
      (payload.errors && payload.errors[0] && payload.errors[0].message) || payload.message || "删除 Cloudflare 图片失败";
    throw new Error(errMsg);
  }
  return true;
}

async function uploadPhotosToCurrentRoute() {
  const route = getActiveRoute();
  const input = byId("r-upload-files");
  const uploadBtn = byId("r-upload-btn");

  if (!route || !input || !input.files || input.files.length === 0) {
    showMessage("save-msg", "请先选择要上传的图片", true);
    return;
  }

  collectProviderSettings();
  const files = Array.from(input.files);
  const provider = (uploadSettings.provider || "github").trim();

  if (uploadBtn) uploadBtn.disabled = true;
  let successCount = 0;
  try {
    if (provider === "cloudflare-images") {
      validateCloudflareSettings();
    } else {
      validateGitHubSettings();
    }

    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
      showMessage("save-msg", `上传中 ${i + 1}/${files.length}: ${extractFileName(file.name)}`);
      try {
        const uploadedPath =
          provider === "cloudflare-images"
            ? await uploadRoutePhotoToCloudflareImages(route, file)
            : await uploadRoutePhotoToGitHub(route, file);
        route.photos.push(uploadedPath);
        successCount += 1;
      } catch (error) {
        // Continue with remaining files.
      }
    }
  } catch (error) {
    showMessage("save-msg", error.message || "上传前校验失败", true);
    if (uploadBtn) uploadBtn.disabled = false;
    return;
  }

  route.photos = sanitizePhotoList(route.photos);
  renderRoutePhotoList();
  input.value = "";
  if (uploadBtn) uploadBtn.disabled = false;

  if (successCount > 0) {
    showMessage("save-msg", `上传完成，共成功 ${successCount} 张，请点击“发布到 GitHub”`);
  } else {
    showMessage("save-msg", "上传失败，请检查凭据或网络", true);
  }
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

  const confirmed = window.confirm(`确认删除图片：${extractFileName(photo)}？`);
  if (!confirmed) return;

  let deletedRemote = "";
  try {
    if (isRepoManagedUploadPhoto(photo) && window.confirm("是否同时删除 GitHub 仓库中的原图？")) {
      const refs = countAssetReferences(photo);
      if (refs > 1) {
        showMessage("save-msg", "该图片仍被其他位置引用，已仅从当前路线移除", true);
      } else {
        const deleted = await deleteUploadedPhotoFromGitHub(photo);
        if (deleted) deletedRemote = "github";
      }
    }

    if (isCloudflareManagedUploadPhoto(photo) && window.confirm("是否同时删除 Cloudflare Images 中的原图？")) {
      const refs = countAssetReferences(photo);
      if (refs > 1) {
        showMessage("save-msg", "该图片仍被其他位置引用，已仅从当前路线移除", true);
      } else {
        const deleted = await deleteUploadedPhotoFromCloudflare(photo);
        if (deleted) deletedRemote = "cloudflare";
      }
    }
  } catch (error) {
    const removeOnly = window.confirm(`远端删除失败：${error.message || "未知错误"}\n是否继续只移除本地引用？`);
    if (!removeOnly) return;
  }

  route.photos.splice(index, 1);
  route.photos = sanitizePhotoList(route.photos);
  if (route.cover === photo) {
    route.cover = route.photos[0] || "";
  }
  renderRoutePhotoList();

  if (deletedRemote) {
    showMessage("save-msg", `已删除图片，并清理 ${deletedRemote} 远端文件`);
  } else {
    showMessage("save-msg", "已从当前路线移除图片");
  }
}

function saveAll() {
  if (!saveCurrentRouteContent(false)) return;
  collectProviderSettings();
  sanitizeAllRoutes();
  try {
    storage.saveConfig(state);
    showMessage("save-msg", "配置已保存到本地浏览器");
  } catch (error) {
    showMessage("save-msg", "保存失败，浏览器存储空间可能不足", true);
  }
}

async function publishToGitHub() {
  const publishBtn = byId("publish-github-btn");
  if (publishBtn) publishBtn.disabled = true;

  try {
    if (!saveCurrentRouteContent(false)) return;
    collectProviderSettings();
    sanitizeAllRoutes();
    storage.saveConfig(state);
    validateGitHubSettings();

    const configPath = (storage && storage.REMOTE_CONFIG_PATH) || "site-config.json";
    const sha = await getRepoFileShaByPath({
      owner: publishSettings.owner,
      repo: publishSettings.repo,
      branch: publishSettings.branch,
      token: publishSettings.token,
      path: configPath,
    });
    const content = `${JSON.stringify(state, null, 2)}\n`;

    showMessage("save-msg", "正在发布到 GitHub...");
    await putRepoFile({
      owner: publishSettings.owner,
      repo: publishSettings.repo,
      branch: publishSettings.branch,
      token: publishSettings.token,
      path: configPath,
      base64Content: encodeUtf8Base64(content),
      message: DEFAULT_PUBLISH_COMMIT_MESSAGE,
      sha,
    });
    showMessage("save-msg", "发布成功，Cloudflare Pages 将自动开始部署");
  } catch (error) {
    showMessage("save-msg", `发布失败：${error.message || "未知错误"}`, true);
  } finally {
    if (publishBtn) publishBtn.disabled = false;
  }
}

async function refreshStateFromRuntime() {
  if (storage && typeof storage.getRuntimeConfig === "function") {
    state = await storage.getRuntimeConfig({ preferRemote: true, includeLocal: true });
  } else {
    state = storage.getConfig();
  }
  ensureAdminConfig(state);
  setCurrentPasscode(state.admin.passcode, { syncState: false });
  sanitizeAllRoutes();
  if (!state.routes.some((route) => route.id === activeRouteId)) {
    activeRouteId = state.routes[0] ? state.routes[0].id : "";
  }
}

function hydrateAll() {
  applyProviderSettings();
  populateRoutePicker();
  fillRouteContentForm(getActiveRoute());
  renderRoutePhotoList();
}

function bindEvents() {
  const on = (id, eventName, handler) => {
    const node = byId(id);
    if (!node) return;
    node.addEventListener(eventName, handler);
  };

  on("upload-provider", "change", () => {
    collectProviderSettings();
    updateUploadProviderUI();
  });
  on("route-picker", "change", (event) => {
    activeRouteId = event.target.value;
    fillRouteContentForm(getActiveRoute());
    renderRoutePhotoList();
  });
  on("r-cover-select", "change", () => {
    const route = getActiveRoute();
    if (!route) return;
    route.cover = getInputValue("r-cover-select", "").trim();
  });
  on("save-route-content-btn", "click", () => {
    saveCurrentRouteContent(true);
  });
  on("new-route-btn", "click", openCreateRoutePanel);
  on("confirm-new-route-btn", "click", createRouteFromPanel);
  on("cancel-new-route-btn", "click", () => toggleNewRoutePanel(false));
  on("new-route-panel", "keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      createRouteFromPanel();
      return;
    }
    if (event.key === "Escape") {
      toggleNewRoutePanel(false);
    }
  });
  on("r-upload-btn", "click", uploadPhotosToCurrentRoute);
  on("r-photo-list", "click", handleRoutePhotoListClick);
  on("save-all-btn", "click", saveAll);
  on("publish-github-btn", "click", publishToGitHub);
}

function setupLogin() {
  const openAdminPanel = async () => {
    await refreshStateFromRuntime();
    publishSettings = loadPublishSettings();
    uploadSettings = loadUploadSettings();
    const panel = byId("admin-panel");
    const loginCard = byId("login-card");
    if (panel) panel.classList.remove("hidden");
    if (loginCard) loginCard.classList.add("hidden");
    hydrateAll();
    showMessage("login-msg", "");
  };

  const loginBtn = byId("login-btn");
  if (loginBtn) {
    loginBtn.addEventListener("click", async () => {
      await refreshStateFromRuntime();
      const pass = getInputValue("login-passcode", "");
      if (pass !== getCurrentPasscode()) {
        setAdminLoggedIn(false);
        showMessage("login-msg", "密码错误", true);
        return;
      }
      setAdminLoggedIn(true);
      await openAdminPanel();
    });
  }

  if (isAdminLoggedIn()) {
    openAdminPanel();
  }
}

function init() {
  ensureAdminConfig(state);
  setCurrentPasscode(state.admin.passcode, { syncState: false });
  bindEvents();
  setupLogin();
}

document.addEventListener("DOMContentLoaded", init);
