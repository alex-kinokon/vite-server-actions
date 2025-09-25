// AST transformation pipeline - converts "use server" functions into client-side API callers
// This is the core of the system: it completely rewrites server action files

import assert from "node:assert";

import { parse, types as t, traverse } from "@babel/core";
import { generate } from "@babel/generator";
import type { Plugin } from "vite";

import { type Config, type RouteMap, isServerAction } from "./utils";

const MUST_BE_ASYNC = "Server action must be async.";
const NAME_MUST_BE_STATIC = "Server action name must be an identifier.";

const { identifier: id } = t;
const actionRequest = (hash: t.StringLiteral) =>
  t.arrowFunctionExpression(
    [t.restElement(id("args"))],
    t.callExpression(id("actionRequest"), [hash, id("args")])
  );

const exportConst = (name: t.Identifier, value: t.Expression) =>
  t.exportNamedDeclaration(
    t.variableDeclaration("var", [t.variableDeclarator(name, value)])
  );

const declObj = t.objectExpression([t.objectProperty(id("__proto__"), t.nullLiteral())]);

export const transform =
  (config: Config, routeMap: RouteMap): NonNullable<Plugin["transform"]> =>
  (code, path) => {
    // Only process JavaScript/TypeScript files
    if (!/\.[cm]?[jt]sx?$/.test(path)) {
      return null;
    }

    // Skip files that don't contain "use server" directive
    if (!isServerAction(code)) {
      return null;
    }

    const [ast, newAST] = [
      code,
      'import { actionRequest } from "virtual:ssc-helper";',
    ].map(
      code =>
        parse(code, {
          sourceType: "module",
          parserOpts: {
            plugins: ["jsx", "typescript", "importAssertions"],
          },
        })!
    );

    const newBody = newAST.program.body;

    /**
     * Generates client-side wrapper for a server action functions
     */
    function declareID(name: string) {
      const hash = config.getId(path, name, "action");
      routeMap.set(hash, { path, name });
      newBody.push(exportConst(id(name), actionRequest(t.stringLiteral(hash))));
    }

    // Handle object exports containing multiple server actions
    // Creates a client-side object with methods that call actionRequest
    function declareObject(main: string, names: string[]) {
      const obj = t.cloneNode(declObj);
      for (const name of names) {
        const fullName = [main, name].join(".");
        const hash = config.getId(path, fullName, "action");
        routeMap.set(hash, { path, name: fullName });
        obj.properties.push(
          t.objectProperty(id(name), actionRequest(t.stringLiteral(hash)))
        );
      }
      newBody.push(exportConst(id(main), obj));
    }

    // Traverse AST to find and transform all exported server actions
    // Replaces original server functions with client-side API callers
    traverse(ast, {
      ExportNamedDeclaration(path) {
        const { node } = path;
        const { declaration: decl } = node;
        if (!decl) return;

        // Handle: export async function myAction() { ... }
        if (t.isFunctionDeclaration(decl)) {
          assert(decl.async, MUST_BE_ASYNC);
          declareID(decl.id!.name);
        } else if (t.isVariableDeclaration(decl)) {
          for (const { init, id } of decl.declarations) {
            if (t.isIdentifier(id)) {
              // Handle: export const myAction = async () => { ... }
              if (t.isArrowFunctionExpression(init) || t.isFunctionExpression(init)) {
                assert(init.async, MUST_BE_ASYNC);
                declareID(id.name);
              } else if (t.isCallExpression(init)) {
                // Handle wrapped functions - can't statically verify async
                declareID(id.name);
              } else if (t.isObjectExpression(init)) {
                // Handle: export const actions = { action1: async () => {}, ... }
                const props = init.properties.map(prop => {
                  assert(
                    t.isObjectProperty(prop) || t.isObjectMethod(prop),
                    `${prop.type} is not supported.`
                  );
                  if (t.isObjectMethod(prop)) {
                    assert(prop.async, MUST_BE_ASYNC);
                  }
                  assert(t.isIdentifier(prop.key), NAME_MUST_BE_STATIC);
                  return prop.key.name;
                });
                declareObject(id.name, props);
              } else {
                throw new Error("Unsupported export");
              }
            } else if (t.isObjectPattern(id)) {
              // Handle: export const { action1, action2 } = someObject
              for (const prop of id.properties) {
                assert(t.isObjectProperty(prop), `${prop.type} is not supported.`);
                assert(t.isIdentifier(prop.key), NAME_MUST_BE_STATIC);
                declareID(prop.key.name);
              }
            }
          }
        }
      },
    });

    // Complete transformation: original server code → client-side API callers
    const { code: newCode } = generate(newAST);

    // console.debug("newCode", newCode);

    return {
      code: newCode,
      map: null, // Source maps not needed for generated wrapper code
    };
  };
