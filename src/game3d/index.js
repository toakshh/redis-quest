// The 3D mode's lazy entry point. Default export ONLY here — React.lazy()
// requires it. Everything downstream of this file is loaded only when a
// player actually chooses PROTOCOL ZERO from the launcher (see
// src/components/ModeLauncher.jsx and the lazy() call in src/App.jsx), so
// three.js and the rest of the 3D bundle never reach a 2D-only player.
//
// Written with React.createElement rather than JSX: this project's Vite/oxc
// transform only parses JSX inside .jsx files, and this module's path
// (game3d/index.js) is a fixed contract with the lazy() import elsewhere.
// The real, JSX-authored 3D root arrives in view/Game3DRoot.jsx (Phase 3).

import { createElement } from 'react'

export default function Game3DRoot({ onExit }) {
  return createElement(
    'div',
    {
      className:
        'flex h-full w-full flex-col items-center justify-center bg-black text-cyan font-mono gap-6',
    },
    createElement(
      'div',
      { className: 'text-2xl tracking-[0.3em]' },
      'PROTOCOL ZERO — BOOTING',
    ),
    createElement(
      'button',
      {
        type: 'button',
        onClick: onExit,
        className:
          'px-4 py-2 border border-cyan/50 rounded text-cyan hover:bg-cyan/10 transition-colors text-sm tracking-widest',
      },
      'EXIT',
    ),
  )
}
