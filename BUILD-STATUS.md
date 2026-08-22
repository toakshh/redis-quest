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
T-052  TODO
T-053  TODO
T-054  TODO
T-055  TODO
T-056  TODO
T-057  TODO
T-058  TODO
T-059  TODO
T-060  TODO
T-061  TODO
T-062  TODO
T-063  TODO
T-064  TODO
T-065  TODO
T-066  TODO
T-067  TODO
T-068  TODO
T-069  TODO
T-070  TODO
T-071  TODO
T-072  TODO
T-073  TODO
T-074  TODO
T-075  TODO
T-076  TODO
T-077  TODO
### TASK T-041 · Create the Game3DRoot root component

**DEPENDS ON:** T-040
**READ FIRST:** pro-instruct.md
**DO NOT READ:** src/App.jsx (existing 2D app)
**CREATE:** src/game3d/view/Game3DRoot.jsx, src/game3d/view/Game3DRoot.test.jsx
**MODIFY:** (None yet)

**CONTRACT:**
```js
export default function Game3DRoot({ seed, playerKey })
// Return shape: a React component rendering a @react-three/fiber <Canvas>
```

**RULES:**
1. Use exact Canvas props: `dpr={[0.6,2]}` and `gl={{ antialias:false, powerPreference:'high-performance' }}`
2. Render `<AdaptiveDpr pixelated />` from `@react-three/drei`
3. Create the 3D runtime exactly once in a `useRef` using `createRuntime`, and dispose it exactly once on unmount. Note: React 18 strict mode may run effects twice.
4. Never import or use Zustand from the 2D app.
5. Provide a fallback suspense boundary.

**TEST CONTRACT:**
1. Renders the Canvas with correct gl and dpr props
2. Creates the runtime once via createRuntime
3. Calls runtime.dispose() on unmount

**ACCEPTANCE:**
```bash
npx vitest run src/game3d/view/Game3DRoot.test.jsx
```
**DONE WHEN:** Tests pass and the component fulfills the contract.
**IF IT FAILS:** Fix the component logic; ensure React imports are correct and mock Canvas properly for the test.
### TASK T-042 · Create the SimProvider context

**DEPENDS ON:** T-041
**READ FIRST:** pro-instruct.md
**DO NOT READ:** (None)
**CREATE:** src/game3d/view/SimProvider.jsx, src/game3d/view/SimProvider.test.jsx
**MODIFY:** (None)

**CONTRACT:**
```js
export const SimContext = React.createContext(null)
export function useSim()
export function SimProvider({ runtime, world, children })
```

**RULES:**
1. Expose an object `{ world, runtime }` as the context value.
2. The context value must be stable across renders (useMemo or direct object if props never change, but prefer returning stable refs). The spec says "Exposes refs, not state", which means we don't put sim properties into React state. We just provide `{world, runtime}` object so children can access them as references.
3. In `SimProvider`, start the core loop in a `useEffect`. Frame timing should likely use `requestAnimationFrame`. Wait, typical R3F uses `useFrame` for loop, but here the spec says "Runs `GameLoop` in a `useEffect`, stops on cleanup." So we create an interval or rAF that calls something like `world.step()`. Let's clarify: if it runs GameLoop inside a React component, does it use `requestAnimationFrame`?
Wait, if it's inside `<Canvas>`, `useFrame` could be used. But `useEffect` is explicitly stated in the task grid "Runs `GameLoop` in a `useEffect`, stops on cleanup."

Let's refine the contract.
### TASK T-043 · Create CharacterController

**DEPENDS ON:** T-042
**READ FIRST:** pro-instruct.md
**DO NOT READ:** (None)
**CREATE:** src/game3d/view/player/CharacterController.jsx, src/game3d/view/player/CharacterController.test.jsx
**MODIFY:** (None)

**CONTRACT:**
```js
export default function CharacterController()
```

**RULES:**
1. Renders a kinematicPosition `<RigidBody>`.
2. Creates a Capsule collider: 0.4 radius × 1.8 height.
3. Instantiates a Rapier `KinematicCharacterController` with offset 0.01, sets `setApplyImpulsesToDynamicBodies(true)`.
4. Reads from `FEEL.move` (e.g. speed or gravity).

**TEST CONTRACT:**
1. Renders a RigidBody with correct type and colliders.
2. Creates character controller with correct offset.
3. Applies impulses to dynamic bodies.

**ACCEPTANCE:**
```bash
npx vitest run src/game3d/view/player/CharacterController.test.jsx
```
**DONE WHEN:** Component passes tests and adheres to rules.
### TASK T-044 · Create PlayerRig

**DEPENDS ON:** T-043
**READ FIRST:** pro-instruct.md
**DO NOT READ:** (None)
**CREATE:** src/game3d/view/player/PlayerRig.jsx, src/game3d/view/player/PlayerRig.test.jsx
**MODIFY:** (None)

**CONTRACT:**
```js
export default function PlayerRig({ isSprinting = false, velocity = { x: 0, z: 0 } })
```

**RULES:**
1. Render `<PointerLockControls>` from `@react-three/drei`.
2. Apply head bob and strafe roll based on `FEEL.camera`.
3. Lerp the camera FOV when `isSprinting` is true (vs false).

**TEST CONTRACT:**
1. Renders PointerLockControls.
2. Updates camera FOV on sprint (useFrame test or similar).
3. Applies roll/bob (verifiable mostly by structure, we will test the existence of logic).

**ACCEPTANCE:**
```bash
npx vitest run src/game3d/view/player/PlayerRig.test.jsx
```
**DONE WHEN:** Component passes tests and adheres to rules.
### TASK T-045 · Create WeaponRig

**DEPENDS ON:** T-044
**READ FIRST:** pro-instruct.md
**DO NOT READ:** (None)
**CREATE:** src/game3d/view/player/WeaponRig.jsx, src/game3d/view/player/WeaponRig.test.jsx
**MODIFY:** (None)

**CONTRACT:**
```js
export default function WeaponRig({ children, isAds = false, fireImpulse = 0, cameraLookDelta = { x: 0, y: 0 } })
```

**RULES:**
1. Renders a generic `<group>` wrapping `children`.
2. Spring-damper recoil: `fireImpulse` adds to a recoil velocity, which is pulled back to 0 using `FEEL.weapon.recoilStiffness` and damped with `FEEL.weapon.recoilDamping`.
3. Camera sway lags camera velocity.
4. **All math in `useFrame` with pre-allocated `Vector3`s/`Euler`s declared outside the component.**

**TEST CONTRACT:**
1. Renders a group containing children.
2. Updates recoil and sway inside useFrame.
3. Preallocates vectors (visual / test inspection).

**ACCEPTANCE:**
```bash
npx vitest run src/game3d/view/player/WeaponRig.test.jsx
```
**DONE WHEN:** Component passes tests and adheres to rules.
### TASK T-046 · Create PostChain

**DEPENDS ON:** T-045
**READ FIRST:** pro-instruct.md
**DO NOT READ:** (None)
**CREATE:** src/game3d/view/fx/PostChain.jsx, src/game3d/view/fx/PostChain.test.jsx
**MODIFY:** (None)

**CONTRACT:**
```js
export default function PostChain()
```

**RULES:**
1. Render `@react-three/postprocessing` `EffectComposer` with SMAA.
2. The exact chain: `SSAO`, `Bloom`, `ChromaticAberration`, `Glitch`, `Noise`, `Vignette`. 
3. Every parameter bound to a sim value via a ref (read from `useSim()`), mutated inside a `useFrame`, not via React state. (E.g., `vignetteRef.current.offset = ...`).
Wait! R3F postprocessing passes expose refs sometimes? `ChromaticAberration` takes an offset ref. But actually, standard practice is to use refs on the effects and mutate them in `useFrame`:
`ref.current.blendMode.opacity.value = ...` or similar. Since we may not know the exact imperative api for `postprocessing` without deep knowledge, we'll assign `ref` and update common uniforms like `chromaticAberrationRef.current.offset` or `glitchRef.current.mode`. Wait, `Noise` is often used for Grain.
Let's see.

**TEST CONTRACT:**
1. Renders the EffectComposer and passes.
2. Contains refs for postprocessing updates.

**ACCEPTANCE:**
```bash
npx vitest run src/game3d/view/fx/PostChain.test.jsx
```
**DONE WHEN:** Component passes tests and adheres to rules.
### TASK T-047 · Create quality settings

**DEPENDS ON:** T-046
**READ FIRST:** pro-instruct.md
**DO NOT READ:** (None)
**CREATE:** src/game3d/config/quality.js, src/game3d/config/quality.test.js
**MODIFY:** (None)

**CONTRACT:**
```js
export const QUALITY_LADDER = [ ... ]
export function createQualityManager()
```

**RULES:**
1. The degrade ladder from plan §14.4, in the stated order.
2. Hysteresis: degrade below 50 fps, restore above 58.

**TEST CONTRACT:**
1. Exports QUALITY_LADDER correctly.
2. createQualityManager handles degrade and restore based on fps.

**ACCEPTANCE:**
```bash
npx vitest run src/game3d/config/quality.test.js
```
**DONE WHEN:** Component passes tests and adheres to rules.
### TASK T-048 · Create LevelLoader

**DEPENDS ON:** T-047
**READ FIRST:** pro-instruct.md
**DO NOT READ:** (None)
**CREATE:** src/game3d/view/level/LevelLoader.jsx, src/game3d/view/level/LevelLoader.test.jsx
**MODIFY:** (None)

**CONTRACT:**
```js
export default function LevelLoader({ url, colliders })
```

**RULES:**
1. Loads the GLTF using `useGLTF(url)` from `@react-three/drei`. Assume Draco is used globally or pass draco path.
2. Creates Colliders from the `colliders` manifest array passed in, never generating colliders automatically from meshes at runtime.
3. Wraps the loading with a `<Suspense>` boundary.

**TEST CONTRACT:**
1. Wraps children in Suspense.
2. Calls useGLTF for the url.
3. Renders colliders given in manifest.

**ACCEPTANCE:**
```bash
npx vitest run src/game3d/view/level/LevelLoader.test.jsx
```
**DONE WHEN:** Component passes tests and adheres to rules.
### TASK T-049 · Create EnemyInstances

**DEPENDS ON:** T-048
**READ FIRST:** pro-instruct.md
**DO NOT READ:** (None)
**CREATE:** src/game3d/view/entities/EnemyInstances.jsx, src/game3d/view/entities/EnemyInstances.test.jsx
**MODIFY:** (None)

**CONTRACT:**
```js
export default function EnemyInstances({ geometry, material, count })
```

**RULES:**
1. Renders an `<instancedMesh>` using passed geometry and material.
2. In `useFrame`, iterate over the physics/entity store Float32Arrays and update the instances' matrices (position, rotation).
3. Call `meshRef.current.instanceMatrix.needsUpdate = true`.
4. Zero React re-renders (do not use state to track positions).

**TEST CONTRACT:**
1. Renders instancedMesh with correct args.
2. Updates matrices in useFrame based on entities.
3. Sets needsUpdate = true.

**ACCEPTANCE:**
```bash
npx vitest run src/game3d/view/entities/EnemyInstances.test.jsx
```
**DONE WHEN:** Component passes tests and adheres to rules.
### TASK T-050 · Create SimInspector

**DEPENDS ON:** T-049
**READ FIRST:** pro-instruct.md
**DO NOT READ:** (None)
**CREATE:** src/game3d/view/debug/SimInspector.jsx, src/game3d/view/debug/SimInspector.test.jsx
**MODIFY:** (None)

**CONTRACT:**
```js
export default function SimInspector()
```

**RULES:**
1. Renders an HTML overlay showing fps, ms per stage vs BUDGETS, entity count, draw calls, active beat, ledger values.
2. Toggled with F3.
3. Reads from `useSim()`.

**TEST CONTRACT:**
1. Renders nothing by default.
2. Toggles with F3 key.
3. Reads and displays simulation data.

**ACCEPTANCE:**
```bash
npx vitest run src/game3d/view/debug/SimInspector.test.jsx
```
**DONE WHEN:** Component passes tests and adheres to rules.
### TASK T-051 · Create LadderState

**DEPENDS ON:** T-050
**READ FIRST:** pro-instruct.md
**DO NOT READ:** (None)
**CREATE:** src/game3d/sim/teaching/LadderState.js, src/game3d/sim/teaching/LadderState.test.js
**MODIFY:** (None)

**CONTRACT:**
```js
export function createLadderState({ currentChapter = 1 } = {})
// Returns: {
//   getTier(conceptId),
//   setTier(conceptId, tier),
//   canUseTier(tier),
//   recordUsage(conceptId, tier),
//   getLedger()
// }
```

**RULES:**
1. Tiers 0–3, never decreasing (`setTier` ignores lower values).
2. `canUseTier(n)` gates by chapter (e.g. Chapter 1 might only support Tier 1, Chapter 2 Tier 2... let's say tier <= chapter).
3. Records tier usage per concept for the ledger: increments a count per `(conceptId, tier)`.

**TEST CONTRACT:**
1. Never decreases tier on setTier.
2. canUseTier respects current chapter.
3. recordUsage accumulates in the ledger.

**ACCEPTANCE:**
```bash
npx vitest run src/game3d/sim/teaching/LadderState.test.js
```
**DONE WHEN:** Component passes tests and adheres to rules.
