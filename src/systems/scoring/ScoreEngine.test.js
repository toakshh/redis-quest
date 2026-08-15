import { describe, it, expect } from 'vitest'
import {
  calculateIncidentScore,
  calculateRank,
  ScoreEngine,
  RANK_THRESHOLDS,
} from './ScoreEngine.js'

describe('ScoreEngine', () => {
  describe('calculateRank', () => {
    it('returns rank S for scores >= 900', () => {
      expect(calculateRank(1000)).toBe('S')
      expect(calculateRank(900)).toBe('S')
    })

    it('returns rank A for scores between 750 and 899', () => {
      expect(calculateRank(899)).toBe('A')
      expect(calculateRank(750)).toBe('A')
    })

    it('returns rank B for scores between 600 and 749', () => {
      expect(calculateRank(749)).toBe('B')
      expect(calculateRank(600)).toBe('B')
    })

    it('returns rank C for scores < 600', () => {
      expect(calculateRank(599)).toBe('C')
      expect(calculateRank(300)).toBe('C')
      expect(calculateRank(0)).toBe('C')
    })
  })

  describe('calculateIncidentScore', () => {
    it('calculates perfect score (1000) and rank S for ideal metrics', () => {
      const metrics = {
        resolutionTime: 30,
        targetTime: 60,
        commandsUsed: 4,
        optimalCommands: 5,
        unnecessaryWrites: 0,
        hintsUsed: 0,
        systemHealth: 100,
      }

      const result = calculateIncidentScore(metrics)
      expect(result.score).toBe(1000)
      expect(result.rank).toBe('S')
      expect(result.breakdown).toEqual({
        systemHealthScore: 300,
        timeScore: 350,
        commandScore: 350,
        unnecessaryWritePenalty: 0,
        hintPenalty: 0,
        rawScore: 1000,
        finalScore: 1000,
        resolutionTime: 30,
        targetTime: 60,
        commandsUsed: 4,
        optimalCommands: 5,
        unnecessaryWrites: 0,
        hintsUsed: 0,
        systemHealth: 100,
      })
    })

    it('handles empty or missing metrics with safe defaults', () => {
      const result = calculateIncidentScore()
      expect(result.score).toBe(1000)
      expect(result.rank).toBe('S')
      expect(result.breakdown).toBeDefined()
    })

    it('penalizes resolution time exceeding target time', () => {
      const baseMetrics = {
        resolutionTime: 60,
        targetTime: 60,
        commandsUsed: 5,
        optimalCommands: 5,
        unnecessaryWrites: 0,
        hintsUsed: 0,
        systemHealth: 100,
      }

      const perfect = calculateIncidentScore(baseMetrics)
      expect(perfect.breakdown.timeScore).toBe(350)

      // 10 seconds excess time (10 * 5 = 50 pt penalty)
      const delayed = calculateIncidentScore({
        ...baseMetrics,
        resolutionTime: 70,
      })
      expect(delayed.breakdown.timeScore).toBe(300)
      expect(delayed.score).toBe(950)
    })

    it('penalizes command count exceeding optimal commands', () => {
      const baseMetrics = {
        resolutionTime: 50,
        targetTime: 60,
        commandsUsed: 5,
        optimalCommands: 5,
        unnecessaryWrites: 0,
        hintsUsed: 0,
        systemHealth: 100,
      }

      // 2 excess commands (2 * 30 = 60 pt penalty)
      const result = calculateIncidentScore({
        ...baseMetrics,
        commandsUsed: 7,
      })
      expect(result.breakdown.commandScore).toBe(290)
      expect(result.score).toBe(940)
    })

    it('penalizes unnecessary writes and hint usage', () => {
      const result = calculateIncidentScore({
        resolutionTime: 50,
        targetTime: 60,
        commandsUsed: 5,
        optimalCommands: 5,
        unnecessaryWrites: 2, // 100 pt penalty
        hintsUsed: 1, // 50 pt penalty
        systemHealth: 100,
      })

      expect(result.breakdown.unnecessaryWritePenalty).toBe(100)
      expect(result.breakdown.hintPenalty).toBe(50)
      expect(result.score).toBe(850)
      expect(result.rank).toBe('A')
    })

    it('evaluates system health percentage proportionately', () => {
      const result = calculateIncidentScore({
        resolutionTime: 50,
        targetTime: 60,
        commandsUsed: 5,
        optimalCommands: 5,
        unnecessaryWrites: 0,
        hintsUsed: 0,
        systemHealth: 50, // 50% health = 150 pts out of 300
      })

      expect(result.breakdown.systemHealthScore).toBe(150)
      expect(result.score).toBe(850)
      expect(result.rank).toBe('A')
    })

    it('clamps scores to minimum 0 and maximum 1000', () => {
      const severeRun = calculateIncidentScore({
        resolutionTime: 300,
        targetTime: 60,
        commandsUsed: 50,
        optimalCommands: 5,
        unnecessaryWrites: 10,
        hintsUsed: 10,
        systemHealth: 0,
      })

      expect(severeRun.score).toBe(0)
      expect(severeRun.rank).toBe('C')

      const idealRun = calculateIncidentScore({
        resolutionTime: 10,
        targetTime: 60,
        commandsUsed: 2,
        optimalCommands: 5,
        unnecessaryWrites: 0,
        hintsUsed: 0,
        systemHealth: 100,
      })

      expect(idealRun.score).toBe(1000)
      expect(idealRun.rank).toBe('S')
    })
  })

  describe('ScoreEngine class', () => {
    it('instantiates and calculates incident score', () => {
      const engine = new ScoreEngine()
      const result = engine.calculateIncidentScore({
        resolutionTime: 40,
        targetTime: 60,
        commandsUsed: 5,
        optimalCommands: 5,
        unnecessaryWrites: 0,
        hintsUsed: 0,
        systemHealth: 100,
      })

      expect(result.score).toBe(1000)
      expect(result.rank).toBe('S')
    })
  })
})
