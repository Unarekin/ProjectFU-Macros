/**
 * Adjust the clock associated with an ability on a given character.
 * This function expects 2 or 3 arguments passed from MATT:
 *  Actor ID, name, UUID, token, or an instance of the Actor object itself
 *  The ID, UUID, name, or instance of the ability with a clock to adjust
 *  Optionally, an option to specify how to adjust the clock in one of the following formats:
 *    #     - Add # to the clock
 *    -#    - Subtract # from the clock
 *    =#    - Set the clock to #
 *    max   - Set the clock to its maximum value
 *    step  - Increase the clock by its step value (usually 1)
 *    -step - Decrease the clock by its step value (usually 1)
 *
 *  If the third argument is omitted, it will default to incrementing the clock.
 *
 * This script supports both the most recent Project FU version (2.4.8 at the time of writing), and 2.3.11,
 * and actually also works for Zero Powers.
 */

(async () => {
  try {
    const actor = EricaPFU.coerceActor(args[0]);
    if (!(actor instanceof Actor)) throw new Error(`Invalid actor: ${args[0]}`);

    const ability = EricaPFU.coerceItem(actor, args[1]);
    if (!(ability instanceof Item))
      throw new Error(`Unable to locate item: ${args[1]}`);

    const progress =
      typeof ability.system.progress === "object"
        ? ability.system.progress
        : typeof ability.system.data.progress === "object"
        ? ability.system.data.progress
        : undefined;

    if (typeof progress === "undefined")
      throw new Error(`${ability.name} does not have an associated clock.`);

    const adjust = typeof args[2] === "string" ? args[2].trim() : args[2];

    // const adjustment = EricaPFU.calculateStandardAdjustment(progress.current, adjust, 0, progress.max, true);
    const adjustment = EricaPFU.calculateStandardAdjustment(
      adjust,
      progress.current,
      progress.step,
      progress.max,
      true
    );

    if (ability.system.progress) {
      await actor.updateEmbeddedDocuments("Item", [
        {
          _id: ability.id,
          system: {
            progress: {
              current: adjustment,
            },
          },
        },
      ]);
    } else if (ability.system.data.progress) {
      await actor.updateEmbeddedDocuments("Item", [
        {
          _id: ability.id,
          system: {
            data: {
              progress: {
                current: adjustment,
              },
            },
          },
        },
      ]);
    } else {
      throw new Error("Unable to determine how to update ability progress.");
    }
  } catch (err) {
    ui.notifications.error(err.message, { console: false });
    console.error(err);
  }
})();
