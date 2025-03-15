import { coerceActor, coerceItem, coerceString, findZeroPower } from './coercion';
import { adjustProgressItem, adjustResource } from './functions';
import { TargetSelectorApplication} from "./applications"

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
(window as any).EricaPFU = {
  coerceActor,
  coerceItem,
  findZeroPower,
  adjustProgressItem,
  adjustResource,
  coerceString,
  TargetSelectorApplication
};
