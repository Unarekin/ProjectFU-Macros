/**
 * This will adjust the resource points associated with a given Miscellaneous Ability.
 * This macro expects 2 or 3 arguments passed from mATT:
 *   - Actor ID, name, UUID, token, or the Actor object itself
 *   - The ID, UUID, name or instance of the ability itself that has resource points
 *   - Optionally, you may specify just how to adjust the resource points in the following formats:
 *     #      - Add # points
 *     -#     - Subtract # points
 *     =#     - Set the point value ot #
 *     max    - Set the resource points to their maximum value
 *     step   - Add a number of points equal to the ability's step value (usually 1)
 *    -step   - Remove a number of points equal to the ability's step value (usually 1)
 *
 *    If this third argument is omitted, the macro will default to incrementing.
 *
 * This macro supports PFU versions 2.3.11 as well as 2.4.8, but does NOT support resource points
 * configured directly on an actor via their character sheet, only resource points associated with
 * a Misc Ability
 */

(async () => {
  try {
    if (!args[0]) throw new Error(`No actor provided.`);
    if (!args[1]) throw new Error(`No item provided.`);

    const actor = await EricaPFU.coerceActor(args[0]);
    if (!(actor instanceof Actor)) throw new Error(`Invalid actor: ${args[0]}`);
    const item = await EricaPFU.coerceItem(actor, args[1]);
    if (!(item instanceof Item)) throw new Error(`Invalid item: ${args[1]}`);

    const rp = item.system.rp;

    if (typeof rp === "undefined")
      throw new Error(`Item ${item.name} does not have resource points.`);

    const adjustedItem = EricaPFU.adjustProgressItem(rp, args[2]);
    if (adjustedItem.current !== item.current) {
      await actor.updateEmbeddedDocuments("Item", [
        {
          _id: item.id,
          system: {
            rp: {
              current: adjustedItem.current,
            },
          },
        },
      ]);
    }
  } catch (err) {
    ui.notifications.error(err.message, { console: false });
    console.error(err);
  }
})();
