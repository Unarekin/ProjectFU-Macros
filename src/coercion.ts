/**
 * Attempts to locate an {@link Actor} by name, ID, or UUID
 * @param arg - The identifier of the {@link Actor} we wish to find
 * @returns - {@link Actor} or undefined
 */
export function coerceActor(arg: unknown): Actor | undefined {
  if (arg instanceof Actor) return arg;
  if (arg instanceof Token) return arg.actor ?? undefined;
  if (arg instanceof TokenDocument) return arg.actor ?? undefined;

  if (typeof arg === "string" && game instanceof Game && game.actors) {
    // Check ID
    let actor = game.actors.get(arg);
    if (actor instanceof Actor) return actor;

    // Check name
    actor = game.actors.getName(arg);
    if (actor instanceof Actor) return actor;

    // Check token ID
    let token = canvas?.scene?.tokens.get(arg);
    if (token instanceof Token) return token.actor ?? undefined;

    // Check token name
    token = canvas?.scene?.tokens.getName(arg);
    if (token instanceof Token) return token.actor ?? undefined;

    // Check UUID
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
    actor = fromUuidSync(arg) as any;
    if (actor instanceof Actor) return actor;
  }
}

/**
 * Attempts to locate an item in a given actor's inventory.
 * @param arg1 - The {@link Actor} whose inventory we want to check
 * @param arg2 - The id, name, or UUID of the {@link Item} we wish to find.
 * @returns - {@link Item} or undefined
 */
export function coerceItem(arg1: unknown, arg2: unknown): Item | undefined {
  if (arg2 instanceof Item) return arg2;

  if (typeof arg2 === "string") {
    const item = fromUuidSync(arg2);
    if (item instanceof Item) return item;
  }

  const actor = coerceActor(arg1);
  if (!(actor instanceof Actor)) throw new Error(`Unable to locate actor: ${coerceString(arg1)}`);

  if (typeof arg2 === "string") {
    let item = actor.items.get(arg2);
    if (item instanceof Item) return item;

    item = actor.items.getName(arg2);
    if (item instanceof Item) return item;
  }
}

/**
 * Will attempt to intelligently convert an u nknown type of thing to a string.
 * @param {any} arg - The thing to convert.
 * @returns {string} - A string form of the item provided.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function coerceString(arg: any): string {
  if (typeof arg === "string") return arg;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  if (typeof arg.toString === "function") return arg.toString() as string;
  return typeof arg;
}

/**
 * Attempts to locate a Zero Power on a given {@link Actor}.
 * 
 * If multiple Zero Powers exist on a single actor, this will only return the first one located.
 * @param arg - ID, name, or UUID of the {@link Actor} to search
 */
export function findZeroPower(arg: unknown): Item | undefined {
  const actor = coerceActor(arg);
  if (!(actor instanceof Actor)) throw new Error(`Unable to locate actor: ${coerceString(arg)}`);

  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
  return actor.items.find((item: any) => item.system?.optionalType === "projectfu.zeroPower" || item.type === "zeroPower");
}