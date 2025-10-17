/**
 * JSCodeshift transform to replace fetch() calls with apiFetch
 * 
 * Usage:
 * npx jscodeshift -t scripts/codemods/replace-fetch-with-apifetch.ts apps/web/src --extensions=ts,tsx --parser=babel-ts
 */

import { Transform } from 'jscodeshift';

const transform: Transform = (fileInfo, api) => {
  const j = api.jscodeshift;
  const source = j(fileInfo.source);

  let hasApiFetchImport = false;
  let hasChanges = false;

  // Check if apiFetch is already imported
  source.find(j.ImportDeclaration).forEach(path => {
    if (path.value.source.value === '@/lib/api-client') {
      const specifiers = path.value.specifiers || [];
      if (specifiers.some((spec: any) => 
        spec.type === 'ImportSpecifier' && spec.imported.name === 'apiFetch'
      )) {
        hasApiFetchImport = true;
      }
    }
  });

  // Replace fetch calls with apiFetch
  source.find(j.CallExpression).forEach(path => {
    const { node } = path;
    
    // Check if this is a fetch call
    if (node.callee.type === 'Identifier' && node.callee.name === 'fetch') {
      const [urlArg] = node.arguments;
      
      // Skip absolute URLs (external API calls)
      if (urlArg && urlArg.type === 'Literal' && 
          typeof urlArg.value === 'string' && 
          /^https?:\/\//i.test(urlArg.value)) {
        return;
      }
      
      // Replace fetch with apiFetch
      node.callee.name = 'apiFetch';
      hasChanges = true;
    }
  });

  // Add import if needed and changes were made
  if (hasChanges && !hasApiFetchImport) {
    // Find the best place to insert the import (after other imports)
    const imports = source.find(j.ImportDeclaration);
    const lastImport = imports.at(-1);
    
    if (lastImport.length > 0) {
      lastImport.insertAfter(
        j.importDeclaration(
          [j.importSpecifier(j.identifier('apiFetch'))],
          j.literal('@/lib/api-client')
        )
      );
    } else {
      // No imports found, add at the beginning
      source.get().node.program.body.unshift(
        j.importDeclaration(
          [j.importSpecifier(j.identifier('apiFetch'))],
          j.literal('@/lib/api-client')
        ).program.body[0]
      );
    }
  }

  return hasChanges ? source.toSource() : null;
};

export default transform;