import { EmptyObject } from "Foundry-VTT/src/types/utils.mjs";


export class TargetSelectorApplication extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  static PARTS = {
    header: {
      template: `modules/${__MODULE_ID__}/templates/target-selector/header.hbs`
    },
    combatants: {
      template: `modules/${__MODULE_ID__}/templates/target-selector/combatants.hbs`
    },
    footer: {
      template: `modules/${__MODULE_ID__}/templates/target-selector/footer.hbs`
    }
  };

  static DEFAULT_OPTIONS = {
    tag: "form",
    window: {
      title: "EPFU.DIALOGS.TARGETSELECTOR.TITLE",
    },
    classes: ["epfu", "targetselection"],
    position: {
      width: 525,
    },
    actions: {
      // eslint-disable-next-line @typescript-eslint/unbound-method
      cancel: TargetSelectorApplication.onCancel,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      randomize: TargetSelectorApplication.onRandomize,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      toggleCombatant: TargetSelectorApplication.onToggleCombatant
    },
    form: {
      closeOnSubmit: true,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      handler: TargetSelectorApplication.onFormSubmit
    }
  }

  static onFormSubmit(this: TargetSelectorApplication, event: Event, form: HTMLFormElement, data: FormDataExtended) {
    const selected = Array.isArray(data.object.selected) ? data.object.selected : data.object.selected ? [data.object.selected] : [];
    if (game.user instanceof User)
      game.user.updateTokenTargets(selected as string[]);
  }

  static onToggleCombatant(this: TargetSelectorApplication, e: Event, element: HTMLElement) {
    const div = element.querySelector(`div.combatant`);
    if (!(div instanceof HTMLDivElement)) return;

    if (div.classList.contains("selected")) {
      div.classList.remove("selected");
    } else {
      div.classList.add("selected");
    }
    this.setSelectedFormElements();
  }

  protected setSelectedFormElements() {
    const container = this.element.querySelector(`[data-role="selected-items"]`);
    if (!(container instanceof HTMLElement)) return;

    container.innerHTML="";
    const selected = this.element.querySelectorAll(`[data-combatant]:has(.selected)`) as unknown as HTMLElement[];
    for (const item of selected) {
      const input = document.createElement("input");
      input.setAttribute("type", "hidden");
      input.setAttribute("name", "selected");
      input.value = item.dataset.token ?? "";
      container.appendChild(input);
    }
  }

  static onRandomize(this: TargetSelectorApplication) {
    const dispo = this.element.querySelector(`select[name="disposition"]`);
    const quantity = this.element.querySelector(`input[name="quantity"]`);

    const qty = quantity instanceof HTMLInputElement ? parseInt(quantity.value) : 0;

    if (dispo instanceof HTMLSelectElement) {
      const disposition = parseInt(dispo.value);
      const combatants = this.knownCombatants.filter(combatant => combatant.disposition === disposition);
      // Shuffle
      for (let i=combatants.length-1;i>0;i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [combatants[i], combatants[j]] = [combatants[j], combatants[i]];
      }
      // Grab first N
      const selected = combatants.slice(0,qty);

      // Highlight selected tokens
      const combatantElements = this.element.querySelectorAll(`.combatant`);
      for (const elem of combatantElements)
        elem.classList.remove("selected")

      for (const combatant of selected) {
        const elem = this.element.querySelector(`[data-combatant="${combatant.id as string}"] .combatant`);
        elem?.classList.add("selected");
      }
      this.setSelectedFormElements();
    }
  }

  static onCancel(this: TargetSelectorApplication) {
    void this.close();
  }

  protected _onRender(): void {
    const dispoSelect = this.element.querySelector(`[data-action="changeDisposition"]`)


    if (dispoSelect instanceof HTMLSelectElement) {
      this.applyDispositionFilter(parseInt(dispoSelect.value) ?? 0);
      dispoSelect.addEventListener("change", () => {
        this.applyDispositionFilter(parseInt(dispoSelect.value) ?? 0);
      })
    }
  }

  protected getCombatantResource(combatant: Combatant, resource: string): Record<string, number> {
    return {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
      value: (combatant.actor?.system?.resources as any)?.[resource].value ?? 0,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
      max: (combatant.actor?.system?.resources as any)?.[resource].max ?? 0
    }
  }

  protected parseCombatant(combatant: Combatant): Record<string, unknown> {
    return {
      id: combatant.id,
      name: combatant.name,
      img: combatant.img?.replaceAll("'", "\\'"),
      hp: this.getCombatantResource(combatant, "hp"),
      mp: this.getCombatantResource(combatant, "mp"),
      actorId: combatant.actor?.id ?? "",
      disposition: combatant.token?.disposition ?? "",
      tokenId: combatant.tokenId
    }
  }

  protected applyDispositionFilter(disposition: number) {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const combatants = Array.from(this.element.querySelectorAll(`[data-combatant]`)) as HTMLElement[];
    const hasCombatants = combatants.some(item => item.dataset.disposition === `${disposition}`);
    
    const hasNone = this.element.querySelector(`.no-combatants`);

    console.log("Element:", hasNone);

    if (hasNone instanceof HTMLElement) {
      if (hasCombatants) hasNone.style.display="none";
      else hasNone.style.display="flex";
    }

    for (const combatant of combatants) {
      if (combatant.dataset.disposition === `${disposition}`) combatant.style.display = "block";
      else combatant.style.display = "none";
    }

    const selected = this.element.querySelectorAll(`.selected.combatant`) as unknown as HTMLElement[];
    for (const item of selected)
      item.classList.remove("selected");
    this.setSelectedFormElements();
  }

  protected knownCombatants: Record<string, unknown>[] = [];

  protected async _prepareContext(options: { force?: boolean | undefined; position?: { top?: number | undefined; left?: number | undefined; width?: number | "auto" | undefined; height?: number | "auto" | undefined; scale?: number | undefined; zIndex?: number | undefined; } | undefined; window?: { title?: string | undefined; icon?: string | false | undefined; controls?: boolean | undefined; } | undefined; parts?: string[] | undefined; isFirstRender?: boolean | undefined; }): Promise<EmptyObject> {
    const context = await super._prepareContext(options);

    this.knownCombatants=(game.combat?.combatants?.contents.map(combatant => this.parseCombatant(combatant))) ?? [];

    return {
      ...context,
      // combatants: (game.combat?.combatants?.contents.map(combatant => ({...combatant, img: combatant.img?.replaceAll("'", "\\'")}))) ?? [],
      combatants: this.knownCombatants,
      quantity: 1,
      disposition: 1,
      dispositionSelect: {
        "-1": "EPFU.DIALOGS.TARGETSELECTOR.DISPOSITIONS.HOSTILE",
        0: "EPFU.DIALOGS.TARGETSELECTOR.DISPOSITIONS.NEUTRAL",
        1: "EPFU.DIALOGS.TARGETSELECTOR.DISPOSITIONS.FRIENDLY",
        2: "EPFU.DIALOGS.TARGETSELECTOR.DISPOSITIONS.SECRET"
      },
      buttons: [
        { icon: "fas fa-times", label: "Cancel", action: "cancel" },
        { icon: "fas fa-bullseye", label: "FU.Target", action: "target" }
      ]
    } as unknown as EmptyObject;
  }

}