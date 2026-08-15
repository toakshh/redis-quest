# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test, release, architecture, and sharp-edge notes that should travel with the code.

- Add durable project-specific notes here as they are discovered through real work.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.

## Audio System
- Located in `src/audio/SoundEngine.js`.
- Uses Web Audio API for SFX and procedural chiptune BGM.
- Subscribes to `gameStore` for audio settings (toggles, volume).
- Initialized in `App.jsx`.

## Inventory & Chest System
- Inventory modal in `src/components/InventoryModal.jsx` (toggled via `I` hotkey or HUD button).
- Chest Command educational overlay modal in `src/components/ChestCommandModal.jsx` with data in `src/data/chestCommands.js`.

## Incident & Progressive Hint System
- Incident HUD in `src/components/IncidentPanel.jsx` with `PressureMeter.jsx` and `SystemHealth.jsx`.
- 3-Tier Progressive Hint Engine in `src/systems/HintEngine.js` (Tier 1: Symptom, Tier 2: Concept, Tier 3: Command Shape), integrated into `src/components/RexPanel.jsx`.
