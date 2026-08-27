export const VOCABULARY = [
  { id: 'tool_store', physical: 'Staple Gun', game: 'Injector', real: 'SET', firstSeenChapter: 1 },
  { id: 'tool_probe', physical: 'Magnifying Glass', game: 'Scanner', real: 'GET', firstSeenChapter: 1 },
  { id: 'tool_purge', physical: 'Hammer', game: 'Eraser', real: 'DEL', firstSeenChapter: 1 },
  { id: 'tool_timer', physical: 'Hourglass', game: 'Decay Timer', real: 'EXPIRE', firstSeenChapter: 1 },
  { id: 'tool_release', physical: 'Bolt Cutters', game: 'Detacher', real: 'UNLINK', firstSeenChapter: 2 },
  { id: 'tool_oneshot', physical: 'Spellbook', game: 'Script executor', real: 'EVAL', firstSeenChapter: 3 },
  { id: 'tool_crew', physical: 'Walkie Talkie', game: 'Broadcaster', real: 'XADD', firstSeenChapter: 3 },
  { id: 'tool_tollgate', physical: 'Clicker', game: 'Counter', real: 'INCR', firstSeenChapter: 2 },
  { id: 'tool_spread', physical: 'Blueprint', game: 'Locator', real: 'CLUSTER KEYSLOT', firstSeenChapter: 4 },
  { id: 'tool_anchor', physical: 'Padlock', game: 'Mutex', real: 'SET NX', firstSeenChapter: 4 },

  { id: 'concept_key', physical: 'Box', game: 'Node', real: 'Key', firstSeenChapter: 1 },
  { id: 'concept_value', physical: 'Note', game: 'Payload', real: 'Value', firstSeenChapter: 1 },
  { id: 'concept_ttl', physical: 'Fuse', game: 'Lifespan', real: 'TTL', firstSeenChapter: 1 },
  { id: 'concept_eviction', physical: 'Trash Pile', game: 'Garbage Collection', real: 'Eviction', firstSeenChapter: 2 },
  { id: 'concept_latency', physical: 'Molasses', game: 'Desync', real: 'Latency', firstSeenChapter: 2 },
  { id: 'concept_memory', physical: 'Backpack', game: 'Capacity', real: 'Memory Limit', firstSeenChapter: 2 },

  { id: 'type_string', physical: 'Ribbon', game: 'Buffer', real: 'String', firstSeenChapter: 1 },
  { id: 'type_list', physical: 'Train', game: 'Sequence', real: 'List', firstSeenChapter: 2 },
  { id: 'type_hash', physical: 'Filing Cabinet', game: 'Dictionary', real: 'Hash', firstSeenChapter: 3 },
  { id: 'type_set', physical: 'Basket', game: 'Unique Collection', real: 'Set', firstSeenChapter: 3 },
  { id: 'type_zset', physical: 'Podium', game: 'Ranked Ladder', real: 'Sorted Set', firstSeenChapter: 4 },
  { id: 'type_stream', physical: 'River', game: 'Event Log', real: 'Stream', firstSeenChapter: 4 },

  { id: 'concept_blocking', physical: 'Stop Sign', game: 'Halt', real: 'Blocking Operation', firstSeenChapter: 3 },
  { id: 'concept_atomic', physical: 'Vault Door', game: 'Uninterruptible', real: 'Atomicity', firstSeenChapter: 1 },
  { id: 'concept_pubsub', physical: 'Megaphone', game: 'Frequency', real: 'Pub/Sub', firstSeenChapter: 4 } // 25 total
]
