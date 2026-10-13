import { createTranslationStore, validateDictionary as validatePack } from './translation-store.js';
import { mountEditor } from './editor.js';
import { labels } from './ui-languages.js';
import catalog from '../locales/catalog.json';
import defaults from '../remote-config.json';
const pluginName = "rioshi-plugin-translations";

(window.PLUGIN_LIST ||= {})[pluginName] ||= {};

const PluginEntryPointMain = (() => {
    "use strict";

    const store = createTranslationStore(localStorage);
    const observedDocuments = new WeakSet();
    const documents = new Set();
    const disposables = new Set();
    const textState = new WeakMap();
    const attributeState = new WeakMap();
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
        if (element.closest('[data-rioshi-translation-settings]')) return false;
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
        const state = attributeState.get(element) || new Map();

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
        while ((node = walker.nextNode())) {
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
        phraseEntries = Object.entries(translations)
            .filter(([key]) => key.length >= 8)
            .sort((a, b) => b[0].length - a[0].length);
        activeSource = source;
        refreshTranslatedNodes();
    }

    function validateDictionary(value) {
        if (!value || typeof value !== "object" || Array.isArray(value)) {
            throw new Error("词典根节点必须是 JSON 对象");
        }
        for (const [source, target] of Object.entries(value)) {
            if (!source || typeof target !== "string") {
                throw new Error("每个词条都必须是英文原文与中文译文字符串");
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
        const fallback = store.language === 'zh-CN' ? { ...bundled, ...validatePack(JSON.parse(fileSource)) } : bundled;
        const source = JSON.stringify(store.getDictionary() || fallback);
        if (!force && source === activeSource) return false;
        installDictionary(validateDictionary(JSON.parse(source)), source);
        return true;
    }

    function observeDocument(documentRef) {
        if (!documentRef || observedDocuments.has(documentRef)) return;
        observedDocuments.add(documentRef);
        documents.add(documentRef);

        // Steam settings are rendered in popup documents, not the plugin's
        // bootstrap document. Listen in each document before React handles navigation.
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
            minHeight: "34px", padding: "0 14px", border: "1px solid rgba(255,255,255,.12)",
            borderRadius: "4px", background: "rgba(255,255,255,.10)", color: "#fff",
            font: "inherit", cursor: "pointer"
        });
        return button;
    }

    function closeEditor() {
        if (!editorState) return;
        editorState.dispose();
        editorState = null;
    }

    async function loadBundled(language) {
        const item = catalog.languages.find(item => item.id === language);
        if (!item) throw new Error('Unknown language');
        const response = await fetch(pluginBaseUrl + item.path, { cache: 'no-store' });
        if (!response.ok) throw new Error(`Language pack: HTTP ${response.status}`);
        return validatePack(await response.json());
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
            documentRef, host: contentHost, store, catalog, defaults, initialDictionary: translations,
            loadBundled, apply: dictionary => installDictionary(dictionary, JSON.stringify(dictionary))
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
            while ((node = walker.nextNode())) {
                if (!renamed && /快捷\s*CSS|Quick\s*CSS/i.test(node.nodeValue)) {
                    node.nodeValue = node.nodeValue.replace(/快捷\s*CSS|Quick\s*CSS/i, labels[store.uiLanguage].title);
                    node.parentElement.setAttribute('data-rioshi-nav-label', 'true');
                    renamed = true;
                }
            }
            if (!renamed) {
                const label = documentRef.createElement('span');
                label.setAttribute('data-rioshi-nav-label', 'true');
                label.textContent = labels[store.uiLanguage].title;
                item.appendChild(label);
            }
            item.addEventListener("click", (event) => {
                event.preventDefault();
                event.stopPropagation();
                const settingsRoot = quickCssItem.closest(".MillenniumSettings") || quickCssItem.closest(".ModalDialogPopup");
                if (!settingsRoot) return;
                const contentHost = settingsRoot.querySelector(".OX7USkJ5dDP_icD00Gal6")
                    || Array.from(navigation.parentElement?.children || []).find((child) => child !== navigation);
                if (contentHost) openEditor(documentRef, contentHost, settingsRoot, navigation);
            }, true);
            quickCssItem.insertAdjacentElement("afterend", item);
        }
        const navLabel = item.querySelector('[data-rioshi-nav-label]');
        if (navLabel && navLabel.textContent !== labels[store.uiLanguage].title) navLabel.textContent = labels[store.uiLanguage].title;

        if (editorState?.documentRef === documentRef) {
            const visible = editorState.settingsRoot?.isConnected
                && editorState.settingsRoot.getClientRects().length > 0
                && editorState.contentHost?.isConnected;
            if (!visible) closeEditor();
        }
    }

    async function initialize() {
        // Retire the old connection settings, including any remembered password.
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
        }, 1000);
        disposables.add({ dispose: () => clearInterval(reloadTimer) });
    }

    return {
        default: initialize,
        cleanup() {
            closeEditor();
            for (const disposable of disposables) disposable.dispose();
            disposables.clear();
            for (const documentRef of documents) {
                documentRef.querySelectorAll?.('[data-rioshi-translation-settings="nav"]')
                    .forEach((element) => element.remove());
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
