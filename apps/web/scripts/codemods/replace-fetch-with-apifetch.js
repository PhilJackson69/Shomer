/**
 * - Replaces global fetch(...) with apiFetch(...)
 * - Adds import { apiFetch } from "@/lib/api-client" if missing
 * - Skips if callee already apiFetch or URL is absolute external http(s)
 */
const { parse } = require("path");

module.exports = function transformer(file, api) {
  const j = api.jscodeshift;
  const root = j(file.source);

  const hasApiFetchImport = () =>
    root.find(j.ImportDeclaration, { source: { value: "@/lib/api-client" } })
      .filter(p => p.value.specifiers?.some(s => s.imported?.name === "apiFetch")).size() > 0;

  const addImport = () => {
    if (!hasApiFetchImport()) {
      root.get().node.program.body.unshift(
        j.importDeclaration([j.importSpecifier(j.identifier("apiFetch"))], j.literal("@/lib/api-client"))
      );
    }
  };

  root.find(j.CallExpression, { callee: { name: "fetch" } }).forEach(path => {
    const [urlArg, initArg] = path.value.arguments;
    // Skip clearly external absolute URLs
    if (urlArg && urlArg.type === "Literal" && typeof urlArg.value === "string" &&
        /^https?:\/\//i.test(urlArg.value)) {
      return;
    }
    // Replace callee
    path.value.callee.name = "apiFetch";
  });

  // Only add import if we actually replaced something
  const replaced = root.find(j.CallExpression, { callee: { name: "apiFetch" } }).size() > 0;
  if (replaced) addImport();

  return root.toSource({ quote: "double" });
};
