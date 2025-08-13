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

export enum DamageAffinity {
  Vulnerable = -1,
  None = 0,
  Resistance = 1,
  Immunity = 2,
  Absorption = 3
}

export const ResourceAbbrs: string[] = ["hp", "mp", "ip", "zp"] as const;
export type ResourceAbbreviation = typeof ResourceAbbrs[number];

export interface AnimationConfiguration {
  hitAnimation: string;
  missAnimation: string;
  hitDelay: number;
  missDelay: number;
  defaultAnimation: string;
}