export interface ProgressItem {
  current: number;
  max: number;
  name: string;
  step: number;
}

export const DamageTypes: string[] = ["physical", "air", "bolt", "dark", "earth", "fire", "ice", "light", "poison", "untyped"] as const;
export type DAMAGE_TYPE = typeof DamageTypes[number];

export enum IgnoreAffinity {
  Resistances = 1 << 0,
  Vulnerabilities = 1 << 1,
  Immunities = 1 << 2,
  Absorption = 1 << 3,


  All = (1 << 4) - 1
};

export const ResourceTypes: string[] = ["hp", "mp", "ip", "zp"];
export type RESOURCE_TYPE = typeof ResourceTypes[number];