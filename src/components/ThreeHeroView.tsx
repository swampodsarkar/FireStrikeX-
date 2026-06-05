import { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface ThreeHeroViewProps {
  heroId: string;
  skin?: string;
  isAnimated?: boolean;
  actionState?: 'idle' | 'attack' | 'ultimate' | 'damaged';
  isLobby?: boolean;
  facing?: 'left' | 'right' | 'front';
  sparkHit?: boolean;
  deathExplosion?: boolean;
}

export default function ThreeHeroView({
  heroId,
  skin = 'default',
  isAnimated = true,
  actionState = 'idle',
  isLobby = false,
  facing = 'front',
  sparkHit = false,
  deathExplosion = false,
}: ThreeHeroViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Keep track of animation states and triggers in refs to dynamically update them
  const stateRef = useRef({
    actionState,
    time: 0,
    weaponRotation: 0,
    pulseSpeed: 1,
    characterYPos: 0,
    particleCount: 50,
    facing,
    lastAction: 'idle',
    actionStartTime: 0,
  });

  // Track sparkHit and deathExplosion triggers via refs
  const prevSparkHit = useRef(false);
  const prevDeathExplosion = useRef(false);
  const burstParticlesRef = useRef<{
    particles: THREE.Mesh[];
    velocities: THREE.Vector3[];
    life: number;
  }>({ particles: [], velocities: [], life: 0 });
  const deathRingRef = useRef<THREE.Mesh | null>(null);

  // Watch state changes
  useEffect(() => {
    stateRef.current.actionState = actionState;
  }, [actionState]);

  useEffect(() => {
    stateRef.current.facing = facing;
  }, [facing]);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth || 300;
    const height = container.clientHeight || 400;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.background = null; // Transparent background to show full-stack ambient styling

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(0, isLobby ? 0.2 : 0, isLobby ? 4.5 : 4.0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Ultra-smooth realistic soft shadows
    container.appendChild(renderer.domElement);

    // 2. Dynamic Studio Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight.position.set(5, 12, 5);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.bias = -0.001;
    scene.add(dirLight);

    // Spotlight pointing directly onto the hero podium
    const spotLight = new THREE.SpotLight(0xffffff, 2.0, 15, Math.PI / 6, 0.5, 1);
    spotLight.position.set(0, 6, 0);
    spotLight.castShadow = true;
    scene.add(spotLight);

    // Neon colored accent light based on class
    let accentLightColor = 0xffa500;
    if (heroId === 'ice_mage') accentLightColor = 0x00ffff;
    if (heroId === 'shadow_assassin') accentLightColor = 0xbc13fe;
    if (heroId === 'paladin') accentLightColor = 0xfbbf24;
    if (heroId === 'storm_archer') accentLightColor = 0x22d3ee;

    const accentLight = new THREE.PointLight(accentLightColor, 3.5, 7);
    accentLight.position.set(0, -1, 1.5);
    scene.add(accentLight);

    // Dynamic rotating cybernetic highlight sweeper
    const sweepLight = new THREE.PointLight(accentLightColor, 2.0, 6);
    sweepLight.position.set(0, 0, 2);
    scene.add(sweepLight);

    // 3. Futuristic Ground Podium / Pedestal
    const baseGroup = new THREE.Group();
    baseGroup.position.y = -1.3;
    scene.add(baseGroup);

    // High tech glowing scanner grid matrix floor
    const gridHelper = new THREE.GridHelper(3.2, 14, accentLightColor, 0x1e293b);
    gridHelper.position.y = 0.01;
    if (gridHelper.material instanceof THREE.Material) {
      gridHelper.material.opacity = 0.45;
      gridHelper.material.transparent = true;
    }
    baseGroup.add(gridHelper);

    // Metallic slab disc
    const slabGeo = new THREE.CylinderGeometry(1.2, 1.4, 0.15, 32);
    const slabMat = new THREE.MeshStandardMaterial({
      color: 0x090d16,
      roughness: 0.15,
      metalness: 0.9,
    });
    const slabMesh = new THREE.Mesh(slabGeo, slabMat);
    slabMesh.receiveShadow = true;
    baseGroup.add(slabMesh);

    // Neon glowing rim ring
    const rimGeo = new THREE.TorusGeometry(1.25, 0.05, 8, 32);
    const rimMat = new THREE.MeshBasicMaterial({
      color: accentLightColor,
      wireframe: false,
    });
    const rimMesh = new THREE.Mesh(rimGeo, rimMat);
    rimMesh.rotation.x = Math.PI / 2;
    rimMesh.position.y = 0.05;
    baseGroup.add(rimMesh);

    // 4. Programmable 3D Character Mesh Construction (Voxel / Stylized)
    const heroGroup = new THREE.Group();
    heroGroup.position.set(0, -1.2, 0);
    scene.add(heroGroup);

    const materialConfig = {
      skinColor: 0xffdbac,
      primaryColor: 0xef4444,
      secondaryColor: 0xf97316,
      armorColor: 0x374151,
      metalness: 0.5,
      roughness: 0.5,
    };

    // Style adjustments based on heroes and unlocked skins
    if (heroId === 'fire_warrior') {
      if (skin === 'skin_fire_mecha') {
        materialConfig.primaryColor = 0x111827;
        materialConfig.secondaryColor = 0xff4500;
        materialConfig.armorColor = 0x1f2937;
        materialConfig.metalness = 0.95;
        materialConfig.roughness = 0.1;
      } else if (skin === 'skin_fire_phoenix') {
        materialConfig.primaryColor = 0xdc2626;
        materialConfig.secondaryColor = 0xfde047;
        materialConfig.armorColor = 0x7f1d1d;
        materialConfig.metalness = 0.6;
        materialConfig.roughness = 0.2;
      } else {
        materialConfig.primaryColor = 0xb91c1c;
        materialConfig.secondaryColor = 0xf59e0b;
        materialConfig.armorColor = 0x4b5563;
        materialConfig.metalness = 0.7;
      }
    } else if (heroId === 'ice_mage') {
      materialConfig.skinColor = 0xe0f2fe;
      if (skin === 'skin_ice_empress') {
        materialConfig.primaryColor = 0xffffff;
        materialConfig.secondaryColor = 0xa855f7;
        materialConfig.armorColor = 0xbae6fd;
        materialConfig.metalness = 0.4;
        materialConfig.roughness = 0.2;
      } else if (skin === 'skin_ice_warlock') {
        materialConfig.primaryColor = 0x1e3a5f;
        materialConfig.secondaryColor = 0x7dd3fc;
        materialConfig.armorColor = 0x0c1a2b;
        materialConfig.metalness = 0.7;
        materialConfig.roughness = 0.3;
      } else {
        materialConfig.primaryColor = 0x0284c7;
        materialConfig.secondaryColor = 0x38bdf8;
        materialConfig.armorColor = 0x1e3a8a;
        materialConfig.metalness = 0.3;
      }
    } else if (heroId === 'shadow_assassin') {
      materialConfig.skinColor = 0x1f1f2e;
      if (skin === 'skin_shadow_cyberpunk') {
        materialConfig.primaryColor = 0xec4899;
        materialConfig.secondaryColor = 0x3b82f6;
        materialConfig.armorColor = 0x090d16;
        materialConfig.metalness = 0.9;
        materialConfig.roughness = 0.15;
      } else if (skin === 'skin_shadow_reaper') {
        materialConfig.primaryColor = 0xdc2626;
        materialConfig.secondaryColor = 0x111827;
        materialConfig.armorColor = 0x450a0a;
        materialConfig.metalness = 0.8;
        materialConfig.roughness = 0.3;
      } else {
        materialConfig.primaryColor = 0x7c3aed;
        materialConfig.secondaryColor = 0x0f172a;
        materialConfig.armorColor = 0x2e1065;
        materialConfig.metalness = 0.5;
      }
    } else if (heroId === 'paladin') {
      materialConfig.skinColor = 0xfed7aa;
      if (skin === 'skin_paladin_dark') {
        materialConfig.primaryColor = 0x1c1917;
        materialConfig.secondaryColor = 0xdc2626;
        materialConfig.armorColor = 0x292524;
        materialConfig.metalness = 0.9;
        materialConfig.roughness = 0.2;
      } else {
        materialConfig.primaryColor = 0xd97706;
        materialConfig.secondaryColor = 0xfef3c7;
        materialConfig.armorColor = 0x78716c;
        materialConfig.metalness = 0.7;
        materialConfig.roughness = 0.4;
      }
    } else { // storm_archer
      materialConfig.skinColor = 0xfde68a;
      if (skin === 'skin_archer_phoenix') {
        materialConfig.primaryColor = 0xea580c;
        materialConfig.secondaryColor = 0xfde047;
        materialConfig.armorColor = 0x7c2d12;
        materialConfig.metalness = 0.5;
        materialConfig.roughness = 0.3;
      } else {
        materialConfig.primaryColor = 0x0d9488;
        materialConfig.secondaryColor = 0xccfbf1;
        materialConfig.armorColor = 0x134e4a;
        materialConfig.metalness = 0.4;
        materialConfig.roughness = 0.5;
      }
    }

    // Material initializers - Transforming skinMat into a clean cyber-robotic chrome/steel finish
    const skinMat = new THREE.MeshStandardMaterial({ 
      color: 0x94a3b8, // high-shine silver steel
      metalness: 0.95,
      roughness: 0.15
    });
    const primaryMat = new THREE.MeshStandardMaterial({ 
      color: materialConfig.primaryColor, 
      roughness: materialConfig.roughness,
      metalness: materialConfig.metalness
    });
    const secondaryMat = new THREE.MeshStandardMaterial({ 
      color: materialConfig.secondaryColor,
      roughness: materialConfig.roughness,
      metalness: materialConfig.metalness
    });
    const armorMat = new THREE.MeshStandardMaterial({ 
      color: materialConfig.armorColor,
      metalness: 0.9,
      roughness: 0.1
    });
    
    // Glowing neon material properties
    const neonMat = new THREE.MeshBasicMaterial({ color: accentLightColor });

    // A. Pelvis / Torso Group of Character
    const torsoGroup = new THREE.Group();
    heroGroup.add(torsoGroup);

    // Torso armor plate block
    const chestGeo = new THREE.BoxGeometry(0.55, 0.7, 0.35);
    const chestMesh = new THREE.Mesh(chestGeo, primaryMat);
    chestMesh.position.y = 0.65;
    chestMesh.castShadow = true;
    chestMesh.receiveShadow = true;
    torsoGroup.add(chestMesh);

    // Glowing electronic circuits/laser lines on robotic chest
    const circuitGeo = new THREE.BoxGeometry(0.58, 0.04, 0.37);
    const circuitMesh = new THREE.Mesh(circuitGeo, neonMat);
    circuitMesh.position.set(0, 0.65, 0);
    torsoGroup.add(circuitMesh);

    const circuitVertGeo = new THREE.BoxGeometry(0.06, 0.4, 0.37);
    const circuitVertMesh = new THREE.Mesh(circuitVertGeo, neonMat);
    circuitVertMesh.position.set(0, 0.65, 0.01);
    torsoGroup.add(circuitVertMesh);

    // Additional shoulder armor plates
    const pauldronLGeo = new THREE.BoxGeometry(0.2, 0.2, 0.3);
    const pauldronL = new THREE.Mesh(pauldronLGeo, armorMat);
    pauldronL.position.set(-0.35, 0.95, 0);
    torsoGroup.add(pauldronL);

    const pauldronRGeo = new THREE.BoxGeometry(0.2, 0.2, 0.3);
    const pauldronR = new THREE.Mesh(pauldronRGeo, armorMat);
    pauldronR.position.set(0.35, 0.95, 0);
    torsoGroup.add(pauldronR);

    // Cybernetic chest armor panel ribs overlay (mechanical robotic detailing)
    const ribGeo = new THREE.BoxGeometry(0.38, 0.08, 0.38);
    const ribMesh1 = new THREE.Mesh(ribGeo, armorMat);
    ribMesh1.position.set(0, 0.82, 0);
    torsoGroup.add(ribMesh1);

    const ribMesh2 = new THREE.Mesh(ribGeo, armorMat);
    ribMesh2.position.set(0, 0.52, 0);
    torsoGroup.add(ribMesh2);

    // Glowing arc core / energy core embedded on combat robot torso
    const coreGeo = new THREE.SphereGeometry(0.09, 16, 16);
    const coreMesh = new THREE.Mesh(coreGeo, neonMat);
    coreMesh.position.set(0, 0.72, 0.16);
    torsoGroup.add(coreMesh);

    // B. Character Head
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 1.15, 0);
    torsoGroup.add(headGroup);

    const headGeo = new THREE.SphereGeometry(0.22, 16, 16);
    const headMesh = new THREE.Mesh(headGeo, skinMat);
    headMesh.castShadow = true;
    headGroup.add(headMesh);

    // Cybernetic side bolts/receivers (Robotic Ears)
    const boltsGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.52, 12);
    const boltsMesh = new THREE.Mesh(boltsGeo, armorMat);
    boltsMesh.rotation.z = Math.PI / 2;
    headGroup.add(boltsMesh);

    // Top Antenna sensor for telemetry styling
    const antennaGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.18, 8);
    const antenna = new THREE.Mesh(antennaGeo, skinMat);
    antenna.position.set(0.08, 0.24, -0.05);
    headGroup.add(antenna);

    const tipGeo = new THREE.SphereGeometry(0.025, 8, 8);
    const tip = new THREE.Mesh(tipGeo, neonMat);
    tip.position.set(0.08, 0.33, -0.05);
    headGroup.add(tip);

    // Accessories based on class (Hats, Cowls, Horns)
    if (heroId === 'fire_warrior') {
      // Samurai-style horns / helmet
      const helmGeo = new THREE.CylinderGeometry(0.23, 0.23, 0.18, 16);
      const helm = new THREE.Mesh(helmGeo, armorMat);
      helm.position.y = 0.08;
      headGroup.add(helm);

      const visorGeo = new THREE.BoxGeometry(0.25, 0.06, 0.2);
      const visor = new THREE.Mesh(visorGeo, neonMat);
      visor.position.set(0, 0.02, 0.15);
      headGroup.add(visor);
    } else if (heroId === 'ice_mage') {
      if (skin === 'skin_ice_empress') {
        const crownGeo = new THREE.ConeGeometry(0.18, 0.22, 5);
        const crown = new THREE.Mesh(crownGeo, secondaryMat);
        crown.position.y = 0.26;
        crown.rotation.x = Math.PI;
        headGroup.add(crown);
      } else if (skin === 'skin_ice_warlock') {
        const hornGeo = new THREE.ConeGeometry(0.04, 0.2, 6);
        for (let side = -1; side <= 1; side += 2) {
          const horn = new THREE.Mesh(hornGeo, neonMat);
          horn.position.set(side * 0.12, 0.2, -0.05);
          horn.rotation.z = side * 0.2;
          headGroup.add(horn);
        }
      } else {
        // Classic pointed wizard hat
        const hatGeo = new THREE.ConeGeometry(0.25, 0.45, 16);
        const hat = new THREE.Mesh(hatGeo, armorMat);
        hat.position.y = 0.25;
        hat.rotation.x = -0.05;
        headGroup.add(hat);
      }
    } else if (heroId === 'shadow_assassin') {
      const hoodGeo = new THREE.SphereGeometry(0.24, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.75);
      const hood = new THREE.Mesh(hoodGeo, armorMat);
      hood.position.y = 0.01;
      headGroup.add(hood);

      const eyesGeo = new THREE.BoxGeometry(0.2, 0.04, 0.2);
      const eyes = new THREE.Mesh(eyesGeo, neonMat);
      eyes.position.set(0, 0.03, 0.15);
      headGroup.add(eyes);
    } else if (heroId === 'paladin') {
      // Full helm with halo
      const helmGeo = new THREE.CylinderGeometry(0.24, 0.26, 0.2, 16);
      const helm = new THREE.Mesh(helmGeo, armorMat);
      helm.position.y = 0.08;
      headGroup.add(helm);

      const haloGeo = new THREE.TorusGeometry(0.3, 0.03, 8, 16);
      const halo = new THREE.Mesh(haloGeo, neonMat);
      halo.position.y = 0.28;
      halo.rotation.x = Math.PI / 3;
      headGroup.add(halo);

      if (skin === 'skin_paladin_dark') {
        const spikeGeo = new THREE.ConeGeometry(0.05, 0.12, 4);
        const spikeMat = new THREE.MeshBasicMaterial({ color: 0xdc2626 });
        for (let i = 0; i < 4; i++) {
          const spike = new THREE.Mesh(spikeGeo, spikeMat);
          const angle = (i / 4) * Math.PI * 2;
          spike.position.set(Math.cos(angle) * 0.22, 0.15, Math.sin(angle) * 0.22);
          spike.rotation.x = Math.PI / 4;
          spike.rotation.z = angle;
          headGroup.add(spike);
        }
      }
    } else { // storm_archer
      // Hood with feather
      const hoodGeo = new THREE.ConeGeometry(0.24, 0.2, 16);
      const hood = new THREE.Mesh(hoodGeo, armorMat);
      hood.position.y = 0.18;
      headGroup.add(hood);

      const featherGeo = new THREE.BoxGeometry(0.12, 0.2, 0.02);
      const feather = new THREE.Mesh(featherGeo, secondaryMat);
      feather.position.set(0, 0.3, -0.08);
      feather.rotation.x = -0.3;
      headGroup.add(feather);
    }

    // C. Static Base Limbs (Legs)
    const legLGeo = new THREE.CylinderGeometry(0.1, 0.08, 0.5, 16);
    const legL = new THREE.Mesh(legLGeo, armorMat);
    legL.position.set(-0.2, 0.25, 0);
    legL.castShadow = true;
    heroGroup.add(legL);

    const legRGeo = new THREE.CylinderGeometry(0.1, 0.08, 0.5, 16);
    const legR = new THREE.Mesh(legRGeo, armorMat);
    legR.position.set(0.2, 0.25, 0);
    legR.castShadow = true;
    heroGroup.add(legR);

    // D. Left Arm
    const armLGroup = new THREE.Group();
    armLGroup.position.set(-0.35, 0.85, 0);
    torsoGroup.add(armLGroup);

    const armLGeo = new THREE.CylinderGeometry(0.08, 0.07, 0.5, 16);
    const armLMesh = new THREE.Mesh(armLGeo, skinMat);
    armLMesh.position.y = -0.2;
    armLMesh.castShadow = true;
    armLGroup.add(armLMesh);

    // E. Right Arm & Held Weapon
    const armRGroup = new THREE.Group();
    armRGroup.position.set(0.35, 0.85, 0);
    torsoGroup.add(armRGroup);

    const armRGeo = new THREE.CylinderGeometry(0.08, 0.07, 0.5, 16);
    const armRMesh = new THREE.Mesh(armRGeo, skinMat);
    armRMesh.position.y = -0.2;
    armRMesh.castShadow = true;
    armRGroup.add(armRMesh);

    // Create weapons based on character
    const weaponGroup = new THREE.Group();
    weaponGroup.position.set(0, -0.4, 0);
    armRGroup.add(weaponGroup);

    if (heroId === 'fire_warrior') {
      // Flaming Broadsword
      const hiltGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.25, 8);
      const hilt = new THREE.Mesh(hiltGeo, armorMat);
      hilt.rotation.x = Math.PI / 2;
      weaponGroup.add(hilt);

      const bladeGeo = new THREE.BoxGeometry(0.1, 1.0, 0.03);
      const blade = new THREE.Mesh(bladeGeo, secondaryMat);
      blade.position.y = 0.5;
      blade.castShadow = true;
      weaponGroup.add(blade);

      const edgeGeo = new THREE.BoxGeometry(0.03, 0.9, 0.04);
      const edge = new THREE.Mesh(edgeGeo, neonMat);
      edge.position.set(0, 0.5, 0);
      weaponGroup.add(edge);
    } else if (heroId === 'ice_mage') {
      // Wizard Crystal Staff
      const staffGeo = new THREE.CylinderGeometry(0.025, 0.025, 1.4, 8);
      const staff = new THREE.Mesh(staffGeo, armorMat);
      staff.position.y = 0.2;
      weaponGroup.add(staff);

      // Spinning Octahedron Crystal Core on magic wand
      const crystalGeo = new THREE.OctahedronGeometry(0.16, 0);
      const crystal = new THREE.Mesh(crystalGeo, secondaryMat);
      crystal.position.y = 1.0;
      weaponGroup.add(crystal);
      
      const beamGeo = new THREE.TorusGeometry(0.18, 0.02, 8, 16);
      const beam = new THREE.Mesh(beamGeo, neonMat);
      beam.position.y = 1.0;
      beam.rotation.x = Math.PI / 2;
      weaponGroup.add(beam);
    } else if (heroId === 'shadow_assassin') {
      const daggerHiltGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.2, 8);
      const daggerHilt = new THREE.Mesh(daggerHiltGeo, armorMat);
      daggerHilt.rotation.x = Math.PI / 2;
      weaponGroup.add(daggerHilt);

      const daggerBladeGeo = new THREE.ConeGeometry(0.08, 0.6, 4);
      const daggerBlade = new THREE.Mesh(daggerBladeGeo, primaryMat);
      daggerBlade.position.y = 0.28;
      daggerBlade.rotation.y = Math.PI / 4;
      weaponGroup.add(daggerBlade);

      const daggerEdgeGeo = new THREE.ConeGeometry(0.04, 0.58, 4);
      const daggerEdge = new THREE.Mesh(daggerEdgeGeo, neonMat);
      daggerEdge.position.y = 0.28;
      daggerEdge.rotation.y = Math.PI / 4;
      weaponGroup.add(daggerEdge);
    } else if (heroId === 'paladin') {
      // Heavy mace
      const handleGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.6, 8);
      const handle = new THREE.Mesh(handleGeo, armorMat);
      handle.position.y = 0.15;
      weaponGroup.add(handle);

      const headGeo = new THREE.SphereGeometry(0.12, 8, 8);
      const head = new THREE.Mesh(headGeo, secondaryMat);
      head.position.y = 0.5;
      head.scale.set(1, 0.7, 1);
      weaponGroup.add(head);

      const spikeGeo = new THREE.ConeGeometry(0.03, 0.15, 4);
      for (let i = 0; i < 4; i++) {
        const spike = new THREE.Mesh(spikeGeo, neonMat);
        const angle = (i / 4) * Math.PI * 2;
        spike.position.set(Math.cos(angle) * 0.1, 0.55, Math.sin(angle) * 0.1);
        spike.rotation.x = Math.PI / 2;
        spike.rotation.z = angle;
        weaponGroup.add(spike);
      }

      // Shield on left arm
      const shieldGeo = new THREE.CylinderGeometry(0.2, 0.22, 0.05, 8);
      const shieldMat = new THREE.MeshStandardMaterial({
        color: materialConfig.primaryColor,
        metalness: 0.8,
        roughness: 0.2,
      });
      const shield = new THREE.Mesh(shieldGeo, shieldMat);
      shield.position.set(0, -0.3, 0.35);
      shield.rotation.x = Math.PI / 2;
      armLGroup.add(shield);

      const shieldRimGeo = new THREE.TorusGeometry(0.2, 0.02, 8, 16);
      const shieldRim = new THREE.Mesh(shieldRimGeo, neonMat);
      shieldRim.position.set(0, -0.3, 0.35);
      shieldRim.rotation.x = Math.PI / 2;
      armLGroup.add(shieldRim);
    } else { // storm_archer
      // Longbow
      const bowGeo = new THREE.TorusGeometry(0.3, 0.02, 8, 16, Math.PI);
      const bow = new THREE.Mesh(bowGeo, secondaryMat);
      bow.rotation.z = Math.PI / 2;
      bow.position.y = 0.2;
      weaponGroup.add(bow);

      const bowStringGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.55, 4);
      const bowString = new THREE.Mesh(bowStringGeo, neonMat);
      bowString.position.set(0.04, 0.2, 0);
      bowString.rotation.z = 0.15;
      weaponGroup.add(bowString);

      // Arrow
      const arrowGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.6, 4);
      const arrow = new THREE.Mesh(arrowGeo, armorMat);
      arrow.position.set(0.25, 0.2, 0);
      arrow.rotation.z = Math.PI / 20;
      weaponGroup.add(arrow);

      const tipGeo = new THREE.ConeGeometry(0.02, 0.04, 4);
      const tip = new THREE.Mesh(tipGeo, neonMat);
      tip.position.set(0.55, 0.2, 0);
      weaponGroup.add(tip);
    }

    // 5. Stylized Floating Ambient Particle System
    const particleGeometry = new THREE.BufferGeometry();
    const particleCount = stateRef.current.particleCount;
    const positions = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      // Random position inside a cylinder around character
      const theta = Math.random() * Math.PI * 2;
      const radius = 0.2 + Math.random() * 1.2;
      positions[i * 3] = Math.cos(theta) * radius;
      positions[i * 3 + 1] = -1.2 + Math.random() * 2.5; 
      positions[i * 3 + 2] = Math.sin(theta) * radius;

      // Vertical drift velocity
      velocities[i * 3] = (Math.random() - 0.5) * 0.01;
      velocities[i * 3 + 1] = 0.01 + Math.random() * 0.02; // floating up
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.01;
    }

    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const pMaterial = new THREE.PointsMaterial({
      color: accentLightColor,
      size: isLobby ? 0.065 : 0.05,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
    });

    const particleSystem = new THREE.Points(particleGeometry, pMaterial);
    scene.add(particleSystem);

    // BURST PARTICLES (hit sparks)
    const burstGroup = new THREE.Group();
    scene.add(burstGroup);

    function createBurstParticles(elementColor: number, isDeath: boolean) {
      // Clear old burst
      while (burstGroup.children.length > 0) {
        const child = burstGroup.children[0];
        if ((child as THREE.Mesh).geometry) (child as THREE.Mesh).geometry.dispose();
        if ((child as THREE.Mesh).material) ((child as THREE.Mesh).material as THREE.Material).dispose();
        burstGroup.remove(child);
      }
      const count = isDeath ? 40 : 12;
      for (let i = 0; i < count; i++) {
        const size = isDeath ? 0.04 + Math.random() * 0.08 : 0.015 + Math.random() * 0.03;
        const geo = new THREE.SphereGeometry(size, 6, 6);
        const mat = new THREE.MeshBasicMaterial({
          color: elementColor,
          transparent: true,
          opacity: 1,
          blending: THREE.AdditiveBlending,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(
          (Math.random() - 0.5) * 0.3,
          (Math.random() - 0.5) * 0.3,
          (Math.random() - 0.5) * 0.3,
        );
        burstGroup.add(mesh);
      }
      burstParticlesRef.current.life = isDeath ? 1.2 : 0.6;
    }

    // DEATH RING
    const ringGeo = new THREE.TorusGeometry(0.1, 0.04, 16, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: accentLightColor,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = Math.PI / 2;
    ringMesh.position.y = 0;
    ringMesh.visible = false;
    scene.add(ringMesh);
    deathRingRef.current = ringMesh;

    // Position setup defaults
    if (isLobby) {
      // Scale fitting for lobby inspect preview
      heroGroup.scale.set(1.15, 1.15, 1.15);
      heroGroup.rotation.y = 0; // lock facing straight forward (no angle)
    } else {
      heroGroup.scale.set(0.9, 0.9, 0.9);
      // Turn depending on player side facing prop
      if (stateRef.current.facing === 'right') {
        heroGroup.rotation.y = Math.PI / 2.3;
      } else if (stateRef.current.facing === 'left') {
        heroGroup.rotation.y = -Math.PI / 2.3;
      } else {
        heroGroup.rotation.y = 0;
      }
    }

    // 6. Request Animation Frame Combat loop
    let animationId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationId = requestAnimationFrame(animate);

      const elapsedTime = clock.getElapsedTime();
      stateRef.current.time = elapsedTime;

      // Particle physics engine drift
      const positionsAttr = particleGeometry.attributes.position as THREE.BufferAttribute;
      const activeAction = stateRef.current.actionState;
      for (let i = 0; i < particleCount; i++) {
        let x = positionsAttr.getX(i);
        let y = positionsAttr.getY(i);
        let z = positionsAttr.getZ(i);

        if (activeAction === 'ultimate') {
          // Cyber energy cyclone swirl
          const angle = 0.08 + (i * 0.001);
          const newX = x * Math.cos(angle) - z * Math.sin(angle);
          const newZ = x * Math.sin(angle) + z * Math.cos(angle);
          x = newX;
          z = newZ;
          y += velocities[i * 3 + 1] * 3.5; // fly faster
        } else {
          // Normal float
          x += velocities[i * 3];
          y += velocities[i * 3 + 1];
          z += velocities[i * 3 + 2];
        }

        // Recycle if drift is too high
        if (y > 2.0) {
          y = -1.2;
          const theta = Math.random() * Math.PI * 2;
          const radius = 0.2 + Math.random() * 1.0;
          x = Math.cos(theta) * radius;
          z = Math.sin(theta) * radius;
        }

        positionsAttr.setXYZ(i, x, y, z);
      }
      positionsAttr.needsUpdate = true;

      // Animate pedestal rim pulsing glowing light
      if (rimMesh) {
        const pulse = 0.8 + Math.sin(elapsedTime * 4) * 0.2;
        rimMesh.scale.set(pulse, pulse, 1);
      }

      // Rotating sweep light for premium highlight reflections
      if (sweepLight) {
        sweepLight.position.x = Math.sin(elapsedTime * 1.8) * 1.8;
        sweepLight.position.z = Math.cos(elapsedTime * 1.8) * 1.8;
      }

      // Animate staff crystals
      if (heroId === 'ice_mage' && weaponGroup.children[1]) {
        weaponGroup.children[1].rotation.y += 0.02;
        weaponGroup.children[1].rotation.x += 0.01;
      }

      // Active posture / Combat idle
      if (isAnimated) {
        // Breathing bobbing
        const bob = Math.sin(elapsedTime * 2.2) * 0.045;
        torsoGroup.position.y = bob;
        
        // Sway arm slightly
        armLGroup.rotation.z = Math.sin(elapsedTime * 2.2) * 0.05 - 0.1;
        armLGroup.rotation.x = Math.cos(elapsedTime * 1.1) * 0.05;

        armRGroup.rotation.z = -Math.sin(elapsedTime * 2.2) * 0.05 + 0.1;
        armRGroup.rotation.x = -Math.cos(elapsedTime * 1.1) * 0.05;

        // Prevent rotation in lobby, keep character facing straight forward
        if (isLobby) {
          heroGroup.rotation.y = 0; // face straight forward
        } else {
          // Maintain side facing with dynamic breathing sway modifier
          const baseFacingAngle = stateRef.current.facing === 'right' ? Math.PI / 2.3 : stateRef.current.facing === 'left' ? -Math.PI / 2.3 : 0;
          heroGroup.rotation.y = baseFacingAngle + Math.sin(elapsedTime * 0.5) * 0.12;
        }
      }

      // 7. Tactical skill actions animation matrix state trigger
      const currentAction = stateRef.current.actionState;
      if (currentAction !== stateRef.current.lastAction) {
        stateRef.current.lastAction = currentAction;
        stateRef.current.actionStartTime = elapsedTime;
      }
      const timeSinceActionStart = elapsedTime - stateRef.current.actionStartTime;

      if (currentAction === 'attack') {
        const phase = Math.min(Math.PI, timeSinceActionStart * (Math.PI / 0.5)); // 0.5s duration
        const swing = Math.sin(phase);
        const thrust = swing * 0.55;
        const sideMult = stateRef.current.facing === 'right' ? 1 : stateRef.current.facing === 'left' ? -1 : 0;
        
        // Thrust lunge along facing direction
        heroGroup.position.x = sideMult * thrust;
        
        // Arm slashes down and forward elegantly
        armRGroup.rotation.x = -0.5 - swing * 1.5;
        armRGroup.rotation.z = 0.2 - swing * 0.4;
        
        // Weapon swings forward dynamically relative to hand
        weaponGroup.rotation.x = swing * 1.6;
        weaponGroup.rotation.y = swing * 0.3;
        weaponGroup.rotation.z = -swing * 0.5;
      } else if (currentAction === 'ultimate') {
        const spin = elapsedTime * 12;
        const baseFacingAngle = stateRef.current.facing === 'right' ? Math.PI / 2.3 : stateRef.current.facing === 'left' ? -Math.PI / 2.3 : 0;
        heroGroup.rotation.y = baseFacingAngle + spin;
        heroGroup.position.y = -1.2 + Math.abs(Math.sin(elapsedTime * 6)) * 0.45; // levitate up in fury!
        accentLight.intensity = 4 + Math.sin(elapsedTime * 20) * 2;

        // Weapon rotates upwards in a powerful raise pose
        armRGroup.rotation.x = -Math.PI + Math.sin(elapsedTime * 10) * 0.25;
        armRGroup.rotation.z = 0.4;
        weaponGroup.rotation.set(0, 0, 0);
      } else if (currentAction === 'damaged') {
        // Physical pushback recoil with exponential decay damping!
        const decay = Math.exp(-timeSinceActionStart * 3.5); 
        const sideMult = stateRef.current.facing === 'right' ? -1 : stateRef.current.facing === 'left' ? 1 : 0;
        
        // Slide backward dynamically
        heroGroup.position.x = sideMult * 0.35 * decay;
        // Natural tilt/sway
        heroGroup.rotation.z = -sideMult * 0.18 * Math.sin(timeSinceActionStart * 12) * decay;
        // Organic vertical shake/hop vector
        heroGroup.position.y = -1.2 + 0.15 * Math.sin(timeSinceActionStart * 15) * decay;

        // Weapon jiggles and reacts to recoil force
        weaponGroup.rotation.x = Math.sin(timeSinceActionStart * 20) * 0.25 * decay;
        weaponGroup.rotation.z = -Math.cos(timeSinceActionStart * 20) * 0.15 * decay;
      } else {
        // Reset translation triggers if idle smoothly (zero-state snap)
        heroGroup.position.x = 0;
        heroGroup.rotation.z = 0;
        if (!isLobby) {
          heroGroup.position.y = -1.2;
        }

        // Smoothly return weapon rotations back to base resting values
        weaponGroup.rotation.x *= 0.85;
        weaponGroup.rotation.y *= 0.85;
        weaponGroup.rotation.z *= 0.85;
      }

      // Track sparkHit / deathExplosion triggers
      if (sparkHit && !prevSparkHit.current) {
        createBurstParticles(accentLightColor, false);
      }
      prevSparkHit.current = sparkHit;
      if (deathExplosion && !prevDeathExplosion.current) {
        createBurstParticles(accentLightColor, true);
        if (deathRingRef.current) {
          deathRingRef.current.visible = true;
          deathRingRef.current.scale.set(1, 1, 1);
          deathRingRef.current.material.opacity = 1;
        }
      }
      prevDeathExplosion.current = deathExplosion;

      // Animate burst particles (outward expansion + fade)
      if (burstGroup.children.length > 0) {
        const dt = 0.016;
        burstParticlesRef.current.life -= dt;
        for (const child of burstGroup.children) {
          const mesh = child as THREE.Mesh;
          const dir = mesh.position.clone().normalize();
          const speed = 0.08;
          mesh.position.x += dir.x * speed;
          mesh.position.y += dir.y * speed;
          mesh.position.z += dir.z * speed;
          const mat = mesh.material as THREE.MeshBasicMaterial;
          mat.opacity = Math.max(0, burstParticlesRef.current.life / (deathExplosion ? 1.2 : 0.6));
        }
        if (burstParticlesRef.current.life <= 0) {
          while (burstGroup.children.length > 0) {
            const child = burstGroup.children[0] as THREE.Mesh;
            child.geometry.dispose();
            (child.material as THREE.Material).dispose();
            burstGroup.remove(child);
          }
        }
      }

      // Animate death ring expansion
      if (deathRingRef.current && deathRingRef.current.visible) {
        const s = deathRingRef.current.scale.x + 0.06;
        deathRingRef.current.scale.set(s, s, 1);
        deathRingRef.current.material.opacity *= 0.96;
        if (deathRingRef.current.material.opacity < 0.01) {
          deathRingRef.current.visible = false;
        }
      }

      renderer.render(scene, camera);
    };

    animate();

    // 8. Element frame size resize observer setup
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width: newWidth, height: newHeight } = entry.contentRect;
        if (newWidth && newHeight) {
          camera.aspect = newWidth / newHeight;
          camera.updateProjectionMatrix();
          renderer.setSize(newWidth, newHeight);
        }
      }
    });

    resizeObserver.observe(container);

    // 9. Fully release cache memory elements on screen transitions
    return () => {
      cancelAnimationFrame(animationId);
      resizeObserver.disconnect();
      
      // Cleanup DOM
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }

      // Dispose items
      slabGeo.dispose();
      slabMat.dispose();
      rimGeo.dispose();
      rimMat.dispose();
      chestGeo.dispose();
      headGeo.dispose();
      legLGeo.dispose();
      legRGeo.dispose();
      armLGeo.dispose();
      armRGeo.dispose();
      pMaterial.dispose();
      particleGeometry.dispose();
      skinMat.dispose();
      primaryMat.dispose();
      secondaryMat.dispose();
      armorMat.dispose();
      neonMat.dispose();
      ringGeo.dispose();
      ringMat.dispose();
      // Clear burst particles
      while (burstGroup.children.length > 0) {
        const child = burstGroup.children[0] as THREE.Mesh;
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
        burstGroup.remove(child);
      }
      scene.remove(burstGroup);
      scene.remove(ringMesh);
      renderer.dispose();
    };
  }, [heroId, skin, isAnimated, isLobby, sparkHit, deathExplosion]);

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full min-h-[220px] relative pointer-events-none select-none overflow-hidden" 
      style={{ background: 'transparent' }} 
    />
  );
}
