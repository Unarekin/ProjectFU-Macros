/***************************************************************************
 * Resource Modification Macro
 *
 * This macro will handle adjusting a token's HP, MP, and/or IP
 * When removing HP, it will respect the token's Damage Affinities, where
 * applicable.
 *
 * By Erica, adapted from a macro by Dark Magician Girl
 ***************************************************************************/

/**
 * Localization strings.  Should you want to translate the text displayed for this macro into another language, make changes here.
 */
// #region Localization
const LOCALIZATION = {
  MESSAGES: {
    NOUPDATES: "No updates to perform.",
  },
  NOLINKEDACTORCONFIRM: {
    TITLE: "Confirm",
    MESSAGE:
      "Are you sure you wish to add {name}?\nThis actor's token is not linked to the actor, and any changes made here will not be reflected on any tokens currently in the scene.",
  },
  DIALOG: {
    TITLE: "Modify Resources",
    LABELS: {
      RESOURCE: "{RESOURCE}:",
      ALLTOMAX: "Set {HP}/{MP}/{IP} To Max",
      BYPASSCLAMPING: "Bypass Value Clamping",
    },
    ADDTOKENS: {
      TITLE: "Add Token(s)",
      MESSAGE:
        "Please select one or more tokens in the scene, and hit 'Ok' when done.",
      BUTTONS: {
        OK: "Ok",
        CANCEL: "Cancel",
      },
    },
    BUTTONS: {
      OK: "Apply",
      CANCEL: "Cancel",
      INCREMENT: "Increment {RESOURCE}",
      DECREMENT: "Decrement {RESOURCE}",
      REMOVE: "Remove {NAME}",
      ADDTOKENS: "Add Token(s)",
    },
    OPERATIONS: {
      INCREASE: "Increase {RESOURCE} By:",
      DECREASE: "Decrease {RESOURCE} By:",
      TOMAX: "Set {RESOURCE} To Max",
      TOZERO: "Set {RESOURCE} To Zero",
      TOCRISIS: "Set {RESOURCE} To Crisis",
      ZPADVANCE: "Advance Zero Power Clock By:",
      ZPCLEAR: "Clear Zero Power Clock",
      TOVALUE: "Set {RESOURCE} To Value:",
      ZPTOVALUE: "Set Clock To:",
    },
  },
  RESOURCES: {
    HP: "HP",
    MP: "MP",
    IP: "IP",
    ZP: "Zero Power",
  },
  DAMAGETYPES: {
    PHYSICAL: "Physical",
    AIR: "Air",
    BOLT: "Bolt",
    DARK: "Dark",
    EARTH: "Earth",
    FIRE: "Fire",
    ICE: "Ice",
    LIGHT: "Light",
    POISON: "Poison",
    UNTYPED: "Untyped",
  },
  IGNOREAFFINITIES: {
    NONE: "Apply Damage Affinities",
    RESISTANCES: "Ignore Damage Resistance",
    RESISTANCESANDIMMUNITIES: "Ignore Damage Resistance and Immunity",
    ALL: "Ignore All Damage Affinities",
  },
  ERRORS: {
    NOTOKENS: "No token(s) selected.",
    UNKNOWNOPERATION: "Unknown {RESOURCE} operation: {OP}",
    INVALIDFIELD: "Invalid field: {FIELD}",
    INVALIDACTOR: "Invalid actor",
    INVALIDFOLDER: "Invalid folder",
  },
  WARNINGS: {
    ACTOREXISTS: "{NAME} already selected.",
  },
  INFO: {
    ACTORADDED: "{NAME} added to dialog.",
  },
  CHATCARD: {
    HEADER: "The following changes were made by {NAME}:",
    ZPREADY: "Ready!",
  },
};

/**
 * Handles substituting tokens in a localization string
 * @param {string} text - Localization string to be processed
 * @param {[string, string][]} subs - A two-dimensional array of strings, the 0th element of each entry representing a token to be replaced, and the 1st element the value.
 */
function localize(text, subs) {
  return subs.reduce(
    (prev, curr) => prev.replaceAll(`{${curr[0]}}`, curr[1]),
    text
  );
}

// #endregion

/***************************************************************************
 * Constants
 **************************************************************************/
// #region Constants
const PC_TYPE = "character";
const ZERO_POWER_TYPE = "projectfu.zeroPower";

const USE_DIALOGV2 = game.release.isNewer(12);
// const USE_DIALOGV2 = false;

const ZP_ENABLED = game.settings?.get("projectfu", "optionZeroPower") ?? false;

const DAMAGE_TYPES = [
  "physical",
  "air",
  "bolt",
  "dark",
  "earth",
  "fire",
  "ice",
  "light",
  "poison",
  "untyped",
];

/** Bit flag enum for bypassing affinities */
const IgnoreAffinity = {
  Resistances: 1 << 0, // 1
  Vulnerabilities: 1 << 1, // 2
  Immunities: 1 << 2, // 4
  Absorption: 1 << 3, // 8

  All: (1 << 4) - 1, // 15
};

const DIALOG_WIDTH = 710;
const DIALOGV2_WIDTH = 770;

// Kinda hacky, but will grab the major and minor version of the system (IE 2.4)
const SYSTEM_VERSION = parseFloat(game.system.version);

let DIALOG_PARENT_ELEMENT;

// #endregion

try {
  let selectedTokens = [];

  console.log(typeof args !== "undefined" ? args : undefined);

  if (typeof args === "object" && Array.isArray(args) && args.length) {
    if (args[0] === "all") {
      selectedTokens = canvas.scene.tokens.filter((token) => token.isOwner);
    } else {
      selectedTokens = args.reduce((prev, curr) => {
        // Check for UUID
        let actor = fromUuidSync(curr);
        // Check for actor id
        if (!actor) actor = game.actors.get(curr);
        // Check for token name
        if (!actor) actor = canvas.scene.tokens.getName(curr);
        // Check for token id
        if (!actor) actor = canvas.scene.tokens.get(curr);

        if (typeof actor.actor !== "undefined") actor = actor.actor;

        console.log("Actor:", actor);

        if (!actor) return prev;
        if (!actor.isOwner) return prev;
        const token = canvas.scene.tokens.contents.find(
          (doc) => doc.actor.id === actor.id
        );
        if (!token) return prev;
        return [...prev, token.object];
      }, []);
    }
  } else if (canvas.tokens.controlled.length) {
    selectedTokens = canvas.tokens.controlled.filter(
      (token) => token.actor?.isOwner
    );
  } else if (game.user.character) {
    selectedTokens = canvas.scene.tokens.find(
      (token) => token.actor?.id === game.user.character?.id
    );
  }

  console.log("Selected:", selectedTokens);
  // if (!selectedTokens.length) throw new Error(LOCALIZATION.ERRORS.NOTOKENS);

  /***************************************************************************
   * Templates
   **************************************************************************/

  // #region Templates

  const TOKEN_RESOURCE_TEMPLATE = `
  <tr>
    <td class="right resource-label"><strong>{{label}}</strong></td>
    <td>
      <div class="progress">
        <div class="back {{class}}">{{current}} / {{max}}</div>
        <div class="front" style="clip-path: inset(0 0 0 {{perc}}%);-webkit-clip-path: inset(0 0 0 {{perc}}%)">{{current}} / {{max}}</div>
      </div>
    </td>
  </tr>
  `;

  const TOKEN_ITEM_TEMPLATE = `
  {{#* inline "tokenResource"}}${TOKEN_RESOURCE_TEMPLATE}{{/inline}}
  <table class="token-item" data-token-id="{{token.id}}" data-actor-id="{{actor.id}}">
  {{#with actor}}
  <tr>
    <td rowspan="4" class="token-image" style="position:relative;">
      <i class="fas fa-circle-xmark remove-button" title="{{localize '${LOCALIZATION.DIALOG.BUTTONS.REMOVE}' NAME=this.name}}" data-operation="remove-token" data-index="{{index}}"></i>
      <img src="{{image}}">
    </td>
    <th colspan="2">{{name}}</th>
  </tr>
  {{> tokenResource hp class="hp" }}
  {{> tokenResource mp class="mp" }}
  {{#if isPC }}
    {{> tokenResource ip class="ip" }}
  {{ else }}
    <tr><td><br></td></tr>
  {{/if}}
  {{/with}}
</table>`;

  const TOKEN_HEADER_TEMPLATE = `
  {{#* inline "tokenItem"}}${TOKEN_ITEM_TEMPLATE}{{/inline}}
  <div class="flexrow token-header">
    {{#each actors}}
    {{> tokenItem this}}
    {{/each}}
  </div>
  <button data-action='add-tokens'>
    <i class="fas fa-plus"></i>
    ${LOCALIZATION.DIALOG.BUTTONS.ADDTOKENS}
  </button>
  `;

  /**
   * Generate a standardized option tag for a given resource operation.
   * @param {string} op
   * @param {string} resource
   * @param {number} value
   * @returns
   */
  function operationOption(op, resource, value) {
    return `<option value="${value}">${localize(
      LOCALIZATION.DIALOG.OPERATIONS[op],
      [["RESOURCE", resource]]
    )}</option>`;
  }

  function damageTypeOption(dmg) {
    return `<option value="${dmg.toLowerCase()}">${
      LOCALIZATION.DAMAGETYPES[dmg.toUpperCase()]
    }</option>`;
  }

  const HP_OPERATIONS_TEMPLATE = `
  <div class="flexrow" data-operation-row data-resource="hp">
    <div class="flexrow">
      <i class="fas fa-heart-crack hp resource-icon"></i>
      <select id="hpOperation" name="hpOperation" data-operation-type>
        ${operationOption("DECREASE", "HP", 0)}
        ${operationOption("INCREASE", "HP", 1)}
        ${operationOption("TOMAX", "HP", 2)}
        ${operationOption("TOZERO", "HP", 3)}
        ${operationOption("TOCRISIS", "HP", 4)}
        ${operationOption("TOVALUE", "HP", 5)}
      </select>
      <div></div>
    </div>
    <div class="flexrow">
      <input type="number" id="attributeHP" name="attributeHP" value="0" step="1" autofocus data-operation-value>
      <div>
        <select id="damageType" name="damageType" class="full-width">
        ${DAMAGE_TYPES.map(damageTypeOption).join("")}
        </select>
      </div>
      <div>
        <select id="ignoreAffinities" name="ignoreAffinities" class="full-width">
          <option value="0">${LOCALIZATION.IGNOREAFFINITIES.NONE}</option>
          <option value="1">${
            LOCALIZATION.IGNOREAFFINITIES.RESISTANCES
          }</option>
          <option value="5">${
            LOCALIZATION.IGNOREAFFINITIES.RESISTANCESANDIMMUNITIES
          }</option>
          <option value="15">${LOCALIZATION.IGNOREAFFINITIES.ALL}</option>
        </select>
      </div>
      <button class="num-button" data-operation="decrement" data-field="attributeHP" title="${localize(
        LOCALIZATION.DIALOG.BUTTONS.DECREMENT,
        [["RESOURCE", LOCALIZATION.RESOURCES.HP]]
      )}">-</button>
      <button class="num-button" data-operation="increment" data-field="attributeHP" title="${localize(
        LOCALIZATION.DIALOG.BUTTONS.INCREMENT,
        [["RESOURCE", LOCALIZATION.RESOURCES.HP]]
      )}">+</button>
    </div>
  </div>
  `;

  const MP_OPERATIONS_TEMPLATE = `
  <div class="flexrow" data-operation-row data-resource="mp">
    <div class="flexrow">
      <i class="fas fa-hat-wizard icon mp resource-icon"></i>
      <select id="mpOperation" name="mpOperation" data-operation-type>
          ${operationOption("DECREASE", "MP", 0)}
          ${operationOption("INCREASE", "MP", 1)}
          ${operationOption("TOMAX", "MP", 2)}
          ${operationOption("TOZERO", "MP", 3)}
          ${operationOption("TOVALUE", "MP", 5)}
      </select>
      <div></div>
    </div>
    <div class="flexrow">
      <input type="number" id="attributeMP" name="attributeMP" value="0" step="1" data-operation-value>
      <button class="num-button" data-operation="decrement" data-field="attributeMP" title="${localize(
        LOCALIZATION.DIALOG.BUTTONS.DECREMENT,
        [["RESOURCE", LOCALIZATION.RESOURCES.MP]]
      )}">-</button>
      <button class="num-button" data-operation="increment" data-field="attributeMP" title="${localize(
        LOCALIZATION.DIALOG.BUTTONS.INCREMENT,
        [["RESOURCE", LOCALIZATION.RESOURCES.MP]]
      )}">+</button>
    </div>
  </div>
  `;

  const IP_OPERATIONS_TEMPLATE = `
  <div class="flexrow" data-operation-row{{#if hasPC}}{{else}} style="display:none;"{{/if}} data-resource="ip">
    <div class="flexrow">
      <i class="ra ra-gear-hammer icon ip resource-icon"></i>
      <select id="ipOperation" name="ipOperation" data-operation-type>
        ${operationOption("DECREASE", "IP", 0)}
        ${operationOption("INCREASE", "IP", 1)}
        ${operationOption("TOMAX", "IP", 2)}
        ${operationOption("TOZERO", "IP", 3)}
        ${operationOption("TOVALUE", "IP", 5)}
      </select>
      <div></div>
    </div>
    <div class="flexrow">
      <input type="number" id="attributeIP" name="attributeIP" value="0" step="1" data-operation-value>
      <button class="num-button" data-operation="decrement" data-field="attributeIP" title="${localize(
        LOCALIZATION.DIALOG.BUTTONS.DECREMENT,
        [["RESOURCE", LOCALIZATION.RESOURCES.IP]]
      )}">-</button>
      <button class="num-button" data-operation="increment" data-field="attributeIP" title="${localize(
        LOCALIZATION.DIALOG.BUTTONS.INCREMENT,
        [["RESOURCE", LOCALIZATION.RESOURCES.IP]]
      )}">+</button>
    </div>
  </div>
  `;

  const ZP_OPERATIONS_TEMPLATE = `
  <div class="flexrow"{{#if hasZP}}{{else}} style="display:none;"{{/if}} data-resource="zp">
    <div class="flexrow">
      <i class="fas fa-bolt icon zp resource-icon"></i>
      <select id="zpOperation" name="zpOperation">
        <option value="0">${LOCALIZATION.DIALOG.OPERATIONS.ZPADVANCE}</option>
        <option value="1">${LOCALIZATION.DIALOG.OPERATIONS.ZPCLEAR}</option>
        <option value="5">${LOCALIZATION.DIALOG.OPERATIONS.ZPTOVALUE}</option>
      </select>
      <div></div>
    </div>
    <div class="flexrow">
      <input type="number" id="attributeZP" name="attributeZP" value="0" step="1" max="6" min="0">
      <button class="num-button" data-operation="decrement" data-field="attributeZP" title="${localize(
        LOCALIZATION.DIALOG.BUTTONS.DECREMENT,
        [["RESOURCE", LOCALIZATION.RESOURCES.ZP]]
      )}">-</button>
      <button class="num-button" data-operation="increment" data-field="attributeZP" title="${localize(
        LOCALIZATION.DIALOG.BUTTONS.INCREMENT,
        [["RESOURCE", LOCALIZATION.RESOURCES.ZP]]
      )}">+</button>
    </div>
  </div>
  `;

  const OPERATIONS_TEMPLATE = `
  {{#* inline "hpOperations"}}${HP_OPERATIONS_TEMPLATE}{{/inline}}
  {{#* inline "mpOperations"}}${MP_OPERATIONS_TEMPLATE}{{/inline}}
  {{#* inline "ipOperations"}}${IP_OPERATIONS_TEMPLATE}{{/inline}}
  {{#* inline "zpOperations"}}${ZP_OPERATIONS_TEMPLATE}{{/inline}}
  <div class="flexcol resource-options">
    {{> hpOperations }}
    {{> mpOperations }}
    {{> ipOperations }}
    {{> zpOperations }}
    <div class="flexrow">
      <div>
        <div class="resource-icon"></div>
        <div>
          <input type="checkbox" class="leftcheck" id="allToMax" name="allToMax" value="true"><label for="allToMax" class="checklabel">${localize(
            LOCALIZATION.DIALOG.LABELS.ALLTOMAX,
            [
              ["HP", LOCALIZATION.RESOURCES.HP],
              ["MP", LOCALIZATION.RESOURCES.MP],
              ["IP", LOCALIZATION.RESOURCES.IP],
            ]
          )}</label>
        </div>
      </div>
      <div>
        <div>
          <input type="checkbox" class="leftcheck" id="bypassClamping" name="bypassClamping" value="true"><label for="bypassClamping" class="checklabel">${
            LOCALIZATION.DIALOG.LABELS.BYPASSCLAMPING
          }</label>
        </div>
      </div>
    </div>
  </div>
  `;

  const DIALOG_TEMPLATE = `
  {{#* inline "tokenHeader"}}${TOKEN_HEADER_TEMPLATE}{{/inline}}
  {{#* inline "resourceOperations"}}${OPERATIONS_TEMPLATE}{{/inline}}
  
  <div id="resourcesForm" class="flexcol">
    <form>
    {{> tokenHeader this}}
    <hr>
    {{> resourceOperations this}}
    </form>
  </div>
  `;

  // Chat card templates
  const USER_CARD_FLAVOR_TEMPLATE = `
    <strong>${localize(LOCALIZATION.CHATCARD.HEADER, [
      ["NAME", game.users.current.name],
    ])}</strong>
    {{#if hasResourceUpdate}}
    <table>
      <tr>
        <th style="width:33%;text-align:center">${
          LOCALIZATION.RESOURCES.HP
        }</th>
        <th style="width:33%;text-align:center">${
          LOCALIZATION.RESOURCES.MP
        }</th>
        <th style="width:33%;text-align:center">{{#if isPC}}${
          LOCALIZATION.RESOURCES.IP
        }{{/if}}</th>
      </tr>
      <tr>
        <td style="text-align:center">{{#if hp}}{{hp.current}} → {{hp.new}}{{/if}}</td>
        <td style="text-align:center">{{#if mp}}{{mp.current}} → {{mp.new}}{{/if}}</td>
        <td style="text-align:center">{{#if ip}}{{ip.current}} → {{ip.new}}{{/if}}</td>
      </tr>
    </table>
    {{/if}}
    {{#if zp}}
    <br>
      <div style="text-align:center">
        <strong>{{zp.name}}</strong>
      </div>
      <br>
      <div class="flexrow">
        <div class="flex1"></div>
        <div class="projectfu flex1 flexrow">
          <div></div>
          <div class="progress-container">
            {{> "systems/projectfu/templates/optional/partials/feature-progress-clock.hbs" zp}}
          </div>
          <div></div>
        </div>
        <div class="flex1"></div>
      </div>
      {{#if zp.isReady}}
        <div class="detail-desc flexrow">
          <div>
            <label class="total default">
              <div></div>
              <div>${LOCALIZATION.CHATCARD.ZPREADY}</div>
              <div class="endcap gap-5"></div>
            </label>
          </div>
        </div>
      {{/if}}
    {{/if}}
  `;

  const USER_CARD_CONTENT_TEMPLATE = SYSTEM_VERSION >= 2.4 ? `` : ``;

  const GM_CARD_FLAVOR_TEMPLATE = `
  ${localize(LOCALIZATION.CHATCARD.HEADER, [["NAME", game.users.current.name]])}
  
  {{#each this}}
    <table>
      <tr>
        <th colspan="4" style="text-align:center">{{name}}</th>
      </tr>
      <tr>
        <td rowspan="5" style="max-width:53px;min-width:53px;width:53px;">
          <img src="{{img}}" style="width:48px;border:none">
        </td>
      </tr>
      {{#if hasResourceUpdate}}
        <tr>
          <th style="width:33%;text-align:center">${
            LOCALIZATION.RESOURCES.HP
          }</th>
          <th style="width:33%;text-align:center">${
            LOCALIZATION.RESOURCES.MP
          }</th>
          <th style="width:33%;text-align:center">${
            LOCALIZATION.RESOURCES.IP
          }</th>
        </tr>
        <tr>
          <td style="text-align:center">{{#if hp}}{{hp.current}} → {{hp.new}}{{/if}}</td>
          <td style="text-align:center">{{#if mp}}{{mp.current}} → {{mp.new}}{{/if}}</td>
          <td style="text-align:center">{{#if ip}}{{ip.current}} → {{ip.new}}{{/if}}</td>
        </tr>
      {{/if}}
      {{#if zp}}
        <tr>
          <th colspan="3" style="text-align:center">{{zp.name}}</th>
        </tr>
        <tr>
          <td colspan="3" style="text-align:center">{{zp.current}} → {{zp.new}}</td>
        </tr>
      {{/if}}
    </table>
  {{/each}}
  `;
  const GM_CARD_CONTENT_TEMPLATE = ``;

  const ADD_TOKEN_DIALOG_TEMPLATE = `
  <p>${LOCALIZATION.DIALOG.ADDTOKENS.MESSAGE}</p>
  <div data-role="token-names"></div>
  `;

  // #endregion

  const tokenItemRenderFunc = Handlebars.compile(TOKEN_ITEM_TEMPLATE);

  const renderFunc = Handlebars.compile(DIALOG_TEMPLATE);
  const userCardFlavorRenderFunc = Handlebars.compile(
    USER_CARD_FLAVOR_TEMPLATE
  );
  const userCardContentRenderFunc = Handlebars.compile(
    USER_CARD_CONTENT_TEMPLATE
  );

  const gmCardFlavorRenderFunc = Handlebars.compile(GM_CARD_FLAVOR_TEMPLATE);
  const gmCardContentRenderFunc = Handlebars.compile(GM_CARD_CONTENT_TEMPLATE);

  const addTokenRenderFunc = Handlebars.compile(ADD_TOKEN_DIALOG_TEMPLATE);

  // #region Helper Functions
  /***************************************************************************
   * Helper Functions
   **************************************************************************/

  /**
   * Returns true if a token is a PC type
   * @param {FUActor} actor
   * @returns {boolean}
   */
  function isPC(actor) {
    return actor.type === PC_TYPE;
  }

  /** Token resource functions  */
  /**
   * Retrieves current value of a resource (hp, mp, ip, etc) for a given token
   * @param {FUActor} actor
   * @param {string} resource
   * @returns {number}
   */
  function getResourceValue(actor, resource) {
    return actor.system.resources[resource].value;
  }

  /**
   * Retrieves the maximum value of a resource (hp, mp, ip, etc) for a given token.
   * @param {FUActor} actor
   * @param {string} resource
   * @returns {number}
   */
  function getResourceMax(actor, resource) {
    return actor.system.resources[resource].max;
  }

  /**
   * Retrieves the percentage (0-100) of a resource (hp, mp, ip, etc) for a given token.
   * @param {*} token
   * @param {*} resource
   * @returns
   */
  function getResourcePercentage(token, resource) {
    return Math.floor(
      (getResourceValue(token, resource) / getResourceMax(token, resource)) *
        100
    );
  }

  /**
   * Returns a standardized representation of a given resource, appropriate for passing to a render function context.
   * @param {Token} token
   * @param {string} resource
   */
  function getResourceContext(token, resource) {
    return {
      current: getResourceValue(token, resource),
      max: getResourceMax(token, resource),
      perc: getResourcePercentage(token, resource),
      label: LOCALIZATION.RESOURCES[resource.toUpperCase()],
    };
  }

  /** Zero Power functions  */

  /**
   * Returns a given actor's Zero Power, if applicable
   * @param {FUActor} actor}
   * @returns {object}
   */
  function getZeroPower(actor) {
    if (!ZP_ENABLED) return null;
    return actor.items?.find(
      (item) =>
        item.system?.optionalType === ZERO_POWER_TYPE ||
        item.type === "zeroPower"
    );
  }

  /**
   * Returns whether or not a given actor has a Zero Power
   * @param {FUActor} actor
   * @returns {boolean}
   */
  function hasZeroPower(actor) {
    return !!getZeroPower(actor);
  }

  /**
   * Determines if a Zero Power is from before powers were migrated to Optional Feature type
   * @param {FUItem} power
   */
  function isLegacyZeroPower(power) {
    return power.type === "zeroPower";
  }

  /**
   * Returns the current progress object for a Zero Power
   * @param {FUItem} power
   * @returns {{current: number, max: number, name: string, step: number}}
   */
  function getZeroPowerProgress(power) {
    if (isLegacyZeroPower(power)) return power.system.progress;
    else return power.system.data.progress;
  }

  /**
   * Returns the current number of sections of a Zero Power's clock that are filled
   * @param {FUItem} power
   * @returns {number}
   */
  function getZeroPowerProgressCurrent(power) {
    return getZeroPowerProgress(power)?.current;
  }

  /**
   * Returns the total number of sections a Zero Power's clock has.  This is probably 6.
   * @param {FUItem} power
   * @returns {number}
   */
  function getZeroPowerProgressMax(power) {
    return getZeroPowerProgress(power)?.max;
  }

  /**
   * Returns a trimmed down version of a Zero power item, appropriate for use in a rendering function context
   * @param {Item} power
   * @returns {object}
   */
  function getZeroPowerContext(power) {
    if (!power) return null;
    const isLegacy = isLegacyZeroPower(power);
    return {
      id: power.id,
      name: power.name,
      ...getZeroPowerProgress(power),
      // max: power.system.data.progress.max || 6,
      // current: power.system.data.progress.current || 0,
      image: power.img,
      trigger: {
        name: isLegacy
          ? power.system.zeroTrigger.value
          : power.system.data.zeroTrigger.value,
        desc: isLegacy
          ? power.system.zeroTrigger.description
          : power.system.data.zeroTrigger.description,
      },
      effect: {
        name: isLegacy
          ? power.system.zeroEffect.value
          : power.system.data.zeroEffect.value,
        desc: isLegacy
          ? power.system.zeroEffect.description
          : power.system.data.zeroEffect.description,
      },
    };
  }

  /**
   * Sets a clock to a given value, generally used for Zero Power clocks.
   * @param {FUActor} actor  The actor who owns the item with which the clock is associated
   * @param {FUItem} item The item containing the clock
   * @param {number} value The value to which to set the clock.  Will be clamped from 0-[max value for clock]
   */
  async function setClockTo(actor, item, value) {
    const max = getZeroPowerProgressMax(item);
    const actual = clamp(value, 0, max);

    if (isLegacyZeroPower(item)) {
      await actor.updateEmbeddedDocuments("Item", [
        {
          _id: item.id,
          system: { progress: { current: actual } },
        },
      ]);
    } else {
      await actor.updateEmbeddedDocuments("Item", [
        {
          _id: item.id,
          system: { data: { progress: { current: actual } } },
        },
      ]);
    }
    return actual;
  }

  /**
   * Advances a clock by a given amount.  Generally used for Zero Power clocks.
   * @param {FUActor} actor
   * @param {FUItem} item The item containing the clock.
   * @param {number} amount The amount by which to advance this clock.  Will be clamped from 0-[max value for clock]
   * @returns {Promise<number>} A promise that resolves to the new value of this clock.
   */
  async function advanceClock(actor, item, amount) {
    return setClockTo(actor, item, item.system.data.progress.current + amount);
  }

  /**
   * Sets a clock's progress to 0.  Generally used for Zero Power clocks.
   * @param {number} actorId
   * @param {FUItem} item The item containing the clock to reset.
   * @returns {Promise<number>} A promise that resolves to the new value of this clock
   */
  async function clearClock(actor, item) {
    return setClockTo(actor, item, 0);
  }

  /**
   * Returns a modified representation of ag iven actor, appropriate for passing to the dialog render function context.
   * @param {FUActor} actor
   */
  function getActorContext(actor) {
    return {
      id: actor.id,
      name: actor.name,
      image: actor.img,
      isPC: isPC(actor),
      hasZeroPower: hasZeroPower(actor),
      zeroPower: getZeroPowerContext(getZeroPower(actor)),
      hp: getResourceContext(actor, "hp"),
      mp: getResourceContext(actor, "mp"),
      ...(isPC(actor) ? { ip: getResourceContext(actor, "ip") } : {}),
    };
  }

  function getTokenContext(token) {
    return {
      token: {
        id: token.id,
        name: token.name,
      },
      actor: getActorContext(token.actor),
    };
  }

  function iterateElements(html, ids, callback) {
    html.find(ids.map((id) => `#id`)).each(callback);
  }

  function getSelectValue(html, id) {
    return html.find(`#${id}`).val();
  }

  function getOperationElements(elem) {
    const parent = elem.parents("[data-operation-row]");
    return [
      parent,
      parent.find("[data-operation-type]"),
      parent.find("[data-operation-value]"),
    ];
  }

  function reconcileOperationRowDisabled(row) {
    const op = parseInt(row.find("[data-operation-type]").val());
    const elems = row.find("input, select:not([data-operation-type]), button");
    if (op > 1 && op !== 5) elems.attr("disabled", "disabled");
    else elems.removeAttr("disabled");
  }

  function coerceFormField(value) {
    if (!isNaN(parseFloat(value))) return parseFloat(value);
    if (value === "true") return true;
    if (value === "false") return false;
    if (value === "on") return true;

    return value;
  }

  /**
   * Creates an object representing our form data
   * @param {JQuery<HTMLElement>} html
   */
  function parseFormData(form) {
    return Object.fromEntries(
      form
        .serializeArray()
        .map(({ name, value }) => [name, coerceFormField(value)])
    );
  }

  function setResourceUpdate(actor, resource, value, update) {
    if (getResourceValue(actor, resource) !== value) update[resource] = value;
    return update;
  }

  function setMaxResourceUpdate(actor, resource, update) {
    return setResourceUpdate(
      actor,
      resource,
      getResourceMax(actor, resource),
      update
    );
  }

  /**
   * Quick way to set an update for adding to a resource
   * @param {FUActor} actor
   * @param {string} resource
   * @param {number} amount
   * @param {boolean} shouldClamp
   * @param {object} update
   * @returns
   */
  function setAddResourceUpdate(actor, resource, amount, shouldClamp, update) {
    return setResourceUpdate(
      actor,
      resource,
      shouldClamp
        ? clamp(
            getResourceValue(actor, resource) + amount,
            0,
            getResourceMax(actor, resource)
          )
        : getResourceValue(actor, resource) + amount,
      update
    );
  }

  /**
   * Quick way to set an update for subtracting from a resource
   * @param {FUActor} actor
   * @param {string} resource
   * @param {number} amount
   * @param {object} update
   * @returns
   */
  function setSubResourceUpdate(actor, resource, amount, shouldClamp, update) {
    return setResourceUpdate(
      actor,
      resource,
      shouldClamp
        ? clamp(
            getResourceValue(actor, resource) - amount,
            0,
            getResourceMax(actor, resource)
          )
        : getResourceValue - amount,
      update
    );
  }

  /**
   * Quick & easy function to clamp a value within two values
   * @param {number} val The value to clamp
   * @param {number} min Minimum value
   * @param {number} max Maximum value
   * @returns
   */
  function clamp(val, min, max) {
    return Math.max(min, Math.min(val, max));
  }

  /**
   * Boilerplate updates for every resource type
   * @param {FUActor} actor
   * @param {*} resource
   * @param {*} op
   * @param {*} amount
   * @param {*} clamp
   * @param {*} update
   * @returns
   */
  function handleStandardResourceUpdates(
    actor,
    resource,
    op,
    amount,
    clamp,
    update
  ) {
    switch (op) {
      case 0:
        // Decrease
        break;
      case 1:
        // Increase
        setAddResourceUpdate(actor, resource, amount, clamp, update);
        break;
      case 2:
        // To max
        setMaxResourceUpdate(actor, resource, update);
        break;
      case 3:
        // To zero
        setResourceUpdate(actor, resource, 0, update);
        break;
      case 5:
        // Set to value
        setResourceUpdate(actor, resource, amount, update);
    }
    return update;
  }

  /**
   * Determine if a given value matches a set of flags.
   * @param {number} value The value we are checking
   * @param {number} flag The flag we are checking for
   */
  function hasFlag(value, flag) {
    return (value & flag) === flag;
  }

  /**
   * Retrieves an affinity for a given damage type on a given token's actor.
   * -1 = Vulnerable
   *  0 = None
   *  1 = Resistance
   *  2 = Immunity
   *  3 = Absorption
   * @param {FUActor} actor
   * @param {string} damageType
   * @returns
   */
  function getAffinity(actor, damageType) {
    return actor.system?.affinities[damageType]?.current || 0;
  }

  /**
   * Calculates the actual damage to apply to a token, given their Damage Affinities and
   * our specified affinity bypasses, if any
   * @param {FUActor} actor
   * @param {object} formdata
   */
  function calculateEffectiveDamage(actor, formData) {
    if (formData.hpOperation !== 0) return 0;
    const amount = formData.attributeHP;

    const affinity = getAffinity(actor, formData.damageType);
    // If no affinity, no math
    if (affinity === 0) return amount;

    const ignoreAffinities = formData.ignoreAffinities;

    // If we're ignoring affinities, just ... return
    if (hasFlag(ignoreAffinities, IgnoreAffinity.All)) return amount;

    switch (affinity) {
      case -1:
        // VU
        if (hasFlag(ignoreAffinities, IgnoreAffinity.Vulnerabilities))
          return amount;
        else return amount * 2;
      case 1:
        // RS
        if (hasFlag(ignoreAffinities, IgnoreAffinity.Resistances))
          return amount;
        else return Math.floor(amount / 2);
      case 2:
        // IM
        if (hasFlag(ignoreAffinities, IgnoreAffinity.Immunities)) return amount;
        else return 0;
      case 3:
        // AB
        if (hasFlag(ignoreAffinities, IgnoreAffinity.Absorption)) return amount;
        else return -1 * amount;
    }
  }

  /**
   * Coerces a simplified update object that's generated during form processing into
   * the format that an actor update expects
   * @param {object} update
   */
  function convertUpdateObject(update) {
    const newUpdate = {};
    if (typeof update.hp !== "undefined")
      newUpdate[`system.resources.hp.value`] = update.hp;
    if (typeof update.mp !== "undefined")
      newUpdate[`system.resources.mp.value`] = update.mp;
    if (typeof update.ip !== "undefined")
      newUpdate["system.resources.ip.value"] = update.ip;

    return newUpdate;
  }

  /**
   * Retrieves an object to pass to the chat card templates
   * @param {FUActor} actor
   * @param {object} update
   */
  function getUpdateContext(actor, update) {
    const context = {
      name: actor.name,
      img: actor.img,
      actor,
      isPC: isPC(actor),
      hasResourceUpdate:
        update.hp !== undefined ||
        update.mp !== undefined ||
        update.ip !== undefined,
    };
    if (update.hp !== undefined)
      context.hp = { current: getResourceValue(actor, "hp"), new: update.hp };
    if (update.mp !== undefined)
      context.mp = { current: getResourceValue(actor, "mp"), new: update.mp };
    if (update.ip !== undefined)
      context.ip = { current: getResourceValue(actor, "ip"), new: update.ip };
    return context;
  }

  /**
   * Retrieves an object to pass to the chat card templates for a zero power's update.
   * @param {FUItem} zeroPower Item representing the Zero Power
   * @param {number} oldValue Old value of the Zero Power's clock
   * @param {number} newValue New value of the Zero Power's clock
   * @returns
   */
  function getZeroPowerUpdateContext(zeroPower, oldValue, newValue) {
    if (oldValue === newValue) return {};

    // const progressArr = Array.isArray(zeroPower.progressArr)
    //   ? zeroPower.progressArr.map((arg) => ({
    //       id: arg.id,
    //       checked: arg.id === newValue,
    //     }))
    //   : new Array(6).fill(0).map((_, i) => ({
    //       id: i,
    //       checked: i === newValue,
    //     }));

    const max = getZeroPowerProgressMax(zeroPower);

    return {
      zp: {
        name: zeroPower.name,
        current: oldValue,
        max,
        isReady: newValue === max,
        new: newValue,
        // arr: progressArr,
        data: {
          max,
        },
      },
    };
  }

  /**
   * Gets a user that has this actor as their character
   * @param {FUActor} actor
   */
  function getTokenPlayer(actor) {
    return game.users.contents.find((user) => user.character?.id === actor.id);
  }

  /**
   * Short-hand to call a Dialog or DialogV2 confirmation .... dialog
   * @param {string} title
   * @param {string} content
   * @returns
   */
  function showConfirmationDialog(title, content, modal) {
    if (USE_DIALOGV2) {
      return foundry.applications.api.DialogV2.confirm({
        window: { title },
        content,
        modal: !!modal,
      });
    } else {
      return dialog.confirm({
        content,
        title,
      });
    }
  }

  function addSelectedTokenNamesToDialog(elem) {
    elem.find("[data-role='token-names']").text(
      canvas.tokens.controlled
        .sort(tokenSorter)
        .map((token) => token.name)
        .join(", ")
    );
  }

  async function addTokensClickHandler() {
    let HookID;
    try {
      let dialogElement;
      HookId = Hooks.on("controlToken", (token, selected) => {
        addSelectedTokenNamesToDialog(dialogElement);
      });

      const confirm = await (USE_DIALOGV2
        ? foundry.applications.api.DialogV2.wait({
            window: { title: LOCALIZATION.DIALOG.ADDTOKENS.TITLE },
            content: addTokenRenderFunc(),
            render: (e, elem) => {
              dialogElement = $(elem);
              addSelectedTokenNamesToDialog($(elem));
            },
            buttons: [
              {
                label: `<i class="fas fa-times"></i> ${LOCALIZATION.DIALOG.ADDTOKENS.BUTTONS.CANCEL}`,
                action: "cancel",
              },
              {
                label: `<i class="fas fa-check"></i> ${LOCALIZATION.DIALOG.ADDTOKENS.BUTTONS.OK}`,
                action: "ok",
              },
            ],
          })
        : Dialog.wait({
            title: LOCALIZATION.DIALOG.ADDTOKENS.TITLE,
            content: addTokenRenderFunc(),
            onRender(html) {
              dialogElement = html;
              addSelectedTokenNamesToDialog(html);
            },
            buttons: {
              cancel: {
                label: LOCALIZATION.DIALOG.ADDTOKENS.BUTTONS.CANCEL,
                icon: "<i class='fas fa-times'></i>",
                callback: () => "cancel",
              },
              ok: {
                icon: "<i class='fas fa-check'></i>",
                label: LOCALIZATION.DIALOG.ADDTOKENS.BUTTONS.OK,
                callback: () => "ok",
              },
            },
          }));

      if (confirm === "cancel") return;

      for (const token of canvas.tokens.controlled) {
        addActorToDialog(
          token.actor,
          DIALOG_PARENT_ELEMENT.find(".token-header"),
          true
        );
      }
    } finally {
      Hooks.off("controlToken", HookID);
    }
  }

  /**
   * Sorts tokens.  PCs, then NPCs, then by name.
   * @param {*} a
   * @param {*} b
   * @returns
   */
  function tokenSorter(a, b) {
    if (a.actor.type === "character" && b.actor.type === "npc") return -1;
    else if (a.actor.type === "npc" && b.actor.type === "character") return 1;
    else return a.name.localeCompare(b.name);
  }

  // #endregion

  // #region DragDrop
  const dragDrop = new DragDrop({
    dropSelector: ".token-header",
    callbacks: {
      drop: async (e) => {
        const data = TextEditor.getDragEventData(e);

        if (data.type === "Actor") {
          const actor = await fromUuid(data.uuid);
          if (!actor) throw new Error(LOCALIZATION.ERRORS.INVALIDACTOR);
          if (actor.isOwner) {
            addActorToDialog(actor, e.target);
          }
        } else if (data.type === "Folder") {
          const folder = await fromUuid(data.uuid);
          if (!folder) throw new Error(LOCALIZATION.ERRORS.INVALIDFOLDER);
          const actors = folder.contents.filter(({ isOwner }) => isOwner);
          for (const actor of actors) addActorToDialog(actor, e.target);
        }
      },
    },
  });

  /**
   * Retrieves IDs of the tokens for each element present in the dialog
   * @param {*} html
   * @returns
   */
  function getSelectedTokenIds(html) {
    return html
      .find("[data-token-id]:not([data-token-id=''])")
      .toArray()
      .map((elem) => elem.dataset.tokenId);
  }

  /**
   * Returns tokens for each element currently present in the dialog
   * @param {*} html
   * @returns
   */
  function getSelectedTokens(html) {
    return html
      .find("[data-token-id]:not([data-token-id=''])")
      .toArray()
      .map((elem) => canvas.tokens.get(elem.dataset.tokenId));
  }

  function getSelectedActors(html) {
    return html
      .find(`[data-actor-id]:not([data-actor-id=''])`)
      .toArray()
      .map((elem) => game.actors.get(elem.dataset.actorId));
  }

  function getSelectedActorIds(html) {
    return html
      .find(`[data-actor-id]:not([data-actor-id=''])`)
      .toArray()
      .map((elem) => elem.dataset.actorId);
  }

  function isTokenInDialog(html, token) {
    return getSelectedTokens(html).includes(token);
  }

  function isActorInDialog(html, actor) {
    return getSelectedActors(html).includes(actor);
  }

  /**
   * Injects an actor token header to the dialog.
   * @param {FUActor} actor
   * @param {JQuery<HTMLElement>} elem
   */
  async function addActorToDialog(actor, elem, fromToken) {
    console.log("Adding actor:", actor, elem[0]);
    const html = $(elem).parents("#resourcesForm").find(".token-header");

    if (isActorInDialog(html, actor)) {
      ui.notifications.warn(
        localize(LOCALIZATION.WARNINGS.ACTOREXISTS, [["NAME", actor.name]])
      );
      return;
    }

    // Prompt the user to make sure we want to edit tokens without linked actors,
    // since these are likely NPCs meant to be duplicated and should probably
    // be edited from the token, rather than the actor library.
    if (!fromToken && !actor.prototypeToken.actorLink) {
      const confirm = await showConfirmationDialog(
        LOCALIZATION.NOLINKEDACTORCONFIRM.TITLE,
        `<p>${localize(LOCALIZATION.NOLINKEDACTORCONFIRM.MESSAGE, [
          ["name", actor.name],
        ])}</p>`.replaceAll("\n", "<br>\n"),
        true
      );
      if (!confirm) return;
    }

    const content = tokenItemRenderFunc({
      token: { id: "", name: "" },
      actor: getActorContext(actor),
    });

    html.append(content);
    const appended = html.find(".token-item:last-child");

    appended.find("[data-operation='remove-token']").on("click", function (e) {
      e.preventDefault();
      handleRemoveButtonClick(this);
    });

    html
      .parents(".window-content")
      .find(".form-footer button[data-action='ok']")
      .removeAttr("disabled");
    appended.hide().fadeIn();

    showOrHidePCRows(html.parents("#resourcesForm"));
  }

  function showPCRows(html) {
    html.find("[data-resource='ip'],[data-resource='zp']").fadeIn();
  }

  function hidePCRows(html) {
    html.find("[data-resource='ip'],[data-resource='zp']").fadeOut();
  }

  function showOrHidePCRows(html) {
    const hasPC = getSelectedActors(html).some(isPC);
    if (hasPC) showPCRows(html);
    else hidePCRows(html);
  }

  function handleRemoveButtonClick(button) {
    const html = $(button).parents("#resourcesForm");
    const count = getSelectedActorIds(html).length;
    if (count <= 1) {
      $(button)
        .parents(".window-content")
        .find(".form-footer button[data-action='ok']")
        .attr("disabled", "disabled");
    }

    const removingId = $(button).parents(".token-item").data("actor-id");
    const hasPCs = getSelectedActors(html).some(
      (actor) => actor.id !== removingId && isPC(actor)
    );
    if (!hasPCs) hidePCRows(html);

    $(button)
      .parents(".token-item")
      .fadeOut(function () {
        $(this).remove();
      });
  }

  // #endregion

  /***************************************************************************
   * Dialog
   **************************************************************************/
  // #region Dialog

  /**
   * Handles wiring up event listeners for form reactivity
   * @param {JQuery<HTMLElement> html
   */
  function onRender(html) {
    dragDrop.bind(html[0]);

    html.find("[data-action='add-tokens']").on("click", (e) => {
      e.preventDefault();
      addTokensClickHandler();
    });

    html.find("input[type='number']").first().select();

    html.find("input").on("keydown", (e) => {
      if (e.which === 13) {
        e.preventDefault();
        html.find(".form-footer [data-action='ok']").trigger("click");
      }
    });

    // Set number fields to select their contents on focus
    html.find(`input[type="number"]`).on("focus", (e) => {
      e.target.select();
    });

    // Set up remove token buttons
    html.find("[data-operation='remove-token']").on("click", function (e) {
      e.preventDefault();
      handleRemoveButtonClick(this);
    });

    // Handle increment and decrement buttons
    html.find(`[data-operation="increment"]`).on("click", (e) => {
      e.preventDefault();

      const field = e.currentTarget.dataset["field"];
      if (!field)
        throw new Error(
          localize(LOCALIZATION.ERRORS.INVALIDFIELD, [["FIELD", field]])
        );

      const input = html.find(`#${field}`);
      const step = parseFloat(input.attr("step") ?? 1);
      input.val(parseFloat(input.val()) + step);
    });

    html.find(`[data-operation="decrement"]`).on("click", (e) => {
      e.preventDefault();

      const field = e.currentTarget.dataset["field"];
      if (!field)
        throw new Error(
          localize(LOCALIZATION.ERRORS.INVALIDFIELD, [["FIELD", field]])
        );

      const input = html.find(`#${field}`);
      const step = parseFloat(input.attr("step") ?? 1);
      input.val(parseFloat(input.val()) - step);
    });

    // Set operation drop-downs to swap between increase and decrease
    // if their respective value number field is negative
    html.find("[data-operation-value]").on("change", (e) => {
      const [, op, elem] = getOperationElements($(e.target));

      const val = parseInt(elem.val());
      if (val < 0) {
        elem.val(Math.abs(val));
        op.val(op.val() === "0" ? "1" : "0").change();
      }
    });

    // Disable input fields if operation set to anything but increase/decrease
    html.find("[data-operation-type").on("change", (e) => {
      reconcileOperationRowDisabled(
        $(e.target).parents("[data-operation-row]")
      );
    });

    // Disable hp, mp, ip inputs when set to max
    html.find("#allToMax").on("change", (e) => {
      const elem = $(e.target);
      const checked = elem.is(":checked");
      if (checked) {
        html
          .find(
            "[data-operation-row] input, [data-operation-row] select, [data-operation-row] button"
          )
          .attr("disabled", "disabled");
      } else {
        html.find("[data-operation-row]").each(function () {
          $(this).find("[data-operation-type]").removeAttr("disabled");
          reconcileOperationRowDisabled($(this));
        });
      }
    });
  }

  /**
   *
   * @param {FUActor} actor
   * @param {object} formData
   * @returns {[object, object]}
   */
  function handleSubmitForActor(actor, formData) {
    let update = {};
    let updateContext = {};

    // Base resources
    if (formData.allToMax) {
      setMaxResourceUpdate(actor, "hp", update);
      setMaxResourceUpdate(actor, "mp", update);
      if (isPC(actor)) setMaxResourceUpdate(actor, "ip", update);
    } else {
      handleStandardResourceUpdates(
        actor,
        "hp",
        formData.hpOperation,
        formData.attributeHP,
        !formData.bypassClamping,
        update
      );
      handleStandardResourceUpdates(
        actor,
        "mp",
        formData.mpOperation,
        formData.attributeMP,
        !formData.bypassClamping,
        update
      );
      if (isPC(actor)) {
        handleStandardResourceUpdates(
          actor,
          "ip",
          formData.ipOperation,
          formData.attributeIP,
          !formData.bypassClamping,
          update
        );

        if (formData.ipOperation === 0)
          setSubResourceUpdate(
            actor,
            "ip",
            formData.attributeIP,
            !formData.bypassClamping,
            update
          );
      }

      if (formData.mpOperation === 0)
        setSubResourceUpdate(
          actor,
          "mp",
          formData.attributeMP,
          !formData.bypassClamping,
          update
        );

      // Damage
      if (formData.hpOperation === 0)
        setSubResourceUpdate(
          actor,
          "hp",
          calculateEffectiveDamage(actor, formData),
          !formData.bypassClamping,
          update
        );
      // Crisis
      else if (formData.hpOperation === 4)
        setResourceUpdate(
          actor,
          "hp",
          Math.floor(getResourceValue(actor, "hp") / 2),
          update
        );
    }

    updateContext = {
      ...updateContext,
      ...getUpdateContext(actor, update),
    };

    // Zero powers
    const zeroPower = getZeroPower(actor);
    if (zeroPower) {
      const { current: oldValue, max } = getZeroPowerProgress(zeroPower);

      let newValue = oldValue;
      switch (formData.zpOperation) {
        case 0:
          // Advance
          newValue = clamp(oldValue + formData.attributeZP, 0, max);
          break;
        case 1:
          // Clear
          newValue = 0;
          break;
        case 5:
          // Set to
          newValue = clamp(formData.attributeZP, 0, max);
          break;
      }

      if (newValue !== oldValue) {
        setClockTo(actor, zeroPower, newValue).catch((err) => {
          throw err;
        });

        updateContext = {
          ...updateContext,
          ...getZeroPowerUpdateContext(zeroPower, oldValue, newValue),
        };
      }
    }

    return [update, updateContext];
  }

  /**
   * Apply
   * @param {JQuery<HTMLElement>}  html
   */
  async function onSubmit(html) {
    const formData = parseFormData(html);

    // Bit of a special case.  Rather than forcefully swapping the operation when adjusting
    // the value by increment/decrement buttons, we swap it here because decreasing HP should
    // apply damage affinities, and we don't want to miss that if we're increasing by a
    // negative value
    if (formData.attributeHP < 0) {
      if (formData.hpOperation === 0) {
        formData.hpOperation = 1;
        formData.attributeHP = Math.abs(formData.attributeHP);
      } else if (formData.hpOperation === 1) {
        formData.hpOperation = 0;
        formData.attributeHP = Math.abs(formData.attributeHP);
      }
    }

    // const tokenElements = html.find("[data-actor-id");
    // console.log(tokenElements.toArray().map(elem => [elem.dataset.tokenId, elem.dataset.actorId]));

    const itemsToUpdate = html
      .find("[data-actor-id]")
      .toArray()
      .map((elem) => ({
        token: canvas.scene.tokens.get(elem.dataset.tokenId),
        actor: elem.dataset.tokenId
          ? canvas.scene.tokens.get(elem.dataset.tokenId).actor
          : game.actors.get(elem.dataset.actorId),
      }));

    const updates = [];
    const updateContexts = [];

    for (const { actor } of itemsToUpdate) {
      const [update, updateContext] = handleSubmitForActor(actor, formData);

      if (updateContext.hasResourceUpdate || updateContext.zp) {
        updateContexts.push(updateContext);
        if (updateContext.hasResourceUpdate) {
          updates.push(update);
          update["actor"] = actor;
        }
      }
    }

    if (updateContexts.length) {
      // Notify GM(s)
      const gms = game.users.filter(({ isGM }) => isGM);
      for (const gm of gms) {
        ChatMessage.create({
          user: game.users.current,
          whisper: [gm],
          flavor: gmCardFlavorRenderFunc(updateContexts),
          content: gmCardContentRenderFunc(updateContexts),
        }).catch((err) => {
          throw err;
        });
      }

      // Notify players
      for (const updateContext of updateContexts) {
        const player = getTokenPlayer(updateContext.actor);
        if (player && !player.isSelf) {
          ChatMessage.create({
            speaker: {
              actor: updateContext.actor.id,
            },
            user: player,
            whisper: [player],
            flavor: userCardFlavorRenderFunc(updateContext),
            content: userCardContentRenderFunc(updateContext),
          }).catch((err) => {
            throw err;
          });
        }
      }
    }

    if (updates.length) {
      await Promise.all(
        updates.map((update) =>
          update.actor.update(convertUpdateObject(update))
        )
      );
    } else if (updateContexts.length === 0) {
      ui.notifications.info(LOCALIZATION.MESSAGES.NOUPDATES);
    }
  }

  const RENDER_CONTEXT = {
    actors: selectedTokens.sort(tokenSorter).map(getTokenContext),
    hasPC: selectedTokens.some(({ actor }) => isPC(actor)),
    hasZP: selectedTokens.some(({ actor }) => hasZeroPower(actor)),
  };

  if (USE_DIALOGV2) {
    const dialog = new foundry.applications.api.DialogV2({
      window: {
        title: LOCALIZATION.DIALOG.TITLE,
        resizable: true,
      },
      classes: ["resourcesForm"],
      content: renderFunc(RENDER_CONTEXT),
      position: {
        width: DIALOGV2_WIDTH,
      },
      buttons: [
        {
          action: "cancel",
          label: `<i class="fas fa-times"></i> ${LOCALIZATION.DIALOG.BUTTONS.CANCEL}`,
        },
        {
          action: "ok",
          label: `<i class="fas fa-check"></i> ${LOCALIZATION.DIALOG.BUTTONS.OK}`,
          callback: async (event, button, dialog) => $(dialog).find("form"),
        },
      ],
      submit: (val) => {
        if (val !== "cancel") return onSubmit(val);
      },
    });

    await dialog.render({ force: true });
    DIALOG_PARENT_ELEMENT = $(dialog.element);
    onRender($(dialog.element), dialog);
  } else {
    new Dialog(
      {
        title: LOCALIZATION.DIALOG.TITLE,
        content: renderFunc(RENDER_CONTEXT),
        default: "ok",
        render: (html) => {
          DIALOG_PARENT_ELEMENT = html;
          onRender(html);
        },
        buttons: {
          cancel: {
            icon: `<i class="fas fa-times"></i>`,
            label: LOCALIZATION.DIALOG.BUTTONS.CANCEL,
          },
          ok: {
            icon: `<i class="fas fa-check"></i>`,
            label: LOCALIZATION.DIALOG.BUTTONS.OK,
            callback: async (html) => {
              await onSubmit(html.find("form"));
            },
          },
        },
      },
      {
        resizable: true,
        width: DIALOG_WIDTH,
      }
    ).render(true);
  }
  // #endregion
} catch (err) {
  ui.notifications?.error(err.message);
  console.error(err);
}
