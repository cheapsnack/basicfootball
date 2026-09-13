import { forwardRef, useEffect, useMemo, useRef, useImperativeHandle } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { BALL_RADIUS } from "../../game/logic/ballPhysics";

const TEX_SIZE = 512; // 4x cheaper than 1024 and indistinguishable at broadcast distance

type PanelKind = "pentagon" | "hexagon";

interface PanelCenter {
  x: number;
  y: number;
  z: number;
  kind: PanelKind;
}

/**
 * Centers of a truncated icosahedron: the 12 icosahedron vertices become the
 * black pentagons, the 20 icosahedron face centers become the white hexagons.
 * Classifying each texel by its nearest center reproduces the 32-panel ball
 * exactly, in spherical space, so nothing stretches at the poles.
 */
function panelCenters(): PanelCenter[] {
  const phi = (1 + Math.sqrt(5)) / 2;

  const verts: [number, number, number][] = [];
  for (const s1 of [-1, 1]) {
    for (const s2 of [-1, 1]) {
      verts.push([0, s1 * 1, s2 * phi]);
      verts.push([s1 * 1, s2 * phi, 0]);
      verts.push([s2 * phi, 0, s1 * 1]);
    }
  }

  const norm = (v: [number, number, number]): [number, number, number] => {
    const l = Math.hypot(v[0], v[1], v[2]);
    return [v[0] / l, v[1] / l, v[2] / l];
  };
  const unitVerts = verts.map(norm);

  // Icosahedron edge length (on the unit sphere) — used to find the triangles.
  let minD = Infinity;
  for (let i = 0; i < unitVerts.length; i++) {
    for (let j = i + 1; j < unitVerts.length; j++) {
      const a = unitVerts[i]!;
      const b = unitVerts[j]!;
      const d = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
      if (d < minD) minD = d;
    }
  }
  const edgeTol = minD * 1.05;
  const dist = (a: [number, number, number], b: [number, number, number]): number =>
    Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

  const faceCenters: [number, number, number][] = [];
  for (let i = 0; i < unitVerts.length; i++) {
    for (let j = i + 1; j < unitVerts.length; j++) {
      if (dist(unitVerts[i]!, unitVerts[j]!) > edgeTol) continue;
      for (let k = j + 1; k < unitVerts.length; k++) {
        if (dist(unitVerts[i]!, unitVerts[k]!) > edgeTol) continue;
        if (dist(unitVerts[j]!, unitVerts[k]!) > edgeTol) continue;
        faceCenters.push(
          norm([
            unitVerts[i]![0] + unitVerts[j]![0] + unitVerts[k]![0],
            unitVerts[i]![1] + unitVerts[j]![1] + unitVerts[k]![1],
            unitVerts[i]![2] + unitVerts[j]![2] + unitVerts[k]![2],
          ]),
        );
      }
    }
  }

  const centers: PanelCenter[] = [];
  for (const v of unitVerts) {
    centers.push({ x: v[0], y: v[1], z: v[2], kind: "pentagon" });
  }
  for (const f of faceCenters) {
    centers.push({ x: f[0], y: f[1], z: f[2], kind: "hexagon" });
  }
  return centers;
}

export function createBallTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = TEX_SIZE;
  canvas.height = TEX_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("createBallTexture: 2D canvas context unavailable");
  }

  const centers = panelCenters();
  const image = ctx.createImageData(TEX_SIZE, TEX_SIZE);
  const data = image.data;

  // Seam half-width in radians, tuned so the line reads ~2px at 1024².
  const seam = (1.5 * Math.PI) / TEX_SIZE;

  // Deterministic value noise for the leather grain.
  const grain = (u: number, v: number): number => {
    const s = Math.sin(u * 127.1 + v * 311.7) * 43758.5453;
    const n = s - Math.floor(s);
    const s2 = Math.sin(u * 269.5 + v * 183.3) * 24634.6345;
    const n2 = s2 - Math.floor(s2);
    return (n * 0.65 + n2 * 0.35 - 0.5) * 2;
  };

  for (let py = 0; py < TEX_SIZE; py++) {
    // Equirectangular: v -> polar angle, u -> azimuth. Matches THREE.SphereGeometry UVs.
    const theta = ((py + 0.5) / TEX_SIZE) * Math.PI;
    const sinT = Math.sin(theta);
    const cosT = Math.cos(theta);

    for (let px = 0; px < TEX_SIZE; px++) {
      const phiA = ((px + 0.5) / TEX_SIZE) * Math.PI * 2;
      const dx = sinT * Math.cos(phiA);
      const dy = cosT;
      const dz = sinT * Math.sin(phiA);

      let best = -Infinity;
      let second = -Infinity;
      let bestKind: PanelKind = "hexagon";

      for (let i = 0; i < centers.length; i++) {
        const c = centers[i]!;
        const dot = dx * c.x + dy * c.y + dz * c.z;
        if (dot > best) {
          second = best;
          best = dot;
          bestKind = c.kind;
        } else if (dot > second) {
          second = dot;
        }
      }

      const angBest = Math.acos(Math.min(1, Math.max(-1, best)));
      const angSecond = Math.acos(Math.min(1, Math.max(-1, second)));
      const edge = angSecond - angBest;

      let r: number;
      let g: number;
      let b: number;

      if (edge < seam) {
        // Dark grey stitch line, softened at its outer edge.
        const t = Math.min(1, edge / seam);
        const base = 58 + t * 18;
        r = base;
        g = base;
        b = base + 2;
      } else if (bestKind === "pentagon") {
        const n = grain(px * 0.9, py * 0.9) * 5;
        const shade = 26 + n;
        r = shade;
        g = shade;
        b = shade + 3;
      } else {
        const n = grain(px * 1.7, py * 1.7) * 7 + grain(px * 0.31, py * 0.31) * 4;
        const shade = 243 + n;
        r = shade;
        g = shade;
        b = shade - 3;
      }

      const o = (py * TEX_SIZE + px) * 4;
      data[o] = r < 0 ? 0 : r > 255 ? 255 : r;
      data[o + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
      data[o + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
      data[o + 3] = 255;
    }
  }

  ctx.putImageData(image, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

export interface BallProps {
  /** Height above the turf at which the contact shadow fully fades out. */
  shadowFadeHeight?: number;
  /** Multiplier on the contact-shadow radius at rest. */
  shadowScale?: number;
}

export const Ball = forwardRef<THREE.Group, BallProps>(function Ball(
  { shadowFadeHeight = BALL_RADIUS * 14, shadowScale = 1.45 },
  ref,
) {
  const groupRef = useRef<THREE.Group>(null);
  const shadowRef = useRef<THREE.Mesh>(null);

  useImperativeHandle(ref, () => groupRef.current as THREE.Group, []);

  const texture = useMemo(() => createBallTexture(), []);

  useEffect(() => {
    return () => {
      texture.dispose();
    };
  }, [texture]);

  useFrame(() => {
    const group = groupRef.current;
    const shadow = shadowRef.current;
    if (!group || !shadow) return;

    const height = Math.max(0, group.position.y);
    shadow.position.y = -group.position.y + 0.015;

    const t = Math.min(1, height / shadowFadeHeight);
    const spread = shadowScale * (1 + t * 1.9);
    shadow.scale.set(spread, spread, 1);

    const material = shadow.material as THREE.MeshBasicMaterial;
    material.opacity = 0.38 * (1 - t * 0.86);
  });

  return (
    <group ref={groupRef}>
      <mesh castShadow>
        <sphereGeometry args={[BALL_RADIUS, 32, 24]} />
        <meshStandardMaterial map={texture} roughness={0.45} metalness={0} envMapIntensity={0.6} />
      </mesh>

      <mesh ref={shadowRef} rotation={[-Math.PI / 2, 0, 0]} renderOrder={-1}>
        <circleGeometry args={[BALL_RADIUS, 32]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.38} depthWrite={false} />
      </mesh>
    </group>
  );
});

export default Ball;
