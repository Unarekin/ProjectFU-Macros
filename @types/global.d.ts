

import { SpriteAnimator as animator } from "foundryvtt-sprite-animations";

declare global {

  declare var __DEV__: boolean;
  declare var __MODULE_TITLE__: string;
  declare var __MODULE_ID__: string;
  declare var __MODULE_VERSION__: string;

  declare var SpriteAnimator: typeof animator;
}