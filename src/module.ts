import { coerceActor, coerceItem, coerceString, findZeroPower } from './coercion';
import { adjustProgressItem, adjustResource, shouldUseAppV2 } from './functions';
// import { ModifyResourcesApplicationV2 } from "./dialogs";
import { ModifyResourcesApplicationV2 } from './dialogs/ModifyResourcesDialogV2';

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
(window as any).EricaPFU = {
  coerceActor,
  coerceItem,
  findZeroPower,
  adjustProgressItem,
  adjustResource,
  coerceString,
  shouldUseAppV2,
  dialogs: {
    ModifyResourcesApplicationV2
  }
};


Hooks.once("ready", () => {
  loadTemplates([
    "hp_operations",
    "mp_operations",
    "ip_operations",
    "zp_operations"
  ].map(name => `modules/${__MODULE_ID__}/templates/resources_dialog/${name}.hbs`)
  )
    .catch((err: Error) => {
      ui.notifications?.error(err.message, { console: false });
      console.error(err);
    })
});