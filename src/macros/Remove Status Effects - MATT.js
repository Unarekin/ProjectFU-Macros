/**
 * Removes any active effects that include status effects on the character.
 *
 * Multiple arguments can be passed to the macro, each in the form of an actor or token UUID, name, or ID.
 * When using a name with multiple words, put it in quotation marks.  IE: "Blair Clarimonde"
 */

(async () => {
  try {
    /**
     * If true, will delete the active effects that are associated with status effects.
     * Otherwise, they will be disabled but not deleted
     */
    const DELETE_EFFECTS = true;

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
      // const statusEffects = actor.effects.filter(effect => effect.statuses.size);
      const statusEffects = actor.effects.reduce(
        (prev, curr) =>
          curr.statuses.size && !curr.statuses.has("crisis")
            ? [...prev, curr.id]
            : prev,
        []
      );
      console.log("Status effects:", statusEffects);

      if (statusEffects.length) {
        if (DELETE_EFFECTS) {
          promises.push(
            actor.deleteEmbeddedDocuments("ActiveEffect", statusEffects)
          );
        } else {
          promises.push(
            actor.updateEmbeddedDocuments(
              "ActiveEffect",
              statusEffects.map((id) => ({
                _id: id,
                disabled: true,
              }))
            )
          );
        }
      }
    }
  } catch (err) {
    ui.notifications?.error(err.message);
  }
})();
