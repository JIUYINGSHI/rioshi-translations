# RIOSHI Translations

Translation dictionaries for Millennium themes and plugins, distributed through GitHub.

## Install and use

Copy the release directory into `Steam/millennium/plugins/rioshi-plugin-translations`. Enable **RIOSHI Translations**, restart Steam UI once, then open Millennium main settings → **Translations / 翻译**. The internal plugin ID is unchanged, preserving previous dictionaries.

Select the dictionary language and click **Download & apply**. Downloads always use `JIUYINGSHI/rioshi-translations`, branch `main`; repository and branch controls are hidden. The plugin interface can independently switch between Chinese and English in the upper-right corner. The editor includes line numbers, formatting, immediate application and restoring the shipped dictionary.

WebDAV was removed in 5.0.0. There is no WebDAV UI, client dependency, network request or credential handling. Previously saved connection preferences are ignored.

## Official catalog coverage

The dated official catalog snapshot, pinned source versions and per-project counts are available in [catalog/COVERAGE.md](catalog/COVERAGE.md) and [catalog/coverage.json](catalog/coverage.json). Inventory sources are the official [theme API](https://steambrew.app/api/v2) and [plugin API](https://steambrew.app/api/v1/plugins/). See [source research](docs/catalog-research.md).

Each project has original extracted display text, source repository and commit recorded under `catalog/projects/`. Per-project language files live under `catalog/packs/`. `locales/` contains merged language packs for English, Simplified Chinese, Spanish, French, German, Brazilian Portuguese and Japanese. `locales/catalog.json` reports their current status.

These counts refer to statically extracted settings/display text, not proof that every runtime page or dynamically assembled sentence was inspected. Some plugin screens render split text, template fragments or CSS content that a DOM dictionary cannot translate directly. The plugin currently applies translation in Millennium settings and dialog regions; arbitrary cross-origin plugin webviews are outside this scope.

Translations prefer authored entries and upstream native locale files. Remaining entries have explicitly identified machine drafts in `catalog/translations/`. Corrections and protected technical names are maintained in `catalog/corrections.json`. Machine drafts require human review; font names, identifiers, URLs and formatting placeholders must not be mistranslated. The automated validator checks source coverage and placeholder preservation.

Commercial/promoted themes absent from the official API, including Fluenty, are not included in the public catalog's 26-theme count. Their previously installed translations remain in the local customization system; the repository does not redistribute paid theme assets.

Theme configuration keys are never rewritten: changing actual IDs in `skin.json` can reset upstream preferences. This plugin changes display text only, never registers a library-manager panel or modifies library-manager layout.

## Follow upstream changes

The **Refresh upstream translation inventory** GitHub workflow runs every Monday at 10:00 Asia/Shanghai and can also be run manually. It fetches the official inventory, parses pinned upstream configuration/source without executing that code, refreshes per-project dictionaries, commits the inventory and coverage report, and preserves known translations.

New or changed strings remain explicitly listed as missing until translations are added. The workflow does not call a machine translation service or pretend that missing text is completed. After reviewing missing entries, add authored/corrected translations or intentionally run the separate draft-generation command, rebuild the packs and publish an updated release. Weekly inventory commits do not automatically replace the installation ZIP.

## Local dictionaries

Custom and downloaded dictionaries are saved in Steam browser local storage, not written over installed plugin/theme files. Version 3 custom Chinese dictionaries are migrated. `translations.json` is the legacy bundled source; external edits are checked every second, while a saved dictionary takes precedence.

## Development

Node.js 22+:

```sh
npm ci
npm run catalog:refresh
npm run build
npm test
node scripts/validate-catalog.mjs
node scripts/package.mjs
```

`npm run catalog:drafts` intentionally sends public upstream display strings to a translation service to generate unreviewed draft dictionaries. It is a one-time/manual maintenance operation, not part of the scheduled workflow. Network access is required and the service may throttle requests. Draft files are cached to resume work.

`src/runtime.js` handles scoped translation and main-settings navigation. `src/editor.js` renders the bilingual editor and fixed-source download. `src/translation-store.js` manages local dictionaries and remote language validation. The built `.millennium/Dist/index.js` is committed for installation without Node.js. Dependency versions are locked; ZIP archives and parser inputs in `.cache/`, local backups in `.backups/`, and `node_modules/` are excluded from Git and releases.

## 中文说明

选择词典语言后点击“下载并应用”，即可从 GitHub 获取主题与插件的翻译词典。右上角可独立切换插件自身的中英文界面。WebDAV 已完全移除。官方目录、固定版本、各项目原文和覆盖情况都保存在仓库中；每周自动检查上游变化，新缺失词条会如实列出，审核和补译后再发布更新。

当前覆盖率针对静态提取的配置与界面文本；机器翻译初稿不等同于逐页人工验收。已有自定义词典继续保留，退出翻译页会卸载编辑器。
