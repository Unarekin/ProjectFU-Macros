/**
 * Attempts to somewhat intelligently select a random target (or targets)
 * for an NPC's attack/spell sort of things.
 */

if (!(game.combat instanceof Combat)) {
  ui.notifications.error("EPFU.ERRORS.NOCOMBAT", { localize: true});
  return
}

if (!foundry.applications.api.ApplicationV2) {
  ui.notifications.error("EPFU.ERRORS.NOTV12", {localize: true});
  return;
}

new EricaPFU.TargetSelectorApplication().render({force: true})