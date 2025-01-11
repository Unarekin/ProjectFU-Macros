/**
 * This will restore HP, MP, and IP if applicable, to their maximum values.
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
      promises.push(
        actor.update({
          system: {
            resources: {
              hp: {
                value: actor.system.resources.hp.max,
              },
              mp: {
                value: actor.system.resources.mp.max,
              },
              ...(actor.type === "character"
                ? {
                    ip: {
                      value: actor.system.resources.ip.max,
                    },
                  }
                : {}),
            },
          },
        })
      );
    }

    await Promise.all(promises);
  } catch (err) {
    ui.notifications?.error(err.message);
  }
})();
