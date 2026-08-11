import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createEventBus, EVENTS } from '../src/systems/EventBus.js'

describe('EventBus', () => {
  let bus

  beforeEach(() => {
    bus = createEventBus()
  })

  it('subscribes and emits events', () => {
    const handler = vi.fn()
    bus.on(EVENTS.COMMAND_EXECUTED, handler)
    bus.emit(EVENTS.COMMAND_EXECUTED, { name: 'SET', args: ['foo', 'bar'] })
    expect(handler).toHaveBeenCalledWith({ name: 'SET', args: ['foo', 'bar'] })
  })

  it('unsubscribes with returned function', () => {
    const handler = vi.fn()
    const off = bus.on(EVENTS.COMMAND_EXECUTED, handler)
    bus.emit(EVENTS.COMMAND_EXECUTED, { name: 'SET' })
    expect(handler).toHaveBeenCalledTimes(1)
    off()
    bus.emit(EVENTS.COMMAND_EXECUTED, { name: 'GET' })
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('off removes specific handler', () => {
    const handler = vi.fn()
    bus.on(EVENTS.COMMAND_EXECUTED, handler)
    bus.off(EVENTS.COMMAND_EXECUTED, handler)
    bus.emit(EVENTS.COMMAND_EXECUTED, { name: 'SET' })
    expect(handler).not.toHaveBeenCalled()
  })

  it('clear removes all handlers', () => {
    const h1 = vi.fn()
    const h2 = vi.fn()
    bus.on(EVENTS.COMMAND_EXECUTED, h1)
    bus.on(EVENTS.COMMAND_FAILED, h2)
    bus.clear()
    bus.emit(EVENTS.COMMAND_EXECUTED, {})
    bus.emit(EVENTS.COMMAND_FAILED, {})
    expect(h1).not.toHaveBeenCalled()
    expect(h2).not.toHaveBeenCalled()
  })

  it('multiple handlers for same event all fire', () => {
    const h1 = vi.fn()
    const h2 = vi.fn()
    bus.on(EVENTS.COMMAND_EXECUTED, h1)
    bus.on(EVENTS.COMMAND_EXECUTED, h2)
    bus.emit(EVENTS.COMMAND_EXECUTED, { name: 'PING' })
    expect(h1).toHaveBeenCalled()
    expect(h2).toHaveBeenCalled()
  })
})