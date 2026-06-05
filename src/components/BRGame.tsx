import { useEffect, useRef, useCallback, useState } from 'react';
import * as THREE from 'three';
import { db, doc, onSnapshot, updateDoc, getDoc, setDoc } from '../lib/firebase';
import { PlayerProfile, BrMatchState, BrPlayerState, BR_WEAPONS, BR_ZONE_PHASES } from '../types';
import { calcBulletHit, isOutsideZone, generateLoot } from '../lib/brEngine';
import BRHud from './BRHud';
import { motion } from 'motion/react';
import { Skull } from 'lucide-react';

interface BRGameProps {
  profile: PlayerProfile;
  matchId: string;
  onBack: () => void;
}

const MAP = 100;
const BUILDINGS = [
  { x: -25, z: -25, w: 10, d: 8, h: 4 },
  { x: 25, z: -20, w: 12, d: 6, h: 3.5 },
  { x: -20, z: 25, w: 8, d: 10, h: 4.5 },
  { x: 30, z: 25, w: 14, d: 7, h: 3 },
  { x: -5, z: -5, w: 6, d: 6, h: 2.5 },
  { x: -30, z: 10, w: 7, d: 7, h: 3 },
  { x: 20, z: -35, w: 8, d: 5, h: 4 },
  { x: 35, z: -5, w: 5, d: 8, h: 3.5 },
];
const TREES = Array.from({ length: 20 }, () => ({
  x: (Math.random() - 0.5) * MAP * 0.8,
  z: (Math.random() - 0.5) * MAP * 0.8,
  s: 1 + Math.random() * 1.5,
}));
const PLAYER_COLORS = [0xff4444, 0x44aaff, 0x44ff44, 0xffaa44, 0xff44ff, 0xffff44, 0x44ffff, 0xff8844, 0x88ff44, 0x4488ff];

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

export default function BRGame({ profile, matchId, onBack }: BRGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const keys = useRef<Set<string>>(new Set());
  const mouseDown = useRef(false);
  const playerPos = useRef({ x: 0, y: 0, z: 0, ry: 0 });
  const otherPlayers = useRef<Map<string, { pos: THREE.Vector3; alive: boolean; hp: number; username: string; mesh: THREE.Group }>>(new Map());
  const playerRef = useRef<THREE.Group | null>(null);
  const lastShotRef = useRef(0);
  const lastSyncRef = useRef(0);
  const gameOverRef = useRef(false);

  const [hudState, setHudState] = useState({
    hp: 100, maxHp: 100, armor: 0, weapon: 'pistol', kills: 0,
    aliveCount: 0, totalPlayers: 0, zoneRadius: 50, zoneTimer: 30,
    killFeed: [] as { killer: string; victim: string }[],
    alive: true, place: 0, winner: false,
  });
  const stateRef = useRef(hudState);
  const setRef = (s: typeof hudState | ((prev: typeof hudState) => typeof hudState)) => {
    if (typeof s === 'function') {
      const next = (s as (prev: typeof hudState) => typeof hudState)(stateRef.current);
      stateRef.current = next;
      setHudState(next);
    } else {
      stateRef.current = s;
      setHudState(s);
    }
  };

  const [showGameOver, setShowGameOver] = useState(false);
  const gameOverData = useRef({ place: 0, kills: 0, winner: false });

  // Build 3D scene once
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.fog = new THREE.Fog(0x87ceeb, 60, 120);

    const camera = new THREE.PerspectiveCamera(70, canvas.clientWidth / canvas.clientHeight, 0.1, 200);
    camera.position.set(0, 5, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    rendererRef.current = renderer;

    // Lights
    const ambient = new THREE.AmbientLight(0x404060, 0.6);
    scene.add(ambient);
    const sun = new THREE.DirectionalLight(0xffeedd, 1.2);
    sun.position.set(30, 40, 20);
    sun.castShadow = true;
    scene.add(sun);
    const hemi = new THREE.HemisphereLight(0x88ccff, 0x445522, 0.4);
    scene.add(hemi);

    // Ground
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(MAP, MAP),
      new THREE.MeshStandardMaterial({ color: 0x4a7c3f, roughness: 0.9 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Grid helper
    const grid = new THREE.GridHelper(MAP, 20, 0x335533, 0x335533);
    grid.position.y = 0.05;
    scene.add(grid);

    // Buildings
    for (const b of BUILDINGS) {
      const wallMat = new THREE.MeshStandardMaterial({ color: 0x8a7a6a, roughness: 0.8 });
      const roofMat = new THREE.MeshStandardMaterial({ color: 0x6a3a2a, roughness: 0.9 });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), wallMat);
      mesh.position.set(b.x, b.h / 2, b.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.3, 0.3, b.d + 0.3), roofMat);
      roof.position.set(b.x, b.h + 0.15, b.z);
      scene.add(roof);
    }

    // Trees
    for (const t of TREES) {
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2 * t.s, 0.3 * t.s, 1.2 * t.s),
        new THREE.MeshStandardMaterial({ color: 0x6a4a2a })
      );
      trunk.position.set(t.x, 0.6 * t.s, t.z);
      scene.add(trunk);
      const foliage = new THREE.Mesh(
        new THREE.ConeGeometry(1.2 * t.s, 1.8 * t.s, 6),
        new THREE.MeshStandardMaterial({ color: 0x3a7a2a })
      );
      foliage.position.set(t.x, 1.8 * t.s + 0.5 * t.s, t.z);
      scene.add(foliage);
    }

    // Zone boundary ring
    const ringGeo = new THREE.RingGeometry(48, 50, 64);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x4488ff, side: THREE.DoubleSide, transparent: true, opacity: 0.15 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.1;
    ring.name = 'zoneRing';
    scene.add(ring);

    // Zone edge wall
    const wallGeo = new THREE.CylinderGeometry(50, 50, 10, 64, 1, true);
    const wallMat2 = new THREE.MeshBasicMaterial({ color: 0x4488ff, side: THREE.DoubleSide, transparent: true, opacity: 0.08 });
    const wallMesh = new THREE.Mesh(wallGeo, wallMat2);
    wallMesh.position.y = 5;
    wallMesh.name = 'zoneWall';
    scene.add(wallMesh);

    // Own player (capsule)
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xff4444, emissive: 0xff2222, emissiveIntensity: 0.1 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.45, 1.2, 8), bodyMat);
    body.position.y = 0.6;
    body.castShadow = true;
    group.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), bodyMat);
    head.position.y = 1.4;
    head.castShadow = true;
    group.add(head);
    // Gun
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.5), new THREE.MeshStandardMaterial({ color: 0x666666 }));
    gun.position.set(0.3, 0.7, -0.5);
    group.add(gun);
    scene.add(group);
    playerRef.current = group;

    // Resize handler
    const onResize = () => {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    // Pointer lock & mouse
    const onMouseDown = () => { mouseDown.current = true; };
    const onMouseUp = () => { mouseDown.current = false; };
    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement === canvas) {
        playerPos.current.ry -= e.movementX * 0.002;
      }
    };
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mouseup', onMouseUp);
    document.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('click', () => canvas.requestPointerLock());

    // Keyboard
    const onKeyDown = (e: KeyboardEvent) => { keys.current.add(e.code.toLowerCase()); };
    const onKeyUp = (e: KeyboardEvent) => { keys.current.delete(e.code.toLowerCase()); };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);

    // Animate
    let animId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);

      // Movement
      const p = playerPos.current;
      if (stateRef.current.alive) {
        const forward = new THREE.Vector3(-Math.sin(p.ry), 0, -Math.cos(p.ry));
        const right = new THREE.Vector3(Math.cos(p.ry), 0, -Math.sin(p.ry));
        let moveX = 0, moveZ = 0;
        if (keys.current.has('keyw')) { moveX += forward.x; moveZ += forward.z; }
        if (keys.current.has('keys')) { moveX -= forward.x; moveZ -= forward.z; }
        if (keys.current.has('keya')) { moveX += right.x; moveZ += right.z; }
        if (keys.current.has('keyd')) { moveX -= right.x; moveZ -= right.z; }
        const len = Math.sqrt(moveX * moveX + moveZ * moveZ);
        if (len > 0) {
          const nx = p.x + (moveX / len) * SPEED * dt;
          const nz = p.z + (moveZ / len) * SPEED * dt;
          if (!collides(nx, p.z)) p.x = nx;
          if (!collides(p.x, nz)) p.z = nz;
        }

        // Shooting
        if (mouseDown.current && stateRef.current.alive) {
          const now = Date.now();
          const wpn = BR_WEAPONS[stateRef.current.weapon] || BR_WEAPONS.pistol;
          if (now - lastShotRef.current > wpn.fireRate) {
            lastShotRef.current = now;
            handleShoot(p, stateRef.current);
          }
        }
      }

      // Update camera
      camera.position.set(p.x, 2, p.z);
      const lookTarget = new THREE.Vector3(p.x + Math.sin(p.ry) * 10, 1.5, p.z + Math.cos(p.ry) * 10);
      camera.lookAt(lookTarget);

      // Update own player mesh
      if (playerRef.current && stateRef.current.alive) {
        playerRef.current.position.set(p.x, 0, p.z);
        playerRef.current.rotation.y = p.ry;
        playerRef.current.visible = true;
      } else if (playerRef.current) {
        playerRef.current.visible = false;
      }

      // Update other players
      otherPlayers.current.forEach((op, uid) => {
        if (op.mesh) {
          op.mesh.position.copy(op.pos);
          op.mesh.visible = op.alive && op.hp > 0;
        }
      });

      // Zone damage
      if (stateRef.current.alive && isOutsideZone(p.x, p.z, { centerX: 0, centerZ: 0, radius: stateRef.current.zoneRadius, phase: 0, nextRadius: 0, timer: 0 })) {
        const dmg = 2 + Math.floor(stateRef.current.zoneRadius / 15);
        updateHp(-dmg * dt);
      }

      // Sync to Firebase
      const syncInterval = 50; // 20fps
      if (Date.now() - lastSyncRef.current > syncInterval && stateRef.current.alive) {
        lastSyncRef.current = Date.now();
        syncPosition(p);
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

  // Sync position to Firebase
  const syncPosition = useCallback((p: typeof playerPos.current) => {
    const ref = doc(db, 'br_matches', matchId, 'players', profile.uid);
    updateDoc(ref, { x: p.x, y: 0, z: p.z, ry: p.ry }).catch(() => {});
  }, [matchId, profile.uid]);

  // Update HP and sync
  const updateHp = useCallback((delta: number) => {
    const s = stateRef.current;
    const newHp = Math.max(0, s.hp + delta);
    setRef({ ...s, hp: newHp });
    const ref = doc(db, 'br_matches', matchId, 'players', profile.uid);
    updateDoc(ref, { hp: newHp }).catch(() => {});
    if (newHp <= 0 && s.alive) {
      handleDie();
    }
  }, [matchId, profile.uid]);

  // Handle death
  const handleDie = useCallback(() => {
    if (gameOverRef.current) return;
    gameOverRef.current = true;
    const s = stateRef.current;
    setRef({ ...s, alive: false });
    const ref = doc(db, 'br_matches', matchId, 'players', profile.uid);
    updateDoc(ref, { alive: false, hp: 0 }).catch(() => {});
    document.exitPointerLock();

    // Calculate place
    setTimeout(() => {
      const aliveCount = s.aliveCount - 1;
      const place = aliveCount + 1;
      gameOverData.current = { place, kills: s.kills, winner: false };
      setShowGameOver(true);
    }, 1000);
  }, [matchId, profile.uid]);

  // Handle shooting
  const handleShoot = useCallback((p: typeof playerPos.current, s: typeof hudState) => {
    const wpn = BR_WEAPONS[s.weapon] || BR_WEAPONS.pistol;

    // Check hit against other players
    otherPlayers.current.forEach((op, uid) => {
      if (!op.alive || op.hp <= 0 || uid === profile.uid) return;
      if (calcBulletHit(p.x, p.z, p.ry, op.pos.x, op.pos.z, wpn.range)) {
        const dmg = wpn.damage;
        op.hp -= dmg;
        // Write damage to Firebase
        const ref = doc(db, 'br_matches', matchId, 'players', uid);
        updateDoc(ref, { hp: Math.max(0, op.hp) }).catch(() => {});

        const newKills = s.kills + (op.hp <= 0 ? 1 : 0);
        const newFeed = [...s.killFeed, { killer: profile.username, victim: op.username }];
        setRef({ ...s, kills: newKills, killFeed: newFeed.slice(-10) });

        if (op.hp <= 0) {
          updateDoc(ref, { alive: false }).catch(() => {});
          updateDoc(doc(db, 'br_matches', matchId, 'players', profile.uid), { kills: newKills }).catch(() => {});
        }
      }
    });
    // For now, gun muzzle flash would go here
  }, [matchId, profile.uid]);

  // Firebase listeners
  useEffect(() => {
    if (!matchId) return;
    const matchRef = doc(db, 'br_matches', matchId);

    // Create player entry
    const initPlayer = async () => {
      const snap = await getDoc(matchRef);
      const data = snap.data() as BrMatchState | undefined;
      // Generate loot if not present
      if (data && (!data.loot || data.loot.length === 0)) {
        const loot = generateLoot();
        await updateDoc(matchRef, { loot });
      }
      // Add self
      const pRef = doc(db, 'br_matches', matchId, 'players', profile.uid);
      await setDoc(pRef, {
        uid: profile.uid, username: profile.username,
        x: 0, y: 0, z: 0, rx: 0, ry: 0,
        hp: 100, maxHp: 100, armor: 0, alive: true, kills: 0, weapon: 'pistol',
      });
    };
    initPlayer();

    // Listen to all players
    const unsubPlayers = onSnapshot(matchRef, (snap) => {
      const data = snap.data();
      if (!data) return;
      const { zone, players, status, winnerId, startTime } = data as any;
      if (startTime) matchStartRef.current = startTime;
      const livePlayers = players || [];
      const aliveCount = livePlayers.filter((p: any) => p.alive).length;
      const totalPlayers = livePlayers.length;

      // Check game over
      if (status === 'finished') {
        if (winnerId === profile.uid) {
          gameOverData.current = { place: 1, kills: stateRef.current.kills, winner: true };
          setShowGameOver(true);
        }
      }

      setRef({
        ...stateRef.current,
        aliveCount, totalPlayers,
        zoneRadius: zone?.radius ?? 50,
        zoneTimer: zone?.timer ?? 30,
      });

      // Update other players 3D positions
      for (const p of livePlayers) {
        if (p.uid === profile.uid) {
          // Sync our position from Firebase if not moving (for correction)
          if (!keys.current.has('keyw') && !keys.current.has('keys') && !keys.current.has('keya') && !keys.current.has('keyd')) {
            playerPos.current.x = p.x ?? 0;
            playerPos.current.z = p.z ?? 0;
            playerPos.current.ry = p.ry ?? 0;
          }
          setRef(s => ({ ...s, hp: p.hp ?? 100, alive: p.alive ?? true, kills: p.kills ?? 0, weapon: p.weapon ?? 'pistol', armor: p.armor ?? 0 }));
        } else {
          if (!otherPlayers.current.has(p.uid)) {
            // Create mesh for new player
            const col = PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)];
            const scene = sceneRef.current;
            if (scene) {
              const group = new THREE.Group();
              const mat = new THREE.MeshStandardMaterial({ color: col });
              const body = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.45, 1.2, 8), mat);
              body.position.y = 0.6;
              group.add(body);
              const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), mat);
              head.position.y = 1.4;
              group.add(head);
              scene.add(group);
              otherPlayers.current.set(p.uid, {
                pos: new THREE.Vector3(p.x ?? 0, 0, p.z ?? 0),
                alive: p.alive ?? true,
                hp: p.hp ?? 100,
                username: p.username ?? '',
                mesh: group,
              });
            }
          } else {
            const op = otherPlayers.current.get(p.uid)!;
            op.pos.set(p.x ?? 0, 0, p.z ?? 0);
            op.alive = p.alive ?? true;
            op.hp = p.hp ?? 100;
            if (p.ry !== undefined) op.mesh.rotation.y = p.ry;
          }
        }
      }

      // Remove disconnected players
      const uids = new Set(livePlayers.map((p: any) => p.uid));
      otherPlayers.current.forEach((op, uid) => {
        if (!uids.has(uid)) {
          if (op.mesh.parent) op.mesh.parent.remove(op.mesh);
          otherPlayers.current.delete(uid);
        }
      });
    });

    // Zone timer
    const matchStartRef = { current: Date.now() };
    const zoneInterval = setInterval(() => {
      const elapsed = (Date.now() - matchStartRef.current) / 1000;
      let totalWait = 0;
      let phaseIdx = 0;
      let phaseStart = 0;
      for (let i = 0; i < BR_ZONE_PHASES.length; i++) {
        const p = BR_ZONE_PHASES[i];
        if (elapsed < totalWait + p.wait) { phaseIdx = i; phaseStart = totalWait; break; }
        totalWait += p.wait;
        if (elapsed < totalWait + totalWait) { phaseIdx = i; phaseStart = totalWait; break; }
        totalWait += totalWait; // shrink duration = wait duration for simplicity
      }
      if (phaseIdx >= BR_ZONE_PHASES.length) phaseIdx = BR_ZONE_PHASES.length - 1;
      const zoneData = BR_ZONE_PHASES[phaseIdx];
      const phaseElapsed = elapsed - phaseStart;
      const shrinkDuration = zoneData.wait;
      const t = Math.min(1, phaseElapsed / shrinkDuration);
      const newRadius = zoneData.radius - (zoneData.radius - zoneData.shrinkTo) * t;

      const ring = sceneRef.current?.getObjectByName('zoneRing') as THREE.Mesh;
      if (ring) {
        const outerR = Math.max(newRadius, 2);
        const innerR = Math.max(outerR - 2, 0);
        const geo = new THREE.RingGeometry(innerR, outerR, 64);
        ring.geometry.dispose();
        ring.geometry = geo;
      }
      const wall = sceneRef.current?.getObjectByName('zoneWall') as THREE.Mesh;
      if (wall) {
        wall.geometry.dispose();
        wall.geometry = new THREE.CylinderGeometry(newRadius, newRadius, 10, 64, 1, true);
      }
      setRef(r => ({ ...r, zoneRadius: newRadius }));
    }, 1000);

    return () => {
      unsubPlayers();
      clearInterval(zoneInterval);
    };
  }, [matchId, profile.uid]);

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
          otherPlayers={Array.from(otherPlayers.current.entries()).map(([uid, op]) => ({ uid, x: op.pos.x, z: op.pos.z, alive: op.alive }))}
          onBack={onBack}
        />
      )}

      {showGameOver && (
        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="absolute inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="text-center space-y-4">
            <Skull className="w-16 h-16 mx-auto text-red-500" />
            <h2 className="font-heading text-2xl font-black text-white uppercase tracking-widest">
              {gameOverData.current.winner ? 'Winner Winner!' : 'Eliminated'}
            </h2>
            <p className="font-mono text-sm text-slate-400">Place #{gameOverData.current.place} • {gameOverData.current.kills} kills</p>
            <button onClick={onBack} className="px-6 py-2 bg-gradient-to-r from-red-600 to-orange-600 rounded-lg font-heading text-xs font-black uppercase cursor-pointer active:scale-95 transition-all">
              Back to Lobby
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
