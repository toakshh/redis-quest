import { cmd } from '../registry.js'
import {
  okReply,
  simpleReply,
  bulkReply,
  nilReply,
  integerReply,
  arrayReply,
  errorReply,
  syntaxError,
  intValue,
  integerOrFloat,
} from '../reply.js'

// Geo data structure: key -> { type: 'geo', value: Map<member, {lon, lat}> }
const GEO_RADIUS_EARTH_M = 6371000 // Earth radius in meters

function haversineDistance(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return GEO_RADIUS_EARTH_M * c
}

function geohashEncode(lat, lon, precision = 26) {
  // Simplified geohash for sorting - not full implementation
  const bits = precision * 5
  let hash = 0
  let isLon = true
  let latMin = -90, latMax = 90
  let lonMin = -180, lonMax = 180

  for (let i = 0; i < bits; i++) {
    if (isLon) {
      const mid = (lonMin + lonMax) / 2
      if (lon >= mid) {
        hash = (hash << 1) | 1
        lonMin = mid
      } else {
        hash = (hash << 1)
        lonMax = mid
      }
    } else {
      const mid = (latMin + latMax) / 2
      if (lat >= mid) {
        hash = (hash << 1) | 1
        latMin = mid
      } else {
        hash = (hash << 1)
        latMax = mid
      }
    }
    isLon = !isLon
  }
  return hash
}

export const GEOADD = cmd({
  arity: -5,
  syntax: 'GEOADD key longitude latitude member [longitude latitude member ...]',
  summary: 'Add geospatial items to a sorted set.',
  group: 'geo',
  examples: ['GEOADD cities 13.361389 38.115556 Palermo', 'GEOADD cities 15.087269 37.502669 Catania'],
})((engine, args) => {
  const key = args[1]
  if (!key) return errorReply("ERR wrong number of arguments for 'geoadd' command")
  if ((args.length - 2) % 3 !== 0) return errorReply("ERR wrong number of arguments for 'geoadd' command")

  const { entry, created } = engine._entryForWrite(key, 'geo')
  if (!created && entry.type !== 'geo') return errorReply('WRONGTYPE Operation against a key holding the wrong kind of value')

  if (entry.value === null) entry.value = new Map()

  let added = 0
  for (let i = 2; i < args.length; i += 3) {
    const lon = integerOrFloat(args[i])
    const lat = integerOrFloat(args[i + 1])
    const member = args[i + 2]

    if (lon === null || lat === null) return errorReply('ERR value is not a valid float')
    if (lon < -180 || lon > 180) return errorReply('ERR invalid longitude')
    if (lat < -85.05112878 || lat > 85.05112878) return errorReply('ERR invalid latitude')

    const score = geohashEncode(lat, lon)
    entry.value.set(member, { lon, lat, score })
    added++
  }

  engine._bump(key, entry)
  engine.emit('change')
  return integerReply(added)
})

export const GEOPOS = cmd({
  arity: -3,
  syntax: 'GEOPOS key member [member ...]',
  summary: 'Get the positions of geospatial items.',
  group: 'geo',
  examples: ['GEOPOS cities Palermo', 'GEOPOS cities Palermo Catania'],
})((engine, args) => {
  const key = args[1]
  if (!key) return errorReply("ERR wrong number of arguments for 'geopos' command")

  const entry = engine._get(key)
  if (!entry || entry.type !== 'geo') {
    // Return array of nils for each requested member
    return arrayReply(args.slice(2).map(() => nilReply()))
  }

  const results = []
  for (let i = 2; i < args.length; i++) {
    const member = args[i]
    const pos = entry.value.get(member)
    if (pos) {
      results.push(arrayReply([bulkReply(String(pos.lon)), bulkReply(String(pos.lat))]))
    } else {
      results.push(nilReply())
    }
  }
  return arrayReply(results)
})

export const GEODIST = cmd({
  arity: -4,
  syntax: 'GEODIST key member1 member2 [m|km|ft|mi]',
  summary: 'Get the distance between two geospatial items.',
  group: 'geo',
  examples: ['GEODIST cities Palermo Catania', 'GEODIST cities Palermo Catania km'],
})((engine, args) => {
  const key = args[1]
  const member1 = args[2]
  const member2 = args[3]
  const unit = (args[4] || 'm').toLowerCase()

  if (!key || !member1 || !member2) return errorReply("ERR wrong number of arguments for 'geodist' command")

  const entry = engine._get(key)
  if (!entry || entry.type !== 'geo') return nilReply()

  const pos1 = entry.value.get(member1)
  const pos2 = entry.value.get(member2)
  if (!pos1 || !pos2) return nilReply()

  let distance = haversineDistance(pos1.lat, pos1.lon, pos2.lat, pos2.lon)

  if (unit === 'km') distance /= 1000
  else if (unit === 'mi') distance /= 1609.344
  else if (unit === 'ft') distance *= 3.28084
  // default: meters

  return bulkReply(String(distance))
})

export const GEORADIUS = cmd({
  arity: -6,
  syntax: 'GEORADIUS key longitude latitude radius m|km|ft|mi [WITHCOORD] [WITHDIST] [WITHHASH] [COUNT count] [ASC|DESC] [STORE key] [STOREDIST key]',
  summary: 'Query a sorted set for members within a radius.',
  group: 'geo',
  examples: ['GEORADIUS cities 15 37 100 km WITHDIST', 'GEORADIUS cities 15 37 100 km WITHCOORD COUNT 10'],
})((engine, args) => {
  const key = args[1]
  const lon = integerOrFloat(args[2])
  const lat = integerOrFloat(args[3])
  const radius = integerOrFloat(args[4])
  const unit = (args[5] || 'm').toLowerCase()

  if (!key || lon === null || lat === null || radius === null) {
    return errorReply("ERR wrong number of arguments for 'georadius' command")
  }

  const entry = engine._get(key)
  if (!entry || entry.type !== 'geo') return arrayReply([])

  let radiusMeters = radius
  if (unit === 'km') radiusMeters *= 1000
  else if (unit === 'mi') radiusMeters *= 1609.344
  else if (unit === 'ft') radiusMeters /= 3.28084

  const results = []
  for (const [member, pos] of entry.value) {
    const distance = haversineDistance(lat, lon, pos.lat, pos.lon)
    if (distance <= radiusMeters) {
      results.push({ member, distance, score: pos.score, pos })
    }
  }

  // Sort by distance
  results.sort((a, b) => a.distance - b.distance)

  // Parse options
  let withCoord = false
  let withDist = false
  let withHash = false
  let count = -1
  let asc = true
  let storeKey = null
  let storeDistKey = null

  for (let i = 6; i < args.length; i++) {
    const opt = String(args[i]).toUpperCase()
    if (opt === 'WITHCOORD') withCoord = true
    else if (opt === 'WITHDIST') withDist = true
    else if (opt === 'WITHHASH') withHash = true
    else if (opt === 'COUNT') {
      count = intValue(args[++i])
    } else if (opt === 'ASC') asc = true
    else if (opt === 'DESC') asc = false
    else if (opt === 'STORE') storeKey = args[++i]
    else if (opt === 'STOREDIST') storeDistKey = args[++i]
  }

  if (!asc) results.reverse()
  if (count > 0) results.splice(count)

  // Handle STORE options
  if (storeKey) {
    const { entry: storeEntry } = engine._entryForWrite(storeKey, 'zset')
    if (storeEntry.value === null) storeEntry.value = []
    storeEntry.value = results.map(r => ({ member: r.member, score: r.distance }))
    engine._bump(storeKey, storeEntry)
  }
  if (storeDistKey) {
    const { entry: storeEntry } = engine._entryForWrite(storeDistKey, 'zset')
    if (storeEntry.value === null) storeEntry.value = []
    storeEntry.value = results.map(r => ({ member: r.member, score: r.distance }))
    engine._bump(storeDistKey, storeEntry)
  }

  engine.emit('change')

  // Format results
  return arrayReply(results.map(r => {
    if (withDist || withCoord || withHash) {
      const parts = [bulkReply(r.member)]
      if (withDist) parts.push(bulkReply(r.distance.toFixed(4)))
      if (withHash) parts.push(integerReply(r.score))
      if (withCoord) parts.push(arrayReply([bulkReply(String(r.pos.lon)), bulkReply(String(r.pos.lat))]))
      return arrayReply(parts)
    }
    return bulkReply(r.member)
  }))
})

export const GEORADIUSBYMEMBER = cmd({
  arity: -5,
  syntax: 'GEORADIUSBYMEMBER key member radius m|km|ft|mi [WITHCOORD] [WITHDIST] [WITHHASH] [COUNT count] [ASC|DESC] [STORE key] [STOREDIST key]',
  summary: 'Query a sorted set for members within a radius of a member.',
  group: 'geo',
  examples: ['GEORADIUSBYMEMBER cities Palermo 100 km WITHDIST', 'GEORADIUSBYMEMBER cities Palermo 100 km WITHCOORD COUNT 10'],
})((engine, args) => {
  const key = args[1]
  const member = args[2]
  const radius = integerOrFloat(args[3])
  const unit = (args[4] || 'm').toLowerCase()

  if (!key || !member || radius === null) {
    return errorReply("ERR wrong number of arguments for 'georadiusbymember' command")
  }

  const entry = engine._get(key)
  if (!entry || entry.type !== 'geo') return arrayReply([])

  const centerPos = entry.value.get(member)
  if (!centerPos) return nilReply()

  // Delegate to GEORADIUS logic
  const newArgs = [args[0], key, String(centerPos.lon), String(centerPos.lat), String(radius), unit, ...args.slice(5)]
  return GEORADIUS.handler(engine, newArgs)
})

export const GEOSEARCH = cmd({
  arity: -6,
  syntax: 'GEOSEARCH key [FROMLONLAT lon lat | FROMMEMBER member] BYRADIUS radius m|km|ft|mi | BYBOX width height m|km|ft|mi [WITHCOORD] [WITHDIST] [WITHHASH] [COUNT count] [ASC|DESC]',
  summary: 'Query a sorted set for members in a radius or box (Redis 6.2+).',
  group: 'geo',
  examples: [
    'GEOSEARCH cities FROMLONLAT 15 37 BYRADIUS 100 km WITHDIST',
    'GEOSEARCH cities FROMMEMBER Palermo BYBOX 100 100 km COUNT 10',
  ],
})((engine, args) => {
  const key = args[1]
  if (!key) return errorReply("ERR wrong number of arguments for 'geosearch' command")

  const entry = engine._get(key)
  if (!entry || entry.type !== 'geo') return arrayReply([])

  let centerLon = null
  let centerLat = null
  let byRadius = false
  let byBox = false
  let radius = null
  let width = null
  let height = null
  let unit = 'm'

  let i = 2
  while (i < args.length) {
    const opt = String(args[i]).toUpperCase()
    if (opt === 'FROMLONLAT') {
      centerLon = integerOrFloat(args[++i])
      centerLat = integerOrFloat(args[++i])
    } else if (opt === 'FROMMEMBER') {
      const member = args[++i]
      const pos = entry.value.get(member)
      if (!pos) return errorReply('ERR could not decode requested zset member')
      centerLon = pos.lon
      centerLat = pos.lat
    } else if (opt === 'BYRADIUS') {
      byRadius = true
      radius = integerOrFloat(args[++i])
      unit = (args[++i] || 'm').toLowerCase()
    } else if (opt === 'BYBOX') {
      byBox = true
      width = integerOrFloat(args[++i])
      height = integerOrFloat(args[++i])
      unit = (args[++i] || 'm').toLowerCase()
    }
    i++
  }

  if (centerLon === null || centerLat === null) {
    return errorReply("ERR wrong number of arguments for 'geosearch' command")
  }

  let radiusMeters = 0
  if (byRadius) {
    radiusMeters = radius
    if (unit === 'km') radiusMeters *= 1000
    else if (unit === 'mi') radiusMeters *= 1609.344
    else if (unit === 'ft') radiusMeters /= 3.28084
  }

  const results = []
  for (const [member, pos] of entry.value) {
    const distance = haversineDistance(centerLat, centerLon, pos.lat, pos.lon)

    let inRange = false
    if (byRadius) {
      inRange = distance <= radiusMeters
    } else if (byBox) {
      // Simplified box check - approximate
      const latDiff = (distance / GEO_RADIUS_EARTH_M) * (180 / Math.PI)
      const lonDiff = latDiff / Math.cos(centerLat * Math.PI / 180)
      const boxWidthMeters = width * (unit === 'km' ? 1000 : unit === 'mi' ? 1609.344 : unit === 'ft' ? 0.3048 : 1)
      const boxHeightMeters = height * (unit === 'km' ? 1000 : unit === 'mi' ? 1609.344 : unit === 'ft' ? 0.3048 : 1)
      const latRange = (boxHeightMeters / GEO_RADIUS_EARTH_M) * (180 / Math.PI)
      const lonRange = (boxWidthMeters / GEO_RADIUS_EARTH_M) * (180 / Math.PI) / Math.cos(centerLat * Math.PI / 180)
      inRange = Math.abs(pos.lat - centerLat) <= latRange && Math.abs(pos.lon - centerLon) <= lonRange
    }

    if (inRange) {
      results.push({ member, distance, score: pos.score, pos })
    }
  }

  // Sort by distance
  results.sort((a, b) => a.distance - b.distance)

  // Parse remaining options
  let withCoord = false
  let withDist = false
  let withHash = false
  let count = -1
  let asc = true

  for (let j = 2; j < args.length; j++) {
    const opt = String(args[j]).toUpperCase()
    if (opt === 'WITHCOORD') withCoord = true
    else if (opt === 'WITHDIST') withDist = true
    else if (opt === 'WITHHASH') withHash = true
    else if (opt === 'COUNT') count = intValue(args[++j])
    else if (opt === 'ASC') asc = true
    else if (opt === 'DESC') asc = false
  }

  if (!asc) results.reverse()
  if (count > 0) results.splice(count)

  return arrayReply(results.map(r => {
    if (withDist || withCoord || withHash) {
      const parts = [bulkReply(r.member)]
      if (withDist) parts.push(bulkReply(r.distance.toFixed(4)))
      if (withHash) parts.push(integerReply(r.score))
      if (withCoord) parts.push(arrayReply([bulkReply(String(r.pos.lon)), bulkReply(String(r.pos.lat))]))
      return arrayReply(parts)
    }
    return bulkReply(r.member)
  }))
})

export const GEOHASH = cmd({
  arity: -3,
  syntax: 'GEOHASH key member [member ...]',
  summary: 'Get geohash strings for geospatial items.',
  group: 'geo',
  examples: ['GEOHASH cities Palermo', 'GEOHASH cities Palermo Catania'],
})((engine, args) => {
  const key = args[1]
  if (!key) return errorReply("ERR wrong number of arguments for 'geohash' command")

  const entry = engine._get(key)
  if (!entry || entry.type !== 'geo') {
    return arrayReply(args.slice(2).map(() => nilReply()))
  }

  const results = []
  for (let i = 2; i < args.length; i++) {
    const member = args[i]
    const pos = entry.value.get(member)
    if (pos) {
      // Return 11-char geohash (standard)
      const hash = pos.score.toString(36).padStart(11, '0').slice(0, 11)
      results.push(bulkReply(hash))
    } else {
      results.push(nilReply())
    }
  }
  return arrayReply(results)
})

// Attach handler for GEORADIUS to be callable from GEORADIUSBYMEMBER
GEORADIUS.handler = GEORADIUS.fn
GEORADIUSBYMEMBER.handler = GEORADIUSBYMEMBER.fn
GEOSEARCH.handler = GEOSEARCH.fn