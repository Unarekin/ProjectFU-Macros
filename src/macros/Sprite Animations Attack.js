/**
 * Sprite Animations Attack Macro
 * This macro provides a basic way to run a series of animations on an attacking sprite
 * to try and emulate the "approach and hit" style seen in JRPGs
 *
 * This macro is expected to be executed via Automated Animations, passing a single argument
 * that is a JSON object in the following format:
 */

const DEFAULT_CONFIGURATION = {
  idleAnimation: "idle",
  approachAnimation: "run",
  retreatAnimation: "jump",
  attackAnimation: "attack",
  critAnimation: "",
  fumbleAnimation: "",
  hitDelay: 500,
  critDelay: 1200,
  approachTime: 1000,
  retreatTime: 750,
  playPerTarget: true,
  attackSound: "",
  hitSound: "",
  missSound: "",
  critSound: "",
  fumbleSound: "",
  attackSoundDelay: 0,
  hitSoundDelay: 0,
  missSoundDelay: 0,
  critSoundDelay: 0,
  fumbleSoundDelay: 0,
  attackSoundVolume: 1,
  hitSoundVolume: 1,
  missSoundVolume: 1,
  critSoundVolume: 1,
  fumbleSoundVolume: 1,
  hitFlashColor: "red",
  hitFlashTime: 250,
};

const SETTINGS_FLAG = "spriteAnimationsAttackMacroSettings";

try {
  if (!game.modules.get("sequencer")?.active)
    throw new Error("This macro requires Sequencer be active and enabled.");

  if (!args[2]) throw new Error("No animation configuration provided.");
  const [chatMessage, aaHandler] = args;
  const token = aaHandler.sourceToken;

  if (!token) throw new Error("Unable to determine token.");

  const config = foundry.utils.mergeObject(DEFAULT_CONFIGURATION, args[2]);

  const tokenAnimations = SpriteAnimator.getAnimations(token).map(
    (anim) => anim.name
  );

  const tokenSettings = (
    token.actor ? token.actor : token.document ? token.document : token
  ).getFlag("world", SETTINGS_FLAG);

  const sourceX = token.x;
  const sourceY = token.y;

  const flags = chatMessage.flags.projectfu.CheckV2;
  const { critical, fumble } = flags;

  if (!config.critAnimation) config.critAnimation = config.attackAnimation;
  if (!config.fumbleAnimation) config.fumbleAnimation = config.attackAnimation;
  if (!config.retreatAnimation)
    config.retreatAnimation = config.approachAnimation;

  const attackHitDelay = (critical ? config.critDelay : config.hitDelay) ?? 0;

  const shouldApproach =
    aaHandler.allTargets.length &&
    config.approachAnimation &&
    tokenAnimations.includes(config.approachAnimation) &&
    game.modules.get("sequencer")?.active;

  async function playAttackAnimation(target, data) {
    const pos = { x: 0, y: 0 };
    const hit = data?.result === "hit";
    if ((target && target instanceof Token) || target instanceof Tile) {
      pos.x = target.x;
      pos.y =
        target.y +
        target.document.height * canvas.scene.dimensions.size -
        token.document.height * canvas.scene.dimensions.size;

      if (sourceX > target.x)
        pos.x += target.document.width * canvas.scene.dimensions.size;
      else if (sourceX < target.x)
        pos.x -= token.document.width * canvas.scene.dimensions.size;
    } else {
      pos.x = target.x;
      pos.y = target.y;
    }

    // Approach
    if (shouldApproach) {
      await new Sequence()
        .spriteAnimation(token)
        .add(config.approachAnimation)
        .immediate(true)
        .animation()
        .on(token)
        .moveTowards(pos)
        .duration(config.approachTime)
        .waitUntilFinished()
        .play();
    }

    // Hit/miss animation
    if ((target && target instanceof Tile) || target instanceof Token) {
      const settings = (
        target.actor ? target.actor : target.document ? target.document : target
      ).getFlag("world", SETTINGS_FLAG);
      const hitAnimation =
        hit && settings?.hitAnimation
          ? settings.hitAnimation
          : !hit && settings?.missAnimation
          ? settings.missAnimation
          : "";
      const hitDelay =
        hit && settings?.hitDelay
          ? settings.hitDelay
          : !hit && settings?.missDelay
          ? settings.missDelay
          : 0;
      if (hitAnimation) {
        const anims = [hitAnimation];
        if (settings?.defaultAnimation) anims.push(settings.defaultAnimation);
        wait(attackHitDelay + hitDelay)
          .then(() => SpriteAnimator.playAnimations(target, ...anims))
          .catch(console.error);
      }
      if (hit && config.hitFlashColor && config.hitFlashTime) {
        const seq = new Sequence();
        const color = new PIXI.Color(config.hitFlashColor);

        seq.wait(attackHitDelay + hitDelay);
        seq.animation().on(target).tint(color.toHex());
        seq.wait(config.hitFlashTime);
        seq.animation().on(target).tint(0xffffff).play();
      }
    }

    const attackSound =
      (critical
        ? config.critSound
        : fumble
        ? config.fumbleSound
        : hit
        ? config.hitSound
        : config.missSound) ?? "";
    const soundDelay =
      (critical
        ? config.critSoundDelay
        : fumble
        ? config.fumbleSoundDelay
        : hit
        ? config.hitSoundDelay
        : config.missSoundDelay) ?? 0;
    const soundVolume =
      (critical
        ? config.critSoundVolume
        : fumble
        ? config.fumbleSoundVolume
        : hit
        ? config.hitSoundVolume
        : config.missSoundVolume) ?? 0;

    if (attackSound) {
      new Sequence()
        .wait(soundDelay)
        .sound()
        .file(attackSound)
        .volume(soundVolume)
        .play();
    }

    // Attack animation
    const attackAnimation = critical
      ? config.critAnimation
      : fumble
      ? config.fumbleAnimation
      : config.attackAnimation;

    if (config.attackSound) {
      const seq = new Sequence();
      if (config.attackSoundDelay) seq.wait(config.attackSoundDelay);
      seq
        .sound()
        .file(config.attackSound)
        .volume(config.attackSoundVolume ?? 1)
        .play();
    }

    await new Sequence()
      .spriteAnimation(token)
      .add(attackAnimation)
      .immediate(true)
      .waitUntilFinished()
      .play();
  }

  if (aaHandler.allTargets.length > 1 && !config.playPerTarget) {
    // Determine average position
    const pos = aaHandler.allTargets.reduce(
      (prev, curr, i) => {
        return {
          x:
            prev.x +
            curr.x +
            curr.document.width * canvas.scene.dimensions.size,
          y:
            prev.y +
            curr.y +
            curr.document.height * canvas.scene.dimensions.size,
        };
      },
      { x: 0, y: 0 }
    );
    pos.x /= aaHandler.allTargets.length;
    pos.y /= aaHandler.allTargets.length;

    // Align to mid-point
    if (sourceX > pos.x)
      pos.x += token.document.width * canvas.scene.dimensions.size;
    else if (sourceX < pos.x)
      pos.x -= token.document.width * canvas.scene.dimensions.size;

    pos.y -= token.document.height * canvas.scene.dimensions.size;

    await playAttackAnimation(pos);
  } else if (aaHandler.allTargets.length) {
    // Sort by leading edge
    const targets = aaHandler.allTargets.sort((a, b) => {
      const edgeA =
        sourceX > a.x
          ? a.x + a.document.width * canvas.scene.dimensions.size
          : a.x - a.document.width * canvas.scene.dimensions.size;
      const edgeB =
        sourceX > b.x
          ? b.x + b.document.width * canvas.scene.dimensions.size
          : b.x - b.document.width * canvas.scene.dimensions.size;
      return edgeB - edgeA;
    });

    // Iterate
    for (let i = 0; i < targets.length; i++) {
      await playAttackAnimation(
        aaHandler.allTargets[i],
        flags.additionalData.targets[i]
      );
    }
  } else {
    await playAttackAnimation({ x: token.x, y: token.y });
  }

  // Retreat
  if (shouldApproach) {
    await new Sequence()
      .spriteAnimation(token)
      .add(config.retreatAnimation ?? config.approachAnimation)
      .immediate(true)
      .animation()
      .on(token)
      .moveTowards({ x: sourceX, y: sourceY })
      .duration(config.retreatTime ?? config.approachTime)
      .waitUntilFinished()
      .play();
  }

  if (tokenSettings.defaultAnimation)
    SpriteAnimator.playAnimation(token, tokenSettings.defaultAnimation);
} catch (err) {
  ui.notifications.error(err.message, { console: false });
  console.error(err);
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
