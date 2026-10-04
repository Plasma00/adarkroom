# Simplified Chinese completeness

Follow-up to the user's localization question. Audit found that the initial crystal content was translated, but the inherited fabrication, battleship, combat UI and hardcoded fleet ending were not fully localized.

- Added 243 explicit interface/story entries plus generated blueprint and map-title variants. Kept all gameplay IDs and save keys unchanged.
- Routed mobile accessibility labels, the language menu, blueprint notification, material-shortage template and hardcoded ending prose through the translation function. Removed redundant translation of already localized fabrication names.
- Updated the translation merger to fill existing empty Simplified Chinese PO entries as well as the runtime JS dictionary. Re-running it produces byte-identical output.
- Content validation now checks 503 literal Chinese text references, runtime/PO/source agreement, placeholders, HTML line breaks and dynamic item/blueprint names.
- Added a real Chinese mobile scenario for fabrication, blueprint labels, battle prose and action buttons; updated the Chinese ending expectation. Visual inspection found and fixed narrow-screen HP wrapping. Corrected an asynchronous viewport test and an assertion that confused an ASCII enemy glyph with its translated encounter name.
- Chinese notifications no longer gain an extra English full stop after Chinese punctuation.

Validation: 12 Node scenarios plus content validation passed. All 7 mobile browser scenarios passed after the translation changes; final full browser regression recorded in handoff.json. Inspected fabrication and combat screenshots. No deployment or game balance changes.
