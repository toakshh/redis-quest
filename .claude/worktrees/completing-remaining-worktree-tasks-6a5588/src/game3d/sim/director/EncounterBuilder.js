export function createEncounterBuilder() {
  return {
    build(beat, world, directorState) {
      if (!beat) return false

      if (beat.tags.includes('incident')) {
        // Mocking silentExecute to seed keys
        if (world.engine && typeof world.engine.silentExecute === 'function') {
           world.engine.silentExecute(['SET', 'incident:target', 'true'])
        }
      }

      if (beat.tags.includes('combat')) {
        // filter spawn table by budget
        const budget = directorState.spawnBudget
        if (budget >= 100) {
           world.flags.push('spawn_evictor')
        } else if (budget >= 20) {
           world.flags.push('spawn_crawler')
        }
      }
      
      // Register objectives etc would happen here
      if (beat.execute) {
        beat.execute(world)
      }

      return true
    }
  }
}
