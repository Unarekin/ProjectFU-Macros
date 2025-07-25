import { RESOURCE_TYPE } from "types";
import { TokenSelectorApplication, TokenSelectorConfiguration } from "./TokenSelectorApplication";

const PC_TYPE = "character";
const ZP_TYPE = "projectfu.zeroPower";

const RESOURCE_KEYS: Record<RESOURCE_TYPE, string> = {
  hp: "FU.HealthAbbr",
  mp: "FU.MindAbbr",
  ip: "FU.InventoryAbbr",
  zp: "FU.ZeroPowerAbbr"
}

export class ResourceModifierApplication extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2)<ResourceModifierContext, ResourceModifierConfiguration> {

  readonly #tokens: (Token | TokenDocument)[] = [];
  readonly #actors: Actor[] = [];

  private get selectedItems(): TokenLike[] {
    return [
      ...this.#tokens,
      ...this.#actors
    ];
  }

  static PARTS = {
    tokens: {
      template: `modules/${__MODULE_ID__}/templates/resource-modifier/token-section.hbs`,
      templates: [
        `modules/${__MODULE_ID__}/templates/resource-modifier/token-item.hbs`,
        `modules/${__MODULE_ID__}/templates/resource-modifier/resource-item.hbs`
      ]
    },

    footer: {
      template: "templates/generic/form-footer.hbs"
    }
  };

  static DEFAULT_OPTIONS = {
    tag: "form",
    window: {
      title: "EPFU.DIALOGS.RESOURCEMODIFIER.TITLE",
      contentClasses: ["standard-form", "resourcemodifier", "epfu", "flexcol"],
      icon: "fa-solid fa-briefcase-medical",
      resizable: true
    },
    position: {
      width: 525,
    },
    actions: {
      // eslint-disable-next-line @typescript-eslint/unbound-method
      cancel: ResourceModifierApplication.Cancel,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      removeToken: ResourceModifierApplication.RemoveToken,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      addTokens: ResourceModifierApplication.AddTokens
    },
    form: {
      closeOnSubmit: true,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      handler: ResourceModifierApplication.onFormSubmit
    }
  }

  static async AddTokens(this: ResourceModifierApplication) {
    try {
      await (new TokenSelectorApplication({
        callback: (tokens) => {
          // Only add tokens that are not already
          const docIds = this.#tokens.map(token => token instanceof TokenDocument ? token.id : token.document.id);
          const newTokens = tokens.filter(token => !docIds.includes(token.id));
          this.#tokens.push(...newTokens);
          void this.render();
        }
      } as TokenSelectorConfiguration)).render(true);

    } catch (err) {
      ui.notifications?.error((err as Error).message, { localize: true });
    }
  }

  static async RemoveToken(this: ResourceModifierApplication, event: PointerEvent, elem: HTMLElement) {
    try {
      const id = elem.dataset.id;
      if (!id) throw new Error("EPFU.ERRORS.NOACTOR");

      const tokenIndex = this.#tokens.findIndex(item => item.id === id);
      if (tokenIndex != -1) {
        const removed = await this.removeItemFromList(this.#tokens, tokenIndex);
        if (removed) await this.render();
      } else {
        const actorIndex = this.#actors.findIndex(item => item.id === id);
        if (actorIndex !== -1) {
          const removed = await this.removeItemFromList(this.#actors, actorIndex);
          if (removed) await this.render();
        }
      }
    } catch (err) {
      ui.notifications?.error((err as Error).message, { localize: true });
    }
  }

  private async removeItemFromList(list: TokenLike[], index: number): Promise<boolean> {
    const item = list[index];
    if (!item) throw new Error("EPFU.ERRORS.NOACTOR");

    const confirm = await (foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n?.format("EPFU.DIALOGS.RESOURCEMODIFIER.REMOVECONFIRM.TITLE", { name: item.name }) ?? "" },
      content: game.i18n?.format("EPFU.DIALOGS.RESOURCEMODIFIER.REMOVECONFIRM.MESSAGE", { name: item.name }) ?? ""
    }) as Promise<boolean>);

    console.log("Confirm:", confirm);

    if (!confirm) return false;

    list.splice(index, 1);
    return true;
  }

  /**
   * Attempts to locate an item on a given {@link Actor} with the appropriate type for a Zero Power
   * @param {TokenLike} target - Actor to check, specified by {@link Token}, {@link TokenDocument}, or {@link Actor} directly
   * @returns {boolean}
   */
  private hasZeroPower(target: TokenLike): boolean {
    return !!this.getZeroPower(target);
  }

  private getZeroPower(target: TokenLike): Item | undefined {
    const items = target instanceof Actor ? target.items.contents : (target.actor?.items.contents ?? []);
    return items.find(item => (item.type as string) === ZP_TYPE);
  }

  private isPC(target: TokenLike): boolean {
    if (target instanceof Actor) return (target.type as string) == PC_TYPE;
    else return (target.actor?.type as string | undefined) === PC_TYPE;
  }

  private buildResourceContext(actor: Actor, resource: RESOURCE_TYPE): ResourceContext {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
    const { value = 0, max = 0 } = ((actor.system as any).resources[resource] ?? { value: 0, max: 0 }) as { value: number, max: number };
    const perc = (max / value) * 100;
    return {
      current: value,
      max,
      perc,
      label: RESOURCE_KEYS[resource]
    }
  }


  private buildTokenContext(item: TokenLike): TokenContext {
    const zeroPower = this.getZeroPower(item);
    const isPC = this.isPC(item);
    const actor = item instanceof Actor ? item : item.actor;
    if (!(actor instanceof Actor)) throw new Error("EPFU.ERRORS.NOACTOR");

    return {
      id: item.id ?? "",
      name: item.name,
      image: actor.img as string,
      isPC: isPC ? true : false,
      hasZeroPower: !!zeroPower,
      zeroPower,
      hp: this.buildResourceContext(actor, "hp"),
      mp: this.buildResourceContext(actor, "mp"),
      ...(isPC ? { ip: this.buildResourceContext(actor, "ip") } : {})
    }
  }

  static Cancel(this: ResourceModifierApplication) {
    void this.close();
  }

  static onFormSubmit(this: ResourceModifierApplication, event: Event, form: HTMLFormElement, data: FormDataExtended) {
    console.log("Form submitted:", foundry.utils.expandObject(data.object));
  }

  protected async _prepareContext(options: foundry.applications.api.ApplicationV2.RenderOptions): Promise<ResourceModifierContext> {
    const context: ResourceModifierContext = await super._prepareContext(options);

    context.hasPC = this.selectedItems.some(item => this.isPC(item));

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
    context.hasZP = (game.settings as any)?.get("projectfu", "optionZeroPower") && this.selectedItems.some(item => this.hasZeroPower(item));

    context.selectedItems = this.selectedItems.map(item => this.buildTokenContext(item));

    context.buttons = [
      { icon: "fa-solid fa-times", label: "Cancel", type: "button", action: "cancel" },
      { icon: "fa-solid fa-check", label: "EPFU.DIALOGS.RESOURCEMODIFIER.BUTTONS.APPLY", type: "submit" }
    ]


    console.log("Context:", context);
    return context;
  }


  constructor(options?: ResourceModifierConfiguration) {
    super(options);

    if (Array.isArray(options?.tokens)) this.#tokens.splice(0, this.#tokens.length, ...options.tokens);
    if (Array.isArray(options?.actors)) this.#actors.splice(0, this.#actors.length, ...options.actors);

    if (this.#tokens.length === 0 && this.#actors.length === 0) {
      if ((game.user as User)?.character instanceof Actor) {
        // If they have a character assigned,  use that one
        this.#actors.splice(0, this.#actors.length, (game.user as User)?.character as Actor);
      } else {
        // Use selected tokens
        this.#tokens.splice(0, this.#tokens.length, ...(canvas?.tokens?.controlled ?? []))
      }
    }

  }

}


export interface ResourceModifierConfiguration extends foundry.applications.api.ApplicationV2.Configuration {

  tokens?: (Token | TokenDocument)[];
  actors?: Actor[];
}

export interface ResourceModifierContext extends foundry.applications.api.ApplicationV2.RenderContext {
  hasPC: boolean;
  hasZP: boolean;

  selectedItems: TokenContext[];


  buttons: foundry.applications.api.ApplicationV2.FormFooterButton[];
}

interface ResourceContext {
  current: number,
  max: number,
  perc: number,
  label: string
}

interface TokenContext {
  id: string;
  name: string;
  image: string;
  isPC: boolean;
  hasZeroPower: boolean;
  zeroPower: Item | undefined;

  hp: ResourceContext;
  mp: ResourceContext;
  ip?: ResourceContext;
}


type TokenLike = Token | TokenDocument | Actor;