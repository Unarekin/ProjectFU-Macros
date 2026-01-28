/**
 * Activate an item on a given actor
 *
 * The following arguments can be passed to this macro:
 * item     The UUID, id, name, or fuid of an item to activate
 * actor    The actor that owns the item
 *            Can be a UUID, id, or name
 *            If the first argument is a UUID, this will be ignored
 *            If it is omitted, it will use the actor associated with the user's selected token (if any)
 *
 * When passing an argument that is multiple words, surround them in quotation marks
 * ie: "Blair Clarimonde"
 */

try {
  if (args.length === 0) throw new Error("No item identifier provided");

  let actor;
  if (args[1]) actor = EricaPFU.coerceActor(args[1]);
  else actor = canvas?.tokens?.controlled[0]?.actor;

  const item = EricaPFU.coerceItem(actor, args[0]);

  if (item instanceof Item) await item.roll();
} catch (err) {
  console.error(err);
  ui.notifications.error(err.message, { console: false });
}
