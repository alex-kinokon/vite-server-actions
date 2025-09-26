import { types as t } from "@babel/core";
import type { PluginObj } from "@babel/core";

const plugin: PluginObj = {
  name: "jsdoc",
  visitor: {
    FunctionDeclaration(path, state) {
      const { file } = state;
      const params = path.node.params
        .filter(p => t.isIdentifier(p))
        .filter(p => p.typeAnnotation)
        .map(p => {
          const typeText = serializeType(file.code, p.typeAnnotation);
          return ` * @param {${typeText}} ${p.name}`;
        });

      if (path.node.returnType) {
        const returnType = serializeType(file.code, path.node.returnType);
        params.push(`  * @returns ${returnType}`);
      }

      if (params.length) {
        const target = ["ExportDefaultDeclaration", "ExportNamedDeclaration"].includes(
          path.parent.type
        )
          ? path.parentPath
          : path;
        target.addComment("leading", ["*", ...params, "  * @preserve\n"].join("\n"));
      }
    },
  },
};

function serializeType(code: string, source: t.Identifier["typeAnnotation"]) {
  const type = (source as t.TSTypeAnnotation).typeAnnotation;
  return code.slice(type.start!, type.end!);
}

export default plugin;
