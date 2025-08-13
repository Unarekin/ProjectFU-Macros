import { coerceString } from "./coercion";
import { ProgressItem } from "./types";

/** Simple little wrapper function to handle optionally clamping a value */
function clamp(value: number, min: number, max: number, shouldClamp: boolean = true): number {
  return shouldClamp ? Math.min(Math.max(value, min), max) : value;
}

export function adjustProgressItem(item: ProgressItem, adjust: string | number, shouldClamp: boolean = true): ProgressItem {
  let adjustedAmount = 0;
  if (adjust === "0" || adjust === 0) {
    adjustedAmount = 0;
  } else if (typeof adjust === "number") {
    adjustedAmount = item.current + adjust;
  } else if (adjust === "max") {
    adjustedAmount = item.max;
  } else if (adjust === "step") {
    adjustedAmount = item.current + item.step;
  } else if (adjust === "-step") {
    adjustedAmount = item.current - item.step;
  } else if (typeof adjust === "undefined") {
    adjustedAmount = item.current + 1;
  }

  return {
    ...item,
    current: clamp(adjustedAmount, 0, item.max, shouldClamp)
  };
}


export function adjustResource(adjust: string | number, current: number, max: number, shouldClamp: boolean = true): number {
  if (typeof adjust === "number") return clamp(current + adjust, 0, max, shouldClamp);
  if (adjust === "max") return max;
  if (parseInt(adjust) === 0) return 0;
  if (adjust === "crisis") return Math.floor(max / 2);
  if (typeof adjust === "string" && adjust.trim()[0] === "=") return clamp(parseInt(adjust.trim().substring(1)), 0, max, shouldClamp);

  const parse = parseInt(adjust);
  if (isNaN(parse)) throw new Error(`Non-numeric value: ${coerceString(adjust)}`);
  return clamp(current + parse, 0, max, shouldClamp);
}

export function hasFlag(value: number, flag: number): boolean {
  return (value & flag) === flag;
}

export async function selectActor(): Promise<Actor | undefined> {
  const content = await foundry.applications.handlebars.renderTemplate(`modules/${__MODULE_ID__}/templates/actor-selector.hbs`, {
    actors: (game.actors?.contents ?? []).map(actor => ({ uuid: actor.uuid, name: actor.name }))
  });
  return new Promise<Actor | undefined>(resolve => {
    void foundry.applications.api.DialogV2.wait({
      window: {
        title: "EPFU.ACTORSELECT.TITLE",
        icon: "fa-solid fa-user"
      },
      content,
      buttons: [
        {
          type: "button",
          action: "cancel",
          label: "Cancel",
          icon: "fa-solid fa-times",
        },
        {
          type: "submit",
          action: "ok",
          label: "Confirm",
          icon: "fa-solid fa-check",
          callback: (e, button, dialog) => {
            const form = dialog.element.querySelector("form");
            if (form instanceof HTMLFormElement)
              return foundry.utils.expandObject((new foundry.applications.ux.FormDataExtended(form)).object);
          },
        },
      ],
      submit: (result) => {
        if (result === "cancel" || !result) resolve(undefined);

        const actor = fromUuidSync<Actor>((result as Record<string, string>).actorSelect);
        if (actor instanceof Actor) resolve(actor);
        resolve(undefined);
        return Promise.resolve();
      },
    })
  })
}