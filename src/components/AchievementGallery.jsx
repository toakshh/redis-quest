import { useGameStore } from '../store/gameStore.js'
import { ACHIEVEMENTS, RARITY_COLORS, RARITY_LABELS, CATEGORY_LABELS, CATEGORY_ICONS } from '../data/achievements.js'

const CATEGORIES = ['all', 'discovery', 'mastery', 'boss', 'exploration', 'meta']
const RARITIES = ['all', 'common', 'uncommon', 'rare', 'epic', 'legendary']

function AchievementCard({ achievement, unlocked, onDismiss }) {
  const isUnlocked = Boolean(unlocked)
  const rarityColor = RARITY_COLORS[achievement.rarity] || '#64748b'
  const unlockedAt = unlocked ? new Date(unlocked).toLocaleDateString() : null

  return (
    <div
      className={`relative group flex flex-col h-full rounded-lg border p-3 transition-all duration-200 ${
        isUnlocked
          ? `border-${achievement.rarity}/50 bg-${achievement.rarity}/10 hover:border-${achievement.rarity} hover:bg-${achievement.rarity}/15`
          : 'border-edge bg-panel/60 opacity-60 hover:opacity-80'
      }`}
      style={{ borderColor: isUnlocked ? rarityColor : undefined }}
    >
      {/* Rarity indicator */}
      <div className="absolute -top-2 -right-2 w-2 h-2 rounded-full" style={{ backgroundColor: rarityColor }} />

      {/* Icon */}
      <div className={`flex items-center justify-center mb-2 text-3xl leading-none ${isUnlocked ? '' : 'text-dim'}`}>
        {isUnlocked ? achievement.icon : '❓'}
      </div>

      {/* Name */}
      <h4 className={`text-sm font-bold text-center leading-tight mb-1 ${isUnlocked ? 'text-fg' : 'text-dim'}`}>
        {achievement.name}
      </h4>

      {/* Category badge */}
      <div className="flex items-center justify-center gap-1 mb-2">
        <span
          className="px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wider uppercase text-dim"
          style={{ backgroundColor: 'rgba(100, 116, 139, 0.2)', borderColor: 'rgba(100, 116, 139, 0.3)' }}
        >
          {CATEGORY_ICONS[achievement.category]} {CATEGORY_LABELS[achievement.category].slice(0, 3)}
        </span>
        <span
          className="px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wider uppercase"
          style={{ color: rarityColor, backgroundColor: `${rarityColor}20`, borderColor: `${rarityColor}40` }}
        >
          {RARITY_LABELS[achievement.rarity].slice(0, 3)}
        </span>
      </div>

      {/* Description */}
      <p className={`text-[10px] leading-relaxed flex-1 ${isUnlocked ? 'text-dim' : 'text-dim/70'}`}>
        {achievement.description}
      </p>

      {/* XP reward */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-edge/50">
        <span className="text-[10px] font-mono tabular-nums text-amber">+{achievement.xp} XP</span>
        {isUnlocked && unlockedAt && (
          <span className="text-[9px] text-dim">{unlockedAt}</span>
        )}
      </div>

      {/* Unlocked badge */}
      {isUnlocked && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="px-3 py-1 rounded bg-green/20 border border-green/40 text-green text-[9px] font-bold tracking-wider">
            UNLOCKED
          </span>
        </div>
      )}

      {/* Locked overlay */}
      {!isUnlocked && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-panel/80 rounded-lg">
          <span className="text-4xl opacity-50">🔒</span>
        </div>
      )}
    </div>
  )
}

function FilterTabs({ active, onChange, options, label }) {
  return (
    <div className="flex flex-wrap gap-1" role="tablist" aria-label={label}>
      {options.map(opt => (
        <button
          key={opt}
          type="button"
          role="tab"
          aria-selected={active === opt}
          onClick={() => onChange(opt)}
          className={`px-3 py-1.5 rounded text-[10px] font-medium tracking-wider transition-colors ${
            active === opt
              ? 'bg-cyan/20 border border-cyan/50 text-cyan'
              : 'bg-panel border border-edge text-dim hover:border-cyan/30 hover:text-fg'
          }`}
        >
          {opt === 'all' ? 'All' : opt.charAt(0).toUpperCase() + opt.slice(1)}
        </button>
      ))}
    </div>
  )
}

function StatTile({ label, value, icon, color = 'cyan' }) {
  return (
    <div className="flex flex-col items-center gap-1 p-3 rounded bg-panel border border-edge">
      <span className="text-xl">{icon}</span>
      <span className={`text-2xl font-bold tabular-nums text-${color}`}>{value}</span>
      <span className="text-[9px] tracking-[0.15em] text-dim">{label}</span>
    </div>
  )
}

export default function AchievementGallery({ className = '' }) {
  const { unlocked, toasts, dismissToast, totalCommands, xp } = useGameStore()

  const [categoryFilter, setCategoryFilter] = useState('all')
  const [rarityFilter, setRarityFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('category') // category, rarity, name, xp, unlocked

  // Filter achievements
  const filteredAchievements = ACHIEVEMENTS.filter(a => {
    const isUnlocked = Boolean(unlocked[a.id])

    // Category filter
    if (categoryFilter !== 'all' && a.category !== categoryFilter) return false

    // Rarity filter
    if (rarityFilter !== 'all' && a.rarity !== rarityFilter) return false

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      if (!a.name.toLowerCase().includes(query) &&
          !a.description.toLowerCase().includes(query) &&
          !a.category.toLowerCase().includes(query)) {
        return false
      }
    }

    return true
  })

  // Sort achievements
  const sortedAchievements = [...filteredAchievements].sort((a, b) => {
    const aUnlocked = Boolean(unlocked[a.id])
    const bUnlocked = Boolean(unlocked[b.id])

    switch (sortBy) {
      case 'category':
        if (a.category !== b.category) return a.category.localeCompare(b.category)
        return a.name.localeCompare(b.name)
      case 'rarity':
        const rarityOrder = { legendary: 0, epic: 1, rare: 2, uncommon: 3, common: 4 }
        if (rarityOrder[a.rarity] !== rarityOrder[b.rarity]) {
          return rarityOrder[a.rarity] - rarityOrder[b.rarity]
        }
        return a.name.localeCompare(b.name)
      case 'name':
        return a.name.localeCompare(b.name)
      case 'xp':
        return b.xp - a.xp
      case 'unlocked':
        if (aUnlocked !== bUnlocked) return aUnlocked ? -1 : 1
        return a.name.localeCompare(b.name)
      default:
        return 0
    }
  })

  // Stats
  const total = ACHIEVEMENTS.length
  const count = ACHIEVEMENTS.filter(a => unlocked[a.id]).length
  const totalXp = ACHIEVEMENTS.filter(a => unlocked[a.id]).reduce((sum, a) => sum + a.xp, 0)
  const pct = total > 0 ? Math.round((count / total) * 100) : 0

  // Category counts
  const categoryCounts = {}
  for (const cat of ['discovery', 'mastery', 'boss', 'exploration', 'meta']) {
    const catAchievements = ACHIEVEMENTS.filter(a => a.category === cat)
    const catUnlocked = catAchievements.filter(a => unlocked[a.id]).length
    categoryCounts[cat] = { total: catAchievements.length, unlocked: catUnlocked }
  }

  // Rarity counts
  const rarityCounts = {}
  for (const rarity of ['common', 'uncommon', 'rare', 'epic', 'legendary']) {
    const rAchievements = ACHIEVEMENTS.filter(a => a.rarity === rarity)
    const rUnlocked = rAchievements.filter(a => unlocked[a.id]).length
    rarityCounts[rarity] = { total: rAchievements.length, unlocked: rUnlocked }
  }

  return (
    <div className={`panel flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="border-b border-edge p-4 flex flex-col gap-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <span className="glow-text text-xl font-bold text-purple">🏆</span>
            <div>
              <h2 className="text-lg font-bold tracking-widest text-purple">ACHIEVEMENTS</h2>
              <p className="text-[9px] tracking-[0.2em] text-dim">{count}/{total} unlocked · {totalXp} total XP</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatTile label="Progress" value={`${pct}%`} icon="📊" color="purple" />
            <StatTile label="XP Earned" value={totalXp} icon="✨" color="amber" />
            <StatTile label="Commands" value={totalCommands} icon="⌨️" color="cyan" />
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-2 overflow-hidden rounded-full bg-panel2">
          <div
            className="h-full rounded-full bg-gradient-to-r from-purple via-cyan to-amber transition-[width] duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              placeholder="Search achievements..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="flex-1 min-w-[150px] px-3 py-1.5 rounded bg-panel border border-edge text-fg placeholder-dim text-sm focus:border-cyan focus:outline-none"
            />
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="px-3 py-1.5 rounded bg-panel border border-edge text-fg text-sm focus:border-cyan focus:outline-none"
            >
              <option value="category">Sort: Category</option>
              <option value="rarity">Sort: Rarity</option>
              <option value="name">Sort: Name</option>
              <option value="xp">Sort: XP</option>
              <option value="unlocked">Sort: Unlocked First</option>
            </select>
          </div>

          <div className="flex flex-wrap gap-2">
            <FilterTabs
              active={categoryFilter}
              onChange={setCategoryFilter}
              options={CATEGORIES}
              label="Filter by category"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <FilterTabs
              active={rarityFilter}
              onChange={setRarityFilter}
              options={RARITIES}
              label="Filter by rarity"
            />
          </div>
        </div>
      </div>

      {/* Category progress summary */}
      <div className="border-b border-edge px-4 py-2 flex flex-wrap gap-2 overflow-x-auto">
        {Object.entries(categoryCounts).map(([cat, counts]) => (
          <div key={cat} className="flex items-center gap-1.5 px-2 py-1 rounded bg-panel border border-edge shrink-0">
            <span className="text-lg">{CATEGORY_ICONS[cat]}</span>
            <span className="text-[10px] font-medium text-fg">{CATEGORY_LABELS[cat]}</span>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono tabular-nums text-cyan bg-cyan/10">
              {counts.unlocked}/{counts.total}
            </span>
          </div>
        ))}
      </div>

      {/* Achievement grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {sortedAchievements.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-dim">
            <span className="text-4xl mb-2">🔍</span>
            <p className="text-sm">No achievements match your filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {sortedAchievements.map(a => (
              <AchievementCard
                key={a.id}
                achievement={a}
                unlocked={unlocked[a.id]}
                onDismiss={() => dismissToast(a.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Unlock toasts */}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
        {toasts.map(t => (
          <div
            key={`${t.id}-${t.unlockedAt}`}
            className="animate-toastIn pointer-events-auto flex items-center gap-3 rounded border border-purple/60 bg-panel2 px-4 py-3 shadow-[0_0_18px_rgba(167,139,250,0.35)]"
            role="status"
          >
            <span className="text-2xl leading-none">{t.icon}</span>
            <div className="min-w-0">
              <div className="text-[9px] tracking-[0.25em] text-purple">ACHIEVEMENT UNLOCKED</div>
              <div className="truncate text-sm font-bold text-fg">{t.name}</div>
              <div className="text-[10px] text-dim">
                {t.desc} <span className="text-amber">+{t.xp} XP</span>
              </div>
            </div>
            <button
              type="button"
              aria-label={`Dismiss ${t.name} notification`}
              className="ml-1 shrink-0 rounded border border-edge px-1.5 py-0.5 text-[10px] text-dim transition-colors hover:border-purple hover:text-purple"
              onClick={() => dismissToast(t.id)}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}