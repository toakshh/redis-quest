/**
 * Registry pattern for managing incident definitions by ID and region ID.
 */
export class IncidentRegistry {
  constructor() {
    this._incidents = new Map()
  }

  /**
   * Register an incident definition.
   * Accepts register(incidentDef) or register(id, incidentDef).
   * @param {string|Object} defOrId 
   * @param {Object} [def] 
   * @returns {Object} registered incident definition
   */
  register(defOrId, def) {
    let id, incident
    if (typeof defOrId === 'string') {
      id = defOrId
      incident = { ...def, id }
    } else {
      incident = defOrId
      id = incident?.id
    }
    if (!id) {
      throw new Error('Incident definition must have an id')
    }
    this._incidents.set(id, incident)
    return incident
  }

  /**
   * Retrieve an incident definition by ID.
   * @param {string} id 
   * @returns {Object|null}
   */
  get(id) {
    return this._incidents.get(id) || null
  }

  getIncident(id) {
    return this.get(id)
  }

  /**
   * List all registered incident definitions.
   * @returns {Array<Object>}
   */
  list() {
    return Array.from(this._incidents.values())
  }

  getAll() {
    return this.list()
  }

  /**
   * Retrieve incident definitions by region ID.
   * @param {string} regionId 
   * @returns {Array<Object>}
   */
  getByRegion(regionId) {
    return this.list().filter((inc) => inc.regionId === regionId)
  }

  listByRegion(regionId) {
    return this.getByRegion(regionId)
  }

  /**
   * Unregister an incident definition by ID.
   * @param {string} id 
   * @returns {boolean}
   */
  unregister(id) {
    return this._incidents.delete(id)
  }

  /**
   * Clear all registered incident definitions.
   */
  clear() {
    this._incidents.clear()
  }
}

export const incidentRegistry = new IncidentRegistry()
export default incidentRegistry
