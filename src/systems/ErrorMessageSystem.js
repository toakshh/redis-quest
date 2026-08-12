// Educational Error & Success Feedback System
// Context-aware failure feedback via REX companion, XP fountain, screen flash, victory screens

import { eventBus, EVENTS } from '../engine/EventBus.js'
import { juiceSystem } from './JuiceSystem.js'

// Error categories and their helpful messages
const ERROR_FEEDBACK = {
  // Syntax errors
  'wrong number of arguments': {
    title: 'Wrong Argument Count',
    messages: [
      'This command expects a specific number of arguments. Check the syntax!',
      'Count your arguments: the command name plus each parameter.',
      'Example: SET key value → 3 parts (command, key, value)',
    ],
    hint: 'Use HELP <command> to see the correct syntax.',
  },
  'unknown command': {
    title: 'Unknown Command',
    messages: [
      "That command doesn't exist in this version of Redis.",
      'Check your spelling — Redis commands are case-insensitive.',
      'Try HELP to see all available commands.',
    ],
    hint: 'Type HELP for a command list, or HELP <command> for details.',
  },
  'syntax error': {
    title: 'Syntax Error',
    messages: [
      'The command structure is invalid. Check for missing quotes or brackets.',
      'Redis commands follow: COMMAND key [arg1] [arg2] ...',
      'Strings with spaces need quotes: SET key "hello world"',
    ],
    hint: 'Use HELP <command> for exact syntax.',
  },

  // Type errors
  'WRONGTYPE': {
    title: 'Wrong Data Type',
    messages: [
      "You're using a command on the wrong data type!",
      'Each key holds one data type: string, hash, list, set, or sorted set.',
      'Use TYPE key to check what type a key holds.',
    ],
    hint: 'DEL the key first, then create it with the correct type.',
  },

  // Key errors
  'key not found': {
    title: 'Key Not Found',
    messages: [
      'That key does not exist in the database.',
      'Use KEYS * or SCAN 0 to see what keys exist.',
      'Keys are case-sensitive: "user:1" ≠ "User:1"',
    ],
    hint: 'Check KEYS * or use EXISTS key to verify.',
  },

  // Permission/connection errors (not in mock but for completeness)
  'NOPERM': {
    title: 'Permission Denied',
    messages: [
      "You don't have permission to run this command.",
      'In real Redis, this requires ACL configuration.',
    ],
    hint: 'Check your user permissions with ACL WHOAMI.',
  },

  // Memory errors
  'OOM': {
    title: 'Out of Memory',
    messages: [
      'Redis has hit its memory limit!',
      'Use MEMORY USAGE key to check key sizes.',
      'Consider setting maxmemory policy with CONFIG SET.',
    ],
    hint: 'Evict keys with DEL or increase memory limit.',
  },

  // Transaction errors
  'EXECABORT': {
    title: 'Transaction Aborted',
    messages: [
      'Transaction was aborted due to a watched key changing.',
      'WATCH keys before MULTI to enable optimistic locking.',
      'Another client modified a watched key — retry the transaction.',
    ],
    hint: 'Use WATCH key before MULTI to guard against changes.',
  },
  'QUEUED': {
    title: 'Command Queued',
    messages: [
      'Command added to transaction queue.',
      'Run EXEC to execute all queued commands atomically.',
      'Use DISCARD to cancel the transaction.',
    ],
    hint: 'EXEC runs all queued commands; DISCARD cancels.',
  },

  // Generic
  'error': {
    title: 'Error',
    messages: [
      'Something went wrong. Check the error message above.',
      'Use HELP <command> to review command syntax.',
    ],
    hint: 'Read the error message carefully — it usually tells you exactly what\'s wrong.',
  },
}

// Success feedback templates
const SUCCESS_FEEDBACK = {
  'first-command': {
    title: 'First Command Executed!',
    messages: [
      'Welcome to Redis Quest! You\'ve taken your first step.',
      'Every journey begins with a single SET.',
    ],
    xp: 10,
  },
  'datatype-first': {
    title: 'New Data Type Discovered!',
    messages: [
      'You\'ve unlocked a new data structure!',
      'Each type solves different problems — experiment to learn.',
    ],
    xp: 15,
  },
  'level-up': {
    title: 'Level Up!',
    messages: [
      'Your Redis knowledge grows stronger!',
      'New regions and skills await.',
    ],
  },
  'boss-damage': {
    title: 'Hit!',
    messages: [
      'Your command struck true!',
      'The serpent recoils from your precision.',
    ],
  },
  'boss-defeated': {
    title: 'VICTORY!',
    messages: [
      'The NEON SERPENT has been dismantled!',
      'You\'ve proven your mastery of Redis fundamentals.',
    ],
  },
  'achievement': {
    title: 'Achievement Unlocked!',
    messages: [
      'Your dedication has been recognized.',
      'Keep exploring — more secrets await.',
    ],
  },
  'region-unlock': {
    title: 'New Region Discovered!',
    messages: [
      'A new area of the constellation awakens.',
      'New skills and challenges lie ahead.',
    ],
  },
  'skill-unlock': {
    title: 'Skill Acquired!',
    messages: [
      'Knowledge crystallizes into power.',
      'This skill will serve you well.',
    ],
  },
}

export class ErrorMessageSystem {
  constructor() {
    this.lastError = null
    this.lastErrorTime = 0
    this.errorCount = 0
    this.consecutiveErrors = 0
    this.showHints = true
    this.rexPersonality = 'encouraging' // 'encouraging' | 'technical' | 'minimal'
  }

  // Process an error reply and return helpful feedback
  processError(reply, commandName = '', args = []) {
    this.errorCount++
    this.consecutiveErrors++
    this.lastError = reply
    this.lastErrorTime = Date.now()

    const errorStr = reply?.value || reply?.message || String(reply)
    const feedback = this._matchErrorFeedback(errorStr, commandName)

    // Trigger juice effects
    juiceSystem.errorFeedback()

    // Emit event for REX panel
    eventBus.emit('rex:feedback', {
      type: 'error',
      title: feedback.title,
      message: this._selectMessage(feedback.messages),
      hint: this.showHints ? feedback.hint : null,
      command: commandName,
      args,
      consecutiveErrors: this.consecutiveErrors,
    })

    return feedback
  }

  // Process a successful command
  processSuccess(reply, commandName = '', args = [], state = {}) {
    this.consecutiveErrors = 0
    const canon = commandName.toUpperCase()
    let feedback = null

    // First command ever
    if (state.totalCommands === 1) {
      feedback = { ...SUCCESS_FEEDBACK['first-command'] }
    }
    // First time using a data type
    else if (state.datatypesUsed && this._isNewDatatype(canon, state)) {
      feedback = { ...SUCCESS_FEEDBACK['datatype-first'] }
    }
    // Boss damage
    else if (state.boss?.health > 0 && state.boss?.lastResult?.ok) {
      feedback = { ...SUCCESS_FEEDBACK['boss-damage'] }
    }
    // Boss defeated
    else if (state.boss?.defeated) {
      feedback = { ...SUCCESS_FEEDBACK['boss-defeated'] }
      juiceSystem.victoryFlash()
    }

    if (feedback) {
      eventBus.emit('rex:feedback', {
        type: 'success',
        title: feedback.title,
        message: this._selectMessage(feedback.messages),
        xp: feedback.xp,
        command: commandName,
      })
    }

    // Always trigger micro success animation
    juiceSystem.commandSuccess()

    return feedback
  }

  // Process achievement unlock
  processAchievement(achievement) {
    eventBus.emit('rex:feedback', {
      type: 'achievement',
      title: SUCCESS_FEEDBACK.achievement.title,
      message: `${achievement.icon} ${achievement.name}: ${achievement.description}`,
      xp: achievement.xp,
      rarity: achievement.rarity,
    })
  }

  // Process level up
  processLevelUp(level) {
    eventBus.emit('rex:feedback', {
      type: 'levelup',
      title: SUCCESS_FEEDBACK['level-up'].title,
      message: this._selectMessage(SUCCESS_FEEDBACK['level-up'].messages),
      level,
    })
    juiceSystem.setColorGrade({ saturation: 1.3, brightness: 1.1 }, 8)
    setTimeout(() => juiceSystem.resetColorGrade(), 1500)
  }

  // Process region unlock
  processRegionUnlock(region) {
    eventBus.emit('rex:feedback', {
      type: 'region',
      title: SUCCESS_FEEDBACK['region-unlock'].title,
      message: `${region.icon || '🌟'} ${region.name}: ${region.description}`,
    })
  }

  // Process skill unlock
  processSkillUnlock(skill) {
    eventBus.emit('rex:feedback', {
      type: 'skill',
      title: SUCCESS_FEEDBACK['skill-unlock'].title,
      message: `${skill.icon || '⭐'} ${skill.name}: ${skill.description}`,
    })
  }

  // Process XP gain
  processXPGain(amount, source) {
    if (amount > 20) {
      // Large XP gain = fountain
      juiceSystem.xpFountain(400, 300, amount) // center-ish
    }
  }

  _matchErrorFeedback(errorStr, commandName) {
    const lower = errorStr.toLowerCase()

    // Check specific patterns
    for (const [pattern, feedback] of Object.entries(ERROR_FEEDBACK)) {
      if (lower.includes(pattern.toLowerCase())) {
        return feedback
      }
    }

    // Command-specific hints
    const cmdHints = {
      SET: 'SET key value [EX seconds] [PX ms] [NX|XX]',
      GET: 'GET key',
      HSET: 'HSET key field value [field value...]',
      HGET: 'HGET key field',
      LPUSH: 'LPUSH key value [value...]',
      RPUSH: 'RPUSH key value [value...]',
      SADD: 'SADD key member [member...]',
      ZADD: 'ZADD key score member [score member...]',
      KEYS: 'KEYS pattern',
      SCAN: 'SCAN cursor [MATCH pattern] [COUNT count]',
      EXPIRE: 'EXPIRE key seconds',
      MULTI: 'MULTI (starts transaction)',
      EXEC: 'EXEC (executes transaction)',
      EVAL: 'EVAL script numkeys key [key...] arg [arg...]',
      XADD: 'XADD key ID field value [field value...]',
    }

    const hint = cmdHints[commandName.toUpperCase()]
      ? `Try: ${cmdHints[commandName.toUpperCase()]}`
      : ERROR_FEEDBACK.error.hint

    return {
      title: 'Error',
      messages: [errorStr, 'Check the command syntax and try again.'],
      hint,
    }
  }

  _isNewDatatype(command, state) {
    const typeMap = {
      SET: 'strings', GET: 'strings', APPEND: 'strings', STRLEN: 'strings', INCR: 'strings',
      HSET: 'hashes', HGET: 'hashes', HGETALL: 'hashes', HDEL: 'hashes', HLEN: 'hashes',
      LPUSH: 'lists', RPUSH: 'lists', LPOP: 'lists', RPOP: 'lists', LRANGE: 'lists',
      SADD: 'sets', SREM: 'sets', SISMEMBER: 'sets', SUNION: 'sets', SINTER: 'sets',
      ZADD: 'zsets', ZRANGE: 'zsets', ZSCORE: 'zsets', ZRANK: 'zsets', ZREVRANGE: 'zsets',
    }
    const type = typeMap[command.toUpperCase()]
    return type && state.datatypesUsed && !state.datatypesUsed.includes(type)
  }

  _selectMessage(messages) {
    // Weighted selection: favor first message, but vary for repeated errors
    if (this.consecutiveErrors <= 1) return messages[0]
    const index = Math.min(this.consecutiveErrors - 1, messages.length - 1)
    return messages[index]
  }

  // Set REX personality
  setPersonality(personality) {
    this.rexPersonality = personality
  }

  // Toggle hints
  setShowHints(show) {
    this.showHints = show
  }

  // Get stats for meta achievements
  getStats() {
    return {
      totalErrors: this.errorCount,
      consecutiveErrors: this.consecutiveErrors,
      lastErrorTime: this.lastErrorTime,
    }
  }

  reset() {
    this.lastError = null
    this.lastErrorTime = 0
    this.errorCount = 0
    this.consecutiveErrors = 0
  }
}

export const errorMessageSystem = new ErrorMessageSystem()