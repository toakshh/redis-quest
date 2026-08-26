import { useEffect, useRef, useState } from 'react'
import { use3DGameStore } from '../../stores/use3DGameStore'

export function useMouseLook() {
  const { setPlayerRotation, player } = use3DGameStore.getState()
  const [pointerLocked, setPointerLocked] = useState(false)
  const sensitivityRef = useRef(0.002)
  const invertYRef = useRef(false)

  useEffect(() => {
    const onPointerLockChange = () => {
      setPointerLocked(document.pointerLockElement === document.body)
    }

    document.addEventListener('pointerlockchange', onPointerLockChange)
    return () => document.removeEventListener('pointerlockchange', onPointerLockChange)
  }, [])

  const requestPointerLock = () => {
    document.body.requestPointerLock()
  }

  const exitPointerLock = () => {
    document.exitPointerLock()
  }

  const handleMouseMove = (e) => {
    if (!pointerLocked) return

    const movementX = e.movementX || 0
    const movementY = e.movementY || 0

    const sensitivity = sensitivityRef.current
    const invertY = invertYRef.current ? -1 : 1

    const newYaw = player.rotationYaw - movementX * sensitivity
    const newPitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, player.pitch - movementY * sensitivity * invertY))

    setPlayerRotation(newYaw, newPitch)
  }

  useEffect(() => {
    if (pointerLocked) {
      document.addEventListener('mousemove', handleMouseMove)
    }
    return () => document.removeEventListener('mousemove', handleMouseMove)
  }, [pointerLocked])

  const setSensitivity = (s) => { sensitivityRef.current = Math.max(0.0005, Math.min(0.01, s)) }
  const setInvertY = (inv) => { invertYRef.current = inv }

  return {
    pointerLocked,
    requestPointerLock,
    exitPointerLock,
    setSensitivity,
    setInvertY,
    sensitivity: sensitivityRef.current,
    invertY: invertYRef.current,
  }
}