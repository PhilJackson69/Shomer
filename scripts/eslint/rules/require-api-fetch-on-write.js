module.exports = {
  meta: {
    type: "problem",
    hasSuggestions: true,
    fixable: "code",
    docs: { 
      description: "Use apiFetch for ALL requests to ensure CSRF protection and credentials",
      category: "Best Practices",
      recommended: true
    }
  },
  create(context) {
    function isWrite(init) {
      if (!init || init.type !== "ObjectExpression") return false;
      const methodProp = init.properties.find(p => p.key?.name === "method");
      if (!methodProp) return false;
      const methodValue = methodProp.value;
      if (!methodValue || methodValue.type !== "Literal") return false;
      return ["POST", "PUT", "PATCH", "DELETE"].includes(String(methodValue.value || "GET").toUpperCase());
    }

    function isAbsoluteUrl(urlArg) {
      if (!urlArg || urlArg.type !== "Literal") return false;
      const url = urlArg.value;
      return typeof url === "string" && /^https?:\/\//i.test(url);
    }

    function ensureImport(fixer, sourceCode) {
      const hasImport = sourceCode.ast.body.some(
        node => node.type === "ImportDeclaration" &&
          node.source.value === "@/lib/api-client" &&
          node.specifiers.some(spec => 
            spec.type === "ImportSpecifier" && spec.imported?.name === "apiFetch"
          )
      );
      
      if (hasImport) return [];
      
      // Find the best place to insert the import (after other imports)
      const imports = sourceCode.ast.body.filter(node => node.type === "ImportDeclaration");
      const insertAfter = imports.length > 0 ? imports[imports.length - 1].range[1] : 0;
      
      return [
        fixer.insertTextAfterRange([insertAfter, insertAfter], `\nimport { apiFetch } from "@/lib/api-client";`)
      ];
    }

    function ensureCredentials(fixer, init) {
      if (!init || init.type !== "ObjectExpression") return [];
      
      const hasCredentials = init.properties.some(p => p.key?.name === "credentials");
      if (hasCredentials) return [];
      
      const lastProp = init.properties[init.properties.length - 1];
      const insertAt = lastProp ? lastProp.range[1] : init.range[0] + 1;
      
      return [
        fixer.insertTextAfterRange([insertAt, insertAt], `, credentials: "include"`)
      ];
    }

    return {
      CallExpression(node) {
        // Only check fetch calls
        if (node.callee.type !== "Identifier" || node.callee.name !== "fetch") return;
        
        const [urlArg, init] = node.arguments;
        
        // Skip absolute URLs (external API calls)
        if (isAbsoluteUrl(urlArg)) return;

        const sourceCode = context.getSourceCode();
        const isWriteRequest = isWrite(init);
        
        context.report({
          node,
          message: isWriteRequest 
            ? "Non-GET requests must use apiFetch (adds credentials + CSRF protection)."
            : "Use apiFetch for ALL requests (GET included) to ensure consistency and credentials.",
          fix(fixer) {
            const fixes = [];
            
            // Replace fetch with apiFetch
            fixes.push(fixer.replaceText(node.callee, "apiFetch"));
            
            // Add credentials if missing (safe default for GETs too)
            if (init && init.type === "ObjectExpression" &&
                !init.properties.some(p => p.key?.name === "credentials")) {
              const last = init.properties[init.properties.length - 1];
              const insertAt = last.range[1] - 1;
              fixes.push(fixer.insertTextBeforeRange([insertAt, insertAt], `, credentials: "include"`));
            }
            
            // Add import if missing
            fixes.push(...ensureImport(fixer, sourceCode));
            
            return fixes;
          }
        });
      }
    };
  }
};
