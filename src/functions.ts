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