import type React from "react";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export interface PitchDressingProps {
  halfLength?: number;
  halfWidth?: number;
  flagColor?: string;
  homeColor?: string;
  awayColor?: string;
}

interface CornerSpec {
  key: string;
  position: [number, number, number];
  phase: number;
  facing: number;
}

const SWAY_DEGREES = 8;
const SWAY_RADIANS = (SWAY_DEGREES * Math.PI) / 180;

function SeatedFigure({
  position,
  color,
}: {
  position: [number, number, number];
  color: string;
}): React.JSX.Element {
  return (
    <group position={position}>
      <mesh position={[0, 0.26, 0]} castShadow>
        <cylinderGeometry args={[0.17, 0.19, 0.52, 12]} />
        <meshStandardMaterial color={color} roughness={0.75} metalness={0} />
      </mesh>
      <mesh position={[0, 0.62, 0]} castShadow>
        <sphereGeometry args={[0.15, 14, 12]} />
        <meshStandardMaterial color="#b98a63" roughness={0.85} metalness={0} />
      </mesh>
      {/* thighs */}
      <mesh position={[0, 0.02, 0.2]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.11, 0.11, 0.42, 10]} />
        <meshStandardMaterial color={color} roughness={0.8} metalness={0} />
      </mesh>
    </group>
  );
}

function Dugout({ x, z, color }: { x: number; z: number; color: string }): React.JSX.Element {
  const seats = useMemo(
    () =>
      Array.from({ length: 5 }, (_, i) => ({
        key: i,
        x: -2.4 + i * 1.2,
      })),
    [],
  );

  return (
    <group position={[x, 0, z]}>
      {/* perspex back */}
      <mesh position={[0, 1.1, 0.75]} castShadow>
        <boxGeometry args={[7, 2.2, 0.08]} />
        <meshPhysicalMaterial
          color="#cfd8e0"
          transmission={0.6}
          thickness={0.05}
          roughness={0.1}
          metalness={0}
          transparent
          opacity={0.85}
        />
      </mesh>

      {/* perspex roof */}
      <mesh position={[0, 2.18, 0]} rotation={[0.09, 0, 0]} castShadow>
        <boxGeometry args={[7, 0.08, 1.7]} />
        <meshPhysicalMaterial
          color="#cfd8e0"
          transmission={0.6}
          thickness={0.05}
          roughness={0.1}
          metalness={0}
          transparent
          opacity={0.85}
        />
      </mesh>

      {/* side panels */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 3.46, 1.1, 0]} castShadow>
          <boxGeometry args={[0.08, 2.2, 1.6]} />
          <meshPhysicalMaterial
            color="#cfd8e0"
            transmission={0.6}
            thickness={0.05}
            roughness={0.1}
            metalness={0}
            transparent
            opacity={0.85}
          />
        </mesh>
      ))}

      {/* bench */}
      <mesh position={[0, 0.44, 0.34]} castShadow>
        <boxGeometry args={[6.4, 0.1, 0.5]} />
        <meshStandardMaterial color="#2b2f36" roughness={0.7} metalness={0.05} />
      </mesh>
      <mesh position={[0, 0.2, 0.34]} castShadow>
        <boxGeometry args={[6.4, 0.38, 0.08]} />
        <meshStandardMaterial color="#23272d" roughness={0.75} metalness={0.05} />
      </mesh>

      {seats.map((s) => (
        <SeatedFigure key={s.key} position={[s.x, 0.49, 0.3]} color={color} />
      ))}
    </group>
  );
}

export function PitchDressing({
  halfLength = 52.5,
  halfWidth = 34,
  flagColor = "#f4c20d",
  homeColor = "#0b4ea2",
  awayColor = "#d2161e",
}: PitchDressingProps): React.JSX.Element {
  const flagRefs = useRef<(THREE.Group | null)[]>([]);

  const corners = useMemo<CornerSpec[]>(() => {
    const signs: [number, number][] = [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ];
    return signs.map(([sx, sz], i) => ({
      key: `${sx}:${sz}`,
      position: [sx * halfLength, 0, sz * halfWidth],
      phase: i * 1.27,
      facing: sx > 0 ? 0 : Math.PI,
    }));
  }, [halfLength, halfWidth]);

  const flagShape = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0.125);
    shape.lineTo(0.35, 0);
    shape.lineTo(0, -0.125);
    shape.closePath();
    return new THREE.ShapeGeometry(shape);
  }, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    for (let i = 0; i < flagRefs.current.length; i++) {
      const node = flagRefs.current[i];
      if (!node) continue;
      const phase = corners[i]?.phase ?? 0;
      node.rotation.y =
        (corners[i]?.facing ?? 0) +
        Math.sin(t * 1.8 + phase) * SWAY_RADIANS +
        Math.sin(t * 3.7 + phase * 1.9) * SWAY_RADIANS * 0.25;
    }
  });

  return (
    <group>
      {corners.map((c, i) => (
        <group key={c.key} position={c.position}>
          <mesh position={[0, 0.75, 0]} castShadow>
            <cylinderGeometry args={[0.02, 0.02, 1.5, 10]} />
            <meshStandardMaterial color="#f2f5f7" roughness={0.5} metalness={0} />
          </mesh>
          <mesh position={[0, 1.5, 0]} castShadow>
            <sphereGeometry args={[0.035, 10, 8]} />
            <meshStandardMaterial color="#f2f5f7" roughness={0.5} metalness={0} />
          </mesh>
          <group
            position={[0, 1.32, 0]}
            ref={(node) => {
              flagRefs.current[i] = node;
            }}
          >
            <mesh geometry={flagShape} position={[0.02, 0, 0]} castShadow>
              <meshStandardMaterial
                color={flagColor}
                roughness={0.65}
                metalness={0}
                side={THREE.DoubleSide}
              />
            </mesh>
          </group>
        </group>
      ))}

      <Dugout x={-14} z={halfWidth + 5} color={homeColor} />
      <Dugout x={14} z={halfWidth + 5} color={awayColor} />

      {/* fourth official's board */}
      <group position={[0, 0, halfWidth + 3]}>
        <mesh position={[0, 0.55, 0]} castShadow>
          <cylinderGeometry args={[0.05, 0.05, 1.1, 10]} />
          <meshStandardMaterial color="#22262c" roughness={0.6} metalness={0.2} />
        </mesh>
        <mesh position={[0, 1.32, 0]} castShadow>
          <boxGeometry args={[0.9, 0.62, 0.1]} />
          <meshStandardMaterial color="#14171c" roughness={0.7} metalness={0.1} />
        </mesh>
        <mesh position={[0, 1.32, 0.056]} castShadow>
          <boxGeometry args={[0.78, 0.5, 0.02]} />
          <meshStandardMaterial
            color="#0f2a19"
            emissive="#63d68a"
            emissiveIntensity={1.6}
            roughness={0.4}
            metalness={0}
            toneMapped={false}
          />
        </mesh>
      </group>
    </group>
  );
}

export default PitchDressing;
