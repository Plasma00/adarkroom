# Crystal expansion development

`[projectdev] mode: orchestrator` — archetype: build-feature; terminal: stop at local verification.

Scope: implement the core expansion from the supplied design document, with its suggested defaults. Preserve the user's two existing untracked documents. No remote publishing requested.

Pinned verification commands: `npm test` and `npm run test:browser`, both must exit 0. Both commands passed the skill's `screen-cmd` check. Project structure is static HTML/JavaScript; no compiled release bundle is required.

1. Read the baseline and fixed combat, fabrication and world-coordinate logic. Added deterministic Node scenarios and ran them: initial 10 tests passed.
2. Integrated industrial discoveries, ship branches, quest shards, housing, recipes, launch gates, migration and ID-based scoring. Content validator passed: 24 events and 24 tile symbols.
3. Added real-browser scenarios. Corrected test fixtures for the sound prompt, pack capacity, combat cooldowns, and space animation scaffolding. These were harness assumptions, not gameplay changes.
4. Additional checks found a real delayed-notification callback after ending teardown and a shared saved-outfit reference. Guarded notification teardown, separated expedition inventory, and committed quest inventory with its source ledger. Added an independent autosave regression: 11 Node tests passed.
5. Final browser verification passed all 7 scenarios. Missing-audio verification raised the Node total to 12 passing tests; content validation and whitespace checks passed. Results are recorded in `handoff.json`.

Known limits: initial balance has automated scenario coverage but no unaccelerated end-to-end playthrough. Non-Simplified-Chinese locales fall back to English for new text. The existing Express/qs dependency chain still reports two moderate npm audit findings.
