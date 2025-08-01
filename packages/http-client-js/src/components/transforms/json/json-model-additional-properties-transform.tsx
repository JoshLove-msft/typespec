import { Children, code, mapJoin } from "@alloy-js/core";
import * as ts from "@alloy-js/typescript";
import type { Model } from "@typespec/compiler";
import { useTsp } from "@typespec/emitter-framework";
import { getJsonRecordTransformRefkey } from "./json-record-transform.jsx";

export interface JsonAdditionalPropertiesTransformProps {
  itemRef: Children;
  type: Model;
  target: "transport" | "application";
}

export function JsonAdditionalPropertiesTransform(props: JsonAdditionalPropertiesTransformProps) {
  const { $ } = useTsp();
  const additionalProperties = $.model.getAdditionalPropertiesRecord(props.type);

  if (!additionalProperties) {
    return null;
  }

  if (props.target === "application") {
    const properties = $.model.getProperties(props.type, { includeExtended: true });
    const destructuredProperties = mapJoin(
      () => properties,
      (name) => name,
      {
        joiner: ",",
        ender: ",",
      },
    );

    // Inline destructuring that extracts the properties and passes the rest to jsonRecordUnknownToApplicationTransform_2
    const inlineDestructure = code`
    ${getJsonRecordTransformRefkey(additionalProperties, props.target)}(
      (({ ${destructuredProperties} ...rest }) => rest)(${props.itemRef})
    ),
    `;

    return (
      <>
        <ts.ObjectProperty name="additionalProperties">{inlineDestructure}</ts.ObjectProperty>
      </>
    );
  }

  const itemRef = code`${props.itemRef}.additionalProperties`;

  return (
    <>
      ...({getJsonRecordTransformRefkey(additionalProperties, props.target)}({itemRef}) ),
    </>
  );
}
