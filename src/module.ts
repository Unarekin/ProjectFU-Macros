import { coerceActor, coerceItem, coerceString, findZeroPower } from './coercion';
import { adjustProgressItem, adjustResource, selectActor } from './functions';
import { AnimationConfigurationApplication, ResourceModifierApplication, TargetSelectorApplication } from "./applications"

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
(window as any).EricaPFU = {
  coerceActor,
  coerceItem,
  selectActor,
  findZeroPower,
  adjustProgressItem,
  adjustResource,
  coerceString,
  TargetSelectorApplication,
  ResourceModifierApplication,
  AnimationConfigurationApplication

};
