import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { FIELD } from "../../game/logic/field";
import { getClub } from "../../game/data/clubs";
import { useGameStore } from "../../game/store/useGameStore";

/**
 * Stadium dressing around the pitch: terraced stands with an instanced
 * crowd, advertising boards, roofs and floodlight pylons. Purely visual —
 * nothing here touches simulation state.
 */
export const STADIUM_TUNING = {
  /** gap from the touchline / goal line to the ad boards */
  apron: 7,
  rows: 16,
  rowRise: 0.85,
  rowRun: 1.35,
  seatSpacing: 0.8,
  /** fraction of seats occupied */
  crowdFill: 0.9,
  /** share of the crowd wearing the home colour (rest: away + neutrals) */
  homeShare: 0.55,
  awayShare: 0.15,
  adBoardHeight: 1.1,
  floodlightHeight: 36,
  concrete: "#8f939c",
  concreteDark: "#6f737b",
  roof: "#353941",
  neutrals: ["#d9d3c7", "#3a3f4a", "#7a6f62", "#c8b9a6", "#2f2f34", "#a7a9ad"],
} as const;

const T = STADIUM_TUNING;
const STAND_DEPTH = T.rows * T.rowRun;
const STAND_HEIGHT = T.rows * T.rowRise;

type StandSpec = {
  /** world position of the pitch-side edge centre, at ground level */
  x: number;
  z: number;
  /** rotation about y so local +z points away from the pitch */
  rotY: number;
  /** length of the stand along the pitch edge */
  length: number;
};

function makeStands(): StandSpec[] {
  const sideZ = FIELD.halfWidth + T.apron;
  const endX = FIELD.halfLength + T.apron;
  const sideLen = FIELD.length + 2 * T.apron;
  const endLen = FIELD.width + 2 * T.apron;
  return [
    { x: 0, z: -sideZ, rotY: Math.PI, length: sideLen }, // far side
    { x: 0, z: sideZ, rotY: 0, length: sideLen }, // near side
    { x: endX, z: 0, rotY: Math.PI / 2, length: endLen }, // +x end
    { x: -endX, z: 0, rotY: -Math.PI / 2, length: endLen }, // -x end
  ];
}

function createAdTexture(): THREE.CanvasTexture {
  const w = 2048;
  const h = 128;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#0f1a2b";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#63d68a";
  ctx.fillRect(0, h - 10, w, 10);
  ctx.font = "bold 72px sans-serif";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";
  const label = "GOODBALL   \u2022   ARCADE FOOTBALL   \u2022   ";
  const width = ctx.measureText(label).width;
  for (let x = 20; x < w; x += width) ctx.fillText(label, x, h / 2 - 4);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function Stand({
  spec,
  palette,
  seed,
}: {
  spec: StandSpec;
  palette: THREE.Color[];
  seed: number;
}) {
  const crowd = useRef<THREE.InstancedMesh>(null);
  const seatsPerRow = Math.floor(spec.length / T.seatSpacing);
  const count = seatsPerRow * T.rows;

  useEffect(() => {
    const mesh = crowd.current;
    if (!mesh) return;
    // Tiny deterministic PRNG so the crowd doesn't reshuffle on re-mount.
    let s = seed >>> 0;
    const rand = () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 0xffffffff;
    };
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const p = new THREE.Vector3();
    const sc = new THREE.Vector3();
    let i = 0;
    for (let r = 0; r < T.rows; r++) {
      for (let c = 0; c < seatsPerRow; c++) {
        const occupied = rand() < T.crowdFill;
        const x = -spec.length / 2 + (c + 0.5) * T.seatSpacing + (rand() - 0.5) * 0.3;
        const z = (r + 0.55) * T.rowRun;
        const y = (r + 1) * T.rowRise + 0.55;
        p.set(x, occupied ? y : -50, z);
        const h = 0.85 + rand() * 0.35;
        sc.set(0.5, h, 0.4);
        m.compose(p, q, sc);
        mesh.setMatrixAt(i, m);
        mesh.setColorAt(i, palette[Math.floor(rand() * palette.length)]!);
        i++;
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [spec, palette, seed, seatsPerRow]);

  return (
    <group position={[spec.x, 0, spec.z]} rotation-y={spec.rotY}>
      {/* terrace steps */}
      {Array.from({ length: T.rows }, (_, r) => (
        <mesh
          key={r}
          position={[0, (r + 0.5) * T.rowRise, (r + 0.5) * T.rowRun]}
          receiveShadow
        >
          <boxGeometry args={[spec.length, T.rowRise, T.rowRun]} />
          <meshStandardMaterial color={r % 2 ? T.concrete : T.concreteDark} roughness={1} />
        </mesh>
      ))}
      {/* back wall */}
      <mesh position={[0, STAND_HEIGHT / 2 + 3, STAND_DEPTH + 0.5]}>
        <boxGeometry args={[spec.length + 2, STAND_HEIGHT + 6, 1]} />
        <meshStandardMaterial color={T.concreteDark} roughness={1} />
      </mesh>
      {/* roof */}
      <mesh position={[0, STAND_HEIGHT + 7, STAND_DEPTH * 0.55]} castShadow>
        <boxGeometry args={[spec.length + 2, 0.6, STAND_DEPTH * 0.95]} />
        <meshStandardMaterial color={T.roof} roughness={0.8} metalness={0.2} />
      </mesh>
      {/* roof front lip */}
      <mesh position={[0, STAND_HEIGHT + 6.4, STAND_DEPTH * 0.08]}>
        <boxGeometry args={[spec.length + 2, 1.2, 0.3]} />
        <meshStandardMaterial color="#1e2128" roughness={0.9} />
      </mesh>
      {/* crowd */}
      <instancedMesh ref={crowd} args={[undefined, undefined, count]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={1} />
      </instancedMesh>
    </group>
  );
}

function AdBoards({ texture }: { texture: THREE.Texture }) {
  const h = T.adBoardHeight;
  const sideZ = FIELD.halfWidth + T.apron - 0.6;
  const endX = FIELD.halfLength + T.apron - 0.6;
  const sideLen = FIELD.length + 4;
  const endLen = FIELD.width + 4;
  const sideTex = useMemo(() => {
    const t = texture.clone();
    t.repeat.set(sideLen / 24, 1);
    t.needsUpdate = true;
    return t;
  }, [texture, sideLen]);
  const endTex = useMemo(() => {
    const t = texture.clone();
    t.repeat.set(endLen / 24, 1);
    t.needsUpdate = true;
    return t;
  }, [texture, endLen]);
  useEffect(
    () => () => {
      sideTex.dispose();
      endTex.dispose();
    },
    [sideTex, endTex],
  );

  const board = (
    len: number,
    tex: THREE.Texture,
    pos: [number, number, number],
    rotY: number,
    key: string,
  ) => (
    <mesh key={key} position={pos} rotation-y={rotY} castShadow>
      <planeGeometry args={[len, h]} />
      <meshStandardMaterial map={tex} roughness={0.7} side={THREE.DoubleSide} />
    </mesh>
  );

  return (
    <group>
      {board(sideLen, sideTex, [0, h / 2, -sideZ], 0, "far")}
      {board(sideLen, sideTex, [0, h / 2, sideZ], Math.PI, "near")}
      {board(endLen, endTex, [endX, h / 2, 0], -Math.PI / 2, "east")}
      {board(endLen, endTex, [-endX, h / 2, 0], Math.PI / 2, "west")}
    </group>
  );
}

function Floodlight({ x, z }: { x: number; z: number }) {
  const angle = Math.atan2(-x, -z); // face the pitch centre
  return (
    <group position={[x, 0, z]} rotation-y={angle}>
      <mesh position={[0, T.floodlightHeight / 2, 0]} castShadow>
        <cylinderGeometry args={[0.35, 0.6, T.floodlightHeight, 8]} />
        <meshStandardMaterial color="#b9bcc4" roughness={0.6} metalness={0.4} />
      </mesh>
      <mesh position={[0, T.floodlightHeight + 1.2, 0.6]} rotation-x={0.35}>
        <boxGeometry args={[7, 3, 0.8]} />
        <meshStandardMaterial
          color="#f4f6ff"
          emissive="#ffffff"
          emissiveIntensity={0.9}
          roughness={0.3}
        />
      </mesh>
    </group>
  );
}

export function Stadium() {
  const homeClub = useGameStore((s) => getClub(s.homeClubId));
  const awayClub = useGameStore((s) => getClub(s.awayClubId));
  const stands = useMemo(makeStands, []);
  const adTexture = useMemo(() => createAdTexture(), []);
  useEffect(() => () => adTexture.dispose(), [adTexture]);

  // Weighted palette: home colour dominates, a slice of away, rest neutrals.
  const palette = useMemo(() => {
    const out: THREE.Color[] = [];
    const total = 40;
    const home = Math.round(total * T.homeShare);
    const away = Math.round(total * T.awayShare);
    for (let i = 0; i < home; i++)
      out.push(new THREE.Color(i % 3 === 0 ? homeClub.secondaryColor : homeClub.primaryColor));
    for (let i = 0; i < away; i++) out.push(new THREE.Color(awayClub.primaryColor));
    for (let i = out.length; i < total; i++)
      out.push(new THREE.Color(T.neutrals[i % T.neutrals.length]!));
    return out;
  }, [homeClub, awayClub]);

  const lightX = FIELD.halfLength + T.apron + STAND_DEPTH + 4;
  const lightZ = FIELD.halfWidth + T.apron + STAND_DEPTH + 4;

  return (
    <group>
      {stands.map((spec, i) => (
        <Stand key={i} spec={spec} palette={palette} seed={0x9e3779b9 + i * 7919} />
      ))}
      <AdBoards texture={adTexture} />
      <Floodlight x={lightX} z={lightZ} />
      <Floodlight x={-lightX} z={lightZ} />
      <Floodlight x={lightX} z={-lightZ} />
      <Floodlight x={-lightX} z={-lightZ} />
    </group>
  );
}
