/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Cyberpunk terminal palette
        bg: '#0a0e14',
        panel: '#10151f',
        panel2: '#141b29',
        edge: '#1f2a3d',
        cyan: '#22d3ee',
        green: '#34d399',
        amber: '#fbbf24',
        red: '#fb7185',
        purple: '#a78bfa',
        fg: '#c8d3e0',
        dim: '#64748b',
      },
      fontFamily: {
        mono: [
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Consolas',
          '"Liberation Mono"',
          'monospace',
        ],
      },
      boxShadow: {
        glow: '0 0 12px rgba(34, 211, 238, 0.35)',
        'glow-green': '0 0 12px rgba(52, 211, 153, 0.35)',
        'glow-red': '0 0 12px rgba(251, 113, 133, 0.35)',
      },
      keyframes: {
        flicker: {
          '0%, 100%': { opacity: '1' },
          '92%': { opacity: '1' },
          '93%': { opacity: '0.6' },
          '94%': { opacity: '1' },
          '97%': { opacity: '0.8' },
        },
        toastIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
      },
      animation: {
        flicker: 'flicker 6s infinite',
        toastIn: 'toastIn 0.2s ease-out',
        pulseSoft: 'pulseSoft 1.5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
