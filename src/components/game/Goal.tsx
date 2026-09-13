import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useGameStore } from "../../game/store/useGameStore";

const GOAL_WIDTH = 7.32;
const GOAL_HEIGHT = 2.44;
const GOAL_DEPTH = 2;
const POST_R = 0.09;

/** How far the back net bulges when a goal goes in, and how fast it settles. */
const NET_RIPPLE = { bulge: 0.55, duration: 0.9, wobbleHz: 4 } as const;

/** Woven net: a tileable grid of thin light threads on a transparent ground. */
export function createNetTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, size, size);
  ctx.strokeStyle = "rgba(245,247,250,0.95)";
  ctx.lineWidth = 2.2;
  const cell = 16;
  ctx.beginPath();
  for (let v = 0; v <= size; v += cell) {
    ctx.moveTo(v, 0);
    ctx.lineTo(v, size);
    ctx.moveTo(0, v);
    ctx.lineTo(size, v);
  }
  ctx.stroke();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** Net material for a w×h panel, tiled at a 12 cm mesh. Caller disposes. */
export function makeNetMaterial(
  texture: THREE.Texture,
  w: number,
  h: number,
): THREE.MeshStandardMaterial {
  const cellsPerMetre = 1 / 0.12;
  const t = texture.clone();
  t.repeat.set((w * cellsPerMetre) / 8, (h * cellsPerMetre) / 8);
  t.needsUpdate = true;
  return new THREE.MeshStandardMaterial({
    map: t,
    transparent: true,
    opacity: 0.9,
    alphaTest: 0.05,
    side: THREE.DoubleSide,
    roughness: 0.9,
    depthWrite: false,
  });
}

/** side = 1 -> goal at +x end, side = -1 -> goal at -x end */
export function Goal({ x, side }: { x: number; side: 1 | -1 }) {
  const halfW = GOAL_WIDTH / 2;
  const backNet = useRef<THREE.Mesh>(null);
  const ripple = useRef(0); // seconds since the last goal in this net, or -1

  const texture = useMemo(() => createNetTexture(), []);
  useEffect(() => () => texture.dispose(), [texture]);
  const netMat = useMemo(
    () => ({
      back: makeNetMaterial(texture, GOAL_WIDTH, GOAL_HEIGHT),
      sideNet: makeNetMaterial(texture, GOAL_DEPTH, GOAL_HEIGHT),
      roof: makeNetMaterial(texture, GOAL_WIDTH, GOAL_DEPTH),
    }),
    [texture],
  );
  useEffect(
    () => () => {
      netMat.back.dispose();
      netMat.sideNet.dispose();
      netMat.roof.dispose();
    },
    [netMat],
  );

  // Ripple the net when a goal goes in at THIS end. The home side defends
  // the -x goal, so an away goal lands in the side=-1 net and vice versa.
  const concedesFor = side === -1 ? "away" : "home";
  const status = useGameStore((s) => s.matchStatus);
  const lastScorer = useGameStore((s) => s.lastScorer);
  const goalCount = useGameStore((s) => s.goals.length);
  useEffect(() => {
    if (status === "goal" && lastScorer === concedesFor) ripple.current = 0;
  }, [status, lastScorer, goalCount, concedesFor]);

  useFrame((_, dt) => {
    const mesh = backNet.current;
    if (!mesh) return;
    const t = ripple.current;
    if (t < 0 || t > NET_RIPPLE.duration) {
      if (mesh.position.x !== side * GOAL_DEPTH) mesh.position.x = side * GOAL_DEPTH;
      return;
    }
    ripple.current = t + dt;
    const decay = 1 - t / NET_RIPPLE.duration;
    const wobble = Math.abs(Math.sin(t * NET_RIPPLE.wobbleHz * Math.PI)) * decay;
    mesh.position.x = side * (GOAL_DEPTH + NET_RIPPLE.bulge * wobble);
  });

  useEffect(() => {
    ripple.current = -1;
  }, []);

  const post = <meshStandardMaterial color="#f2f4f6" roughness={0.4} metalness={0.1} />;

  return (
    <group position={[x, 0, 0]}>
      {/* posts */}
      {[-halfW, halfW].map((z) => (
        <mesh key={z} position={[0, GOAL_HEIGHT / 2, z]} castShadow>
          <cylinderGeometry args={[POST_R, POST_R, GOAL_HEIGHT, 12]} />
          {post}
        </mesh>
      ))}

      {/* crossbar */}
      <mesh position={[0, GOAL_HEIGHT, 0]} rotation-x={Math.PI / 2} castShadow>
        <cylinderGeometry args={[POST_R, POST_R, GOAL_WIDTH, 12]} />
        {post}
      </mesh>

      {/* rear stanchions holding the net up */}
      {[-halfW, halfW].map((z) => (
        <mesh key={`s${z}`} position={[side * GOAL_DEPTH, GOAL_HEIGHT / 2, z]} castShadow>
          <cylinderGeometry args={[POST_R * 0.6, POST_R * 0.6, GOAL_HEIGHT, 8]} />
          {post}
        </mesh>
      ))}

      {/* back net (ripples on a goal) */}
      <mesh
        ref={backNet}
        position={[side * GOAL_DEPTH, GOAL_HEIGHT / 2, 0]}
        rotation-y={Math.PI / 2}
        material={netMat.back}
      >
        <planeGeometry args={[GOAL_WIDTH, GOAL_HEIGHT]} />
      </mesh>

      {/* side nets */}
      {[-halfW, halfW].map((z) => (
        <mesh
          key={`n${z}`}
          position={[(side * GOAL_DEPTH) / 2, GOAL_HEIGHT / 2, z]}
          material={netMat.sideNet}
        >
          <planeGeometry args={[GOAL_DEPTH, GOAL_HEIGHT]} />
        </mesh>
      ))}

      {/* net roof */}
      <mesh
        position={[(side * GOAL_DEPTH) / 2, GOAL_HEIGHT, 0]}
        rotation-x={-Math.PI / 2}
        material={netMat.roof}
      >
        <planeGeometry args={[GOAL_WIDTH, GOAL_DEPTH]} />
      </mesh>
    </group>
  );
}
