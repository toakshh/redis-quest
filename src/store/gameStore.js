// Central game state for Redis Quest: player XP, the boss battle, and the
// achievement system. The store binds to the app's singleton engine and reacts
// to every command (whether routed through runCommand or executed directly on
// the engine) via the engine's change/error events, so boss challenges and
// achievements always stay in sync with what the player actually ran.
//
// The engine itself lives outside the store (App.jsx owns the instance); the
// store just keeps a reference so it can inspect keys for challenge validation
// and read stats for achievement tracking.
//
// PHASE 4 EXTENSIONS:
// - Region progression & skill trees
// - Cosmetic system (skins, REX variants, trails, themes, titles)
// - Juice & polish (screen shake, particles, hit pause, flash)
// - Educational error/success feedback via REX
// - Beginner vs Pro modes with differential settings
// - Save/load persistence with schema versioning

import { create } from 'zustand'
import { persist, subscribeWithSelector } from 'zustand/middleware'

import { eventBus, EVENTS } from '../engine/EventBus.js'
import { createEngine } from '../engine/engine.js'

import { ACHIEVEMENTS as NEW_ACHIEVEMENTS } from '../data/achievements.js'
import { RARITY_COLORS, RARITY_LABELS, CATEGORY_LABELS, CATEGORY_ICONS } from '../data/achievements.js'
import { REGIONS } from '../data/regions.js'
import { SKILLS } from '../data/skills.js'
import { COSMETICS, getDefaultCosmetic } from '../data/cosmetics.js'
import { createDefaultState, SCHEMA_VERSION } from '../systems/SaveManager.js'
import { achievementSystem } from '../systems/AchievementSystem.js'
import { skillTreeSystem } from '../systems/SkillTreeSystem.js'
import { regionSystem } from '../systems/RegionSystem.js'
import { cosmeticSystem } from '../systems/CosmeticSystem.js'
import { juiceSystem } from '../systems/JuiceSystem.js'
import { errorMessageSystem } from '../systems/ErrorMessageSystem.js'
import { saveManager } from '../systems/SaveManager.js'

// Use new achievements catalog
export const ACHIEVEMENTS = NEW_ACHIEVEMENTS

// Export achievement constants
export { RARITY_COLORS, RARITY_LABELS, CATEGORY_LABELS, CATEGORY_ICONS }

// ---------------------------------------------------------------------------
// Derived helpers
// ---------------------------------------------------------------------------

export const XP_PER_LEVEL = 1000

export function levelInfo(xp) {
  const level = Math.floor(xp / XP_PER_LEVEL) + 1
  const xpIntoLevel = xp % XP_PER_LEVEL
  const xpForNext = XP_PER_LEVEL
  return { level, xpIntoLevel, xpForNext }
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

let handling = false

const initialState = () => createDefaultState()

export const useGameStore = create(
  subscribeWithSelector(
    persist(
      (set, get) => {
        function unlockAchievement(id) {
          const def = ACHIEVEMENTS.find((a) => a.id === id)
          if (!def || get().unlocked[id]) return
          const newXp = get().xp + def.xp
          const newLevel = levelInfo(newXp).level
          const oldLevel = levelInfo(get().xp).level
          set((s) => ({
            unlocked: { ...s.unlocked, [id]: Date.now() },
            toasts: [...s.toasts, { ...def, unlockedAt: Date.now() }],
            xp: newXp,
            level: newLevel,
          }))
          // Check level up
          if (newLevel > oldLevel) {
            eventBus.emit(EVENTS.LEVEL_UP, { level: newLevel, previousLevel: oldLevel })
            errorMessageSystem.processLevelUp(newLevel)
            // Grant skill points on level up
            skillTreeSystem.addSkillPoints(newLevel - oldLevel)
            set({ skillPoints: skillTreeSystem.skillPoints })
          }
          // Grant skill points from achievement
          skillTreeSystem.addSkillPoints(0) // achievementSystem handles XP, not SP
        }

        function syncStats() {
          const engine = get().engine
          if (!engine) return
          const stats = engine.stats
          const used = new Set(get().datatypesUsed)
          const datatypeCounts = { ...get().datatypeCounts }
          for (const name of Object.keys(stats.commandsByType)) {
            const group = engine.commandRegistry.get(name)?.group
            if (group) {
              used.add(group)
              datatypeCounts[group] = (datatypeCounts[group] || 0) + stats.commandsByType[name]
            }
          }
          // Track max transaction size
          const maxTransactionSize = get().maxTransactionSize
          if (engine.multiQueue && engine.multiQueue.length > maxTransactionSize) {
            set({ maxTransactionSize: engine.multiQueue.length })
          }
          set({ totalCommands: stats.totalCommands, datatypesUsed: [...used], datatypeCounts })
        }

        function attackBoss(damage, info = {}) {
          const state = get()
          const boss = state.boss
          if (!boss || boss.defeated || boss.health <= 0) return
          const xpGain = info.xp ?? Math.max(1, Math.round(damage / 2))
          const nextHealth = Math.max(0, boss.health - damage)
          const challengeIndex = info.challenge ? boss.challengeIndex + 1 : boss.challengeIndex
          const defeated = nextHealth <= 0 || challengeIndex >= boss.challenges.length
          set((s) => ({
            xp: s.xp + xpGain,
            boss: {
              ...boss,
              health: nextHealth,
              challengeIndex,
              defeated,
              lastResult: {
                at: Date.now(),
                ok: true,
                damage,
                xp: xpGain,
                message: defeated
                  ? `DATA SECURED — ${boss.name} dismantled`
                  : `SHIELD BREACHED −${damage} HP`,
                challenge: info.challenge,
              },
            },
            bossHistory: defeated
              ? [...s.bossHistory, { id: boss.id, name: boss.name, won: true, at: Date.now(), xp: xpGain, durationMs: Date.now() - (s.boss?.engagedAt || Date.now()), challengesSolved: challengeIndex, totalChallenges: boss.challenges.length, wrongCommands: s.boss?.wrongCommands || 0 }]
              : s.bossHistory,
          }))
          if (defeated) unlockAchievement('boss-defeated')
        }

        function checkBoss(reply) {
          const { engine, boss } = get()
          if (!engine || !boss || boss.defeated || boss.health <= 0) return
          const challenge = boss.challenges[boss.challengeIndex]
          if (!challenge) return

          let solved = false
          try {
            solved = challenge.check(engine, engine.store.get(challenge.key))
          } catch {
            solved = false
          }

          if (solved) {
            attackBoss(challenge.damage, { xp: challenge.xp, challenge })
          } else if (reply && reply.type === 'error') {
            set((s) => ({
              boss: {
                ...s.boss,
                wrongCommands: (s.boss?.wrongCommands || 0) + 1,
                lastResult: {
                  at: Date.now(),
                  ok: false,
                  damage: 0,
                  xp: 0,
                  message: 'SHIELD HOLDS — the vault rejects that.',
                  hint: challenge.hint,
                },
              },
            }))
          }
        }

        function checkAchievements() {
          const { totalCommands, datatypesUsed, commandsByType, datatypeCounts, maxTransactionSize, bossHistory, unlockedSkills, unlockedRegions, mode, fastTravelCount, saveAgeDays, totalErrors } = get()
          const state = get()
          for (const achievement of ACHIEVEMENTS) {
            if (get().unlocked[achievement.id]) continue
            try {
              if (achievement.criteria(state)) {
                unlockAchievement(achievement.id)
              }
            } catch (e) {
              console.warn(`Achievement check failed for ${achievement.id}:`, e)
            }
          }
        }

        function afterCommand(reply, commandName, args) {
          syncStats()
          checkAchievements()
          checkBoss(reply)

          // Process error/success feedback
          if (reply && reply.type === 'error') {
            errorMessageSystem.processError(reply, commandName, args)
          } else {
            errorMessageSystem.processSuccess(reply, commandName, args, get())
          }

          // Check region unlocks
          const unlockedRegions = get().unlockedRegions
          for (const region of REGIONS) {
            if (!unlockedRegions[region.id]) {
              const check = regionSystem.canUnlock(region.id, get())
              if (check.can) {
                regionSystem.unlock(region.id, get())
                set({ unlockedRegions: { ...unlockedRegions, [region.id]: true } })
                errorMessageSystem.processRegionUnlock(region)
              }
            }
          }
        }

        // Periodic auto-save
        let autoSaveInterval = null

        function startAutoSave() {
          if (autoSaveInterval) clearInterval(autoSaveInterval)
          const interval = get().autoSaveInterval
          autoSaveInterval = setInterval(() => {
            saveManager.autoSave(get())
          }, interval)
        }

        function stopAutoSave() {
          if (autoSaveInterval) clearInterval(autoSaveInterval)
          autoSaveInterval = null
        }

        return {
          ...initialState(),

          // Engine binding
          bindEngine(engine) {
            if (get().engine) return
            set({ engine })
            engine.on('change', () => {
              if (handling) return
              afterCommand()
            })
            engine.on('error', () => {
              if (handling) return
              afterCommand()
            })
            engine.on('command', ({ name, args, reply }) => {
              eventBus.emit(EVENTS.COMMAND_EXECUTED, { name, args, reply, isError: reply?.type === 'error' })
            })
            // Start auto-save
            startAutoSave()
            // Initialize systems
            achievementSystem.init(Object.keys(get().unlocked))
            skillTreeSystem.init(Object.keys(get().unlockedSkills), get().skillPoints)
            regionSystem.init(Object.keys(get().unlockedRegions), get().currentRegion, Object.keys(get().unlockedRegions), get().fastTravelCount)
            cosmeticSystem.init(get().ownedCosmetics, get().equippedCosmetic)
            // Apply theme on load
            document.documentElement.style.cssText = Object.entries(cosmeticSystem.getThemeCSS())
              .map(([k, v]) => `${k}: ${v};`)
              .join(' ')
          },

          // Command execution
          runCommand(line) {
            const engine = get().engine
            if (!engine) return { type: 'error', value: 'ERR engine not initialised' }
            handling = true
            let reply
            try {
              reply = engine.execute(line)
            } finally {
              handling = false
            }
            const tokens = line.trim().split(/\s+/)
            const commandName = tokens[0] || ''
            const args = tokens.slice(1)
            afterCommand(reply, commandName, args)
            return reply
          },

          // XP
          addXp(amount) {
            if (amount > 0) {
              const newXp = get().xp + amount
              const newLevel = levelInfo(newXp).level
              const oldLevel = levelInfo(get().xp).level
              set((s) => ({ xp: newXp, level: newLevel }))
              eventBus.emit(EVENTS.XP_GAINED, { amount, source: 'manual' })
              errorMessageSystem.processXPGain(amount, 'manual')
              if (newLevel > oldLevel) {
                eventBus.emit(EVENTS.LEVEL_UP, { level: newLevel, previousLevel: oldLevel })
                errorMessageSystem.processLevelUp(newLevel)
                skillTreeSystem.addSkillPoints(newLevel - oldLevel)
                set({ skillPoints: skillTreeSystem.skillPoints })
              }
            }
          },

          // Boss
          attackBoss,
          async startBattle(bossId = 'neon-serpent') {
            const engine = get().engine
            const { BOSSES } = await import('../store/gameStore.js') // avoid circular
            const def = BOSSES.find(b => b.id === bossId) || BOSSES[0]
            const QUEST_KEYS = def.challenges.map(c => c.key)
            if (engine) {
              try {
                engine.rawExecute('DEL', ...QUEST_KEYS)
              } catch {
                /* engine too hot to touch — fight on whatever is there */
              }
            }
            set((s) => ({
              boss: {
                id: def.id,
                name: def.name,
                title: def.title,
                maxHealth: def.maxHealth,
                health: def.maxHealth,
                challengeIndex: 0,
                challenges: def.challenges,
                defeated: false,
                engagedAt: Date.now(),
                wrongCommands: 0,
                lastResult: {
                  at: Date.now(),
                  ok: true,
                  damage: 0,
                  xp: 0,
                  message: `ENGAGED — ${def.name} rises.`,
                },
              },
            }))
            eventBus.emit(EVENTS.BOSS_ENGAGED, { bossId: def.id, name: def.name })
          },

          // Achievements
          unlockAchievement,
          dismissToast(id) {
            set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
          },

          // Skills
          unlockSkill(skillId) {
            const result = skillTreeSystem.unlock(skillId, get())
            if (result.success) {
              set((s) => ({
                unlockedSkills: { ...s.unlockedSkills, [skillId]: true },
                skillPoints: result.remainingSP,
              }))
              errorMessageSystem.processSkillUnlock(result.skill)
            }
            return result
          },
          resetSkills(regionId) {
            const result = regionId ? skillTreeSystem.resetRegion(regionId) : skillTreeSystem.resetAll()
            set({ skillPoints: result.totalSP, unlockedSkills: {} })
            // Re-add default skills for unlocked regions? No, full reset.
            return result
          },
          addSkillPoints(amount) {
            skillTreeSystem.addSkillPoints(amount)
            set({ skillPoints: skillTreeSystem.skillPoints })
          },

          // Regions
          unlockRegion(regionId) {
            const result = regionSystem.unlock(regionId, get())
            if (result.success) {
              set((s) => ({ unlockedRegions: { ...s.unlockedRegions, [regionId]: true } }))
            }
            return result
          },
          enterRegion(regionId) {
            const result = regionSystem.enterRegion(regionId)
            if (result.success) {
              set({ currentRegion: regionId })
            }
            return result
          },
          fastTravel(regionId) {
            const result = regionSystem.fastTravel(regionId)
            if (result.success) {
              set({ currentRegion: regionId, fastTravelCount: result.fastTravelCount })
            }
            return result
          },

          // Cosmetics
          unlockCosmetic(cosmeticId) {
            const result = cosmeticSystem.unlock(cosmeticId, get())
            if (result.success) {
              set((s) => ({ ownedCosmetics: [...s.ownedCosmetics, cosmeticId] }))
            }
            return result
          },
          equipCosmetic(cosmeticId) {
            const result = cosmeticSystem.equip(cosmeticId)
            if (result.success) {
              set({ equippedCosmetic: { ...get().equippedCosmetic, [result.cosmetic.type]: cosmeticId } })
              // Apply theme immediately
              if (result.cosmetic.type === 'uiTheme') {
                document.documentElement.style.cssText = Object.entries(cosmeticSystem.getThemeCSS())
                  .map(([k, v]) => `${k}: ${v};`)
                  .join(' ')
              }
            }
            return result
          },

          // Settings / Mode
          setMode(mode) {
            const autoSaveInterval = mode === 'pro' ? 60000 : 30000
            const hintDepth = mode === 'pro' ? 'minimal' : 'full'
            const visualGuides = mode !== 'pro'
            set({ mode, autoSaveInterval, hintDepth, visualGuides })
            errorMessageSystem.setShowHints(hintDepth !== 'none')
            startAutoSave()
            eventBus.emit(EVENTS.MODE_CHANGED, { mode })
          },
          setHintDepth(depth) {
            set({ hintDepth: depth })
            errorMessageSystem.setShowHints(depth !== 'none')
          },
          setVisualGuides(enabled) {
            set({ visualGuides: enabled })
          },
          setSpeedrunTimer(enabled) {
            set({ speedrunTimer: enabled })
          },

          // Save/Load
          saveGame(slot) {
            const state = get()
            const engineSnap = state.engine?.snapshot()
            const saveState = {
              ...state,
              engineSnapshot: engineSnap,
              sessionStartTime: Date.now(), // Will be recalculated on load
            }
            return saveManager.save(slot, saveState)
          },
          loadGame(slot) {
            const loaded = saveManager.load(slot)
            if (!loaded) return false

            // Restore engine
            if (loaded.engineSnapshot && get().engine) {
              get().engine.restore(loaded.engineSnapshot)
            }

            // Restore systems
            achievementSystem.deserialize({ unlocked: Object.keys(loaded.unlocked), progress: {} })
            skillTreeSystem.deserialize({ unlocked: Object.keys(loaded.unlockedSkills), skillPoints: loaded.skillPoints })
            regionSystem.deserialize({
              unlocked: Object.keys(loaded.unlockedRegions),
              currentRegion: loaded.currentRegion,
              discovered: Object.keys(loaded.unlockedRegions),
              fastTravelCount: loaded.fastTravelCount,
            })
            cosmeticSystem.deserialize({
              owned: loaded.ownedCosmetics,
              equipped: loaded.equippedCosmetic,
            })

            // Apply theme
            document.documentElement.style.cssText = Object.entries(cosmeticSystem.getThemeCSS())
              .map(([k, v]) => `${k}: ${v};`)
              .join(' ')

            set({
              ...loaded,
              engine: get().engine, // Keep engine reference
              sessionStartTime: Date.now(),
            })
            startAutoSave()
            return true
          },
          resetGame() {
            handling = false
            stopAutoSave()
            achievementSystem.reset()
            skillTreeSystem.reset()
            regionSystem.reset()
            cosmeticSystem.reset()
            juiceSystem.destroy()
            errorMessageSystem.reset()
            saveManager.resetAll()
            set(initialState())
          },

          // Export/Import
          exportSave(slot) {
            return saveManager.exportSave(slot)
          },
          importSave(jsonString, targetSlot) {
            return saveManager.importSave(jsonString, targetSlot)
          },
          getSaveSlots() {
            return saveManager.getSlots()
          },
          deleteSaveSlot(slot) {
            saveManager.deleteSlot(slot)
          },

          // Juice system access
          getJuiceSystem() {
            return juiceSystem
          },

          // Error system access
          getErrorSystem() {
            return errorMessageSystem
          },
        }
      },
      {
        name: 'redis-quest-game',
        version: SCHEMA_VERSION,
        partialize: (state) => ({
          // Only persist serializable state
          xp: state.xp,
          level: state.level,
          totalCommands: state.totalCommands,
          totalErrors: state.totalErrors,
          commandsByType: state.commandsByType,
          datatypeCounts: state.datatypeCounts,
          datatypesUsed: state.datatypesUsed,
          maxTransactionSize: state.maxTransactionSize,
          unlocked: state.unlocked,
          unlockedSkills: state.unlockedSkills,
          unlockedRegions: state.unlockedRegions,
          currentRegion: state.currentRegion,
          skillPoints: state.skillPoints,
          ownedCosmetics: state.ownedCosmetics,
          equippedCosmetic: state.equippedCosmetic,
          boss: state.boss,
          bossHistory: state.bossHistory,
          mode: state.mode,
          autoSaveInterval: state.autoSaveInterval,
          hintDepth: state.hintDepth,
          visualGuides: state.visualGuides,
          speedrunTimer: state.speedrunTimer,
          playTimeMs: state.playTimeMs,
          fastTravelCount: state.fastTravelCount,
          saveAgeDays: state.saveAgeDays,
          firstSaveTime: state.firstSaveTime,
        }),
      }
    )
  )
)