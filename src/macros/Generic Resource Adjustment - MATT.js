/**
 * Generic resource adjustment.  Expects the following arguments:
 * uuid: the UUID of an actor to adjust stuff for
 * resource: The resource to adjust -- hp, mp, or ip
 * adjustment: The adjustment to make.  Can take a few different forms:
 *    =#      Will set the resource to #.  ie: "=0" will set it to 0
 *    max     Will set the resource to its maximum value
 *    crisis  Will set the resource to 1/2 its maximum (rounded down)
 *    #       Will add # to the resource (Can also be written as +#)
 *    -#      Will subtract # from the resource
 */

(async () => {
  try {
    const actor = EricaPFU.coerceActor(args[0]);
    if (!(actor instanceof Actor))
      throw new Error(`Invalid actor: ${EricaPFU.coerceString(args[0])}`);
    const res = args[1].toLowerCase();
    if (!["hp", "mp", "ip"].includes(res))
      throw new Error(`Unknown resource: ${EricaPFU.coerceString(args[1])}`);
    if (res === "ip" && actor.type !== "character")
      throw new Error(
        `Attempting to adjust IP on a non-PC actor ${actor.name}`
      );

    const adjust =
      typeof args[2] === "string"
        ? args[2].trim()
        : typeof args[2] === "number"
        ? args[2]
        : undefined;
    if (typeof adjust === "undefined")
      throw new Error(
        `Unknown adjustment format: ${EricaPFU.coerceString(args[2])}`
      );

    const { value, max } = actor.system.resources[res];

    const adjustedAmount = EricaPFU.adjustResource(adjust, value, max, true);

    if (adjustedAmount !== current) {
      await actor.update({
        system: {
          resources: {
            [res]: {
              value: adjustedAmount,
            },
          },
        },
      });
    }
  } catch (err) {
    ui.notifications?.error(err.message, { console: false });
    console.error(err.message);
  }
})();
