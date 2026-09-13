import type React from "react";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export interface TrophyProps {
  spin?: boolean;
  scale?: number;
}

const GOLD_COLOR = "#d4af37";
const MARBLE_COLOR = "#1e2128";

const SPARKLE_COUNT = 6;
const SPARKLE_RADIUS = 0.008;
const RIM_RADIUS = 0.145;
const RIM_Y = 0.845;

/** Cup silhouette, in the trophy's own local space (y = 0 at the cup's foot). */
const CUP_PROFILE: [number, number][] = [
  [0.0, 0.0],
  [0.05, 0.0],
  [0.075, 0.012],
  [0.062, 0.035],
  [0.072, 0.07],
  [0.098, 0.115],
  [0.12, 0.165],
  [0.132, 0.215],
  [0.133, 0.255],
  [0.142, 0.285],
  [0.145, 0.3],
  [0.138, 0.3],
];

export function Trophy({ spin = true, scale = 1 }: TrophyProps): React.JSX.Element {
  const rootRef = useRef<THREE.Group>(null);
  const sparkleRefs = useRef<(THREE.Mesh | null)[]>([]);

  const cupGeometry = useMemo(() => {
    const points = CUP_PROFILE.map(([x, y]) => new THREE.Vector2(x, y));
    return new THREE.LatheGeometry(points, 48);
  }, []);

  const sparkles = useMemo(() => {
    return Array.from({ length: SPARKLE_COUNT }, (_, i) => {
      const angle = (i / SPARKLE_COUNT) * Math.PI * 2;
      return {
        key: i,
        phase: (i / SPARKLE_COUNT) * Math.PI * 2 + i * 0.37,
        position: [
          Math.cos(angle) * RIM_RADIUS,
          RIM_Y + (i % 2 === 0 ? 0.012 : -0.008),
          Math.sin(angle) * RIM_RADIUS,
        ] as [number, number, number],
      };
    });
  }, []);

  useFrame((state, delta) => {
    if (spin && rootRef.current) {
      rootRef.current.rotation.y += delta * 0.45;
    }
    const t = state.clock.elapsedTime;
    for (let i = 0; i < sparkleRefs.current.length; i++) {
      const mesh = sparkleRefs.current[i];
      if (!mesh) continue;
      const material = mesh.material as THREE.MeshStandardMaterial;
      const pulse = 0.5 + 0.5 * Math.sin(t * 2.6 + (sparkles[i]?.phase ?? 0));
      material.opacity = 0.18 + pulse * 0.72;
      const s = 0.85 + pulse * 0.45;
      mesh.scale.setScalar(s);
    }
  });

  return (
    <group ref={rootRef} scale={scale}>
      {/* base, lower tier */}
      <mesh position={[0, 0.045, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.34, 0.09, 0.34]} />
        <meshStandardMaterial color={MARBLE_COLOR} roughness={0.6} metalness={0.05} />
      </mesh>

      {/* gold band between tiers */}
      <mesh position={[0, 0.099, 0]} castShadow>
        <boxGeometry args={[0.345, 0.018, 0.345]} />
        <meshStandardMaterial
          color={GOLD_COLOR}
          metalness={0.95}
          roughness={0.22}
          emissive="#3a2a00"
          emissiveIntensity={0.15}
        />
      </mesh>

      {/* base, upper tier */}
      <mesh position={[0, 0.15, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.25, 0.085, 0.25]} />
        <meshStandardMaterial color={MARBLE_COLOR} roughness={0.6} metalness={0.05} />
      </mesh>

      {/* stem foot */}
      <mesh position={[0, 0.203, 0]} castShadow>
        <cylinderGeometry args={[0.085, 0.105, 0.03, 32]} />
        <meshStandardMaterial
          color={GOLD_COLOR}
          metalness={0.95}
          roughness={0.22}
          emissive="#3a2a00"
          emissiveIntensity={0.15}
        />
      </mesh>

      {/* stem */}
      <mesh position={[0, 0.3, 0]} castShadow>
        <cylinderGeometry args={[0.028, 0.04, 0.175, 32]} />
        <meshStandardMaterial
          color={GOLD_COLOR}
          metalness={0.95}
          roughness={0.22}
          emissive="#3a2a00"
          emissiveIntensity={0.15}
        />
      </mesh>

      {/* stem collar */}
      <mesh position={[0, 0.393, 0]} castShadow>
        <cylinderGeometry args={[0.055, 0.04, 0.022, 32]} />
        <meshStandardMaterial
          color={GOLD_COLOR}
          metalness={0.95}
          roughness={0.22}
          emissive="#3a2a00"
          emissiveIntensity={0.15}
        />
      </mesh>

      {/* cup */}
      <mesh geometry={cupGeometry} position={[0, 0.4, 0]} castShadow receiveShadow>
        <meshStandardMaterial
          color={GOLD_COLOR}
          metalness={0.95}
          roughness={0.22}
          emissive="#3a2a00"
          emissiveIntensity={0.15}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* handles: half-torus on each side */}
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[side * 0.126, 0.665, 0]}
          rotation={[0, 0, side === 1 ? -Math.PI / 2 : Math.PI / 2]}
          castShadow
        >
          <torusGeometry args={[0.072, 0.012, 16, 40, Math.PI]} />
          <meshStandardMaterial
            color={GOLD_COLOR}
            metalness={0.95}
            roughness={0.22}
            emissive="#3a2a00"
            emissiveIntensity={0.15}
          />
        </mesh>
      ))}

      {/* rim ring */}
      <mesh position={[0, RIM_Y, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow>
        <torusGeometry args={[RIM_RADIUS, 0.008, 12, 48]} />
        <meshStandardMaterial
          color={GOLD_COLOR}
          metalness={0.95}
          roughness={0.22}
          emissive="#3a2a00"
          emissiveIntensity={0.15}
        />
      </mesh>

      {/* sparkles */}
      {sparkles.map((s, i) => (
        <mesh
          key={s.key}
          position={s.position}
          ref={(node) => {
            sparkleRefs.current[i] = node;
          }}
        >
          <sphereGeometry args={[SPARKLE_RADIUS, 10, 8]} />
          <meshStandardMaterial
            color="#ffffff"
            emissive="#ffffff"
            emissiveIntensity={2.4}
            transparent
            opacity={0.6}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

export default Trophy;
