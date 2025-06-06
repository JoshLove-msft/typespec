import {
  Enum,
  getEncode,
  getFormat,
  getMaxItems,
  getMaxValue,
  getMaxValueExclusive,
  getMinItems,
  getMinValue,
  getMinValueExclusive,
  isArrayModelType,
  ModelProperty,
  Program,
  resolveEncodedName,
  Scalar,
  Type,
  Union,
} from "@typespec/compiler";
import { camelCase } from "change-case";
import {
  Attribute,
  AttributeType,
  BooleanValue,
  CSharpType,
  HelperNamespace,
  NumericValue,
  Parameter,
  RawValue,
  StringValue,
} from "./interfaces.js";

import { getEnumType, getStringConstraint, isArrayType } from "./type-helpers.js";
import { ExtendedIntrinsicScalarName, getCSharpTypeForScalar, isStringEnumType } from "./utils.js";

export const JsonNamespace: string = "System.Text.Json";

export function getEncodingValue(
  program: Program,
  type: Scalar | ModelProperty,
): string | undefined {
  const value = getEncode(program, type);
  return value ? value.encoding : undefined;
}

export function getFormatValue(program: Program, type: Scalar | ModelProperty): string | undefined {
  return getFormat(program, type);
}

/**
 * Return name encoding attributes
 * @param program The program being processed
 * @param type The type to check
 * @returns The attributes associated with the type, or none
 */
export function getEncodedNameAttribute(
  program: Program,
  type: ModelProperty,
  cSharpName?: string,
): Attribute | undefined {
  const encodedName = resolveEncodedName(program, type, "application/json");
  if (encodedName !== type.name) {
    const attr: Attribute = new Attribute(
      new AttributeType({
        name: "JsonPropertyName",
        namespace: JsonNamespace,
      }),
      [],
    );

    attr.parameters.push(
      new Parameter({
        name: "name",
        value: new StringValue(encodedName),
        optional: false,
        type: new CSharpType({
          name: "string",
          namespace: "System",
          isBuiltIn: true,
          isValueType: true,
        }),
      }),
    );

    return attr;
  }

  if (cSharpName && type.name !== camelCase(cSharpName)) {
    const attr: Attribute = new Attribute(
      new AttributeType({
        name: "JsonPropertyName",
        namespace: JsonNamespace,
      }),
      [],
    );

    attr.parameters.push(
      new Parameter({
        name: "name",
        value: new StringValue(type.name),
        optional: false,
        type: new CSharpType({
          name: "string",
          namespace: "System",
          isBuiltIn: true,
          isValueType: true,
        }),
      }),
    );

    return attr;
  }

  return undefined;
}

/**
 * Return the encoding attributes for model properties
 * @param program The program being processed
 * @param type The type to check
 * @returns The appropriate serialization attributes for the type, or none
 */
export function getEncodingAttributes(program: Program, type: ModelProperty): Attribute[] {
  const result: Attribute[] = [];
  const propertyType = getScalarType(program, type);
  if (propertyType !== undefined) {
    switch (propertyType.scalar.name) {
      case "unixTimestamp32":
        result.push(getJsonConverterAttribute("UnixEpochDateTimeOffsetConverter"));
        break;
      case "duration":
        result.push(getJsonConverterAttribute("TimeSpanDurationConverter"));
        break;
      case "bytes":
        if (
          propertyType.encoding !== undefined &&
          propertyType.encoding.name.toLowerCase() === "base64url"
        ) {
          result.push(getJsonConverterAttribute("Base64UrlJsonConverter"));
        }
        break;
      case "utcDateTime":
      case "offsetDateTime":
        if (
          propertyType.encoding !== undefined &&
          propertyType.encoding.name.toLowerCase() === "unixTimestamp"
        ) {
          result.push(getJsonConverterAttribute("UnixEpochDateTimeOffsetConverter"));
        }
        break;
    }
  }

  return result;
}

type WireEncoding = { name: string; wireType: Type };

type ScalarWithEncoding = {
  scalar: Scalar & { name: ExtendedIntrinsicScalarName };
  encoding?: WireEncoding;
};

function getScalarType(program: Program, property: ModelProperty): ScalarWithEncoding | undefined {
  function getScalarEncoding(scalar: Scalar | ModelProperty): WireEncoding | undefined {
    const encode = getEncode(program, scalar);
    if (encode === undefined) {
      switch (scalar.kind) {
        case "ModelProperty":
          if (scalar.type.kind === "Scalar") {
            return getScalarEncoding(scalar.type);
          }
          return undefined;
        case "Scalar":
          if (scalar.baseScalar) {
            return getScalarEncoding(scalar.baseScalar);
          }
          return undefined;
      }
    }
    return { name: encode.encoding ?? "string", wireType: encode.type };
  }
  function getStdScalarType(
    scalar: Scalar,
  ): (Scalar & { name: ExtendedIntrinsicScalarName }) | undefined {
    if (program.checker.isStdType(scalar)) return scalar;
    if (scalar.baseScalar) return getStdScalarType(scalar.baseScalar);
    return undefined;
  }
  if (property.type.kind !== "Scalar") return undefined;
  const stdScalar: (Scalar & { name: ExtendedIntrinsicScalarName }) | undefined = getStdScalarType(
    property.type,
  );
  if (stdScalar === undefined) return undefined;
  const encoding: WireEncoding | undefined = getScalarEncoding(property);
  return { scalar: stdScalar, encoding: encoding };
}

function getTypeType(): CSharpType {
  return new CSharpType({ name: "Type", namespace: "System", isValueType: false, isBuiltIn: true });
}
function getJsonConverterAttributeType(): CSharpType {
  return new CSharpType({
    name: "JsonConverter",
    namespace: "System.Text.Json",
    isValueType: false,
    isBuiltIn: true,
  });
}

function getJsonConverterAttribute(converterType: string): Attribute {
  return new Attribute(getJsonConverterAttributeType(), [
    new Parameter({
      name: "",
      type: getTypeType(),
      optional: false,
      value: new RawValue(`typeof(${converterType})`),
    }),
  ]);
}

/**
 * Return min and max length attributes for string
 * @param program The program being processed
 * @param type The type to check
 * @returns The attributes associated with the type, or none
 */
export function getStringConstraintAttribute(
  program: Program,
  type: ModelProperty | Scalar,
): Attribute | undefined {
  const constraint = getStringConstraint(program, type);
  if (constraint === undefined) return undefined;
  const minLength: number | undefined = constraint.minLength;
  const maxLength = constraint.maxLength;
  const pattern = constraint.pattern;
  if (minLength === undefined && maxLength === undefined && pattern === undefined) return undefined;
  const attr: Attribute = new Attribute(
    new AttributeType({
      name: "StringConstraint",
      namespace: HelperNamespace,
    }),
    [],
  );

  if (minLength !== undefined) {
    attr.parameters.push(
      new Parameter({
        name: "MinLength",
        value: new NumericValue(minLength),
        optional: true,
        type: new CSharpType({
          name: "int",
          namespace: "System",
          isBuiltIn: true,
          isValueType: true,
        }),
      }),
    );
  }

  if (maxLength !== undefined) {
    attr.parameters.push(
      new Parameter({
        name: "MaxLength",
        value: new NumericValue(maxLength),
        optional: true,
        type: new CSharpType({
          name: "int",
          namespace: "System",
          isBuiltIn: true,
          isValueType: true,
        }),
      }),
    );
  }

  if (pattern !== undefined) {
    attr.parameters.push(
      new Parameter({
        name: "Pattern",
        value: new StringValue(pattern),
        optional: true,
        type: new CSharpType({
          name: "string",
          namespace: "System",
          isBuiltIn: true,
          isValueType: true,
        }),
      }),
    );
  }

  return attr;
}

/**
 * Return min and max length attributes for string
 * @param program The program being processed
 * @param type The type to check
 * @returns The attributes associated with the type, or none
 */
export function getArrayConstraintAttribute(
  program: Program,
  type: ModelProperty | Scalar,
): Attribute | undefined {
  if (!isArrayType(program, type)) return undefined;
  const minItems: number | undefined = getMinItems(program, type);
  const maxItems = getMaxItems(program, type);
  if (minItems === undefined && maxItems === undefined) return undefined;
  if (type.kind !== "ModelProperty" || type.type.kind !== "Model") return undefined;
  if (!isArrayModelType(program, type.type)) return undefined;
  const arrayType = type.type;
  const elementType = arrayType.indexer.value;
  if (elementType.kind !== "Scalar") return undefined;
  const scalarType = getCSharpTypeForScalar(program, elementType);
  if (scalarType === undefined) return undefined;
  const attr: Attribute = new Attribute(
    new AttributeType({
      name: `ArrayConstraint<${scalarType.getTypeReference()}>`,
      namespace: HelperNamespace,
    }),
    [],
  );

  if (minItems !== undefined) {
    attr.parameters.push(
      new Parameter({
        name: "MinItems",
        value: new NumericValue(minItems),
        optional: true,
        type: new CSharpType({
          name: "int",
          namespace: "System",
          isBuiltIn: true,
          isValueType: true,
        }),
      }),
    );
  }

  if (maxItems !== undefined) {
    attr.parameters.push(
      new Parameter({
        name: "MaxItems",
        value: new NumericValue(maxItems),
        optional: true,
        type: new CSharpType({
          name: "int",
          namespace: "System",
          isBuiltIn: true,
          isValueType: true,
        }),
      }),
    );
  }

  return attr;
}

/**
 * Return min and max length attributes for string
 * @param program The program being processed
 * @param type The type to check
 * @returns The attributes associated with the type, or none
 */
export function getNumericConstraintAttribute(
  program: Program,
  type: ModelProperty | Scalar,
): Attribute | undefined {
  if (type.kind === "Scalar" || type.type.kind !== "Scalar") return undefined;
  const minValue: number | undefined = getMinValue(program, type);
  const maxValue = getMaxValue(program, type);
  const minValueExclusive: number | undefined = getMinValueExclusive(program, type);
  const maxValueExclusive = getMaxValueExclusive(program, type);
  if (
    minValue === undefined &&
    maxValue === undefined &&
    minValueExclusive === undefined &&
    maxValueExclusive === undefined
  )
    return undefined;
  const scalarType = getCSharpTypeForScalar(program, type.type);
  if (scalarType === undefined) return undefined;
  const attr: Attribute = new Attribute(
    new AttributeType({
      name: `NumericConstraint<${scalarType.getTypeReference()}>`,
      namespace: HelperNamespace,
    }),
    [],
  );

  const actualMin = minValue === undefined ? minValueExclusive : minValue;
  if (actualMin !== undefined) {
    attr.parameters.push(
      new Parameter({
        name: "MinValue",
        value: new NumericValue(actualMin),
        optional: true,
        type: scalarType,
      }),
    );
  }

  const actualMax = maxValue === undefined ? maxValueExclusive : maxValue;
  if (actualMax !== undefined) {
    attr.parameters.push(
      new Parameter({
        name: "MaxValue",
        value: new NumericValue(actualMax),
        optional: true,
        type: scalarType,
      }),
    );
  }

  if (minValueExclusive !== undefined) {
    attr.parameters.push(
      new Parameter({
        name: "MinValueExclusive",
        value: new BooleanValue(true),
        optional: true,
        type: new CSharpType({
          name: "bool",
          namespace: "System",
          isBuiltIn: true,
          isValueType: true,
        }),
      }),
    );
  }

  if (maxValueExclusive !== undefined) {
    attr.parameters.push(
      new Parameter({
        name: "MaxValueExclusive",
        value: new BooleanValue(true),
        optional: true,
        type: new CSharpType({
          name: "bool",
          namespace: "System",
          isBuiltIn: true,
          isValueType: true,
        }),
      }),
    );
  }

  return attr;
}

export function getSafeIntAttribute(type: Scalar): Attribute | undefined {
  if (type.name.toLowerCase() !== "safeint") return undefined;
  const attr: Attribute = new Attribute(
    new AttributeType({
      name: `NumericConstraint<long>`,
      namespace: HelperNamespace,
    }),
    [],
  );

  attr.parameters.push(
    new Parameter({
      name: "MinValue",
      value: new NumericValue(-9007199254740991),
      optional: true,
      type: new CSharpType({
        name: "long",
        namespace: "System",
        isBuiltIn: true,
        isValueType: true,
        isNullable: false,
      }),
    }),
  );

  attr.parameters.push(
    new Parameter({
      name: "MaxValue",
      value: new NumericValue(9007199254740991),
      optional: true,
      type: new CSharpType({
        name: "long",
        namespace: "System",
        isBuiltIn: true,
        isValueType: true,
        isNullable: false,
      }),
    }),
  );

  return attr;
}

function getEnumAttribute(type: Enum | Union, cSharpName?: string): Attribute {
  return new Attribute(
    new AttributeType({
      name: `JsonConverter(typeof(JsonStringEnumConverter))`,
      namespace: "System.Text.Json.Serialization",
    }),
    [],
  );
}

export function getAttributes(program: Program, type: Type, cSharpName?: string): Attribute[] {
  const result: Set<Attribute> = new Set<Attribute>();
  switch (type.kind) {
    case "Enum":
      if (getEnumType(type) === "string") result.add(getEnumAttribute(type, cSharpName));
      break;
    case "Union":
      if (isStringEnumType(program, type)) {
        result.add(getEnumAttribute(type, cSharpName));
      }
      break;
    case "Model":
      break;
    case "ModelProperty": {
      const arrayAttr = getArrayConstraintAttribute(program, type);
      const stringAttr = getStringConstraintAttribute(program, type);
      const numberAttr = getNumericConstraintAttribute(program, type);
      const name = getEncodedNameAttribute(program, type, cSharpName);
      if (arrayAttr) result.add(arrayAttr);
      if (stringAttr) result.add(stringAttr);
      if (numberAttr) result.add(numberAttr);
      if (name) result.add(name);
      const encodingAttributes = getEncodingAttributes(program, type);
      for (const encoder of encodingAttributes) {
        result.add(encoder);
      }
      const typeAttributes = getAttributes(program, type.type);
      for (const typeAttribute of typeAttributes) {
        result.add(typeAttribute);
      }
      break;
    }
    case "Scalar":
      {
        const safeInt = getSafeIntAttribute(type);
        if (safeInt) result.add(safeInt);
      }

      break;
  }

  return [...result.values()];
}
