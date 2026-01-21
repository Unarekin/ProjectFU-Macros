/***************************************************************************
 * Resource Modification Macro
 *
 * This macro will handle adjusting a token's HP, MP, and/or IP
 * When removing HP, it will respect the token's Damage Affinities, where
 * applicable.
 *
 * By Erica, adapted from a macro by Dark Magician Girl
 ***************************************************************************/

try {
  await new EricaPFU.ResourceModifierApplication().render({ force: true });
} catch (err) {
  console.error(err);
  if (err instanceof Error)
    ui.notifications.error(err.message, { console: false, localize: true });
}
