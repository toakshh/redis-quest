import { cmd } from '../registry.js'
import {
  integerReply,
  bulkReply,
  nilReply,
  arrayReply,
  emptyArrayReply,
  errorReply,
  syntaxError,
  invalidInt,
  intValue,
} from '../reply.js'

// ---- pattern subscription helpers -----------------------------------------

const patternSubscribers = new Map() // pattern -> Set of connection ids

function subscribePattern(engine, pattern) {
  if (!patternSubscribers.has(pattern)) patternSubscribers.set(pattern, new Set())
  patternSubscribers.get(pattern).add(engine.connectionId)
  return patternSubscribers.get(pattern).size
}

function unsubscribePattern(engine, pattern) {
  const set = patternSubscribers.get(pattern)
  if (!set) return 0
  set.delete(engine.connectionId)
  if (set.size === 0) patternSubscribers.delete(pattern)
  return set.size
}

function matchChannels(pattern) {
  const matched = []
  for (const channel of engine.subscribers.keys()) {
    if (globMatch(pattern, channel)) matched.push(channel)
  }
  return matched
}

function publishToPatterns(engine, channel, message) {
  let count = 0
  for (const [pattern, subs] of patternSubscribers) {
    if (globMatch(pattern, channel)) {
      count += subs.size
    }
  }
  if (count > 0) {
    engine.emit('pmessage', { pattern: '*', channel, message, count })
  }
  return count
}

// Simple glob matching (like Redis PSUBSCRIBE patterns)
function globMatch(pattern, string) {
  // Convert glob pattern to regex
  const regexStr = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&') // escape special regex chars
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.')
  const regex = new RegExp(`^${regexStr}$`)
  return regex.test(string)
}

// ---- commands -------------------------------------------------------------

export const PUBLISH = cmd({
  arity: 3,
  syntax: 'PUBLISH channel message',
  summary: 'Post a message to a channel.',
  group: 'pubsub',
  examples: ['PUBLISH notifications "hello world"'],
})((engine, args) => {
  const [, channel, message] = args
  const subCount = engine.publishMessage(channel, message)
  const patternCount = publishToPatterns(engine, channel, message)
  return integerReply(subCount + patternCount)
})

export const SUBSCRIBE = cmd({
  arity: -2,
  syntax: 'SUBSCRIBE channel [channel ...]',
  summary: 'Listen for messages published to the given channels.',
  group: 'pubsub',
  examples: ['SUBSCRIBE news', 'SUBSCRIBE chat updates'],
})((engine, args) => {
  const channels = args.slice(1)
  const replies = []
  for (const channel of channels) {
    const count = engine.subscribeChannel(channel)
    replies.push(arrayReply([
      bulkReply('subscribe'),
      bulkReply(channel),
      integerReply(count)
    ]))
  }
  // In real Redis, this would be a push-style response.
  // For our mock, we return the array of replies.
  return arrayReply(replies)
})

export const UNSUBSCRIBE = cmd({
  arity: -1,
  syntax: 'UNSUBSCRIBE [channel ...]',
  summary: 'Stop listening for messages on the given channels.',
  group: 'pubsub',
  examples: ['UNSUBSCRIBE news', 'UNSUBSCRIBE chat updates', 'UNSUBSCRIBE'],
})((engine, args) => {
  const channels = args.length > 1 ? args.slice(1) : [...engine.subscribers.keys()]
  const replies = []
  for (const channel of channels) {
    const count = engine.unsubscribeChannel(channel)
    replies.push(arrayReply([
      bulkReply('unsubscribe'),
      bulkReply(channel),
      integerReply(count)
    ]))
  }
  return arrayReply(replies)
})

export const PSUBSCRIBE = cmd({
  arity: -2,
  syntax: 'PSUBSCRIBE pattern [pattern ...]',
  summary: 'Listen for messages published to channels matching the given patterns.',
  group: 'pubsub',
  examples: ['PSUBSCRIBE news.*', 'PSUBSCRIBE chat.* updates.*'],
})((engine, args) => {
  const patterns = args.slice(1)
  const replies = []
  for (const pattern of patterns) {
    const count = subscribePattern(engine, pattern)
    replies.push(arrayReply([
      bulkReply('psubscribe'),
      bulkReply(pattern),
      integerReply(count)
    ]))
  }
  return arrayReply(replies)
})

export const PUNSUBSCRIBE = cmd({
  arity: -1,
  syntax: 'PUNSUBSCRIBE [pattern ...]',
  summary: 'Stop listening for messages on channels matching the given patterns.',
  group: 'pubsub',
  examples: ['PUNSUBSCRIBE news.*', 'PUNSUBSCRIBE chat.* updates.*', 'PUNSUBSCRIBE'],
})((engine, args) => {
  const patterns = args.length > 1 ? args.slice(1) : [...patternSubscribers.keys()]
  const replies = []
  for (const pattern of patterns) {
    const count = unsubscribePattern(engine, pattern)
    replies.push(arrayReply([
      bulkReply('punsubscribe'),
      bulkReply(pattern),
      integerReply(count)
    ]))
  }
  return arrayReply(replies)
})

export const PUBSUB = cmd({
  arity: -2,
  syntax: 'PUBSUB subcommand [argument ...]',
  summary: 'Inspect the state of the Pub/Sub system.',
  group: 'pubsub',
  examples: ['PUBSUB CHANNELS', 'PUBSUB CHANNELS news.*', 'PUBSUB NUMSUB chat news', 'PUBSUB NUMPAT'],
})((engine, args) => {
  if (args.length < 2) return syntaxError()
  const subcommand = String(args[1]).toUpperCase()

  if (subcommand === 'CHANNELS') {
    let pattern = '*'
    if (args.length > 2) pattern = args[2]
    const channels = []
    for (const channel of engine.subscribers.keys()) {
      if (globMatch(pattern, channel)) channels.push(channel)
    }
    return arrayReply(channels.map(c => bulkReply(c)))
  }

  if (subcommand === 'NUMSUB') {
    if (args.length < 3) return syntaxError()
    const out = []
    for (let i = 2; i < args.length; i++) {
      const channel = args[i]
      const set = engine.subscribers.get(channel)
      const count = set ? set.size : 0
      out.push(bulkReply(channel))
      out.push(integerReply(count))
    }
    return arrayReply(out)
  }

  if (subcommand === 'NUMPAT') {
    return integerReply(patternSubscribers.size)
  }

  return errorReply(`ERR unknown subcommand '${args[1]}'`)
})