# Build Status — Protocol Zero

Format: <task-id>  <STATUS>  <date>  <commit>
STATUS is one of: TODO | IN-PROG | DONE | BLOCKED

T-001  DONE      2026-08-20
T-002  DONE      2026-08-20
T-003  DONE      2026-08-20
T-004  DONE      2026-08-20
T-005  DONE      2026-08-20
T-006  DONE      2026-08-20
T-007  DONE      2026-08-20
T-008  DONE      2026-08-20
T-009  DONE      2026-08-20
T-010  DONE      2026-08-20
T-011  DONE      2026-08-20
T-012  DONE      2026-08-20
T-013  DONE      2026-08-20
T-014  DONE      2026-08-20
T-015  DONE      2026-08-20
T-016  DONE      2026-08-20
T-017  DONE      2026-08-20
T-018  DONE      2026-08-20
T-019  DONE      2026-08-20
T-020  DONE      2026-08-20
T-021  DONE      2026-08-20
T-022  DONE      2026-08-20
T-023  DONE      2026-08-20
T-024  DONE      2026-08-20
T-025  DONE      2026-08-20
T-026  DONE      2026-08-20
T-027  DONE      2026-08-22
T-028  DONE      2026-08-22
T-029  DONE      2026-08-22
T-030  DONE      2026-08-22
T-031  DONE      2026-08-22
T-032  DONE      2026-08-22
T-033  DONE      2026-08-22
T-034  DONE      2026-08-22
T-035  DONE      2026-08-22
T-036  DONE      2026-08-22
T-037  DONE      2026-08-22
T-038  DONE      2026-08-22
T-039  DONE      2026-08-22
T-040  DONE      2026-08-23
T-041  DONE
T-042  DONE
T-043  DONE
T-044  DONE
T-045  DONE
T-046  DONE
T-047  DONE
T-048  DONE
T-049  DONE
T-050  DONE
T-051  DONE
T-052  DONE
T-053  DONE
T-054  DONE
T-055  DONE
T-056  DONE
T-057  DONE
T-058  DONE
T-059  DONE
T-060  DONE
T-061  DONE
T-062  DONE
T-063  DONE
T-064  DONE
T-065  DONE
T-066  DONE
T-067  DONE
T-068  DONE
T-069  DONE
T-070  DONE
T-071  DONE
T-072  DONE
T-073  DONE
T-074  DONE
T-075  DONE
T-076  DONE
T-077  DONE

## Integration pass (2026-08-24)

T-001..T-077 built every component, but nothing wired them together:
src/game3d/index.js still exported a "PROTOCOL ZERO — BOOTING" placeholder,
and the 3D chunk was 0.51 kB — no three.js reached the bundle. All 1013 unit
tests passed against a mode that could not be played.

Closed by:
- src/game3d/index.js now re-exports the real view/Game3DRoot.jsx.
- view/Game3DRoot.jsx builds the game, owns pointer lock, HUD and console.
- view/Scene.jsx composes level, hostiles, terminals, player and flashlight.
- sim/createGameWorld.js assembles runtime + SimWorld + all 10 systems and
  spawns the level, so the game loop is testable with no GPU.
- sim/systems/CollisionSystem.js fills the unused PHYSICS_SYNC slot.
- sim/systems/ThreatSystem.js makes hostiles drain the player's TTL.
- content/chapters/ch1/level.js generates the facility from boxes (no .glb).

Guard rail added: src/game3d/__tests__/playable.test.jsx. It asserts the DOM
half (canvas + HUD mount, no placeholder) AND builds the scene through the
real R3F reconciler via @react-three/test-renderer. The second half is not
optional — a mocked <Canvas> accepts props that throw in the real reconciler,
which is exactly how a `data-testid` on a <group> shipped a white-screen crash.

Known gaps, deliberately not closed here:
- Chapter beats in content/chapters/ch1/beats/index.js have empty execute()
  bodies; the Director/StoryGraph run but drive no scripted events yet.
- view/EnemyInstances.jsx, view/level/LevelLoader.jsx, view/player/*Rig.jsx and
  view/hud/{CardComposer,DebriefCard,ReceiptLine}.jsx remain unused by the
  live scene; they are the task-card versions, kept for the next pass.

## Horror SFX & Scare System Integration

Procedural horror audio and Scare/Director systems are now integrated into the 3D gameplay loop:
- `ScareSystem` executes in the main sim loop via `createGameWorld.js` to manage scare tension, cooldowns, select active scares using `ScareDirector`, and apply fairness rules using `evaluateFairness` based on input commands and scare history.
- `ScareAudio` reads `world.scareEvents` and triggers procedural scare stingers.
- Master gain transition states like `audioDrop` are optimized in `ScareAudio` using `lastAudioDropRef` to avoid busy-scheduling nodes every frame.
- Headless testing mocks in `ScareAudio.test.jsx` are updated to support the revised schedule testing.
