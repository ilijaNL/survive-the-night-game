export const Entities = {
  WEAPON: "weapon",
  ZOMBIE: "zombie",
  PLAYER: "player",
  TREE: "tree",
  BULLET: "bullet",
  WALL: "wall",
  BOUNDARY: "boundary",
  BANDAGE: "bandage",
  CLOTH: "cloth",
  SOUND: "sound",
  SPIKES: "spikes",
  FIRE: "fire",
  TORCH: "torch",
} as const;

export type EntityType = (typeof Entities)[keyof typeof Entities];
