/**
 * Generic resource adjustment.  Expects the following arguments:
 * uuid:    The UUID of the actor
 * amount:  Amount of damage to apply
 * type:    Damage type, will default to physical if unspecified.
 */

(async () => {
  try {
    const actor = EricaPFU.coerceActor(args[0]);
    if (!actor instanceof Actor)
      throw new Error(`Invalid actor: ${EricaPFU.coerceString(args[0])}`);

    const amt = parseFloat(args[1]);
    if (isNaN(amt)) throw new Error(`Invalid damage amount: ${args[1]}`);
    const dmgType = args[2] ?? "physical";

    const DAMAGE_TYPES = [
      "physical",
      "air",
      "bolt",
      "dark",
      "earth",
      "fire",
      "ice",
      "light",
      "poison",
      "untyped",
    ];

    if (!DAMAGE_TYPES.includes(dmgType))
      throw new Error(`Unknown damage type: ${dmgType}`);

    const affinity = actor.system?.affinities[dmgType]?.current || 0;

    let dmg = 0;

    switch (affinity) {
      case 0:
        // None
        dmg = amt;
        break;
      case -1:
        // Vuln
        dmg = amt * 2;
        break;
      case 1:
        // Res
        dmg = Math.floor(amt / 2);
        break;
      case 2:
        // Im
        dmg = 0;
        break;
      case 3:
        // Absorb
        dmg = amt * -1;
        break;
      default:
        throw new Error(`Unknown affinity type: ${affinity}`);
    }

    await actor.update({
      system: {
        resources: {
          hp: {
            value: Math.min(
              Math.max(actor.system.resources.hp.value - dmg, 0),
              actor.system.resources.hp.max
            ),
          },
        },
      },
    });
  } catch (err) {
    ui.notifications?.error(err.message);
  }
})();
