# RIOSHI Translations 4.0.1

- Removed repository/branch controls and the GitHub download accordion.
- Added a single Download & apply toolbar button for the selected dictionary language.
- Downloads are fixed to JIUYINGSHI/rioshi-translations, main; old local source overrides are ignored.
- All eight regression tests pass, including fixed-source download, WebDAV conflicts and popup navigation.

## Included 4.0 features

- Renamed the displayed plugin to RIOSHI Translations while preserving the internal ID and existing Chinese custom dictionary migration.
- Added independent Chinese/English plugin interface selection in the upper-right corner.
- Added bundled English/Simplified Chinese dictionaries (146 entries each) and Spanish/French/German/Brazilian Portuguese/Japanese starter dictionaries (80 entries each).
- Added language selection and GitHub catalog download from JIUYINGSHI/rioshi-translations.
- Added WebDAV upload/download through upstream webdav-client 5.11.0, with ETag conflict protection and explicit replacement confirmation.
- Preserved line numbers, formatting and navigation cleanup. No library-manager layout modifications or sidebar-panel registration.

The browser WebDAV client requires CORS support and exposed ETag headers on the WebDAV server. Passwords are not synchronized. Remembering a password is optional and stores it in plain local browser storage.

Seven automated tests pass, including real HTTP WebDAV conflict scenarios and repeated navigation in a separate popup document. All seven remote language files were downloaded successfully. Running-Steam UI behavior and individual production WebDAV services still require user verification.

Install the included rioshi-plugin-translations directory under Steam/millennium/plugins. Enable RIOSHI Translations and restart Steam UI once.
