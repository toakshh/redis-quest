import { useEffect, useRef, useState } from 'react'
import { use3DGameStore } from '../../stores/use3DGameStore'

export function useKeyboardControls() {
  const keys = useRef({
    KeyW: false, KeyA: false, KeyS: false, KeyD: false,
    ShiftLeft: false, ShiftRight: false,
    KeyC: false, ControlLeft: false,
    Space: false,
  })

  const { setSprinting, setCrouching, spendStamina, regenStamina, player } = use3DGameStore.getState()
  const [moveInput, setMoveInput] = useState({ x: 0, z: 0 })
  const [jumpPressed, setJumpPressed] = useState(false)

  useEffect(() => {
    const onKeyDown = (e) => {
      if (keys.current.hasOwnProperty(e.code)) {
        keys.current[e.code] = true
      }

      // Handle jump separately
      if (e.code === 'Space') {
        setJumpPressed(true)
        e.preventDefault()
      }
    }

    const onKeyUp = (e) => {
      if (keys.current.hasOwnProperty(e.code)) {
        keys.current[e.code] = false
      }
      if (e.code === 'Space') {
        setJumpPressed(false)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  // Compute move input each frame
  const update = (dt, grounded) => {
    const { KeyW, KeyA, KeyS, KeyD, ShiftLeft, ShiftRight, KeyC, ControlLeft } = keys.current

    // Movement vector
    let x = 0, z = 0
    if (KeyW) z -= 1
    if (KeyS) z += 1
    if (KeyA) x -= 1
    if (KeyD) x += 1

    // Normalize diagonal
    if (x !== 0 && z !== 0) {
      const inv = 1 / Math.sqrt(2)
      x *= inv
      z *= inv
    }

    setMoveInput({ x, z })

    // Sprint
    const sprinting = (ShiftLeft || ShiftRight) && grounded && player.stamina >= 5
    setSprinting(sprinting)
    if (sprinting) spendStamina(18 * dt)
    else regenStamina(dt)

    // Crouch
    const crouching = KeyC || ControlLeft
    setCrouching(crouching)

    return { moveInput: { x, z }, sprinting, crouching, jumpPressed }
  }

  return { update, jumpPressed, keys: keys.current }
}