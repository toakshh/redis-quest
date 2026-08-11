import { useGameStore } from '../store/gameStore.js'
import { REGIONS } from '../data/regions.js'
import { SKILLS } from '../data/skills.js'

const RARITY_COLORS = {
  common: '#64748b',
  uncommon: '#22d3ee',
  rare: '#a78bfa',
  epic: '#fbbf24',
  legendary: '#fb7185',
}

function SkillNode({ skill, unlocked, canUnlock, prerequisitesMet, onUnlock, skillPoints }) {
  const isLocked = !unlocked && !canUnlock
  const isAvailable = !unlocked && canUnlock
  const cost = skill.xpCost

  return (
    <div
      className={`relative flex flex-col items-center gap-1.5 px-2 py-2 transition-all duration-200 ${
        unlocked
          ? 'opacity-100 scale-100'
          : isAvailable
            ? 'opacity-100 scale-105 hover:scale-110 cursor-pointer'
            : 'opacity-40 scale-95 cursor-not-allowed'
      }`}
    >
      {/* Connection lines to prerequisites - visual only */}
      <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-px h-2 bg-edge" />

      {/* Skill icon */}
      <button
        type="button"
        onClick={onUnlock}
        disabled={isLocked || unlocked}
        aria-label={unlocked ? `${skill.name} (Unlocked)` : isAvailable ? `${skill.name} — ${cost} SP to unlock` : `${skill.name} — Locked`}
        className={`relative w-14 h-14 rounded-lg border-2 flex items-center justify-center text-2xl transition-all duration-200 ${
          unlocked
            ? 'border-cyan bg-cyan/10 shadow-[0_0_12px_rgba(34,211,238,0.3)]'
            : isAvailable
              ? 'border-amber bg-amber/10 hover:border-amber hover:bg-amber/20 shadow-[0_0_8px_rgba(251,191,36,0.2)]'
              : 'border-edge bg-panel/50'
        }`}
      >
        {unlocked && <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-green flex items-center justify-center text-[10px] font-bold text-bg">✓</span>}
        {isAvailable && !unlocked && (
          <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-amber flex items-center justify-center text-[9px] font-bold text-bg">
            {cost}
          </span>
        )}
        {skill.icon}
      </button>

      {/* Skill name */}
      <span
        className={`text-[10px] font-medium text-center leading-tight max-w-[100px] ${
          unlocked ? 'text-fg' : isAvailable ? 'text-amber' : 'text-dim'
        }`}
      >
        {skill.name}
      </span>

      {/* Cost for locked but available */}
      {isAvailable && (
        <span className="text-[9px] text-amber font-mono tabular-nums">{cost} SP</span>
      )}

      {/* Locked indicator */}
      {isLocked && !prerequisitesMet && (
        <span className="text-[8px] text-red">🔒</span>
      )}
    </div>
  )
}

function RegionPanel({ regionId, region, skills, skillPoints, onUnlockSkill }) {
  const regionSkills = skills.filter(s => s.regionId === regionId)
  const unlockedCount = regionSkills.filter(s => s.unlocked).length
  const totalCount = regionSkills.length
  const regionUnlocked = region.unlocked

  if (!regionUnlocked) {
    return (
      <div className="panel p-4 text-center opacity-50">
        <div className="text-4xl mb-2">🌑</div>
        <div className="text-sm font-bold text-dim">{region.name}</div>
        <div className="text-[10px] text-dim mt-1">Locked — Complete prerequisites</div>
      </div>
    )
  }

  return (
    <div className="panel p-4 min-w-[220px] flex-1 flex flex-col">
      {/* Region header */}
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-edge">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-xl"
            style={{ backgroundColor: region.color + '20' }}
          >
            {region.icon || '🌟'}
          </div>
          <div>
            <div className="text-sm font-bold text-fg">{region.name}</div>
            <div className="text-[10px] text-dim">{unlockedCount}/{totalCount} skills</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-amber font-mono">{skillPoints} SP</div>
          <div className="text-[10px] text-dim">Available</div>
        </div>
      </div>

      {/* Skill grid - organized by prerequisites */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-3 gap-2">
          {regionSkills.map(skill => (
            <SkillNode
              key={skill.id}
              skill={skill}
              unlocked={skill.unlocked}
              canUnlock={skill.canUnlock}
              prerequisitesMet={skill.prerequisitesMet}
              onUnlock={() => onUnlockSkill(skill.id)}
              skillPoints={skillPoints}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export default function SkillTreePanel({ className = '' }) {
  const {
    unlockedSkills,
    unlockedRegions,
    skillPoints,
    level,
    currentRegion,
    unlockSkill,
    addSkillPoints,
  } = useGameStore()

  // Build skills with computed unlock states
  const skillsWithState = SKILLS.map(skill => ({
    ...skill,
    unlocked: unlockedSkills[skill.id] === true,
    canUnlock: (() => {
      const check = skillTreeSystem.canUnlock(skill.id, {
        unlockedRegions,
        unlockedSkills,
      })
      return check.can
    })(),
    prerequisitesMet: skill.prerequisites.every(p => unlockedSkills[p]),
  }))

  // Need access to skillTreeSystem for canUnlock checks
  // We'll import it or compute locally
  // For now, let's compute canUnlock inline
  const skillTreeSystem = {
    canUnlock(skillId, state) {
      const skill = SKILLS.find(s => s.id === skillId)
      if (!skill) return { can: false, reason: 'Skill not found' }
      if (unlockedSkills[skillId]) return { can: false, reason: 'Already unlocked' }

      // Check prerequisites
      for (const prereqId of skill.prerequisites) {
        if (!unlockedSkills[prereqId]) {
          const prereq = SKILLS.find(s => s.id === prereqId)
          return { can: false, reason: `Requires: ${prereq?.name || prereqId}` }
        }
      }

      // Check region unlocked
      if (!state.unlockedRegions[skill.regionId] && skill.regionId !== 'strings') {
        return { can: false, reason: `Region locked: ${skill.regionId}` }
      }

      // Check skill points
      if (skillPoints < skill.xpCost) {
        return { can: false, reason: `Need ${skill.xpCost} SP (have ${skillPoints})` }
      }

      return { can: true }
    },
  }

  const handleUnlock = (skillId) => {
    const result = unlockSkill(skillId)
    if (result.success) {
      // Visual feedback handled by errorMessageSystem
    }
  }

  // Sort regions by unlock order (using position or order in REGIONS)
  const sortedRegions = [...REGIONS].sort((a, b) => a.position.y - b.position.y)

  return (
    <div className={`panel flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="border-b border-edge px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="glow-text text-xl font-bold text-amber">⭐</span>
          <div>
            <h2 className="text-lg font-bold tracking-widest text-amber">SKILL TREE</h2>
            <p className="text-[9px] tracking-[0.2em] text-dim">Spend SP to unlock Redis commands</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {/* SP Display */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-amber/10 border border-amber/30">
            <span className="text-[10px] tracking-[0.2em] text-amber">SKILL POINTS</span>
            <span className="text-xl font-bold tabular-nums text-amber">{skillPoints}</span>
          </div>
          {/* Level */}
          <div className="text-right">
            <div className="text-[10px] text-dim">LEVEL</div>
            <div className="text-lg font-bold text-cyan">{level}</div>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="border-b border-edge px-4 py-2">
        <div className="flex items-center justify-between text-[10px] text-dim mb-1">
          <span>Overall Progress</span>
          <span>{Object.keys(unlockedSkills).length}/60 skills</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-panel2">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan via-amber to-purple transition-[width] duration-500"
            style={{ width: `${(Object.keys(unlockedSkills).length / 60) * 100}%` }}
          />
        </div>
      </div>

      {/* Regions grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {sortedRegions.map(region => (
            <RegionPanel
              key={region.id}
              regionId={region.id}
              region={{
                ...region,
                unlocked: unlockedRegions[region.id] === true || region.id === 'strings',
                icon: region.id === 'strings' ? '📝' : region.id === 'hashes' ? '🗂️' :
                      region.id === 'lists' ? '📋' : region.id === 'sets' ? '🔘' :
                      region.id === 'zsets' ? '📈' : region.id === 'keyspace' ? '🔑' :
                      region.id === 'pubsub' ? '📡' : region.id === 'transactions' ? '📦' :
                      region.id === 'scripts' ? '📜' : region.id === 'streams' ? '🌊' :
                      region.id === 'clustering' ? '🌟' : '🔮',
              }}
              skills={skillsWithState}
              skillPoints={skillPoints}
              onUnlockSkill={handleUnlock}
            />
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="border-t border-edge px-4 py-3 bg-panel/30">
        <div className="flex flex-wrap items-center gap-4 text-[10px] text-dim">
          <span className="font-bold text-fg">Legend:</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded border-2 border-cyan bg-cyan/10" /> Unlocked</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded border-2 border-amber bg-amber/10" /> Available</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded border-2 border-edge bg-panel/50 opacity-40" /> Locked</span>
          <span className="flex items-center gap-1 ml-auto">🔒 Prerequisites not met</span>
        </div>
      </div>
    </div>
  )
}