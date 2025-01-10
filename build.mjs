#!/usr/bin/env node

import { build } from "esbuild";
import { clean as cleanPlugin } from "esbuild-plugin-clean";
import copyPlugin from "esbuild-copy-static-files";
import { sassPlugin } from "esbuild-sass-plugin";
import { nodeExternalsPlugin } from "esbuild-node-externals";
import jsonMerge from "esbuild-plugin-json-merge";
import path from "path";
import { promises as fs } from "fs";
import { deepmerge } from "deepmerge-ts";
import yoctoSpinner from "yocto-spinner";
import { ESLint } from "eslint";
import externalizeAllPackagesExcept from "esbuild-plugin-noexternal";
import { compilePack } from "@foundryvtt/foundryvtt-cli";

/** Paths */
const SRC_PATH = "./src";
const LANG_PATH = path.join(SRC_PATH, "languages");
const OUT_PATH = "./dist";
const STYLE_PATH = path.join(SRC_PATH, "styles");
const TEMPLATE_PATH = path.join(SRC_PATH, "templates");
const MACRO_PACK_PATH = path.join(SRC_PATH, "packs/erica-pfu-macros");

// Import module.json for some config options
// import moduleConfig from "./module.json" with { type: "json" };
const moduleConfig = JSON.parse(
  (await fs.readFile("./module.json")).toString()
);

// Constants to be inserted into process.env during build
const __DEV__ = process.env.NODE_ENV !== "production";
const __MODULE_TITLE__ = moduleConfig.title;
const __MODULE_ID__ = moduleConfig.id;
const __MODULE_VERSION__ = moduleConfig.version;

const start = Date.now();
let spinner = null;

if (!process.argv.slice(2).includes("--no-lint")) {
  const lintStart = Date.now();
  if (!process.env.GITHUB_ACTIONS)
    spinner = yoctoSpinner({ text: "Linting..." }).start();
  else console.log("Linting...");

  const linter = new ESLint({
    cache: true,
    errorOnUnmatchedPattern: false,
  });
  const lintResults = await linter.lintFiles(["src/**.ts", "src/*/**.ts"]);
  await ESLint.outputFixes(lintResults);

  if (!process.env.GITHUB_ACTIONS) {
    const formatter = await linter.loadFormatter("html");
    await fs.writeFile("./lint-report.html", formatter.format(lintResults));
  }

  const hasErrors = lintResults.findIndex((result) => result.errorCount) !== -1;
  if (hasErrors) {
    if (spinner) spinner.error("Linting errors found!");
    const formatter = await linter.loadFormatter("stylish");
    console.log(formatter.format(lintResults));
    process.exit(1);
  } else {
    if (spinner)
      spinner.success(
        `Linting passed in ${((Date.now() - start) / 1000).toFixed(2)}s`
      );
    else
      console.log(
        `Linting passed in ${((Date.now() - start) / 1000).toFixed(2)}s`
      );
  }
}

const buildStart = Date.now();
if (!process.env.GITHUB_ACTIONS)
  spinner = yoctoSpinner({ text: "Building..." }).start();
else console.log("Building...");
const jsonMergers = (
  await fs.readdir(LANG_PATH, { withFileTypes: true })
).reduce((prev, curr) => {
  if (curr.isDirectory())
    return [
      ...prev,
      jsonMerge({
        entryPoints: [path.join(LANG_PATH, curr.name, "*.json")],
        outfile: path.join("languages", `${curr.name}.json`),
        merge: (items) => deepmerge(...items),
      }),
    ];
  else return prev;
}, []);

// Create our copy plugins, ensuring that the paths we're copying from exist
const STATIC_FILES = [
  { src: "./module.json", dest: "module.json" },
  { src: "./LICENSE", dest: "LICENSE" },
  { src: "./README.md", dest: "README.md" },
  { src: TEMPLATE_PATH, dest: "templates" },
  { src: path.join(SRC_PATH, "styles"), dest: "styles" },
  { src: path.join(SRC_PATH, "assets"), dest: "assets" },
];

const copyPlugins = [];
for (const file of STATIC_FILES) {
  try {
    const stat = await fs.stat(file.src);
    copyPlugins.push(
      copyPlugin({
        src: file.src,
        dest: path.join(OUT_PATH, file.dest),
        dereference: true,
        errorOnExists: false,
        preserveTimestamps: true,
      })
    );
  } catch (err) {
    // ignore ENOENT, throw others
    if (err.code === "ENOENT") {
      console.warn(`Attempting to copy non-existent file: ${file.src}`);
    } else {
      throw err;
    }
  }
}

const buildResults = await build({
  entryPoints: [
    path.join(SRC_PATH, "module.ts"),
    path.join(STYLE_PATH, "module.scss"),
  ],
  outdir: OUT_PATH,
  sourcemap: __DEV__,
  bundle: true,
  platform: "browser",
  minify: !__DEV__,
  define: {
    __DEV__: __DEV__ === true ? "true" : "false",
    __MODULE_TITLE__: `"${__MODULE_TITLE__}"`,
    __MODULE_ID__: `"${__MODULE_ID__}"`,
    __MODULE_VERSION__: `"${__MODULE_VERSION__}"`,
  },
  external: [
    "*.woff",
    "*.woff2",
    "*.otf",
    "*.ttf",
    "*.webp",
    "*.svg",
    "*.jpg",
    "*.png",
  ],
  loader: {
    ".frag": "text",
    ".vert": "text",
  },
  metafile: __DEV__,
  plugins: [
    nodeExternalsPlugin(),
    cleanPlugin({ patterns: "./dist/**" }),
    sassPlugin(),
    ...copyPlugins,
    ...jsonMergers,
    externalizeAllPackagesExcept(["semver", "handlebars-group-by", "lunr"]),
    // externalizeAllPackagesExcept(["rxjs", "mini-rx-store", "tslib", "mime", "@pixi/gif"])
  ],
});

if (buildResults.metafile) {
  await fs.writeFile(
    "./esbuild.meta.json",
    JSON.stringify(buildResults.metafile, null, 2)
  );
}

if (buildResults.errors.length) {
  if (spinner) spinner.error("Build failed!");
  else console.error("Build failed!");
  console.error(buildResults.errors);
  process.exit(1);
} else {
  if (spinner)
    spinner.success(
      `Build completed in ${((Date.now() - buildStart) / 1000).toFixed(2)}s`
    );
  else
    console.log(
      `Build completed in ${((Date.now() - buildStart) / 1000).toFixed(2)}s`
    );
  // if (buildResults.warnings.length) console.warn(buildResults.warnings);

  const macroStart = Date.now();
  if (!process.env.GITHUB_ACTIONS)
    spinner = yoctoSpinner({ text: "Building macros..." }).start();
  else console.log("Building macros...");

  try {
    const files = await fs.readdir(path.join(SRC_PATH, "macros"));
    const macroFiles = await fs.readdir(MACRO_PACK_PATH);

    for (const file of files) {
      const content = (
        await fs.readFile(path.join(SRC_PATH, "macros", file))
      ).toString();

      const macroFilePattern = `macros_${path
        .basename(file, path.extname(file))
        .replaceAll(" ", "_")}`;

      const macroFile = macroFiles.find((macro) =>
        macro.startsWith(macroFilePattern)
      );
      if (!macroFile)
        throw new Error(`Unable to locate macro file for ${file}`);

      const macroFileContent = (
        await fs.readFile(path.join(MACRO_PACK_PATH, macroFile))
      ).toString();

      const macroFileJSON = JSON.parse(macroFileContent);
      macroFileJSON.command = `${content}`;
      await fs.writeFile(
        path.join(MACRO_PACK_PATH, macroFile),
        JSON.stringify(macroFileJSON, null, 2)
      );
    }

    if (spinner)
      spinner.success(
        `Macros built in ${((Date.now() - macroStart) / 1000).toFixed(2)}s`
      );
    else
      console.log(
        `Macros built in ${((Date.now() - macroStart) / 1000).toFixed(2)}s`
      );
  } catch (err) {
    if (spinner) spinner.error("Building macros failed!");
    else console.error("Building macros failed!");
    console.error(err);
    process.exit(1);
  }

  const packStart = Date.now();
  if (!process.env.GITHUB_ACTIONS)
    spinner = yoctoSpinner({ text: "Packing compendia..." }).start();
  else console.log("Packing compendia...");
  try {
    // Build compendia
    const packs = await fs.readdir(path.join(SRC_PATH, "packs"));
    for (const pack of packs) {
      if (pack === ".gitattributes") continue;
      await compilePack(
        path.join(SRC_PATH, `packs`, pack),
        path.join(OUT_PATH, "packs", pack),
        { yaml: false }
      );
    }
    if (spinner)
      spinner.success(
        `Compendia packed in ${((Date.now() - packStart) / 1000).toFixed(2)}s`
      );
    else
      console.log(
        `Compendia packed in ${((Date.now() - packStart) / 1000).toFixed(2)}s`
      );
  } catch (err) {
    if (spinner) spinner.error("Build failed!");
    else console.error("Build failed!");
    console.error(err);
    process.exit(1);
  }
}
