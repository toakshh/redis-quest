// The 3D mode's lazy entry point. Default export ONLY here — React.lazy()
// requires it. Everything downstream of this file is loaded only when a
// player actually chooses PROTOCOL ZERO from the launcher (see
// src/components/ModeLauncher.jsx and the lazy() call in src/App.jsx), so
// three.js and the rest of the 3D bundle never reach a 2D-only player.
//
// This file is a re-export and nothing else. It stays a .js module because
// its path is a fixed contract with the lazy() import in App.jsx and with the
// bundle-split test; the JSX-authored root it points at lives in
// view/Game3DRoot.jsx.

export { default } from './view/Game3DRoot.jsx'
