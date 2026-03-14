import type { Type } from "@typespec/compiler";
import { useTsp } from "../../core/context/tsp-context.js";
import { EnumDeclaration } from "./enum-declaration.js";
import { ObjectTypeDeclaration } from "./object-type-declaration.js";
import { UnionDeclaration } from "./union-declaration.js";

export interface TypeDeclarationProps {
  name?: string;
  type: Type;
  doc?: string;
}

export function TypeDeclaration(props: TypeDeclarationProps) {
  const { $ } = useTsp();
  const { type, ...restProps } = props;
  const doc = props.doc ?? $.type.getDoc(type) ?? undefined;

  switch (type.kind) {
    case "Model":
      return <ObjectTypeDeclaration doc={doc} type={type} {...restProps} />;
    case "Enum":
      return <EnumDeclaration doc={doc} type={type} {...restProps} />;
    case "Union":
      if ($.union.isValidEnum(type)) {
        return <EnumDeclaration doc={doc} type={type} {...restProps} />;
      }
      return <UnionDeclaration doc={doc} type={type} {...restProps} />;
  }
}
