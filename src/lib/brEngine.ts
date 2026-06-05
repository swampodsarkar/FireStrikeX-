import { BrLootItem, BrZoneState, BR_MAP_SIZE, BR_ZONE_PHASES, BR_LOOT_TYPES } from '../types';

const LOOT_COUNT = 50;

export function generateLoot(): BrLootItem[] {
  const items: BrLootItem[] = [];
  for (let i = 0; i < LOOT_COUNT; i++) {
    items.push({
      id: `loot_${i}`,
      x: (Math.random() - 0.5) * 180,
      z: (Math.random() - 0.5) * 180,
      type: BR_LOOT_TYPES[Math.floor(Math.random() * BR_LOOT_TYPES.length)],
      taken: false,
    });
  }
  return items;
}

export function createInitialZone(): BrZoneState {
  return {
    centerX: 0, centerZ: 0,
    radius: BR_ZONE_PHASES[0].radius,
    nextRadius: BR_ZONE_PHASES[0].shrinkTo,
    phase: 0,
    timer: BR_ZONE_PHASES[0].wait,
  };
}

export function isOutsideZone(x: number, z: number, zone: BrZoneState): boolean {
  const dx = x - zone.centerX;
  const dz = z - zone.centerZ;
  return Math.sqrt(dx * dx + dz * dz) > zone.radius;
}

export function getZoneDamage(zone: BrZoneState): number {
  return 2 + zone.phase; // Increases with each phase
}

export function calcBulletHit(
  shooterX: number, shooterZ: number, shooterRy: number,
  targetX: number, targetZ: number, weaponRange: number
): boolean {
  const dx = targetX - shooterX;
  const dz = targetZ - shooterZ;
  const dist = Math.sqrt(dx * dx + dz * dz);
  if (dist > weaponRange) return false;

  // Angle check (rough FOV 30 degrees)
  const angle = Math.atan2(dz, dx);
  let diff = angle - shooterRy;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return Math.abs(diff) < 0.3;
}

export function getRandomSpawn(): { x: number; z: number } {
  const angle = Math.random() * Math.PI * 2;
  const dist = 10 + Math.random() * 30;
  return { x: Math.cos(angle) * dist, z: Math.sin(angle) * dist };
}
