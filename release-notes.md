# RIOSHI Translations 5.0.0

- Removed WebDAV controls, the client dependency, credentials and sync operations. Dictionaries are delivered through the fixed GitHub download button.
- Added the official catalog snapshot: 26 themes and 36 plugins, pinned upstream versions, original extracted text and per-project language files.
- Covered all 1,862 distinct statically extracted display texts in English, Simplified Chinese, Spanish, French, German, Brazilian Portuguese and Japanese.
- Preferred upstream native/authored translations; remaining translations are labeled machine drafts. Corrected protected font names, selected Steam terminology and placeholder/BBCode errors.
- Added a full coverage report and placeholder validator. Zero missing source keys or placeholder mismatches in this snapshot; six editor/download/navigation tests pass.
- Added a weekly/manual GitHub workflow to follow official catalog revisions and list newly missing translations. It preserves known entries and does not silently mark new untranslated text as complete.

## Scope

Source coverage is not equivalent to human-reviewed, installed-project runtime coverage. Dynamic strings, CSS content, split text nodes and cross-origin plugin webviews may still require project-specific integration. Machine drafts have not all been manually reviewed. Paid/promoted themes missing from the public catalog API are outside its 26-theme count. No paid theme assets are redistributed.

Install the included directory under Steam/millennium/plugins. Restart Steam UI once, open Translations, select a language and click Download & apply to replace an older local dictionary with the expanded pack. Repository: JIUYINGSHI/rioshi-translations, main.
