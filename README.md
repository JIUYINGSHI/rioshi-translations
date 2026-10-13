# RIOSHI Translations

Community translation dictionaries for Millennium plugin interfaces.

## Features

- A **Translations / 翻译** page inside Millennium's main settings.
- Independent Chinese/English plugin interface switch in the upper-right corner.
- JSON editing with line numbers, formatting and immediate application.
- Bundled English, Simplified Chinese, Spanish, French, German, Brazilian Portuguese and Japanese starter packs.
- Download and apply language packs from this GitHub repository.
- WebDAV upload/download using the maintained [webdav-client](https://github.com/perry-mitchell/webdav-client) library.
- Conditional writes (`If-Match` / `If-None-Match`) prevent overwriting another device's remote changes.

English and Simplified Chinese cover the bundled source dictionary. Other packs currently translate 80 common settings; the catalog records the exact count and starter status. Untranslated strings keep their original text. Dictionaries target source **English** strings: set the source plugin to English when it has its own locale support.

## Install

Copy the release directory into `Steam/millennium/plugins/rioshi-plugin-translations`, keeping `.millennium/Dist/index.js`, `plugin.json`, `translations.json`, `locales/` and `remote-config.json`. Enable **RIOSHI Translations**, restart the Steam UI once, then open Millennium settings → **Translations / 翻译**.

The internal ID stays `rioshi-plugin-translations` to migrate existing custom Chinese dictionaries. The displayed name is **RIOSHI Translations**.

## Dictionaries and GitHub downloads

Select a dictionary language to load the local or bundled pack. Expand **GitHub language packs**, select the same language, and click **Download & apply**. Default repository: `JIUYINGSHI/rioshi-translations`, branch `main`. Enter another owner/repository and branch to use a compatible fork.

Download catalog: `locales/catalog.json`. Each `languages` entry contains `id`, `name`, `path`, `entries` and `status`; paths must be `locales/<language>.json`. Each language file is a JSON object of `"English source": "translated text"` pairs. Files with invalid entries are rejected before application. Downloaded/edited dictionaries are saved on the current computer in Steam browser local storage; bundled plugin files are not overwritten. **Restore bundled dictionary** resets the selected language to its shipped pack.

External edits to `translations.json` are monitored every second. A saved/downloaded local language dictionary takes precedence over that bundled file.

## WebDAV

Expand **WebDAV sync**. Enter the WebDAV root URL, username, password and remote JSON file path (default `/rioshi-translations.json`). The UI stores the URL, username and path locally. Passwords stay in memory unless **Remember password** is selected; that option stores the password in plain browser local storage. Use an app password where supported.

1. **Check connection** reads the target file, or reports that it will be created.
2. **Upload local** creates a missing remote file. For an existing remote file, download it first or explicitly choose **Replace remote**.
3. **Download remote** restores all saved dictionaries, selected dictionary language and interface language after confirmation. It keeps the preceding local state under `rioshi-plugin-translations:state-v4:before-download` for recovery.
4. After downloading or uploading, ordinary uploads use the remote ETag. Concurrent changes produce a conflict rather than an overwrite. **Replace remote** requires confirmation.

Only dictionaries and language selections are synchronized. WebDAV credentials, GitHub configuration and recovery snapshots are excluded. No background uploads run without the user's click.

This release uses the browser edition of webdav-client. **The WebDAV server must permit CORS requests from Steam's origin**. It must support `GET`, `PUT`, `MKCOL`, preflight `OPTIONS`, allow `Authorization`, `If-Match`, `If-None-Match` and `Content-Type`, and expose the `ETag` response header. A server without CORS support will not work directly from this plugin; the UI reports the connection failure. Nothing disables Steam/Chromium security checks. If ETag is not exposed, replacing an existing remote file requires explicit confirmation.

## Development

Node.js 20+:

```sh
npm ci
npm run build
npm test
```

`src/runtime.js` handles scoped translation and the main-settings navigation lifecycle. `src/editor.js` renders the editor and controls. `src/translation-store.js` manages dictionaries and GitHub downloads. `src/webdav-sync.js` provides the WebDAV operations through the upstream client. The browser bundle is committed in `.millennium/Dist` so users do not need Node.js.

`node scripts/generate-locales.mjs` regenerates starter files from `translations.json` and the authored translation table; edit the table when improving a generated pack. Tests exercise dictionary persistence, GitHub schema validation, real HTTP WebDAV conditional writes, UI language switching and repeated navigation in a separate Steam popup document. They do not substitute for testing inside the running Steam client or against your production WebDAV service.

## 中文说明

在 Millennium 主设置中进入“翻译”。右上角选择 **简体中文 / English** 切换插件自身界面；“词典语言”控制其他插件的翻译。展开 GitHub 语言包即可从仓库下载并应用，展开 WebDAV 即可测试连接、上传或下载。首次覆盖已有远程词典需要先下载或确认覆盖。退出翻译页会卸载编辑器，插件不注册库管理器侧栏。

旧版备份位于本机 `.backups/`，不会提交到 GitHub，也不会打包进发布文件。
