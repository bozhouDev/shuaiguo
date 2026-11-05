---
paths:
  - "cocos/assets/scripts/core/**/*.ts"
---

# Gameplay Code Rules

- Gameplay values come from level data (`core/levels.ts`, `core/config.ts`) or remote config, not literals in logic — so balance can be tuned and simulated without code edits
- Use delta time for ALL time-dependent calculations (frame-rate independence)
- Core logic does not import view code; it reports through events (`emit`) that the view layer consumes
- Every gameplay system must implement a clear interface
- State machines must have explicit transition tables with documented states
- Write unit tests for all gameplay logic — separate logic from presentation
- Document which design doc each feature implements in code comments
- No static singletons for game state — use dependency injection
