/**
 * Increment a character's Zero Power clock, if one is located.
 * Will ONLY use the first feature found that looks to be a Zero Power, so if
 * for some reason you have more than one, this will only adjust the first
 * one listed on your character sheet.
 *
 * Multiple arguments can be passed to the macro, each in the form of an actor or token UUID, name, or ID.
 * When using a name with multiple words, put it in quotation marks.  IE: "Blair Clarimonde"
 */

(async () => {
  try {
    if (!args)
      throw new Error(
        `Please be sure this macro is run via a MATT trigger action.`
      );

    const actors =
      args.length === 0
        ? canvas.tokens.controlled.map((token) => token.actor)
        : args.map((arg) => EricaPFU.coerceActor(arg)).filter((arg) => !!arg);

    if (actors.length === 0) throw new Error(`No valid actors provided.`);

    const promises = [];

    for (const actor of actors) {
      const power = EricaPFU.findZeroPower(actor);
      if (!(power instanceof Item)) continue;

      if (power.type === "zeroPower") {
        const { current } = EricaPFU.adjustProgressItem(
          power.system.progress,
          1,
          true
        );
        promises.push(
          actor.updateEmbeddedDocuments("Item", [
            {
              _id: power.id,
              system: {
                progress: {
                  current,
                },
              },
            },
          ])
        );
      } else if (power.system.optionalType === "projectfu.zeroPower") {
        const { current } = EricaPFU.adjustProgressItem(
          power.system.data.progress,
          1,
          true
        );

        promises.push(
          actor.updateEmbeddedDocuments("Item", [
            {
              _id: power.id,
              system: {
                data: {
                  progress: {
                    current,
                  },
                },
              },
            },
          ])
        );
      }
    }

    if (promises.length) await Promise.all(promises);
  } catch (err) {
    ui.notifications?.error(err.message, { console: false });
    console.error(err);
  }
})();
