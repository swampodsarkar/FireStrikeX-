import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { db, doc, onSnapshot, updateDoc, getDoc, setDoc } from '../lib/firebase';
import { PlayerProfile, BrPlayerState, BR_WEAPONS, BR_ZONE_PHASES, BrMode, BrTeam } from '../types';
import { calcBulletHit, isOutsideZone, generateLoot } from '../lib/brEngine';
import BRHud from './BRHud';
import { motion } from 'motion/react';
import { Skull } from 'lucide-react';

interface BRGameProps {
  profile: PlayerProfile;
  matchId: string;
  mode: BrMode;
  onBack: () => void;
}

const MAP = 100;
const BUILDINGS = [
  { x: -25, z: -25, w: 10, d: 8, h: 4 }, { x: 25, z: -20, w: 12, d: 6, h: 3.5 },
  { x: -20, z: 25, w: 8, d: 10, h: 4.5 }, { x: 30, z: 25, w: 14, d: 7, h: 3 },
  { x: -5, z: -5, w: 6, d: 6, h: 2.5 }, { x: -30, z: 10, w: 7, d: 7, h: 3 },
  { x: 20, z: -35, w: 8, d: 5, h: 4 }, { x: 35, z: -5, w: 5, d: 8, h: 3.5 },
];
const TREES = Array.from({ length: 20 }, () => ({
  x: (Math.random() - 0.5) * MAP * 0.8, z: (Math.random() - 0.5) * MAP * 0.8, s: 1 + Math.random() * 1.5,
}));
const PLAYER_COLORS = [0xff4444, 0x44aaff, 0x44ff44, 0xffaa44, 0xff44ff, 0xffff44, 0x44ffff, 0xff8844, 0x88ff44, 0x4488ff];
const TEAM_COLORS = [0x44aaff, 0x44ff44, 0xffaa44, 0xff44ff, 0xffff44];

function buildingBounds(b: typeof BUILDINGS[number]) {
  return { minX: b.x - b.w / 2, maxX: b.x + b.w / 2, minZ: b.z - b.d / 2, maxZ: b.z + b.d / 2 };
}
function collides(x: number, z: number): boolean {
  for (const b of BUILDINGS) {
    const bb = buildingBounds(b);
    if (x > bb.minX && x < bb.maxX && z > bb.minZ && z < bb.maxZ) return true;
  }
  return Math.abs(x) > MAP / 2 || Math.abs(z) > MAP / 2;
}
const SPEED = 12;

export default function BRGame({ profile, matchId, mode, onBack }: BRGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const keys = useRef<Set<string>>(new Set());
  const mouseDown = useRef(false);
  const playerPos = useRef({ x: 0, y: 0, z: 0, ry: 0 });
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
  const lastReviveBeepRef = useRef(0);

  const [hudState, setHudState] = useState({
    hp: 100, maxHp: 100, armor: 0, weapon: 'pistol', kills: 0,
    aliveCount: 0, totalPlayers: 0, zoneRadius: 50, zoneTimer: 30,
    killFeed: [] as { killer: string; victim: string }[],
    alive: true, place: 0, winner: false,
    teammates: [] as { uid: string; username: string; alive: boolean; hp: number; x: number; z: number; downed: boolean }[],
    myTeamId: -1,
    reviveTarget: null as string | null,
    reviveProgress: 0,
  });
  const stateRef = useRef(hudState);
  const setRef = (s: typeof hudState | ((prev: typeof hudState) => typeof hudState)) => {
    if (typeof s === 'function') {
      const next = (s as (prev: typeof hudState) => typeof hudState)(stateRef.current);
      stateRef.current = next; setHudState(next);
    } else {
      stateRef.current = s; setHudState(s);
    }
  };

  const [showGameOver, setShowGameOver] = useState(false);
  const gameOverData = useRef({ place: 0, kills: 0, winner: false });

  // Build 3D scene
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const scene = new THREE.Scene(); sceneRef.current = scene;
    scene.fog = new THREE.Fog(0x87ceeb, 60, 120);
    const camera = new THREE.PerspectiveCamera(70, canvas.clientWidth / canvas.clientHeight, 0.1, 200);
    camera.position.set(0, 5, 0); cameraRef.current = camera;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true; rendererRef.current = renderer;

    const ambient = new THREE.AmbientLight(0x404060, 0.6); scene.add(ambient);
    const sun = new THREE.DirectionalLight(0xffeedd, 1.2); sun.position.set(30, 40, 20); sun.castShadow = true; scene.add(sun);
    const hemi = new THREE.HemisphereLight(0x88ccff, 0x445522, 0.4); scene.add(hemi);

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(MAP, MAP), new THREE.MeshStandardMaterial({ color: 0x4a7c3f, roughness: 0.9 }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
    const grid = new THREE.GridHelper(MAP, 20, 0x335533, 0x335533); grid.position.y = 0.05; scene.add(grid);

    for (const b of BUILDINGS) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), new THREE.MeshStandardMaterial({ color: 0x8a7a6a, roughness: 0.8 }));
      mesh.position.set(b.x, b.h / 2, b.z); mesh.castShadow = true; mesh.receiveShadow = true; scene.add(mesh);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.3, 0.3, b.d + 0.3), new THREE.MeshStandardMaterial({ color: 0x6a3a2a, roughness: 0.9 }));
      roof.position.set(b.x, b.h + 0.15, b.z); scene.add(roof);
    }

    for (const t of TREES) {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2 * t.s, 0.3 * t.s, 1.2 * t.s), new THREE.MeshStandardMaterial({ color: 0x6a4a2a }));
      trunk.position.set(t.x, 0.6 * t.s, t.z); scene.add(trunk);
      const foliage = new THREE.Mesh(new THREE.ConeGeometry(1.2 * t.s, 1.8 * t.s, 6), new THREE.MeshStandardMaterial({ color: 0x3a7a2a }));
      foliage.position.set(t.x, 1.8 * t.s + 0.5 * t.s, t.z); scene.add(foliage);
    }

    // Zone ring
    const ring = new THREE.Mesh(new THREE.RingGeometry(48, 50, 64), new THREE.MeshBasicMaterial({ color: 0x4488ff, side: THREE.DoubleSide, transparent: true, opacity: 0.15 }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.1; ring.name = 'zoneRing'; scene.add(ring);
    const wallMesh = new THREE.Mesh(new THREE.CylinderGeometry(50, 50, 10, 64, 1, true), new THREE.MeshBasicMaterial({ color: 0x4488ff, side: THREE.DoubleSide, transparent: true, opacity: 0.08 }));
    wallMesh.position.y = 5; wallMesh.name = 'zoneWall'; scene.add(wallMesh);

    // Own player capsule
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xff4444, emissive: 0xff2222, emissiveIntensity: 0.1 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.45, 1.2, 8), bodyMat); body.position.y = 0.6; body.castShadow = true; group.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), bodyMat); head.position.y = 1.4; head.castShadow = true; group.add(head);
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.5), new THREE.MeshStandardMaterial({ color: 0x666666 })); gun.position.set(0.3, 0.7, -0.5); group.add(gun);
    scene.add(group); playerRef.current = group;

    const onResize = () => { camera.aspect = canvas.clientWidth / canvas.clientHeight; camera.updateProjectionMatrix(); renderer.setSize(canvas.clientWidth, canvas.clientHeight); };
    window.addEventListener('resize', onResize);
    const onMouseDown = () => { mouseDown.current = true; };
    const onMouseUp = () => { mouseDown.current = false; };
    const onMouseMove = (e: MouseEvent) => { if (document.pointerLockElement === canvas) playerPos.current.ry -= e.movementX * 0.002; };
    canvas.addEventListener('mousedown', onMouseDown); canvas.addEventListener('mouseup', onMouseUp);
    document.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('click', () => canvas.requestPointerLock());
    const onKeyDown = (e: KeyboardEvent) => { keys.current.add(e.code.toLowerCase()); };
    const onKeyUp = (e: KeyboardEvent) => { keys.current.delete(e.code.toLowerCase()); };
    document.addEventListener('keydown', onKeyDown); document.addEventListener('keyup', onKeyUp);

    let animId: number; const clock = new THREE.Clock();
    const animate = () => {
      animId = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);
      const p = playerPos.current;
      const s = stateRef.current;

      if (s.alive) {
        const forward = new THREE.Vector3(-Math.sin(p.ry), 0, -Math.cos(p.ry));
        const right = new THREE.Vector3(Math.cos(p.ry), 0, -Math.sin(p.ry));
        let mx = 0, mz = 0;
        if (keys.current.has('keyw')) { mx += forward.x; mz += forward.z; }
        if (keys.current.has('keys')) { mx -= forward.x; mz -= forward.z; }
        if (keys.current.has('keya')) { mx += right.x; mz += right.z; }
        if (keys.current.has('keyd')) { mx -= right.x; mz -= right.z; }
        const len = Math.sqrt(mx * mx + mz * mz);
        if (len > 0) {
          const nx = p.x + (mx / len) * SPEED * dt;
          const nz = p.z + (mz / len) * SPEED * dt;
          if (!collides(nx, p.z)) p.x = nx;
          if (!collides(p.x, nz)) p.z = nz;
        }

        // Revive teammate (hold E)
        if (keys.current.has('keye') && reviveTargetRef.current && s.alive) {
          const rt = teammates.current.find(t => t.uid === reviveTargetRef.current);
          if (rt && !rt.alive) {
            reviveTimerRef.current += dt;
            const progress = Math.min(1, reviveTimerRef.current / 5);
            setRef(r => ({ ...r, reviveProgress: progress }));
            if (progress >= 1) {
              // Revive complete
              const targetUid = reviveTargetRef.current;
              const ref = doc(db, 'br_matches', matchId, 'players', targetUid);
              updateDoc(ref, { hp: 50, alive: true }).catch(() => {});
              const t = teammates.current.find(t2 => t2.uid === targetUid);
              if (t) { t.alive = true; t.hp = 50; t.downed = false; }
              reviveTargetRef.current = null;
              reviveTimerRef.current = 0;
              setRef(r => ({ ...r, reviveTarget: null, reviveProgress: 0 }));
            }
          }
        } else {
          if (reviveTargetRef.current) {
            reviveTargetRef.current = null;
            reviveTimerRef.current = 0;
            setRef(r => ({ ...r, reviveTarget: null, reviveProgress: 0 }));
          }
        }

        // Shoot
        if (mouseDown.current) {
          const now = Date.now();
          const wpn = BR_WEAPONS[s.weapon] || BR_WEAPONS.pistol;
          if (now - lastShotRef.current > wpn.fireRate) {
            lastShotRef.current = now;
            // Check hit vs other players
            otherPlayers.current.forEach((op, uid) => {
              if (!op.alive || op.hp <= 0 || uid === profile.uid) return;
              // Friendly fire check (duo mode)
              if (mode === 'duo' && op.teamId === myTeamId.current) return;
              if (calcBulletHit(p.x, p.z, p.ry, op.pos.x, op.pos.z, wpn.range)) {
                const dmg = wpn.damage;
                op.hp -= dmg;
                const ref = doc(db, 'br_matches', matchId, 'players', uid);
                updateDoc(ref, { hp: Math.max(0, op.hp) }).catch(() => {});
                const died = op.hp <= 0;
                const newKills = s.kills + (died ? 1 : 0);
                const newFeed = [...s.killFeed, { killer: profile.username, victim: op.username }];
                setRef({ ...stateRef.current, kills: newKills, killFeed: newFeed.slice(-10) });
                if (died) {
                  updateDoc(ref, { alive: false }).catch(() => {});
                  updateDoc(doc(db, 'br_matches', matchId, 'players', profile.uid), { kills: newKills }).catch(() => {});
                }
              }
            });
          }
        }
      }

      // Camera
      camera.position.set(p.x, 2, p.z);
      camera.lookAt(p.x + Math.sin(p.ry) * 10, 1.5, p.z + Math.cos(p.ry) * 10);

      if (playerRef.current && s.alive) {
        playerRef.current.position.set(p.x, 0, p.z);
        playerRef.current.rotation.y = p.ry;
        playerRef.current.visible = true;
      } else if (playerRef.current) playerRef.current.visible = false;

      otherPlayers.current.forEach(op => { if (op.mesh) { op.mesh.position.copy(op.pos); op.mesh.visible = op.alive && op.hp > 0; } });

      // Zone damage
      if (s.alive && isOutsideZone(p.x, p.z, { centerX: 0, centerZ: 0, radius: s.zoneRadius, phase: 0, nextRadius: 0, timer: 0 })) {
        const dmg = 2 + Math.floor(s.zoneRadius / 15);
        const newHp = Math.max(0, s.hp - dmg * dt);
        setRef(r => ({ ...r, hp: newHp }));
        if (newHp <= 0 && s.alive) handleDie();
      }

      // Sync to Firebase
      if (Date.now() - lastSyncRef.current > 50 && s.alive) {
        lastSyncRef.current = Date.now();
        const ref = doc(db, 'br_matches', matchId, 'players', profile.uid);
        updateDoc(ref, { x: p.x, y: 0, z: p.z, ry: p.ry, hp: s.hp }).catch(() => {});
      }
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', onResize);
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      if (document.pointerLockElement === canvas) document.exitPointerLock();
      renderer.dispose();
    };
  }, []);

  const handleDie = () => {
    if (gameOverRef.current) return;
    gameOverRef.current = true;
    const s = stateRef.current;
    setRef({ ...s, alive: false });
    const ref = doc(db, 'br_matches', matchId, 'players', profile.uid);
    updateDoc(ref, { alive: false, hp: 0 }).catch(() => {});
    document.exitPointerLock();

    // Check team elimination (duo mode)
    if (mode === 'duo') {
      const tm = teammates.current.find(t => t.alive && t.hp > 0);
      if (tm) {
        // Teammate alive → spectate mode
        setTimeout(() => {
          const place = s.aliveCount;
          gameOverData.current = { place, kills: s.kills, winner: false };
          setShowGameOver(true);
        }, 2000);
        return;
      }
    }

    setTimeout(() => {
      const aliveCount = s.aliveCount - 1;
      const place = aliveCount + 1;
      gameOverData.current = { place, kills: s.kills, winner: false };
      setShowGameOver(true);
    }, 1000);
  };

  // Firebase listeners
  useEffect(() => {
    if (!matchId) return;
    const matchRef = doc(db, 'br_matches', matchId);

    const initPlayer = async () => {
      const snap = await getDoc(matchRef);
      const data = snap.data() as any;
      if (data && (!data.loot || data.loot.length === 0)) {
        const loot = generateLoot();
        await updateDoc(matchRef, { loot });
      }
      if (data?.startTime) matchStartRef.current = data.startTime;

      // Find my teamId from player data
      const myData = (data?.players || []).find((p: any) => p.uid === profile.uid);
      myTeamId.current = myData?.teamId ?? -1;

      // Find teammate
      if (mode === 'duo' && data?.teams) {
        const myTeam = data.teams.find((t: BrTeam) => t.members.includes(profile.uid));
        if (myTeam) {
          myTeamId.current = myTeam.id;
          const tmUid = myTeam.members.find((u: string) => u !== profile.uid);
          if (tmUid) {
            const tmData = (data.players || []).find((p: any) => p.uid === tmUid);
            teammates.current = [{
              uid: tmUid,
              username: tmData?.username ?? 'Teammate',
              alive: true, hp: 100, x: 0, z: 0, downed: false,
            }];
          }
        }
      }

      const pRef = doc(db, 'br_matches', matchId, 'players', profile.uid);
      await setDoc(pRef, {
        uid: profile.uid, username: profile.username,
        x: 0, y: 0, z: 0, rx: 0, ry: 0,
        hp: 100, maxHp: 100, armor: 0, alive: true, kills: 0, weapon: 'pistol',
        teamId: myTeamId.current,
      });
    };
    initPlayer();

    const unsub = onSnapshot(matchRef, (snap) => {
      const data = snap.data();
      if (!data) return;
      const { zone, players, status, winnerId, teams } = data as any;
      if (data.startTime) matchStartRef.current = data.startTime;
      const livePlayers = players || [];
      const aliveCount = livePlayers.filter((p: any) => p.alive).length;
      const totalPlayers = livePlayers.length;
      const s = stateRef.current;

      // Check win condition for duo
      if (status === 'finished') {
        if (winnerId) {
          // Check if my team won
          if (mode === 'duo' && teams) {
            const winnerTeam = teams.find((t: BrTeam) => t.id === winnerId);
            if (winnerTeam && winnerTeam.members.includes(profile.uid)) {
              gameOverData.current = { place: 1, kills: s.kills, winner: true };
              setShowGameOver(true);
              return;
            }
          }
          if (winnerId === profile.uid) {
            gameOverData.current = { place: 1, kills: s.kills, winner: true };
            setShowGameOver(true);
            return;
          }
        }
      }

      // Update other players
      const updatedTeammates = mode === 'duo' ? [...teammates.current] : [];
      for (const p of livePlayers) {
        if (p.uid === profile.uid) {
          if (!keys.current.has('keyw') && !keys.current.has('keys') && !keys.current.has('keya') && !keys.current.has('keyd')) {
            playerPos.current.x = p.x ?? 0; playerPos.current.z = p.z ?? 0; playerPos.current.ry = p.ry ?? 0;
          }
          setRef(r => ({ ...r, hp: p.hp ?? 100, alive: p.alive ?? true, kills: p.kills ?? 0, weapon: p.weapon ?? 'pistol', armor: p.armor ?? 0 }));
        } else {
          // Check if this is our teammate
          const isTeammate = mode === 'duo' && p.teamId === myTeamId.current;
          if (isTeammate) {
            const idx = updatedTeammates.findIndex(t => t.uid === p.uid);
            if (idx >= 0) {
              updatedTeammates[idx] = { ...updatedTeammates[idx], alive: p.alive ?? true, hp: p.hp ?? 0, x: p.x ?? 0, z: p.z ?? 0 };
            } else {
              updatedTeammates.push({ uid: p.uid, username: p.username ?? 'Teammate', alive: p.alive ?? true, hp: p.hp ?? 100, x: p.x ?? 0, z: p.z ?? 0, downed: false });
            }
            // Check revive proximity
            const dist = Math.sqrt((playerPos.current.x - (p.x ?? 0)) ** 2 + (playerPos.current.z - (p.z ?? 0)) ** 2);
            if (!p.alive && dist < 3 && stateRef.current.alive) {
              reviveTargetRef.current = p.uid;
              setRef(r => ({ ...r, reviveTarget: p.uid }));
            } else if (reviveTargetRef.current === p.uid && dist >= 3) {
              reviveTargetRef.current = null; reviveTimerRef.current = 0;
              setRef(r => ({ ...r, reviveTarget: null, reviveProgress: 0 }));
            }
          }

          // 3D mesh
          if (!otherPlayers.current.has(p.uid)) {
            const col = isTeammate ? 0x44ff44 : PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)];
            const sc = sceneRef.current;
            if (sc) {
              const grp = new THREE.Group();
              const mat = new THREE.MeshStandardMaterial({ color: col });
              const b = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.45, 1.2, 8), mat); b.position.y = 0.6; grp.add(b);
              const h = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), mat); h.position.y = 1.4; grp.add(h);
              sc.add(grp);
              otherPlayers.current.set(p.uid, { pos: new THREE.Vector3(p.x ?? 0, 0, p.z ?? 0), alive: p.alive ?? true, hp: p.hp ?? 100, username: p.username ?? '', teamId: p.teamId ?? -1, mesh: grp });
              if (isTeammate) {
                // Green highlight
                (grp.children[0] as THREE.Mesh).material = new THREE.MeshStandardMaterial({ color: 0x44ff44, emissive: 0x22ff22, emissiveIntensity: 0.2 });
                (grp.children[1] as THREE.Mesh).material = new THREE.MeshStandardMaterial({ color: 0x44ff44, emissive: 0x22ff22, emissiveIntensity: 0.2 });
              }
            }
          } else {
            const op = otherPlayers.current.get(p.uid)!;
            op.pos.set(p.x ?? 0, 0, p.z ?? 0);
            op.alive = p.alive ?? true; op.hp = p.hp ?? 100;
            if (p.ry !== undefined) op.mesh.rotation.y = p.ry;
          }
        }
      }

      // Clean up disconnected
      const uids = new Set(livePlayers.map((p: any) => p.uid));
      otherPlayers.current.forEach((op, uid) => {
        if (!uids.has(uid)) { if (op.mesh.parent) op.mesh.parent.remove(op.mesh); otherPlayers.current.delete(uid); }
      });

      teammates.current = updatedTeammates;
      setRef(r => ({ ...r, aliveCount, totalPlayers, zoneRadius: zone?.radius ?? 50, teammates: updatedTeammates }));
    });

    // Zone timer
    const zoneInterval = setInterval(() => {
      const elapsed = (Date.now() - matchStartRef.current) / 1000;
      let totalWait = 0, phaseIdx = 0, phaseStart = 0;
      for (let i = 0; i < BR_ZONE_PHASES.length; i++) {
        const p = BR_ZONE_PHASES[i];
        if (elapsed < totalWait + p.wait) { phaseIdx = i; phaseStart = totalWait; break; }
        totalWait += p.wait;
        if (elapsed < totalWait + totalWait) { phaseIdx = i; phaseStart = totalWait; break; }
        totalWait += totalWait;
      }
      if (phaseIdx >= BR_ZONE_PHASES.length) phaseIdx = BR_ZONE_PHASES.length - 1;
      const zd = BR_ZONE_PHASES[phaseIdx];
      const t = Math.min(1, (elapsed - phaseStart) / zd.wait);
      const nr = zd.radius - (zd.radius - zd.shrinkTo) * t;

      const ring = sceneRef.current?.getObjectByName('zoneRing') as THREE.Mesh;
      if (ring) {
        const outerR = Math.max(nr, 2); const innerR = Math.max(outerR - 2, 0);
        const g = new THREE.RingGeometry(innerR, outerR, 64); ring.geometry.dispose(); ring.geometry = g;
      }
      const wall = sceneRef.current?.getObjectByName('zoneWall') as THREE.Mesh;
      if (wall) { wall.geometry.dispose(); wall.geometry = new THREE.CylinderGeometry(nr, nr, 10, 64, 1, true); }
      setRef(r => ({ ...r, zoneRadius: nr }));
    }, 1000);

    return () => { unsub(); clearInterval(zoneInterval); };
  }, [matchId, profile.uid, mode]);

  return (
    <div className="relative w-full h-full overflow-hidden bg-black select-none">
      <canvas ref={canvasRef} className="w-full h-full block cursor-crosshair" />

      {stateRef.current.alive && (
        <BRHud
          hp={hudState.hp}
          maxHp={hudState.maxHp}
          armor={hudState.armor}
          weapon={hudState.weapon}
          kills={hudState.kills}
          aliveCount={hudState.aliveCount}
          totalPlayers={hudState.totalPlayers}
          zoneRadius={hudState.zoneRadius}
          killFeed={hudState.killFeed}
          posX={playerPos.current.x}
          posZ={playerPos.current.z}
          mode={mode}
          teammates={hudState.teammates}
          myTeamId={hudState.myTeamId}
          reviveTarget={hudState.reviveTarget}
          reviveProgress={hudState.reviveProgress}
          otherPlayers={Array.from(otherPlayers.current.entries()).map(([uid, op]) => ({ uid, x: op.pos.x, z: op.pos.z, alive: op.alive, teamId: op.teamId }))}
          onBack={onBack}
        />
      )}

      {/* Death screen with spectator info */}
      {!stateRef.current.alive && !showGameOver && stateRef.current.teammates.length > 0 && stateRef.current.teammates[0]?.alive && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-40">
          <div className="bg-black/80 rounded-xl p-6 border border-white/10 text-center space-y-3">
            <p className="font-heading text-sm font-black text-slate-400 uppercase tracking-widest">You Died</p>
            <p className="font-mono text-[10px] text-slate-500">Teammate {stateRef.current.teammates[0].username} is still alive</p>
            <p className="font-mono text-[9px] text-slate-600 italic">Waiting for revive or team elimination...</p>
          </div>
        </div>
      )}

      {/* Check if both dead in duo → game over */}
      {!stateRef.current.alive && !showGameOver && mode === 'duo' && stateRef.current.teammates.every(t => !t.alive) && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-40">
          <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-4">
            <Skull className="w-12 h-12 mx-auto text-red-500" />
            <h2 className="font-heading text-xl font-black text-white uppercase tracking-widest">Team Eliminated</h2>
            <button onClick={onBack} className="px-6 py-2 bg-gradient-to-r from-red-600 to-orange-600 rounded-lg font-heading text-xs font-black uppercase cursor-pointer active:scale-95 transition-all">
              Back to Lobby
            </button>
          </motion.div>
        </div>
      )}

      {showGameOver && (
        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="absolute inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="text-center space-y-4">
            <Skull className="w-16 h-16 mx-auto text-red-500" />
            <h2 className="font-heading text-2xl font-black text-white uppercase tracking-widest">
              {gameOverData.current.winner ? (mode === 'duo' ? 'Team Victory!' : 'Winner Winner!') : 'Eliminated'}
            </h2>
            <p className="font-mono text-sm text-slate-400">Place #{gameOverData.current.place} • {gameOverData.current.kills} kill{gameOverData.current.kills !== 1 ? 's' : ''}</p>
            <button onClick={onBack} className="px-6 py-2 bg-gradient-to-r from-red-600 to-orange-600 rounded-lg font-heading text-xs font-black uppercase cursor-pointer active:scale-95 transition-all">
              Back to Lobby
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
