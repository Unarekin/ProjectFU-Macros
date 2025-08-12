import { DAMAGE_TYPE, DamageAffinity, IgnoreAffinity, RESOURCE_TYPE, ResourceAbbreviation } from "types";
import { TokenSelectorApplication, TokenSelectorConfiguration } from "./TokenSelectorApplication";
import { hasFlag } from "functions";
import { DeepPartial } from "fvtt-types/utils";

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
  readonly #dragDrop: foundry.applications.ux.DragDrop[] = [];

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

    resources: {
      template: `modules/${__MODULE_ID__}/templates/resource-modifier/resource-section.hbs`
    },

    footer: {
      template: "templates/generic/form-footer.hbs"
    }
  };

  static DEFAULT_OPTIONS: DeepPartial<ResourceModifierConfiguration> = {
    tag: "form",
    window: {
      title: "EPFU.DIALOGS.RESOURCEMODIFIER.TITLE",
      contentClasses: ["standard-form", "resourcemodifier", "epfu", "flexcol"],
      icon: "fa-solid fa-briefcase-medical",
      resizable: true
    },
    position: {
      width: 700,
    },
    actions: {
      // eslint-disable-next-line @typescript-eslint/unbound-method
      cancel: ResourceModifierApplication.Cancel,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      removeToken: ResourceModifierApplication.RemoveToken,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      addTokens: ResourceModifierApplication.AddTokens,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      incrementField: ResourceModifierApplication.IncrementField,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      decrementField: ResourceModifierApplication.DecrementField
    },
    dragDrop: [
      {
        dragSelector: "",
        dropSelector: ".token-list",
        permissions: {
          dragstart: () => false,
          drop: () => true
        },
        callbacks: {
          dragstart: () => { },
          // eslint-disable-next-line @typescript-eslint/unbound-method
          dragover: ResourceModifierApplication.onDragOverActor,
          // eslint-disable-next-line @typescript-eslint/unbound-method
          drop: ResourceModifierApplication.dropHandler
        }
      }
    ],
    form: {
      closeOnSubmit: true,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      handler: ResourceModifierApplication.onFormSubmit
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  static onDragOverActor(this: ResourceModifierApplication, e: DragEvent) {
    // The drag event actually has no data associated with it, which is bothersome
  }

  static async dropHandler(this: ResourceModifierApplication, e: DragEvent) {
    const data = foundry.applications.ux.TextEditor.implementation.getDragEventData(e) as unknown as DropData;
    if (data && typeof data.type === "string") {
      switch (data.type) {
        case "Actor": {
          const actor = await fromUuid<Actor>(data.uuid);
          if (actor instanceof Actor) await this.onDropActor(actor);
          break;
        }
        case "Folder": {
          const folder = await fromUuid<Folder>(data.uuid);
          if (folder instanceof Folder) await this.onDropFolder(folder);
        }
      }
    }
  }

  private async onDropActor(actor: Actor, rerender = true) {
    if (!this.#actors.some(item => item.id === actor.id)) {
      this.#actors.push(actor);
      if (rerender) await this.render();
    }
  }

  private async onDropFolder(folder: Folder) {
    const actors = folder.contents.filter(item => item instanceof Actor);
    if (actors.length) {
      await Promise.all(actors.map(actor => this.onDropActor(actor, false)));
      await this.render();
    }
  }


  async _onRender(context: ResourceModifierContext, options: foundry.applications.api.ApplicationV2.RenderOptions) {
    await super._onRender(context, options);

    // Bind dragdrop handlers
    this.#dragDrop.forEach(d => d.bind(this.element));
  }

  static IncrementField(this: ResourceModifierApplication, event: Event, element: HTMLElement) {
    try {
      const field = element.dataset.field;
      if (!field) return;

      const input = this.element.querySelector(`[name="${field}"]`);
      if (input instanceof HTMLInputElement) {
        const step = parseFloat(input.getAttribute("step") ?? "1") ?? 1;
        input.value = (parseFloat(input.value) + step).toString();
      }
    } catch (err) {
      ui.notifications?.error((err as Error).message, { localize: true });
    }
  }

  static DecrementField(this: ResourceModifierApplication, event: Event, element: HTMLElement) {
    try {
      const field = element.dataset.field;
      if (!field) return;

      const input = this.element.querySelector(`[name="${field}"]`);
      if (input instanceof HTMLInputElement) {
        const step = parseFloat(input.getAttribute("step") ?? "1") ?? 1;
        input.value = (parseFloat(input.value) - step).toString();
      }
    } catch (err) {
      ui.notifications?.error((err as Error).message, { localize: true });
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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
    return items.find(item => (item.system as any).optionalType === ZP_TYPE);
  }

  private isPC(target: TokenLike): boolean {
    if (target instanceof Actor) return (target.type as string) == PC_TYPE;
    else return (target.actor?.type as string | undefined) === PC_TYPE;
  }

  private buildResourceContext(actor: Actor, resource: RESOURCE_TYPE): ResourceContext {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
    const { value = 0, max = 0 } = ((actor.system as any).resources[resource] ?? { value: 0, max: 0 }) as { value: number, max: number };
    const perc = (value / max) * 100;
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

  private parseInt(val: number | string): number {
    return Math.trunc(this.parseFloat(val));
  }

  private parseFloat(val: number | string): number {
    if (typeof val === "number") return val;
    if (typeof val === "string") {
      const parsed = parseFloat(val);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  }


  private getAffinity(actor: Actor, damageType: DAMAGE_TYPE): DamageAffinity {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
    return (actor.system as any).affinities[damageType]?.current as DamageAffinity || DamageAffinity.None;
  }

  private calculateEffectiveDamage(actor: Actor, formData: FormResults) {
    if (formData.hpOperation !== 0) return 0;
    const amount = formData.attributeHP;

    const affinity = this.getAffinity(actor, formData.damageType);
    if (affinity === DamageAffinity.None) return amount;

    const ignoreAffinities = formData.ignoreAffinities;

    if (hasFlag(ignoreAffinities, IgnoreAffinity.All)) return amount;

    switch (affinity) {
      case DamageAffinity.Vulnerable: {
        if (hasFlag(ignoreAffinities, IgnoreAffinity.Vulnerabilities)) return amount;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
        const vulnMult = (game?.settings as any)?.get("projectfu", "affinityVulnerability") as number ?? 2;
        return Math.floor(amount * vulnMult);
        break;
      }
      case DamageAffinity.Resistance: {
        if (hasFlag(ignoreAffinities, IgnoreAffinity.Resistances)) return amount;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
        const resMult = (game?.settings as any)?.get("projectfu", "affinityResistance") as number ?? 0.5;
        return Math.floor(amount * resMult);
        break;
      }
      case DamageAffinity.Immunity: {
        if (hasFlag(ignoreAffinities, IgnoreAffinity.Immunities)) return amount;
        else return 0;
        break;
      }
      case DamageAffinity.Absorption: {
        if (hasFlag(ignoreAffinities, IgnoreAffinity.Absorption)) return amount;
        else return -1 * amount;
        break;
      }
    }
  }


  private optionallyClamp(value: number, max: number, min = 0, bypass: boolean = false): number {
    if (bypass) return value;
    else return Math.max(Math.min(value, max), min);
  }

  private handleStandardResourceModifications(actor: Actor, resource: ResourceObject, op: ResourceOperation): Actor.UpdateData | undefined {
    let newValue: number = resource.value;

    switch (op.operation) {
      case 0: {
        // Decrease
        if (op.resource === "hp") newValue = resource.value - this.calculateEffectiveDamage(actor, op.data);
        else newValue = resource.value - op.amount;
        break;
      }
      case 1: {
        // Increase
        newValue = resource.value + op.amount;
        break;
      }
      case 2: {
        // To max
        newValue = resource.max;
        break;
      }
      case 3: {
        // To zero
        newValue = 0;
        break;
      }
      case 4: {
        // To crisis

        // Attempt to handle crisis score modification plans for later
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
        if (op.resource === "hp" && typeof (actor.system as any).resources.crisis?.value !== "undefined") {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
          newValue = (actor.system as any).resources.crisis.value as number;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
        else if (typeof (actor.system as any).crisis !== "undefined") {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
          newValue = (resource.value * ((actor.system as any).crisis.multiplier ?? 0.5)) + ((actor.system as any).crisis.mod ?? 0)
        } else {
          newValue = resource.max / 2;
        }
        break;
      }
      case 5: {
        // To value
        newValue = op.amount;
        break;
      }
    }

    if (newValue !== resource.value) {
      return {
        "system.resources": {
          [op.resource]: {
            // Handle rounding and optional clamping
            value: this.optionallyClamp(Math.floor(newValue), resource.max, 0, op.data.bypassClamping)
          }
        }
      } as Actor.UpdateData
    }
  }


  private handleSubmitForActor(actor: Actor, data: FormResults): Actor.UpdateData | undefined {
    if (data.allToMax) {
      return {
        _id: actor.id,
        system: {
          resources: {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
            "hp.value": (actor.system as any).resources.hp.max,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
            "mp.value": (actor.system as any).resources.mp.max,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
            ...(this.isPC(actor) ? { "ip.value": (actor.system as any).resources.ip.max } : {})
          }
        }
      }
    }

    const update: Actor.UpdateData = {};


    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
    const hpUpdate = this.handleStandardResourceModifications(actor, (actor.system as any).resources["hp"] as ResourceObject<"hp">, { operation: data.hpOperation, amount: data.attributeHP, data, resource: "hp" });
    if (hpUpdate) foundry.utils.mergeObject(update, hpUpdate);
    // Adjust MP
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
    const mpUpdate = this.handleStandardResourceModifications(actor, (actor.system as any).resources["mp"] as ResourceObject<"mp">, { operation: data.mpOperation, amount: data.attributeMP, data, resource: "mp" });
    if (mpUpdate) foundry.utils.mergeObject(update, mpUpdate);

    // Optionally adjust IP
    if (this.isPC(actor)) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
      const ipUpdate = this.handleStandardResourceModifications(actor, (actor.system as any).resources["ip"] as ResourceObject<"ip">, { operation: data.ipOperation, amount: data.attributeIP, data, resource: "ip" })
      if (ipUpdate) foundry.utils.mergeObject(update, ipUpdate);
    }

    if (Object.values(update).length) {
      return {
        ...update,
        _id: actor.id
      }
    }
  }

  private handleZPModification(actor: Actor, data: FormResults): Item.UpdateData | undefined {
    const zeroPower = this.getZeroPower(actor);
    if (!zeroPower) return;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
    const { progress } = (zeroPower.system as any).data as { progress: ProgressModel };

    // decrease, increase, max, zero, crisis, value

    let newValue = progress.current;

    switch (data.zpOperation) {
      case 0: {
        // Decrease
        newValue -= data.attributeZP;
        break;
      }
      case 1: {
        // Increase
        newValue += data.attributeZP;
        break;
      }
      case 2: {
        // Max
        newValue = progress.max;
        break;
      }
      case 3: {
        // Zero
        newValue = 0;
        break;
      }
      case 5: {
        // value
        newValue = data.attributeZP;
        break;
      }
    }

    newValue = Math.min(Math.max(Math.floor(newValue), 0), progress.max);
    if (newValue !== progress.current) {
      return {
        system: {
          "data.progress.current": newValue
        }
      }
    }
  }

  static async onFormSubmit(this: ResourceModifierApplication, event: Event, form: HTMLFormElement, formData: FormDataExtended) {
    try {
      const data = foundry.utils.expandObject(formData.object) as FormResults;

      // Select fields come through as a string even when their values are technically numeric
      data.hpOperation = this.parseInt(data.hpOperation);
      data.ignoreAffinities = this.parseInt(data.ignoreAffinities);
      data.ipOperation = this.parseInt(data.ipOperation);
      data.mpOperation = this.parseInt(data.mpOperation);
      data.zpOperation = this.parseInt(data.zpOperation);



      // Swap operations if we're adding a negative amount of damage, so we properly handle affinities later
      if (data.attributeHP < 0) {
        if (data.hpOperation === 0) {
          data.hpOperation = 1;
          data.attributeHP = Math.abs(data.attributeHP);
        } else if (data.hpOperation === 1) {
          data.hpOperation = 0;
          data.attributeHP = Math.abs(data.attributeHP);
        }
      }

      const actorUpdates = this.#actors.map(actor => this.handleSubmitForActor(actor, data)).filter(update => !!update);

      // Actor updates
      const allUpdates = [Actor.updateDocuments(actorUpdates)] as Promise<unknown>[]; // We do not care about the return type of the Promise

      // Token updates
      allUpdates.push(
        ...this.#tokens.map(token => {
          // Type guard
          if (!(token.actor instanceof Actor)) return;

          const update = this.handleSubmitForActor(token.actor, data);
          if (update)
            return token.actor.update(update);
        }).filter(update => !!update)
      )

      // Embedded item updates
      allUpdates.push(
        ...this.#actors.map(actor => this.handleEmbeddedUpdatesForActor(actor, data)).filter(item => !!item),
        ...this.#tokens.map(token => this.handleEmbeddedUpdatesForActor(token.actor as Actor, data)).filter(item => !!item)
      );

      await Promise.all(allUpdates);
    } catch (err) {
      console.error(err);
      if (err instanceof Error) ui.notifications?.error(err.message, { console: false });
    }
  }

  private handleEmbeddedUpdatesForActor(actor: Actor, data: FormResults): Promise<void> | undefined {
    const updates: Promise<void>[] = [];
    // ZeroPower
    const zeroPower = this.getZeroPower(actor);
    if (zeroPower) {
      const update = this.handleZPModification(actor, data);
      if (update) updates.push(zeroPower.update(update) as Promise<void>);
    }
    if (updates.length) return Promise.all(updates) as unknown as Promise<void>;
  }

  protected async _prepareContext(options: foundry.applications.api.ApplicationV2.RenderOptions): Promise<ResourceModifierContext> {
    const context: ResourceModifierContext = await super._prepareContext(options);

    context.hasPC = this.selectedItems.some(item => this.isPC(item));

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
    context.hasZP = (game.settings as any)?.get("projectfu", "optionZeroPower") && this.selectedItems.some(item => this.hasZeroPower(item));

    context.selectedItems = this.selectedItems.map(item => this.buildTokenContext(item));



    const hpAbbr = game.i18n?.localize("FU.HealthAbbr") ?? "";
    context.hpOperationSelect = {
      0: game.i18n?.format("EPFU.DIALOGS.RESOURCEMODIFIER.OPERATIONS.DECREASE", { resource: hpAbbr }) ?? "",
      1: game.i18n?.format("EPFU.DIALOGS.RESOURCEMODIFIER.OPERATIONS.INCREASE", { resource: hpAbbr }) ?? "",
      2: game.i18n?.format("EPFU.DIALOGS.RESOURCEMODIFIER.OPERATIONS.TOMAX", { resource: hpAbbr }) ?? "",
      3: game.i18n?.format("EPFU.DIALOGS.RESOURCEMODIFIER.OPERATIONS.TOZERO", { resource: hpAbbr }) ?? "",
      4: game.i18n?.format("EPFU.DIALOGS.RESOURCEMODIFIER.OPERATIONS.TOCRISIS", { resource: hpAbbr }) ?? "",
      5: game.i18n?.format("EPFU.DIALOGS.RESOURCEMODIFIER.OPERATIONS.TOVALUE", { resource: hpAbbr }) ?? ""
    }

    const mpAbbr = game.i18n?.localize("FU.MindAbbr") ?? "";
    context.mpOperationSelect = {
      0: game.i18n?.format("EPFU.DIALOGS.RESOURCEMODIFIER.OPERATIONS.DECREASE", { resource: mpAbbr }) ?? "",
      1: game.i18n?.format("EPFU.DIALOGS.RESOURCEMODIFIER.OPERATIONS.INCREASE", { resource: mpAbbr }) ?? "",
      2: game.i18n?.format("EPFU.DIALOGS.RESOURCEMODIFIER.OPERATIONS.TOMAX", { resource: mpAbbr }) ?? "",
      3: game.i18n?.format("EPFU.DIALOGS.RESOURCEMODIFIER.OPERATIONS.TOZERO", { resource: mpAbbr }) ?? "",
      5: game.i18n?.format("EPFU.DIALOGS.RESOURCEMODIFIER.OPERATIONS.TOVALUE", { resource: mpAbbr }) ?? ""
    }

    const ipAbbr = game.i18n?.localize("FU.InventoryAbbr") ?? ""
    context.ipOperationSelect = {
      0: game.i18n?.format("EPFU.DIALOGS.RESOURCEMODIFIER.OPERATIONS.DECREASE", { resource: ipAbbr }) ?? "",
      1: game.i18n?.format("EPFU.DIALOGS.RESOURCEMODIFIER.OPERATIONS.INCREASE", { resource: ipAbbr }) ?? "",
      2: game.i18n?.format("EPFU.DIALOGS.RESOURCEMODIFIER.OPERATIONS.TOMAX", { resource: ipAbbr }) ?? "",
      3: game.i18n?.format("EPFU.DIALOGS.RESOURCEMODIFIER.OPERATIONS.TOZERO", { resource: ipAbbr }) ?? "",
      5: game.i18n?.format("EPFU.DIALOGS.RESOURCEMODIFIER.OPERATIONS.TOVALUE", { resource: ipAbbr }) ?? ""
    }

    const zpAbbr = game.i18n?.localize("FU.ZeroPowerAbbr") ?? "";
    context.zpOperationSelect = {
      1: game.i18n?.format("EPFU.DIALOGS.RESOURCEMODIFIER.OPERATIONS.INCREASE", { resource: zpAbbr }) ?? "",
      0: game.i18n?.format("EPFU.DIALOGS.RESOURCEMODIFIER.OPERATIONS.DECREASE", { resource: zpAbbr }) ?? "",
      2: game.i18n?.format("EPFU.DIALOGS.RESOURCEMODIFIER.OPERATIONS.TOMAX", { resource: zpAbbr }) ?? "",
      3: game.i18n?.format("EPFU.DIALOGS.RESOURCEMODIFIER.OPERATIONS.TOZERO", { resource: zpAbbr }) ?? "",
      5: game.i18n?.format("EPFU.DIALOGS.RESOURCEMODIFIER.OPERATIONS.TOVALUE", { resource: zpAbbr }) ?? ""
    }

    context.ignoreAffinitiesSelect = {
      0: "EPFU.DIALOGS.RESOURCEMODIFIER.IGNOREAFFINITIES.NONE",
      1: "EPFU.DIALOGS.RESOURCEMODIFIER.IGNOREAFFINITIES.RESISTANCES",
      5: "EPFU.DIALOGS.RESOURCEMODIFIER.IGNOREAFFINITIES.RESISTANCESANDIMMUNITIES",
      15: "EPFU.DIALOGS.RESOURCEMODIFIER.IGNOREAFFINITIES.ALL"
    }

    context.damageTypeSelect = {
      physical: "FU.DamagePhysical",
      air: "FU.DamageAir",
      bolt: "FU.DamageBolt",
      dark: "FU.DamageDark",
      earth: "FU.DamageEarth",
      fire: "FU.DamageFire",
      ice: "FU.DamageIce",
      light: "FU.DamageLight",
      poison: "FU.DamagePoison",
      untyped: "FU.DamageUntyped"
    }


    context.buttons = [
      { icon: "fa-solid fa-times", label: "Cancel", type: "button", action: "cancel" },
      { icon: "fa-solid fa-check", label: "EPFU.DIALOGS.RESOURCEMODIFIER.BUTTONS.APPLY", type: "submit" }
    ]

    return context;
  }


  private bindMethodByPath(obj: Record<string, unknown>, key: string) {
    const val = foundry.utils.getProperty(obj, key);
    if (typeof val === "function") {
      foundry.utils.mergeObject(obj, {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        [key]: val.bind(this)
      });
    }
  }

  protected createDragDropHandlers(): foundry.applications.ux.DragDrop[] {
    if (!this.options.dragDrop) return [];
    return this.options.dragDrop.map(drag => {
      const newDrag = foundry.utils.mergeObject({}, drag);

      // Ensure our callback methods' contexts are bound to the current application.
      ["permissions.dragstart", "permissions.drop", "callbacks.dragover", "callbacks.dragstart", "callbacks.drop"]
        .forEach(key => { this.bindMethodByPath(newDrag, key); });


      return new foundry.applications.ux.DragDrop.implementation(newDrag);
    })
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

    this.#dragDrop.splice(0, this.#dragDrop.length, ...this.createDragDropHandlers());
  }

}


export interface ResourceModifierConfiguration extends foundry.applications.api.ApplicationV2.Configuration {

  tokens?: (Token | TokenDocument)[];
  actors?: Actor[];

  dragDrop?: DragDropConfig[]
}

interface DragDropConfig {
  dragSelector: string;
  dropSelector?: string;

  filter?: (e: DragEvent) => boolean;

  permissions: {
    dragstart: (selector: foundry.applications.ux.DragDrop.DragSelector) => boolean;
    drop: (selector: foundry.applications.ux.DragDrop.DragSelector) => boolean;
  };
  callbacks: {
    dragstart: (e: DragEvent) => void | Promise<void>;
    dragover: (e: DragEvent) => void | Promise<void>;
    drop: (e: DragEvent) => void | Promise<void>;
  };
}

export interface ResourceModifierContext extends foundry.applications.api.ApplicationV2.RenderContext {
  hasPC: boolean;
  hasZP: boolean;

  selectedItems: TokenContext[];

  hpOperationSelect: Record<string, string>;
  mpOperationSelect: Record<string, string>;
  ipOperationSelect: Record<string, string>;
  zpOperationSelect: Record<string, string>;

  damageTypeSelect: Record<DAMAGE_TYPE, string>;
  ignoreAffinitiesSelect: Record<string, string>;

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

interface FormResults {
  attributeHP: number;
  attributeIP: number;
  attributeMP: number;
  attributeZP: number;
  damageType: DAMAGE_TYPE;
  hpOperation: number;
  ignoreAffinities: number;
  ipOperation: number;
  mpOperation: number;
  zpOperation: number;
  allToMax: boolean;
  bypassClamping: boolean;
}

interface ResourceOperation {
  amount: number;
  operation: number;
  data: FormResults;
  resource: ResourceAbbreviation
}


interface ResourceObject<t = ResourceAbbreviation> {
  value: number;
  max: number;
  bonus: number;
  attribute: t;
}

interface ProgressModel {
  current: number;
  max: number;
  step: number;
}

interface DropData {
  type: string;
  uuid: string;
}