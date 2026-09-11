import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { BALL_RADIUS } from "../../game/logic/ballPhysics";

function createBallTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);

  ctx.fillStyle = "#101318";
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 6; col++) {
      const cx = (col + (row % 2 ? 0.5 : 0)) * (size / 6);
      const cy = (row + 0.5) * (size / 4);
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
        const r = size / 15;
        const px = cx + Math.cos(a) * r;
        const py = cy + Math.sin(a) * r;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Match ball. The physics radius is unchanged (BALL_RADIUS is shared with
 * the logic layer); readability comes from a brighter, slightly emissive
 * material and a soft contact shadow that stays on the turf and widens as
 * the ball rises.
 */
export const Ball = forwardRef<THREE.Group>(function Ball(_props, ref) {
  const group = useRef<THREE.Group>(null);
  const shadow = useRef<THREE.Mesh>(null);
  useImperativeHandle(ref, () => group.current!, []);

  const texture = useMemo(() => createBallTexture(), []);
  useEffect(() => () => texture.dispose(), [texture]);

  useFrame(() => {
    const g = group.current;
    const s = shadow.current;
    if (!g || !s) return;
    const height = Math.max(0, g.position.y - BALL_RADIUS);
    // keep the disc on the ground regardless of ball height
    s.position.y = -g.position.y + 0.015;
    const k = 1 + height * 0.12;
    s.scale.set(k, k, 1);
    const mat = s.material as THREE.MeshBasicMaterial;
    mat.opacity = 0.38 / (1 + height * 0.35);
  });

  return (
    <group ref={group}>
      <mesh castShadow>
        <sphereGeometry args={[BALL_RADIUS, 24, 20]} />
        <meshStandardMaterial
          map={texture}
          roughness={0.35}
          metalness={0}
          emissive="#ffffff"
          emissiveIntensity={0.12}
        />
      </mesh>
      <mesh ref={shadow} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[BALL_RADIUS * 1.15, 24]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.38} depthWrite={false} />
      </mesh>
    </group>
  );
});
