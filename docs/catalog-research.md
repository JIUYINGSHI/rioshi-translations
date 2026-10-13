# Millennium catalogue research

Checked against live first-party responses on 2026-10-13 (Asia/Shanghai).

## Authoritative inventory

The official themes page fetches `https://steambrew.app/api/v2`. Its live JSON array contains **26 themes**. Entries include `name`, `description`, `version`, `download`, `data.github.owner`, `data.github.repo`, `commit_data.oid`, and the complete `skin_data` configuration. Among these, 17 expose `Conditions`, totalling 398 condition entries. Counts describe this dated snapshot, not a permanent catalog size. [Catalogue API](https://steambrew.app/api/v2) · [Official theme page](https://steambrew.app/themes)

The official plugins page fetches `https://steambrew.app/api/v1/plugins/`; following its redirect reaches the slashless endpoint. The live JSON array contains **36 plugins**. Entries include `pluginJson`, `repoOwner`, `repoName`, `commitId`, `id`, and `format`; some also provide a release `downloadUrl`. All 36 currently report `format: "loose"`. [Catalogue API](https://steambrew.app/api/v1/plugins) · [Official plugin page](https://steambrew.app/plugins)

Fluenty has a separately rendered commercial promotional card on the official themes page and is absent from the 26-entry public API array. Consequently, public-catalog coverage must be distinguished from locally installed or commercial themes. The plugin already has locally sourced Fluenty translations which can be preserved. [Official theme page](https://steambrew.app/themes)

## Extraction formats

For theme settings, extract the original condition object keys, `description`, `tab`, `section`, and the keys of `values`. Display text must be translated without changing the actual configuration identifiers in `skin.json`: upstream documents warn that renaming a setting resets its saved preference. Paths, CSS selectors, regexes, GitHub identifiers, and actual option identifiers must remain upstream data. Source descriptions may contain BBCode and require preserving markup. [Theme user configuration](https://docs.steambrew.app/themes/intermediate/user)

Theme root `name`, `description`, and tags are catalogue/display metadata. The official documentation defines the remaining patch fields as CSS/JS paths and matching instructions, not translation strings. Theme `RootColors` may point to CSS containing display labels which need separate source inspection. [Theme configuration reference](https://docs.steambrew.app/themes/basics/config) · [Live catalogue API](https://steambrew.app/api/v2)

Plugin catalogues expose `pluginJson.common_name` and `pluginJson.description`, but do not contain all their settings UI text. To cover settings, inspect each repository at its catalogued `commitId`, then prefer existing locale dictionaries over inferring arbitrary JavaScript string literals. The inventory provides repository identity and commit references for reproducibility. [Plugin catalogue API](https://steambrew.app/api/v1/plugins)

An example of reusable upstream localization is Easy Restart / Reload for Steam: `frontend/i18n.ts` exports keyed `TranslationSet` dictionaries under Steam language identifiers including `schinese`, `tchinese`, `english`, and `japanese`. English and target-language values can be paired by their stable text keys rather than machine-translating already translated strings. [Pinned upstream source](https://github.com/SaiyajinK/Easy-Restart-Reload-for-Steam/blob/dc79ae21c6a71af946fd71b5867eee1b179ea184/frontend/i18n.ts)

The `$schema` URL stored by some plugin manifests, `https://raw.githubusercontent.com/SteamClientHomebrew/Millennium/main/src/sys/plugin-schema.json`, returned HTTP 404 during this research. Do not depend on that historical URL for discovery or extraction. [Historical schema path](https://github.com/SteamClientHomebrew/Millennium/blob/main/src/sys/plugin-schema.json)

## Synchronization implications

Use catalogue IDs as stable inventory keys and store the catalogued upstream commit beside each extracted source. A future catalogue refresh can compare commit IDs, re-extract changed strings, retain existing translations by original text, and report newly added/changed/removed strings for review. This is an implementation inference from the authoritative metadata above, not a promise that new translations can be produced without review.

Some themes contain no condition options; those still require metadata coverage, but a zero settings-string count should not be treated as a failed scan. Some plugins translate themselves, and native upstream language coverage should be recorded separately from additional dictionary coverage. DOM exact-text dictionaries cannot guarantee that dynamic fragments, split text nodes, or CSS-generated content are translated; those require corresponding runtime support and validation.

The website APIs are first-party live inventories rather than a documented long-term API contract. Store retrieval time and source URLs, validate response shape, and fail visibly if their structure changes. Web search snapshots were observed to lag the direct live API, so inventory counts and commit pins above use direct Node `fetch`, not cached search results.
