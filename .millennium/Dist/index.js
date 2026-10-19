const MILLENNIUM_IS_CLIENT_MODULE = true;
(() => {
  // src/translation-store.js
  var STATE_KEY = "rioshi-plugin-translations:state-v4";
  var LEGACY_KEY = "rioshi-plugin-translations:editor-source";
  function validateDictionary(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected a JSON object");
    const entries = Object.entries(value);
    if (entries.length > 2e4) throw new Error("Dictionary exceeds 20,000 entries");
    for (const [key, text] of entries) {
      if (!key || typeof text !== "string" || ["__proto__", "constructor", "prototype"].includes(key)) {
        throw new Error("Dictionary entries must be source-text: translated-text strings");
      }
    }
    return Object.fromEntries(entries);
  }
  function createTranslationStore(storage) {
    const initialLanguage = typeof navigator !== "undefined" && !navigator.language.toLowerCase().startsWith("zh") ? "en" : "zh-CN";
    let state = { version: 1, uiLanguage: initialLanguage, language: initialLanguage, dictionaries: {} };
    try {
      const saved = JSON.parse(storage.getItem(STATE_KEY) || "null");
      if (saved?.version === 1) {
        state.uiLanguage = saved.uiLanguage === "en" ? "en" : "zh-CN";
        state.language = typeof saved.language === "string" ? saved.language : "zh-CN";
        for (const [language, dictionary] of Object.entries(saved.dictionaries || {})) {
          state.dictionaries[language] = validateDictionary(dictionary);
        }
      } else {
        const legacy = storage.getItem(LEGACY_KEY);
        if (legacy) {
          state.dictionaries["zh-CN"] = validateDictionary(JSON.parse(legacy));
          state.language = "zh-CN";
        }
      }
    } catch {
    }
    const persist = () => storage.setItem(STATE_KEY, JSON.stringify(state));
    return {
      get uiLanguage() {
        return state.uiLanguage;
      },
      get language() {
        return state.language;
      },
      getDictionary(language = state.language) {
        return state.dictionaries[language];
      },
      setUiLanguage(language) {
        state.uiLanguage = language === "en" ? "en" : "zh-CN";
        persist();
      },
      saveDictionary(language, dictionary) {
        state.dictionaries[language] = validateDictionary(dictionary);
        state.language = language;
        persist();
      },
      resetDictionary() {
        delete state.dictionaries[state.language];
        persist();
      }
    };
  }
  function githubRawBase(repository, branch = "main") {
    const match = repository.trim().match(/^(?:https:\/\/github\.com\/)?([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/);
    if (!match || !branch.trim()) throw new Error("Use owner/repository or a GitHub repository URL");
    return `https://raw.githubusercontent.com/${match[1]}/${match[2]}/${encodeURIComponent(branch.trim())}/`;
  }
  async function downloadLanguage({ repository, branch, language, fetcher = fetch }) {
    const base = githubRawBase(repository, branch);
    const response = await fetcher(`${base}locales/catalog.json`, { cache: "no-store" });
    if (!response.ok) throw new Error(`GitHub catalog: HTTP ${response.status}`);
    const catalog = await response.json();
    const item = catalog.languages?.find((item2) => item2.id === language);
    if (!item || !/^locales\/[A-Za-z0-9-]+\.json$/.test(item.path)) throw new Error("Language is not available");
    const packResponse = await fetcher(base + item.path, { cache: "no-store" });
    if (!packResponse.ok) throw new Error(`GitHub dictionary: HTTP ${packResponse.status}`);
    return validateDictionary(await packResponse.json());
  }

  // src/ui-languages.js
  var labels = {
    en: {
      title: "Translations",
      description: "Translate theme and plugin interfaces with community dictionaries.",
      apply: "Apply & save",
      format: "Format JSON",
      restore: "Restore bundled dictionary",
      loaded: "Dictionary entries: ",
      language: "Dictionary language",
      download: "Download & apply",
      done: "Saved and applied.",
      success: "Operation completed.",
      error: "Error: ",
      working: "Working\u2026",
      dirty: "Discard unsaved editor changes?"
    },
    "zh-CN": {
      title: "\u7FFB\u8BD1",
      description: "\u4F7F\u7528\u793E\u533A\u8BCD\u5178\u7FFB\u8BD1\u4E3B\u9898\u548C\u63D2\u4EF6\u754C\u9762\u3002",
      apply: "\u5E94\u7528\u5E76\u4FDD\u5B58",
      format: "\u683C\u5F0F\u5316 JSON",
      restore: "\u6062\u590D\u5185\u7F6E\u8BCD\u5178",
      loaded: "\u8BCD\u6761\u6570\u91CF\uFF1A",
      language: "\u8BCD\u5178\u8BED\u8A00",
      download: "\u4E0B\u8F7D\u5E76\u5E94\u7528",
      done: "\u5DF2\u4FDD\u5B58\u5E76\u5E94\u7528\u3002",
      success: "\u64CD\u4F5C\u5B8C\u6210\u3002",
      error: "\u9519\u8BEF\uFF1A",
      working: "\u5904\u7406\u4E2D\u2026",
      dirty: "\u653E\u5F03\u5C1A\u672A\u4FDD\u5B58\u7684\u7F16\u8F91\u5185\u5BB9\uFF1F"
    }
  };

  // src/editor.js
  function mountEditor({ documentRef: doc, host, store, catalog, defaults, initialDictionary, loadBundled, apply }) {
    let ui = labels[store.uiLanguage];
    let disposed = false;
    let busy = false;
    let lastSaved = "";
    const root = doc.createElement("section");
    root.setAttribute("data-rioshi-translation-settings", "editor");
    Object.assign(root.style, {
      position: "absolute",
      inset: "0",
      zIndex: "20",
      display: "flex",
      flexDirection: "column",
      boxSizing: "border-box",
      padding: "24px 30px",
      overflow: "auto",
      background: "#1b1b1b",
      color: "#f5f7ff"
    });
    const originalPosition = host.style.position;
    const changedPosition = doc.defaultView.getComputedStyle(host).position === "static";
    if (changedPosition) host.style.position = "relative";
    const localized = [];
    function el(tag, parent, key) {
      const node = doc.createElement(tag);
      if (key) {
        node.textContent = ui[key];
        localized.push([node, key]);
      }
      parent?.appendChild(node);
      return node;
    }
    function button(parent, key) {
      const node = el("button", parent, key);
      node.type = "button";
      Object.assign(node.style, { minHeight: "32px", padding: "4px 12px", border: "1px solid #555", borderRadius: "4px", background: "#363636", color: "#fff", cursor: "pointer", font: "inherit" });
      return node;
    }
    function field(parent, key, value, type = "text") {
      const label = el("label", parent);
      Object.assign(label.style, { display: "flex", flexDirection: "column", gap: "5px", flex: "1", minWidth: "140px" });
      el("span", label, key);
      const input = el("input", label);
      input.type = type;
      input.value = value || "";
      Object.assign(input.style, { padding: "7px", background: "#252525", color: "#fff", border: "1px solid #555", borderRadius: "4px", minWidth: "0" });
      return input;
    }
    function row(parent) {
      const node = el("div", parent);
      Object.assign(node.style, { display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "10px", alignItems: "center" });
      return node;
    }
    const header = row(root);
    const title = el("h1", header, "title");
    title.style.margin = "0";
    const uiSelect = el("select", header);
    uiSelect.setAttribute("aria-label", "Interface language");
    Object.assign(uiSelect.style, { marginLeft: "auto", background: "#363636", color: "#fff", padding: "7px", borderRadius: "4px" });
    for (const [value, text] of [["zh-CN", "\u7B80\u4F53\u4E2D\u6587"], ["en", "English"]]) {
      const option = el("option", uiSelect);
      option.value = value;
      option.textContent = text;
    }
    uiSelect.value = store.uiLanguage;
    const description = el("p", root, "description");
    description.style.margin = "0 0 12px";
    const toolbar = row(root);
    const applyButton = button(toolbar, "apply");
    const formatButton = button(toolbar, "format");
    const restoreButton = button(toolbar, "restore");
    const languageLabel = el("label", toolbar, "language");
    languageLabel.style.marginLeft = "auto";
    const language = el("select", toolbar);
    Object.assign(language.style, { background: "#363636", color: "#fff", padding: "7px" });
    for (const item of catalog.languages) {
      const option = el("option", language);
      option.value = item.id;
      option.textContent = item.name;
    }
    language.value = store.language;
    const downloadButton = button(toolbar, "download");
    const status = el("div", root);
    Object.assign(status.style, { margin: "10px 0", minHeight: "18px", color: "#66c0f4", fontSize: "12px" });
    const box = el("div", root);
    Object.assign(box.style, { display: "flex", flex: "1 0 260px", minHeight: "260px", overflow: "hidden", border: "1px solid #444", borderRadius: "6px" });
    const gutter = el("pre", box);
    const textarea = el("textarea", box);
    textarea.wrap = "off";
    textarea.spellcheck = false;
    textarea.setAttribute("aria-label", "Translation dictionary JSON");
    const font = '"Maple Mono Normal NF CN", Consolas, monospace';
    Object.assign(gutter.style, { margin: "0", padding: "14px 10px", width: "40px", flexShrink: "0", overflow: "hidden", color: "#777", fontFamily: font, fontSize: "12px", lineHeight: "1.55", textAlign: "right", userSelect: "none" });
    Object.assign(textarea.style, { boxSizing: "border-box", flex: "1", minWidth: "0", height: "100%", minHeight: "260px", padding: "14px", resize: "none", outline: "none", border: "0", background: "#121212", color: "#eee", fontFamily: font, fontSize: "12px", lineHeight: "1.55" });
    const lines = () => {
      gutter.textContent = Array.from({ length: textarea.value.split(/\r\n|\r|\n/).length }, (_, i) => i + 1).join("\n");
    };
    const message = (text, error = false) => {
      if (!disposed) {
        status.textContent = text;
        status.style.color = error ? "#ff7b86" : "#66c0f4";
      }
    };
    function showDictionary(dictionary) {
      textarea.value = JSON.stringify(dictionary || {}, null, 2);
      lastSaved = textarea.value;
      lines();
      message(ui.loaded + Object.keys(dictionary || {}).length);
      language.value = store.language;
    }
    const allButtons = [applyButton, formatButton, restoreButton, downloadButton];
    async function run(operation) {
      if (busy) return;
      busy = true;
      allButtons.forEach((node) => {
        node.disabled = true;
      });
      language.disabled = true;
      message(ui.working);
      try {
        await operation();
      } catch (error) {
        message(ui.error + error.message, true);
      } finally {
        busy = false;
        allButtons.forEach((node) => {
          node.disabled = false;
        });
        language.disabled = false;
      }
    }
    const mayReplace = () => textarea.value === lastSaved || doc.defaultView.confirm(ui.dirty);
    textarea.addEventListener("input", lines);
    textarea.addEventListener("scroll", () => {
      gutter.scrollTop = textarea.scrollTop;
    });
    uiSelect.addEventListener("change", () => {
      store.setUiLanguage(uiSelect.value);
      ui = labels[store.uiLanguage];
      for (const [node, key] of localized) node.textContent = ui[key];
      message(ui.loaded + Object.keys(store.getDictionary() || {}).length);
    });
    applyButton.addEventListener("click", () => run(async () => {
      const dictionary = validateDictionary(JSON.parse(textarea.value));
      store.saveDictionary(language.value, dictionary);
      apply(dictionary);
      showDictionary(dictionary);
      message(ui.done);
    }));
    formatButton.addEventListener("click", () => run(async () => {
      textarea.value = JSON.stringify(validateDictionary(JSON.parse(textarea.value)), null, 2);
      lines();
      message(ui.success);
    }));
    restoreButton.addEventListener("click", () => run(async () => {
      if (!mayReplace()) return;
      const dictionary = await loadBundled(language.value);
      store.saveDictionary(language.value, dictionary);
      apply(dictionary);
      showDictionary(dictionary);
    }));
    language.addEventListener("change", () => run(async () => {
      if (!mayReplace()) {
        language.value = store.language;
        return;
      }
      const dictionary = store.getDictionary(language.value) || await loadBundled(language.value);
      store.saveDictionary(language.value, dictionary);
      apply(dictionary);
      showDictionary(dictionary);
    }));
    downloadButton.addEventListener("click", () => run(async () => {
      if (!mayReplace()) return;
      const selected = language.value;
      const dictionary = await downloadLanguage({ repository: defaults.repository, branch: defaults.branch, language: selected });
      if (disposed) return;
      store.saveDictionary(selected, dictionary);
      apply(dictionary);
      showDictionary(dictionary);
      message(ui.success);
    }));
    showDictionary(store.getDictionary() || initialDictionary);
    host.appendChild(root);
    return { overlay: root, dispose() {
      disposed = true;
      root.remove();
      if (changedPosition && host.style.position === "relative") host.style.position = originalPosition;
    } };
  }

  // locales/catalog.json
  var catalog_default = {
    version: 1,
    sourceLanguage: "en",
    languages: [
      {
        id: "en",
        name: "English",
        full: true,
        path: "locales/en.json",
        entries: 1985,
        status: "source-text"
      },
      {
        id: "zh-CN",
        name: "\u7B80\u4F53\u4E2D\u6587",
        full: true,
        path: "locales/zh-CN.json",
        entries: 1914,
        status: "partial-catalog-coverage"
      },
      {
        id: "es",
        name: "Espa\xF1ol",
        path: "locales/es.json",
        entries: 1892,
        status: "partial-catalog-coverage"
      },
      {
        id: "fr",
        name: "Fran\xE7ais",
        path: "locales/fr.json",
        entries: 1891,
        status: "partial-catalog-coverage"
      },
      {
        id: "de",
        name: "Deutsch",
        path: "locales/de.json",
        entries: 1891,
        status: "partial-catalog-coverage"
      },
      {
        id: "pt-BR",
        name: "Portugu\xEAs (Brasil)",
        path: "locales/pt-BR.json",
        entries: 1891,
        status: "partial-catalog-coverage"
      },
      {
        id: "ja",
        name: "\u65E5\u672C\u8A9E",
        path: "locales/ja.json",
        entries: 1891,
        status: "partial-catalog-coverage"
      }
    ]
  };

  // remote-config.json
  var remote_config_default = {
    repository: "JIUYINGSHI/rioshi-translations",
    branch: "main"
  };

  // src/runtime.js
  var pluginName = "rioshi-plugin-translations";
  (window.PLUGIN_LIST ||= {})[pluginName] ||= {};
  var PluginEntryPointMain = (() => {
    "use strict";
    const store = createTranslationStore(localStorage);
    const observedDocuments = /* @__PURE__ */ new WeakSet();
    const documents = /* @__PURE__ */ new Set();
    const disposables = /* @__PURE__ */ new Set();
    const textState = /* @__PURE__ */ new WeakMap();
    const attributeState = /* @__PURE__ */ new WeakMap();
    let translations = {};
    let phraseEntries = [];
    let pluginBaseUrl = "";
    let lastFileSource = "";
    let activeSource = "";
    let editorState = null;
    let dictionaryRevision = 0;
    function getPluginBaseUrl() {
      const script = document.querySelector(`script[src*="${pluginName}"]`);
      if (!script) return "";
      return new URL(script.src).href.replace(/\.millennium\/Dist\/index\.js(?:\?.*)?$/, "");
    }
    function isTranslationScope(element) {
      if (!element?.closest) return false;
      if (element.closest("[data-rioshi-translation-settings]")) return false;
      return Boolean(element.closest([
        ".MillenniumSettings",
        ".DialogBody",
        "[data-rioshi-translation-settings]"
      ].join(",")));
    }
    function translateString(value) {
      if (!value || typeof value !== "string") return value;
      if (Object.prototype.hasOwnProperty.call(translations, value)) return translations[value];
      let result = value;
      for (const [source, target] of phraseEntries) {
        if (result.includes(source)) result = result.split(source).join(target);
      }
      return result;
    }
    function translateTextNode(node) {
      const parent = node.parentElement;
      if (!parent || !isTranslationScope(parent)) return;
      if (["SCRIPT", "STYLE", "CODE", "PRE", "TEXTAREA"].includes(parent.tagName)) return;
      const current = node.nodeValue;
      const previous = textState.get(node);
      if (previous && current === previous.output && previous.revision === dictionaryRevision) return;
      const source = previous && (current === previous.source || current === previous.output) ? previous.source : current;
      const output = translateString(source);
      textState.set(node, { source, output, revision: dictionaryRevision });
      if (output !== current) node.nodeValue = output;
    }
    function translateElement(element) {
      if (!element || element.nodeType !== 1 || !isTranslationScope(element)) return;
      const state = attributeState.get(element) || /* @__PURE__ */ new Map();
      for (const name of ["title", "placeholder", "aria-label", "data-tooltip-text"]) {
        if (!element.hasAttribute(name)) continue;
        const current = element.getAttribute(name);
        const previous = state.get(name);
        if (previous && current === previous.output && previous.revision === dictionaryRevision) continue;
        const source = previous && (current === previous.source || current === previous.output) ? previous.source : current;
        const output = translateString(source);
        state.set(name, { source, output, revision: dictionaryRevision });
        if (output !== current) element.setAttribute(name, output);
      }
      attributeState.set(element, state);
    }
    function translateTree(root) {
      if (!root) return;
      const documentRef = root.ownerDocument || root;
      const NodeRef = documentRef.defaultView?.Node || Node;
      if (root.nodeType === NodeRef.TEXT_NODE) {
        translateTextNode(root);
        return;
      }
      if (root.nodeType !== NodeRef.ELEMENT_NODE && root.nodeType !== NodeRef.DOCUMENT_NODE) return;
      if (root.nodeType === NodeRef.ELEMENT_NODE) translateElement(root);
      const walker = documentRef.createTreeWalker(root, 1 | 4);
      let node;
      while (node = walker.nextNode()) {
        if (node.nodeType === NodeRef.TEXT_NODE) translateTextNode(node);
        else translateElement(node);
      }
    }
    function refreshTranslatedNodes() {
      for (const documentRef of documents) {
        for (const root of documentRef.querySelectorAll([
          ".MillenniumSettings",
          ".DialogBody",
          "[data-rioshi-translation-settings]"
        ].join(","))) translateTree(root);
      }
    }
    function installDictionary(nextTranslations, source) {
      translations = nextTranslations;
      dictionaryRevision += 1;
      phraseEntries = Object.entries(translations).filter(([key]) => key.length >= 8).sort((a, b) => b[0].length - a[0].length);
      activeSource = source;
      refreshTranslatedNodes();
    }
    function validateDictionary2(value) {
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error("\u8BCD\u5178\u6839\u8282\u70B9\u5FC5\u987B\u662F JSON \u5BF9\u8C61");
      }
      for (const [source, target] of Object.entries(value)) {
        if (!source || typeof target !== "string") {
          throw new Error("\u6BCF\u4E2A\u8BCD\u6761\u90FD\u5FC5\u987B\u662F\u82F1\u6587\u539F\u6587\u4E0E\u4E2D\u6587\u8BD1\u6587\u5B57\u7B26\u4E32");
        }
      }
      return value;
    }
    async function reloadTranslations(force = false) {
      const response = await fetch(`${pluginBaseUrl}translations.json?hot=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const fileSource = await response.text();
      if (!force && fileSource === lastFileSource) return false;
      lastFileSource = fileSource;
      const bundled = await loadBundled(store.language);
      const fallback = store.language === "zh-CN" ? { ...bundled, ...validateDictionary(JSON.parse(fileSource)) } : bundled;
      const source = JSON.stringify(store.getDictionary() || fallback);
      if (!force && source === activeSource) return false;
      installDictionary(validateDictionary2(JSON.parse(source)), source);
      return true;
    }
    function observeDocument(documentRef) {
      if (!documentRef || observedDocuments.has(documentRef)) return;
      observedDocuments.add(documentRef);
      documents.add(documentRef);
      const onNavigation = (event) => handleNavigation(event, documentRef);
      documentRef.addEventListener("pointerdown", onNavigation, true);
      documentRef.addEventListener("click", onNavigation, true);
      disposables.add({ dispose: () => {
        documentRef.removeEventListener("pointerdown", onNavigation, true);
        documentRef.removeEventListener("click", onNavigation, true);
      } });
      const start = () => {
        if (!documentRef.documentElement) return;
        refreshTranslatedNodes();
        const Observer = documentRef.defaultView?.MutationObserver || MutationObserver;
        const observer = new Observer((mutations) => {
          for (const mutation of mutations) {
            if (mutation.type === "characterData") translateTextNode(mutation.target);
            for (const node of mutation.addedNodes) translateTree(node);
          }
        });
        observer.observe(documentRef.documentElement, { subtree: true, childList: true, characterData: true });
        disposables.add({ dispose: () => observer.disconnect() });
      };
      if (documentRef.documentElement) start();
      else documentRef.addEventListener("DOMContentLoaded", start, { once: true });
    }
    function makeButton(documentRef, label) {
      const button = documentRef.createElement("button");
      button.type = "button";
      button.textContent = label;
      Object.assign(button.style, {
        minHeight: "34px",
        padding: "0 14px",
        border: "1px solid rgba(255,255,255,.12)",
        borderRadius: "4px",
        background: "rgba(255,255,255,.10)",
        color: "#fff",
        font: "inherit",
        cursor: "pointer"
      });
      return button;
    }
    function closeEditor() {
      if (!editorState) return;
      editorState.dispose();
      editorState = null;
    }
    async function loadBundled(language) {
      const item = catalog_default.languages.find((item2) => item2.id === language);
      if (!item) throw new Error("Unknown language");
      const response = await fetch(pluginBaseUrl + item.path, { cache: "no-store" });
      if (!response.ok) throw new Error(`Language pack: HTTP ${response.status}`);
      return validateDictionary(await response.json());
    }
    function handleNavigation(event, documentRef) {
      if (!editorState || editorState.documentRef !== documentRef) return;
      const target = event.target?.nodeType === 1 ? event.target : event.target?.parentElement;
      if (!target || target.closest('[data-rioshi-translation-settings="nav"]')) return;
      if (editorState.navigation.contains(target) || target.closest("#sidebar .button")) {
        closeEditor();
      }
    }
    function openEditor(documentRef, contentHost, settingsRoot, navigation) {
      closeEditor();
      const editor = mountEditor({
        documentRef,
        host: contentHost,
        store,
        catalog: catalog_default,
        defaults: remote_config_default,
        initialDictionary: translations,
        loadBundled,
        apply: (dictionary) => installDictionary(dictionary, JSON.stringify(dictionary))
      });
      editorState = { ...editor, contentHost, settingsRoot, documentRef, navigation };
    }
    function maintainSettingsPage(documentRef) {
      const quickCssItem = documentRef.querySelector('[id*="/settings/quickcss"]');
      if (!quickCssItem) {
        if (editorState?.documentRef === documentRef) closeEditor();
        return;
      }
      const navigation = quickCssItem.parentElement;
      if (!navigation) return;
      let item = navigation.querySelector('[data-rioshi-translation-settings="nav"]');
      if (!item) {
        item = quickCssItem.cloneNode(true);
        item.id = "/settings/rioshi-plugin-translations";
        item.setAttribute("data-rioshi-translation-settings", "nav");
        const walker = documentRef.createTreeWalker(item, 4);
        let node;
        let renamed = false;
        while (node = walker.nextNode()) {
          if (!renamed && /快捷\s*CSS|Quick\s*CSS/i.test(node.nodeValue)) {
            node.nodeValue = node.nodeValue.replace(/快捷\s*CSS|Quick\s*CSS/i, labels[store.uiLanguage].title);
            node.parentElement.setAttribute("data-rioshi-nav-label", "true");
            renamed = true;
          }
        }
        if (!renamed) {
          const label = documentRef.createElement("span");
          label.setAttribute("data-rioshi-nav-label", "true");
          label.textContent = labels[store.uiLanguage].title;
          item.appendChild(label);
        }
        item.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          const settingsRoot = quickCssItem.closest(".MillenniumSettings") || quickCssItem.closest(".ModalDialogPopup");
          if (!settingsRoot) return;
          const contentHost = settingsRoot.querySelector(".OX7USkJ5dDP_icD00Gal6") || Array.from(navigation.parentElement?.children || []).find((child) => child !== navigation);
          if (contentHost) openEditor(documentRef, contentHost, settingsRoot, navigation);
        }, true);
        quickCssItem.insertAdjacentElement("afterend", item);
      }
      const navLabel = item.querySelector("[data-rioshi-nav-label]");
      if (navLabel && navLabel.textContent !== labels[store.uiLanguage].title) navLabel.textContent = labels[store.uiLanguage].title;
      if (editorState?.documentRef === documentRef) {
        const visible = editorState.settingsRoot?.isConnected && editorState.settingsRoot.getClientRects().length > 0 && editorState.contentHost?.isConnected;
        if (!visible) closeEditor();
      }
    }
    async function initialize() {
      localStorage.removeItem(`${pluginName}:sync-config-v4`);
      pluginBaseUrl = getPluginBaseUrl();
      await reloadTranslations(true);
      observeDocument(document);
      if (typeof g_PopupManager !== "undefined") {
        for (const popup of g_PopupManager.m_mapPopups?.values?.() || []) {
          observeDocument(popup?.m_popup?.document || popup?.window?.document);
        }
        const registration = g_PopupManager.AddPopupCreatedCallback((popup) => {
          observeDocument(popup?.m_popup?.document || popup?.window?.document);
        });
        if (registration?.Unregister) disposables.add({ dispose: () => registration.Unregister() });
      }
      const uiTimer = setInterval(() => {
        for (const documentRef of documents) maintainSettingsPage(documentRef);
      }, 500);
      disposables.add({ dispose: () => clearInterval(uiTimer) });
      const reloadTimer = setInterval(() => {
        reloadTranslations().catch((error) => console.warn(`[${pluginName}] hot reload failed`, error));
      }, 1e3);
      disposables.add({ dispose: () => clearInterval(reloadTimer) });
    }
    return {
      default: initialize,
      cleanup() {
        closeEditor();
        for (const disposable of disposables) disposable.dispose();
        disposables.clear();
        for (const documentRef of documents) {
          documentRef.querySelectorAll?.('[data-rioshi-translation-settings="nav"]').forEach((element) => element.remove());
        }
      }
    };
  })();
  (async () => {
    Object.assign(window.PLUGIN_LIST[pluginName], {
      ...PluginEntryPointMain,
      __millennium_internal_plugin_name_do_not_use_or_change__: pluginName
    });
    await PluginEntryPointMain.default();
    MILLENNIUM_BACKEND_IPC.postMessage(1, { pluginName });
  })();
})();
