import { useGameStore } from '../store/gameStore.js'
import { COSMETICS, getCosmeticsByType, getCosmeticById, getDefaultCosmetic } from '../data/cosmetics.js'
import { cosmeticSystem } from '../systems/CosmeticSystem.js'

const COSMETIC_TYPES = [
  { key: 'playerSkin', label: 'PLAYER SKIN', icon: '💎', desc: 'Your avatar appearance' },
  { key: 'rexVariant', label: 'REX VARIANT', icon: '🤖', desc: 'Companion geometry' },
  { key: 'particleTrail', label: 'PARTICLE TRAIL', icon: '✨', desc: 'Movement effects' },
  { key: 'uiTheme', label: 'UI THEME', icon: '🎨', desc: 'Color scheme' },
  { key: 'title', label: 'TITLE', icon: '🏷️', desc: 'Display name prefix' },
]

const RARITY_COLORS = {
  common: '#64748b',
  uncommon: '#22d3ee',
  rare: '#a78bfa',
  epic: '#fbbf24',
  legendary: '#fb7185',
}

function CosmeticCard({ cosmetic, type, owned, equipped, onEquip, onUnlock, previewData }) {
  const isOwned = owned
  const isEquipped = equipped
  const canUnlock = !isOwned
  const rarityColor = RARITY_COLORS[cosmetic.rarity] || '#64748b'

  return (
    <div
      className={`relative group flex flex-col h-full rounded-lg border p-3 transition-all duration-200 ${
        isEquipped
          ? `border-${cosmetic.rarity} bg-${cosmetic.rarity}/10 shadow-[0_0_12px_${rarityColor}30]`
          : isOwned
            ? 'border-cyan/50 bg-cyan/5 hover:border-cyan hover:bg-cyan/10'
            : 'border-edge bg-panel/60 opacity-60 hover:opacity-80'
      }`}
      style={{ borderColor: isEquipped ? rarityColor : undefined }}
    >
      {/* Rarity indicator */}
      <div className="absolute -top-2 -right-2 w-2 h-2 rounded-full" style={{ backgroundColor: rarityColor }} />

      {/* Type-specific preview */}
      <div className="flex items-center justify-center mb-3 min-h-[80px]">
        {type === 'playerSkin' && (
          <div
            className="w-20 h-20 rounded-xl flex items-center justify-center text-4xl"
            style={{
              background: `linear-gradient(135deg, ${cosmetic.preview?.primary || '#22d3ee'}, ${cosmetic.preview?.secondary || '#06b6d4'})`,
              boxShadow: `0 0 20px ${cosmetic.preview?.glow || 'rgba(34, 211, 238, 0.5)'}`,
            }}
          >
            {cosmetic.icon}
          </div>
        )}
        {type === 'rexVariant' && (
          <div className="w-20 h-20 flex items-center justify-center text-5xl filter drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]">
            {cosmetic.icon}
          </div>
        )}
        {type === 'particleTrail' && (
          <div className="w-24 h-12 relative">
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full" style={{ backgroundColor: cosmetic.particles?.color || '#22d3ee' }} />
            <div className="absolute bottom-4 left-1/4 w-1.5 h-1.5 rounded opacity-70" style={{ backgroundColor: cosmetic.particles?.color || '#22d3ee' }} />
            <div className="absolute bottom-6 right-1/4 w-1.5 h-1.5 rounded opacity-50" style={{ backgroundColor: cosmetic.particles?.color || '#22d3ee' }} />
            <div className="absolute bottom-2 left-3/4 w-1 h-1 rounded opacity-40" style={{ backgroundColor: cosmetic.particles?.color || '#22d3ee' }} />
          </div>
        )}
        {type === 'uiTheme' && (
          <div className="w-24 h-16 rounded-lg border-2 flex items-center justify-center text-2xl" style={{
            backgroundColor: cosmetic.colors?.bg || '#0a0e14',
            borderColor: cosmetic.colors?.edge || '#1f2a3d',
          }}>
            {cosmetic.icon}
          </div>
        )}
        {type === 'title' && (
          <div className="w-24 h-10 rounded-lg flex items-center justify-center text-sm font-bold" style={{
            background: `linear-gradient(135deg, ${rarityColor}40, transparent)`,
            borderColor: rarityColor,
            color: rarityColor,
          }}>
            {cosmetic.format?.replace('{name}', 'Player') || cosmetic.name}
          </div>
        )}
      </div>

      {/* Name */}
      <h4 className={`text-sm font-bold text-center leading-tight mb-1 ${isOwned ? 'text-fg' : 'text-dim'}`}>
        {cosmetic.name}
      </h4>

      {/* Description */}
      <p className={`text-[10px] leading-relaxed flex-1 ${isOwned ? 'text-dim' : 'text-dim/70'}`}>
        {cosmetic.description}
      </p>

      {/* Action buttons */}
      <div className="flex items-center justify-center gap-2 mt-3 pt-2 border-t border-edge/50">
        {isEquipped ? (
          <button
            type="button"
            disabled
            className="flex-1 px-3 py-1.5 rounded bg-green/20 border border-green/40 text-green text-[10px] font-bold tracking-wider cursor-default"
          >
            EQUIPPED
          </button>
        ) : isOwned ? (
          <button
            type="button"
            onClick={onEquip}
            className="flex-1 px-3 py-1.5 rounded bg-cyan/20 border border-cyan/40 text-cyan text-[10px] font-bold tracking-wider hover:bg-cyan/30 transition-colors"
          >
            EQUIP
          </button>
        ) : (
          <button
            type="button"
            onClick={onUnlock}
            className="flex-1 px-3 py-1.5 rounded bg-amber/20 border border-amber/40 text-amber text-[10px] font-bold tracking-wider hover:bg-amber/30 transition-colors"
          >
            UNLOCK
          </button>
        )}
      </div>

      {/* Equipped badge */}
      {isEquipped && (
        <div className="absolute top-2 left-2">
          <span className="px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wider uppercase bg-green/20 border border-green/40 text-green">
            ACTIVE
          </span>
        </div>
      )}

      {/* Owned badge */}
      {isOwned && !isEquipped && (
        <div className="absolute top-2 left-2">
          <span className="px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wider uppercase bg-cyan/20 border border-cyan/40 text-cyan">
            OWNED
          </span>
        </div>
      )}

      {/* Locked overlay */}
      {!isOwned && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-panel/80 rounded-lg">
          <span className="text-3xl opacity-50">🔒</span>
        </div>
      )}
    </div>
  )
}

function CosmeticTypeSection({ type, label, icon, desc, cosmetics, ownedCosmetics, equippedCosmetics, onEquip, onUnlock }) {
  const typeCosmetics = cosmetics.filter(c => c.type === type)
  const typeOwned = typeCosmetics.filter(c => ownedCosmetics.includes(c.id))
  const typeEquipped = equippedCosmetics[type]

  return (
    <div className="panel flex flex-col">
      {/* Section header */}
      <div className="border-b border-edge p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{icon}</span>
          <div>
            <h3 className="text-lg font-bold tracking-widest text-fg">{label}</h3>
            <p className="text-[9px] tracking-[0.2em] text-dim">{desc}</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-mono tabular-nums text-cyan">{typeOwned.length}/{typeCosmetics.length}</div>
          <div className="text-[9px] text-dim">Owned</div>
        </div>
      </div>

      {/* Cosmetic grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {typeCosmetics.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-dim">
            <p className="text-sm">No cosmetics of this type</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {typeCosmetics.map(cosmetic => (
              <CosmeticCard
                key={cosmetic.id}
                cosmetic={cosmetic}
                type={type}
                owned={ownedCosmetics.includes(cosmetic.id)}
                equipped={equippedCosmetics[type] === cosmetic.id}
                onEquip={() => onEquip(cosmetic.id)}
                onUnlock={() => onUnlock(cosmetic.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function CosmeticLocker({ className = '' }) {
  const {
    ownedCosmetics,
    equippedCosmetic,
    unlockCosmetic,
    equipCosmetic,
    level,
    unlocked,
  } = useGameStore()

  // Check unlock criteria for display
  const getUnlockStatus = (cosmetic) => {
    if (ownedCosmetics.includes(cosmetic.id)) return { unlocked: true }
    const criteria = cosmetic.unlockCriteria
    if (!criteria) return { unlocked: false, reason: 'Unknown' }
    if (criteria.default) return { unlocked: true }
    if (criteria.level && level < criteria.level) return { unlocked: false, reason: `Level ${criteria.level} required` }
    if (criteria.achievement && !unlocked[criteria.achievement]) return { unlocked: false, reason: `Achievement: ${criteria.achievement}` }
    return { unlocked: false, reason: 'Requirements not met' }
  }

  const handleEquip = (cosmeticId) => {
    equipCosmetic(cosmeticId)
  }

  const handleUnlock = (cosmeticId) => {
    unlockCosmetic(cosmeticId)
  }

  return (
    <div className={`panel flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="border-b border-edge p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="glow-text text-xl font-bold text-purple">🎨</span>
          <div>
            <h2 className="text-lg font-bold tracking-widest text-purple">COSMETIC LOCKER</h2>
            <p className="text-[9px] tracking-[0.2em] text-dim">Customize your look — {ownedCosmetics.length}/{COSMETICS.length} unlocked</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Equipped summary */}
          <div className="flex gap-1">
            {COSMETIC_TYPES.map(t => {
              const equipped = equippedCosmetic[t.key]
              const cosmetic = equipped ? getCosmeticById(equipped) : getDefaultCosmetic(t.key)
              return (
                <div key={t.key} className="w-8 h-8 rounded border-2 flex items-center justify-center text-sm" style={{ borderColor: cosmetic ? RARITY_COLORS[cosmetic.rarity] : 'var(--edge)' }} title={cosmetic?.name || 'None'}>
                  {cosmetic?.icon || '—'}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Type tabs */}
      <div className="border-b border-edge flex overflow-x-auto" role="tablist">
        {COSMETIC_TYPES.map(t => (
          <button
            key={t.key}
            type="button"
            role="tab"
            className="shrink-0 px-4 py-2 text-sm font-medium tracking-wider text-dim hover:text-fg hover:bg-panel/50 border-b-2 border-transparent hover:border-cyan/50 transition-colors whitespace-nowrap"
            onClick={() => {}}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Cosmetic sections - vertically stacked for now, could be tabbed */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4">
          {COSMETIC_TYPES.map(t => (
            <CosmeticTypeSection
              key={t.key}
              type={t.key}
              label={t.label}
              icon={t.icon}
              desc={t.desc}
              cosmetics={COSMETICS}
              ownedCosmetics={ownedCosmetics}
              equippedCosmetics={equippedCosmetic}
              onEquip={handleEquip}
              onUnlock={handleUnlock}
            />
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="border-t border-edge px-4 py-3 bg-panel/30">
        <div className="flex flex-wrap items-center gap-4 text-[10px] text-dim">
          <span className="font-bold text-fg">Rarity:</span>
          {Object.entries(RARITY_COLORS).map(([rarity, color]) => (
            <span key={rarity} className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
              {rarity.charAt(0).toUpperCase() + rarity.slice(1)}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}