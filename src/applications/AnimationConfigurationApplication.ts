import { AnimationConfiguration } from "types";
import { LocalizedError } from "../errors";
import { DeepPartial } from "fvtt-types/utils";

declare global {
  interface FlagConfig {
    Actor: {
      world: {
        spriteAnimationsAttackMacroSettings: AnimationConfiguration;
      }
    };
    TileDocument: {
      world: {
        spriteAnimationsAttackMacroSettings: AnimationConfiguration;
      }
    }
  }
}

const DEFAULT_FLAGS: AnimationConfiguration = {
  hitAnimation: "",
  defaultAnimation: "",
  missAnimation: "",
  hitDelay: 0,
  missDelay: 0
}

const FLAG_KEY = "spriteAnimationsAttackMacroSettings"

export class AnimationConfigurationApplication extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2)<AnimationConfigurationContext, AnimationConfigurationConfiguration> {

  #target: Actor | foundry.canvas.placeables.Tile;

  static DEFAULT_OPTIONS: DeepPartial<AnimationConfigurationConfiguration> = {
    window: {
      contentClasses: ["standard-form"],
      title: "EPFU.ANIMATIONCONFIG.TITLE",
      icon: "fa-solid fa-person-running"
    },
    tag: "form",
    position: {
      width: 500
    },
    form: {
      closeOnSubmit: true,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      handler: AnimationConfigurationApplication.onFormSubmit
    },
  }

  static PARTS: Record<string, foundry.applications.api.HandlebarsApplicationMixin.HandlebarsTemplatePart> = {
    main: {
      template: `modules/${__MODULE_ID__}/templates/animation-configuration/main.hbs`
    },
    footer: {
      template: "templates/generic/form-footer.hbs"
    }
  }

  get title() { return game.i18n?.format(this.options.window.title, { name: this.#target.name ?? "" }) ?? this.options.window.title; }

  static async onFormSubmit(this: AnimationConfigurationApplication, event: Event, form: HTMLFormElement, data: FormDataExtended) {
    try {
      const parsed = foundry.utils.expandObject(data.object) as AnimationConfigurationResponse;


      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
      if (this.#target instanceof foundry.canvas.placeables.Tile) await (this.#target.document as any).setFlag("world", FLAG_KEY, parsed);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
      else if (this.#target instanceof Actor) await (this.#target as any).setFlag("world", FLAG_KEY, parsed);
    } catch (err) {
      console.error(err);
      if (err instanceof Error) ui.notifications?.error(err.message, { console: false, localize: true });
    }
  }

  async _prepareContext(options: foundry.applications.api.ApplicationV2.RenderOptions): Promise<AnimationConfigurationContext> {
    const context = await super._prepareContext(options);

    context.flags = foundry.utils.mergeObject({} as Partial<AnimationConfiguration>, DEFAULT_FLAGS) as AnimationConfiguration;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
    if (this.#target instanceof foundry.canvas.placeables.Tile) foundry.utils.mergeObject(context.flags, (this.#target.document as any).getFlag("world", FLAG_KEY) ?? {});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    else if (this.#target instanceof Actor) foundry.utils.mergeObject(context.flags, (this.#target as any).getFlag("world", FLAG_KEY) as AnimationConfiguration ?? {});

    context.target = this.#target;

    if (SpriteAnimator) {
      const animations = SpriteAnimator.getAnimations(this.#target);
      if (Array.isArray(animations)) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        context.animationSelect = Object.fromEntries(animations.map((animation) => [animation.name, animation.name])) as Record<string, string>;
      }
    } else {
      throw new LocalizedError("NOSPRITEANIMATIONS");
    }

    context.buttons = [
      { type: "submit", icon: "fa-solid fa-save", label: "SETTINGS.Save" }
    ]

    return context;
  }

  constructor(options?: AnimationConfigurationConfiguration) {
    if (!SpriteAnimator) throw new LocalizedError("NOSPRITEANIMATIONS")
    if (!(options?.target instanceof foundry.canvas.placeables.Tile || options?.target instanceof Actor)) throw new Error("EPFU.ERRORS.NOTARGET");
    super(options);

    this.#target = options.target;
  }
}

interface AnimationConfigurationContext extends foundry.applications.api.ApplicationV2.RenderContext {
  target: foundry.canvas.placeables.Tile | Actor;
  animationSelect: Record<string, string>;
  flags: AnimationConfiguration;

  buttons: foundry.applications.api.ApplicationV2.FormFooterButton[];
}


interface AnimationConfigurationConfiguration extends foundry.applications.api.ApplicationV2.Configuration {
  target: Actor | foundry.canvas.placeables.Tile;
}

interface AnimationConfigurationResponse {
  defaultAnimation: string;
  hitAnimation: string;
  hitDelay: number;
  missAnimation: string;
  missDelay: number;
}