import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { db, doc, onSnapshot, updateDoc, getDoc, setDoc } from '../lib/firebase';
import { PlayerProfile, BR_WEAPONS, BR_ZONE_PHASES, BrMode, BR_MAP_LOCATIONS, BrMatchPhase, BR_LOOT_TYPES } from '../types';
import { calcBulletHit, isOutsideZone, generateLoot } from '../lib/brEngine';
import BRHud from './BRHud';
import { motion } from 'motion/react';
import { Skull, Plane, ChevronsDown } from 'lucide-react';

interface BRGameProps {
  profile: PlayerProfile;
  matchId: string;
  mode: BrMode;
  onBack: () => void;
}

const MAP = 200;
const BUILDINGS = [
  { x: -50, z: -50, w: 18, d: 12, h: 5 }, { x: 50, z: -40, w: 14, d: 10, h: 4.5 },
  { x: -40, z: 50, w: 16, d: 14, h: 6 }, { x: 60, z: 50, w: 12, d: 8, h: 3.5 },
  { x: -10, z: -10, w: 10, d: 10, h: 4 }, { x: -60, z: 20, w: 8, d: 8, h: 3 },
  { x: 40, z: -70, w: 10, d: 6, h: 4.5 }, { x: 70, z: -10, w: 7, d: 10, h: 3.5 },
  { x: -70, z: -20, w: 8, d: 6, h: 3 }, { x: 20, z: 70, w: 10, d: 8, h: 4 },
  { x: -30, z: -70, w: 6, d: 10, h: 3.5 }, { x: 0, z: -50, w: 12, d: 6, h: 4 },
  { x: 80, z: 30, w: 8, d: 6, h: 3 }, { x: -80, z: -30, w: 10, d: 8, h: 4.5 },
  { x: 30, z: -90, w: 7, d: 10, h: 3.5 }, { x: -30, z: 85, w: 9, d: 7, h: 4 },
];
const TREES = Array.from({ length: 40 }, () => ({
  x: (Math.random() - 0.5) * MAP * 0.85, z: (Math.random() - 0.5) * MAP * 0.85, s: 1 + Math.random() * 1.5,
}));
const PLAYER_COLORS = [0xff4444, 0x44aaff, 0xffaa44, 0xff44ff, 0xffff44, 0x44ffff, 0xff8844, 0x88ff44, 0x4488ff, 0x44ff88];
const BOT_COLORS = [0x888899, 0x7777aa, 0x667788, 0x889988, 0x996677, 0x7799aa, 0x887766, 0x668899, 0x778877, 0x997788];

function createPlayerMesh(color: number, isBot: boolean, isTm: boolean): THREE.Group {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color, roughness: isBot ? 0.7 : 0.5, metalness: isBot ? 0.3 : 0.1,
  });
  const accMat = new THREE.MeshStandardMaterial({
    color: isTm ? 0x44ff44 : isBot ? 0x555566 : 0x222233,
    roughness: 0.6, metalness: 0.2,
  });

  // Torso
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.25), bodyMat);
  torso.position.y = 0.8; torso.castShadow = true; g.add(torso);

  // Head
  const headMat = new THREE.MeshStandardMaterial({ color: isBot ? 0xcccccc : 0xffddbb, roughness: 0.4 });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 10), headMat);
  head.position.y = 1.25; head.castShadow = true; g.add(head);

  // Left arm
  const lArm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.4, 6), bodyMat);
  lArm.position.set(-0.32, 0.9, 0); g.add(lArm);

  // Right arm
  const rArm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.4, 6), bodyMat);
  rArm.position.set(0.32, 0.9, 0); g.add(rArm);

  // Left leg
  const lLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.4, 6), accMat);
  lLeg.position.set(-0.1, 0.35, 0); g.add(lLeg);

  // Right leg
  const rLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.4, 6), accMat);
  rLeg.position.set(0.1, 0.35, 0); g.add(rLeg);

  // Gun model on right side
  const gunGroup = new THREE.Group();
  const gunMat = new THREE.MeshStandardMaterial({ color: isBot ? 0x444455 : 0x333333, metalness: 0.5, roughness: 0.3 });
  const gunMatDark = new THREE.MeshStandardMaterial({ color: isBot ? 0x333344 : 0x222222, metalness: 0.6, roughness: 0.2 });

  // Gun body
  const gBody = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.4), gunMat);
  gBody.position.set(0.42, 0.75, -0.15); gunGroup.add(gBody);

  // Gun barrel
  const gBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.25, 6), gunMatDark);
  gBarrel.rotation.x = Math.PI / 2;
  gBarrel.position.set(0.42, 0.75, -0.45); gunGroup.add(gBarrel);

  // Gun stock
  const gStock = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, 0.12), gunMatDark);
  gStock.position.set(0.42, 0.75, 0.12); gunGroup.add(gStock);

  // Magazine
  const gMag = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.06, 0.04), gunMatDark);
  gMag.position.set(0.42, 0.7, -0.12); gunGroup.add(gMag);

  g.add(gunGroup);

  // Emissive glow for teammates
  if (isTm) {
    [torso, head, lArm, rArm, lLeg, rLeg].forEach(part => {
      (part.material as THREE.MeshStandardMaterial).emissive = new THREE.Color(0x22ff22);
      (part.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.15;
    });
  }

  return g;
}

function buildingBounds(b: typeof BUILDINGS[number]) {
  return { minX: b.x - b.w / 2, maxX: b.x + b.w / 2, minZ: b.z - b.d / 2, maxZ: b.z + b.d / 2 };
}
function collides(x: number, z: number): boolean {
  for (const b of BUILDINGS) { const bb = buildingBounds(b); if (x > bb.minX && x < bb.maxX && z > bb.minZ && z < bb.maxZ) return true; }
  return Math.abs(x) > MAP / 2 || Math.abs(z) > MAP / 2;
}
const SPEED = 14; const PARACHUTE_SPEED = 20; const PARACHUTE_FALL = 6;
const MEDKIT_TYPES = ['bandage', 'medkit', 'largeMed'];
const MEDKIT_HEALS: Record<string, number> = { bandage: 15, medkit: 50, largeMed: 100 };

function dist(x1: number, z1: number, x2: number, z2: number) { return Math.sqrt((x1 - x2) ** 2 + (z1 - z2) ** 2); }

export default function BRGame({ profile, matchId, mode, onBack }: BRGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const keys = useRef<Set<string>>(new Set());
  const mouseDown = useRef(false);
  const playerPos = useRef({ x: 0, y: 0, z: 0, ry: 0, pitch: 0 });
  const otherPlayers = useRef<Map<string, { pos: THREE.Vector3; alive: boolean; hp: number; username: string; teamId: number; mesh: THREE.Group }>>(new Map());
  const playerRef = useRef<THREE.Group | null>(null);
  const lastShotRef = useRef(0);
  const lastSyncRef = useRef(0);
  const gameOverRef = useRef(false);
  const myTeamId = useRef(-1);
  const teammates = useRef<{ uid: string; username: string; alive: boolean; hp: number; x: number; z: number; downed: boolean }[]>([]);
  const matchStartRef = useRef(Date.now());
  const reviveTargetRef = useRef<string | null>(null);
  const reviveTimerRef = useRef(0);
  const phaseRef = useRef<BrMatchPhase>('plane');
  const planeAngle = useRef(0);
  const muzzleFlashRef = useRef<THREE.Mesh | null>(null);
  const lootMeshes = useRef<THREE.Mesh[]>([]);
  const lootData = useRef<{ id: string; type: string; x: number; z: number; mesh: THREE.Mesh; taken: boolean }[]>([]);
  const pickupPromptRef = useRef<{ type: string; x: number; z: number } | null>(null);

  const [hudState, setHudState] = useState({
    hp: 100, maxHp: 100, armor: 0, weapon: 'pistol', kills: 0,
    aliveCount: 0, totalPlayers: 0, zoneRadius: 50, zoneTimer: 30,
    killFeed: [] as { killer: string; victim: string }[],
    alive: true, place: 0, winner: false,
    teammates: [] as { uid: string; username: string; alive: boolean; hp: number; x: number; z: number; downed: boolean }[],
    myTeamId: -1, reviveTarget: null as string | null, reviveProgress: 0,
    phase: 'plane' as BrMatchPhase,
    medkits: [] as string[], ammo: 30, canJump: false, currentLocation: '',
    nearLoot: null as { type: string; id: string } | null,
  });
  const stateRef = useRef(hudState);
  const setRef = (s: typeof hudState | ((prev: typeof hudState) => typeof hudState)) => {
    if (typeof s === 'function') { const n = (s as (p: typeof hudState) => typeof hudState)(stateRef.current); stateRef.current = n; setHudState(n); }
    else { stateRef.current = s; setHudState(s); }
  };
  const [showGameOver, setShowGameOver] = useState(false);
  const gameOverData = useRef({ place: 0, kills: 0, winner: false });

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const scene = new THREE.Scene(); sceneRef.current = scene;
    scene.fog = new THREE.Fog(0x87ceeb, 120, 200);
    const camera = new THREE.PerspectiveCamera(70, canvas.clientWidth / canvas.clientHeight, 0.1, 300);
    camera.position.set(0, 80, 0); cameraRef.current = camera;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(canvas.clientWidth, canvas.clientHeight); renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true; rendererRef.current = renderer;

    scene.add(new THREE.AmbientLight(0x404060, 0.6));
    const sun = new THREE.DirectionalLight(0xffeedd, 1.2); sun.position.set(30, 60, 20); sun.castShadow = true; scene.add(sun);
    scene.add(new THREE.HemisphereLight(0x88ccff, 0x445522, 0.4));

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(MAP, MAP), new THREE.MeshStandardMaterial({ color: 0x4a7c3f, roughness: 0.9 }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
    const grid = new THREE.GridHelper(MAP, 30, 0x335533, 0x335533); grid.position.y = 0.05; scene.add(grid);

    for (const b of BUILDINGS) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), new THREE.MeshStandardMaterial({ color: 0x8a7a6a }));
      m.position.set(b.x, b.h / 2, b.z); m.castShadow = true; m.receiveShadow = true; scene.add(m);
      const r = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.3, 0.3, b.d + 0.3), new THREE.MeshStandardMaterial({ color: 0x6a3a2a }));
      r.position.set(b.x, b.h + 0.15, b.z); scene.add(r);
    }
    for (const t of TREES) {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2 * t.s, 0.3 * t.s, 1.2 * t.s), new THREE.MeshStandardMaterial({ color: 0x6a4a2a }));
      trunk.position.set(t.x, 0.6 * t.s, t.z); scene.add(trunk);
      const fol = new THREE.Mesh(new THREE.ConeGeometry(1.2 * t.s, 1.8 * t.s, 6), new THREE.MeshStandardMaterial({ color: 0x3a7a2a }));
      fol.position.set(t.x, 1.8 * t.s + 0.5 * t.s, t.z); scene.add(fol);
    }

    // Zone ring
    const ring = new THREE.Mesh(new THREE.RingGeometry(48, 50, 64), new THREE.MeshBasicMaterial({ color: 0x4488ff, side: THREE.DoubleSide, transparent: true, opacity: 0.12 }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.2; ring.name = 'zoneRing'; scene.add(ring);
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(50, 50, 10, 64, 1, true), new THREE.MeshBasicMaterial({ color: 0x4488ff, side: THREE.DoubleSide, transparent: true, opacity: 0.06 }));
    wall.position.y = 5; wall.name = 'zoneWall'; scene.add(wall);

    // Player gun (just for muzzle flash reference)
    const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0 }));
    muzzle.position.set(0.5, 1.2, -1); muzzle.name = 'muzzle'; scene.add(muzzle); muzzleFlashRef.current = muzzle;

    // Gun model in view
    const gunGroup = new THREE.Group();
    const gunBody = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.5), new THREE.MeshStandardMaterial({ color: 0x444444 }));
    gunBody.position.set(0.3, -0.15, -0.5); gunGroup.add(gunBody);
    const gunBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.3, 6), new THREE.MeshStandardMaterial({ color: 0x333333 }));
    gunBarrel.rotation.x = Math.PI / 2; gunBarrel.position.set(0.3, -0.15, -0.85); gunGroup.add(gunBarrel);
    camera.add(gunGroup); scene.add(camera);

    const onResize = () => { camera.aspect = canvas.clientWidth / canvas.clientHeight; camera.updateProjectionMatrix(); renderer.setSize(canvas.clientWidth, canvas.clientHeight); };
    window.addEventListener('resize', onResize);
    const onMouseDown = () => { mouseDown.current = true; };
    const onMouseUp = () => { mouseDown.current = false; };
    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement === canvas) {
        playerPos.current.ry -= e.movementX * 0.002;
        playerPos.current.pitch = Math.max(-1.2, Math.min(1.2, playerPos.current.pitch - e.movementY * 0.002));
      }
    };
    canvas.addEventListener('mousedown', onMouseDown); canvas.addEventListener('mouseup', onMouseUp);
    document.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('click', () => { if (phaseRef.current !== 'plane') canvas.requestPointerLock(); });
    const onKeyDown = (e: KeyboardEvent) => keys.current.add(e.code.toLowerCase());
    const onKeyUp = (e: KeyboardEvent) => keys.current.delete(e.code.toLowerCase());
    document.addEventListener('keydown', onKeyDown); document.addEventListener('keyup', onKeyUp);

    let animId: number; const clock = new THREE.Clock();
    let muzzleTimer = 0;

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);
      const p = playerPos.current; const s = stateRef.current; const phase = phaseRef.current;

      // Muzzle flash fade
      if (muzzleTimer > 0) {
        muzzleTimer -= dt;
        const mat = muzzle.material as THREE.MeshBasicMaterial; if (mat.opacity > 0) { mat.opacity = Math.max(0, muzzleTimer * 5); mat.needsUpdate = true; }
      }

      // ─── PLANE ───────
      if (phase === 'plane') {
        planeAngle.current += dt * 0.15;
        const px = Math.cos(planeAngle.current) * 120;
        const pz = Math.sin(planeAngle.current) * 120;
        camera.position.set(px, 80, pz); camera.lookAt(0, 0, 0);
        setRef(r => ({ ...r, canJump: true }));
        if (keys.current.has('keyf')) {
          phaseRef.current = 'parachute'; playerPos.current.x = px; playerPos.current.z = pz; playerPos.current.y = 80;
          p.pitch = 0; setRef(r => ({ ...r, phase: 'parachute', canJump: false })); document.exitPointerLock();
        }
      }

      // ─── PARACHUTE ───
      else if (phase === 'parachute') {
        p.y -= PARACHUTE_FALL * dt;
        if (p.y < 0) { p.y = 0; phaseRef.current = 'active'; setRef(r => ({ ...r, phase: 'active' })); canvas.requestPointerLock(); }
        const forward = new THREE.Vector3(-Math.sin(p.ry), 0, -Math.cos(p.ry));
        const right = new THREE.Vector3(Math.cos(p.ry), 0, -Math.sin(p.ry));
        let mx = 0, mz = 0;
        if (keys.current.has('keyw')) { mx += forward.x; mz += forward.z; }
        if (keys.current.has('keys')) { mx -= forward.x; mz -= forward.z; }
        if (keys.current.has('keya')) { mx += right.x; mz += right.z; }
        if (keys.current.has('keyd')) { mx -= right.x; mz -= right.z; }
        const len = Math.sqrt(mx * mx + mz * mz);
        if (len > 0) { p.x += (mx / len) * PARACHUTE_SPEED * dt; p.z += (mz / len) * PARACHUTE_SPEED * dt; }
        camera.position.set(p.x, p.y + 4, p.z + 3); camera.lookAt(p.x, p.y - 2, p.z);
        if (Date.now() - lastSyncRef.current > 100) { lastSyncRef.current = Date.now(); updateDoc(doc(db, 'br_matches', matchId, 'players', profile.uid), { x: p.x, y: p.y, z: p.z, ry: p.ry }).catch(() => {}); }
      }

      // ─── ACTIVE ──────
      else if (phase === 'active' && s.alive) {
        // Movement
        const h = Math.cos(p.pitch);
        const forward = new THREE.Vector3(-Math.sin(p.ry) * h, Math.sin(p.pitch), -Math.cos(p.ry) * h);
        const right = new THREE.Vector3(Math.cos(p.ry), 0, -Math.sin(p.ry));
        let mx = 0, mz = 0;
        if (keys.current.has('keyw')) { mx += forward.x; mz += forward.z; }
        if (keys.current.has('keys')) { mx -= forward.x; mz -= forward.z; }
        if (keys.current.has('keya')) { mx += right.x; mz += right.z; }
        if (keys.current.has('keyd')) { mx -= right.x; mz -= right.z; }
        const len = Math.sqrt(mx * mx + mz * mz);
        if (len > 0) { const nx = p.x + (mx / len) * SPEED * dt; const nz = p.z + (mz / len) * SPEED * dt; if (!collides(nx, p.z)) p.x = nx; if (!collides(p.x, nz)) p.z = nz; }

        // FPS Camera
        camera.position.set(p.x, 1.6, p.z);
        const lookX = p.x + Math.sin(p.ry) * Math.cos(p.pitch) * 10;
        const lookY = 1.6 + Math.sin(p.pitch) * 10;
        const lookZ = p.z + Math.cos(p.ry) * Math.cos(p.pitch) * 10;
        camera.lookAt(lookX, lookY, lookZ);

        // Shoot
        if (mouseDown.current) {
          const now = Date.now();
          const wpn = BR_WEAPONS[s.weapon] || BR_WEAPONS.pistol;
          if (now - lastShotRef.current > wpn.fireRate && s.ammo > 0) {
            lastShotRef.current = now;
            // Muzzle flash
            const mat2 = muzzle.material as THREE.MeshBasicMaterial; mat2.opacity = 1; muzzleTimer = 0.15; mat2.needsUpdate = true;

            setRef(r => ({ ...r, ammo: r.ammo - 1 }));
            otherPlayers.current.forEach((op, uid) => {
              if (!op.alive || op.hp <= 0 || uid === profile.uid) return;
              if (mode === 'duo' && op.teamId === myTeamId.current) return;
              const dist2d = dist(p.x, p.z, op.pos.x, op.pos.z);
              if (dist2d > wpn.range) return;
              // Simple hit: check angle from player direction to target
              const dx = op.pos.x - p.x; const dz = op.pos.z - p.z;
              const angle = Math.atan2(dz, dx);
              let diff = angle - p.ry; while (diff > Math.PI) diff -= Math.PI * 2; while (diff < -Math.PI) diff += Math.PI * 2;
              if (Math.abs(diff) < 0.25) {
                const dmg = wpn.damage; op.hp -= dmg;
                updateDoc(doc(db, 'br_matches', matchId, 'players', uid), { hp: Math.max(0, op.hp) }).catch(() => {});
                const died = op.hp <= 0;
                const newKills = s.kills + (died ? 1 : 0);
                const newFeed = [...s.killFeed, { killer: profile.username, victim: op.username }];
                setRef(r => ({ ...r, kills: newKills, killFeed: newFeed.slice(-10) }));
                if (died) { updateDoc(doc(db, 'br_matches', matchId, 'players', uid), { alive: false }).catch(() => {}); updateDoc(doc(db, 'br_matches', matchId, 'players', profile.uid), { kills: newKills }).catch(() => {}); }
              }
            });
          }
        }

        // Use medkit
        if (keys.current.has('digit1') && s.medkits.includes('bandage') && s.hp < s.maxHp) { useMedkit('bandage'); keys.current.delete('digit1'); }
        if (keys.current.has('digit2') && s.medkits.includes('medkit') && s.hp < s.maxHp) { useMedkit('medkit'); keys.current.delete('digit2'); }
        if (keys.current.has('digit3') && s.medkits.includes('largeMed') && s.hp < s.maxHp) { useMedkit('largeMed'); keys.current.delete('digit3'); }

        // Pick up loot (E key)
        pickupPromptRef.current = null;
        if (s.alive) {
          for (const lt of lootData.current) {
            if (lt.taken) continue;
            if (dist(p.x, p.z, lt.x, lt.z) < 2.5) {
              pickupPromptRef.current = { type: lt.type, x: lt.x, z: lt.z };
              if (keys.current.has('keye')) {
                lt.taken = true; lt.mesh.visible = false;
                keys.current.delete('keye');
                if (MEDKIT_TYPES.includes(lt.type)) {
                  setRef(r => ({ ...r, medkits: [...r.medkits, lt.type] }));
                } else if (lt.type === 'armor') {
                  setRef(r => ({ ...r, armor: 100 }));
                } else if (BR_WEAPONS[lt.type]) {
                  setRef(r => ({ ...r, weapon: lt.type, ammo: BR_WEAPONS[lt.type].ammo }));
                }
              }
            }
          }
        }

        // Revive
        if (keys.current.has('keye') && reviveTargetRef.current && s.alive) {
          const rt = teammates.current.find(t => t.uid === reviveTargetRef.current);
          if (rt && !rt.alive) { reviveTimerRef.current += dt; const pr = Math.min(1, reviveTimerRef.current / 5); setRef(r => ({ ...r, reviveProgress: pr })); if (pr >= 1) { const tu = reviveTargetRef.current; updateDoc(doc(db, 'br_matches', matchId, 'players', tu), { hp: 50, alive: true }).catch(() => {}); const t = teammates.current.find(t2 => t2.uid === tu); if (t) { t.alive = true; t.hp = 50; t.downed = false; } reviveTargetRef.current = null; reviveTimerRef.current = 0; setRef(r => ({ ...r, reviveTarget: null, reviveProgress: 0 })); } }
        } else if (reviveTargetRef.current && !keys.current.has('keye')) { reviveTargetRef.current = null; reviveTimerRef.current = 0; setRef(r => ({ ...r, reviveTarget: null, reviveProgress: 0 })); }

        // Zone damage
        if (isOutsideZone(p.x, p.z, { centerX: 0, centerZ: 0, radius: s.zoneRadius, phase: 0, nextRadius: 0, timer: 0 })) {
          const dmg = 2 + Math.floor(s.zoneRadius / 15); const nh = Math.max(0, s.hp - dmg * dt);
          setRef(r => ({ ...r, hp: nh })); if (nh <= 0 && s.alive) handleDie();
        }

        // Location
        let locName = '';
        for (const loc of BR_MAP_LOCATIONS) { if (dist(p.x, p.z, loc.x, loc.z) < 22) { locName = loc.name; break; } }
        if (locName !== s.currentLocation) setRef(r => ({ ...r, currentLocation: locName }));
      }

      // Update other players
      otherPlayers.current.forEach(op => { if (op.mesh) { op.mesh.position.copy(op.pos); op.mesh.visible = op.alive && op.hp > 0; } });

      // Sync
      if (phase === 'active' && Date.now() - lastSyncRef.current > 50 && s.alive) {
        lastSyncRef.current = Date.now(); updateDoc(doc(db, 'br_matches', matchId, 'players', profile.uid), { x: p.x, y: 0, z: p.z, ry: p.ry, hp: s.hp }).catch(() => {});
      }

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId); window.removeEventListener('resize', onResize);
      canvas.removeEventListener('mousedown', onMouseDown); canvas.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('keydown', onKeyDown); document.removeEventListener('keyup', onKeyUp);
      if (document.pointerLockElement === canvas) document.exitPointerLock(); renderer.dispose();
    };
  }, []);

  const useMedkit = (type: string) => {
    const heal = MEDKIT_HEALS[type] || 25; const s = stateRef.current; const meds = [...s.medkits]; const idx = meds.indexOf(type);
    if (idx >= 0) { meds.splice(idx, 1); const nh = Math.min(s.maxHp, s.hp + heal); setRef(r => ({ ...r, hp: nh, medkits: meds })); updateDoc(doc(db, 'br_matches', matchId, 'players', profile.uid), { hp: nh }).catch(() => {}); }
  };

  const handleDie = () => {
    if (gameOverRef.current) return; gameOverRef.current = true;
    const s = stateRef.current; setRef({ ...s, alive: false });
    updateDoc(doc(db, 'br_matches', matchId, 'players', profile.uid), { alive: false, hp: 0 }).catch(() => {});
    document.exitPointerLock();
    if (mode === 'duo') { const tm = teammates.current.find(t => t.alive && t.hp > 0); if (tm) { setTimeout(() => { gameOverData.current = { place: s.aliveCount, kills: s.kills, winner: false }; setShowGameOver(true); }, 2000); return; } }
    setTimeout(() => { gameOverData.current = { place: s.aliveCount, kills: s.kills, winner: false }; setShowGameOver(true); }, 1000);
  };

  // Firebase
  useEffect(() => {
    if (!matchId) return;
    const matchRef = doc(db, 'br_matches', matchId);
    const initPlayer = async () => {
      const snap = await getDoc(matchRef); const data = snap.data() as any;
      if (data?.startTime) matchStartRef.current = data.startTime;
      if (mode === 'duo' && data?.teams) {
        const mt = data.teams.find((t: any) => t.members.includes(profile.uid));
        if (mt) { myTeamId.current = mt.id; const tu = mt.members.find((u: string) => u !== profile.uid); if (tu) { const td = (data.players || []).find((p: any) => p.uid === tu); teammates.current = [{ uid: tu, username: td?.username ?? 'Teammate', alive: true, hp: 100, x: 0, z: 0, downed: false }]; } }
      }
      await setDoc(doc(db, 'br_matches', matchId, 'players', profile.uid), { uid: profile.uid, username: profile.username, x: 0, y: 80, z: 0, rx: 0, ry: 0, hp: 100, maxHp: 100, armor: 0, alive: true, kills: 0, weapon: 'pistol', teamId: myTeamId.current, isBot: false });
    };
    initPlayer();

    const unsub = onSnapshot(matchRef, (snap) => {
      const data = snap.data(); if (!data) return;
      const { zone, players, status, winnerId } = data as any;
      const livePlayers = players || []; const aliveCount = livePlayers.filter((p: any) => p.alive).length;
      const s = stateRef.current;

      if (status === 'finished') {
        if (mode === 'duo') { const wt = (data as any).teams?.find((t: any) => t.id === winnerId); if (wt?.members.includes(profile.uid)) { gameOverData.current = { place: 1, kills: s.kills, winner: true }; setShowGameOver(true); return; } }
        if (winnerId === profile.uid) { gameOverData.current = { place: 1, kills: s.kills, winner: true }; setShowGameOver(true); return; }
      }

      // Spawn loot visuals if not done
      if ((data as any).loot && lootData.current.length === 0) {
        const sc = sceneRef.current;
        if (sc) {
          for (const lt of (data as any).loot) {
            const col = MEDKIT_TYPES.includes(lt.type) ? 0x44ff44 : lt.type === 'armor' ? 0x4488ff : 0xffaa44;
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.15, 0.4), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.3 }));
            mesh.position.set(lt.x, 0.2, lt.z); sc.add(mesh);
            lootMeshes.current.push(mesh);
            lootData.current.push({ id: lt.id, type: lt.type, x: lt.x, z: lt.z, mesh, taken: lt.taken || false });
          }
        }
      }

      const ut = mode === 'duo' ? [...teammates.current] : [];
      for (const p of livePlayers) {
        if (p.uid === profile.uid) {
          if (phaseRef.current !== 'plane' && !keys.current.has('keyw') && !keys.current.has('keys') && !keys.current.has('keya') && !keys.current.has('keyd')) {
            playerPos.current.x = p.x ?? 0; playerPos.current.z = p.z ?? 0;
          }
          setRef(r => ({ ...r, hp: p.hp ?? 100, alive: p.alive ?? true, kills: p.kills ?? 0, weapon: p.weapon ?? 'pistol', armor: p.armor ?? 0 }));
        } else {
          const isTm = mode === 'duo' && p.teamId === myTeamId.current;
          if (isTm) {
            const idx = ut.findIndex(t => t.uid === p.uid);
            if (idx >= 0) ut[idx] = { ...ut[idx], alive: p.alive ?? true, hp: p.hp ?? 0, x: p.x ?? 0, z: p.z ?? 0 };
            else ut.push({ uid: p.uid, username: p.username ?? 'Teammate', alive: p.alive ?? true, hp: p.hp ?? 100, x: p.x ?? 0, z: p.z ?? 0, downed: false });
            const d2 = dist(playerPos.current.x, playerPos.current.z, p.x ?? 0, p.z ?? 0);
            if (!p.alive && d2 < 3 && phaseRef.current === 'active' && stateRef.current.alive) { reviveTargetRef.current = p.uid; setRef(r => ({ ...r, reviveTarget: p.uid })); }
            else if (reviveTargetRef.current === p.uid && d2 >= 3) { reviveTargetRef.current = null; reviveTimerRef.current = 0; setRef(r => ({ ...r, reviveTarget: null, reviveProgress: 0 })); }
          }
          if (!otherPlayers.current.has(p.uid)) {
            const isBotPlayer = p.isBot ?? false;
            const col = isTm ? 0x44ff44 : isBotPlayer ? BOT_COLORS[Math.floor(Math.random() * BOT_COLORS.length)] : PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)];
            const sc = sceneRef.current; if (sc) {
              const g = createPlayerMesh(col, isBotPlayer, isTm);
              sc.add(g);
              otherPlayers.current.set(p.uid, { pos: new THREE.Vector3(p.x ?? 0, 0, p.z ?? 0), alive: p.alive ?? true, hp: p.hp ?? 100, username: p.username ?? '', teamId: p.teamId ?? -1, mesh: g });
            }
          } else { const op = otherPlayers.current.get(p.uid)!; op.pos.set(p.x ?? 0, 0, p.z ?? 0); op.alive = p.alive ?? true; op.hp = p.hp ?? 100; if (p.ry !== undefined) op.mesh.rotation.y = p.ry; }
        }
      }
      const uids = new Set(livePlayers.map((p: any) => p.uid));
      otherPlayers.current.forEach((op, uid) => { if (!uids.has(uid)) { if (op.mesh.parent) op.mesh.parent.remove(op.mesh); otherPlayers.current.delete(uid); } });
      teammates.current = ut;
      setRef(r => ({ ...r, aliveCount, totalPlayers: livePlayers.length, zoneRadius: zone?.radius ?? 50, teammates: ut }));
    });

    // Zone timer: 60s delay, then shrink
    const zoneInterval = setInterval(() => {
      const elapsed = (Date.now() - matchStartRef.current) / 1000;
      if (elapsed < 60) return; // Wait 60 seconds before zone starts
      const zoneElapsed = elapsed - 60;
      let totalWait = 0, phaseIdx = 0, phaseStart = 0;
      for (let i = 0; i < BR_ZONE_PHASES.length; i++) {
        const p = BR_ZONE_PHASES[i];
        if (zoneElapsed < totalWait + p.wait) { phaseIdx = i; phaseStart = totalWait; break; }
        totalWait += p.wait;
        if (zoneElapsed < totalWait + totalWait) { phaseIdx = i; phaseStart = totalWait; break; }
        totalWait += totalWait;
      }
      if (phaseIdx >= BR_ZONE_PHASES.length) phaseIdx = BR_ZONE_PHASES.length - 1;
      const zd = BR_ZONE_PHASES[phaseIdx];
      const t = Math.min(1, (zoneElapsed - phaseStart) / Math.max(1, zd.wait));
      const nr = Math.max(zd.shrinkTo, zd.radius - (zd.radius - zd.shrinkTo) * t);
      const ring2 = sceneRef.current?.getObjectByName('zoneRing') as THREE.Mesh;
      if (ring2) { const or = Math.max(nr, 2); const ir = Math.max(or - 2, 0); const g = new THREE.RingGeometry(ir, or, 64); ring2.geometry.dispose(); ring2.geometry = g; }
      const wall2 = sceneRef.current?.getObjectByName('zoneWall') as THREE.Mesh;
      if (wall2) { wall2.geometry.dispose(); wall2.geometry = new THREE.CylinderGeometry(nr, nr, 10, 64, 1, true); }
      setRef(r => ({ ...r, zoneRadius: nr }));
    }, 1000);

    return () => { unsub(); clearInterval(zoneInterval); };
  }, [matchId, profile.uid, mode]);

  return (
    <div className="relative w-full h-full overflow-hidden bg-black select-none">
      <canvas ref={canvasRef} className="w-full h-full block cursor-crosshair" />

      {hudState.phase === 'plane' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 z-40 flex flex-col items-center justify-center pointer-events-none">
          <div className="bg-black/60 backdrop-blur-sm px-6 py-4 rounded-2xl border border-white/10 text-center space-y-3">
            <Plane className="w-10 h-10 text-blue-400 mx-auto animate-pulse" />
            <h2 className="font-heading text-lg font-black text-white uppercase tracking-widest">Flight Phase</h2>
            <p className="font-mono text-[10px] text-slate-400">Press <span className="text-yellow-400 font-bold">F</span> to jump</p>
            <p className="font-mono text-[8px] text-slate-600">WASD to steer while parachuting</p>
          </div>
          <div className="mt-4 text-[9px] font-mono text-slate-500 bg-black/40 px-3 py-1 rounded-full border border-white/5">{BR_MAP_LOCATIONS.map(l => l.name).join(' • ')}</div>
        </motion.div>
      )}

      {hudState.phase === 'parachute' && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
          <div className="bg-black/60 backdrop-blur-sm px-4 py-2 rounded-full border border-white/5 flex items-center gap-2">
            <ChevronsDown className="w-4 h-4 text-yellow-400 animate-bounce" /><span className="font-mono text-[9px] text-slate-400">Parachuting — WASD steer</span>
          </div>
        </div>
      )}

      {/* Loot pickup prompt */}
      {hudState.phase === 'active' && hudState.alive && pickupPromptRef.current && !keys.current.has('keye') && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
          <div className="bg-yellow-900/80 backdrop-blur-sm px-3 py-1.5 rounded-full border border-yellow-500/30 text-[9px] font-mono text-yellow-300">
            Press <span className="font-bold text-white">E</span> to pick up {pickupPromptRef.current.type}
          </div>
        </div>
      )}

      {hudState.phase === 'active' && hudState.alive && (
        <BRHud
          hp={hudState.hp} maxHp={hudState.maxHp} armor={hudState.armor}
          weapon={hudState.weapon} kills={hudState.kills}
          aliveCount={hudState.aliveCount} totalPlayers={hudState.totalPlayers}
          zoneRadius={hudState.zoneRadius}
          killFeed={hudState.killFeed}
          posX={playerPos.current.x} posZ={playerPos.current.z}
          mode={mode} teammates={hudState.teammates} myTeamId={hudState.myTeamId}
          reviveTarget={hudState.reviveTarget} reviveProgress={hudState.reviveProgress}
          medkits={hudState.medkits} ammo={hudState.ammo} currentLocation={hudState.currentLocation}
          otherPlayers={Array.from(otherPlayers.current.entries()).map(([uid, op]) => ({ uid, x: op.pos.x, z: op.pos.z, alive: op.alive, teamId: op.teamId }))}
          onBack={onBack}
        />
      )}

      {!stateRef.current.alive && !showGameOver && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-40">
          <div className="bg-black/80 rounded-xl p-6 border border-white/10 text-center space-y-3">
            <p className="font-heading text-sm font-black text-slate-400 uppercase tracking-widest">You Died</p>
            <p className="font-mono text-[10px] text-slate-500">Place #{stateRef.current.aliveCount} • {stateRef.current.kills} kills</p>
            <button onClick={onBack} className="px-4 py-1.5 bg-gradient-to-r from-red-600 to-orange-600 rounded-lg font-heading text-[10px] font-black uppercase cursor-pointer active:scale-95 transition-all">Back</button>
          </div>
        </div>
      )}

      {showGameOver && (
        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="absolute inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="text-center space-y-4">
            <Skull className="w-16 h-16 mx-auto text-red-500" />
            <h2 className="font-heading text-2xl font-black text-white uppercase tracking-widest">{gameOverData.current.winner ? (mode === 'duo' ? 'Team Victory!' : 'Winner Winner!') : 'Eliminated'}</h2>
            <p className="font-mono text-sm text-slate-400">Place #{gameOverData.current.place} • {gameOverData.current.kills} kill{gameOverData.current.kills !== 1 ? 's' : ''}</p>
            <button onClick={onBack} className="px-6 py-2 bg-gradient-to-r from-red-600 to-orange-600 rounded-lg font-heading text-xs font-black uppercase cursor-pointer active:scale-95 transition-all">Back to Lobby</button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
