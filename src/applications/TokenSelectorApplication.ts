

export class TokenSelectorApplication extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2)<TokenSelectorContext, TokenSelectorConfiguration> {

  static PARTS: Record<string, foundry.applications.api.HandlebarsApplicationMixin.HandlebarsTemplatePart> = {
    main: {
      template: `modules/${__MODULE_ID__}/templates/token-selector/main.hbs`,
      templates: [
        `modules/${__MODULE_ID__}/templates/token-selector/token-item.hbs`
      ]
    },
    footer: {
      template: "templates/generic/form-footer.hbs"
    }
  }

  static DEFAULT_OPTIONS = {
    window: {
      title: "EPFU.DIALOGS.TOKENSELECTOR.TITLE",
      contentClasses: ["standard-form", "tokenselector", "epfu"],
      icon: "fa-solid fa-crosshairs-simple"
    },
    actions: {
      // eslint-disable-next-line @typescript-eslint/unbound-method
      cancel: TokenSelectorApplication.Cancel,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      select: TokenSelectorApplication.Select
    }
  }

  static Cancel(this: TokenSelectorApplication) {
    void this.close();
  }

  readonly #hookId: number;
  readonly #callback: TokenSelectorCallback;

  protected _onClose(options: foundry.applications.api.ApplicationV2.RenderOptions): void {
    super._onClose(options);

    // Clean up hook
    if (this.#hookId) Hooks.off("controlToken", this.#hookId);
  }

  static Select(this: TokenSelectorApplication) {
    const elems = Array.from(this.element.querySelectorAll(`[data-role="token-item"]`));
    const tokens = elems.reduce((prev, curr) => {
      if (curr instanceof HTMLElement && curr.dataset.tokenId) {
        const token = canvas?.scene?.tokens.get(curr.dataset.tokenId);
        if (token) return [...prev, token];
      }
      return prev;
    }, [] as TokenDocument[]);

    this.#callback(tokens);
    void this.close();
  }


  protected async _prepareContext(options: foundry.applications.api.ApplicationV2.RenderOptions): Promise<TokenSelectorContext> {
    const context = await super._prepareContext(options);

    if (!options.isFirstRender)
      context.tokens = [...canvas?.tokens?.controlled ?? []];
    else
      context.tokens = [];

    context.buttons = [
      { icon: "fa-solid fa-times", label: "Cancel", type: "button", action: "cancel" },
      { icon: "fa-solid fa-check", label: "EPFU.DIALOGS.RESOURCEMODIFIER.BUTTONS.APPLY", type: "button", action: "select" }
    ]

    console.log("Context:", context);
    return context;
  }

  constructor(options: TokenSelectorConfiguration) {
    super(options);



    this.#callback = options.callback ?? (() => { });
    this.#hookId = Hooks.on("controlToken", () => {
      void this.render();
    });
  }
}

type TokenSelectorCallback = (tokens: TokenDocument[]) => void;



interface TokenSelectorContext extends foundry.applications.api.ApplicationV2.RenderContext {

  tokens: Token[];

  buttons: foundry.applications.api.ApplicationV2.FormFooterButton[];
}


export interface TokenSelectorConfiguration extends foundry.applications.api.ApplicationV2.Configuration {
  callback: TokenSelectorCallback;
}