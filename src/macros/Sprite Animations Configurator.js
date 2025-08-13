/**
 * Sprite Animations Attack Macro Configuration
 *
 * This macro provides a simple dialog to configure some standard
 * animations for a given actor or tile.
 */

try {
  const controlled = [...canvas.tokens.controlled, ...canvas.tiles.controlled];
  let target = controlled[0]?.actor ? controlled[0].actor : controlled[0];

  if (!target) target = await EricaPFU.selectActor();

  if (!target) throw new Error(game.i18n.localize("EPFU.ERRORS.NOTARGET"));

  const app = new EricaPFU.AnimationConfigurationApplication({ target });
  await app.render(true);
} catch (err) {
  console.error(err);
  if (err instanceof Error)
    ui.notifications.error(err.message, { console: false, localize: true });
}
