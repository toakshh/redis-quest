import React, { Suspense } from 'react'
import { useGLTF } from '@react-three/drei'
import { RigidBody, CuboidCollider } from '@react-three/rapier'

function LevelMesh({ url, colliders }) {
  // 1. useGLTF loads the model; we use draco in standard project config via useGLTF default or setup.
  const { scene } = useGLTF(url)

  return (
    <group>
      <primitive object={scene} />

      {/* 2. RigidBody that holds static colliders from the manifest */}
      <RigidBody type="fixed" colliders={false}>
        {colliders && colliders.map((c, i) => (
          <CuboidCollider
            key={c.id || i}
            args={c.args}
            position={c.position}
            rotation={c.rotation}
          />
        ))}
      </RigidBody>
    </group>
  )
}

export default function LevelLoader({ url, colliders, fallback }) {
  // 3. Suspense boundary per chapter / level
  return (
    <Suspense fallback={fallback || <group />}>
      <LevelMesh url={url} colliders={colliders} />
    </Suspense>
  )
}

// Preload is typically recommended
useGLTF.preload = (url) => { /* internal drei handling */ }
