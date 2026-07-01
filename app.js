(function () {
  "use strict";

  const THEME_STORAGE_KEY = "url-diff-theme";
  const COPY_LABEL = "Kopiuj";
  const COPY_SUCCESS_LABEL = "Skopiowano";
  const COPY_ERROR_LABEL = "Blad";
  let currentResult = {
    uniqueA: [],
    uniqueB: [],
    common: [],
    invalidA: [],
    invalidB: [],
  };

  function getPreferredTheme() {
    if (typeof window === "undefined") {
      return "light";
    }

    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme === "light" || savedTheme === "dark") {
      return savedTheme;
    }

    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function applyTheme(theme) {
    const safeTheme = theme === "dark" ? "dark" : "light";
    document.documentElement.dataset.theme = safeTheme;

    const themeButton = document.getElementById("themeButton");
    if (themeButton) {
      const isDark = safeTheme === "dark";
      themeButton.textContent = isDark ? "\u2600" : "\u263e";
      themeButton.setAttribute("aria-label", isDark ? "W\u0142\u0105cz jasny motyw" : "W\u0142\u0105cz ciemny motyw");
      themeButton.setAttribute("title", isDark ? "W\u0142\u0105cz jasny motyw" : "W\u0142\u0105cz ciemny motyw");
    }
  }

  function toggleTheme() {
    const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    applyTheme(nextTheme);
  }

  function normalizeUrl(raw) {
    const trimmed = raw.trim();

    if (!trimmed) {
      return { status: "empty" };
    }

    const url = parseUrl(trimmed);
    if (!url) {
      return { status: "invalid", original: trimmed };
    }

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return { status: "invalid", original: trimmed };
    }

    let hostname = url.hostname.toLowerCase();
    if (hostname.startsWith("www.")) {
      hostname = hostname.slice(4);
    }

    const port = url.port && url.port !== "80" && url.port !== "443" ? `:${url.port}` : "";

    return {
      status: "ok",
      key: `${hostname}${port}`,
      original: trimmed,
    };
  }

  function parseUrl(trimmed) {
    try {
      const parsedUrl = new URL(trimmed);

      if (parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:") {
        return parsedUrl;
      }

      if (trimmed.includes("://")) {
        return parsedUrl;
      }
    } catch {
      return parseUrlWithoutProtocol(trimmed);
    }

    return parseUrlWithoutProtocol(trimmed);
  }

  function parseUrlWithoutProtocol(trimmed) {
    const schemeLikePrefix = trimmed.match(/^([a-z][a-z\d+\-.]*):/i);
    if (schemeLikePrefix && !schemeLikePrefix[1].includes(".")) {
      return null;
    }

    try {
      const urlWithoutProtocol = new URL(`https://${trimmed}`);
      const hostname = urlWithoutProtocol.hostname.toLowerCase().replace(/^www\./, "");

      if (!hostname.includes(".")) {
        return null;
      }

      return urlWithoutProtocol;
    } catch {
      return null;
    }
  }

  function buildMap(input) {
    const map = new Map();
    const invalid = [];

    input.split(/\r?\n/).forEach((line) => {
      const normalized = normalizeUrl(line);

      if (normalized.status === "empty") {
        return;
      }

      if (normalized.status === "invalid") {
        invalid.push(normalized.original);
        return;
      }

      const current = map.get(normalized.key);
      if (current) {
        current.count += 1;
      } else {
        map.set(normalized.key, { original: normalized.original, count: 1 });
      }
    });

    return { map, invalid };
  }

  function diffUrls(inputA, inputB) {
    const parsedA = buildMap(inputA);
    const parsedB = buildMap(inputB);
    const uniqueA = [];
    const uniqueB = [];
    const common = [];

    parsedA.map.forEach((infoA, key) => {
      if (parsedB.map.has(key)) {
        common.push(infoA.original);
      } else {
        uniqueA.push(infoA.original);
      }
    });

    parsedB.map.forEach((infoB, key) => {
      if (!parsedA.map.has(key)) {
        uniqueB.push(infoB.original);
      }
    });

    return {
      uniqueA,
      uniqueB,
      common,
      invalidA: parsedA.invalid,
      invalidB: parsedB.invalid,
    };
  }

  function renderList(element, values) {
    element.replaceChildren();

    if (!values.length) {
      const template = document.getElementById("emptyTemplate");
      element.append(template.content.firstElementChild.cloneNode(true));
      return;
    }

    values.forEach((value) => {
      const item = document.createElement("li");
      item.textContent = value;
      element.append(item);
    });
  }

  function setCount(id, count) {
    document.getElementById(id).textContent = String(count);
  }

  function renderResult(result) {
    currentResult = result;

    renderList(document.getElementById("uniqueA"), result.uniqueA);
    renderList(document.getElementById("uniqueB"), result.uniqueB);
    renderList(document.getElementById("common"), result.common);
    renderList(document.getElementById("invalidA"), result.invalidA);
    renderList(document.getElementById("invalidB"), result.invalidB);

    setCount("countA", result.uniqueA.length);
    setCount("countB", result.uniqueB.length);
    setCount("countCommon", result.common.length);
    setCount("countInvalid", result.invalidA.length + result.invalidB.length);

    const summary = document.getElementById("summary");
    summary.textContent =
      `${result.uniqueA.length} unikalne w A, ` +
      `${result.uniqueB.length} unikalne w B, ` +
      `${result.common.length} wsp\u00f3lne.`;

    updateCopyButtons(result);
  }

  function updateCopyButtons(result) {
    document.querySelectorAll("[data-copy-group]").forEach((button) => {
      const group = button.dataset.copyGroup;
      const values = result[group] || [];

      button.disabled = values.length === 0;
      button.textContent = COPY_LABEL;
    });
  }

  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.append(textarea);
    textarea.select();

    try {
      if (!document.execCommand("copy")) {
        throw new Error("Copy command failed.");
      }
    } finally {
      textarea.remove();
    }
  }

  async function handleCopyClick(event) {
    const button = event.currentTarget;
    const group = button.dataset.copyGroup;
    const values = currentResult[group] || [];

    if (!values.length) {
      return;
    }

    button.disabled = true;

    try {
      await copyText(values.join("\n"));
      button.textContent = COPY_SUCCESS_LABEL;
    } catch {
      button.textContent = COPY_ERROR_LABEL;
    }

    window.setTimeout(() => {
      button.textContent = COPY_LABEL;
      button.disabled = values.length === 0;
    }, 1600);
  }

  function bindUi() {
    const inputA = document.getElementById("inputA");
    const inputB = document.getElementById("inputB");

    applyTheme(getPreferredTheme());

    document.getElementById("themeButton").addEventListener("click", toggleTheme);
    document.querySelectorAll("[data-copy-group]").forEach((button) => {
      button.addEventListener("click", handleCopyClick);
    });

    document.getElementById("compareButton").addEventListener("click", () => {
      renderResult(diffUrls(inputA.value, inputB.value));
    });

    document.getElementById("clearButton").addEventListener("click", () => {
      inputA.value = "";
      inputB.value = "";
      renderResult(diffUrls("", ""));
      inputA.focus();
    });

    renderResult(diffUrls("", ""));
  }

  if (typeof window !== "undefined") {
    window.urlDiffTool = { normalizeUrl, diffUrls, getPreferredTheme, applyTheme };
    window.addEventListener("DOMContentLoaded", bindUi);
  }

  if (typeof module !== "undefined") {
    module.exports = { normalizeUrl, diffUrls };
  }
})();
