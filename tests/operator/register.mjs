import { registerHooks } from "node:module";
import ts from "typescript";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve as pathResolve, dirname } from "node:path";
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "next/headers" || specifier === "next/server")
      specifier += ".js";
    if (specifier === "server-only")
      return {
        url: "data:text/javascript,export default {}",
        shortCircuit: true,
      };
    if (specifier.startsWith("@/"))
      specifier = pathToFileURL(
        pathResolve("apps/web/src", specifier.slice(2)),
      ).href;
    if (
      (specifier.startsWith(".") || specifier.startsWith("file:")) &&
      context.parentURL &&
      !context.parentURL.includes("/node_modules/")
    ) {
      let file = specifier.startsWith("file:")
        ? fileURLToPath(specifier)
        : pathResolve(dirname(fileURLToPath(context.parentURL)), specifier);
      for (const ext of ["", ".ts", ".tsx", "/index.ts"])
        if (existsSync(file + ext))
          return next(pathToFileURL(file + ext).href, context);
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith(".ts") || url.endsWith(".tsx"))
      return {
        format: "module",
        source: ts.transpileModule(readFileSync(fileURLToPath(url), "utf8"), {
          compilerOptions: {
            module: ts.ModuleKind.ESNext,
            target: ts.ScriptTarget.ES2022,
            jsx: ts.JsxEmit.ReactJSX,
          },
        }).outputText,
        shortCircuit: true,
      };
    return next(url, context);
  },
});
