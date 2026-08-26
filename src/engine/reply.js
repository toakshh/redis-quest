// RedisReply helpers — mirror redis RESP so the terminal can render exactly
// like redis-cli. Reply types:
//   simple   '+OK'            -> value: string
//   error    '-ERR ...'       -> value: message string (already formatted)
//   integer  ':3'             -> value: number
//   bulk     '$5\r\nhello'    -> value: string
//   nil      '$-1'            -> value: null
//   array    '*2\r\n...'      -> value: array of RedisReply (may nest)
//   status   (custom, for PING in pub/sub / scripts) -> value: string
//   blocked  (custom, no RESP equivalent — BLPOP/BRPOP/BZPOPMIN/BZPOPMAX/
//            XREAD BLOCK found no data) -> value: null,
//            resumeOn: string[] (the keys that would unblock this),
//            timeoutAt: absolute ms, or null to mean "block forever"

export function okReply() {
  return { type: 'simple', value: 'OK' }
}

export function simpleReply(value) {
  return { type: 'simple', value }
}

export function errorReply(message) {
  return { type: 'error', value: message }
}

export function integerReply(value) {
  return { type: 'integer', value }
}

export function bulkReply(value) {
  return { type: 'bulk', value }
}

export function nilReply() {
  return { type: 'nil', value: null }
}

export function blockedReply(resumeOn, timeoutAt) {
  return { type: 'blocked', value: null, resumeOn, timeoutAt }
}

export function arrayReply(items) {
  return { type: 'array', value: items }
}

export function emptyArrayReply() {
  return { type: 'array', value: [] }
}

// Standard Redis error string factory helpers
export function wrongArity(command) {
  return errorReply(`ERR wrong number of arguments for '${command}' command`)
}

export function wrongType() {
  return errorReply('WRONGTYPE Operation against a key holding the wrong kind of value')
}

export function noSuchKey() {
  return errorReply('ERR no such key')
}

export function unknownCommand(name) {
  return errorReply(`ERR unknown command '${name.toUpperCase()}'`)
}

export function syntaxError() {
  return errorReply('ERR syntax error')
}

export function invalidInt(arg) {
  return errorReply('ERR value is not an integer or out of range')
}

export function invalidFloat(arg) {
  return errorReply('ERR value is not a valid float')
}

export function invalidExpire() {
  return errorReply('ERR invalid expire time in \'set\' command')
}

export function integerOrFloat(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const n = Number(value)
    if (Number.isFinite(n)) return n
  }
  return null
}

export function intValue(arg) {
  const n = Number(arg)
  return Number.isSafeInteger(n) ? n : null
}
