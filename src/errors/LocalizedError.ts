
export class LocalizedError extends Error {
  constructor(key: string, args: Record<string, string> = {}) {
    if (key) super(game?.i18n?.format(`EPFU.ERRORS.${key}`, args));
    else super();
  }
}