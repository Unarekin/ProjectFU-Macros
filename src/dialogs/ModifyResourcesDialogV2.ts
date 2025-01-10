import { EmptyObject } from "Foundry-VTT/src/types/utils.mjs"
import { damageTypeSelect, hpOperationSelect, ignoreAffinitiesSelect, ipOperationSelect, mpOperationSelect, zpOperationSelect } from "./functions";

export class ModifyResourcesApplicationV2 extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  static PARTS = {
    tokenHeader: {
      template: "modules/erica-pfu-macros/templates/resources_dialog/token_header.hbs"
    },
    resourceOperations: {
      template: "modules/erica-pfu-macros/templates/resources_dialog/resource_operations.hbs"
    },
    footer: {
      template: "templates/generic/form-footer.hbs"
    }
  }

  static DEFAULT_OPTIONS = {
    tag: "form",
    classes: ["standard-form", "resources-form"],
    submitOnChange: false,
    closeOnSubmit: true,
    window: {
      title: "EPFU.MODIFYRESOURCES.TITLE",
      icon: "fas fa-heart-crack",
    },
    position: {
      width: 770
    }
  }

  protected async _prepareContext(options: { force?: boolean | undefined; position?: { top?: number | undefined; left?: number | undefined; width?: number | "auto" | undefined; height?: number | "auto" | undefined; scale?: number | undefined; zIndex?: number | undefined } | undefined; window?: { title?: string | undefined; icon?: string | false | undefined; controls?: boolean | undefined } | undefined; parts?: string[] | undefined; isFirstRender?: boolean | undefined }): Promise<EmptyObject> {
    const context = await super._prepareContext(options);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return {
      ...context,
      buttons: [
        {
          action: "cancel",
          icon: "fas fa-times",
          label: "EPFU.MODIFYRESOURCES.BUTTONS.CANCEL"
        },
        {
          action: "ok",
          icon: "fas fa-check",
          label: "EPFU.MODIFYRESOURCES.BUTTONS.OK"
        }
      ],
      ...hpOperationSelect(),
      ...mpOperationSelect(),
      ...ipOperationSelect(),
      ...zpOperationSelect(),
      ...damageTypeSelect(),
      ...ignoreAffinitiesSelect()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any
  }
}