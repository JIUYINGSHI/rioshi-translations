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
      },
      exportSnapshot() {
        return JSON.parse(JSON.stringify(state));
      },
      importSnapshot(snapshot) {
        if (snapshot?.version !== 1 || !snapshot.dictionaries || typeof snapshot.language !== "string") {
          throw new Error("Unsupported sync file");
        }
        const dictionaries = {};
        for (const [language, dictionary] of Object.entries(snapshot.dictionaries)) {
          dictionaries[language] = validateDictionary(dictionary);
        }
        storage.setItem(`${STATE_KEY}:before-download`, JSON.stringify(state));
        state = { version: 1, uiLanguage: snapshot.uiLanguage === "en" ? "en" : "zh-CN", language: snapshot.language, dictionaries };
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
      description: "Translate plugin interfaces with JSON dictionaries. Changes apply immediately.",
      apply: "Apply & save",
      format: "Format JSON",
      restore: "Restore bundled dictionary",
      loaded: "Dictionary entries: ",
      language: "Dictionary language",
      github: "GitHub language packs",
      repository: "Repository",
      branch: "Branch",
      download: "Download & apply",
      webdav: "WebDAV sync",
      url: "WebDAV URL",
      username: "Username",
      password: "Password",
      path: "Remote file path",
      remember: "Remember password on this computer (plain local storage)",
      check: "Check connection",
      upload: "Upload local",
      pull: "Download remote",
      force: "Replace remote",
      done: "Saved and applied.",
      success: "Operation completed.",
      error: "Error: ",
      working: "Working\u2026",
      confirmPull: "Replace local dictionaries with the remote copy? A local recovery snapshot will be kept.",
      confirmForce: "Replace the remote copy with local dictionaries? Other devices may have newer changes.",
      exists: "Connected. Remote file exists.",
      missing: "Connected. A new file will be created on upload.",
      cors: "Browser WebDAV requires CORS support on the server. Credentials are never included in synced dictionaries.",
      dirty: "Discard unsaved editor changes?",
      starter: "Starter language packs; missing entries use original text."
    },
    "zh-CN": {
      title: "\u7FFB\u8BD1",
      description: "\u4F7F\u7528 JSON \u8BCD\u5178\u7FFB\u8BD1\u63D2\u4EF6\u754C\u9762\uFF0C\u5E94\u7528\u540E\u7ACB\u5373\u751F\u6548\u3002",
      apply: "\u5E94\u7528\u5E76\u4FDD\u5B58",
      format: "\u683C\u5F0F\u5316 JSON",
      restore: "\u6062\u590D\u5185\u7F6E\u8BCD\u5178",
      loaded: "\u8BCD\u6761\u6570\u91CF\uFF1A",
      language: "\u8BCD\u5178\u8BED\u8A00",
      github: "GitHub \u8BED\u8A00\u5305",
      repository: "\u4ED3\u5E93",
      branch: "\u5206\u652F",
      download: "\u4E0B\u8F7D\u5E76\u5E94\u7528",
      webdav: "WebDAV \u540C\u6B65",
      url: "WebDAV \u5730\u5740",
      username: "\u7528\u6237\u540D",
      password: "\u5BC6\u7801",
      path: "\u8FDC\u7A0B\u6587\u4EF6\u8DEF\u5F84",
      remember: "\u5728\u6B64\u7535\u8111\u8BB0\u4F4F\u5BC6\u7801\uFF08\u672C\u5730\u660E\u6587\u5B58\u50A8\uFF09",
      check: "\u6D4B\u8BD5\u8FDE\u63A5",
      upload: "\u4E0A\u4F20\u672C\u5730",
      pull: "\u4E0B\u8F7D\u8FDC\u7A0B",
      force: "\u8986\u76D6\u8FDC\u7A0B",
      done: "\u5DF2\u4FDD\u5B58\u5E76\u5E94\u7528\u3002",
      success: "\u64CD\u4F5C\u5B8C\u6210\u3002",
      error: "\u9519\u8BEF\uFF1A",
      working: "\u5904\u7406\u4E2D\u2026",
      confirmPull: "\u7528\u8FDC\u7A0B\u8BCD\u5178\u66FF\u6362\u672C\u5730\u8BCD\u5178\uFF1F\u4F1A\u4FDD\u7559\u4E00\u4EFD\u672C\u5730\u6062\u590D\u5FEB\u7167\u3002",
      confirmForce: "\u7528\u672C\u5730\u8BCD\u5178\u8986\u76D6\u8FDC\u7A0B\u8BCD\u5178\uFF1F\u5176\u4ED6\u8BBE\u5907\u53EF\u80FD\u5B58\u5728\u8F83\u65B0\u7684\u4FEE\u6539\u3002",
      exists: "\u8FDE\u63A5\u6210\u529F\uFF0C\u8FDC\u7A0B\u6587\u4EF6\u5DF2\u5B58\u5728\u3002",
      missing: "\u8FDE\u63A5\u6210\u529F\uFF0C\u4E0A\u4F20\u65F6\u4F1A\u521B\u5EFA\u65B0\u6587\u4EF6\u3002",
      cors: "\u6D4F\u89C8\u5668 WebDAV \u9700\u8981\u670D\u52A1\u5668\u652F\u6301 CORS \u8DE8\u57DF\u8BBF\u95EE\u3002\u5BC6\u7801\u4E0D\u4F1A\u5305\u542B\u5728\u540C\u6B65\u7684\u8BCD\u5178\u4E2D\u3002",
      dirty: "\u653E\u5F03\u5C1A\u672A\u4FDD\u5B58\u7684\u7F16\u8F91\u5185\u5BB9\uFF1F",
      starter: "\u521D\u59CB\u8BED\u8A00\u5305\uFF1B\u7F3A\u5C11\u7684\u8BCD\u6761\u4FDD\u7559\u539F\u6587\u3002"
    }
  };

  // node_modules/webdav/dist/web/index.js
  var t = { 2(t2) {
    function e2(t3, e3, i2) {
      t3 instanceof RegExp && (t3 = n2(t3, i2)), e3 instanceof RegExp && (e3 = n2(e3, i2));
      var s2 = r2(t3, e3, i2);
      return s2 && { start: s2[0], end: s2[1], pre: i2.slice(0, s2[0]), body: i2.slice(s2[0] + t3.length, s2[1]), post: i2.slice(s2[1] + e3.length) };
    }
    function n2(t3, e3) {
      var n3 = e3.match(t3);
      return n3 ? n3[0] : null;
    }
    function r2(t3, e3, n3) {
      var r3, i2, s2, o2, a2, c2 = n3.indexOf(t3), l2 = n3.indexOf(e3, c2 + 1), h2 = c2;
      if (c2 >= 0 && l2 > 0) {
        for (r3 = [], s2 = n3.length; h2 >= 0 && !a2; ) h2 == c2 ? (r3.push(h2), c2 = n3.indexOf(t3, h2 + 1)) : 1 == r3.length ? a2 = [r3.pop(), l2] : ((i2 = r3.pop()) < s2 && (s2 = i2, o2 = l2), l2 = n3.indexOf(e3, h2 + 1)), h2 = c2 < l2 && c2 >= 0 ? c2 : l2;
        r3.length && (a2 = [s2, o2]);
      }
      return a2;
    }
    t2.exports = e2, e2.range = r2;
  }, 101(t2, e2, n2) {
    var r2;
    t2 = n2.nmd(t2), (function() {
      var i2 = (t2 && t2.exports, "object" == typeof global && global);
      i2.global !== i2 && i2.window;
      var s2 = function(t3) {
        this.message = t3;
      };
      (s2.prototype = new Error()).name = "InvalidCharacterError";
      var o2 = function(t3) {
        throw new s2(t3);
      }, a2 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/", c2 = /[\t\n\f\r ]/g, l2 = { encode: function(t3) {
        t3 = String(t3), /[^\0-\xFF]/.test(t3) && o2("The string to be encoded contains characters outside of the Latin1 range.");
        for (var e3, n3, r3, i3, s3 = t3.length % 3, c3 = "", l3 = -1, h2 = t3.length - s3; ++l3 < h2; ) e3 = t3.charCodeAt(l3) << 16, n3 = t3.charCodeAt(++l3) << 8, r3 = t3.charCodeAt(++l3), c3 += a2.charAt((i3 = e3 + n3 + r3) >> 18 & 63) + a2.charAt(i3 >> 12 & 63) + a2.charAt(i3 >> 6 & 63) + a2.charAt(63 & i3);
        return 2 == s3 ? (e3 = t3.charCodeAt(l3) << 8, n3 = t3.charCodeAt(++l3), c3 += a2.charAt((i3 = e3 + n3) >> 10) + a2.charAt(i3 >> 4 & 63) + a2.charAt(i3 << 2 & 63) + "=") : 1 == s3 && (i3 = t3.charCodeAt(l3), c3 += a2.charAt(i3 >> 2) + a2.charAt(i3 << 4 & 63) + "=="), c3;
      }, decode: function(t3) {
        var e3 = (t3 = String(t3).replace(c2, "")).length;
        e3 % 4 == 0 && (e3 = (t3 = t3.replace(/==?$/, "")).length), (e3 % 4 == 1 || /[^+a-zA-Z0-9/]/.test(t3)) && o2("Invalid character: the string to be decoded is not correctly encoded.");
        for (var n3, r3, i3 = 0, s3 = "", l3 = -1; ++l3 < e3; ) r3 = a2.indexOf(t3.charAt(l3)), n3 = i3 % 4 ? 64 * n3 + r3 : r3, i3++ % 4 && (s3 += String.fromCharCode(255 & n3 >> (-2 * i3 & 6)));
        return s3;
      }, version: "1.0.0" };
      void 0 === (r2 = function() {
        return l2;
      }.call(e2, n2, e2, t2)) || (t2.exports = r2);
    })();
  }, 172(t2, e2) {
    e2.d = function(t3) {
      if (!t3) return 0;
      for (var e3 = (t3 = t3.toString()).length, n2 = t3.length; n2--; ) {
        var r2 = t3.charCodeAt(n2);
        56320 <= r2 && r2 <= 57343 && n2--, 127 < r2 && r2 <= 2047 ? e3++ : 2047 < r2 && r2 <= 65535 && (e3 += 2);
      }
      return e3;
    };
  }, 526(t2) {
    var e2 = { utf8: { stringToBytes: function(t3) {
      return e2.bin.stringToBytes(unescape(encodeURIComponent(t3)));
    }, bytesToString: function(t3) {
      return decodeURIComponent(escape(e2.bin.bytesToString(t3)));
    } }, bin: { stringToBytes: function(t3) {
      for (var e3 = [], n2 = 0; n2 < t3.length; n2++) e3.push(255 & t3.charCodeAt(n2));
      return e3;
    }, bytesToString: function(t3) {
      for (var e3 = [], n2 = 0; n2 < t3.length; n2++) e3.push(String.fromCharCode(t3[n2]));
      return e3.join("");
    } } };
    t2.exports = e2;
  }, 298(t2) {
    var e2, n2;
    e2 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/", n2 = { rotl: function(t3, e3) {
      return t3 << e3 | t3 >>> 32 - e3;
    }, rotr: function(t3, e3) {
      return t3 << 32 - e3 | t3 >>> e3;
    }, endian: function(t3) {
      if (t3.constructor == Number) return 16711935 & n2.rotl(t3, 8) | 4278255360 & n2.rotl(t3, 24);
      for (var e3 = 0; e3 < t3.length; e3++) t3[e3] = n2.endian(t3[e3]);
      return t3;
    }, randomBytes: function(t3) {
      for (var e3 = []; t3 > 0; t3--) e3.push(Math.floor(256 * Math.random()));
      return e3;
    }, bytesToWords: function(t3) {
      for (var e3 = [], n3 = 0, r2 = 0; n3 < t3.length; n3++, r2 += 8) e3[r2 >>> 5] |= t3[n3] << 24 - r2 % 32;
      return e3;
    }, wordsToBytes: function(t3) {
      for (var e3 = [], n3 = 0; n3 < 32 * t3.length; n3 += 8) e3.push(t3[n3 >>> 5] >>> 24 - n3 % 32 & 255);
      return e3;
    }, bytesToHex: function(t3) {
      for (var e3 = [], n3 = 0; n3 < t3.length; n3++) e3.push((t3[n3] >>> 4).toString(16)), e3.push((15 & t3[n3]).toString(16));
      return e3.join("");
    }, hexToBytes: function(t3) {
      for (var e3 = [], n3 = 0; n3 < t3.length; n3 += 2) e3.push(parseInt(t3.substr(n3, 2), 16));
      return e3;
    }, bytesToBase64: function(t3) {
      for (var n3 = [], r2 = 0; r2 < t3.length; r2 += 3) for (var i2 = t3[r2] << 16 | t3[r2 + 1] << 8 | t3[r2 + 2], s2 = 0; s2 < 4; s2++) 8 * r2 + 6 * s2 <= 8 * t3.length ? n3.push(e2.charAt(i2 >>> 6 * (3 - s2) & 63)) : n3.push("=");
      return n3.join("");
    }, base64ToBytes: function(t3) {
      t3 = t3.replace(/[^A-Z0-9+\/]/gi, "");
      for (var n3 = [], r2 = 0, i2 = 0; r2 < t3.length; i2 = ++r2 % 4) 0 != i2 && n3.push((e2.indexOf(t3.charAt(r2 - 1)) & Math.pow(2, -2 * i2 + 8) - 1) << 2 * i2 | e2.indexOf(t3.charAt(r2)) >>> 6 - 2 * i2);
      return n3;
    } }, t2.exports = n2;
  }, 135(t2) {
    function e2(t3) {
      return !!t3.constructor && "function" == typeof t3.constructor.isBuffer && t3.constructor.isBuffer(t3);
    }
    t2.exports = function(t3) {
      return null != t3 && (e2(t3) || (function(t4) {
        return "function" == typeof t4.readFloatLE && "function" == typeof t4.slice && e2(t4.slice(0, 0));
      })(t3) || !!t3._isBuffer);
    };
  }, 542(t2, e2, n2) {
    !(function() {
      var e3 = n2(298), r2 = n2(526).utf8, i2 = n2(135), s2 = n2(526).bin, o2 = function(t3, n3) {
        t3.constructor == String ? t3 = n3 && "binary" === n3.encoding ? s2.stringToBytes(t3) : r2.stringToBytes(t3) : i2(t3) ? t3 = Array.prototype.slice.call(t3, 0) : Array.isArray(t3) || t3.constructor === Uint8Array || (t3 = t3.toString());
        for (var a2 = e3.bytesToWords(t3), c2 = 8 * t3.length, l2 = 1732584193, h2 = -271733879, u2 = -1732584194, p2 = 271733878, f2 = 0; f2 < a2.length; f2++) a2[f2] = 16711935 & (a2[f2] << 8 | a2[f2] >>> 24) | 4278255360 & (a2[f2] << 24 | a2[f2] >>> 8);
        a2[c2 >>> 5] |= 128 << c2 % 32, a2[14 + (c2 + 64 >>> 9 << 4)] = c2;
        var d2 = o2._ff, g2 = o2._gg, m2 = o2._hh, y2 = o2._ii;
        for (f2 = 0; f2 < a2.length; f2 += 16) {
          var b2 = l2, x2 = h2, v2 = u2, w2 = p2;
          l2 = d2(l2, h2, u2, p2, a2[f2 + 0], 7, -680876936), p2 = d2(p2, l2, h2, u2, a2[f2 + 1], 12, -389564586), u2 = d2(u2, p2, l2, h2, a2[f2 + 2], 17, 606105819), h2 = d2(h2, u2, p2, l2, a2[f2 + 3], 22, -1044525330), l2 = d2(l2, h2, u2, p2, a2[f2 + 4], 7, -176418897), p2 = d2(p2, l2, h2, u2, a2[f2 + 5], 12, 1200080426), u2 = d2(u2, p2, l2, h2, a2[f2 + 6], 17, -1473231341), h2 = d2(h2, u2, p2, l2, a2[f2 + 7], 22, -45705983), l2 = d2(l2, h2, u2, p2, a2[f2 + 8], 7, 1770035416), p2 = d2(p2, l2, h2, u2, a2[f2 + 9], 12, -1958414417), u2 = d2(u2, p2, l2, h2, a2[f2 + 10], 17, -42063), h2 = d2(h2, u2, p2, l2, a2[f2 + 11], 22, -1990404162), l2 = d2(l2, h2, u2, p2, a2[f2 + 12], 7, 1804603682), p2 = d2(p2, l2, h2, u2, a2[f2 + 13], 12, -40341101), u2 = d2(u2, p2, l2, h2, a2[f2 + 14], 17, -1502002290), l2 = g2(l2, h2 = d2(h2, u2, p2, l2, a2[f2 + 15], 22, 1236535329), u2, p2, a2[f2 + 1], 5, -165796510), p2 = g2(p2, l2, h2, u2, a2[f2 + 6], 9, -1069501632), u2 = g2(u2, p2, l2, h2, a2[f2 + 11], 14, 643717713), h2 = g2(h2, u2, p2, l2, a2[f2 + 0], 20, -373897302), l2 = g2(l2, h2, u2, p2, a2[f2 + 5], 5, -701558691), p2 = g2(p2, l2, h2, u2, a2[f2 + 10], 9, 38016083), u2 = g2(u2, p2, l2, h2, a2[f2 + 15], 14, -660478335), h2 = g2(h2, u2, p2, l2, a2[f2 + 4], 20, -405537848), l2 = g2(l2, h2, u2, p2, a2[f2 + 9], 5, 568446438), p2 = g2(p2, l2, h2, u2, a2[f2 + 14], 9, -1019803690), u2 = g2(u2, p2, l2, h2, a2[f2 + 3], 14, -187363961), h2 = g2(h2, u2, p2, l2, a2[f2 + 8], 20, 1163531501), l2 = g2(l2, h2, u2, p2, a2[f2 + 13], 5, -1444681467), p2 = g2(p2, l2, h2, u2, a2[f2 + 2], 9, -51403784), u2 = g2(u2, p2, l2, h2, a2[f2 + 7], 14, 1735328473), l2 = m2(l2, h2 = g2(h2, u2, p2, l2, a2[f2 + 12], 20, -1926607734), u2, p2, a2[f2 + 5], 4, -378558), p2 = m2(p2, l2, h2, u2, a2[f2 + 8], 11, -2022574463), u2 = m2(u2, p2, l2, h2, a2[f2 + 11], 16, 1839030562), h2 = m2(h2, u2, p2, l2, a2[f2 + 14], 23, -35309556), l2 = m2(l2, h2, u2, p2, a2[f2 + 1], 4, -1530992060), p2 = m2(p2, l2, h2, u2, a2[f2 + 4], 11, 1272893353), u2 = m2(u2, p2, l2, h2, a2[f2 + 7], 16, -155497632), h2 = m2(h2, u2, p2, l2, a2[f2 + 10], 23, -1094730640), l2 = m2(l2, h2, u2, p2, a2[f2 + 13], 4, 681279174), p2 = m2(p2, l2, h2, u2, a2[f2 + 0], 11, -358537222), u2 = m2(u2, p2, l2, h2, a2[f2 + 3], 16, -722521979), h2 = m2(h2, u2, p2, l2, a2[f2 + 6], 23, 76029189), l2 = m2(l2, h2, u2, p2, a2[f2 + 9], 4, -640364487), p2 = m2(p2, l2, h2, u2, a2[f2 + 12], 11, -421815835), u2 = m2(u2, p2, l2, h2, a2[f2 + 15], 16, 530742520), l2 = y2(l2, h2 = m2(h2, u2, p2, l2, a2[f2 + 2], 23, -995338651), u2, p2, a2[f2 + 0], 6, -198630844), p2 = y2(p2, l2, h2, u2, a2[f2 + 7], 10, 1126891415), u2 = y2(u2, p2, l2, h2, a2[f2 + 14], 15, -1416354905), h2 = y2(h2, u2, p2, l2, a2[f2 + 5], 21, -57434055), l2 = y2(l2, h2, u2, p2, a2[f2 + 12], 6, 1700485571), p2 = y2(p2, l2, h2, u2, a2[f2 + 3], 10, -1894986606), u2 = y2(u2, p2, l2, h2, a2[f2 + 10], 15, -1051523), h2 = y2(h2, u2, p2, l2, a2[f2 + 1], 21, -2054922799), l2 = y2(l2, h2, u2, p2, a2[f2 + 8], 6, 1873313359), p2 = y2(p2, l2, h2, u2, a2[f2 + 15], 10, -30611744), u2 = y2(u2, p2, l2, h2, a2[f2 + 6], 15, -1560198380), h2 = y2(h2, u2, p2, l2, a2[f2 + 13], 21, 1309151649), l2 = y2(l2, h2, u2, p2, a2[f2 + 4], 6, -145523070), p2 = y2(p2, l2, h2, u2, a2[f2 + 11], 10, -1120210379), u2 = y2(u2, p2, l2, h2, a2[f2 + 2], 15, 718787259), h2 = y2(h2, u2, p2, l2, a2[f2 + 9], 21, -343485551), l2 = l2 + b2 >>> 0, h2 = h2 + x2 >>> 0, u2 = u2 + v2 >>> 0, p2 = p2 + w2 >>> 0;
        }
        return e3.endian([l2, h2, u2, p2]);
      };
      o2._ff = function(t3, e4, n3, r3, i3, s3, o3) {
        var a2 = t3 + (e4 & n3 | ~e4 & r3) + (i3 >>> 0) + o3;
        return (a2 << s3 | a2 >>> 32 - s3) + e4;
      }, o2._gg = function(t3, e4, n3, r3, i3, s3, o3) {
        var a2 = t3 + (e4 & r3 | n3 & ~r3) + (i3 >>> 0) + o3;
        return (a2 << s3 | a2 >>> 32 - s3) + e4;
      }, o2._hh = function(t3, e4, n3, r3, i3, s3, o3) {
        var a2 = t3 + (e4 ^ n3 ^ r3) + (i3 >>> 0) + o3;
        return (a2 << s3 | a2 >>> 32 - s3) + e4;
      }, o2._ii = function(t3, e4, n3, r3, i3, s3, o3) {
        var a2 = t3 + (n3 ^ (e4 | ~r3)) + (i3 >>> 0) + o3;
        return (a2 << s3 | a2 >>> 32 - s3) + e4;
      }, o2._blocksize = 16, o2._digestsize = 16, t2.exports = function(t3, n3) {
        if (null == t3) throw new Error("Illegal argument " + t3);
        var r3 = e3.wordsToBytes(o2(t3, n3));
        return n3 && n3.asBytes ? r3 : n3 && n3.asString ? s2.bytesToString(r3) : e3.bytesToHex(r3);
      };
    })();
  }, 285(t2, e2, n2) {
    var r2 = n2(2);
    t2.exports = function(t3, e3) {
      if (!t3) return [];
      var n3 = null == (e3 = e3 || {}).max ? 1e5 : e3.max, r3 = null == e3.maxLength ? 4e6 : e3.maxLength;
      return "{}" === t3.substr(0, 2) && (t3 = "\\{\\}" + t3.substr(2)), b2((function(t4) {
        return t4.split("\\\\").join(i2).split("\\{").join(s2).split("\\}").join(o2).split("\\,").join(a2).split("\\.").join(c2);
      })(t3), n3, r3, true).map(h2);
    };
    var i2 = "\0SLASH" + Math.random() + "\0", s2 = "\0OPEN" + Math.random() + "\0", o2 = "\0CLOSE" + Math.random() + "\0", a2 = "\0COMMA" + Math.random() + "\0", c2 = "\0PERIOD" + Math.random() + "\0";
    function l2(t3) {
      return parseInt(t3, 10) == t3 ? parseInt(t3, 10) : t3.charCodeAt(0);
    }
    function h2(t3) {
      return t3.split(i2).join("\\").split(s2).join("{").split(o2).join("}").split(a2).join(",").split(c2).join(".");
    }
    function u2(t3) {
      if (!t3) return [""];
      var e3 = [], n3 = r2("{", "}", t3);
      if (!n3) return t3.split(",");
      var i3 = n3.pre, s3 = n3.body, o3 = n3.post, a3 = i3.split(",");
      a3[a3.length - 1] += "{" + s3 + "}";
      var c3 = u2(o3);
      return o3.length && (a3[a3.length - 1] += c3.shift(), a3.push.apply(a3, c3)), e3.push.apply(e3, a3), e3;
    }
    function p2(t3) {
      return "{" + t3 + "}";
    }
    function f2(t3) {
      return /^-?0\d/.test(t3);
    }
    function d2(t3, e3) {
      return t3 <= e3;
    }
    function g2(t3, e3) {
      return t3 >= e3;
    }
    function m2(t3, e3, n3, r3, i3, s3) {
      for (var o3 = [], a3 = 0, c3 = 0; c3 < t3.length; c3++) for (var l3 = 0; l3 < n3.length; l3++) {
        if (o3.length >= r3) return o3;
        var h3 = t3[c3] + e3 + n3[l3];
        if (!s3 || h3) {
          if (a3 + h3.length > i3) return o3;
          o3.push(h3), a3 += h3.length;
        }
      }
      return o3;
    }
    function y2(t3, e3, n3, r3) {
      var i3 = t3.split(/\.\./), s3 = [];
      if (void 0 === i3[0] || void 0 === i3[1]) return s3;
      var o3 = l2(i3[0]), a3 = l2(i3[1]), c3 = Math.max(i3[0].length, i3[1].length), h3 = 3 === i3.length && void 0 !== i3[2] ? Math.max(Math.abs(l2(i3[2])), 1) : 1, u3 = d2;
      a3 < o3 && (h3 *= -1, u3 = g2);
      for (var p3 = i3.some(f2), m3 = 0, y3 = o3; u3(y3, a3) && s3.length < n3; y3 += h3) {
        var b3;
        if (e3) "\\" === (b3 = String.fromCharCode(y3)) && (b3 = "");
        else if (b3 = String(y3), p3) {
          var x2 = c3 - b3.length;
          if (x2 > 0) {
            var v2 = new Array(x2 + 1).join("0");
            b3 = y3 < 0 ? "-" + v2 + b3.slice(1) : v2 + b3;
          }
        }
        if (m3 + b3.length > r3) break;
        s3.push(b3), m3 += b3.length;
      }
      return s3;
    }
    function b2(t3, e3, n3, i3) {
      for (var s3 = [""], a3 = false, c3 = true; ; ) {
        const P2 = r2("{", "}", t3);
        if (!P2) return m2(s3, t3, [""], e3, n3, a3);
        const O2 = P2.pre;
        if (/\$$/.test(O2)) {
          if (s3 = m2(s3, O2 + "{" + P2.body + "}", [""], e3, n3, a3 && !P2.post.length), c3 = false, !P2.post.length) break;
          t3 = P2.post;
        } else {
          var l3, h3 = /^-?\d+\.\.-?\d+(?:\.\.-?\d+)?$/.test(P2.body), f3 = /^[a-zA-Z]\.\.[a-zA-Z](?:\.\.-?\d+)?$/.test(P2.body), d3 = h3 || f3, g3 = P2.body.indexOf(",") >= 0;
          if (!d3 && !g3) {
            if (P2.post.match(/,(?!,).*\}/)) {
              t3 = P2.pre + "{" + P2.body + o2 + P2.post, i3 = true;
              continue;
            }
            return m2(s3, O2 + "{" + P2.body + "}" + P2.post, [""], e3, n3, a3);
          }
          if (c3 && (a3 = i3 && !d3, c3 = false), d3) l3 = y2(P2.body, f3, e3, n3);
          else {
            var x2 = u2(P2.body);
            if (1 === x2.length && void 0 !== x2[0] && 1 === (x2 = b2(x2[0], e3, n3, false).map(p2)).length) {
              if (s3 = m2(s3, O2 + x2[0], [""], e3, n3, a3 && !P2.post.length), !P2.post.length) break;
              t3 = P2.post;
              continue;
            }
            for (var v2 = a3 && !P2.post.length && !O2, w2 = 0; v2 && w2 < s3.length; w2++) s3[w2] && (v2 = false);
            l3 = [];
            var E2 = 0;
            t: for (var N2 = 0; N2 < x2.length; N2++) for (var A2 = b2(x2[N2], e3, n3, false), S2 = 0; S2 < A2.length; S2++) {
              var T2 = A2[S2];
              if (!v2 || T2) {
                if (l3.length >= e3 || E2 + T2.length > n3) break t;
                l3.push(T2), E2 += T2.length;
              }
            }
          }
          if (s3 = m2(s3, O2, l3, e3, n3, a3 && !P2.post.length), !P2.post.length) break;
          t3 = P2.post;
        }
      }
      return s3;
    }
  }, 829(t2) {
    function e2(t3) {
      return e2 = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(t4) {
        return typeof t4;
      } : function(t4) {
        return t4 && "function" == typeof Symbol && t4.constructor === Symbol && t4 !== Symbol.prototype ? "symbol" : typeof t4;
      }, e2(t3);
    }
    function n2(t3) {
      var e3 = "function" == typeof Map ? /* @__PURE__ */ new Map() : void 0;
      return n2 = function(t4) {
        if (null === t4 || (n3 = t4, -1 === Function.toString.call(n3).indexOf("[native code]"))) return t4;
        var n3;
        if ("function" != typeof t4) throw new TypeError("Super expression must either be null or a function");
        if (void 0 !== e3) {
          if (e3.has(t4)) return e3.get(t4);
          e3.set(t4, o3);
        }
        function o3() {
          return r2(t4, arguments, s2(this).constructor);
        }
        return o3.prototype = Object.create(t4.prototype, { constructor: { value: o3, enumerable: false, writable: true, configurable: true } }), i2(o3, t4);
      }, n2(t3);
    }
    function r2(t3, e3, n3) {
      return r2 = (function() {
        if ("undefined" == typeof Reflect || !Reflect.construct) return false;
        if (Reflect.construct.sham) return false;
        if ("function" == typeof Proxy) return true;
        try {
          return Date.prototype.toString.call(Reflect.construct(Date, [], (function() {
          }))), true;
        } catch (t4) {
          return false;
        }
      })() ? Reflect.construct : function(t4, e4, n4) {
        var r3 = [null];
        r3.push.apply(r3, e4);
        var s3 = new (Function.bind.apply(t4, r3))();
        return n4 && i2(s3, n4.prototype), s3;
      }, r2.apply(null, arguments);
    }
    function i2(t3, e3) {
      return i2 = Object.setPrototypeOf || function(t4, e4) {
        return t4.__proto__ = e4, t4;
      }, i2(t3, e3);
    }
    function s2(t3) {
      return s2 = Object.setPrototypeOf ? Object.getPrototypeOf : function(t4) {
        return t4.__proto__ || Object.getPrototypeOf(t4);
      }, s2(t3);
    }
    var o2 = (function(t3) {
      function n3(t4) {
        var r3;
        return (function(t5, e3) {
          if (!(t5 instanceof e3)) throw new TypeError("Cannot call a class as a function");
        })(this, n3), (r3 = (function(t5, n4) {
          return !n4 || "object" !== e2(n4) && "function" != typeof n4 ? (function(t6) {
            if (void 0 === t6) throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
            return t6;
          })(t5) : n4;
        })(this, s2(n3).call(this, t4))).name = "ObjectPrototypeMutationError", r3;
      }
      return (function(t4, e3) {
        if ("function" != typeof e3 && null !== e3) throw new TypeError("Super expression must either be null or a function");
        t4.prototype = Object.create(e3 && e3.prototype, { constructor: { value: t4, writable: true, configurable: true } }), e3 && i2(t4, e3);
      })(n3, t3), n3;
    })(n2(Error));
    function a2(t3, n3) {
      for (var r3 = arguments.length > 2 && void 0 !== arguments[2] ? arguments[2] : function() {
      }, i3 = n3.split("."), s3 = i3.length, o3 = function(e3) {
        var n4 = i3[e3];
        if (!t3) return { v: void 0 };
        if ("+" === n4) {
          if (Array.isArray(t3)) return { v: t3.map((function(n5, s5) {
            var o4 = i3.slice(e3 + 1);
            return o4.length > 0 ? a2(n5, o4.join("."), r3) : r3(t3, s5, i3, e3);
          })) };
          var s4 = i3.slice(0, e3).join(".");
          throw new Error("Object at wildcard (".concat(s4, ") is not an array"));
        }
        t3 = r3(t3, n4, i3, e3);
      }, c3 = 0; c3 < s3; c3++) {
        var l2 = o3(c3);
        if ("object" === e2(l2)) return l2.v;
      }
      return t3;
    }
    function c2(t3, e3) {
      return t3.length === e3 + 1;
    }
    t2.exports = { set: function(t3, n3, r3) {
      if ("object" != e2(t3) || null === t3) return t3;
      if (void 0 === n3) return t3;
      if ("number" == typeof n3) return t3[n3] = r3, t3[n3];
      try {
        return a2(t3, n3, (function(t4, e3, n4, i3) {
          if (t4 === Reflect.getPrototypeOf({})) throw new o2("Attempting to mutate Object.prototype");
          if (!t4[e3]) {
            var s3 = Number.isInteger(Number(n4[i3 + 1])), a3 = "+" === n4[i3 + 1];
            t4[e3] = s3 || a3 ? [] : {};
          }
          return c2(n4, i3) && (t4[e3] = r3), t4[e3];
        }));
      } catch (e3) {
        if (e3 instanceof o2) throw e3;
        return t3;
      }
    }, get: function(t3, n3) {
      if ("object" != e2(t3) || null === t3) return t3;
      if (void 0 === n3) return t3;
      if ("number" == typeof n3) return t3[n3];
      try {
        return a2(t3, n3, (function(t4, e3) {
          return t4[e3];
        }));
      } catch (e3) {
        return t3;
      }
    }, has: function(t3, n3) {
      var r3 = arguments.length > 2 && void 0 !== arguments[2] ? arguments[2] : {};
      if ("object" != e2(t3) || null === t3) return false;
      if (void 0 === n3) return false;
      if ("number" == typeof n3) return n3 in t3;
      try {
        var i3 = false;
        return a2(t3, n3, (function(t4, e3, n4, s3) {
          if (!c2(n4, s3)) return t4 && t4[e3];
          i3 = r3.own ? t4.hasOwnProperty(e3) : e3 in t4;
        })), i3;
      } catch (t4) {
        return false;
      }
    }, hasOwn: function(t3, e3, n3) {
      return this.has(t3, e3, n3 || { own: true });
    }, isIn: function(t3, n3, r3) {
      var i3 = arguments.length > 3 && void 0 !== arguments[3] ? arguments[3] : {};
      if ("object" != e2(t3) || null === t3) return false;
      if (void 0 === n3) return false;
      try {
        var s3 = false, o3 = false;
        return a2(t3, n3, (function(t4, n4, i4, a3) {
          return s3 = s3 || t4 === r3 || !!t4 && t4[n4] === r3, o3 = c2(i4, a3) && "object" === e2(t4) && n4 in t4, t4 && t4[n4];
        })), i3.validPath ? s3 && o3 : s3;
      } catch (t4) {
        return false;
      }
    }, ObjectPrototypeMutationError: o2 };
  }, 47(t2, e2, n2) {
    var r2 = n2(410), i2 = function(t3) {
      return "string" == typeof t3;
    };
    function s2(t3, e3) {
      for (var n3 = [], r3 = 0; r3 < t3.length; r3++) {
        var i3 = t3[r3];
        i3 && "." !== i3 && (".." === i3 ? n3.length && ".." !== n3[n3.length - 1] ? n3.pop() : e3 && n3.push("..") : n3.push(i3));
      }
      return n3;
    }
    var o2 = /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/, a2 = {};
    function c2(t3) {
      return o2.exec(t3).slice(1);
    }
    a2.resolve = function() {
      for (var t3 = "", e3 = false, n3 = arguments.length - 1; n3 >= -1 && !e3; n3--) {
        var r3 = n3 >= 0 ? arguments[n3] : process.cwd();
        if (!i2(r3)) throw new TypeError("Arguments to path.resolve must be strings");
        r3 && (t3 = r3 + "/" + t3, e3 = "/" === r3.charAt(0));
      }
      return (e3 ? "/" : "") + (t3 = s2(t3.split("/"), !e3).join("/")) || ".";
    }, a2.normalize = function(t3) {
      var e3 = a2.isAbsolute(t3), n3 = "/" === t3.substr(-1);
      return (t3 = s2(t3.split("/"), !e3).join("/")) || e3 || (t3 = "."), t3 && n3 && (t3 += "/"), (e3 ? "/" : "") + t3;
    }, a2.isAbsolute = function(t3) {
      return "/" === t3.charAt(0);
    }, a2.join = function() {
      for (var t3 = "", e3 = 0; e3 < arguments.length; e3++) {
        var n3 = arguments[e3];
        if (!i2(n3)) throw new TypeError("Arguments to path.join must be strings");
        n3 && (t3 += t3 ? "/" + n3 : n3);
      }
      return a2.normalize(t3);
    }, a2.relative = function(t3, e3) {
      function n3(t4) {
        for (var e4 = 0; e4 < t4.length && "" === t4[e4]; e4++) ;
        for (var n4 = t4.length - 1; n4 >= 0 && "" === t4[n4]; n4--) ;
        return e4 > n4 ? [] : t4.slice(e4, n4 + 1);
      }
      t3 = a2.resolve(t3).substr(1), e3 = a2.resolve(e3).substr(1);
      for (var r3 = n3(t3.split("/")), i3 = n3(e3.split("/")), s3 = Math.min(r3.length, i3.length), o3 = s3, c3 = 0; c3 < s3; c3++) if (r3[c3] !== i3[c3]) {
        o3 = c3;
        break;
      }
      var l2 = [];
      for (c3 = o3; c3 < r3.length; c3++) l2.push("..");
      return (l2 = l2.concat(i3.slice(o3))).join("/");
    }, a2._makeLong = function(t3) {
      return t3;
    }, a2.dirname = function(t3) {
      var e3 = c2(t3), n3 = e3[0], r3 = e3[1];
      return n3 || r3 ? (r3 && (r3 = r3.substr(0, r3.length - 1)), n3 + r3) : ".";
    }, a2.basename = function(t3, e3) {
      var n3 = c2(t3)[2];
      return e3 && n3.substr(-1 * e3.length) === e3 && (n3 = n3.substr(0, n3.length - e3.length)), n3;
    }, a2.extname = function(t3) {
      return c2(t3)[3];
    }, a2.format = function(t3) {
      if (!r2.isObject(t3)) throw new TypeError("Parameter 'pathObject' must be an object, not " + typeof t3);
      var e3 = t3.root || "";
      if (!i2(e3)) throw new TypeError("'pathObject.root' must be a string or undefined, not " + typeof t3.root);
      return (t3.dir ? t3.dir + a2.sep : "") + (t3.base || "");
    }, a2.parse = function(t3) {
      if (!i2(t3)) throw new TypeError("Parameter 'pathString' must be a string, not " + typeof t3);
      var e3 = c2(t3);
      if (!e3 || 4 !== e3.length) throw new TypeError("Invalid path '" + t3 + "'");
      return e3[1] = e3[1] || "", e3[2] = e3[2] || "", e3[3] = e3[3] || "", { root: e3[0], dir: e3[0] + e3[1].slice(0, e3[1].length - 1), base: e3[2], ext: e3[3], name: e3[2].slice(0, e3[2].length - e3[3].length) };
    }, a2.sep = "/", a2.delimiter = ":", t2.exports = a2;
  }, 647(t2, e2) {
    var n2 = Object.prototype.hasOwnProperty;
    function r2(t3) {
      try {
        return decodeURIComponent(t3.replace(/\+/g, " "));
      } catch (t4) {
        return null;
      }
    }
    function i2(t3) {
      try {
        return encodeURIComponent(t3);
      } catch (t4) {
        return null;
      }
    }
    e2.stringify = function(t3, e3) {
      e3 = e3 || "";
      var r3, s2, o2 = [];
      for (s2 in "string" != typeof e3 && (e3 = "?"), t3) if (n2.call(t3, s2)) {
        if ((r3 = t3[s2]) || null != r3 && !isNaN(r3) || (r3 = ""), s2 = i2(s2), r3 = i2(r3), null === s2 || null === r3) continue;
        o2.push(s2 + "=" + r3);
      }
      return o2.length ? e3 + o2.join("&") : "";
    }, e2.parse = function(t3) {
      for (var e3, n3 = /([^=?#&]+)=?([^&]*)/g, i3 = {}; e3 = n3.exec(t3); ) {
        var s2 = r2(e3[1]), o2 = r2(e3[2]);
        null === s2 || null === o2 || s2 in i3 || (i3[s2] = o2);
      }
      return i3;
    };
  }, 670(t2) {
    t2.exports = function(t3, e2) {
      if (e2 = e2.split(":")[0], !(t3 = +t3)) return false;
      switch (e2) {
        case "http":
        case "ws":
          return 80 !== t3;
        case "https":
        case "wss":
          return 443 !== t3;
        case "ftp":
          return 21 !== t3;
        case "gopher":
          return 70 !== t3;
        case "file":
          return false;
      }
      return 0 !== t3;
    };
  }, 737(t2, e2, n2) {
    var r2 = n2(670), i2 = n2(647), s2 = /^[\x00-\x20\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+/, o2 = /[\n\r\t]/g, a2 = /^[A-Za-z][A-Za-z0-9+-.]*:\/\//, c2 = /:\d+$/, l2 = /^([a-z][a-z0-9.+-]*:)?(\/\/)?([\\/]+)?([\S\s]*)/i, h2 = /^[a-zA-Z]:/;
    function u2(t3) {
      return (t3 || "").toString().replace(s2, "");
    }
    var p2 = [["#", "hash"], ["?", "query"], function(t3, e3) {
      return g2(e3.protocol) ? t3.replace(/\\/g, "/") : t3;
    }, ["/", "pathname"], ["@", "auth", 1], [NaN, "host", void 0, 1, 1], [/:(\d*)$/, "port", void 0, 1], [NaN, "hostname", void 0, 1, 1]], f2 = { hash: 1, query: 1 };
    function d2(t3) {
      var e3, n3 = ("undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {}).location || {}, r3 = {}, i3 = typeof (t3 = t3 || n3);
      if ("blob:" === t3.protocol) r3 = new y2(unescape(t3.pathname), {});
      else if ("string" === i3) for (e3 in r3 = new y2(t3, {}), f2) delete r3[e3];
      else if ("object" === i3) {
        for (e3 in t3) e3 in f2 || (r3[e3] = t3[e3]);
        void 0 === r3.slashes && (r3.slashes = a2.test(t3.href));
      }
      return r3;
    }
    function g2(t3) {
      return "file:" === t3 || "ftp:" === t3 || "http:" === t3 || "https:" === t3 || "ws:" === t3 || "wss:" === t3;
    }
    function m2(t3, e3) {
      t3 = (t3 = u2(t3)).replace(o2, ""), e3 = e3 || {};
      var n3, r3 = l2.exec(t3), i3 = r3[1] ? r3[1].toLowerCase() : "", s3 = !!r3[2], a3 = !!r3[3], c3 = 0;
      return s3 ? a3 ? (n3 = r3[2] + r3[3] + r3[4], c3 = r3[2].length + r3[3].length) : (n3 = r3[2] + r3[4], c3 = r3[2].length) : a3 ? (n3 = r3[3] + r3[4], c3 = r3[3].length) : n3 = r3[4], "file:" === i3 ? c3 >= 2 && (n3 = n3.slice(2)) : g2(i3) ? n3 = r3[4] : i3 ? s3 && (n3 = n3.slice(2)) : c3 >= 2 && g2(e3.protocol) && (n3 = r3[4]), { protocol: i3, slashes: s3 || g2(i3), slashesCount: c3, rest: n3 };
    }
    function y2(t3, e3, n3) {
      if (t3 = (t3 = u2(t3)).replace(o2, ""), !(this instanceof y2)) return new y2(t3, e3, n3);
      var s3, a3, c3, l3, f3, b2, x2 = p2.slice(), v2 = typeof e3, w2 = this, E2 = 0;
      for ("object" !== v2 && "string" !== v2 && (n3 = e3, e3 = null), n3 && "function" != typeof n3 && (n3 = i2.parse), s3 = !(a3 = m2(t3 || "", e3 = d2(e3))).protocol && !a3.slashes, w2.slashes = a3.slashes || s3 && e3.slashes, w2.protocol = a3.protocol || e3.protocol || "", t3 = a3.rest, ("file:" === a3.protocol && (2 !== a3.slashesCount || h2.test(t3)) || !a3.slashes && (a3.protocol || a3.slashesCount < 2 || !g2(w2.protocol))) && (x2[3] = [/(.*)/, "pathname"]); E2 < x2.length; E2++) "function" != typeof (l3 = x2[E2]) ? (c3 = l3[0], b2 = l3[1], c3 != c3 ? w2[b2] = t3 : "string" == typeof c3 ? ~(f3 = "@" === c3 ? t3.lastIndexOf(c3) : t3.indexOf(c3)) && ("number" == typeof l3[2] ? (w2[b2] = t3.slice(0, f3), t3 = t3.slice(f3 + l3[2])) : (w2[b2] = t3.slice(f3), t3 = t3.slice(0, f3))) : (f3 = c3.exec(t3)) && (w2[b2] = f3[1], t3 = t3.slice(0, f3.index)), w2[b2] = w2[b2] || s3 && l3[3] && e3[b2] || "", l3[4] && (w2[b2] = w2[b2].toLowerCase())) : t3 = l3(t3, w2);
      n3 && (w2.query = n3(w2.query)), s3 && e3.slashes && "/" !== w2.pathname.charAt(0) && ("" !== w2.pathname || "" !== e3.pathname) && (w2.pathname = (function(t4, e4) {
        if ("" === t4) return e4;
        for (var n4 = (e4 || "/").split("/").slice(0, -1).concat(t4.split("/")), r3 = n4.length, i3 = n4[r3 - 1], s4 = false, o3 = 0; r3--; ) "." === n4[r3] ? n4.splice(r3, 1) : ".." === n4[r3] ? (n4.splice(r3, 1), o3++) : o3 && (0 === r3 && (s4 = true), n4.splice(r3, 1), o3--);
        return s4 && n4.unshift(""), "." !== i3 && ".." !== i3 || n4.push(""), n4.join("/");
      })(w2.pathname, e3.pathname)), "/" !== w2.pathname.charAt(0) && g2(w2.protocol) && (w2.pathname = "/" + w2.pathname), r2(w2.port, w2.protocol) || (w2.host = w2.hostname, w2.port = ""), w2.username = w2.password = "", w2.auth && (~(f3 = w2.auth.indexOf(":")) ? (w2.username = w2.auth.slice(0, f3), w2.username = encodeURIComponent(decodeURIComponent(w2.username)), w2.password = w2.auth.slice(f3 + 1), w2.password = encodeURIComponent(decodeURIComponent(w2.password))) : w2.username = encodeURIComponent(decodeURIComponent(w2.auth)), w2.auth = w2.password ? w2.username + ":" + w2.password : w2.username), w2.origin = "file:" !== w2.protocol && g2(w2.protocol) && w2.host ? w2.protocol + "//" + w2.host : "null", w2.href = w2.toString();
    }
    y2.prototype = { set: function(t3, e3, n3) {
      var s3 = this;
      switch (t3) {
        case "query":
          "string" == typeof e3 && e3.length && (e3 = (n3 || i2.parse)(e3)), s3[t3] = e3;
          break;
        case "port":
          s3[t3] = e3, r2(e3, s3.protocol) ? e3 && (s3.host = s3.hostname + ":" + e3) : (s3.host = s3.hostname, s3[t3] = "");
          break;
        case "hostname":
          s3[t3] = e3, s3.port && (e3 += ":" + s3.port), s3.host = e3;
          break;
        case "host":
          s3[t3] = e3, c2.test(e3) ? (e3 = e3.split(":"), s3.port = e3.pop(), s3.hostname = e3.join(":")) : (s3.hostname = e3, s3.port = "");
          break;
        case "protocol":
          s3.protocol = e3.toLowerCase(), s3.slashes = !n3;
          break;
        case "pathname":
        case "hash":
          if (e3) {
            var o3 = "pathname" === t3 ? "/" : "#";
            s3[t3] = e3.charAt(0) !== o3 ? o3 + e3 : e3;
          } else s3[t3] = e3;
          break;
        case "username":
        case "password":
          s3[t3] = encodeURIComponent(e3);
          break;
        case "auth":
          var a3 = e3.indexOf(":");
          ~a3 ? (s3.username = e3.slice(0, a3), s3.username = encodeURIComponent(decodeURIComponent(s3.username)), s3.password = e3.slice(a3 + 1), s3.password = encodeURIComponent(decodeURIComponent(s3.password))) : s3.username = encodeURIComponent(decodeURIComponent(e3));
      }
      for (var l3 = 0; l3 < p2.length; l3++) {
        var h3 = p2[l3];
        h3[4] && (s3[h3[1]] = s3[h3[1]].toLowerCase());
      }
      return s3.auth = s3.password ? s3.username + ":" + s3.password : s3.username, s3.origin = "file:" !== s3.protocol && g2(s3.protocol) && s3.host ? s3.protocol + "//" + s3.host : "null", s3.href = s3.toString(), s3;
    }, toString: function(t3) {
      t3 && "function" == typeof t3 || (t3 = i2.stringify);
      var e3, n3 = this, r3 = n3.host, s3 = n3.protocol;
      s3 && ":" !== s3.charAt(s3.length - 1) && (s3 += ":");
      var o3 = s3 + (n3.protocol && n3.slashes || g2(n3.protocol) ? "//" : "");
      return n3.username ? (o3 += n3.username, n3.password && (o3 += ":" + n3.password), o3 += "@") : n3.password ? (o3 += ":" + n3.password, o3 += "@") : "file:" !== n3.protocol && g2(n3.protocol) && !r3 && "/" !== n3.pathname && (o3 += "@"), (":" === r3[r3.length - 1] || c2.test(n3.hostname) && !n3.port) && (r3 += ":"), o3 += r3 + n3.pathname, (e3 = "object" == typeof n3.query ? t3(n3.query) : n3.query) && (o3 += "?" !== e3.charAt(0) ? "?" + e3 : e3), n3.hash && (o3 += n3.hash), o3;
    } }, y2.extractProtocol = m2, y2.location = d2, y2.trimLeft = u2, y2.qs = i2, t2.exports = y2;
  }, 410() {
  }, 388() {
  }, 805() {
  }, 345() {
  }, 800() {
  } };
  var e = {};
  function n(r2) {
    var i2 = e[r2];
    if (void 0 !== i2) return i2.exports;
    var s2 = e[r2] = { id: r2, loaded: false, exports: {} };
    return t[r2].call(s2.exports, s2, s2.exports, n), s2.loaded = true, s2.exports;
  }
  n.n = (t2) => {
    var e2 = t2 && t2.__esModule ? () => t2.default : () => t2;
    return n.d(e2, { a: e2 }), e2;
  }, n.d = (t2, e2) => {
    for (var r2 in e2) n.o(e2, r2) && !n.o(t2, r2) && Object.defineProperty(t2, r2, { enumerable: true, get: e2[r2] });
  }, n.o = (t2, e2) => Object.prototype.hasOwnProperty.call(t2, e2), n.nmd = (t2) => (t2.paths = [], t2.children || (t2.children = []), t2);
  var r = n(737);
  var i = n.n(r);
  function s(t2) {
    if (!o(t2)) throw new Error("Parameter was not an error");
  }
  function o(t2) {
    return !!t2 && "object" == typeof t2 && "[object Error]" === (e2 = t2, Object.prototype.toString.call(e2)) || t2 instanceof Error;
    var e2;
  }
  var a = class _a extends Error {
    constructor(t2, e2) {
      const n2 = [...arguments], { options: r2, shortMessage: i2 } = (function(t3) {
        let e3, n3 = "";
        if (0 === t3.length) e3 = {};
        else if (o(t3[0])) e3 = { cause: t3[0] }, n3 = t3.slice(1).join(" ") || "";
        else if (t3[0] && "object" == typeof t3[0]) e3 = Object.assign({}, t3[0]), n3 = t3.slice(1).join(" ") || "";
        else {
          if ("string" != typeof t3[0]) throw new Error("Invalid arguments passed to Layerr");
          e3 = {}, n3 = n3 = t3.join(" ") || "";
        }
        return { options: e3, shortMessage: n3 };
      })(n2);
      let s2 = i2;
      if (r2.cause && (s2 = `${s2}: ${r2.cause.message}`), super(s2), this.message = s2, r2.name && "string" == typeof r2.name ? this.name = r2.name : this.name = "Layerr", r2.cause && Object.defineProperty(this, "_cause", { value: r2.cause }), Object.defineProperty(this, "_info", { value: {} }), r2.info && "object" == typeof r2.info && Object.assign(this._info, r2.info), Error.captureStackTrace) {
        const t3 = r2.constructorOpt || this.constructor;
        Error.captureStackTrace(this, t3);
      }
    }
    static cause(t2) {
      return s(t2), t2._cause && o(t2._cause) ? t2._cause : null;
    }
    static fullStack(t2) {
      s(t2);
      const e2 = _a.cause(t2);
      return e2 ? `${t2.stack}
caused by: ${_a.fullStack(e2)}` : t2.stack ?? "";
    }
    static info(t2) {
      s(t2);
      const e2 = {}, n2 = _a.cause(t2);
      return n2 && Object.assign(e2, _a.info(n2)), t2._info && Object.assign(e2, t2._info), e2;
    }
    toString() {
      let t2 = this.name || this.constructor.name || this.constructor.prototype.name;
      return this.message && (t2 = `${t2}: ${this.message}`), t2;
    }
  };
  var c = n(47);
  var l = n.n(c);
  var h = "__PATH_SEPARATOR_POSIX__";
  var u = "__PATH_SEPARATOR_WINDOWS__";
  function p(t2) {
    try {
      const e2 = t2.replace(/\//g, h).replace(/\\\\/g, u);
      return encodeURIComponent(e2).split(u).join("\\\\").split(h).join("/");
    } catch (t3) {
      throw new a(t3, "Failed encoding path");
    }
  }
  function f(t2) {
    return t2.startsWith("/") ? t2 : "/" + t2;
  }
  function d(t2) {
    let e2 = t2;
    return "/" !== e2[0] && (e2 = "/" + e2), /^.+\/$/.test(e2) && (e2 = e2.substr(0, e2.length - 1)), e2;
  }
  function g(t2) {
    let e2 = new (i())(t2).pathname;
    return e2.length <= 0 && (e2 = "/"), d(e2);
  }
  function m(...t2) {
    return (function() {
      return (function(t3) {
        var e2 = [];
        if (0 === t3.length) return "";
        if ("string" != typeof t3[0]) throw new TypeError("Url must be a string. Received " + t3[0]);
        if (t3[0].match(/^[^/:]+:\/*$/) && t3.length > 1) {
          var n2 = t3.shift();
          t3[0] = n2 + t3[0];
        }
        t3[0].match(/^file:\/\/\//) ? t3[0] = t3[0].replace(/^([^/:]+):\/*/, "$1:///") : t3[0] = t3[0].replace(/^([^/:]+):\/*/, "$1://");
        for (var r2 = 0; r2 < t3.length; r2++) {
          var i2 = t3[r2];
          if ("string" != typeof i2) throw new TypeError("Url must be a string. Received " + i2);
          "" !== i2 && (r2 > 0 && (i2 = i2.replace(/^[\/]+/, "")), i2 = r2 < t3.length - 1 ? i2.replace(/[\/]+$/, "") : i2.replace(/[\/]+$/, "/"), e2.push(i2));
        }
        var s2 = e2.join("/"), o2 = (s2 = s2.replace(/\/(\?|&|#[^!])/g, "$1")).split("?");
        return o2.shift() + (o2.length > 0 ? "?" : "") + o2.join("&");
      })("object" == typeof arguments[0] ? arguments[0] : [].slice.call(arguments));
    })(t2.reduce(((t3, e2, n2) => ((0 === n2 || "/" !== e2 || "/" === e2 && "/" !== t3[t3.length - 1]) && t3.push(e2), t3)), []));
  }
  var y = n(542);
  var b = n.n(y);
  function x(t2, e2) {
    const n2 = t2.url.replace("//", ""), r2 = -1 == n2.indexOf("/") ? "/" : n2.slice(n2.indexOf("/")), i2 = t2.method ? t2.method.toUpperCase() : "GET", s2 = !!/(^|,)\s*auth\s*($|,)/.test(e2.qop) && "auth", o2 = `00000000${e2.nc}`.slice(-8), a2 = (function(t3, e3, n3, r3, i3, s3, o3) {
      const a3 = o3 || b()(`${e3}:${n3}:${r3}`);
      return t3 && "md5-sess" === t3.toLowerCase() ? b()(`${a3}:${i3}:${s3}`) : a3;
    })(e2.algorithm, e2.username, e2.realm, e2.password, e2.nonce, e2.cnonce, e2.ha1), c2 = b()(`${i2}:${r2}`), l2 = s2 ? b()(`${a2}:${e2.nonce}:${o2}:${e2.cnonce}:${s2}:${c2}`) : b()(`${a2}:${e2.nonce}:${c2}`), h2 = { username: e2.username, realm: e2.realm, nonce: e2.nonce, uri: r2, qop: s2, response: l2, nc: o2, cnonce: e2.cnonce, algorithm: e2.algorithm, opaque: e2.opaque }, u2 = [];
    for (const t3 in h2) h2[t3] && ("qop" === t3 || "nc" === t3 || "algorithm" === t3 ? u2.push(`${t3}=${h2[t3]}`) : u2.push(`${t3}="${h2[t3]}"`));
    return `Digest ${u2.join(", ")}`;
  }
  function v(t2) {
    return "digest" === (t2.headers && t2.headers.get("www-authenticate") || "").split(/\s/)[0].toLowerCase();
  }
  var w = n(101);
  var E = n.n(w);
  function N(t2) {
    return E().decode(t2);
  }
  function A(t2, e2) {
    var n2;
    return `Basic ${n2 = `${t2}:${e2}`, E().encode(n2)}`;
  }
  var S = (function(t2) {
    return t2.Auto = "auto", t2.Digest = "digest", t2.None = "none", t2.Password = "password", t2.Token = "token", t2;
  })({});
  var T = (function(t2) {
    return t2.DataTypeNoLength = "data-type-no-length", t2.InvalidAuthType = "invalid-auth-type", t2.InvalidOutputFormat = "invalid-output-format", t2.LinkUnsupportedAuthType = "link-unsupported-auth", t2.InvalidUpdateRange = "invalid-update-range", t2.NotSupported = "not-supported", t2;
  })({});
  function P(t2, e2, n2, r2, i2) {
    switch (t2.authType) {
      case S.Auto:
        e2 && n2 && (t2.headers.Authorization = A(e2, n2));
        break;
      case S.Digest:
        t2.digest = /* @__PURE__ */ (function(t3, e3, n3) {
          return { username: t3, password: e3, ha1: n3, nc: 0, algorithm: "md5", hasDigestAuth: false };
        })(e2, n2, i2);
        break;
      case S.None:
        break;
      case S.Password:
        t2.headers.Authorization = A(e2, n2);
        break;
      case S.Token:
        t2.headers.Authorization = `${(s2 = r2).token_type} ${s2.access_token}`;
        break;
      default:
        throw new a({ info: { code: T.InvalidAuthType } }, `Invalid auth type: ${t2.authType}`);
    }
    var s2;
  }
  n(345), n(800);
  var O = "undefined" != typeof WorkerGlobalScope && self instanceof WorkerGlobalScope ? self : "undefined" != typeof window ? window : globalThis;
  var j = O.fetch.bind(O);
  O.Headers, O.Request, O.Response;
  var $ = "@@HOTPATCHER";
  var C = () => {
  };
  function _(t2) {
    return { original: t2, methods: [t2], final: false };
  }
  var I = class {
    constructor() {
      this._configuration = { registry: {}, getEmptyAction: "null" }, this.__type__ = $;
    }
    get configuration() {
      return this._configuration;
    }
    get getEmptyAction() {
      return this.configuration.getEmptyAction;
    }
    set getEmptyAction(t2) {
      this.configuration.getEmptyAction = t2;
    }
    control(t2, e2 = false) {
      if (!t2 || t2.__type__ !== $) throw new Error("Failed taking control of target HotPatcher instance: Invalid type or object");
      return Object.keys(t2.configuration.registry).forEach(((n2) => {
        this.configuration.registry.hasOwnProperty(n2) ? e2 && (this.configuration.registry[n2] = Object.assign({}, t2.configuration.registry[n2])) : this.configuration.registry[n2] = Object.assign({}, t2.configuration.registry[n2]);
      })), t2._configuration = this.configuration, this;
    }
    execute(t2, ...e2) {
      return (this.get(t2) || C)(...e2);
    }
    get(t2) {
      const e2 = this.configuration.registry[t2];
      if (!e2) switch (this.getEmptyAction) {
        case "null":
          return null;
        case "throw":
          throw new Error(`Failed handling method request: No method provided for override: ${t2}`);
        default:
          throw new Error(`Failed handling request which resulted in an empty method: Invalid empty-action specified: ${this.getEmptyAction}`);
      }
      return (function(...t3) {
        if (0 === t3.length) throw new Error("Failed creating sequence: No functions provided");
        return function(...e3) {
          let n2 = e3;
          const r2 = this;
          for (; t3.length > 0; ) n2 = [t3.shift().apply(r2, n2)];
          return n2[0];
        };
      })(...e2.methods);
    }
    isPatched(t2) {
      return !!this.configuration.registry[t2];
    }
    patch(t2, e2, n2 = {}) {
      const { chain: r2 = false } = n2;
      if (this.configuration.registry[t2] && this.configuration.registry[t2].final) throw new Error(`Failed patching '${t2}': Method marked as being final`);
      if ("function" != typeof e2) throw new Error(`Failed patching '${t2}': Provided method is not a function`);
      if (r2) this.configuration.registry[t2] ? this.configuration.registry[t2].methods.push(e2) : this.configuration.registry[t2] = _(e2);
      else if (this.isPatched(t2)) {
        const { original: n3 } = this.configuration.registry[t2];
        this.configuration.registry[t2] = Object.assign(_(e2), { original: n3 });
      } else this.configuration.registry[t2] = _(e2);
      return this;
    }
    patchInline(t2, e2, ...n2) {
      return this.isPatched(t2) || this.patch(t2, e2), this.execute(t2, ...n2);
    }
    plugin(t2, ...e2) {
      return e2.forEach(((e3) => {
        this.patch(t2, e3, { chain: true });
      })), this;
    }
    restore(t2) {
      if (!this.isPatched(t2)) throw new Error(`Failed restoring method: No method present for key: ${t2}`);
      if ("function" != typeof this.configuration.registry[t2].original) throw new Error(`Failed restoring method: Original method not found or of invalid type for key: ${t2}`);
      return this.configuration.registry[t2].methods = [this.configuration.registry[t2].original], this;
    }
    setFinal(t2) {
      if (!this.configuration.registry.hasOwnProperty(t2)) throw new Error(`Failed marking '${t2}' as final: No method found for key`);
      return this.configuration.registry[t2].final = true, this;
    }
  };
  var k = null;
  function R() {
    return k || (k = new I()), k;
  }
  function L(t2) {
    return (function(t3) {
      if ("object" != typeof t3 || null === t3 || "[object Object]" != Object.prototype.toString.call(t3)) return false;
      if (null === Object.getPrototypeOf(t3)) return true;
      let e2 = t3;
      for (; null !== Object.getPrototypeOf(e2); ) e2 = Object.getPrototypeOf(e2);
      return Object.getPrototypeOf(t3) === e2;
    })(t2) ? Object.assign({}, t2) : Object.setPrototypeOf(Object.assign({}, t2), Object.getPrototypeOf(t2));
  }
  function M(...t2) {
    let e2 = null, n2 = [...t2];
    for (; n2.length > 0; ) {
      const t3 = n2.shift();
      e2 = e2 ? D(e2, t3) : L(t3);
    }
    return e2;
  }
  function D(t2, e2) {
    const n2 = L(t2);
    return Object.keys(e2).forEach(((t3) => {
      n2.hasOwnProperty(t3) ? Array.isArray(e2[t3]) ? n2[t3] = Array.isArray(n2[t3]) ? [...n2[t3], ...e2[t3]] : [...e2[t3]] : "object" == typeof e2[t3] && e2[t3] ? n2[t3] = "object" == typeof n2[t3] && n2[t3] ? D(n2[t3], e2[t3]) : L(e2[t3]) : n2[t3] = e2[t3] : n2[t3] = e2[t3];
    })), n2;
  }
  function U(t2) {
    const e2 = {};
    return t2.forEach(((t3, n2) => {
      e2[n2] = t3;
    })), e2;
  }
  function V(...t2) {
    if (0 === t2.length) return {};
    const e2 = {};
    return t2.reduce(((t3, n2) => (Object.keys(n2).forEach(((r2) => {
      const i2 = r2.toLowerCase();
      e2.hasOwnProperty(i2) ? t3[e2[i2]] = n2[r2] : (e2[i2] = r2, t3[r2] = n2[r2]);
    })), t3)), {});
  }
  n(805);
  var q = "function" == typeof ArrayBuffer;
  var { toString: F } = Object.prototype;
  function W(t2) {
    return q && (t2 instanceof ArrayBuffer || "[object ArrayBuffer]" === F.call(t2));
  }
  function B(t2) {
    return null != t2 && null != t2.constructor && "function" == typeof t2.constructor.isBuffer && t2.constructor.isBuffer(t2);
  }
  function G(t2) {
    return function() {
      for (var e2 = [], n2 = 0; n2 < arguments.length; n2++) e2[n2] = arguments[n2];
      try {
        return Promise.resolve(t2.apply(this, e2));
      } catch (t3) {
        return Promise.reject(t3);
      }
    };
  }
  function z(t2, e2, n2) {
    return n2 ? e2 ? e2(t2) : t2 : (t2 && t2.then || (t2 = Promise.resolve(t2)), e2 ? t2.then(e2) : t2);
  }
  var H = G((function(t2) {
    const e2 = t2._digest;
    return delete t2._digest, e2.hasDigestAuth && (t2 = M(t2, { headers: { Authorization: x(t2, e2) } })), z(Q(t2), (function(n2) {
      let r2 = false;
      return i2 = function(t3) {
        return r2 ? t3 : n2;
      }, (s2 = (function() {
        if (401 == n2.status) return e2.hasDigestAuth = (function(t3, e3) {
          if (!v(t3)) return false;
          const n3 = /([a-z0-9_-]+)=(?:"([^"]+)"|([a-z0-9_-]+))/gi;
          for (; ; ) {
            const r3 = t3.headers && t3.headers.get("www-authenticate") || "", i3 = n3.exec(r3);
            if (!i3) break;
            e3[i3[1]] = i3[2] || i3[3];
          }
          return e3.nc += 1, e3.cnonce = (function() {
            let t4 = "";
            for (let e4 = 0; e4 < 32; ++e4) t4 = `${t4}${"abcdef0123456789"[Math.floor(16 * Math.random())]}`;
            return t4;
          })(), true;
        })(n2, e2), (function() {
          if (e2.hasDigestAuth) return z(Q(t2 = M(t2, { headers: { Authorization: x(t2, e2) } })), (function(t3) {
            return 401 == t3.status ? e2.hasDigestAuth = false : e2.nc++, r2 = true, t3;
          }));
        })();
        e2.nc++;
      })()) && s2.then ? s2.then(i2) : i2(s2);
      var i2, s2;
    }));
  }));
  var X = G((function(t2, e2) {
    return z(Q(t2), (function(n2) {
      return n2.ok ? (e2.authType = S.Password, n2) : 401 == n2.status && v(n2) ? (e2.authType = S.Digest, P(e2, e2.username, e2.password, void 0, void 0), t2._digest = e2.digest, H(t2)) : n2;
    }));
  }));
  var Y = G((function(t2, e2) {
    return e2.authType === S.Auto ? X(t2, e2) : t2._digest ? H(t2) : Q(t2);
  }));
  function Z(t2, e2, n2) {
    const r2 = L(t2);
    return r2.headers = V(e2.headers, r2.headers || {}, n2.headers || {}), void 0 !== n2.data && (r2.data = n2.data), n2.signal && (r2.signal = n2.signal), e2.httpAgent && (r2.httpAgent = e2.httpAgent), e2.httpsAgent && (r2.httpsAgent = e2.httpsAgent), e2.digest && (r2._digest = e2.digest), "boolean" == typeof e2.withCredentials && (r2.withCredentials = e2.withCredentials), r2;
  }
  function Q(t2) {
    const e2 = R();
    return e2.patchInline("request", ((t3) => e2.patchInline("fetch", j, t3.url, (function(t4) {
      let e3 = {};
      const n2 = { method: t4.method };
      if (t4.headers && (e3 = V(e3, t4.headers)), void 0 !== t4.data) {
        const [r2, i2] = (function(t5) {
          if ("string" == typeof t5) return [t5, {}];
          if (B(t5)) return [t5, {}];
          if (W(t5)) return [t5, {}];
          if (t5 && "object" == typeof t5) return [JSON.stringify(t5), { "content-type": "application/json" }];
          throw new Error("Unable to convert request body: Unexpected body type: " + typeof t5);
        })(t4.data);
        n2.body = r2, e3 = V(e3, i2);
      }
      return t4.signal && (n2.signal = t4.signal), t4.withCredentials && (n2.credentials = "include"), n2.headers = e3, n2;
    })(t3))), t2);
  }
  var J = n(285);
  var K = (t2) => {
    if ("string" != typeof t2) throw new TypeError("invalid pattern");
    if (t2.length > 65536) throw new TypeError("pattern is too long");
  };
  var tt = { "[:alnum:]": ["\\p{L}\\p{Nl}\\p{Nd}", true], "[:alpha:]": ["\\p{L}\\p{Nl}", true], "[:ascii:]": ["\\x00-\\x7f", false], "[:blank:]": ["\\p{Zs}\\t", true], "[:cntrl:]": ["\\p{Cc}", true], "[:digit:]": ["\\p{Nd}", true], "[:graph:]": ["\\p{Z}\\p{C}", true, true], "[:lower:]": ["\\p{Ll}", true], "[:print:]": ["\\p{C}", true], "[:punct:]": ["\\p{P}", true], "[:space:]": ["\\p{Z}\\t\\r\\n\\v\\f", true], "[:upper:]": ["\\p{Lu}", true], "[:word:]": ["\\p{L}\\p{Nl}\\p{Nd}\\p{Pc}", true], "[:xdigit:]": ["A-Fa-f0-9", false] };
  var et = (t2) => t2.replace(/[[\]\\-]/g, "\\$&");
  var nt = (t2) => t2.join("");
  var rt = (t2, e2) => {
    const n2 = e2;
    if ("[" !== t2.charAt(n2)) throw new Error("not in a brace expression");
    const r2 = [], i2 = [];
    let s2 = n2 + 1, o2 = false, a2 = false, c2 = false, l2 = false, h2 = n2, u2 = "";
    t: for (; s2 < t2.length; ) {
      const e3 = t2.charAt(s2);
      if ("!" !== e3 && "^" !== e3 || s2 !== n2 + 1) {
        if ("]" === e3 && o2 && !c2) {
          h2 = s2 + 1;
          break;
        }
        if (o2 = true, "\\" !== e3 || c2) {
          if ("[" === e3 && !c2) {
            for (const [e4, [o3, c3, l3]] of Object.entries(tt)) if (t2.startsWith(e4, s2)) {
              if (u2) return ["$.", false, t2.length - n2, true];
              s2 += e4.length, l3 ? i2.push(o3) : r2.push(o3), a2 = a2 || c3;
              continue t;
            }
          }
          c2 = false, u2 ? (e3 > u2 ? r2.push(et(u2) + "-" + et(e3)) : e3 === u2 && r2.push(et(e3)), u2 = "", s2++) : t2.startsWith("-]", s2 + 1) ? (r2.push(et(e3 + "-")), s2 += 2) : t2.startsWith("-", s2 + 1) ? (u2 = e3, s2 += 2) : (r2.push(et(e3)), s2++);
        } else c2 = true, s2++;
      } else l2 = true, s2++;
    }
    if (h2 < s2) return ["", false, 0, false];
    if (!r2.length && !i2.length) return ["$.", false, t2.length - n2, true];
    if (0 === i2.length && 1 === r2.length && /^\\?.$/.test(r2[0]) && !l2) {
      return [(p2 = 2 === r2[0].length ? r2[0].slice(-1) : r2[0], p2.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&")), false, h2 - n2, false];
    }
    var p2;
    const f2 = "[" + (l2 ? "^" : "") + nt(r2) + "]", d2 = "[" + (l2 ? "" : "^") + nt(i2) + "]";
    return [r2.length && i2.length ? "(" + f2 + "|" + d2 + ")" : r2.length ? f2 : d2, a2, h2 - n2, true];
  };
  var it = (t2, { windowsPathsNoEscape: e2 = false } = {}) => e2 ? t2.replace(/\[([^\/\\])\]/g, "$1") : t2.replace(/((?!\\).|^)\[([^\/\\])\]/g, "$1$2").replace(/\\([^\/])/g, "$1");
  var st;
  var ot = /* @__PURE__ */ new Set(["!", "?", "+", "*", "@"]);
  var at = (t2) => ot.has(t2);
  var ct = (t2) => at(t2.type);
  var lt = /* @__PURE__ */ new Map([["!", ["@"]], ["?", ["?", "@"]], ["@", ["@"]], ["*", ["*", "+", "?", "@"]], ["+", ["+", "@"]]]);
  var ht = /* @__PURE__ */ new Map([["!", ["?"]], ["@", ["?"]], ["+", ["?", "*"]]]);
  var ut = /* @__PURE__ */ new Map([["!", ["?", "@"]], ["?", ["?", "@"]], ["@", ["?", "@"]], ["*", ["*", "+", "?", "@"]], ["+", ["+", "@", "?", "*"]]]);
  var pt = /* @__PURE__ */ new Map([["!", /* @__PURE__ */ new Map([["!", "@"]])], ["?", /* @__PURE__ */ new Map([["*", "*"], ["+", "*"]])], ["@", /* @__PURE__ */ new Map([["!", "!"], ["?", "?"], ["@", "@"], ["*", "*"], ["+", "+"]])], ["+", /* @__PURE__ */ new Map([["?", "*"], ["*", "*"]])]]);
  var ft = "(?!\\.)";
  var dt = /* @__PURE__ */ new Set(["[", "."]);
  var gt = /* @__PURE__ */ new Set(["..", "."]);
  var mt = new Set("().*{}+?[]^$\\!");
  var yt = "[^/]";
  var bt = yt + "*?";
  var xt = yt + "+?";
  var vt = class {
    type;
    #t;
    #e;
    #n = false;
    #r = [];
    #i;
    #s;
    #o;
    #a = false;
    #c;
    #l;
    #h = false;
    constructor(t2, e2, n2 = {}) {
      this.type = t2, t2 && (this.#e = true), this.#i = e2, this.#t = this.#i ? this.#i.#t : this, this.#c = this.#t === this ? n2 : this.#t.#c, this.#o = this.#t === this ? [] : this.#t.#o, "!" !== t2 || this.#t.#a || this.#o.push(this), this.#s = this.#i ? this.#i.#r.length : 0;
    }
    get hasMagic() {
      if (void 0 !== this.#e) return this.#e;
      for (const t2 of this.#r) if ("string" != typeof t2 && (t2.type || t2.hasMagic)) return this.#e = true;
      return this.#e;
    }
    toString() {
      return void 0 !== this.#l ? this.#l : this.type ? this.#l = this.type + "(" + this.#r.map(((t2) => String(t2))).join("|") + ")" : this.#l = this.#r.map(((t2) => String(t2))).join("");
    }
    #u() {
      if (this !== this.#t) throw new Error("should only call on root");
      if (this.#a) return this;
      let t2;
      for (this.toString(), this.#a = true; t2 = this.#o.pop(); ) {
        if ("!" !== t2.type) continue;
        let e2 = t2, n2 = e2.#i;
        for (; n2; ) {
          for (let r2 = e2.#s + 1; !n2.type && r2 < n2.#r.length; r2++) for (const e3 of t2.#r) {
            if ("string" == typeof e3) throw new Error("string part in extglob AST??");
            e3.copyIn(n2.#r[r2]);
          }
          e2 = n2, n2 = e2.#i;
        }
      }
      return this;
    }
    push(...t2) {
      for (const e2 of t2) if ("" !== e2) {
        if ("string" != typeof e2 && !(e2 instanceof st && e2.#i === this)) throw new Error("invalid part: " + e2);
        this.#r.push(e2);
      }
    }
    toJSON() {
      const t2 = null === this.type ? this.#r.slice().map(((t3) => "string" == typeof t3 ? t3 : t3.toJSON())) : [this.type, ...this.#r.map(((t3) => t3.toJSON()))];
      return this.isStart() && !this.type && t2.unshift([]), this.isEnd() && (this === this.#t || this.#t.#a && "!" === this.#i?.type) && t2.push({}), t2;
    }
    isStart() {
      if (this.#t === this) return true;
      if (!this.#i?.isStart()) return false;
      if (0 === this.#s) return true;
      const t2 = this.#i;
      for (let e2 = 0; e2 < this.#s; e2++) {
        const n2 = t2.#r[e2];
        if (!(n2 instanceof st && "!" === n2.type)) return false;
      }
      return true;
    }
    isEnd() {
      if (this.#t === this) return true;
      if ("!" === this.#i?.type) return true;
      if (!this.#i?.isEnd()) return false;
      if (!this.type) return this.#i?.isEnd();
      const t2 = this.#i ? this.#i.#r.length : 0;
      return this.#s === t2 - 1;
    }
    copyIn(t2) {
      "string" == typeof t2 ? this.push(t2) : this.push(t2.clone(this));
    }
    clone(t2) {
      const e2 = new st(this.type, t2);
      for (const t3 of this.#r) e2.copyIn(t3);
      return e2;
    }
    static #p(t2, e2, n2, r2, i2) {
      const s2 = r2.maxExtglobRecursion ?? 2;
      let o2 = false, a2 = false, c2 = -1, l2 = false;
      if (null === e2.type) {
        let h3 = n2, u3 = "";
        for (; h3 < t2.length; ) {
          const n3 = t2.charAt(h3++);
          if (o2 || "\\" === n3) o2 = !o2, u3 += n3;
          else if (a2) h3 === c2 + 1 ? "^" !== n3 && "!" !== n3 || (l2 = true) : "]" !== n3 || h3 === c2 + 2 && l2 || (a2 = false), u3 += n3;
          else if ("[" !== n3) if (!r2.noext && at(n3) && "(" === t2.charAt(h3) && i2 <= s2) {
            e2.push(u3), u3 = "";
            const s3 = new st(n3, e2);
            h3 = st.#p(t2, s3, h3, r2, i2 + 1), e2.push(s3);
          } else u3 += n3;
          else a2 = true, c2 = h3, l2 = false, u3 += n3;
        }
        return e2.push(u3), h3;
      }
      let h2 = n2 + 1, u2 = new st(null, e2);
      const p2 = [];
      let f2 = "";
      for (; h2 < t2.length; ) {
        const n3 = t2.charAt(h2++);
        if (o2 || "\\" === n3) o2 = !o2, f2 += n3;
        else if (a2) h2 === c2 + 1 ? "^" !== n3 && "!" !== n3 || (l2 = true) : "]" !== n3 || h2 === c2 + 2 && l2 || (a2 = false), f2 += n3;
        else if ("[" !== n3) if (at(n3) && "(" === t2.charAt(h2) && (i2 <= s2 || e2 && e2.#f(n3))) {
          const s3 = e2 && e2.#f(n3) ? 0 : 1;
          u2.push(f2), f2 = "";
          const o3 = new st(n3, u2);
          u2.push(o3), h2 = st.#p(t2, o3, h2, r2, i2 + s3);
        } else if ("|" !== n3) {
          if (")" === n3) return "" === f2 && 0 === e2.#r.length && (e2.#h = true), u2.push(f2), f2 = "", e2.push(...p2, u2), h2;
          f2 += n3;
        } else u2.push(f2), f2 = "", p2.push(u2), u2 = new st(null, e2);
        else a2 = true, c2 = h2, l2 = false, f2 += n3;
      }
      return e2.type = null, e2.#e = void 0, e2.#r = [t2.substring(n2 - 1)], h2;
    }
    #d(t2) {
      return this.#g(t2, ht);
    }
    #g(t2, e2 = lt) {
      if (!t2 || "object" != typeof t2 || null !== t2.type || 1 !== t2.#r.length || null === this.type) return false;
      const n2 = t2.#r[0];
      return !(!n2 || "object" != typeof n2 || null === n2.type) && this.#f(n2.type, e2);
    }
    #f(t2, e2 = ut) {
      return !!e2.get(this.type)?.includes(t2);
    }
    #m(t2, e2) {
      const n2 = t2.#r[0], r2 = new st(null, n2, this.options);
      r2.#r.push(""), n2.push(r2), this.#y(t2, e2);
    }
    #y(t2, e2) {
      const n2 = t2.#r[0];
      this.#r.splice(e2, 1, ...n2.#r);
      for (const t3 of n2.#r) "object" == typeof t3 && (t3.#i = this);
      this.#l = void 0;
    }
    #b(t2) {
      const e2 = pt.get(this.type);
      return !!e2?.has(t2);
    }
    #x(t2) {
      if (!t2 || "object" != typeof t2 || null !== t2.type || 1 !== t2.#r.length || null === this.type || 1 !== this.#r.length) return false;
      const e2 = t2.#r[0];
      return !(!e2 || "object" != typeof e2 || null === e2.type) && this.#b(e2.type);
    }
    #v(t2) {
      const e2 = pt.get(this.type), n2 = t2.#r[0], r2 = e2?.get(n2.type);
      if (!r2) return false;
      this.#r = n2.#r;
      for (const t3 of this.#r) "object" == typeof t3 && (t3.#i = this);
      this.type = r2, this.#l = void 0, this.#h = false;
    }
    #w() {
      if (ct(this)) {
        let t2 = 0, e2 = false;
        do {
          e2 = true;
          for (let t3 = 0; t3 < this.#r.length; t3++) {
            const n2 = this.#r[t3];
            "object" == typeof n2 && (n2.#w(), this.#g(n2) ? (e2 = false, this.#y(n2, t3)) : this.#d(n2) ? (e2 = false, this.#m(n2, t3)) : this.#x(n2) && (e2 = false, this.#v(n2)));
          }
        } while (!e2 && ++t2 < 10);
      } else for (const t2 of this.#r) "object" == typeof t2 && t2.#w();
      this.#l = void 0;
    }
    static fromGlob(t2, e2 = {}) {
      const n2 = new st(null, void 0, e2);
      return st.#p(t2, n2, 0, e2, 0), n2;
    }
    toMMPattern() {
      if (this !== this.#t) return this.#t.toMMPattern();
      const t2 = this.toString(), [e2, n2, r2, i2] = this.toRegExpSource();
      if (!(r2 || this.#e || this.#c.nocase && !this.#c.nocaseMagicOnly && t2.toUpperCase() !== t2.toLowerCase())) return n2;
      const s2 = (this.#c.nocase ? "i" : "") + (i2 ? "u" : "");
      return Object.assign(new RegExp(`^${e2}$`, s2), { _src: e2, _glob: t2 });
    }
    get options() {
      return this.#c;
    }
    toRegExpSource(t2) {
      const e2 = t2 ?? !!this.#c.dot;
      if (this.#t === this && (this.#w(), this.#u()), !ct(this)) {
        const n3 = this.isStart() && this.isEnd(), r3 = this.#r.map(((e3) => {
          const [r4, i4, s4, o3] = "string" == typeof e3 ? st.#E(e3, this.#e, n3) : e3.toRegExpSource(t2);
          return this.#e = this.#e || s4, this.#n = this.#n || o3, r4;
        })).join("");
        let i3 = "";
        if (this.isStart() && "string" == typeof this.#r[0] && (1 !== this.#r.length || !gt.has(this.#r[0]))) {
          const n4 = dt, s4 = e2 && n4.has(r3.charAt(0)) || r3.startsWith("\\.") && n4.has(r3.charAt(2)) || r3.startsWith("\\.\\.") && n4.has(r3.charAt(4)), o3 = !e2 && !t2 && n4.has(r3.charAt(0));
          i3 = s4 ? "(?!(?:^|/)\\.\\.?(?:$|/))" : o3 ? ft : "";
        }
        let s3 = "";
        return this.isEnd() && this.#t.#a && "!" === this.#i?.type && (s3 = "(?:$|\\/)"), [i3 + r3 + s3, it(r3), this.#e = !!this.#e, this.#n];
      }
      const n2 = "*" === this.type || "+" === this.type, r2 = "!" === this.type ? "(?:(?!(?:" : "(?:";
      let i2 = this.#N(e2);
      if (this.isStart() && this.isEnd() && !i2 && "!" !== this.type) {
        const t3 = this.toString(), e3 = this;
        return e3.#r = [t3], e3.type = null, e3.#e = void 0, [t3, it(this.toString()), false, false];
      }
      let s2 = !n2 || t2 || e2 ? "" : this.#N(true);
      s2 === i2 && (s2 = ""), s2 && (i2 = `(?:${i2})(?:${s2})*?`);
      let o2 = "";
      return o2 = "!" === this.type && this.#h ? (this.isStart() && !e2 ? ft : "") + xt : r2 + i2 + ("!" === this.type ? "))" + (!this.isStart() || e2 || t2 ? "" : ft) + bt + ")" : "@" === this.type ? ")" : "?" === this.type ? ")?" : "+" === this.type && s2 ? ")" : "*" === this.type && s2 ? ")?" : `)${this.type}`), [o2, it(i2), this.#e = !!this.#e, this.#n];
    }
    #N(t2) {
      return this.#r.map(((e2) => {
        if ("string" == typeof e2) throw new Error("string type in extglob ast??");
        const [n2, r2, i2, s2] = e2.toRegExpSource(t2);
        return this.#n = this.#n || s2, n2;
      })).filter(((t3) => !(this.isStart() && this.isEnd() && !t3))).join("|");
    }
    static #E(t2, e2, n2 = false) {
      let r2 = false, i2 = "", s2 = false, o2 = false;
      for (let a2 = 0; a2 < t2.length; a2++) {
        const c2 = t2.charAt(a2);
        if (r2) r2 = false, i2 += (mt.has(c2) ? "\\" : "") + c2, o2 = false;
        else if ("\\" !== c2) {
          if ("[" === c2) {
            const [n3, r3, c3, l2] = rt(t2, a2);
            if (c3) {
              i2 += n3, s2 = s2 || r3, a2 += c3 - 1, e2 = e2 || l2, o2 = false;
              continue;
            }
          }
          if ("*" !== c2) o2 = false, "?" !== c2 ? i2 += c2.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&") : (i2 += yt, e2 = true);
          else {
            if (o2) continue;
            o2 = true, i2 += n2 && /^[*]+$/.test(t2) ? xt : bt, e2 = true;
          }
        } else a2 === t2.length - 1 ? i2 += "\\\\" : r2 = true;
      }
      return [i2, it(t2), !!e2, s2];
    }
  };
  st = vt;
  var wt = (t2, e2, n2 = {}) => (K(e2), !(!n2.nocomment && "#" === e2.charAt(0)) && new Ht(e2, n2).match(t2));
  var Et = /^\*+([^+@!?\*\[\(]*)$/;
  var Nt = (t2) => (e2) => !e2.startsWith(".") && e2.endsWith(t2);
  var At = (t2) => (e2) => e2.endsWith(t2);
  var St = (t2) => (t2 = t2.toLowerCase(), (e2) => !e2.startsWith(".") && e2.toLowerCase().endsWith(t2));
  var Tt = (t2) => (t2 = t2.toLowerCase(), (e2) => e2.toLowerCase().endsWith(t2));
  var Pt = /^\*+\.\*+$/;
  var Ot = (t2) => !t2.startsWith(".") && t2.includes(".");
  var jt = (t2) => "." !== t2 && ".." !== t2 && t2.includes(".");
  var $t = /^\.\*+$/;
  var Ct = (t2) => "." !== t2 && ".." !== t2 && t2.startsWith(".");
  var _t = /^\*+$/;
  var It = (t2) => 0 !== t2.length && !t2.startsWith(".");
  var kt = (t2) => 0 !== t2.length && "." !== t2 && ".." !== t2;
  var Rt = /^\?+([^+@!?\*\[\(]*)?$/;
  var Lt = ([t2, e2 = ""]) => {
    const n2 = Vt([t2]);
    return e2 ? (e2 = e2.toLowerCase(), (t3) => n2(t3) && t3.toLowerCase().endsWith(e2)) : n2;
  };
  var Mt = ([t2, e2 = ""]) => {
    const n2 = qt([t2]);
    return e2 ? (e2 = e2.toLowerCase(), (t3) => n2(t3) && t3.toLowerCase().endsWith(e2)) : n2;
  };
  var Dt = ([t2, e2 = ""]) => {
    const n2 = qt([t2]);
    return e2 ? (t3) => n2(t3) && t3.endsWith(e2) : n2;
  };
  var Ut = ([t2, e2 = ""]) => {
    const n2 = Vt([t2]);
    return e2 ? (t3) => n2(t3) && t3.endsWith(e2) : n2;
  };
  var Vt = ([t2]) => {
    const e2 = t2.length;
    return (t3) => t3.length === e2 && !t3.startsWith(".");
  };
  var qt = ([t2]) => {
    const e2 = t2.length;
    return (t3) => t3.length === e2 && "." !== t3 && ".." !== t3;
  };
  var Ft = "object" == typeof process && process ? "object" == typeof process.env && process.env && process.env.__MINIMATCH_TESTING_PLATFORM__ || process.platform : "posix";
  wt.sep = "win32" === Ft ? "\\" : "/";
  var Wt = Symbol("globstar **");
  wt.GLOBSTAR = Wt, wt.filter = (t2, e2 = {}) => (n2) => wt(n2, t2, e2);
  var Bt = (t2, e2 = {}) => Object.assign({}, t2, e2);
  wt.defaults = (t2) => {
    if (!t2 || "object" != typeof t2 || !Object.keys(t2).length) return wt;
    const e2 = wt;
    return Object.assign(((n2, r2, i2 = {}) => e2(n2, r2, Bt(t2, i2))), { Minimatch: class extends e2.Minimatch {
      constructor(e3, n2 = {}) {
        super(e3, Bt(t2, n2));
      }
      static defaults(n2) {
        return e2.defaults(Bt(t2, n2)).Minimatch;
      }
    }, AST: class extends e2.AST {
      constructor(e3, n2, r2 = {}) {
        super(e3, n2, Bt(t2, r2));
      }
      static fromGlob(n2, r2 = {}) {
        return e2.AST.fromGlob(n2, Bt(t2, r2));
      }
    }, unescape: (n2, r2 = {}) => e2.unescape(n2, Bt(t2, r2)), escape: (n2, r2 = {}) => e2.escape(n2, Bt(t2, r2)), filter: (n2, r2 = {}) => e2.filter(n2, Bt(t2, r2)), defaults: (n2) => e2.defaults(Bt(t2, n2)), makeRe: (n2, r2 = {}) => e2.makeRe(n2, Bt(t2, r2)), braceExpand: (n2, r2 = {}) => e2.braceExpand(n2, Bt(t2, r2)), match: (n2, r2, i2 = {}) => e2.match(n2, r2, Bt(t2, i2)), sep: e2.sep, GLOBSTAR: Wt });
  };
  var Gt = (t2, e2 = {}) => (K(t2), e2.nobrace || !/\{(?:(?!\{).)*\}/.test(t2) ? [t2] : J(t2));
  wt.braceExpand = Gt, wt.makeRe = (t2, e2 = {}) => new Ht(t2, e2).makeRe(), wt.match = (t2, e2, n2 = {}) => {
    const r2 = new Ht(e2, n2);
    return t2 = t2.filter(((t3) => r2.match(t3))), r2.options.nonull && !t2.length && t2.push(e2), t2;
  };
  var zt = /[?*]|[+@!]\(.*?\)|\[|\]/;
  var Ht = class {
    options;
    set;
    pattern;
    windowsPathsNoEscape;
    nonegate;
    negate;
    comment;
    empty;
    preserveMultipleSlashes;
    partial;
    globSet;
    globParts;
    nocase;
    isWindows;
    platform;
    windowsNoMagicRoot;
    maxGlobstarRecursion;
    regexp;
    constructor(t2, e2 = {}) {
      K(t2), e2 = e2 || {}, this.options = e2, this.maxGlobstarRecursion = e2.maxGlobstarRecursion ?? 200, this.pattern = t2, this.platform = e2.platform || Ft, this.isWindows = "win32" === this.platform, this.windowsPathsNoEscape = !!e2.windowsPathsNoEscape || false === e2.allowWindowsEscape, this.windowsPathsNoEscape && (this.pattern = this.pattern.replace(/\\/g, "/")), this.preserveMultipleSlashes = !!e2.preserveMultipleSlashes, this.regexp = null, this.negate = false, this.nonegate = !!e2.nonegate, this.comment = false, this.empty = false, this.partial = !!e2.partial, this.nocase = !!this.options.nocase, this.windowsNoMagicRoot = void 0 !== e2.windowsNoMagicRoot ? e2.windowsNoMagicRoot : !(!this.isWindows || !this.nocase), this.globSet = [], this.globParts = [], this.set = [], this.make();
    }
    hasMagic() {
      if (this.options.magicalBraces && this.set.length > 1) return true;
      for (const t2 of this.set) for (const e2 of t2) if ("string" != typeof e2) return true;
      return false;
    }
    debug(...t2) {
    }
    make() {
      const t2 = this.pattern, e2 = this.options;
      if (!e2.nocomment && "#" === t2.charAt(0)) return void (this.comment = true);
      if (!t2) return void (this.empty = true);
      this.parseNegate(), this.globSet = [...new Set(this.braceExpand())], e2.debug && (this.debug = (...t3) => console.error(...t3)), this.debug(this.pattern, this.globSet);
      const n2 = this.globSet.map(((t3) => this.slashSplit(t3)));
      this.globParts = this.preprocess(n2), this.debug(this.pattern, this.globParts);
      let r2 = this.globParts.map(((t3, e3, n3) => {
        if (this.isWindows && this.windowsNoMagicRoot) {
          const e4 = !("" !== t3[0] || "" !== t3[1] || "?" !== t3[2] && zt.test(t3[2]) || zt.test(t3[3])), n4 = /^[a-z]:/i.test(t3[0]);
          if (e4) return [...t3.slice(0, 4), ...t3.slice(4).map(((t4) => this.parse(t4)))];
          if (n4) return [t3[0], ...t3.slice(1).map(((t4) => this.parse(t4)))];
        }
        return t3.map(((t4) => this.parse(t4)));
      }));
      if (this.debug(this.pattern, r2), this.set = r2.filter(((t3) => -1 === t3.indexOf(false))), this.isWindows) for (let t3 = 0; t3 < this.set.length; t3++) {
        const e3 = this.set[t3];
        "" === e3[0] && "" === e3[1] && "?" === this.globParts[t3][2] && "string" == typeof e3[3] && /^[a-z]:$/i.test(e3[3]) && (e3[2] = "?");
      }
      this.debug(this.pattern, this.set);
    }
    preprocess(t2) {
      if (this.options.noglobstar) for (let e3 = 0; e3 < t2.length; e3++) for (let n2 = 0; n2 < t2[e3].length; n2++) "**" === t2[e3][n2] && (t2[e3][n2] = "*");
      const { optimizationLevel: e2 = 1 } = this.options;
      return e2 >= 2 ? (t2 = this.firstPhasePreProcess(t2), t2 = this.secondPhasePreProcess(t2)) : t2 = e2 >= 1 ? this.levelOneOptimize(t2) : this.adjascentGlobstarOptimize(t2), t2;
    }
    adjascentGlobstarOptimize(t2) {
      return t2.map(((t3) => {
        let e2 = -1;
        for (; -1 !== (e2 = t3.indexOf("**", e2 + 1)); ) {
          let n2 = e2;
          for (; "**" === t3[n2 + 1]; ) n2++;
          n2 !== e2 && t3.splice(e2, n2 - e2);
        }
        return t3;
      }));
    }
    levelOneOptimize(t2) {
      return t2.map(((t3) => 0 === (t3 = t3.reduce(((t4, e2) => {
        const n2 = t4[t4.length - 1];
        return "**" === e2 && "**" === n2 ? t4 : ".." === e2 && n2 && ".." !== n2 && "." !== n2 && "**" !== n2 ? (t4.pop(), t4) : (t4.push(e2), t4);
      }), [])).length ? [""] : t3));
    }
    levelTwoFileOptimize(t2) {
      Array.isArray(t2) || (t2 = this.slashSplit(t2));
      let e2 = false;
      do {
        if (e2 = false, !this.preserveMultipleSlashes) {
          for (let n3 = 1; n3 < t2.length - 1; n3++) {
            const r2 = t2[n3];
            1 === n3 && "" === r2 && "" === t2[0] || "." !== r2 && "" !== r2 || (e2 = true, t2.splice(n3, 1), n3--);
          }
          "." !== t2[0] || 2 !== t2.length || "." !== t2[1] && "" !== t2[1] || (e2 = true, t2.pop());
        }
        let n2 = 0;
        for (; -1 !== (n2 = t2.indexOf("..", n2 + 1)); ) {
          const r2 = t2[n2 - 1];
          r2 && "." !== r2 && ".." !== r2 && "**" !== r2 && (e2 = true, t2.splice(n2 - 1, 2), n2 -= 2);
        }
      } while (e2);
      return 0 === t2.length ? [""] : t2;
    }
    firstPhasePreProcess(t2) {
      let e2 = false;
      do {
        e2 = false;
        for (let n2 of t2) {
          let r2 = -1;
          for (; -1 !== (r2 = n2.indexOf("**", r2 + 1)); ) {
            let i3 = r2;
            for (; "**" === n2[i3 + 1]; ) i3++;
            i3 > r2 && n2.splice(r2 + 1, i3 - r2);
            let s2 = n2[r2 + 1];
            const o2 = n2[r2 + 2], a2 = n2[r2 + 3];
            if (".." !== s2) continue;
            if (!o2 || "." === o2 || ".." === o2 || !a2 || "." === a2 || ".." === a2) continue;
            e2 = true, n2.splice(r2, 1);
            const c2 = n2.slice(0);
            c2[r2] = "**", t2.push(c2), r2--;
          }
          if (!this.preserveMultipleSlashes) {
            for (let t3 = 1; t3 < n2.length - 1; t3++) {
              const r3 = n2[t3];
              1 === t3 && "" === r3 && "" === n2[0] || "." !== r3 && "" !== r3 || (e2 = true, n2.splice(t3, 1), t3--);
            }
            "." !== n2[0] || 2 !== n2.length || "." !== n2[1] && "" !== n2[1] || (e2 = true, n2.pop());
          }
          let i2 = 0;
          for (; -1 !== (i2 = n2.indexOf("..", i2 + 1)); ) {
            const t3 = n2[i2 - 1];
            if (t3 && "." !== t3 && ".." !== t3 && "**" !== t3) {
              e2 = true;
              const t4 = 1 === i2 && "**" === n2[i2 + 1] ? ["."] : [];
              n2.splice(i2 - 1, 2, ...t4), 0 === n2.length && n2.push(""), i2 -= 2;
            }
          }
        }
      } while (e2);
      return t2;
    }
    secondPhasePreProcess(t2) {
      for (let e2 = 0; e2 < t2.length - 1; e2++) for (let n2 = e2 + 1; n2 < t2.length; n2++) {
        const r2 = this.partsMatch(t2[e2], t2[n2], !this.preserveMultipleSlashes);
        if (r2) {
          t2[e2] = [], t2[n2] = r2;
          break;
        }
      }
      return t2.filter(((t3) => t3.length));
    }
    partsMatch(t2, e2, n2 = false) {
      let r2 = 0, i2 = 0, s2 = [], o2 = "";
      for (; r2 < t2.length && i2 < e2.length; ) if (t2[r2] === e2[i2]) s2.push("b" === o2 ? e2[i2] : t2[r2]), r2++, i2++;
      else if (n2 && "**" === t2[r2] && e2[i2] === t2[r2 + 1]) s2.push(t2[r2]), r2++;
      else if (n2 && "**" === e2[i2] && t2[r2] === e2[i2 + 1]) s2.push(e2[i2]), i2++;
      else if ("*" !== t2[r2] || !e2[i2] || !this.options.dot && e2[i2].startsWith(".") || "**" === e2[i2]) {
        if ("*" !== e2[i2] || !t2[r2] || !this.options.dot && t2[r2].startsWith(".") || "**" === t2[r2]) return false;
        if ("a" === o2) return false;
        o2 = "b", s2.push(e2[i2]), r2++, i2++;
      } else {
        if ("b" === o2) return false;
        o2 = "a", s2.push(t2[r2]), r2++, i2++;
      }
      return t2.length === e2.length && s2;
    }
    parseNegate() {
      if (this.nonegate) return;
      const t2 = this.pattern;
      let e2 = false, n2 = 0;
      for (let r2 = 0; r2 < t2.length && "!" === t2.charAt(r2); r2++) e2 = !e2, n2++;
      n2 && (this.pattern = t2.slice(n2)), this.negate = e2;
    }
    matchOne(t2, e2, n2 = false) {
      let r2 = 0, i2 = 0;
      if (this.isWindows) {
        const n3 = "string" == typeof t2[0] && /^[a-z]:$/i.test(t2[0]), s3 = !n3 && "" === t2[0] && "" === t2[1] && "?" === t2[2] && /^[a-z]:$/i.test(t2[3]), o2 = "string" == typeof e2[0] && /^[a-z]:$/i.test(e2[0]), a2 = s3 ? 3 : n3 ? 0 : void 0, c2 = !o2 && "" === e2[0] && "" === e2[1] && "?" === e2[2] && "string" == typeof e2[3] && /^[a-z]:$/i.test(e2[3]) ? 3 : o2 ? 0 : void 0;
        if ("number" == typeof a2 && "number" == typeof c2) {
          const [n4, s4] = [t2[a2], e2[c2]];
          n4.toLowerCase() === s4.toLowerCase() && (e2[c2] = n4, i2 = c2, r2 = a2);
        }
      }
      const { optimizationLevel: s2 = 1 } = this.options;
      return s2 >= 2 && (t2 = this.levelTwoFileOptimize(t2)), e2.includes(Wt) ? this.#A(t2, e2, n2, r2, i2) : this.#S(t2, e2, n2, r2, i2);
    }
    #A(t2, e2, n2, r2, i2) {
      const s2 = e2.indexOf(Wt, i2), o2 = e2.lastIndexOf(Wt), [a2, c2, l2] = n2 ? [e2.slice(i2, s2), e2.slice(s2 + 1), []] : [e2.slice(i2, s2), e2.slice(s2 + 1, o2), e2.slice(o2 + 1)];
      if (a2.length) {
        const e3 = t2.slice(r2, r2 + a2.length);
        if (!this.#S(e3, a2, n2, 0, 0)) return false;
        r2 += a2.length;
      }
      let h2 = 0;
      if (l2.length) {
        if (l2.length + r2 > t2.length) return false;
        let e3 = t2.length - l2.length;
        if (this.#S(t2, l2, n2, e3, 0)) h2 = l2.length;
        else {
          if ("" !== t2[t2.length - 1] || r2 + l2.length === t2.length) return false;
          if (e3--, !this.#S(t2, l2, n2, e3, 0)) return false;
          h2 = l2.length + 1;
        }
      }
      if (!c2.length) {
        let e3 = !!h2;
        for (let n3 = r2; n3 < t2.length - h2; n3++) {
          const r3 = String(t2[n3]);
          if (e3 = true, "." === r3 || ".." === r3 || !this.options.dot && r3.startsWith(".")) return false;
        }
        return n2 || e3;
      }
      const u2 = [[[], 0]];
      let p2 = u2[0], f2 = 0;
      const d2 = [0];
      for (const t3 of c2) t3 === Wt ? (d2.push(f2), p2 = [[], 0], u2.push(p2)) : (p2[0].push(t3), f2++);
      let g2 = u2.length - 1;
      const m2 = t2.length - h2;
      for (const t3 of u2) t3[1] = m2 - (d2[g2--] + t3[0].length);
      return !!this.#T(t2, u2, r2, 0, n2, 0, !!h2);
    }
    #T(t2, e2, n2, r2, i2, s2, o2) {
      const a2 = e2[r2];
      if (!a2) {
        for (let e3 = n2; e3 < t2.length; e3++) {
          o2 = true;
          const n3 = t2[e3];
          if ("." === n3 || ".." === n3 || !this.options.dot && n3.startsWith(".")) return false;
        }
        return o2;
      }
      const [c2, l2] = a2;
      for (; n2 <= l2; ) {
        if (this.#S(t2.slice(0, n2 + c2.length), c2, i2, n2, 0) && s2 < this.maxGlobstarRecursion) {
          const a4 = this.#T(t2, e2, n2 + c2.length, r2 + 1, i2, s2 + 1, o2);
          if (false !== a4) return a4;
        }
        const a3 = t2[n2];
        if ("." === a3 || ".." === a3 || !this.options.dot && a3.startsWith(".")) return false;
        n2++;
      }
      return i2 || null;
    }
    #S(t2, e2, n2, r2, i2) {
      let s2, o2, a2, c2;
      for (s2 = r2, o2 = i2, c2 = t2.length, a2 = e2.length; s2 < c2 && o2 < a2; s2++, o2++) {
        this.debug("matchOne loop");
        let n3, r3 = e2[o2], i3 = t2[s2];
        if (this.debug(e2, r3, i3), false === r3 || r3 === Wt) return false;
        if ("string" == typeof r3 ? (n3 = i3 === r3, this.debug("string match", r3, i3, n3)) : (n3 = r3.test(i3), this.debug("pattern match", r3, i3, n3)), !n3) return false;
      }
      if (s2 === c2 && o2 === a2) return true;
      if (s2 === c2) return n2;
      if (o2 === a2) return s2 === c2 - 1 && "" === t2[s2];
      throw new Error("wtf?");
    }
    braceExpand() {
      return Gt(this.pattern, this.options);
    }
    parse(t2) {
      K(t2);
      const e2 = this.options;
      if ("**" === t2) return Wt;
      if ("" === t2) return "";
      let n2, r2 = null;
      (n2 = t2.match(_t)) ? r2 = e2.dot ? kt : It : (n2 = t2.match(Et)) ? r2 = (e2.nocase ? e2.dot ? Tt : St : e2.dot ? At : Nt)(n2[1]) : (n2 = t2.match(Rt)) ? r2 = (e2.nocase ? e2.dot ? Mt : Lt : e2.dot ? Dt : Ut)(n2) : (n2 = t2.match(Pt)) ? r2 = e2.dot ? jt : Ot : (n2 = t2.match($t)) && (r2 = Ct);
      const i2 = vt.fromGlob(t2, this.options).toMMPattern();
      return r2 && "object" == typeof i2 && Reflect.defineProperty(i2, "test", { value: r2 }), i2;
    }
    makeRe() {
      if (this.regexp || false === this.regexp) return this.regexp;
      const t2 = this.set;
      if (!t2.length) return this.regexp = false, this.regexp;
      const e2 = this.options, n2 = e2.noglobstar ? "[^/]*?" : e2.dot ? "(?:(?!(?:\\/|^)(?:\\.{1,2})($|\\/)).)*?" : "(?:(?!(?:\\/|^)\\.).)*?", r2 = new Set(e2.nocase ? ["i"] : []);
      let i2 = t2.map(((t3) => {
        const e3 = t3.map(((t4) => {
          if (t4 instanceof RegExp) for (const e4 of t4.flags.split("")) r2.add(e4);
          return "string" == typeof t4 ? t4.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&") : t4 === Wt ? Wt : t4._src;
        }));
        return e3.forEach(((t4, r3) => {
          const i3 = e3[r3 + 1], s3 = e3[r3 - 1];
          t4 === Wt && s3 !== Wt && (void 0 === s3 ? void 0 !== i3 && i3 !== Wt ? e3[r3 + 1] = "(?:\\/|" + n2 + "\\/)?" + i3 : e3[r3] = n2 : void 0 === i3 ? e3[r3 - 1] = s3 + "(?:\\/|" + n2 + ")?" : i3 !== Wt && (e3[r3 - 1] = s3 + "(?:\\/|\\/" + n2 + "\\/)" + i3, e3[r3 + 1] = Wt));
        })), e3.filter(((t4) => t4 !== Wt)).join("/");
      })).join("|");
      const [s2, o2] = t2.length > 1 ? ["(?:", ")"] : ["", ""];
      i2 = "^" + s2 + i2 + o2 + "$", this.negate && (i2 = "^(?!" + i2 + ").+$");
      try {
        this.regexp = new RegExp(i2, [...r2].join(""));
      } catch (t3) {
        this.regexp = false;
      }
      return this.regexp;
    }
    slashSplit(t2) {
      return this.preserveMultipleSlashes ? t2.split("/") : this.isWindows && /^\/\/[^\/]+/.test(t2) ? ["", ...t2.split(/\/+/)] : t2.split(/\/+/);
    }
    match(t2, e2 = this.partial) {
      if (this.debug("match", t2, this.pattern), this.comment) return false;
      if (this.empty) return "" === t2;
      if ("/" === t2 && e2) return true;
      const n2 = this.options;
      this.isWindows && (t2 = t2.split("\\").join("/"));
      const r2 = this.slashSplit(t2);
      this.debug(this.pattern, "split", r2);
      const i2 = this.set;
      this.debug(this.pattern, "set", i2);
      let s2 = r2[r2.length - 1];
      if (!s2) for (let t3 = r2.length - 2; !s2 && t3 >= 0; t3--) s2 = r2[t3];
      for (let t3 = 0; t3 < i2.length; t3++) {
        const o2 = i2[t3];
        let a2 = r2;
        if (n2.matchBase && 1 === o2.length && (a2 = [s2]), this.matchOne(a2, o2, e2)) return !!n2.flipNegate || !this.negate;
      }
      return !n2.flipNegate && this.negate;
    }
    static defaults(t2) {
      return wt.defaults(t2).Minimatch;
    }
  };
  function Xt(t2, e2 = "") {
    const n2 = new Error(`${e2}Invalid response: ${t2.status} ${t2.statusText}`);
    return n2.status = t2.status, n2.response = t2, n2;
  }
  function Yt(t2, e2) {
    const { status: n2 } = e2;
    if (401 === n2 && t2.digest) return e2;
    if (n2 >= 400) throw Xt(e2);
    return e2;
  }
  function Zt(t2, e2, n2 = false) {
    return n2 ? { data: e2, headers: t2.headers ? U(t2.headers) : {}, status: t2.status, statusText: t2.statusText } : e2;
  }
  wt.AST = vt, wt.Minimatch = Ht, wt.escape = (t2, { windowsPathsNoEscape: e2 = false } = {}) => e2 ? t2.replace(/[?*()[\]]/g, "[$&]") : t2.replace(/[?*()[\]\\]/g, "\\$&"), wt.unescape = it;
  var Qt = (Jt = function(t2, e2, n2, r2 = {}) {
    const i2 = Z({ url: m(t2.remoteURL, p(e2)), method: "COPY", headers: { Destination: m(t2.remoteURL, p(n2)), Overwrite: false === r2.overwrite ? "F" : "T", Depth: r2.shallow ? "0" : "infinity" } }, t2, r2);
    return o2 = function(e3) {
      Yt(t2, e3);
    }, (s2 = Y(i2, t2)) && s2.then || (s2 = Promise.resolve(s2)), o2 ? s2.then(o2) : s2;
    var s2, o2;
  }, function() {
    for (var t2 = [], e2 = 0; e2 < arguments.length; e2++) t2[e2] = arguments[e2];
    try {
      return Promise.resolve(Jt.apply(this, t2));
    } catch (t3) {
      return Promise.reject(t3);
    }
  });
  var Jt;
  var Kt = ":A-Za-z_\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD";
  var te = new RegExp("^[" + Kt + "][" + Kt + "\\-.\\d\\u00B7\\u0300-\\u036F\\u203F-\\u2040]*$");
  var ee = function(t2) {
    return !(null == te.exec(t2));
  };
  var ne = ["hasOwnProperty", "toString", "valueOf", "__defineGetter__", "__defineSetter__", "__lookupGetter__", "__lookupSetter__"];
  var re = ["__proto__", "constructor", "prototype"];
  var ie = (t2) => ne.includes(t2) ? "__" + t2 : t2;
  var se = { preserveOrder: false, attributeNamePrefix: "@_", attributesGroupName: false, textNodeName: "#text", ignoreAttributes: true, removeNSPrefix: false, allowBooleanAttributes: false, parseTagValue: true, parseAttributeValue: false, trimValues: true, cdataPropName: false, numberParseOptions: { hex: true, leadingZeros: true, eNotation: true, unicode: false }, tagValueProcessor: function(t2, e2) {
    return e2;
  }, attributeValueProcessor: function(t2, e2) {
    return e2;
  }, stopNodes: [], alwaysCreateTextNode: false, isArray: () => false, commentPropName: false, unpairedTags: [], processEntities: true, htmlEntities: false, entityDecoder: null, ignoreDeclaration: false, ignorePiTags: false, transformTagName: false, transformAttributeName: false, updateTag: function(t2, e2, n2) {
    return t2;
  }, captureMetaData: false, maxNestedTags: 100, strictReservedNames: true, jPath: true, onDangerousProperty: ie };
  function oe(t2, e2) {
    if ("string" != typeof t2) return;
    const n2 = t2.toLowerCase();
    if (ne.some(((t3) => n2 === t3.toLowerCase()))) throw new Error(`[SECURITY] Invalid ${e2}: "${t2}" is a reserved JavaScript keyword that could cause prototype pollution`);
    if (re.some(((t3) => n2 === t3.toLowerCase()))) throw new Error(`[SECURITY] Invalid ${e2}: "${t2}" is a reserved JavaScript keyword that could cause prototype pollution`);
  }
  function ae(t2, e2) {
    return "boolean" == typeof t2 ? { enabled: t2, maxEntitySize: 1e4, maxExpansionDepth: 1e4, maxTotalExpansions: 1 / 0, maxExpandedLength: 1e5, maxEntityCount: 1e3, allowedTags: null, tagFilter: null, appliesTo: "all" } : "object" == typeof t2 && null !== t2 ? { enabled: false !== t2.enabled, maxEntitySize: Math.max(1, t2.maxEntitySize ?? 1e4), maxExpansionDepth: Math.max(1, t2.maxExpansionDepth ?? 1e4), maxTotalExpansions: Math.max(1, t2.maxTotalExpansions ?? 1 / 0), maxExpandedLength: Math.max(1, t2.maxExpandedLength ?? 1e5), maxEntityCount: Math.max(1, t2.maxEntityCount ?? 1e3), allowedTags: t2.allowedTags ?? null, tagFilter: t2.tagFilter ?? null, appliesTo: t2.appliesTo ?? "all" } : ae(true);
  }
  var ce = function(t2) {
    const e2 = Object.assign({}, se, t2), n2 = [{ value: e2.attributeNamePrefix, name: "attributeNamePrefix" }, { value: e2.attributesGroupName, name: "attributesGroupName" }, { value: e2.textNodeName, name: "textNodeName" }, { value: e2.cdataPropName, name: "cdataPropName" }, { value: e2.commentPropName, name: "commentPropName" }];
    for (const { value: t3, name: e3 } of n2) t3 && oe(t3, e3);
    return null === e2.onDangerousProperty && (e2.onDangerousProperty = ie), e2.processEntities = ae(e2.processEntities, e2.htmlEntities), e2.unpairedTagsSet = new Set(e2.unpairedTags), e2.stopNodes && Array.isArray(e2.stopNodes) && (e2.stopNodes = e2.stopNodes.map(((t3) => "string" == typeof t3 && t3.startsWith("*.") ? ".." + t3.substring(2) : t3))), e2;
  };
  var le;
  le = "function" != typeof Symbol ? "@@xmlMetadata" : Symbol("XML Node Metadata");
  var he = class {
    constructor(t2) {
      this.tagname = t2, this.child = [], this[":@"] = /* @__PURE__ */ Object.create(null);
    }
    add(t2, e2) {
      "__proto__" === t2 && (t2 = "#__proto__"), this.child.push({ [t2]: e2 });
    }
    addChild(t2, e2) {
      "__proto__" === t2.tagname && (t2.tagname = "#__proto__"), t2[":@"] && Object.keys(t2[":@"]).length > 0 ? this.child.push({ [t2.tagname]: t2.child, ":@": t2[":@"] }) : this.child.push({ [t2.tagname]: t2.child }), this.addStartIndex(e2);
    }
    addStartIndex(t2) {
      void 0 !== t2 && (this.child[this.child.length - 1][le] = { startIndex: t2 });
    }
    addEndIndex(t2) {
      const e2 = this.child[this.child.length - 1];
      void 0 !== e2 && void 0 !== e2[le] && void 0 === e2[le].endIndex && (e2[le].endIndex = t2);
    }
    static getMetaDataSymbol() {
      return le;
    }
  };
  var ue = ":A-Za-z_\xC0-\xD6\xD8-\xF6\xF8-\u02FF\u0370-\u037D\u037F-\u0486\u0488-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD";
  var pe = ":A-Za-z_\xC0-\u02FF\u0370-\u037D\u037F-\u0486\u0488-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\u{10000}-\u{EFFFF}";
  var fe = pe + "\\-\\.\\d\xB7\u0300-\u036F\u0487\u203F-\u2040";
  var de = (t2, e2, n2 = "") => {
    const r2 = `[${t2.replace(":", "")}][${e2.replace(":", "")}]*`;
    return { name: new RegExp(`^[${t2}][${e2}]*$`, n2), ncName: new RegExp(`^${r2}$`, n2), qName: new RegExp(`^${r2}(?::${r2})?$`, n2), nmToken: new RegExp(`^[${e2}]+$`, n2), nmTokens: new RegExp(`^[${e2}]+(?:\\s+[${e2}]+)*$`, n2) };
  };
  var ge = de(ue, ue + "\\-\\.\\d\xB7\u0300-\u036F\u203F-\u2040");
  var me = de(pe, fe, "u");
  var ye = ":A-Za-z_";
  var be = de(ye, ye + "\\-\\.\\d");
  var xe = (t2 = "1.0", e2 = false) => e2 ? be : "1.1" === t2 ? me : ge;
  var ve = (t2, { xmlVersion: e2 = "1.0", asciiOnly: n2 = false } = {}) => xe(e2, n2).qName.test(t2);
  var we = ["name", "ncName", "qName", "nmToken", "nmTokens"];
  var Ee = (t2, { xmlVersion: e2 = "1.0", asciiOnly: n2 = false, maxCacheSize: r2 = 2048 } = {}) => {
    if (!we.includes(t2)) throw new TypeError(`Unknown production "${t2}". Must be one of: ${we.join(", ")}`);
    const i2 = xe(e2, n2)[t2];
    let s2 = /* @__PURE__ */ new Map();
    const o2 = (t3) => {
      const e3 = s2.get(t3);
      if (void 0 !== e3) return e3;
      const n3 = i2.test(t3);
      return s2.size < r2 && s2.set(t3, n3), n3;
    };
    return o2.reset = () => {
      s2 = /* @__PURE__ */ new Map();
    }, o2;
  };
  var Ne = class {
    constructor(t2, e2) {
      this.suppressValidationErr = !t2, this.options = t2, this.xmlVersion = e2 || 1;
    }
    setXmlVersion(t2 = 1) {
      this.xmlVersion = t2;
    }
    readDocType(t2, e2) {
      const n2 = /* @__PURE__ */ Object.create(null);
      let r2 = 0;
      if ("O" !== t2[e2 + 3] || "C" !== t2[e2 + 4] || "T" !== t2[e2 + 5] || "Y" !== t2[e2 + 6] || "P" !== t2[e2 + 7] || "E" !== t2[e2 + 8]) throw new Error("Invalid Tag instead of DOCTYPE");
      {
        e2 += 9;
        let i2 = 1, s2 = false, o2 = false, a2 = null, c2 = "";
        for (; e2 < t2.length; e2++) if (null === a2) if (s2 || o2 || '"' !== t2[e2] && "'" !== t2[e2]) if ("<" !== t2[e2] || o2) if (">" === t2[e2]) {
          if (o2 ? "-" === t2[e2 - 1] && "-" === t2[e2 - 2] && (o2 = false, i2--) : i2--, 0 === i2) break;
        } else "[" === t2[e2] ? s2 = true : c2 += t2[e2];
        else {
          if (s2 && Se(t2, "!ENTITY", e2)) {
            let i3, s3;
            if (e2 += 7, [i3, s3, e2] = this.readEntityExp(t2, e2 + 1, this.suppressValidationErr), -1 === s3.indexOf("&")) {
              if (false !== this.options.enabled && null != this.options.maxEntityCount && r2 >= this.options.maxEntityCount) throw new Error(`Entity count (${r2 + 1}) exceeds maximum allowed (${this.options.maxEntityCount})`);
              n2[i3] = s3, r2++;
            }
          } else if (s2 && Se(t2, "!ELEMENT", e2)) {
            e2 += 8;
            const { index: n3 } = this.readElementExp(t2, e2 + 1);
            e2 = n3;
          } else if (s2 && Se(t2, "!ATTLIST", e2)) e2 += 8;
          else if (s2 && Se(t2, "!NOTATION", e2)) {
            e2 += 9;
            const { index: n3 } = this.readNotationExp(t2, e2 + 1, this.suppressValidationErr);
            e2 = n3;
          } else {
            if (!Se(t2, "!--", e2)) throw new Error("Invalid DOCTYPE");
            o2 = true;
          }
          i2++, c2 = "";
        }
        else a2 = t2[e2], c2 += t2[e2];
        else t2[e2] === a2 && (a2 = null), c2 += t2[e2];
        if (null !== a2 || 0 !== i2) throw new Error("Unclosed DOCTYPE");
      }
      return { entities: n2, i: e2 };
    }
    readEntityExp(t2, e2) {
      const n2 = e2 = Ae(t2, e2);
      for (; e2 < t2.length && !/\s/.test(t2[e2]) && '"' !== t2[e2] && "'" !== t2[e2]; ) e2++;
      let r2 = t2.substring(n2, e2);
      if (Te(r2, { xmlVersion: this.xmlVersion }), e2 = Ae(t2, e2), !this.suppressValidationErr) {
        if ("SYSTEM" === t2.substring(e2, e2 + 6).toUpperCase()) throw new Error("External entities are not supported");
        if ("%" === t2[e2]) throw new Error("Parameter entities are not supported");
      }
      let i2 = "";
      if ([e2, i2] = this.readIdentifierVal(t2, e2, "entity"), false !== this.options.enabled && null != this.options.maxEntitySize && i2.length > this.options.maxEntitySize) throw new Error(`Entity "${r2}" size (${i2.length}) exceeds maximum allowed size (${this.options.maxEntitySize})`);
      return [r2, i2, --e2];
    }
    readNotationExp(t2, e2) {
      const n2 = e2 = Ae(t2, e2);
      for (; e2 < t2.length && !/\s/.test(t2[e2]); ) e2++;
      let r2 = t2.substring(n2, e2);
      !this.suppressValidationErr && Te(r2, { xmlVersion: this.xmlVersion }), e2 = Ae(t2, e2);
      const i2 = t2.substring(e2, e2 + 6).toUpperCase();
      if (!this.suppressValidationErr && "SYSTEM" !== i2 && "PUBLIC" !== i2) throw new Error(`Expected SYSTEM or PUBLIC, found "${i2}"`);
      e2 += i2.length, e2 = Ae(t2, e2);
      let s2 = null, o2 = null;
      if ("PUBLIC" === i2) [e2, s2] = this.readIdentifierVal(t2, e2, "publicIdentifier"), '"' !== t2[e2 = Ae(t2, e2)] && "'" !== t2[e2] || ([e2, o2] = this.readIdentifierVal(t2, e2, "systemIdentifier"));
      else if ("SYSTEM" === i2 && ([e2, o2] = this.readIdentifierVal(t2, e2, "systemIdentifier"), !this.suppressValidationErr && !o2)) throw new Error("Missing mandatory system identifier for SYSTEM notation");
      return { notationName: r2, publicIdentifier: s2, systemIdentifier: o2, index: --e2 };
    }
    readIdentifierVal(t2, e2, n2) {
      let r2 = "";
      const i2 = t2[e2];
      if ('"' !== i2 && "'" !== i2) throw new Error(`Expected quoted string, found "${i2}"`);
      const s2 = ++e2;
      for (; e2 < t2.length && t2[e2] !== i2; ) e2++;
      if (r2 = t2.substring(s2, e2), t2[e2] !== i2) throw new Error(`Unterminated ${n2} value`);
      return [++e2, r2];
    }
    readElementExp(t2, e2) {
      const n2 = e2 = Ae(t2, e2);
      for (; e2 < t2.length && !/\s/.test(t2[e2]); ) e2++;
      let r2 = t2.substring(n2, e2);
      if (!this.suppressValidationErr && !ve(r2, { xmlVersion: this.xmlVersion })) throw new Error(`Invalid element name: "${r2}"`);
      let i2 = "";
      if ("E" === t2[e2 = Ae(t2, e2)] && Se(t2, "MPTY", e2)) e2 += 4;
      else if ("A" === t2[e2] && Se(t2, "NY", e2)) e2 += 2;
      else if ("(" === t2[e2]) {
        const n3 = ++e2;
        for (; e2 < t2.length && ")" !== t2[e2]; ) e2++;
        if (i2 = t2.substring(n3, e2), ")" !== t2[e2]) throw new Error("Unterminated content model");
      } else if (!this.suppressValidationErr) throw new Error(`Invalid Element Expression, found "${t2[e2]}"`);
      return { elementName: r2, contentModel: i2.trim(), index: e2 };
    }
    readAttlistExp(t2, e2) {
      let n2 = e2 = Ae(t2, e2);
      for (; e2 < t2.length && !/\s/.test(t2[e2]); ) e2++;
      let r2 = t2.substring(n2, e2);
      for (Te(r2, { xmlVersion: this.xmlVersion }), n2 = e2 = Ae(t2, e2); e2 < t2.length && !/\s/.test(t2[e2]); ) e2++;
      let i2 = t2.substring(n2, e2);
      if (!Te(i2, { xmlVersion: this.xmlVersion })) throw new Error(`Invalid attribute name: "${i2}"`);
      e2 = Ae(t2, e2);
      let s2 = "";
      if ("NOTATION" === t2.substring(e2, e2 + 8).toUpperCase()) {
        if (s2 = "NOTATION", "(" !== t2[e2 = Ae(t2, e2 += 8)]) throw new Error(`Expected '(', found "${t2[e2]}"`);
        e2++;
        let n3 = [];
        for (; e2 < t2.length && ")" !== t2[e2]; ) {
          const r3 = e2;
          for (; e2 < t2.length && "|" !== t2[e2] && ")" !== t2[e2]; ) e2++;
          let i3 = t2.substring(r3, e2);
          if (i3 = i3.trim(), !Te(i3, { xmlVersion: this.xmlVersion })) throw new Error(`Invalid notation name: "${i3}"`);
          n3.push(i3), "|" === t2[e2] && (e2++, e2 = Ae(t2, e2));
        }
        if (")" !== t2[e2]) throw new Error("Unterminated list of notations");
        e2++, s2 += " (" + n3.join("|") + ")";
      } else {
        const n3 = e2;
        for (; e2 < t2.length && !/\s/.test(t2[e2]); ) e2++;
        s2 += t2.substring(n3, e2);
        const r3 = ["CDATA", "ID", "IDREF", "IDREFS", "ENTITY", "ENTITIES", "NMTOKEN", "NMTOKENS"];
        if (!this.suppressValidationErr && !r3.includes(s2.toUpperCase())) throw new Error(`Invalid attribute type: "${s2}"`);
      }
      e2 = Ae(t2, e2);
      let o2 = "";
      return "#REQUIRED" === t2.substring(e2, e2 + 8).toUpperCase() ? (o2 = "#REQUIRED", e2 += 8) : "#IMPLIED" === t2.substring(e2, e2 + 7).toUpperCase() ? (o2 = "#IMPLIED", e2 += 7) : [e2, o2] = this.readIdentifierVal(t2, e2, "ATTLIST"), { elementName: r2, attributeName: i2, attributeType: s2, defaultValue: o2, index: e2 };
    }
  };
  var Ae = (t2, e2) => {
    for (; e2 < t2.length && /\s/.test(t2[e2]); ) e2++;
    return e2;
  };
  function Se(t2, e2, n2) {
    for (let r2 = 0; r2 < e2.length; r2++) if (e2[r2] !== t2[n2 + r2 + 1]) return false;
    return true;
  }
  function Te(t2, e2) {
    if (ve(t2, { xmlVersion: e2 })) return t2;
    throw new Error(`Invalid entity name ${t2}`);
  }
  var Pe = [48, 1632, 1776, 2406, 2534, 2662, 2790, 2918, 3046, 3174, 3302, 3430, 3558, 3664, 3792, 3872, 4160, 4240, 6112, 6160, 6470, 6608, 6784, 6800, 6992, 7088, 7232, 7248, 65296, 120782, 120792, 120802, 120812, 120822, 66720, 68912, 69734, 69872, 69942, 70096, 70384, 70736, 70864, 71248, 71360, 71472, 71904, 72016, 72688, 72784, 73040, 73120, 73552, 92768, 92864, 93008, 123200, 123632, 124144, 125264, 130032];
  var Oe = /* @__PURE__ */ new Map();
  var je = 1632;
  var $e = new Uint8Array(63904).fill(255);
  for (const t2 of Pe) for (let e2 = 0; e2 < 10; e2++) {
    const n2 = t2 + e2;
    n2 <= 65535 ? $e[n2 - je] = e2 : Oe.set(n2, e2);
  }
  var Ce = /* @__PURE__ */ new Set([8722, 65293, 65123]);
  var _e = /^[-+]?0x[a-fA-F0-9]+$/;
  var Ie = /^0b[01]+$/;
  var ke = /^0o[0-7]+$/;
  var Re = /^([\-\+])?(0*)([0-9]*(\.[0-9]*)?)$/;
  var Le = { hex: true, binary: false, octal: false, leadingZeros: true, decimalPoint: ".", eNotation: true, infinity: "original", unicode: false };
  function Me(t2, e2 = {}) {
    if (e2 = Object.assign({}, Le, e2), !t2 || "string" != typeof t2) return t2;
    let n2 = t2.trim();
    if (0 === n2.length) return t2;
    if (void 0 !== e2.skipLike && e2.skipLike.test(n2)) return t2;
    if ("0" === n2) return 0;
    if (e2.unicode && (n2 = (function(t3) {
      if ("string" != typeof t3) return t3;
      const e3 = t3.length;
      if (0 === e3) return t3;
      let n3 = -1;
      for (let r3 = 0; r3 < e3; r3++) {
        const i2 = t3.charCodeAt(r3);
        if (!(i2 >= 48 && i2 <= 57 || 45 === i2)) {
          if (i2 < je) {
            if (Ce.has(i2)) {
              n3 = r3;
              break;
            }
          } else if (i2 >= 55296 && i2 <= 56319) {
            if (r3 + 1 < e3) {
              const e4 = t3.charCodeAt(r3 + 1);
              if (e4 >= 56320 && e4 <= 57343) {
                const t4 = 65536 + (i2 - 55296 << 10) + (e4 - 56320);
                if (Oe.has(t4)) {
                  n3 = r3;
                  break;
                }
              }
            }
          } else if (255 !== $e[i2 - je] || Ce.has(i2)) {
            n3 = r3;
            break;
          }
        }
      }
      if (-1 === n3) return t3;
      const r2 = [];
      n3 > 0 && r2.push(t3.slice(0, n3));
      for (let i2 = n3; i2 < e3; i2++) {
        const n4 = t3.charCodeAt(i2);
        if (n4 >= 48 && n4 <= 57 || 45 === n4) {
          r2.push(t3[i2]);
          continue;
        }
        if (n4 < je) {
          r2.push(Ce.has(n4) ? "-" : t3[i2]);
          continue;
        }
        if (n4 >= 55296 && n4 <= 56319) {
          if (i2 + 1 < e3) {
            const e4 = t3.charCodeAt(i2 + 1);
            if (e4 >= 56320 && e4 <= 57343) {
              const t4 = 65536 + (n4 - 55296 << 10) + (e4 - 56320), s3 = Oe.get(t4);
              if (void 0 !== s3) {
                r2.push(String.fromCharCode(s3 + 48)), i2++;
                continue;
              }
            }
          }
          r2.push(t3[i2]);
          continue;
        }
        if (Ce.has(n4)) {
          r2.push("-");
          continue;
        }
        const s2 = $e[n4 - je];
        r2.push(255 !== s2 ? String.fromCharCode(s2 + 48) : t3[i2]);
      }
      return r2.join("");
    })(n2), "0" === n2)) return 0;
    if (e2.hex && _e.test(n2)) return Ue(n2, 16);
    if (e2.binary && Ie.test(n2)) return Ue(n2, 2);
    if (e2.octal && ke.test(n2)) return Ue(n2, 8);
    if (isFinite(n2)) {
      if (n2.includes("e") || n2.includes("E")) return (function(t3, e3, n3) {
        if (!n3.eNotation) return t3;
        const r2 = e3.match(De);
        if (r2) {
          let i2 = r2[1] || "";
          const s2 = -1 === r2[3].indexOf("e") ? "E" : "e", o2 = r2[2], a2 = i2 ? t3[o2.length + 1] === s2 : t3[o2.length] === s2;
          return o2.length > 1 && a2 ? t3 : (1 !== o2.length || !r2[3].startsWith(`.${s2}`) && r2[3][0] !== s2) && o2.length > 0 ? n3.leadingZeros && !a2 ? (e3 = (r2[1] || "") + r2[3], Number(e3)) : t3 : Number(e3);
        }
        return t3;
      })(t2, n2, e2);
      {
        const r2 = Re.exec(n2);
        if (r2) {
          const i2 = r2[1] || "", s2 = r2[2];
          let o2 = (function(t3) {
            if (t3 && -1 !== t3.indexOf(".")) {
              let e3 = t3.length;
              for (; e3 > 0 && 48 === t3.charCodeAt(e3 - 1); ) e3--;
              return "." === (t3 = t3.slice(0, e3)) ? t3 = "0" : "." === t3[0] ? t3 = "0" + t3 : "." === t3[t3.length - 1] && (t3 = t3.substring(0, t3.length - 1)), t3;
            }
            return t3;
          })(r2[3]);
          const a2 = i2 ? "." === t2[s2.length + 1] : "." === t2[s2.length];
          if (!e2.leadingZeros && (s2.length > 1 || 1 === s2.length && !a2)) return t2;
          {
            const r3 = Number(n2), a3 = String(r3);
            if (0 === r3) return r3;
            if (-1 !== a3.search(/[eE]/)) return e2.eNotation ? r3 : t2;
            if (-1 !== n2.indexOf(".")) return "0" === a3 || a3 === o2 || a3 === `${i2}${o2}` ? r3 : t2;
            let c2 = s2 ? o2 : n2;
            return s2 ? c2 === a3 || i2 + c2 === a3 ? r3 : t2 : c2 === a3 || c2 === i2 + a3 ? r3 : t2;
          }
        }
        return t2;
      }
    }
    return (function(t3, e3, n3) {
      const r2 = e3 === 1 / 0;
      switch (n3.infinity.toLowerCase()) {
        case "null":
          return null;
        case "infinity":
          return e3;
        case "string":
          return r2 ? "Infinity" : "-Infinity";
        default:
          return t3;
      }
    })(t2, Number(n2), e2);
  }
  var De = /^([-+])?(0*)(\d*(\.\d*)?[eE][-\+]?\d+)$/;
  function Ue(t2, e2) {
    const n2 = t2.trim();
    if (2 !== e2 && 8 !== e2 || (t2 = n2.substring(2)), parseInt) return parseInt(t2, e2);
    if (Number.parseInt) return Number.parseInt(t2, e2);
    if (window && window.parseInt) return window.parseInt(t2, e2);
    throw new Error("parseInt, Number.parseInt, window.parseInt are not supported");
  }
  var Ve = class {
    constructor(t2) {
      this._matcher = t2;
    }
    get separator() {
      return this._matcher.separator;
    }
    getCurrentTag() {
      const t2 = this._matcher.path;
      return t2.length > 0 ? t2[t2.length - 1].tag : void 0;
    }
    getCurrentNamespace() {
      const t2 = this._matcher.path;
      return t2.length > 0 ? t2[t2.length - 1].namespace : void 0;
    }
    getAttrValue(t2) {
      const e2 = this._matcher.path;
      if (0 !== e2.length) return e2[e2.length - 1].values?.[t2];
    }
    hasAttr(t2) {
      const e2 = this._matcher.path;
      if (0 === e2.length) return false;
      const n2 = e2[e2.length - 1];
      return void 0 !== n2.values && t2 in n2.values;
    }
    getAnyParentAttr(t2) {
      return this._matcher.getAnyParentAttr(t2);
    }
    hasAnyParentAttr(t2) {
      return this._matcher.hasAnyParentAttr(t2);
    }
    getPosition() {
      const t2 = this._matcher.path;
      return 0 === t2.length ? -1 : t2[t2.length - 1].position ?? 0;
    }
    getCounter() {
      const t2 = this._matcher.path;
      return 0 === t2.length ? -1 : t2[t2.length - 1].counter ?? 0;
    }
    getIndex() {
      return this.getPosition();
    }
    getDepth() {
      return this._matcher.path.length;
    }
    toString(t2, e2 = true) {
      return this._matcher.toString(t2, e2);
    }
    toArray() {
      return this._matcher.path.map(((t2) => t2.tag));
    }
    matches(t2) {
      return this._matcher.matches(t2);
    }
    matchesAny(t2) {
      return t2.matchesAny(this._matcher);
    }
  };
  var qe = class {
    constructor(t2 = {}) {
      this.separator = t2.separator || ".", this.path = [], this.siblingStacks = [], this._pathStringCache = null, this._view = new Ve(this), this._keptAttrs = [];
    }
    push(t2, e2 = null, n2 = null, r2 = null) {
      this._pathStringCache = null, this.path.length > 0 && (this.path[this.path.length - 1].values = void 0);
      const i2 = this.path.length;
      let s2 = this.siblingStacks[i2];
      s2 || (s2 = { counts: /* @__PURE__ */ new Map(), total: 0 }, this.siblingStacks[i2] = s2);
      const o2 = n2 ? `${n2}:${t2}` : t2, a2 = s2.counts.get(o2) || 0, c2 = s2.total;
      s2.counts.set(o2, a2 + 1), s2.total++;
      const l2 = { tag: t2, position: c2, counter: a2 };
      null != n2 && (l2.namespace = n2), null != e2 && (l2.values = e2), this.path.push(l2);
      const h2 = this.path.length, u2 = null !== r2 ? r2.keep : null;
      if (null != u2 && u2.length > 0 && e2) for (let t3 = 0; t3 < u2.length; t3++) {
        const n3 = u2[t3];
        void 0 !== e2[n3] && this._keptAttrs.push({ depth: h2, name: n3, value: e2[n3] });
      }
    }
    pop() {
      if (0 === this.path.length) return;
      this._pathStringCache = null;
      const t2 = this.path.pop();
      this.siblingStacks.length > this.path.length + 1 && (this.siblingStacks.length = this.path.length + 1);
      const e2 = this.path.length + 1;
      for (; this._keptAttrs.length > 0 && this._keptAttrs[this._keptAttrs.length - 1].depth >= e2; ) this._keptAttrs.pop();
      return t2;
    }
    updateCurrent(t2) {
      if (this.path.length > 0) {
        const e2 = this.path[this.path.length - 1];
        null != t2 && (e2.values = t2);
      }
    }
    getCurrentTag() {
      return this.path.length > 0 ? this.path[this.path.length - 1].tag : void 0;
    }
    getCurrentNamespace() {
      return this.path.length > 0 ? this.path[this.path.length - 1].namespace : void 0;
    }
    getAttrValue(t2) {
      if (0 !== this.path.length) return this.path[this.path.length - 1].values?.[t2];
    }
    hasAttr(t2) {
      if (0 === this.path.length) return false;
      const e2 = this.path[this.path.length - 1];
      return void 0 !== e2.values && t2 in e2.values;
    }
    getAnyParentAttr(t2) {
      const e2 = this._keptAttrs;
      for (let n2 = e2.length - 1; n2 >= 0; n2--) if (e2[n2].name === t2) return e2[n2].value;
    }
    hasAnyParentAttr(t2) {
      const e2 = this._keptAttrs;
      for (let n2 = e2.length - 1; n2 >= 0; n2--) if (e2[n2].name === t2) return true;
      return false;
    }
    getPosition() {
      return 0 === this.path.length ? -1 : this.path[this.path.length - 1].position ?? 0;
    }
    getCounter() {
      return 0 === this.path.length ? -1 : this.path[this.path.length - 1].counter ?? 0;
    }
    getIndex() {
      return this.getPosition();
    }
    getDepth() {
      return this.path.length;
    }
    toString(t2, e2 = true) {
      const n2 = t2 || this.separator;
      if (n2 === this.separator && true === e2) {
        if (null !== this._pathStringCache) return this._pathStringCache;
        const t3 = this.path.map(((t4) => t4.namespace ? `${t4.namespace}:${t4.tag}` : t4.tag)).join(n2);
        return this._pathStringCache = t3, t3;
      }
      return this.path.map(((t3) => e2 && t3.namespace ? `${t3.namespace}:${t3.tag}` : t3.tag)).join(n2);
    }
    toArray() {
      return this.path.map(((t2) => t2.tag));
    }
    reset() {
      this._pathStringCache = null, this.path = [], this.siblingStacks = [], this._keptAttrs = [];
    }
    matches(t2) {
      const e2 = t2.segments;
      return 0 !== e2.length && (t2.hasDeepWildcard() ? this._matchWithDeepWildcard(e2) : this._matchSimple(e2));
    }
    _matchSimple(t2) {
      if (this.path.length !== t2.length) return false;
      for (let e2 = 0; e2 < t2.length; e2++) if (!this._matchSegment(t2[e2], this.path[e2], e2 === this.path.length - 1)) return false;
      return true;
    }
    _matchWithDeepWildcard(t2) {
      let e2 = this.path.length - 1, n2 = t2.length - 1;
      for (; n2 >= 0 && e2 >= 0; ) {
        const r2 = t2[n2];
        if ("deep-wildcard" === r2.type) {
          if (n2--, n2 < 0) return true;
          const r3 = t2[n2];
          let i2 = false;
          for (let t3 = e2; t3 >= 0; t3--) if (this._matchSegment(r3, this.path[t3], t3 === this.path.length - 1)) {
            e2 = t3 - 1, n2--, i2 = true;
            break;
          }
          if (!i2) return false;
        } else {
          if (!this._matchSegment(r2, this.path[e2], e2 === this.path.length - 1)) return false;
          e2--, n2--;
        }
      }
      return n2 < 0;
    }
    _matchSegment(t2, e2, n2) {
      if ("*" !== t2.tag && t2.tag !== e2.tag) return false;
      if (void 0 !== t2.namespace && "*" !== t2.namespace && t2.namespace !== e2.namespace) return false;
      if (void 0 !== t2.attrName) {
        if (!n2) return false;
        if (!e2.values || !(t2.attrName in e2.values)) return false;
        if (void 0 !== t2.attrValue && String(e2.values[t2.attrName]) !== String(t2.attrValue)) return false;
      }
      if (void 0 !== t2.position) {
        if (!n2) return false;
        const r2 = e2.counter ?? 0;
        if ("first" === t2.position && 0 !== r2) return false;
        if ("odd" === t2.position && r2 % 2 != 1) return false;
        if ("even" === t2.position && r2 % 2 != 0) return false;
        if ("nth" === t2.position && r2 !== t2.positionValue) return false;
      }
      return true;
    }
    matchesAny(t2) {
      return t2.matchesAny(this);
    }
    snapshot() {
      return { path: this.path.map(((t2) => ({ ...t2 }))), siblingStacks: this.siblingStacks.map(((t2) => t2 ? { counts: new Map(t2.counts), total: t2.total } : t2)), keptAttrs: this._keptAttrs.map(((t2) => ({ ...t2 }))) };
    }
    restore(t2) {
      this._pathStringCache = null, this.path = t2.path.map(((t3) => ({ ...t3 }))), this.siblingStacks = t2.siblingStacks.map(((t3) => t3 ? { counts: new Map(t3.counts), total: t3.total } : t3)), this._keptAttrs = (t2.keptAttrs || []).map(((t3) => ({ ...t3 })));
    }
    readOnly() {
      return this._view;
    }
  };
  var Fe = class {
    constructor(t2, e2 = {}, n2) {
      this.pattern = t2, this.separator = e2.separator || ".", this.segments = this._parse(t2), this.data = n2, this._hasDeepWildcard = this.segments.some(((t3) => "deep-wildcard" === t3.type)), this._hasAttributeCondition = this.segments.some(((t3) => void 0 !== t3.attrName)), this._hasPositionSelector = this.segments.some(((t3) => void 0 !== t3.position));
    }
    _parse(t2) {
      const e2 = [];
      let n2 = 0, r2 = "";
      for (; n2 < t2.length; ) t2[n2] === this.separator ? n2 + 1 < t2.length && t2[n2 + 1] === this.separator ? (r2.trim() && (e2.push(this._parseSegment(r2.trim())), r2 = ""), e2.push({ type: "deep-wildcard" }), n2 += 2) : (r2.trim() && e2.push(this._parseSegment(r2.trim())), r2 = "", n2++) : (r2 += t2[n2], n2++);
      return r2.trim() && e2.push(this._parseSegment(r2.trim())), e2;
    }
    _parseSegment(t2) {
      const e2 = { type: "tag" };
      let n2 = null, r2 = t2;
      const i2 = t2.match(/^([^\[]+)(\[[^\]]*\])(.*)$/);
      if (i2 && (r2 = i2[1] + i2[3], i2[2])) {
        const t3 = i2[2].slice(1, -1);
        t3 && (n2 = t3);
      }
      let s2, o2, a2 = r2;
      if (r2.includes("::")) {
        const e3 = r2.indexOf("::");
        if (s2 = r2.substring(0, e3).trim(), a2 = r2.substring(e3 + 2).trim(), !s2) throw new Error(`Invalid namespace in pattern: ${t2}`);
      }
      let c2 = null;
      if (a2.includes(":")) {
        const t3 = a2.lastIndexOf(":"), e3 = a2.substring(0, t3).trim(), n3 = a2.substring(t3 + 1).trim();
        ["first", "last", "odd", "even"].includes(n3) || /^nth\(\d+\)$/.test(n3) ? (o2 = e3, c2 = n3) : o2 = a2;
      } else o2 = a2;
      if (!o2) throw new Error(`Invalid segment pattern: ${t2}`);
      if (e2.tag = o2, s2 && (e2.namespace = s2), n2) if (n2.includes("=")) {
        const t3 = n2.indexOf("=");
        e2.attrName = n2.substring(0, t3).trim(), e2.attrValue = n2.substring(t3 + 1).trim();
      } else e2.attrName = n2.trim();
      if (c2) {
        const t3 = c2.match(/^nth\((\d+)\)$/);
        t3 ? (e2.position = "nth", e2.positionValue = parseInt(t3[1], 10)) : e2.position = c2;
      }
      return e2;
    }
    get length() {
      return this.segments.length;
    }
    hasDeepWildcard() {
      return this._hasDeepWildcard;
    }
    hasAttributeCondition() {
      return this._hasAttributeCondition;
    }
    hasPositionSelector() {
      return this._hasPositionSelector;
    }
    toString() {
      return this.pattern;
    }
  };
  var We = class {
    constructor() {
      this._byDepthAndTag = /* @__PURE__ */ new Map(), this._wildcardByDepth = /* @__PURE__ */ new Map(), this._deepWildcards = [], this._deepByTerminalTag = /* @__PURE__ */ new Map(), this._patterns = /* @__PURE__ */ new Set(), this._sealed = false;
    }
    add(t2) {
      if (this._sealed) throw new TypeError("ExpressionSet is sealed. Create a new ExpressionSet to add more expressions.");
      if (this._patterns.has(t2.pattern)) return this;
      if (this._patterns.add(t2.pattern), t2.hasDeepWildcard()) {
        const e3 = t2.segments[t2.segments.length - 1];
        if (e3 && "deep-wildcard" !== e3.type && "*" !== e3.tag) {
          const n3 = e3.tag;
          this._deepByTerminalTag.has(n3) || this._deepByTerminalTag.set(n3, []), this._deepByTerminalTag.get(n3).push(t2);
        } else this._deepWildcards.push(t2);
        return this;
      }
      const e2 = t2.length, n2 = t2.segments[t2.segments.length - 1], r2 = n2?.tag;
      if (r2 && "*" !== r2) {
        const n3 = `${e2}:${r2}`;
        this._byDepthAndTag.has(n3) || this._byDepthAndTag.set(n3, []), this._byDepthAndTag.get(n3).push(t2);
      } else this._wildcardByDepth.has(e2) || this._wildcardByDepth.set(e2, []), this._wildcardByDepth.get(e2).push(t2);
      return this;
    }
    addAll(t2) {
      for (const e2 of t2) this.add(e2);
      return this;
    }
    has(t2) {
      return this._patterns.has(t2.pattern);
    }
    get size() {
      return this._patterns.size;
    }
    seal() {
      return this._sealed = true, this;
    }
    get isSealed() {
      return this._sealed;
    }
    matchesAny(t2) {
      return null !== this.findMatch(t2);
    }
    findMatch(t2) {
      const e2 = t2.getDepth(), n2 = t2.getCurrentTag(), r2 = `${e2}:${n2}`, i2 = this._byDepthAndTag.get(r2);
      if (i2) {
        for (let e3 = 0; e3 < i2.length; e3++) if (t2.matches(i2[e3])) return i2[e3];
      }
      const s2 = this._wildcardByDepth.get(e2);
      if (s2) {
        for (let e3 = 0; e3 < s2.length; e3++) if (t2.matches(s2[e3])) return s2[e3];
      }
      const o2 = this._deepByTerminalTag.get(n2);
      if (o2) {
        for (let e3 = 0; e3 < o2.length; e3++) if (t2.matches(o2[e3])) return o2[e3];
      }
      for (let e3 = 0; e3 < this._deepWildcards.length; e3++) if (t2.matches(this._deepWildcards[e3])) return this._deepWildcards[e3];
      return null;
    }
  };
  var Be = { cent: "\xA2", pound: "\xA3", curren: "\xA4", yen: "\xA5", euro: "\u20AC", dollar: "$", fnof: "\u0192", inr: "\u20B9", af: "\u060B", birr: "\u1265\u122D", peso: "\u20B1", rub: "\u20BD", won: "\u20A9", yuan: "\xA5", cedil: "\xB8" };
  var Ge = { amp: "&", apos: "'", gt: ">", lt: "<", quot: '"' };
  var ze = { nbsp: "\xA0", copy: "\xA9", reg: "\xAE", trade: "\u2122", mdash: "\u2014", ndash: "\u2013", hellip: "\u2026", laquo: "\xAB", raquo: "\xBB", lsquo: "\u2018", rsquo: "\u2019", ldquo: "\u201C", rdquo: "\u201D", bull: "\u2022", para: "\xB6", sect: "\xA7", deg: "\xB0", frac12: "\xBD", frac14: "\xBC", frac34: "\xBE" };
  var He = Object.freeze({ ALLOW: "allow", BLOCK: "block", THROW: "throw" });
  var Xe = new Set("!?\\\\/[]$%{}^&*()<>|+");
  function Ye(t2) {
    if ("#" === t2[0]) throw new Error(`[EntityReplacer] Invalid character '#' in entity name: "${t2}"`);
    for (const e2 of t2) if (Xe.has(e2)) throw new Error(`[EntityReplacer] Invalid character '${e2}' in entity name: "${t2}"`);
    return t2;
  }
  function Ze(...t2) {
    const e2 = /* @__PURE__ */ Object.create(null);
    for (const n2 of t2) if (n2) for (const t3 of Object.keys(n2)) {
      const r2 = n2[t3];
      if ("string" == typeof r2) e2[t3] = r2;
      else if (r2 && "object" == typeof r2 && void 0 !== r2.val) {
        const n3 = r2.val;
        "string" == typeof n3 && (e2[t3] = n3);
      }
    }
    return e2;
  }
  var Qe = "external";
  var Je = "base";
  var Ke = "all";
  var tn = Object.freeze({ allow: 0, leave: 1, remove: 2, throw: 3 });
  var en = /* @__PURE__ */ new Set([9, 10, 13]);
  var nn = class {
    constructor(t2 = {}) {
      var e2;
      this._limit = t2.limit || {}, this._maxTotalExpansions = this._limit.maxTotalExpansions || 0, this._maxExpandedLength = this._limit.maxExpandedLength || 0, this._postCheck = "function" == typeof t2.postCheck ? t2.postCheck : (t3) => t3, this._limitTiers = (e2 = this._limit.applyLimitsTo ?? Qe) && e2 !== Qe ? e2 === Ke ? /* @__PURE__ */ new Set([Ke]) : e2 === Je ? /* @__PURE__ */ new Set([Je]) : Array.isArray(e2) ? new Set(e2) : /* @__PURE__ */ new Set([Qe]) : /* @__PURE__ */ new Set([Qe]), this._numericAllowed = t2.numericAllowed ?? true, this._baseMap = Ze(Ge, t2.namedEntities || null), this._externalMap = /* @__PURE__ */ Object.create(null), this._inputMap = /* @__PURE__ */ Object.create(null), this._totalExpansions = 0, this._expandedLength = 0, this._removeSet = new Set(t2.remove && Array.isArray(t2.remove) ? t2.remove : []), this._leaveSet = new Set(t2.leave && Array.isArray(t2.leave) ? t2.leave : []);
      const n2 = (function(t3) {
        if (!t3) return { xmlVersion: 1, onLevel: tn.allow, nullLevel: tn.remove };
        const e3 = 1.1 === t3.xmlVersion ? 1.1 : 1, n3 = tn[t3.onNCR] ?? tn.allow, r2 = tn[t3.nullNCR] ?? tn.remove;
        return { xmlVersion: e3, onLevel: n3, nullLevel: Math.max(r2, tn.remove) };
      })(t2.ncr);
      this._ncrXmlVersion = n2.xmlVersion, this._ncrOnLevel = n2.onLevel, this._ncrNullLevel = n2.nullLevel, this._onExternalEntity = "function" == typeof t2.onExternalEntity ? t2.onExternalEntity : null, this._onInputEntity = "function" == typeof t2.onInputEntity ? t2.onInputEntity : null;
    }
    _applyRegistrationHook(t2, e2, n2, r2) {
      if (!t2) return true;
      const i2 = t2(e2, n2);
      if (i2 === He.BLOCK) return false;
      if (i2 === He.THROW) throw new Error(`[EntityDecoder] Registration of ${r2} entity "&${e2};" was rejected by hook`);
      return true;
    }
    setExternalEntities(t2) {
      if (t2) for (const e3 of Object.keys(t2)) Ye(e3);
      if (!this._onExternalEntity) return void (this._externalMap = Ze(t2));
      const e2 = Ze(t2), n2 = /* @__PURE__ */ Object.create(null);
      for (const [t3, r2] of Object.entries(e2)) this._applyRegistrationHook(this._onExternalEntity, t3, r2, "external") && (n2[t3] = r2);
      this._externalMap = n2;
    }
    addExternalEntity(t2, e2) {
      Ye(t2), "string" == typeof e2 && -1 === e2.indexOf("&") && this._applyRegistrationHook(this._onExternalEntity, t2, e2, "external") && (this._externalMap[t2] = e2);
    }
    addInputEntities(t2) {
      if (this._totalExpansions = 0, this._expandedLength = 0, !this._onInputEntity) return void (this._inputMap = Ze(t2));
      const e2 = Ze(t2), n2 = /* @__PURE__ */ Object.create(null);
      for (const [t3, r2] of Object.entries(e2)) this._applyRegistrationHook(this._onInputEntity, t3, r2, "input") && (n2[t3] = r2);
      this._inputMap = n2;
    }
    reset() {
      return this._inputMap = /* @__PURE__ */ Object.create(null), this._totalExpansions = 0, this._expandedLength = 0, this;
    }
    setXmlVersion(t2) {
      this._ncrXmlVersion = 1.1 === t2 ? 1.1 : 1;
    }
    decode(t2) {
      if ("string" != typeof t2 || 0 === t2.length) return t2;
      if (-1 === t2.indexOf("&")) return t2;
      const e2 = t2, n2 = [], r2 = t2.length;
      let i2 = 0, s2 = 0;
      const o2 = this._maxTotalExpansions > 0, a2 = this._maxExpandedLength > 0, c2 = o2 || a2;
      for (; s2 < r2; ) {
        if (38 !== t2.charCodeAt(s2)) {
          s2++;
          continue;
        }
        let e3 = s2 + 1;
        for (; e3 < r2 && 59 !== t2.charCodeAt(e3) && e3 - s2 <= 32; ) e3++;
        if (e3 >= r2 || 59 !== t2.charCodeAt(e3)) {
          s2++;
          continue;
        }
        const l3 = t2.slice(s2 + 1, e3);
        if (0 === l3.length) {
          s2++;
          continue;
        }
        let h2, u2;
        if (this._removeSet.has(l3)) h2 = "", void 0 === u2 && (u2 = Qe);
        else {
          if (this._leaveSet.has(l3)) {
            s2++;
            continue;
          }
          if (35 === l3.charCodeAt(0)) {
            const t3 = this._resolveNCR(l3);
            if (void 0 === t3) {
              s2++;
              continue;
            }
            h2 = t3, u2 = Je;
          } else {
            const t3 = this._resolveName(l3);
            h2 = t3?.value, u2 = t3?.tier;
          }
        }
        if (void 0 !== h2) {
          if (s2 > i2 && n2.push(t2.slice(i2, s2)), n2.push(h2), i2 = e3 + 1, s2 = i2, c2 && this._tierCounts(u2)) {
            if (o2 && (this._totalExpansions++, this._totalExpansions > this._maxTotalExpansions)) throw new Error(`[EntityReplacer] Entity expansion count limit exceeded: ${this._totalExpansions} > ${this._maxTotalExpansions}`);
            if (a2) {
              const t3 = h2.length - (l3.length + 2);
              if (t3 > 0 && (this._expandedLength += t3, this._expandedLength > this._maxExpandedLength)) throw new Error(`[EntityReplacer] Expanded content length limit exceeded: ${this._expandedLength} > ${this._maxExpandedLength}`);
            }
          }
        } else s2++;
      }
      i2 < r2 && n2.push(t2.slice(i2));
      const l2 = 0 === n2.length ? t2 : n2.join("");
      return this._postCheck(l2, e2);
    }
    _tierCounts(t2) {
      return !!this._limitTiers.has(Ke) || this._limitTiers.has(t2);
    }
    _resolveName(t2) {
      return t2 in this._inputMap ? { value: this._inputMap[t2], tier: Qe } : t2 in this._externalMap ? { value: this._externalMap[t2], tier: Qe } : t2 in this._baseMap ? { value: this._baseMap[t2], tier: Je } : void 0;
    }
    _classifyNCR(t2) {
      return 0 === t2 ? this._ncrNullLevel : t2 >= 55296 && t2 <= 57343 || 1 === this._ncrXmlVersion && t2 >= 1 && t2 <= 31 && !en.has(t2) ? tn.remove : -1;
    }
    _applyNCRAction(t2, e2, n2) {
      switch (t2) {
        case tn.allow:
          return String.fromCodePoint(n2);
        case tn.remove:
          return "";
        case tn.leave:
          return;
        case tn.throw:
          throw new Error(`[EntityDecoder] Prohibited numeric character reference &${e2}; (U+${n2.toString(16).toUpperCase().padStart(4, "0")})`);
        default:
          return String.fromCodePoint(n2);
      }
    }
    _resolveNCR(t2) {
      const e2 = t2.charCodeAt(1);
      let n2;
      if (n2 = 120 === e2 || 88 === e2 ? parseInt(t2.slice(2), 16) : parseInt(t2.slice(1), 10), Number.isNaN(n2) || n2 < 0 || n2 > 1114111) return;
      const r2 = this._classifyNCR(n2);
      if (!this._numericAllowed && r2 < tn.remove) return;
      const i2 = -1 === r2 ? this._ncrOnLevel : Math.max(this._ncrOnLevel, r2);
      return this._applyNCRAction(i2, t2, n2);
    }
  };
  var rn = [{ id: "sql-block-comment-open", description: "SQL block comment open: /* ... */ \u2014 unusual in legitimate user text", pattern: /\/\*/ }, { id: "sql-union-select", description: "UNION SELECT \u2014 most common SQL injection aggregation attack", pattern: /\bUNION\s{1,20}(?:ALL\s{1,20})?SELECT\b/i }, { id: "sql-drop-table", description: "DROP TABLE \u2014 destructive DDL injection", pattern: /\bDROP\s{1,20}TABLE\b/i }, { id: "sql-drop-database", description: "DROP DATABASE \u2014 destructive DDL injection", pattern: /\bDROP\s{1,20}DATABASE\b/i }, { id: "sql-insert-into", description: "INSERT INTO \u2014 data injection", pattern: /\bINSERT\s{1,20}INTO\b/i }, { id: "sql-delete-from", description: "DELETE FROM \u2014 data deletion injection", pattern: /\bDELETE\s{1,20}FROM\b/i }, { id: "sql-update-set", description: "UPDATE ... SET \u2014 data modification injection", pattern: /\bUPDATE\b[\s\S]{1,60}\bSET\b/i }, { id: "sql-exec-xp", description: "EXEC xp_ \u2014 MSSQL extended stored procedure execution", pattern: /\bEXEC(?:UTE)?\s{1,20}xp_/i }, { id: "sql-tautology-string", description: `Classic string tautology: ' OR '1'='1 or " OR "1"="1"`, pattern: /'\s{0,10}OR\s{0,10}'[^']{0,20}'\s*=\s*'[^']{0,20}/i }, { id: "sql-tautology-numeric", description: "Numeric tautology: OR 1=1", pattern: /\bOR\s{1,10}1\s*=\s*1\b/i }, { id: "sql-always-true-zero", description: "Numeric tautology: OR 0=0", pattern: /\bOR\s{1,10}0\s*=\s*0\b/i }, { id: "sql-sleep-benchmark", description: "Time-based blind injection: SLEEP() or BENCHMARK()", pattern: /\b(?:SLEEP|BENCHMARK)\s*\(/i }, { id: "sql-waitfor-delay", description: "MSSQL time-based blind injection: WAITFOR DELAY", pattern: /\bWAITFOR\s{1,20}DELAY\b/i }, { id: "sql-char-function", description: "CHAR() function \u2014 used to obfuscate injected strings", pattern: /\bCHAR\s*\(\s*\d{1,3}/i }, { id: "sql-information-schema", description: "INFORMATION_SCHEMA \u2014 reconnaissance query for table/column enumeration", pattern: /\bINFORMATION_SCHEMA\b/i }];
  var sn = [...rn, { id: "sql-line-comment", description: "SQL line comment: -- followed by whitespace or end of string", pattern: /--(?:\s|$)/ }, { id: "sql-stacked-query", description: "Stacked queries: semicolon immediately followed by a SQL keyword", pattern: /;\s{0,10}(?:SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC)\b/i }, { id: "sql-hex-encoding", description: "Hex-encoded string injection: 0x41414141 style (MySQL)", pattern: /\b0x[0-9a-f]{4,}/i }];
  var on = [{ id: "html-script-open", description: "<script opening tag", pattern: /<script[\s>/]/i }, { id: "html-script-close", description: "<\/script closing tag", pattern: /<\/script[\s>]/i }, { id: "html-javascript-protocol", description: "javascript: URI scheme (with optional whitespace/encoding)", pattern: /j[\t\n\r ]*a[\t\n\r ]*v[\t\n\r ]*a[\t\n\r ]*s[\t\n\r ]*c[\t\n\r ]*r[\t\n\r ]*i[\t\n\r ]*p[\t\n\r ]*t[\t\n\r ]*:/i }, { id: "html-vbscript-protocol", description: "vbscript: URI scheme", pattern: /vbscript[\t\n\r ]*:/i }, { id: "html-data-html", description: "data:text/html URI \u2014 can execute scripts in browsers", pattern: /data[\t\n\r ]*:[\t\n\r ]*text\/html/i }, { id: "html-data-xhtml", description: "data:application/xhtml+xml URI", pattern: /data[\t\n\r ]*:[\t\n\r ]*application\/xhtml/i }, { id: "html-data-svg", description: "data:image/svg+xml URI \u2014 can execute scripts", pattern: /data[\t\n\r ]*:[\t\n\r ]*image\/svg\+xml/i }, { id: "html-inline-event-handler", description: "Inline event handler attributes: onclick=, onerror=, onload=, etc.", pattern: /\bon\w{1,30}\s*=/i }, { id: "html-entity-obfuscated-script", description: "HTML-entity-encoded <script (e.g. &#x3C;script or &lt;script)", pattern: /(?:&#x0*3[Cc];?|&#0*60;?|&lt;)\s*script/i }, { id: "html-entity-obfuscated-javascript", description: 'HTML-entity-encoded javascript: (partial \u2014 catches common &#106; or &#x6a; for "j")', pattern: /(?:&#x0*6[Aa];?|&#0*106;?)\s*(?:&#x0*61;?|a)[\s\S]{0,80}script\s*:/i }, { id: "html-style-expression", description: "CSS expression() \u2014 IE-era code execution in style attributes", pattern: /style[\s\S]{0,20}expression\s*\(/i }, { id: "html-object-embed", description: "<object or <embed tags that can load active content", pattern: /<(?:object|embed)[\s>/]/i }, { id: "html-base-tag", description: "<base href= \u2014 can hijack all relative URLs on a page", pattern: /<base[\s>]/i }, { id: "html-meta-refresh", description: '<meta http-equiv="refresh" \u2014 can redirect users', pattern: /<meta[\s\S]{0,40}http-equiv[\s\S]{0,20}refresh/i }, { id: "html-srcdoc", description: "srcdoc= attribute on iframes \u2014 embeds HTML that can run scripts", pattern: /srcdoc\s*=/i }, { id: "html-iframe", description: "<iframe tag", pattern: /<iframe[\s>/]/i }, { id: "html-form", description: "<form tag \u2014 can be used for phishing / credential harvesting injection", pattern: /<form[\s>/]/i }];
  var an = [{ id: "xml-cdata-injection", description: "CDATA section injection: <![CDATA[ breaks out of text node context", pattern: /<!\[CDATA\[/i }, { id: "xml-cdata-close", description: "CDATA close sequence: ]]> can terminate an enclosing CDATA section", pattern: /\]\]>/ }, { id: "xml-processing-instruction", description: "XML processing instruction: <?xml-stylesheet or <?php etc.", pattern: /<\?(?:xml[\- ]|php|asp)/i }, { id: "xml-doctype-injection", description: "DOCTYPE declaration embedded in content \u2014 can define entities", pattern: /<!DOCTYPE(?:[\s[]|$)/i }, { id: "xml-entity-system", description: "SYSTEM keyword \u2014 used in external entity declarations (XXE)", pattern: /\bSYSTEM\s+["']/i }, { id: "xml-entity-public", description: "PUBLIC keyword \u2014 used in external entity declarations (XXE)", pattern: /\bPUBLIC\s+["']/i }, { id: "xml-entity-declaration", description: "<!ENTITY declaration \u2014 defines entities, potential XXE or entity expansion", pattern: /<!ENTITY[\s%]/i }, { id: "xml-billion-laughs", description: "Entity reference chaining / billion laughs: repeated &eX; style references", pattern: /(?:&\w{1,20};){3,}/ }, { id: "xml-namespace-confusion", description: "xmlns: attribute injection \u2014 can redefine namespaces to confuse parsers", pattern: /\bxmlns(?::\w{1,40})?\s*=/i }, { id: "xml-comment-injection", description: "<!-- comment injection \u2014 can hide content from some parsers", pattern: /<!--/ }, { id: "xml-comment-close", description: "--> closes an enclosing XML comment", pattern: /-->/ }, { id: "xml-pi-close", description: "?> closes an enclosing processing instruction", pattern: /\?>/ }];
  var cn = [{ id: "svg-script-element", description: "<script element inside SVG executes JavaScript", pattern: /<script[\s>/]/i }, { id: "svg-xlink-href-javascript", description: "xlink:href with javascript: \u2014 classic SVG XSS via <a> or <use>", pattern: /xlink\s*:\s*href\s*=\s*["']?\s*javascript\s*:/i }, { id: "svg-href-javascript", description: "href= with javascript: in SVG context (<a>, <animate>, etc.)", pattern: /href\s*=\s*["']?\s*javascript\s*:/i }, { id: "svg-foreignobject", description: "<foreignObject embeds HTML inside SVG \u2014 can execute scripts", pattern: /<foreignObject[\s>/]/i }, { id: "svg-use-external", description: "<use xlink:href or href pointing to external resource (non-fragment URL)", pattern: /<use[\s\S]{0,60}(?:xlink\s*:\s*)?href\s*=\s*(?:["'][^#]|[^"'#\s>])/i }, { id: "svg-animate-href", description: '<animate attributeName="href" \u2014 can dynamically change href to javascript:', pattern: /<animate[\s\S]{0,80}attributeName\s*=\s*["'][\s]*href["']/i }, { id: "svg-animate-xlinkhref", description: '<animate attributeName="xlink:href"', pattern: /<animate[\s\S]{0,80}attributeName\s*=\s*["'][\s]*xlink\s*:\s*href["']/i }, { id: "svg-set-javascript", description: '<set to="javascript:..." \u2014 sets an attribute to a javascript: URI', pattern: /<set[\s\S]{0,80}to\s*=\s*["']?\s*javascript\s*:/i }, { id: "svg-event-handler", description: "SVG-specific event handler attributes: onload=, onerror=, onactivate=, etc.", pattern: /\bon(?:load|error|activate|begin|end|repeat|focus|blur|click|mouse\w{1,20}|key\w{1,20})\s*=/i }, { id: "svg-handler-generic", description: "Generic on* handler catch-all for SVG attributes", pattern: /\bon\w{1,30}\s*=/i }, { id: "svg-filter-feimage", description: "<feImage href= \u2014 filter primitive that can load external resources", pattern: /<feImage[\s\S]{0,80}(?:xlink\s*:\s*)?href\s*=/i }, { id: "svg-image-external", description: "<image xlink:href with http/https or javascript protocol", pattern: /<image[\s\S]{0,80}(?:xlink\s*:\s*)?href\s*=\s*["']?\s*(?:https?|javascript)\s*:/i }, { id: "svg-style-javascript", description: "style= attribute containing javascript: (e.g. background:url(javascript:...))", pattern: /style\s*=[\s\S]{0,60}javascript\s*:/i }];
  var ln = [{ id: "shell-path-traversal-unix", description: "Unix path traversal: ../  \u2014 climbing the directory tree", pattern: /\.\.\// }, { id: "shell-path-traversal-windows", description: "Windows path traversal: ..\\ \u2014 climbing the directory tree", pattern: /\.\.\\/ }, { id: "shell-path-traversal-encoded", description: "URL-encoded path traversal: %2e%2e or %2f variants", pattern: /%2e%2e|%2f\.\.|\.\.%2f/i }, { id: "shell-null-byte", description: "Null byte injection: \\x00 or %00 \u2014 truncates strings in C-backed functions", pattern: /\x00|%00/ }, { id: "shell-semicolon", description: "Semicolon command separator: cmd1; cmd2", pattern: /;/ }, { id: "shell-pipe", description: "Pipe operator: cmd1 | cmd2", pattern: /\|/ }, { id: "shell-and-operator", description: "AND operator: cmd1 && cmd2", pattern: /&&/ }, { id: "shell-or-operator", description: "OR operator: cmd1 || cmd2", pattern: /\|\|/ }, { id: "shell-backtick", description: "Backtick command substitution: `cmd`", pattern: /`/ }, { id: "shell-dollar-paren", description: "Dollar-paren command substitution: $(cmd)", pattern: /\$\(/ }, { id: "shell-dollar-brace", description: "Dollar-brace variable expansion: ${var} \u2014 can be abused for injection", pattern: /\$\{/ }, { id: "shell-redirect-out", description: "Output redirection: cmd > file or cmd >> file", pattern: />{1,2}/ }, { id: "shell-redirect-in", description: "Input redirection: cmd < file", pattern: /</ }, { id: "shell-newline-injection", description: "Newline injection: \\n or \\r \u2014 can inject new shell commands", pattern: /[\n\r]/ }, { id: "shell-glob-star", description: "Glob expansion: * or ? \u2014 can expand to unintended files", pattern: /[/\\][*?]/ }, { id: "shell-absolute-root", description: "Absolute root path injection: string starting with / or \\ (Windows UNC)", pattern: /^(?:\/|\\\\)/ }, { id: "shell-windows-drive", description: "Windows drive letter path injection: C:\\ or D:/", pattern: /^[a-zA-Z]:[/\\]/ }, { id: "shell-curl-wget", description: "curl/wget with URL or flags \u2014 can exfiltrate data or download payloads", pattern: /\b(?:curl|wget)\s+(?:https?:\/\/|ftp:\/\/|-)/i }];
  var hn = [{ id: "redos-nested-quantifier-plus", description: "Nested + quantifier inside a group with outer quantifier: (a+)+, (.+b)*, etc.", pattern: /\([^)]*\+[^)]*\)[+*]/ }, { id: "redos-nested-quantifier-star", description: "Nested * quantifier: (a*)* or (a*)+ \u2014 catastrophic backtracking", pattern: /\([^)]*\*[^)]*\)[*+]/ }, { id: "redos-nested-groups", description: "Doubly nested quantified groups: ((a+)+) \u2014 guaranteed catastrophic", pattern: /\(\([^)]{0,40}\)[+*]\)[+*]/ }, { id: "redos-alternation-overlap", description: "Overlapping alternation under quantifier: (a|a)+ \u2014 ambiguous NFA paths", pattern: /\(([^|()]{1,20})\|(?:\1)(?:\|[^|()]{1,20}){0,5}\)[+*?]{1,2}/ }, { id: "redos-star-plus-concat", description: "(x*x)+ pattern \u2014 triggers super-linear backtracking", pattern: /\([^)]{0,10}\*[^)]{0,10}\)[+*]/ }, { id: "redos-dot-star-greedy", description: "(.*){n,} or (.+){n,} \u2014 repeated greedy dot quantifiers", pattern: /\(\.[*+]\)\{?\d/ }, { id: "redos-large-repetition", description: "Very large fixed or range repetition count {1000,} or {1000,n} \u2014 denial of service via backtracking", pattern: /\{\d{4,}(?:,\d*)?\}/ }, { id: "redos-catastrophic-alternation", description: "Long alternation with many similar branches \u2014 polynomial backtracking risk", pattern: /\([^)]{0,200}(?:\|[^|)]{0,50}){9,}\)/ }];
  var un = `["'\\s]*:`;
  var pn = [{ id: "nosql-where-operator", description: "$where \u2014 executes arbitrary JavaScript server-side in MongoDB", pattern: new RegExp(`\\$where${un}`, "i") }, { id: "nosql-ne-operator", description: '$ne \u2014 "not equal" operator used to bypass equality checks', pattern: new RegExp(`\\$ne${un}`, "i") }, { id: "nosql-gt-operator", description: '$gt \u2014 "greater than" used to bypass password/value checks', pattern: new RegExp(`\\$gte?${un}`, "i") }, { id: "nosql-lt-operator", description: '$lt / $lte \u2014 "less than" bypass variants', pattern: new RegExp(`\\$lte?${un}`, "i") }, { id: "nosql-regex-operator", description: "$regex \u2014 can be used to extract data character by character (blind injection)", pattern: new RegExp(`\\$regex${un}`, "i") }, { id: "nosql-or-operator", description: "$or \u2014 logical OR; used to create always-true conditions", pattern: new RegExp(`\\$or${un}\\s*\\[`, "i") }, { id: "nosql-and-operator", description: "$and \u2014 logical AND operator injection", pattern: new RegExp(`\\$and${un}\\s*\\[`, "i") }, { id: "nosql-nor-operator", description: "$nor \u2014 logical NOR operator injection", pattern: new RegExp(`\\$nor${un}\\s*\\[`, "i") }, { id: "nosql-exists-operator", description: "$exists \u2014 can enumerate fields to determine schema", pattern: new RegExp(`\\$exists${un}`, "i") }, { id: "nosql-in-operator", description: "$in \u2014 matches any value in a list; can enumerate values", pattern: new RegExp(`\\$in${un}\\s*\\[`, "i") }, { id: "nosql-expr-operator", description: "$expr \u2014 allows aggregation expressions in queries (MongoDB 3.6+)", pattern: new RegExp(`\\$expr${un}`, "i") }, { id: "nosql-function-operator", description: "$function \u2014 executes arbitrary JavaScript in MongoDB 4.4+", pattern: new RegExp(`\\$function${un}`, "i") }, { id: "nosql-accumulator-operator", description: "$accumulator \u2014 custom aggregation with arbitrary JS execution", pattern: new RegExp(`\\$accumulator${un}`, "i") }, { id: "nosql-proto-pollution", description: "__proto__ \u2014 prototype pollution via object key injection", pattern: /__proto__/ }, { id: "nosql-constructor-prototype", description: "constructor.prototype \u2014 alternative prototype pollution vector (dot notation or JSON key)", pattern: /constructor[\s"':.,{\[]*prototype/i }, { id: "nosql-proto-bracket", description: '["__proto__"] \u2014 bracket-notation prototype pollution', pattern: /\[["']__proto__["']\]/ }];
  var fn = [{ id: "log-crlf-injection", description: "CRLF injection: literal \\r or \\n embeds fake log lines", pattern: /[\r\n]/ }, { id: "log-url-encoded-crlf", description: "URL-encoded CRLF: %0d, %0a, %0D, %0A \u2014 decoded by some log parsers", pattern: /%0[dDaA]/ }, { id: "log-unicode-newline", description: "Unicode newline variants: U+2028 (line separator), U+2029 (paragraph separator)", pattern: /[\u2028\u2029]/ }, { id: "log-log4shell-jndi", description: "Log4Shell: ${jndi:...} triggers remote code execution in Apache Log4j", pattern: /\$\{jndi\s*:/i }, { id: "log-log4shell-obfuscated", description: "Obfuscated Log4Shell: ${::-j}... lookup-bypass prefix used to evade WAF detection", pattern: /\$\{::-/ }, { id: "log-log4j-lookup", description: "Log4j lookup syntax: ${env:...}, ${sys:...}, ${ctx:...} \u2014 data exfiltration", pattern: /\$\{(?:env|sys|ctx|main|map|sd|web|docker|k8s|spring)\s*:/i }, { id: "log-ssti-double-brace", description: "SSTI double-brace: {{expression}} \u2014 Jinja2, Twig, Handlebars, etc.", pattern: /\{\{[\s\S]{0,80}\}\}/ }, { id: "log-ssti-hash-brace", description: "SSTI hash-brace: #{expression} \u2014 Thymeleaf, Velocity, Ruby ERB", pattern: /#\{[\s\S]{0,80}\}/ }, { id: "log-ssti-dollar-brace", description: "SSTI/EL injection: ${expression with operators or method calls} \u2014 JSP EL, Freemarker, SpEL", pattern: /\$\{[^}]*(?:\.|\(|\*|\+|\bclass\b|\bruntime\b|\bprocess\b|\bexec\b)[^}]{0,80}\}/i }, { id: "log-ssti-percent-tag", description: "SSTI ERB/ASP tag: <%= expression %> \u2014 Ruby ERB, ASP", pattern: /<%=[\s\S]{0,80}%>/ }, { id: "log-null-byte", description: "Null byte: \\x00 or %00 \u2014 can truncate log entries in C-backed loggers", pattern: /\x00|%00/ }, { id: "log-ansi-escape", description: "ANSI escape sequence: ESC[ \u2014 can manipulate terminal output when logs are tailed", pattern: /\x1b\[/ }];
  function dn(t2, e2) {
    const n2 = e2.label ?? "CUSTOM";
    for (const r2 of e2) if (r2.pattern.test(t2)) return { context: n2, id: r2.id, description: r2.description, pattern: r2.pattern };
    return null;
  }
  function gn(t2, e2) {
    (function(t3) {
      if ("string" != typeof t3) throw new TypeError("is-unsafe: first argument must be a string, got " + typeof t3);
    })(t2), (function(t3) {
      if (!(t3 instanceof RegExp)) {
        if (!Array.isArray(t3)) throw new TypeError("is-unsafe: second argument must be a PatternList (e.g. HTML), an array of PatternLists (e.g. [HTML, XML]), or a RegExp. Got: " + typeof t3);
        if (0 === t3.length) throw new TypeError("is-unsafe: context must not be an empty array");
        if (Array.isArray(t3[0])) {
          for (const e3 of t3) if (!Array.isArray(e3) || 0 === e3.length) throw new TypeError("is-unsafe: each context in the array must be a non-empty pattern array (PatternList)");
        }
      }
    })(e2);
    const { lists: n2, regex: r2 } = (function(t3) {
      return t3 instanceof RegExp ? { lists: null, regex: t3 } : Array.isArray(t3[0]) ? { lists: t3, regex: null } : { lists: [t3], regex: null };
    })(e2);
    if (r2) return r2.test(t2);
    for (const e3 of n2) if (null !== dn(t2, e3)) return true;
    return false;
  }
  function mn(t2, e2) {
    if (!t2) return {};
    const n2 = e2.attributesGroupName ? t2[e2.attributesGroupName] : t2;
    if (!n2) return {};
    const r2 = {};
    for (const t3 in n2) t3.startsWith(e2.attributeNamePrefix) ? r2[t3.substring(e2.attributeNamePrefix.length)] = n2[t3] : r2[t3] = n2[t3];
    return r2;
  }
  function yn(t2) {
    if (!t2 || "string" != typeof t2) return;
    const e2 = t2.indexOf(":");
    if (-1 !== e2 && e2 > 0) {
      const n2 = t2.substring(0, e2);
      if ("xmlns" !== n2) return n2;
    }
  }
  on.label = "HTML", an.label = "XML", cn.label = "SVG", rn.label = "SQL", sn.label = "SQL-STRICT", ln.label = "SHELL", hn.label = "REDOS", pn.label = "NOSQL", fn.label = "LOG", Object.freeze({ HTML: on, XML: an, SVG: cn, SQL: rn, "SQL-STRICT": sn, SHELL: ln, REDOS: hn, NOSQL: pn, LOG: fn });
  var bn = class {
    constructor(t2, e2) {
      var n2;
      this.options = t2, this.currentNode = null, this.tagsNodeStack = [], this.parseXml = Nn, this.parseTextData = xn, this.resolveNameSpace = vn, this.buildAttributesMap = En, this.isItStopNode = Pn, this.replaceEntitiesValue = Sn, this.readStopNodeData = Cn, this.saveTextToParentTag = Tn, this.addChild = An, this.ignoreAttributesFn = "function" == typeof (n2 = this.options.ignoreAttributes) ? n2 : Array.isArray(n2) ? (t3) => {
        for (const e3 of n2) {
          if ("string" == typeof e3 && t3 === e3) return true;
          if (e3 instanceof RegExp && e3.test(t3)) return true;
        }
      } : () => false, this.entityExpansionCount = 0, this.currentExpandedLength = 0, this.doctypefound = false;
      let r2 = { ...Ge };
      this.options.entityDecoder ? this.entityDecoder = this.options.entityDecoder : ("object" == typeof this.options.htmlEntities ? r2 = this.options.htmlEntities : true === this.options.htmlEntities && (r2 = { ...ze, ...Be }), this.entityDecoder = new nn({ namedEntities: { ...r2, ...e2 }, numericAllowed: this.options.htmlEntities, limit: { maxTotalExpansions: this.options.processEntities.maxTotalExpansions, maxExpandedLength: this.options.processEntities.maxExpandedLength, applyLimitsTo: this.options.processEntities.appliesTo }, onInputEntity: (t3, e3) => gn(e3, [on, an]) ? He.BLOCK : He.ALLOW })), this.matcher = new qe(), this.readonlyMatcher = this.matcher.readOnly(), this.isCurrentNodeStopNode = false, this.stopNodeExpressionsSet = new We();
      const i2 = this.options.stopNodes;
      if (i2 && i2.length > 0) {
        for (let t3 = 0; t3 < i2.length; t3++) {
          const e3 = i2[t3];
          "string" == typeof e3 ? this.stopNodeExpressionsSet.add(new Fe(e3)) : e3 instanceof Fe && this.stopNodeExpressionsSet.add(e3);
        }
        this.stopNodeExpressionsSet.seal();
      }
    }
  };
  function xn(t2, e2, n2, r2, i2, s2, o2) {
    const a2 = this.options;
    if (void 0 !== t2 && (a2.trimValues && !r2 && (t2 = t2.trim()), t2.length > 0)) {
      o2 || (t2 = this.replaceEntitiesValue(t2, e2, n2));
      const r3 = a2.jPath ? n2.toString() : n2, c2 = a2.tagValueProcessor(e2, t2, r3, i2, s2);
      return null == c2 ? t2 : typeof c2 != typeof t2 || c2 !== t2 ? c2 : a2.trimValues || t2.trim() === t2 ? _n(t2, a2.parseTagValue, a2.numberParseOptions) : t2;
    }
  }
  function vn(t2) {
    if (this.options.removeNSPrefix) {
      const e2 = t2.split(":"), n2 = "/" === t2.charAt(0) ? "/" : "";
      if ("xmlns" === e2[0]) return "";
      2 === e2.length && (t2 = n2 + e2[1]);
    }
    return t2;
  }
  var wn = new RegExp(`([^\\s=]+)\\s*(=\\s*(['"])([\\s\\S]*?)\\3)?`, "gm");
  function En(t2, e2, n2, r2 = false) {
    const i2 = this.options;
    if (true === r2 || true !== i2.ignoreAttributes && "string" == typeof t2) {
      const r3 = (function(t3, e3) {
        const n3 = [];
        let r4 = e3.exec(t3);
        for (; r4; ) {
          const i3 = [];
          i3.startIndex = e3.lastIndex - r4[0].length;
          const s3 = r4.length;
          for (let t4 = 0; t4 < s3; t4++) i3.push(r4[t4]);
          n3.push(i3), r4 = e3.exec(t3);
        }
        return n3;
      })(t2, wn), s2 = r3.length, o2 = {}, a2 = new Array(s2);
      let c2 = false;
      const l2 = {};
      for (let t3 = 0; t3 < s2; t3++) {
        const e3 = this.resolveNameSpace(r3[t3][1]), s3 = r3[t3][4];
        if (e3.length && void 0 !== s3) {
          let r4 = s3;
          i2.trimValues && (r4 = r4.trim()), r4 = this.replaceEntitiesValue(r4, n2, this.readonlyMatcher), a2[t3] = r4, l2[e3] = r4, c2 = true;
        }
      }
      c2 && "object" == typeof e2 && e2.updateCurrent && e2.updateCurrent(l2);
      const h2 = i2.jPath ? e2.toString() : this.readonlyMatcher;
      let u2 = false;
      for (let t3 = 0; t3 < s2; t3++) {
        const e3 = this.resolveNameSpace(r3[t3][1]);
        if (this.ignoreAttributesFn(e3, h2)) continue;
        let n3 = i2.attributeNamePrefix + e3;
        if (e3.length) if (i2.transformAttributeName && (n3 = i2.transformAttributeName(n3)), n3 = kn(n3, i2), void 0 !== r3[t3][4]) {
          const r4 = a2[t3], s3 = i2.attributeValueProcessor(e3, r4, h2);
          o2[n3] = null == s3 ? r4 : typeof s3 != typeof r4 || s3 !== r4 ? s3 : _n(r4, i2.parseAttributeValue, i2.numberParseOptions), u2 = true;
        } else i2.allowBooleanAttributes && (o2[n3] = true, u2 = true);
      }
      if (!u2) return;
      if (i2.attributesGroupName && !i2.preserveOrder) {
        const t3 = {};
        return t3[i2.attributesGroupName] = o2, t3;
      }
      return o2;
    }
  }
  var Nn = function(t2) {
    t2 = t2.replace(/\r\n?/g, "\n");
    const e2 = new he("!xml");
    let n2 = e2, r2 = "";
    this.matcher.reset(), this.entityDecoder.reset(), this.entityExpansionCount = 0, this.currentExpandedLength = 0, this.doctypefound = false;
    const i2 = this.options, s2 = new Ne(i2.processEntities), o2 = t2.length;
    for (let a2 = 0; a2 < o2; a2++) if ("<" === t2[a2]) {
      const c2 = t2.charCodeAt(a2 + 1);
      if (47 === c2) {
        const s3 = On(t2, ">", a2, "Closing Tag is not closed.");
        let o3 = t2.substring(a2 + 2, s3).trim();
        if (i2.removeNSPrefix) {
          const t3 = o3.indexOf(":");
          -1 !== t3 && (o3 = o3.substr(t3 + 1));
        }
        o3 = In(i2.transformTagName, o3, "", i2).tagName, n2 && (r2 = this.saveTextToParentTag(r2, n2, this.readonlyMatcher));
        const c3 = this.matcher.getCurrentTag();
        if (o3 && i2.unpairedTagsSet.has(o3)) throw new Error(`Unpaired tag can not be used as closing tag: </${o3}>`);
        c3 && i2.unpairedTagsSet.has(c3) && (this.matcher.pop(), this.tagsNodeStack.pop()), this.matcher.pop(), this.isCurrentNodeStopNode = false, n2 = this.tagsNodeStack.pop() || e2, i2.captureMetaData && n2 && n2.addEndIndex(s3 + 1), r2 = "", a2 = s3;
      } else if (63 === c2) {
        let e3 = $n(t2, a2, false, "?>");
        if (!e3) throw new Error("Pi Tag is not closed.");
        r2 = this.saveTextToParentTag(r2, n2, this.readonlyMatcher);
        const o3 = this.buildAttributesMap(e3.tagExp, this.matcher, e3.tagName, true);
        if (o3) {
          const t3 = o3[this.options.attributeNamePrefix + "version"];
          this.entityDecoder.setXmlVersion(Number(t3) || 1), s2.setXmlVersion(Number(t3) || 1);
        }
        if (i2.ignoreDeclaration && "?xml" === e3.tagName || i2.ignorePiTags) ;
        else {
          const t3 = new he(e3.tagName);
          t3.add(i2.textNodeName, ""), e3.tagName !== e3.tagExp && e3.attrExpPresent && true !== i2.ignoreAttributes && (t3[":@"] = o3), this.addChild(n2, t3, this.readonlyMatcher, a2), i2.captureMetaData && n2.addEndIndex(e3.closeIndex + 2);
        }
        a2 = e3.closeIndex + 1;
      } else if (33 === c2 && 45 === t2.charCodeAt(a2 + 2) && 45 === t2.charCodeAt(a2 + 3)) {
        const e3 = On(t2, "-->", a2 + 4, "Comment is not closed.");
        if (i2.commentPropName) {
          const s3 = t2.substring(a2 + 4, e3 - 2);
          r2 = this.saveTextToParentTag(r2, n2, this.readonlyMatcher), n2.add(i2.commentPropName, [{ [i2.textNodeName]: s3 }]);
        }
        a2 = e3;
      } else if (33 === c2 && 68 === t2.charCodeAt(a2 + 2)) {
        if (this.doctypefound) throw new Error("Multiple DOCTYPE declarations found.");
        this.doctypefound = true;
        const e3 = s2.readDocType(t2, a2);
        this.entityDecoder.addInputEntities(e3.entities), a2 = e3.i;
      } else if (33 === c2 && 91 === t2.charCodeAt(a2 + 2)) {
        const e3 = On(t2, "]]>", a2, "CDATA is not closed.") - 2, s3 = t2.substring(a2 + 9, e3);
        r2 = this.saveTextToParentTag(r2, n2, this.readonlyMatcher);
        let o3 = this.parseTextData(s3, n2.tagname, this.readonlyMatcher, true, false, true, true);
        null == o3 && (o3 = ""), i2.cdataPropName ? n2.add(i2.cdataPropName, [{ [i2.textNodeName]: s3 }]) : n2.add(i2.textNodeName, o3), a2 = e3 + 2;
      } else {
        let s3 = $n(t2, a2, i2.removeNSPrefix);
        if (!s3) {
          const e3 = t2.substring(Math.max(0, a2 - 50), Math.min(o2, a2 + 50));
          throw new Error(`readTagExp returned undefined at position ${a2}. Context: "${e3}"`);
        }
        let c3 = s3.tagName;
        const l2 = s3.rawTagName;
        let h2 = s3.tagExp, u2 = s3.attrExpPresent, p2 = s3.closeIndex;
        if ({ tagName: c3, tagExp: h2 } = In(i2.transformTagName, c3, h2, i2), i2.strictReservedNames && (c3 === i2.commentPropName || c3 === i2.cdataPropName || c3 === i2.textNodeName || c3 === i2.attributesGroupName)) throw new Error(`Invalid tag name: ${c3}`);
        n2 && r2 && "!xml" !== n2.tagname && (r2 = this.saveTextToParentTag(r2, n2, this.readonlyMatcher, false));
        const f2 = n2;
        f2 && i2.unpairedTagsSet.has(f2.tagname) && (n2 = this.tagsNodeStack.pop(), this.matcher.pop());
        let d2 = false;
        h2.length > 0 && h2.lastIndexOf("/") === h2.length - 1 && (d2 = true, "/" === c3[c3.length - 1] ? (c3 = c3.substr(0, c3.length - 1), h2 = c3) : h2 = h2.substr(0, h2.length - 1), u2 = c3 !== h2);
        let g2, m2 = null, y2 = {};
        g2 = yn(l2), c3 !== e2.tagname && this.matcher.push(c3, {}, g2), c3 !== h2 && u2 && (m2 = this.buildAttributesMap(h2, this.matcher, c3), m2 && (y2 = mn(m2, i2))), c3 !== e2.tagname && (this.isCurrentNodeStopNode = this.isItStopNode());
        const b2 = a2;
        if (this.isCurrentNodeStopNode) {
          let e3 = "";
          if (d2) a2 = s3.closeIndex;
          else if (i2.unpairedTagsSet.has(c3)) a2 = s3.closeIndex;
          else {
            const n3 = this.readStopNodeData(t2, l2, p2 + 1);
            if (!n3) throw new Error(`Unexpected end of ${l2}`);
            a2 = n3.i, e3 = n3.tagContent;
          }
          const r3 = new he(c3);
          m2 && (r3[":@"] = m2), r3.add(i2.textNodeName, e3), this.matcher.pop(), this.isCurrentNodeStopNode = false, this.addChild(n2, r3, this.readonlyMatcher, b2), i2.captureMetaData && n2.addEndIndex(a2 + 1);
        } else {
          if (d2) {
            ({ tagName: c3, tagExp: h2 } = In(i2.transformTagName, c3, h2, i2));
            const t3 = new he(c3);
            m2 && (t3[":@"] = m2), this.addChild(n2, t3, this.readonlyMatcher, b2), i2.captureMetaData && n2.addEndIndex(p2 + 1), this.matcher.pop(), this.isCurrentNodeStopNode = false;
          } else {
            if (i2.unpairedTagsSet.has(c3)) {
              const t3 = new he(c3);
              m2 && (t3[":@"] = m2), this.addChild(n2, t3, this.readonlyMatcher, b2), i2.captureMetaData && n2.addEndIndex(s3.closeIndex + 1), this.matcher.pop(), this.isCurrentNodeStopNode = false, a2 = s3.closeIndex;
              continue;
            }
            {
              const t3 = new he(c3);
              if (this.tagsNodeStack.length > i2.maxNestedTags) throw new Error("Maximum nested tags exceeded");
              this.tagsNodeStack.push(n2), m2 && (t3[":@"] = m2), this.addChild(n2, t3, this.readonlyMatcher, b2), n2 = t3;
            }
          }
          r2 = "", a2 = p2;
        }
      }
    } else r2 += t2[a2];
    return e2.child;
  };
  function An(t2, e2, n2, r2) {
    this.options.captureMetaData || (r2 = void 0);
    const i2 = this.options.jPath ? n2.toString() : n2, s2 = this.options.updateTag(e2.tagname, i2, e2[":@"]);
    false === s2 || ("string" == typeof s2 ? (e2.tagname = s2, t2.addChild(e2, r2)) : t2.addChild(e2, r2));
  }
  function Sn(t2, e2, n2) {
    const r2 = this.options.processEntities;
    if (!r2 || !r2.enabled) return t2;
    if (r2.allowedTags) {
      const i2 = this.options.jPath ? n2.toString() : n2;
      if (!(Array.isArray(r2.allowedTags) ? r2.allowedTags.includes(e2) : r2.allowedTags(e2, i2))) return t2;
    }
    if (r2.tagFilter) {
      const i2 = this.options.jPath ? n2.toString() : n2;
      if (!r2.tagFilter(e2, i2)) return t2;
    }
    return this.entityDecoder.decode(t2);
  }
  function Tn(t2, e2, n2, r2) {
    return t2 && (void 0 === r2 && (r2 = 0 === e2.child.length), void 0 !== (t2 = this.parseTextData(t2, e2.tagname, n2, false, !!e2[":@"] && 0 !== Object.keys(e2[":@"]).length, r2)) && "" !== t2 && e2.add(this.options.textNodeName, t2), t2 = ""), t2;
  }
  function Pn() {
    return 0 !== this.stopNodeExpressionsSet.size && this.matcher.matchesAny(this.stopNodeExpressionsSet);
  }
  function On(t2, e2, n2, r2) {
    const i2 = t2.indexOf(e2, n2);
    if (-1 === i2) throw new Error(r2);
    return i2 + e2.length - 1;
  }
  function jn(t2, e2, n2, r2) {
    const i2 = t2.indexOf(e2, n2);
    if (-1 === i2) throw new Error(r2);
    return i2;
  }
  function $n(t2, e2, n2, r2 = ">") {
    const i2 = (function(t3, e3, n3 = ">") {
      let r3 = 0;
      const i3 = t3.length, s3 = n3.charCodeAt(0), o3 = n3.length > 1 ? n3.charCodeAt(1) : -1;
      let a3 = "", c3 = e3;
      for (let n4 = e3; n4 < i3; n4++) {
        const e4 = t3.charCodeAt(n4);
        if (r3) e4 === r3 && (r3 = 0);
        else if (34 === e4 || 39 === e4) r3 = e4;
        else if (e4 === s3) {
          if (-1 === o3) return a3 += t3.substring(c3, n4), { data: a3, index: n4 };
          if (t3.charCodeAt(n4 + 1) === o3) return a3 += t3.substring(c3, n4), { data: a3, index: n4 };
        } else 9 !== e4 || r3 || (a3 += t3.substring(c3, n4) + " ", c3 = n4 + 1);
      }
    })(t2, e2 + 1, r2);
    if (!i2) return;
    let s2 = i2.data;
    const o2 = i2.index, a2 = s2.search(/\s/);
    let c2 = s2, l2 = true;
    -1 !== a2 && (c2 = s2.substring(0, a2), s2 = s2.substring(a2 + 1).trimStart());
    const h2 = c2;
    if (n2) {
      const t3 = c2.indexOf(":");
      -1 !== t3 && (c2 = c2.substr(t3 + 1), l2 = c2 !== i2.data.substr(t3 + 1));
    }
    return { tagName: c2, tagExp: s2, closeIndex: o2, attrExpPresent: l2, rawTagName: h2 };
  }
  function Cn(t2, e2, n2) {
    const r2 = n2;
    let i2 = 1;
    const s2 = t2.length;
    for (; n2 < s2; n2++) if ("<" === t2[n2]) {
      const s3 = t2.charCodeAt(n2 + 1);
      if (47 === s3) {
        const s4 = jn(t2, ">", n2, `${e2} is not closed`);
        if (t2.substring(n2 + 2, s4).trim() === e2 && (i2--, 0 === i2)) return { tagContent: t2.substring(r2, n2), i: s4 };
        n2 = s4;
      } else if (63 === s3) n2 = On(t2, "?>", n2 + 1, "StopNode is not closed.");
      else if (33 === s3 && 45 === t2.charCodeAt(n2 + 2) && 45 === t2.charCodeAt(n2 + 3)) n2 = On(t2, "-->", n2 + 3, "StopNode is not closed.");
      else if (33 === s3 && 91 === t2.charCodeAt(n2 + 2)) n2 = On(t2, "]]>", n2, "StopNode is not closed.") - 2;
      else {
        const r3 = $n(t2, n2, false);
        r3 && ((r3 && r3.tagName) === e2 && "/" !== r3.tagExp[r3.tagExp.length - 1] && i2++, n2 = r3.closeIndex);
      }
    }
  }
  function _n(t2, e2, n2) {
    if (e2 && "string" == typeof t2) {
      const e3 = t2.trim();
      return "true" === e3 || "false" !== e3 && Me(t2, n2);
    }
    return void 0 !== t2 ? t2 : "";
  }
  function In(t2, e2, n2, r2) {
    if (t2) {
      const r3 = t2(e2);
      n2 === e2 && (n2 = r3), e2 = r3;
    }
    return { tagName: e2 = kn(e2, r2), tagExp: n2 };
  }
  function kn(t2, e2) {
    if (re.includes(t2)) throw new Error(`[SECURITY] Invalid name: "${t2}" is a reserved JavaScript keyword that could cause prototype pollution`);
    return ne.includes(t2) ? e2.onDangerousProperty(t2) : t2;
  }
  var Rn = he.getMetaDataSymbol();
  function Ln(t2, e2) {
    if (!t2 || "object" != typeof t2) return {};
    if (!e2) return t2;
    const n2 = {};
    for (const r2 in t2) r2.startsWith(e2) ? n2[r2.substring(e2.length)] = t2[r2] : n2[r2] = t2[r2];
    return n2;
  }
  function Mn(t2, e2, n2, r2) {
    return Dn(t2, e2, n2, r2);
  }
  function Dn(t2, e2, n2, r2) {
    let i2;
    const s2 = {};
    for (let o2 = 0; o2 < t2.length; o2++) {
      const a2 = t2[o2], c2 = Un(a2);
      if (void 0 !== c2 && c2 !== e2.textNodeName) {
        const t3 = Ln(a2[":@"] || {}, e2.attributeNamePrefix);
        n2.push(c2, t3);
      }
      if (c2 === e2.textNodeName) void 0 === i2 ? i2 = a2[c2] : i2 += "" + a2[c2];
      else {
        if (void 0 === c2) continue;
        if (a2[c2]) {
          let t3 = Dn(a2[c2], e2, n2, r2);
          const i3 = qn(t3, e2);
          if (0 === Object.keys(t3).length && e2.alwaysCreateTextNode && (t3[e2.textNodeName] = ""), a2[":@"] ? Vn(t3, a2[":@"], r2, e2) : 1 !== Object.keys(t3).length || void 0 === t3[e2.textNodeName] || e2.alwaysCreateTextNode ? 0 === Object.keys(t3).length && (e2.alwaysCreateTextNode ? t3[e2.textNodeName] = "" : t3 = "") : t3 = t3[e2.textNodeName], void 0 !== a2[Rn] && "object" == typeof t3 && null !== t3 && (t3[Rn] = a2[Rn]), void 0 !== s2[c2] && Object.prototype.hasOwnProperty.call(s2, c2)) Array.isArray(s2[c2]) || (s2[c2] = [s2[c2]]), s2[c2].push(t3);
          else {
            const n3 = e2.jPath ? r2.toString() : r2;
            e2.isArray(c2, n3, i3) ? s2[c2] = [t3] : s2[c2] = t3;
          }
          void 0 !== c2 && c2 !== e2.textNodeName && n2.pop();
        }
      }
    }
    return "string" == typeof i2 ? i2.length > 0 && (s2[e2.textNodeName] = i2) : void 0 !== i2 && (s2[e2.textNodeName] = i2), s2;
  }
  function Un(t2) {
    const e2 = Object.keys(t2);
    for (let t3 = 0; t3 < e2.length; t3++) {
      const n2 = e2[t3];
      if (":@" !== n2) return n2;
    }
  }
  function Vn(t2, e2, n2, r2) {
    if (e2) {
      const i2 = Object.keys(e2), s2 = i2.length;
      for (let o2 = 0; o2 < s2; o2++) {
        const s3 = i2[o2], a2 = s3.startsWith(r2.attributeNamePrefix) ? s3.substring(r2.attributeNamePrefix.length) : s3, c2 = r2.jPath ? n2.toString() + "." + a2 : n2;
        r2.isArray(s3, c2, true, true) ? t2[s3] = [e2[s3]] : t2[s3] = e2[s3];
      }
    }
  }
  function qn(t2, e2) {
    const { textNodeName: n2 } = e2, r2 = Object.keys(t2).length;
    return 0 === r2 || !(1 !== r2 || !t2[n2] && "boolean" != typeof t2[n2] && 0 !== t2[n2]);
  }
  var Fn = { allowBooleanAttributes: false, unpairedTags: [] };
  function Wn(t2) {
    return " " === t2 || "	" === t2 || "\n" === t2 || "\r" === t2;
  }
  function Bn(t2, e2) {
    const n2 = e2;
    for (; e2 < t2.length; e2++) if ("?" != t2[e2] && " " != t2[e2]) ;
    else {
      const r2 = t2.substr(n2, e2 - n2);
      if (e2 > 5 && "xml" === r2) return Yn("InvalidXml", "XML declaration allowed only at the start of the document.", Qn(t2, e2));
      if ("?" == t2[e2] && ">" == t2[e2 + 1]) {
        e2++;
        break;
      }
    }
    return e2;
  }
  function Gn(t2, e2) {
    if (t2.length > e2 + 5 && "-" === t2[e2 + 1] && "-" === t2[e2 + 2]) {
      for (e2 += 3; e2 < t2.length; e2++) if ("-" === t2[e2] && "-" === t2[e2 + 1] && ">" === t2[e2 + 2]) {
        e2 += 2;
        break;
      }
    } else if (t2.length > e2 + 8 && "D" === t2[e2 + 1] && "O" === t2[e2 + 2] && "C" === t2[e2 + 3] && "T" === t2[e2 + 4] && "Y" === t2[e2 + 5] && "P" === t2[e2 + 6] && "E" === t2[e2 + 7]) {
      let n2 = 1;
      for (e2 += 8; e2 < t2.length; e2++) if ("<" === t2[e2]) n2++;
      else if (">" === t2[e2] && (n2--, 0 === n2)) break;
    } else if (t2.length > e2 + 9 && "[" === t2[e2 + 1] && "C" === t2[e2 + 2] && "D" === t2[e2 + 3] && "A" === t2[e2 + 4] && "T" === t2[e2 + 5] && "A" === t2[e2 + 6] && "[" === t2[e2 + 7]) {
      for (e2 += 8; e2 < t2.length; e2++) if ("]" === t2[e2] && "]" === t2[e2 + 1] && ">" === t2[e2 + 2]) {
        e2 += 2;
        break;
      }
    }
    return e2;
  }
  function zn(t2, e2) {
    let n2 = "", r2 = "", i2 = false;
    for (; e2 < t2.length; e2++) {
      if ('"' === t2[e2] || "'" === t2[e2]) "" === r2 ? r2 = t2[e2] : r2 !== t2[e2] || (r2 = "");
      else if (">" === t2[e2] && "" === r2) {
        i2 = true;
        break;
      }
      n2 += t2[e2];
    }
    return "" === r2 && { value: n2, index: e2, tagClosed: i2 };
  }
  function Hn(t2, e2) {
    const n2 = (function(t3) {
      const e3 = [], n3 = t3.length;
      let r3 = 0;
      for (; r3 < n3; ) {
        const i2 = r3;
        for (; r3 < n3 && Wn(t3[r3]); ) r3++;
        if (r3 >= n3) break;
        if ("=" === t3[r3]) {
          r3 = i2 + 1;
          continue;
        }
        const s2 = t3.slice(i2, r3), o2 = r3;
        for (; r3 < n3 && !Wn(t3[r3]) && "=" !== t3[r3]; ) r3++;
        const a2 = t3.slice(o2, r3);
        let c2, l2, h2, u2 = r3;
        for (; u2 < n3 && Wn(t3[u2]); ) u2++;
        u2 < n3 && "=" === t3[u2] && (c2 = t3.slice(r3, u2 + 1), r3 = u2 + 1);
        let p2 = r3;
        for (; p2 < n3 && Wn(t3[p2]); ) p2++;
        if (p2 < n3 && ('"' === t3[p2] || "'" === t3[p2])) {
          const e4 = p2 + 1, n4 = t3.indexOf(t3[p2], e4);
          -1 !== n4 && (l2 = t3[p2], h2 = t3.slice(e4, n4), r3 = n4 + 1);
        }
        const f2 = { startIndex: i2 };
        f2[1] = s2, f2[2] = a2, f2[3] = c2, f2[4] = void 0 !== l2 || void 0, f2[5] = l2, f2[6] = h2, e3.push(f2);
      }
      return e3;
    })(t2), r2 = {};
    for (let t3 = 0; t3 < n2.length; t3++) {
      if (0 === n2[t3][1].length) return Yn("InvalidAttr", "Attribute '" + n2[t3][2] + "' has no space in starting.", Jn(n2[t3]));
      if (void 0 !== n2[t3][3] && void 0 === n2[t3][4]) return Yn("InvalidAttr", "Attribute '" + n2[t3][2] + "' is without value.", Jn(n2[t3]));
      if (void 0 === n2[t3][3] && !e2.allowBooleanAttributes) return Yn("InvalidAttr", "boolean attribute '" + n2[t3][2] + "' is not allowed.", Jn(n2[t3]));
      const i2 = n2[t3][2];
      if (!Zn(i2)) return Yn("InvalidAttr", "Attribute '" + i2 + "' is an invalid name.", Jn(n2[t3]));
      if (Object.prototype.hasOwnProperty.call(r2, i2)) return Yn("InvalidAttr", "Attribute '" + i2 + "' is repeated.", Jn(n2[t3]));
      r2[i2] = 1;
    }
    return true;
  }
  function Xn(t2, e2) {
    if (";" === t2[++e2]) return -1;
    if ("#" === t2[e2]) return (function(t3, e3) {
      let n3 = /\d/;
      for ("x" === t3[e3] && (e3++, n3 = /[\da-fA-F]/); e3 < t3.length; e3++) {
        if (";" === t3[e3]) return e3;
        if (!t3[e3].match(n3)) break;
      }
      return -1;
    })(t2, ++e2);
    let n2 = 0;
    for (; e2 < t2.length; e2++, n2++) if (!(t2[e2].match(/\w/) && n2 < 20)) {
      if (";" === t2[e2]) break;
      return -1;
    }
    return e2;
  }
  function Yn(t2, e2, n2) {
    return { err: { code: t2, msg: e2, line: n2.line || n2, col: n2.col } };
  }
  function Zn(t2) {
    return ee(t2);
  }
  function Qn(t2, e2) {
    const n2 = t2.substring(0, e2).split(/\r?\n/);
    return { line: n2.length, col: n2[n2.length - 1].length + 1 };
  }
  function Jn(t2) {
    return t2.startIndex + t2[1].length;
  }
  var Kn = class {
    constructor(t2) {
      this.externalEntities = {}, this.options = ce(t2);
    }
    parse(t2, e2) {
      if ("string" != typeof t2 && t2.toString) t2 = t2.toString();
      else if ("string" != typeof t2) throw new Error("XML data is accepted in String or Bytes[] form.");
      if (e2) {
        true === e2 && (e2 = {});
        const n3 = (function(t3, e3) {
          e3 = Object.assign({}, Fn, e3);
          const n4 = [];
          let r3 = false, i2 = false;
          "\uFEFF" === t3[0] && (t3 = t3.substr(1));
          for (let s2 = 0; s2 < t3.length; s2++) if ("<" === t3[s2] && "?" === t3[s2 + 1]) {
            if (s2 += 2, s2 = Bn(t3, s2), s2.err) return s2;
          } else {
            if ("<" !== t3[s2]) {
              if (Wn(t3[s2])) continue;
              return Yn("InvalidChar", "char '" + t3[s2] + "' is not expected.", Qn(t3, s2));
            }
            {
              let o2 = s2;
              if (s2++, "!" === t3[s2]) {
                s2 = Gn(t3, s2);
                continue;
              }
              {
                let a2 = false;
                "/" === t3[s2] && (a2 = true, s2++);
                let c2 = "";
                for (; s2 < t3.length && ">" !== t3[s2] && " " !== t3[s2] && "	" !== t3[s2] && "\n" !== t3[s2] && "\r" !== t3[s2]; s2++) c2 += t3[s2];
                if (c2 = c2.trim(), "/" === c2[c2.length - 1] && (c2 = c2.substring(0, c2.length - 1), s2--), !ee(c2)) {
                  let e4;
                  return e4 = 0 === c2.trim().length ? "Invalid space after '<'." : "Tag '" + c2 + "' is an invalid name.", Yn("InvalidTag", e4, Qn(t3, s2));
                }
                const l2 = zn(t3, s2);
                if (false === l2) return Yn("InvalidAttr", "Attributes for '" + c2 + "' have open quote.", Qn(t3, s2));
                let h2 = l2.value;
                if (s2 = l2.index, "/" === h2[h2.length - 1]) {
                  const n5 = s2 - h2.length;
                  h2 = h2.substring(0, h2.length - 1);
                  const i3 = Hn(h2, e3);
                  if (true !== i3) return Yn(i3.err.code, i3.err.msg, Qn(t3, n5 + i3.err.line));
                  r3 = true;
                } else if (a2) {
                  if (!l2.tagClosed) return Yn("InvalidTag", "Closing tag '" + c2 + "' doesn't have proper closing.", Qn(t3, s2));
                  if (h2.trim().length > 0) return Yn("InvalidTag", "Closing tag '" + c2 + "' can't have attributes or invalid starting.", Qn(t3, o2));
                  if (0 === n4.length) return Yn("InvalidTag", "Closing tag '" + c2 + "' has not been opened.", Qn(t3, o2));
                  {
                    const e4 = n4.pop();
                    if (c2 !== e4.tagName) {
                      let n5 = Qn(t3, e4.tagStartPos);
                      return Yn("InvalidTag", "Expected closing tag '" + e4.tagName + "' (opened in line " + n5.line + ", col " + n5.col + ") instead of closing tag '" + c2 + "'.", Qn(t3, o2));
                    }
                    0 == n4.length && (i2 = true);
                  }
                } else {
                  const a3 = Hn(h2, e3);
                  if (true !== a3) return Yn(a3.err.code, a3.err.msg, Qn(t3, s2 - h2.length + a3.err.line));
                  if (true === i2) return Yn("InvalidXml", "Multiple possible root nodes found.", Qn(t3, s2));
                  -1 !== e3.unpairedTags.indexOf(c2) || n4.push({ tagName: c2, tagStartPos: o2 }), r3 = true;
                }
                for (s2++; s2 < t3.length; s2++) if ("<" === t3[s2]) {
                  if ("!" === t3[s2 + 1]) {
                    s2++, s2 = Gn(t3, s2);
                    continue;
                  }
                  if ("?" !== t3[s2 + 1]) break;
                  if (s2 = Bn(t3, ++s2), s2.err) return s2;
                } else if ("&" === t3[s2]) {
                  const e4 = Xn(t3, s2);
                  if (-1 == e4) return Yn("InvalidChar", "char '&' is not expected.", Qn(t3, s2));
                  s2 = e4;
                } else if (true === i2 && !Wn(t3[s2])) return Yn("InvalidXml", "Extra text at the end", Qn(t3, s2));
                "<" === t3[s2] && s2--;
              }
            }
          }
          return r3 ? 1 == n4.length ? Yn("InvalidTag", "Unclosed tag '" + n4[0].tagName + "'.", Qn(t3, n4[0].tagStartPos)) : !(n4.length > 0) || Yn("InvalidXml", "Invalid '" + JSON.stringify(n4.map(((t4) => t4.tagName)), null, 4).replace(/\r?\n/g, "") + "' found.", { line: 1, col: 1 }) : Yn("InvalidXml", "Start tag expected.", 1);
        })(t2, e2);
        if (true !== n3) throw Error(`${n3.err.msg}:${n3.err.line}:${n3.err.col}`);
      }
      const n2 = new bn(this.options, this.externalEntities), r2 = n2.parseXml(t2);
      return this.options.preserveOrder || void 0 === r2 ? r2 : Mn(r2, this.options, n2.matcher, n2.readonlyMatcher);
    }
    addEntity(t2, e2) {
      if (-1 !== e2.indexOf("&")) throw new Error("Entity value can't have '&'");
      if (-1 !== t2.indexOf("&") || -1 !== t2.indexOf(";")) throw new Error("An entity must be set without '&' and ';'. Eg. use '#xD' for '&#xD;'");
      if ("&" === e2) throw new Error("An entity with value '&' is not permitted");
      this.externalEntities[t2] = e2;
    }
    static getMetaDataSymbol() {
      return he.getMetaDataSymbol();
    }
  };
  var tr = n(829);
  var er = n.n(tr);
  var nr = (function(t2) {
    return t2.Array = "array", t2.Object = "object", t2.Original = "original", t2;
  })(nr || {});
  function rr(t2) {
    const e2 = t2.indexOf(":");
    return -1 === e2 ? t2 : t2.slice(e2 + 1);
  }
  function ir(t2) {
    return "string" == typeof t2 ? t2 : t2.toArray().map(rr).join(".");
  }
  function sr(t2, e2) {
    if (!t2.endsWith("propstat.prop.displayname")) return e2;
  }
  function or(t2, e2, n2 = nr.Original) {
    const r2 = er().get(t2, e2);
    return "array" === n2 && false === Array.isArray(r2) ? [r2] : "object" === n2 && Array.isArray(r2) ? r2[0] : r2;
  }
  var ar = /* @__PURE__ */ new Set(["multistatus", "response", "propstat", "prop", "status", "href", "responsedescription"]);
  function cr(t2) {
    return "object" == typeof t2 && null !== t2 && !Array.isArray(t2);
  }
  function lr(t2, e2) {
    return e2 = e2 ?? { attributeNamePrefix: "@", attributeParsers: [], tagParsers: [sr] }, new Promise(((n2) => {
      const r2 = (function({ attributeNamePrefix: t3, attributeParsers: e3, clarkNotationProps: n3, entityDecoder: r3, tagParsers: i2 }) {
        const s2 = { allowBooleanAttributes: true, attributeNamePrefix: t3, textNodeName: "text", ignoreAttributes: false, removeNSPrefix: !n3, jPath: false, numberParseOptions: { hex: true, leadingZeros: false }, attributeValueProcessor(t4, n4, r4) {
          if (0 === e3.length || "xmlns" === (i3 = t4) || i3.startsWith("xmlns:")) return n4;
          var i3;
          const s3 = ir(r4);
          for (const t5 of e3) try {
            const e4 = t5(s3, n4);
            if (e4 !== n4) return e4;
          } catch (t6) {
          }
          return n4;
        }, tagValueProcessor(t4, e4, n4) {
          if (0 === i2.length) return e4;
          const r4 = ir(n4);
          for (const t5 of i2) try {
            const n5 = t5(r4, e4);
            if (n5 !== e4) return n5;
          } catch (t6) {
          }
          return e4;
        } };
        return r3 && (s2.entityDecoder = new nn({ limit: { maxTotalExpansions: r3.limit?.maxTotalExpansions ?? 0, maxExpandedLength: r3.limit?.maxExpandedLength ?? 0 } })), new Kn(s2);
      })(e2).parse(t2);
      e2.clarkNotationProps && (function(t3, e3) {
        if (!cr(t3) && !Array.isArray(t3)) return;
        const n3 = `${e3}xmlns`, r3 = `${n3}:`, i2 = r3.length, s2 = "text";
        function o2(t4) {
          return t4 === n3 || t4.length > i2 && t4.startsWith(r3);
        }
        function a2(t4, e4) {
          let s3 = null;
          for (const o3 of Object.keys(t4)) o3 === n3 ? (s3 || (s3 = new Map(e4)), s3.set("", t4[o3])) : o3.length > i2 && o3.startsWith(r3) && (s3 || (s3 = new Map(e4)), s3.set(o3.slice(i2), t4[o3]));
          return s3 ?? e4;
        }
        function c2(t4) {
          if (Array.isArray(t4)) return t4.map(c2);
          if (!cr(t4)) return t4;
          const e4 = {};
          for (const n5 of Object.keys(t4)) o2(n5) || (e4[n5] = c2(t4[n5]));
          const n4 = Object.keys(e4);
          return 0 === n4.length ? "" : 1 === n4.length && n4[0] === s2 ? e4[s2] : e4;
        }
        function l2(t4, e4, n4, r4) {
          const i3 = t4.indexOf(":"), s3 = -1 === i3 ? "" : t4.slice(0, i3), o3 = -1 === i3 ? t4 : t4.slice(i3 + 1), l3 = (t5) => (cr(t5) ? a2(t5, n4) : n4).get(s3) ?? "", h3 = (t5, e5) => {
            const n5 = t5 ? `{${t5}}${o3}` : o3, i4 = r4[n5];
            void 0 === i4 ? r4[n5] = e5 : Array.isArray(i4) ? i4.push(e5) : r4[n5] = [i4, e5];
          };
          if (Array.isArray(e4)) for (const t5 of e4) h3(l3(t5), c2(t5));
          else h3(l3(e4), c2(e4));
        }
        function h2(t4, e4) {
          if (!cr(t4)) return t4;
          const n4 = (function(t5, e5) {
            const n5 = a2(t5, e5), r4 = {};
            for (const e6 of Object.keys(t5)) o2(e6) || l2(e6, t5[e6], n5, r4);
            return r4;
          })(t4, e4);
          return 0 === Object.keys(n4).length ? "" : n4;
        }
        !(function t4(e4, n4) {
          if (Array.isArray(e4)) {
            for (let r5 = 0; r5 < e4.length; r5 += 1) e4[r5] = t4(e4[r5], n4);
            return e4;
          }
          if (!cr(e4)) return e4;
          const r4 = a2(e4, n4);
          for (const n5 of Object.keys(e4)) {
            if (o2(n5)) {
              delete e4[n5];
              continue;
            }
            const i3 = n5.indexOf(":"), s3 = -1 === i3 ? n5 : n5.slice(i3 + 1), a3 = e4[n5];
            let c3 = n5;
            ar.has(s3) && s3 !== n5 && (delete e4[n5], e4[s3] = a3, c3 = s3), e4[c3] = "prop" === s3 ? Array.isArray(a3) ? a3.map(((t5) => h2(t5, r4))) : h2(a3, r4) : t4(a3, r4);
          }
          return 0 === Object.keys(e4).length ? "" : e4;
        })(t3, /* @__PURE__ */ new Map());
      })(r2, e2.attributeNamePrefix ?? "@"), n2((function(t3) {
        const { multistatus: e3 } = t3;
        if ("" === e3) return { multistatus: { response: [] } };
        if (!e3) throw new Error("Invalid response: No root multistatus found");
        const n3 = { multistatus: Array.isArray(e3) ? e3[0] : e3 };
        return er().set(n3, "multistatus.response", or(n3, "multistatus.response", nr.Array)), er().set(n3, "multistatus.response", er().get(n3, "multistatus.response").map(((t4) => (function(t5) {
          const e4 = Object.assign({}, t5);
          return e4.status ? er().set(e4, "status", or(e4, "status", nr.Object)) : (er().set(e4, "propstat", or(e4, "propstat", nr.Object)), er().set(e4, "propstat.prop", or(e4, "propstat.prop", nr.Object))), e4;
        })(t4)))), n3;
      })(r2));
    }));
  }
  function hr(t2, e2, n2 = false) {
    const { getlastmodified: r2 = null, getcontentlength: i2 = "0", resourcetype: s2 = null, getcontenttype: o2 = null, getetag: a2 = null } = t2, c2 = s2 && "object" == typeof s2 && void 0 !== s2.collection ? "directory" : "file", h2 = { filename: e2, basename: l().basename(e2), lastmod: r2, size: parseInt(i2, 10), type: c2, etag: "string" == typeof a2 ? a2.replace(/"/g, "") : null };
    return "file" === c2 && (h2.mime = o2 && "string" == typeof o2 ? o2.split(";")[0] : ""), n2 && (void 0 !== t2.displayname && (t2.displayname = String(t2.displayname)), h2.props = t2), h2;
  }
  function ur(t2, e2, n2 = false) {
    let r2 = null;
    try {
      t2.multistatus.response[0].propstat && (r2 = t2.multistatus.response[0]);
    } catch (t3) {
    }
    if (!r2) throw new Error("Failed getting item stat: bad response");
    const { propstat: { prop: i2, status: s2 } } = r2, [o2, a2, c2] = s2.split(" ", 3), l2 = parseInt(a2, 10);
    if (l2 >= 400) {
      const t3 = new Error(`Invalid response: ${l2} ${c2}`);
      throw t3.status = l2, t3;
    }
    return hr(i2, d(e2), n2);
  }
  function pr(t2) {
    switch (String(t2)) {
      case "-3":
        return "unlimited";
      case "-2":
      case "-1":
        return "unknown";
      default:
        return parseInt(String(t2), 10);
    }
  }
  function fr(t2, e2, n2) {
    return n2 ? e2 ? e2(t2) : t2 : (t2 && t2.then || (t2 = Promise.resolve(t2)), e2 ? t2.then(e2) : t2);
  }
  var dr = /* @__PURE__ */ (function(t2) {
    return function() {
      for (var e2 = [], n2 = 0; n2 < arguments.length; n2++) e2[n2] = arguments[n2];
      try {
        return Promise.resolve(t2.apply(this, e2));
      } catch (t3) {
        return Promise.reject(t3);
      }
    };
  })((function(t2, e2, n2 = {}) {
    const { details: r2 = false } = n2, i2 = Z({ url: m(t2.remoteURL, p(e2)), method: "PROPFIND", headers: { Accept: "text/plain,application/xml", Depth: "0" } }, t2, n2);
    return fr(Y(i2, t2), (function(n3) {
      return Yt(t2, n3), fr(n3.text(), (function(i3) {
        return fr(lr(i3, t2.parsing), (function(t3) {
          const i4 = ur(t3, e2, r2);
          return Zt(n3, i4, r2);
        }));
      }));
    }));
  }));
  function gr(t2, e2, n2) {
    return n2 ? e2 ? e2(t2) : t2 : (t2 && t2.then || (t2 = Promise.resolve(t2)), e2 ? t2.then(e2) : t2);
  }
  var mr = yr((function(t2, e2, n2 = {}) {
    const r2 = (function(t3) {
      if (!t3 || "/" === t3) return [];
      let e3 = t3;
      const n3 = [];
      do {
        n3.push(e3), e3 = l().dirname(e3);
      } while (e3 && "/" !== e3);
      return n3;
    })(d(e2));
    r2.sort(((t3, e3) => t3.length > e3.length ? 1 : e3.length > t3.length ? -1 : 0));
    let i2 = false;
    return (function(t3, e3, n3) {
      if ("function" == typeof t3[vr]) {
        let h2 = function(t4) {
          try {
            for (; !(r3 = o2.next()).done; ) if ((t4 = e3(r3.value)) && t4.then) {
              if (!Nr(t4)) return void t4.then(h2, s2 || (s2 = wr.bind(null, i3 = new Er(), 2)));
              t4 = t4.v;
            }
            i3 ? wr(i3, 1, t4) : i3 = t4;
          } catch (t5) {
            wr(i3 || (i3 = new Er()), 2, t5);
          }
        };
        var r3, i3, s2, o2 = t3[vr]();
        if (h2(), o2.return) {
          var a2 = function(t4) {
            try {
              r3.done || o2.return();
            } catch (t5) {
            }
            return t4;
          };
          if (i3 && i3.then) return i3.then(a2, (function(t4) {
            throw a2(t4);
          }));
          a2();
        }
        return i3;
      }
      if (!("length" in t3)) throw new TypeError("Object is not iterable");
      for (var c2 = [], l2 = 0; l2 < t3.length; l2++) c2.push(t3[l2]);
      return (function(t4, e4, n4) {
        var r4, i4, s3 = -1;
        return (function o3(a3) {
          try {
            for (; ++s3 < t4.length && (!n4 || !n4()); ) if ((a3 = e4(s3)) && a3.then) {
              if (!Nr(a3)) return void a3.then(o3, i4 || (i4 = wr.bind(null, r4 = new Er(), 2)));
              a3 = a3.v;
            }
            r4 ? wr(r4, 1, a3) : r4 = a3;
          } catch (t5) {
            wr(r4 || (r4 = new Er()), 2, t5);
          }
        })(), r4;
      })(c2, (function(t4) {
        return e3(c2[t4]);
      }), n3);
    })(r2, (function(r3) {
      return s2 = function() {
        return (function(n3, i3) {
          try {
            var s3 = gr(dr(t2, r3), (function(t3) {
              if ("directory" !== t3.type) throw new Error(`Path includes a file: ${e2}`);
            }));
          } catch (t3) {
            return i3(t3);
          }
          return s3 && s3.then ? s3.then(void 0, i3) : s3;
        })(0, (function(e3) {
          const s3 = e3;
          return (function() {
            if (404 === s3.status) return i2 = true, xr(Ar(t2, r3, { ...n2, recursive: false }));
            throw e3;
          })();
        }));
      }, (o2 = (function() {
        if (i2) return xr(Ar(t2, r3, { ...n2, recursive: false }));
      })()) && o2.then ? o2.then(s2) : s2();
      var s2, o2;
    }), (function() {
      return false;
    }));
  }));
  function yr(t2) {
    return function() {
      for (var e2 = [], n2 = 0; n2 < arguments.length; n2++) e2[n2] = arguments[n2];
      try {
        return Promise.resolve(t2.apply(this, e2));
      } catch (t3) {
        return Promise.reject(t3);
      }
    };
  }
  function br() {
  }
  function xr(t2, e2) {
    if (!e2) return t2 && t2.then ? t2.then(br) : Promise.resolve();
  }
  var vr = "undefined" != typeof Symbol ? Symbol.iterator || (Symbol.iterator = Symbol("Symbol.iterator")) : "@@iterator";
  function wr(t2, e2, n2) {
    if (!t2.s) {
      if (n2 instanceof Er) {
        if (!n2.s) return void (n2.o = wr.bind(null, t2, e2));
        1 & e2 && (e2 = n2.s), n2 = n2.v;
      }
      if (n2 && n2.then) return void n2.then(wr.bind(null, t2, e2), wr.bind(null, t2, 2));
      t2.s = e2, t2.v = n2;
      const r2 = t2.o;
      r2 && r2(t2);
    }
  }
  var Er = (function() {
    function t2() {
    }
    return t2.prototype.then = function(e2, n2) {
      const r2 = new t2(), i2 = this.s;
      if (i2) {
        const t3 = 1 & i2 ? e2 : n2;
        if (t3) {
          try {
            wr(r2, 1, t3(this.v));
          } catch (t4) {
            wr(r2, 2, t4);
          }
          return r2;
        }
        return this;
      }
      return this.o = function(t3) {
        try {
          const i3 = t3.v;
          1 & t3.s ? wr(r2, 1, e2 ? e2(i3) : i3) : n2 ? wr(r2, 1, n2(i3)) : wr(r2, 2, i3);
        } catch (t4) {
          wr(r2, 2, t4);
        }
      }, r2;
    }, t2;
  })();
  function Nr(t2) {
    return t2 instanceof Er && 1 & t2.s;
  }
  var Ar = yr((function(t2, e2, n2 = {}) {
    if (true === n2.recursive) return mr(t2, e2, n2);
    const r2 = Z({ url: m(t2.remoteURL, (i2 = p(e2), i2.endsWith("/") ? i2 : i2 + "/")), method: "MKCOL" }, t2, n2);
    var i2;
    return gr(Y(r2, t2), (function(e3) {
      Yt(t2, e3);
    }));
  }));
  var Sr = n(388);
  var Tr = n.n(Sr);
  var Pr = /* @__PURE__ */ (function(t2) {
    return function() {
      for (var e2 = [], n2 = 0; n2 < arguments.length; n2++) e2[n2] = arguments[n2];
      try {
        return Promise.resolve(t2.apply(this, e2));
      } catch (t3) {
        return Promise.reject(t3);
      }
    };
  })((function(t2, e2, n2 = {}) {
    const r2 = {};
    if ("object" == typeof n2.range && "number" == typeof n2.range.start) {
      let t3 = `bytes=${n2.range.start}-`;
      "number" == typeof n2.range.end && (t3 = `${t3}${n2.range.end}`), r2.Range = t3;
    }
    const i2 = Z({ url: m(t2.remoteURL, p(e2)), method: "GET", headers: r2 }, t2, n2);
    return o2 = function(e3) {
      if (Yt(t2, e3), r2.Range && 206 !== e3.status) {
        const t3 = new Error(`Invalid response code for partial request: ${e3.status}`);
        throw t3.status = e3.status, t3;
      }
      return n2.callback && setTimeout((() => {
        n2.callback(e3);
      }), 0), e3.body;
    }, (s2 = Y(i2, t2)) && s2.then || (s2 = Promise.resolve(s2)), o2 ? s2.then(o2) : s2;
    var s2, o2;
  }));
  var Or = () => {
  };
  var jr = /* @__PURE__ */ (function(t2) {
    return function() {
      for (var e2 = [], n2 = 0; n2 < arguments.length; n2++) e2[n2] = arguments[n2];
      try {
        return Promise.resolve(t2.apply(this, e2));
      } catch (t3) {
        return Promise.reject(t3);
      }
    };
  })((function(t2, e2, n2) {
    n2.url || (n2.url = m(t2.remoteURL, p(e2)));
    const r2 = Z(n2, t2, {});
    return s2 = function(e3) {
      return Yt(t2, e3), e3;
    }, (i2 = Y(r2, t2)) && i2.then || (i2 = Promise.resolve(i2)), s2 ? i2.then(s2) : i2;
    var i2, s2;
  }));
  var $r = /* @__PURE__ */ (function(t2) {
    return function() {
      for (var e2 = [], n2 = 0; n2 < arguments.length; n2++) e2[n2] = arguments[n2];
      try {
        return Promise.resolve(t2.apply(this, e2));
      } catch (t3) {
        return Promise.reject(t3);
      }
    };
  })((function(t2, e2, n2 = {}) {
    const r2 = Z({ url: m(t2.remoteURL, p(e2)), method: "DELETE" }, t2, n2);
    return s2 = function(e3) {
      Yt(t2, e3);
    }, (i2 = Y(r2, t2)) && i2.then || (i2 = Promise.resolve(i2)), s2 ? i2.then(s2) : i2;
    var i2, s2;
  }));
  var Cr = /* @__PURE__ */ (function(t2) {
    return function() {
      for (var e2 = [], n2 = 0; n2 < arguments.length; n2++) e2[n2] = arguments[n2];
      try {
        return Promise.resolve(t2.apply(this, e2));
      } catch (t3) {
        return Promise.reject(t3);
      }
    };
  })((function(t2, e2, n2 = {}) {
    return (function(r2, i2) {
      try {
        var s2 = (o2 = dr(t2, e2, n2), a2 = function() {
          return true;
        }, c2 ? a2 ? a2(o2) : o2 : (o2 && o2.then || (o2 = Promise.resolve(o2)), a2 ? o2.then(a2) : o2));
      } catch (t3) {
        return i2(t3);
      }
      var o2, a2, c2;
      return s2 && s2.then ? s2.then(void 0, i2) : s2;
    })(0, (function(t3) {
      if (404 === t3.status) return false;
      throw t3;
    }));
  }));
  function _r(t2, e2, n2) {
    return n2 ? e2 ? e2(t2) : t2 : (t2 && t2.then || (t2 = Promise.resolve(t2)), e2 ? t2.then(e2) : t2);
  }
  var Ir = /* @__PURE__ */ (function(t2) {
    return function() {
      for (var e2 = [], n2 = 0; n2 < arguments.length; n2++) e2[n2] = arguments[n2];
      try {
        return Promise.resolve(t2.apply(this, e2));
      } catch (t3) {
        return Promise.reject(t3);
      }
    };
  })((function(t2, e2, n2 = {}) {
    const r2 = Z({ url: m(t2.remoteURL, p(e2), "/"), method: "PROPFIND", headers: { Accept: "text/plain,application/xml", Depth: n2.deep ? "infinity" : "1" } }, t2, n2);
    return _r(Y(r2, t2), (function(r3) {
      return Yt(t2, r3), _r(r3.text(), (function(i2) {
        if (!i2) throw new Error("Failed parsing directory contents: Empty response");
        return _r(lr(i2, t2.parsing), (function(i3) {
          const s2 = f(e2);
          let o2 = (function(t3, e3, n3, r4 = false, i4 = false) {
            const s3 = l().join(e3, "/"), { multistatus: { response: o3 } } = t3, c2 = o3.map(((t4) => {
              const e4 = (function(t5) {
                try {
                  return t5.replace(/^https?:\/\/[^\/]+/, "");
                } catch (t6) {
                  throw new a(t6, "Failed normalising HREF");
                }
              })(t4.href), { propstat: { prop: n4 } } = t4;
              return hr(n4, "/" === s3 ? decodeURIComponent(d(e4)) : d(l().relative(decodeURIComponent(s3), decodeURIComponent(e4))), r4);
            }));
            return i4 ? c2 : c2.filter(((t4) => t4.basename && ("file" === t4.type || t4.filename !== n3.replace(/\/$/, ""))));
          })(i3, f(t2.remoteBasePath || t2.remotePath), s2, n2.details, n2.includeSelf);
          return n2.glob && (o2 = (function(t3, e3) {
            return t3.filter(((t4) => wt(t4.filename, e3, { matchBase: true })));
          })(o2, n2.glob)), Zt(r3, o2, n2.details);
        }));
      }));
    }));
  }));
  function kr(t2) {
    return function() {
      for (var e2 = [], n2 = 0; n2 < arguments.length; n2++) e2[n2] = arguments[n2];
      try {
        return Promise.resolve(t2.apply(this, e2));
      } catch (t3) {
        return Promise.reject(t3);
      }
    };
  }
  var Rr = kr((function(t2, e2, n2 = {}) {
    const r2 = Z({ url: m(t2.remoteURL, p(e2)), method: "GET", headers: { Accept: "text/plain" }, transformResponse: [Ur] }, t2, n2);
    return Lr(Y(r2, t2), (function(e3) {
      return Yt(t2, e3), Lr(e3.text(), (function(t3) {
        return Zt(e3, t3, n2.details);
      }));
    }));
  }));
  function Lr(t2, e2, n2) {
    return n2 ? e2 ? e2(t2) : t2 : (t2 && t2.then || (t2 = Promise.resolve(t2)), e2 ? t2.then(e2) : t2);
  }
  var Mr = kr((function(t2, e2, n2 = {}) {
    const r2 = Z({ url: m(t2.remoteURL, p(e2)), method: "GET" }, t2, n2);
    return Lr(Y(r2, t2), (function(e3) {
      let r3;
      return Yt(t2, e3), (function(t3, e4) {
        var n3 = t3();
        return n3 && n3.then ? n3.then(e4) : e4();
      })((function() {
        return Lr(e3.arrayBuffer(), (function(t3) {
          r3 = t3;
        }));
      }), (function() {
        return Zt(e3, r3, n2.details);
      }));
    }));
  }));
  var Dr = kr((function(t2, e2, n2 = {}) {
    const { format: r2 = "binary" } = n2;
    if ("binary" !== r2 && "text" !== r2) throw new a({ info: { code: T.InvalidOutputFormat } }, `Invalid output format: ${r2}`);
    return "text" === r2 ? Rr(t2, e2, n2) : Mr(t2, e2, n2);
  }));
  var Ur = (t2) => t2;
  function Vr(t2) {
    return "number" == typeof t2 && Object.is(t2, -0) ? "-0" : String(t2);
  }
  function qr(t2) {
    return Vr(t2).replace(/--/g, "- -").replace(/--/g, "- -").replace(/-$/, "- ");
  }
  function Fr(t2) {
    return Vr(t2).replace(/\]\]>/g, "]]]]><![CDATA[>");
  }
  function Wr(t2) {
    return Vr(t2).replace(/"/g, "&quot;").replace(/'/g, "&apos;");
  }
  function Br(t2, e2, n2, r2, i2) {
    return n2.sanitizeName ? i2(t2) ? t2 : n2.sanitizeName(t2, { isAttribute: e2, matcher: r2.readOnly() }) : t2;
  }
  function Gr(t2, e2) {
    let n2 = "";
    e2.format && (n2 = "\n");
    const r2 = [];
    if (e2.stopNodes && Array.isArray(e2.stopNodes)) for (let t3 = 0; t3 < e2.stopNodes.length; t3++) {
      const n3 = e2.stopNodes[t3];
      "string" == typeof n3 ? r2.push(new Fe(n3)) : n3 instanceof Fe && r2.push(n3);
    }
    const i2 = (function(t3, e3) {
      if (!Array.isArray(t3) || 0 === t3.length) return "1.0";
      const n3 = t3[0];
      if ("?xml" === Zr(n3)) {
        const t4 = n3[":@"];
        if (t4) {
          const n4 = e3.attributeNamePrefix + "version";
          if (t4[n4]) return t4[n4];
        }
      }
      return "1.0";
    })(t2, e2), s2 = Ee("qName", { xmlVersion: i2 });
    return zr(t2, e2, n2, new qe(), r2, s2);
  }
  function zr(t2, e2, n2, r2, i2, s2) {
    let o2 = "", a2 = false;
    if (e2.maxNestedTags && r2.getDepth() > e2.maxNestedTags) throw new Error("Maximum nested tags exceeded");
    if (!Array.isArray(t2)) {
      if (null != t2) {
        let n3 = Vr(t2);
        return n3 = Kr(n3, e2), n3;
      }
      return "";
    }
    for (let c2 = 0; c2 < t2.length; c2++) {
      const l2 = t2[c2], h2 = Zr(l2);
      if (void 0 === h2) continue;
      const u2 = h2 === e2.textNodeName || h2 === e2.cdataPropName || h2 === e2.commentPropName || "?" === h2[0] ? h2 : Br(h2, false, e2, r2, s2), p2 = Hr(l2[":@"], e2);
      r2.push(u2, p2);
      const f2 = Jr(r2, i2);
      if (u2 === e2.textNodeName) {
        let t3 = l2[h2];
        f2 || (t3 = e2.tagValueProcessor(u2, t3), t3 = Kr(t3, e2)), t3 = Vr(t3), a2 && (o2 += n2), o2 += t3, a2 = false, r2.pop();
        continue;
      }
      if (u2 === e2.cdataPropName) {
        a2 && (o2 += n2), o2 += `<![CDATA[${Fr(l2[h2][0][e2.textNodeName])}]]>`, a2 = false, r2.pop();
        continue;
      }
      if (u2 === e2.commentPropName) {
        o2 += n2 + `<!--${qr(l2[h2][0][e2.textNodeName])}-->`, a2 = true, r2.pop();
        continue;
      }
      if ("?" === u2[0]) {
        o2 += ("?xml" === u2 ? "" : n2) + `<${u2}${Qr(l2[":@"], e2, f2, r2, s2)}?>`, a2 = true, r2.pop();
        continue;
      }
      let d2 = n2;
      "" !== d2 && (d2 += e2.indentBy);
      const g2 = n2 + `<${u2}${Qr(l2[":@"], e2, f2, r2, s2)}`;
      let m2;
      m2 = f2 ? Xr(l2[h2], e2) : zr(l2[h2], e2, d2, r2, i2, s2), -1 !== e2.unpairedTags.indexOf(u2) ? e2.suppressUnpairedNode ? o2 += g2 + ">" : o2 += g2 + "/>" : m2 && 0 !== m2.length || !e2.suppressEmptyNode ? m2 && m2.endsWith(">") ? o2 += g2 + `>${m2}${n2}</${u2}>` : (o2 += g2 + ">", m2 && "" !== n2 && (m2.includes("/>") || m2.includes("</")) ? o2 += n2 + e2.indentBy + m2 + n2 : o2 += m2, o2 += `</${u2}>`) : o2 += g2 + "/>", a2 = true, r2.pop();
    }
    return o2;
  }
  function Hr(t2, e2) {
    if (!t2 || e2.ignoreAttributes) return null;
    const n2 = {};
    let r2 = false;
    for (let i2 in t2) Object.prototype.hasOwnProperty.call(t2, i2) && (n2[i2.startsWith(e2.attributeNamePrefix) ? i2.substr(e2.attributeNamePrefix.length) : i2] = Wr(t2[i2]), r2 = true);
    return r2 ? n2 : null;
  }
  function Xr(t2, e2) {
    if (!Array.isArray(t2)) return null != t2 ? Vr(t2) : "";
    let n2 = "";
    for (let r2 = 0; r2 < t2.length; r2++) {
      const i2 = t2[r2], s2 = Zr(i2);
      if (s2 === e2.textNodeName) n2 += Vr(i2[s2]);
      else if (s2 === e2.cdataPropName) n2 += i2[s2][0][e2.textNodeName];
      else if (s2 === e2.commentPropName) n2 += i2[s2][0][e2.textNodeName];
      else {
        if (s2 && "?" === s2[0]) continue;
        if (s2) {
          const t3 = Yr(i2[":@"], e2), r3 = Xr(i2[s2], e2);
          r3 && 0 !== r3.length ? n2 += `<${s2}${t3}>${r3}</${s2}>` : n2 += `<${s2}${t3}/>`;
        }
      }
    }
    return n2;
  }
  function Yr(t2, e2) {
    let n2 = "";
    if (t2 && !e2.ignoreAttributes) for (let r2 in t2) {
      if (!Object.prototype.hasOwnProperty.call(t2, r2)) continue;
      let i2 = t2[r2];
      true === i2 && e2.suppressBooleanAttributes ? n2 += ` ${r2.substr(e2.attributeNamePrefix.length)}` : n2 += ` ${r2.substr(e2.attributeNamePrefix.length)}="${Wr(i2)}"`;
    }
    return n2;
  }
  function Zr(t2) {
    const e2 = Object.keys(t2);
    for (let n2 = 0; n2 < e2.length; n2++) {
      const r2 = e2[n2];
      if (Object.prototype.hasOwnProperty.call(t2, r2) && ":@" !== r2) return r2;
    }
  }
  function Qr(t2, e2, n2, r2, i2) {
    let s2 = "";
    if (t2 && !e2.ignoreAttributes) for (let o2 in t2) {
      if (!Object.prototype.hasOwnProperty.call(t2, o2)) continue;
      const a2 = o2.substr(e2.attributeNamePrefix.length), c2 = n2 ? a2 : Br(a2, true, e2, r2, i2);
      let l2;
      n2 ? l2 = t2[o2] : (l2 = e2.attributeValueProcessor(o2, t2[o2]), l2 = Kr(l2, e2)), true === l2 && e2.suppressBooleanAttributes ? s2 += ` ${c2}` : s2 += ` ${c2}="${Wr(l2)}"`;
    }
    return s2;
  }
  function Jr(t2, e2) {
    if (!e2 || 0 === e2.length) return false;
    for (let n2 = 0; n2 < e2.length; n2++) if (t2.matches(e2[n2])) return true;
    return false;
  }
  function Kr(t2, e2) {
    if (t2 && t2.length > 0 && e2.processEntities) for (let n2 = 0; n2 < e2.entities.length; n2++) {
      const r2 = e2.entities[n2];
      t2 = t2.replace(r2.regex, r2.val);
    }
    return t2;
  }
  var ti = { attributeNamePrefix: "@_", attributesGroupName: false, textNodeName: "#text", ignoreAttributes: true, cdataPropName: false, format: false, indentBy: "  ", suppressEmptyNode: false, suppressUnpairedNode: true, suppressBooleanAttributes: true, tagValueProcessor: function(t2, e2) {
    return e2;
  }, attributeValueProcessor: function(t2, e2) {
    return e2;
  }, preserveOrder: false, commentPropName: false, unpairedTags: [], entities: [{ regex: new RegExp("&", "g"), val: "&amp;" }, { regex: new RegExp(">", "g"), val: "&gt;" }, { regex: new RegExp("<", "g"), val: "&lt;" }, { regex: new RegExp("'", "g"), val: "&apos;" }, { regex: new RegExp('"', "g"), val: "&quot;" }], processEntities: true, stopNodes: [], oneListGroup: false, maxNestedTags: 100, jPath: true, sanitizeName: false };
  function ei(t2) {
    if (this.options = Object.assign({}, ti, t2), this.options.stopNodes && Array.isArray(this.options.stopNodes) && (this.options.stopNodes = this.options.stopNodes.map(((t3) => "string" == typeof t3 && t3.startsWith("*.") ? ".." + t3.substring(2) : t3))), this.stopNodeExpressions = [], this.options.stopNodes && Array.isArray(this.options.stopNodes)) for (let t3 = 0; t3 < this.options.stopNodes.length; t3++) {
      const e3 = this.options.stopNodes[t3];
      "string" == typeof e3 ? this.stopNodeExpressions.push(new Fe(e3)) : e3 instanceof Fe && this.stopNodeExpressions.push(e3);
    }
    var e2;
    true === this.options.ignoreAttributes || this.options.attributesGroupName ? this.isAttribute = function() {
      return false;
    } : (this.ignoreAttributesFn = "function" == typeof (e2 = this.options.ignoreAttributes) ? e2 : Array.isArray(e2) ? (t3) => {
      for (const n2 of e2) {
        if ("string" == typeof n2 && t3 === n2) return true;
        if (n2 instanceof RegExp && n2.test(t3)) return true;
      }
    } : () => false, this.attrPrefixLen = this.options.attributeNamePrefix.length, this.isAttribute = si), this.processTextOrObjNode = ri, this.options.format ? (this.indentate = ii, this.tagEndChar = ">\n", this.newLine = "\n") : (this.indentate = function() {
      return "";
    }, this.tagEndChar = ">", this.newLine = "");
  }
  function ni(t2, e2, n2, r2, i2) {
    return n2.sanitizeName ? i2(t2) ? t2 : n2.sanitizeName(t2, { isAttribute: e2, matcher: r2.readOnly() }) : t2;
  }
  function ri(t2, e2, n2, r2, i2) {
    const s2 = this.extractAttributes(t2);
    if (r2.push(e2, s2), this.checkStopNode(r2)) {
      const i3 = this.buildRawContent(t2), s3 = this.buildAttributesForStopNode(t2);
      return r2.pop(), this.buildObjectNode(i3, e2, s3, n2);
    }
    const o2 = this.j2x(t2, n2 + 1, r2, i2);
    return r2.pop(), "?" === e2[0] ? this.buildTextValNode("", e2, o2.attrStr, n2, r2) : void 0 !== t2[this.options.textNodeName] && 1 === Object.keys(t2).length ? this.buildTextValNode(t2[this.options.textNodeName], e2, o2.attrStr, n2, r2) : this.buildObjectNode(o2.val, e2, o2.attrStr, n2);
  }
  function ii(t2) {
    return this.options.indentBy.repeat(t2);
  }
  function si(t2) {
    return !(!t2.startsWith(this.options.attributeNamePrefix) || t2 === this.options.textNodeName) && t2.substr(this.attrPrefixLen);
  }
  ei.prototype.build = function(t2) {
    if (this.options.preserveOrder) return Gr(t2, this.options);
    {
      Array.isArray(t2) && this.options.arrayNodeName && this.options.arrayNodeName.length > 1 && (t2 = { [this.options.arrayNodeName]: t2 });
      const e2 = new qe(), n2 = (function(t3, e3) {
        const n3 = t3["?xml"];
        if (n3 && "object" == typeof n3) {
          if (e3.attributesGroupName && n3[e3.attributesGroupName]) {
            const t5 = n3[e3.attributesGroupName][e3.attributeNamePrefix + "version"];
            if (t5) return t5;
          }
          const t4 = n3[e3.attributeNamePrefix + "version"];
          if (t4) return t4;
        }
        return "1.0";
      })(t2, this.options), r2 = Ee("qName", { xmlVersion: n2 });
      return this.j2x(t2, 0, e2, r2).val;
    }
  }, ei.prototype.j2x = function(t2, e2, n2, r2) {
    let i2 = "", s2 = "";
    if (this.options.maxNestedTags && n2.getDepth() >= this.options.maxNestedTags) throw new Error("Maximum nested tags exceeded");
    const o2 = this.options.jPath ? n2.toString() : n2, a2 = this.checkStopNode(n2);
    for (let c2 in t2) {
      if (!Object.prototype.hasOwnProperty.call(t2, c2)) continue;
      const l2 = c2 === this.options.textNodeName || c2 === this.options.cdataPropName || c2 === this.options.commentPropName || this.options.attributesGroupName && c2 === this.options.attributesGroupName || this.isAttribute(c2) || "?" === c2[0] ? c2 : ni(c2, false, this.options, n2, r2);
      if (void 0 === t2[c2]) this.isAttribute(c2) && (s2 += "");
      else if (null === t2[c2]) this.isAttribute(c2) || l2 === this.options.cdataPropName || l2 === this.options.commentPropName ? s2 += "" : "?" === l2[0] ? s2 += this.indentate(e2) + "<" + l2 + "?" + this.tagEndChar : s2 += this.indentate(e2) + "<" + l2 + "/" + this.tagEndChar;
      else if (t2[c2] instanceof Date) s2 += this.buildTextValNode(t2[c2], l2, "", e2, n2);
      else if ("object" != typeof t2[c2]) {
        const h2 = this.isAttribute(c2);
        if (h2 && !this.ignoreAttributesFn(h2, o2)) {
          const e3 = ni(h2, true, this.options, n2, r2);
          i2 += this.buildAttrPairStr(e3, Vr(t2[c2]), a2);
        } else if (!h2) if (c2 === this.options.textNodeName) {
          let e3 = this.options.tagValueProcessor(c2, Vr(t2[c2]));
          s2 += this.replaceEntitiesValue(e3);
        } else {
          n2.push(l2);
          const r3 = this.checkStopNode(n2);
          if (n2.pop(), r3) {
            const n3 = Vr(t2[c2]);
            s2 += "" === n3 ? this.indentate(e2) + "<" + l2 + this.closeTag(l2) + this.tagEndChar : this.indentate(e2) + "<" + l2 + ">" + n3 + "</" + l2 + this.tagEndChar;
          } else s2 += this.buildTextValNode(t2[c2], l2, "", e2, n2);
        }
      } else if (Array.isArray(t2[c2])) {
        const i3 = t2[c2].length;
        let o3 = "", a3 = "";
        for (let h2 = 0; h2 < i3; h2++) {
          const i4 = t2[c2][h2];
          if (void 0 === i4) ;
          else if (null === i4) "?" === l2[0] ? s2 += this.indentate(e2) + "<" + l2 + "?" + this.tagEndChar : s2 += this.indentate(e2) + "<" + l2 + "/" + this.tagEndChar;
          else if ("object" == typeof i4) if (this.options.oneListGroup) {
            n2.push(l2);
            const t3 = this.j2x(i4, e2 + 1, n2, r2);
            n2.pop(), o3 += t3.val, this.options.attributesGroupName && i4.hasOwnProperty(this.options.attributesGroupName) && (a3 += t3.attrStr);
          } else o3 += this.processTextOrObjNode(i4, l2, e2, n2, r2);
          else if (this.options.oneListGroup) {
            let t3 = this.options.tagValueProcessor(l2, i4);
            t3 = this.replaceEntitiesValue(t3), t3 = Vr(t3), o3 += t3;
          } else {
            n2.push(l2);
            const t3 = this.checkStopNode(n2);
            if (n2.pop(), t3) {
              const t4 = Vr(i4);
              o3 += "" === t4 ? this.indentate(e2) + "<" + l2 + this.closeTag(l2) + this.tagEndChar : this.indentate(e2) + "<" + l2 + ">" + t4 + "</" + l2 + this.tagEndChar;
            } else o3 += this.buildTextValNode(i4, l2, "", e2, n2);
          }
        }
        this.options.oneListGroup && (o3 = this.buildObjectNode(o3, l2, a3, e2)), s2 += o3;
      } else if (this.options.attributesGroupName && c2 === this.options.attributesGroupName) {
        const e3 = Object.keys(t2[c2]), s3 = e3.length;
        for (let o3 = 0; o3 < s3; o3++) {
          const s4 = ni(e3[o3], true, this.options, n2, r2);
          i2 += this.buildAttrPairStr(s4, Vr(t2[c2][e3[o3]]), a2);
        }
      } else s2 += this.processTextOrObjNode(t2[c2], l2, e2, n2, r2);
    }
    return { attrStr: i2, val: s2 };
  }, ei.prototype.buildAttrPairStr = function(t2, e2, n2) {
    return n2 || (e2 = this.options.attributeValueProcessor(t2, Vr(e2)), e2 = this.replaceEntitiesValue(e2)), this.options.suppressBooleanAttributes && "true" === e2 ? " " + t2 : " " + t2 + '="' + Wr(e2) + '"';
  }, ei.prototype.extractAttributes = function(t2) {
    if (!t2 || "object" != typeof t2) return null;
    const e2 = {};
    let n2 = false;
    if (this.options.attributesGroupName && t2[this.options.attributesGroupName]) {
      const r2 = t2[this.options.attributesGroupName];
      for (let t3 in r2) Object.prototype.hasOwnProperty.call(r2, t3) && (e2[t3.startsWith(this.options.attributeNamePrefix) ? t3.substring(this.options.attributeNamePrefix.length) : t3] = Wr(r2[t3]), n2 = true);
    } else for (let r2 in t2) {
      if (!Object.prototype.hasOwnProperty.call(t2, r2)) continue;
      const i2 = this.isAttribute(r2);
      i2 && (e2[i2] = Wr(t2[r2]), n2 = true);
    }
    return n2 ? e2 : null;
  }, ei.prototype.buildRawContent = function(t2) {
    if ("string" == typeof t2) return t2;
    if ("object" != typeof t2 || null === t2) return String(t2);
    if (void 0 !== t2[this.options.textNodeName]) return t2[this.options.textNodeName];
    let e2 = "";
    for (let n2 in t2) {
      if (!Object.prototype.hasOwnProperty.call(t2, n2)) continue;
      if (this.isAttribute(n2)) continue;
      if (this.options.attributesGroupName && n2 === this.options.attributesGroupName) continue;
      const r2 = t2[n2];
      if (n2 === this.options.textNodeName) e2 += r2;
      else if (Array.isArray(r2)) {
        for (let t3 of r2) if ("string" == typeof t3 || "number" == typeof t3) e2 += `<${n2}>${t3}</${n2}>`;
        else if ("object" == typeof t3 && null !== t3) {
          const r3 = this.buildRawContent(t3), i2 = this.buildAttributesForStopNode(t3);
          e2 += "" === r3 ? `<${n2}${i2}/>` : `<${n2}${i2}>${r3}</${n2}>`;
        }
      } else if ("object" == typeof r2 && null !== r2) {
        const t3 = this.buildRawContent(r2), i2 = this.buildAttributesForStopNode(r2);
        e2 += "" === t3 ? `<${n2}${i2}/>` : `<${n2}${i2}>${t3}</${n2}>`;
      } else e2 += `<${n2}>${r2}</${n2}>`;
    }
    return e2;
  }, ei.prototype.buildAttributesForStopNode = function(t2) {
    if (!t2 || "object" != typeof t2) return "";
    let e2 = "";
    if (this.options.attributesGroupName && t2[this.options.attributesGroupName]) {
      const n2 = t2[this.options.attributesGroupName];
      for (let t3 in n2) {
        if (!Object.prototype.hasOwnProperty.call(n2, t3)) continue;
        const r2 = t3.startsWith(this.options.attributeNamePrefix) ? t3.substring(this.options.attributeNamePrefix.length) : t3, i2 = n2[t3];
        true === i2 && this.options.suppressBooleanAttributes ? e2 += " " + r2 : e2 += " " + r2 + '="' + Wr(i2) + '"';
      }
    } else for (let n2 in t2) {
      if (!Object.prototype.hasOwnProperty.call(t2, n2)) continue;
      const r2 = this.isAttribute(n2);
      if (r2) {
        const i2 = t2[n2];
        true === i2 && this.options.suppressBooleanAttributes ? e2 += " " + r2 : e2 += " " + r2 + '="' + Wr(i2) + '"';
      }
    }
    return e2;
  }, ei.prototype.buildObjectNode = function(t2, e2, n2, r2) {
    if ("" === t2) return "?" === e2[0] ? this.indentate(r2) + "<" + e2 + n2 + "?" + this.tagEndChar : this.indentate(r2) + "<" + e2 + n2 + this.closeTag(e2) + this.tagEndChar;
    if ("?" === e2[0]) return this.indentate(r2) + "<" + e2 + n2 + "?" + this.tagEndChar;
    {
      let i2 = "</" + e2 + this.tagEndChar, s2 = "";
      return "?" === e2[0] && (s2 = "?", i2 = ""), !n2 && "" !== n2 || -1 !== t2.indexOf("<") ? false !== this.options.commentPropName && e2 === this.options.commentPropName && 0 === s2.length ? this.indentate(r2) + `<!--${qr(t2)}-->` + this.newLine : this.indentate(r2) + "<" + e2 + n2 + s2 + this.tagEndChar + t2 + this.indentate(r2) + i2 : this.indentate(r2) + "<" + e2 + n2 + s2 + ">" + t2 + i2;
    }
  }, ei.prototype.closeTag = function(t2) {
    let e2 = "";
    return -1 !== this.options.unpairedTags.indexOf(t2) ? this.options.suppressUnpairedNode || (e2 = "/") : e2 = this.options.suppressEmptyNode ? "/" : `></${t2}`, e2;
  }, ei.prototype.checkStopNode = function(t2) {
    if (!this.stopNodeExpressions || 0 === this.stopNodeExpressions.length) return false;
    for (let e2 = 0; e2 < this.stopNodeExpressions.length; e2++) if (t2.matches(this.stopNodeExpressions[e2])) return true;
    return false;
  }, ei.prototype.buildTextValNode = function(t2, e2, n2, r2, i2) {
    if (false !== this.options.cdataPropName && e2 === this.options.cdataPropName) {
      const e3 = Fr(t2);
      return this.indentate(r2) + `<![CDATA[${e3}]]>` + this.newLine;
    }
    if (false !== this.options.commentPropName && e2 === this.options.commentPropName) {
      const e3 = qr(t2);
      return this.indentate(r2) + `<!--${e3}-->` + this.newLine;
    }
    if ("?" === e2[0]) return this.indentate(r2) + "<" + e2 + n2 + "?" + this.tagEndChar;
    {
      let i3 = this.options.tagValueProcessor(e2, t2);
      return i3 = this.replaceEntitiesValue(i3), i3 = Vr(i3), "" === i3 ? this.indentate(r2) + "<" + e2 + n2 + this.closeTag(e2) + this.tagEndChar : this.indentate(r2) + "<" + e2 + n2 + ">" + i3 + "</" + e2 + this.tagEndChar;
    }
  }, ei.prototype.replaceEntitiesValue = function(t2) {
    if (t2 && t2.length > 0 && this.options.processEntities) for (let e2 = 0; e2 < this.options.entities.length; e2++) {
      const n2 = this.options.entities[e2];
      t2 = t2.replace(n2.regex, n2.val);
    }
    return t2;
  };
  var oi = ei;
  function ai(t2) {
    return new oi({ attributeNamePrefix: "@_", format: true, ignoreAttributes: false, suppressEmptyNode: true }).build(ci({ lockinfo: { "@_xmlns:d": "DAV:", lockscope: { exclusive: {} }, locktype: { write: {} }, owner: { href: t2 } } }, "d"));
  }
  function ci(t2, e2) {
    const n2 = { ...t2 };
    for (const t3 in n2) n2.hasOwnProperty(t3) && (n2[t3] && "object" == typeof n2[t3] && -1 === t3.indexOf(":") ? (n2[`${e2}:${t3}`] = ci(n2[t3], e2), delete n2[t3]) : false === /^@_/.test(t3) && (n2[`${e2}:${t3}`] = n2[t3], delete n2[t3]));
    return n2;
  }
  function li(t2, e2, n2) {
    return n2 ? e2 ? e2(t2) : t2 : (t2 && t2.then || (t2 = Promise.resolve(t2)), e2 ? t2.then(e2) : t2);
  }
  function hi(t2) {
    return function() {
      for (var e2 = [], n2 = 0; n2 < arguments.length; n2++) e2[n2] = arguments[n2];
      try {
        return Promise.resolve(t2.apply(this, e2));
      } catch (t3) {
        return Promise.reject(t3);
      }
    };
  }
  var ui = hi((function(t2, e2, n2, r2 = {}) {
    const i2 = Z({ url: m(t2.remoteURL, p(e2)), method: "UNLOCK", headers: { "Lock-Token": n2 } }, t2, r2);
    return li(Y(i2, t2), (function(e3) {
      if (Yt(t2, e3), 204 !== e3.status && 200 !== e3.status) throw Xt(e3);
    }));
  }));
  var pi = hi((function(t2, e2, n2 = {}) {
    const { refreshToken: r2, timeout: i2 = fi } = n2, s2 = { Accept: "text/plain,application/xml", Timeout: i2 };
    r2 && (s2.If = r2);
    const o2 = Z({ url: m(t2.remoteURL, p(e2)), method: "LOCK", headers: s2, data: ai(t2.contactHref) }, t2, n2);
    return li(Y(o2, t2), (function(e3) {
      return Yt(t2, e3), li(e3.text(), (function(t3) {
        const n3 = (function(t4) {
          return new Kn({ removeNSPrefix: true, parseAttributeValue: true, parseTagValue: true }).parse(t4);
        })(t3), r3 = er().get(n3, "prop.lockdiscovery.activelock.locktoken.href"), i3 = er().get(n3, "prop.lockdiscovery.activelock.timeout");
        if (!r3) throw Xt(e3, "No lock token received: ");
        return { token: r3, serverTimeout: i3 };
      }));
    }));
  }));
  var fi = "Infinite, Second-4100000000";
  function di(t2, e2, n2) {
    return n2 ? e2 ? e2(t2) : t2 : (t2 && t2.then || (t2 = Promise.resolve(t2)), e2 ? t2.then(e2) : t2);
  }
  var gi = /* @__PURE__ */ (function(t2) {
    return function() {
      for (var e2 = [], n2 = 0; n2 < arguments.length; n2++) e2[n2] = arguments[n2];
      try {
        return Promise.resolve(t2.apply(this, e2));
      } catch (t3) {
        return Promise.reject(t3);
      }
    };
  })((function(t2, e2 = {}) {
    const n2 = e2.path || "/", r2 = Z({ url: m(t2.remoteURL, n2), method: "PROPFIND", headers: { Accept: "text/plain,application/xml", Depth: "0" } }, t2, e2);
    return di(Y(r2, t2), (function(n3) {
      return Yt(t2, n3), di(n3.text(), (function(r3) {
        return di(lr(r3, t2.parsing), (function(t3) {
          const r4 = (function(t4) {
            try {
              const [e3] = t4.multistatus.response, { propstat: { prop: { "quota-used-bytes": n4, "quota-available-bytes": r5 } } } = e3;
              return void 0 !== n4 && void 0 !== r5 ? { used: parseInt(String(n4), 10), available: pr(r5) } : null;
            } catch (t5) {
            }
            return null;
          })(t3);
          return Zt(n3, r4, e2.details);
        }));
      }));
    }));
  }));
  function mi(t2, e2, n2) {
    return n2 ? e2 ? e2(t2) : t2 : (t2 && t2.then || (t2 = Promise.resolve(t2)), e2 ? t2.then(e2) : t2);
  }
  var yi = /* @__PURE__ */ (function(t2) {
    return function() {
      for (var e2 = [], n2 = 0; n2 < arguments.length; n2++) e2[n2] = arguments[n2];
      try {
        return Promise.resolve(t2.apply(this, e2));
      } catch (t3) {
        return Promise.reject(t3);
      }
    };
  })((function(t2, e2, n2 = {}) {
    const { details: r2 = false } = n2, i2 = Z({ url: m(t2.remoteURL, p(e2)), method: "SEARCH", headers: { Accept: "text/plain,application/xml", "Content-Type": t2.headers["Content-Type"] || "application/xml; charset=utf-8" } }, t2, n2);
    return mi(Y(i2, t2), (function(n3) {
      return Yt(t2, n3), mi(n3.text(), (function(i3) {
        return mi(lr(i3, t2.parsing), (function(t3) {
          const i4 = (function(t4, e3, n4) {
            const r3 = { truncated: false, results: [] };
            return r3.truncated = t4.multistatus.response.some(((t5) => "507" === (t5.status || t5.propstat?.status).split(" ", 3)?.[1] && t5.href.replace(/\/$/, "").endsWith(p(e3).replace(/\/$/, "")))), t4.multistatus.response.forEach(((t5) => {
              if (void 0 === t5.propstat) return;
              const e4 = t5.href.split("/").map(decodeURIComponent).join("/");
              r3.results.push(hr(t5.propstat.prop, e4, n4));
            })), r3;
          })(t3, e2, r2);
          return Zt(n3, i4, r2);
        }));
      }));
    }));
  }));
  var bi = /* @__PURE__ */ (function(t2) {
    return function() {
      for (var e2 = [], n2 = 0; n2 < arguments.length; n2++) e2[n2] = arguments[n2];
      try {
        return Promise.resolve(t2.apply(this, e2));
      } catch (t3) {
        return Promise.reject(t3);
      }
    };
  })((function(t2, e2, n2, r2 = {}) {
    const i2 = Z({ url: m(t2.remoteURL, p(e2)), method: "MOVE", headers: { Destination: m(t2.remoteURL, p(n2)), Overwrite: false === r2.overwrite ? "F" : "T" } }, t2, r2);
    return o2 = function(e3) {
      Yt(t2, e3);
    }, (s2 = Y(i2, t2)) && s2.then || (s2 = Promise.resolve(s2)), o2 ? s2.then(o2) : s2;
    var s2, o2;
  }));
  var xi = n(172);
  function vi(t2) {
    if (W(t2)) return t2.byteLength;
    if (B(t2)) return t2.length;
    if ("string" == typeof t2) return (0, xi.d)(t2);
    throw new a({ info: { code: T.DataTypeNoLength } }, "Cannot calculate data length: Invalid type");
  }
  var wi = /* @__PURE__ */ (function(t2) {
    return function() {
      for (var e2 = [], n2 = 0; n2 < arguments.length; n2++) e2[n2] = arguments[n2];
      try {
        return Promise.resolve(t2.apply(this, e2));
      } catch (t3) {
        return Promise.reject(t3);
      }
    };
  })((function(t2, e2, n2, r2 = {}) {
    const { contentLength: i2 = true, overwrite: s2 = true } = r2, o2 = { "Content-Type": "application/octet-stream" };
    false === i2 || (o2["Content-Length"] = "number" == typeof i2 ? `${i2}` : `${vi(n2)}`), s2 || (o2["If-None-Match"] = "*");
    const a2 = Z({ url: m(t2.remoteURL, p(e2)), method: "PUT", headers: o2, data: n2 }, t2, r2);
    return l2 = function(e3) {
      try {
        Yt(t2, e3);
      } catch (t3) {
        const e4 = t3;
        if (412 !== e4.status || s2) throw e4;
        return false;
      }
      return true;
    }, (c2 = Y(a2, t2)) && c2.then || (c2 = Promise.resolve(c2)), l2 ? c2.then(l2) : c2;
    var c2, l2;
  }));
  var Ei = /* @__PURE__ */ (function(t2) {
    return function() {
      for (var e2 = [], n2 = 0; n2 < arguments.length; n2++) e2[n2] = arguments[n2];
      try {
        return Promise.resolve(t2.apply(this, e2));
      } catch (t3) {
        return Promise.reject(t3);
      }
    };
  })((function(t2, e2, n2 = {}) {
    const r2 = Z({ url: m(t2.remoteURL, p(e2)), method: "OPTIONS" }, t2, n2);
    return s2 = function(e3) {
      try {
        Yt(t2, e3);
      } catch (t3) {
        throw t3;
      }
      return { compliance: (e3.headers.get("DAV") ?? "").split(",").map(((t3) => t3.trim())), server: e3.headers.get("Server") ?? "" };
    }, (i2 = Y(r2, t2)) && i2.then || (i2 = Promise.resolve(i2)), s2 ? i2.then(s2) : i2;
    var i2, s2;
  }));
  function Ni(t2, e2, n2) {
    return n2 ? e2 ? e2(t2) : t2 : (t2 && t2.then || (t2 = Promise.resolve(t2)), e2 ? t2.then(e2) : t2);
  }
  var Ai = Pi((function(t2, e2, n2, r2, i2, s2 = {}) {
    if (n2 > r2 || n2 < 0) throw new a({ info: { code: T.InvalidUpdateRange } }, `Invalid update range ${n2} for partial update`);
    const o2 = { "Content-Type": "application/octet-stream", "Content-Length": "" + (r2 - n2 + 1), "Content-Range": `bytes ${n2}-${r2}/*` }, c2 = Z({ url: m(t2.remoteURL, p(e2)), method: "PUT", headers: o2, data: i2 }, t2, s2);
    return Ni(Y(c2, t2), (function(e3) {
      Yt(t2, e3);
    }));
  }));
  function Si(t2, e2) {
    var n2 = t2();
    return n2 && n2.then ? n2.then(e2) : e2(n2);
  }
  var Ti = Pi((function(t2, e2, n2, r2, i2, s2 = {}) {
    if (n2 > r2 || n2 < 0) throw new a({ info: { code: T.InvalidUpdateRange } }, `Invalid update range ${n2} for partial update`);
    const o2 = { "Content-Type": "application/x-sabredav-partialupdate", "Content-Length": "" + (r2 - n2 + 1), "X-Update-Range": `bytes=${n2}-${r2}` }, c2 = Z({ url: m(t2.remoteURL, p(e2)), method: "PATCH", headers: o2, data: i2 }, t2, s2);
    return Ni(Y(c2, t2), (function(e3) {
      Yt(t2, e3);
    }));
  }));
  function Pi(t2) {
    return function() {
      for (var e2 = [], n2 = 0; n2 < arguments.length; n2++) e2[n2] = arguments[n2];
      try {
        return Promise.resolve(t2.apply(this, e2));
      } catch (t3) {
        return Promise.reject(t3);
      }
    };
  }
  var Oi = Pi((function(t2, e2, n2, r2, i2, s2 = {}) {
    return Ni(Ei(t2, e2, s2), (function(o2) {
      let c2 = false;
      return Si((function() {
        if (o2.compliance.includes("sabredav-partialupdate")) return Ni(Ti(t2, e2, n2, r2, i2, s2), (function(t3) {
          return c2 = true, t3;
        }));
      }), (function(l2) {
        let h2 = false;
        return c2 ? l2 : Si((function() {
          if (o2.server.includes("Apache") && o2.compliance.includes("<http://apache.org/dav/propset/fs/1>")) return Ni(Ai(t2, e2, n2, r2, i2, s2), (function(t3) {
            return h2 = true, t3;
          }));
        }), (function(t3) {
          if (h2) return t3;
          throw new a({ info: { code: T.NotSupported } }, "Not supported");
        }));
      }));
    }));
  }));
  var ji = "https://github.com/perry-mitchell/webdav-client/blob/master/LOCK_CONTACT.md";
  function $i(t2, e2 = {}) {
    const { authType: n2 = null, remoteBasePath: r2, contactHref: i2 = ji, entityDecoder: s2, ha1: o2, headers: c2 = {}, httpAgent: l2, httpsAgent: h2, password: u2, token: f2, username: d2, withCredentials: y2 } = e2;
    let b2 = n2;
    b2 || (b2 = d2 || u2 ? S.Password : S.None);
    const x2 = { authType: b2, remoteBasePath: r2, contactHref: i2, ha1: o2, headers: Object.assign({}, c2), httpAgent: l2, httpsAgent: h2, password: u2, parsing: { attributeNamePrefix: e2.attributeNamePrefix ?? "@", attributeParsers: [], entityDecoder: s2, tagParsers: [sr] }, remotePath: g(t2), remoteURL: t2, token: f2, username: d2, withCredentials: y2 };
    return P(x2, d2, u2, f2, o2), { copyFile: (t3, e3, n3) => Qt(x2, t3, e3, n3), createDirectory: (t3, e3) => Ar(x2, t3, e3), createReadStream: (t3, e3) => (function(t4, e4, n3 = {}) {
      const r3 = new (0, Tr().PassThrough)();
      return Pr(t4, e4, n3).then(((t5) => {
        t5.pipe(r3);
      })).catch(((t5) => {
        r3.emit("error", t5);
      })), r3;
    })(x2, t3, e3), createWriteStream: (t3, e3, n3) => (function(t4, e4, n4 = {}, r3 = Or) {
      const i3 = new (0, Tr().PassThrough)(), s3 = {};
      false === n4.overwrite && (s3["If-None-Match"] = "*");
      const o3 = Z({ url: m(t4.remoteURL, p(e4)), method: "PUT", headers: s3, data: i3, maxRedirects: 0 }, t4, n4);
      return Y(o3, t4).then(((e5) => Yt(t4, e5))).then(((t5) => {
        setTimeout((() => {
          r3(t5);
        }), 0);
      })).catch(((t5) => {
        i3.emit("error", t5);
      })), i3;
    })(x2, t3, e3, n3), customRequest: (t3, e3) => jr(x2, t3, e3), deleteFile: (t3, e3) => $r(x2, t3, e3), exists: (t3, e3) => Cr(x2, t3, e3), getDirectoryContents: (t3, e3) => Ir(x2, t3, e3), getFileContents: (t3, e3) => Dr(x2, t3, e3), getFileDownloadLink: (t3) => (function(t4, e3) {
      let n3 = m(t4.remoteURL, p(e3));
      const r3 = /^https:/i.test(n3) ? "https" : "http";
      switch (t4.authType) {
        case S.None:
          break;
        case S.Password: {
          const e4 = N(t4.headers.Authorization.replace(/^Basic /i, "").trim());
          n3 = n3.replace(/^https?:\/\//, `${r3}://${e4}@`);
          break;
        }
        default:
          throw new a({ info: { code: T.LinkUnsupportedAuthType } }, `Unsupported auth type for file link: ${t4.authType}`);
      }
      return n3;
    })(x2, t3), getFileUploadLink: (t3) => (function(t4, e3) {
      let n3 = `${m(t4.remoteURL, p(e3))}?Content-Type=application/octet-stream`;
      const r3 = /^https:/i.test(n3) ? "https" : "http";
      switch (t4.authType) {
        case S.None:
          break;
        case S.Password: {
          const e4 = N(t4.headers.Authorization.replace(/^Basic /i, "").trim());
          n3 = n3.replace(/^https?:\/\//, `${r3}://${e4}@`);
          break;
        }
        default:
          throw new a({ info: { code: T.LinkUnsupportedAuthType } }, `Unsupported auth type for file link: ${t4.authType}`);
      }
      return n3;
    })(x2, t3), getHeaders: () => Object.assign({}, x2.headers), getQuota: (t3) => gi(x2, t3), lock: (t3, e3) => pi(x2, t3, e3), moveFile: (t3, e3, n3) => bi(x2, t3, e3, n3), putFileContents: (t3, e3, n3) => wi(x2, t3, e3, n3), partialUpdateFileContents: (t3, e3, n3, r3, i3) => Oi(x2, t3, e3, n3, r3, i3), getDAVCompliance: (t3) => Ei(x2, t3), search: (t3, e3) => yi(x2, t3, e3), setHeaders: (t3) => {
      x2.headers = Object.assign({}, t3);
    }, stat: (t3, e3) => dr(x2, t3, e3), unlock: (t3, e3, n3) => ui(x2, t3, e3, n3), registerAttributeParser: (t3) => {
      x2.parsing.attributeParsers.push(t3);
    }, registerTagParser: (t3) => {
      x2.parsing.tagParsers.push(t3);
    } };
  }

  // src/webdav-sync.js
  var SyncConflict = class extends Error {
    constructor() {
      super("Remote dictionary changed. Download it before uploading.");
      this.name = "SyncConflict";
    }
  };
  function createWebdavSync(options, store, create = $i) {
    const endpoint = new URL(options.url);
    if (!["https:", "http:"].includes(endpoint.protocol) || endpoint.username || endpoint.password) {
      throw new Error("Use an HTTP(S) WebDAV URL without embedded credentials");
    }
    const path = options.path || "/rioshi-translations.json";
    if (!path.startsWith("/") || path.split("/").includes("..")) throw new Error("Invalid WebDAV file path");
    const client = create(endpoint.href, { username: options.username || "", password: options.password || "" });
    let etag = null;
    let missing = false;
    let hasBaseline = false;
    let busy = false;
    const exclusive = async (operation) => {
      if (busy) throw new Error("A sync operation is already running");
      busy = true;
      try {
        return await operation();
      } finally {
        busy = false;
      }
    };
    const readRemote = async () => {
      try {
        const result = await client.getFileContents(path, { format: "text", details: true });
        etag = result.headers?.etag || result.headers?.ETag || null;
        missing = false;
        return JSON.parse(result.data);
      } catch (error) {
        if (error.status === 404) {
          missing = true;
          etag = null;
          return null;
        }
        throw error;
      }
    };
    return {
      check: () => exclusive(async () => ({ exists: await readRemote() !== null })),
      download: () => exclusive(async () => {
        const snapshot = await readRemote();
        if (!snapshot) throw new Error("Remote sync file does not exist");
        store.importSnapshot(snapshot);
        hasBaseline = true;
        return snapshot;
      }),
      upload: (force = false) => exclusive(async () => {
        if (!etag && !missing) {
          const snapshot = await readRemote();
          if (snapshot && !force) throw new SyncConflict();
        }
        if (!missing && !hasBaseline && !force) throw new SyncConflict();
        if (!missing && !etag && !force) throw new SyncConflict();
        const parent = path.slice(0, path.lastIndexOf("/"));
        if (parent) await client.createDirectory(parent, { recursive: true });
        const headers = { "Content-Type": "application/json; charset=utf-8" };
        if (etag && !force) headers["If-Match"] = etag;
        const result = await client.putFileContents(path, JSON.stringify(store.exportSnapshot(), null, 2), {
          overwrite: !missing || force,
          contentLength: false,
          headers
        }).catch((error) => {
          if (error.status === 412) throw new SyncConflict();
          throw error;
        });
        if (!result) throw new SyncConflict();
        await readRemote();
        hasBaseline = true;
      })
    };
  }

  // src/editor.js
  var CONFIG_KEY = "rioshi-plugin-translations:sync-config-v4";
  function mountEditor({ documentRef: doc, host, store, catalog, defaults, initialDictionary, loadBundled, apply }) {
    let ui2 = labels[store.uiLanguage];
    let config = {};
    try {
      config = JSON.parse(localStorage.getItem(CONFIG_KEY) || "{}");
    } catch {
    }
    let sync = null;
    let syncSignature = "";
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
        node.textContent = ui2[key];
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
    const github = el("details", root);
    el("summary", github, "github").style.cursor = "pointer";
    const githubRow = row(github);
    const repository = field(githubRow, "repository", config.repository || defaults.repository);
    const branch = field(githubRow, "branch", config.branch || defaults.branch || "main");
    const downloadButton = button(githubRow, "download");
    el("p", github, "starter").style.fontSize = "12px";
    const dav = el("details", root);
    el("summary", dav, "webdav").style.cursor = "pointer";
    const davRow = row(dav);
    const url = field(davRow, "url", config.url);
    const username = field(davRow, "username", config.username);
    const password = field(davRow, "password", config.password, "password");
    const path = field(davRow, "path", config.path || "/rioshi-translations.json");
    const rememberLabel = el("label", dav);
    const remember = el("input", rememberLabel);
    remember.type = "checkbox";
    remember.checked = Boolean(config.remember);
    el("span", rememberLabel, "remember");
    const davButtons = row(dav);
    const checkButton = button(davButtons, "check");
    const uploadButton = button(davButtons, "upload");
    const pullButton = button(davButtons, "pull");
    const forceButton = button(davButtons, "force");
    el("p", dav, "cors").style.fontSize = "12px";
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
      gutter.textContent = Array.from({ length: textarea.value.split(/\r\n|\r|\n/).length }, (_2, i2) => i2 + 1).join("\n");
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
      message(ui2.loaded + Object.keys(dictionary || {}).length);
      language.value = store.language;
    }
    function saveConfig() {
      const next = { repository: repository.value, branch: branch.value, url: url.value, username: username.value, path: path.value, remember: remember.checked };
      if (remember.checked) next.password = password.value;
      localStorage.setItem(CONFIG_KEY, JSON.stringify(next));
    }
    function davClient() {
      const options = { url: url.value, username: username.value, password: password.value, path: path.value };
      const signature = JSON.stringify(options);
      if (!sync || signature !== syncSignature) {
        sync = createWebdavSync(options, store);
        syncSignature = signature;
      }
      saveConfig();
      return sync;
    }
    const allButtons = [applyButton, formatButton, restoreButton, downloadButton, checkButton, uploadButton, pullButton, forceButton];
    async function run(operation) {
      if (busy) return;
      busy = true;
      allButtons.forEach((node) => {
        node.disabled = true;
      });
      language.disabled = true;
      message(ui2.working);
      try {
        await operation();
      } catch (error) {
        message(ui2.error + error.message, true);
      } finally {
        busy = false;
        allButtons.forEach((node) => {
          node.disabled = false;
        });
        language.disabled = false;
      }
    }
    const mayReplace = () => textarea.value === lastSaved || doc.defaultView.confirm(ui2.dirty);
    textarea.addEventListener("input", lines);
    textarea.addEventListener("scroll", () => {
      gutter.scrollTop = textarea.scrollTop;
    });
    uiSelect.addEventListener("change", () => {
      store.setUiLanguage(uiSelect.value);
      ui2 = labels[store.uiLanguage];
      for (const [node, key] of localized) node.textContent = ui2[key];
      message(ui2.loaded + Object.keys(store.getDictionary() || {}).length);
    });
    applyButton.addEventListener("click", () => run(async () => {
      const dictionary = validateDictionary(JSON.parse(textarea.value));
      store.saveDictionary(language.value, dictionary);
      apply(dictionary);
      showDictionary(dictionary);
      message(ui2.done);
    }));
    formatButton.addEventListener("click", () => run(async () => {
      textarea.value = JSON.stringify(validateDictionary(JSON.parse(textarea.value)), null, 2);
      lines();
      message(ui2.success);
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
      const dictionary = await downloadLanguage({ repository: repository.value, branch: branch.value, language: selected });
      if (disposed) return;
      saveConfig();
      store.saveDictionary(selected, dictionary);
      apply(dictionary);
      showDictionary(dictionary);
      message(ui2.success);
    }));
    checkButton.addEventListener("click", () => run(async () => {
      const result = await davClient().check();
      message(result.exists ? ui2.exists : ui2.missing);
    }));
    const persistBundledIfNeeded = () => {
      if (!store.getDictionary()) store.saveDictionary(store.language, initialDictionary || {});
    };
    uploadButton.addEventListener("click", () => run(async () => {
      persistBundledIfNeeded();
      await davClient().upload();
      message(ui2.success);
    }));
    forceButton.addEventListener("click", () => run(async () => {
      if (doc.defaultView.confirm(ui2.confirmForce)) {
        persistBundledIfNeeded();
        await davClient().upload(true);
        message(ui2.success);
      }
    }));
    pullButton.addEventListener("click", () => run(async () => {
      if (!mayReplace() || !doc.defaultView.confirm(ui2.confirmPull)) return;
      await davClient().download();
      const dictionary = store.getDictionary() || await loadBundled(store.language);
      apply(dictionary);
      showDictionary(dictionary);
      uiSelect.value = store.uiLanguage;
      ui2 = labels[store.uiLanguage];
      for (const [node, key] of localized) node.textContent = ui2[key];
      message(ui2.success);
    }));
    for (const input of [repository, branch, url, username, password, path, remember]) input.addEventListener("change", saveConfig);
    showDictionary(store.getDictionary() || initialDictionary);
    host.appendChild(root);
    return { overlay: root, dispose() {
      disposed = true;
      root.remove();
      password.value = "";
      sync = null;
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
        entries: 146,
        status: "complete-for-bundled-source"
      },
      {
        id: "zh-CN",
        name: "\u7B80\u4F53\u4E2D\u6587",
        full: true,
        path: "locales/zh-CN.json",
        entries: 146,
        status: "complete-for-bundled-source"
      },
      {
        id: "es",
        name: "Espa\xF1ol",
        path: "locales/es.json",
        entries: 80,
        status: "starter"
      },
      {
        id: "fr",
        name: "Fran\xE7ais",
        path: "locales/fr.json",
        entries: 80,
        status: "starter"
      },
      {
        id: "de",
        name: "Deutsch",
        path: "locales/de.json",
        entries: 80,
        status: "starter"
      },
      {
        id: "pt-BR",
        name: "Portugu\xEAs (Brasil)",
        path: "locales/pt-BR.json",
        entries: 80,
        status: "starter"
      },
      {
        id: "ja",
        name: "\u65E5\u672C\u8A9E",
        path: "locales/ja.json",
        entries: 80,
        status: "starter"
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
      phraseEntries = Object.entries(translations).filter(([key]) => key.length >= 8).sort((a2, b2) => b2[0].length - a2[0].length);
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
      const source = JSON.stringify(store.getDictionary() || (store.language === "zh-CN" ? validateDictionary(JSON.parse(fileSource)) : await loadBundled(store.language)));
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
/*! Bundled license information:

webdav/dist/web/index.js:
  (*! For license information please see index.js.LICENSE.txt *)
*/
