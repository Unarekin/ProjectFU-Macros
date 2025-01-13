![GitHub License](https://img.shields.io/github/license/Unarekin/ProjectFU-Macros)
![GitHub package.json version](https://img.shields.io/github/package-json/v/Unarekin/ProjectFU-Macros)

# Project FU Macros
This is a compendium module to contain several macros I've written intended for use with the [Project FU](https://github.com/League-of-Fabulous-Developers/FoundryVTT-Fabula-Ultima) system for FoundryVTT.

# Installation Instructions
To install this module, open the "Install Add-on" window in Foundry, and paste the following URL in the "Manifest" text box at the bottom:
```
https://github.com/Unarekin/ProjectFU-Macros/releases/latest/download/module.json
```

# Macros Included

## MATT Macros
There is a set of macros in a folder in the comendium labeled "MATT" that are intended for use with [Monk's Active Tile Triggers](https://foundryvtt.com/packages/monks-active-tiles/) via the "Run Macro" action.  These macros are very handy for using tiles as part of a fancy JRPG-style GUI, with buttons to click to advance Zero Power clocks, automatically apply damage, reset everyone to full, etc.

Full instructions for their use can be found in the [wiki](https://github.com/Unarekin/ProjectFU-Macros/wiki/MATT-Macros).

## Resource Modification Dialog
This macro initially grew from a desire for an earlier damage application dialog macro written by one of the PFU developers -- Dark Magician Girl / spyrella -- to allow for applying damage to tokens/actors while respecting their Damage Affinities.

It's a fairly large macro, weighing in at just under 2,000 lines of code, and handles a number of different tasks -- Applying damage, increasing/decreasing MP and/or IP, setting these resources to their maximum value, 0, an arbitrary value, etc.  It even handles a few things related to editing characters' Zero Power clocks, if applicable.

> [!NOTE]  
> Right now, this macro is just a verbatim copy of the original macro, which is fully self-contained with dialog templates, stylesheets, every operation and even compatibility code to handle older versions of PFU, as the current release branch -- 2.4 -- was still in testing when this macro was developed.
> 
> In the future, this macro will be properly split into several files for better organization and maintainability.  But that is a rather non-trivial amount of work to do and will take a little while.


Full instructions on its  use can be found in the [wiki](https://github.com/Unarekin/ProjectFU-Macros/wiki/Resource-Modification-Macro)


# Super Secret Bonus Functionality
There are several functions that are exposed outside of the module to handle common functionality that each macro uses, and which you may find useful in writing your own macros.  These functions can be found on a global object -- `EricaPFU`.

They include:
- adjustProgressItem - A function intended to advance/set an Item that has an associated progress with it, which includes Zero Power abilities as well as Misc Abilities with an associated Resource value.
- adjustResource - A function to generically handle adjusting HP, MP, or IP
- findZeroPower - Attempts to locate a Zero Power on an actor.  Will return the *first* such item found, even if there are multiple.
Additionally, there are a few functions that attempt to "coerce" particular data types.  This is a common tactic I have used to try and take several different forms of input and intelligently determine an associated object, such as an Actor or an Item.  These functions are:
- coerceActor - Will take an input and try to determine an Actor that it refers to.  This input could be an id, UUID, name, the Actor object itself
- coerceItem - As above, but for Items (which include classes, skills, spells, etc)
- coerceString - Will attempt to convert a value to a string in a couple of ways.
