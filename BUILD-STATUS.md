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
T-042  TODO
T-043  TODO
T-044  TODO
T-045  TODO
T-046  TODO
T-047  TODO
T-048  TODO
T-049  TODO
T-050  TODO
T-051  TODO
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
