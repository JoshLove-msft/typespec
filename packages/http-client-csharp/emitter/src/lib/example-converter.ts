// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import {
  SdkArrayExampleValue,
  SdkBooleanExampleValue,
  SdkDictionaryExampleValue,
  SdkExampleValue,
  SdkHttpOperationExample,
  SdkHttpParameterExampleValue,
  SdkHttpResponseExampleValue,
  SdkModelExampleValue,
  SdkNullExampleValue,
  SdkNumberExampleValue,
  SdkStringExampleValue,
  SdkUnionExampleValue,
  SdkUnknownExampleValue,
} from "@azure-tools/typespec-client-generator-core";
import { CSharpEmitterContext } from "../sdk-context.js";
import {
  InputArrayExampleValue,
  InputBooleanExampleValue,
  InputDictionaryExampleValue,
  InputExampleValue,
  InputHttpOperationExample,
  InputModelExampleValue,
  InputNullExampleValue,
  InputNumberExampleValue,
  InputParameterExampleValue,
  InputStringExampleValue,
  InputUnionExampleValue,
  InputUnknownExampleValue,
  OperationResponseExample,
} from "../type/input-examples.js";
import { InputParameter } from "../type/input-parameter.js";
import {
  InputArrayType,
  InputDictionaryType,
  InputModelType,
  InputNullableType,
  InputPrimitiveType,
  InputUnionType,
} from "../type/input-type.js";
import { fromSdkHttpOperationResponse } from "./operation-converter.js";
import { fromSdkType } from "./type-converter.js";

export function fromSdkHttpExamples(
  sdkContext: CSharpEmitterContext,
  examples: SdkHttpOperationExample[],
): InputHttpOperationExample[] {
  return examples.map((example) => fromSdkHttpExample(example));

  function fromSdkHttpExample(example: SdkHttpOperationExample): InputHttpOperationExample {
    return {
      kind: "http",
      name: example.name,
      description: example.doc,
      filePath: example.filePath,
      parameters: example.parameters.map((p) => fromSdkParameterExample(p)),
      responses: example.responses.map((r) => fromSdkOperationResponse(r)),
    };
  }

  function fromSdkParameterExample(
    parameter: SdkHttpParameterExampleValue,
  ): InputParameterExampleValue {
    return {
      parameter: sdkContext.__typeCache.operationParameters.get(
        parameter.parameter,
      ) as InputParameter,
      value: fromSdkExample(parameter.value),
    };
  }

  function fromSdkOperationResponse(
    responseValue: SdkHttpResponseExampleValue,
  ): OperationResponseExample {
    return {
      response: fromSdkHttpOperationResponse(sdkContext, responseValue.response),
      statusCode: responseValue.statusCode,
      bodyValue: responseValue.bodyValue ? fromSdkExample(responseValue.bodyValue) : undefined,
    };
  }

  function fromSdkExample(example: SdkExampleValue): InputExampleValue {
    switch (example.kind) {
      case "string":
        return fromSdkStringExample(example);
      case "number":
        return fromSdkNumberExample(example);
      case "boolean":
        return fromSdkBooleanExample(example);
      case "union":
        return fromSdkUnionExample(example);
      case "array":
        return fromSdkArrayExample(example);
      case "dict":
        return fromSdkDictionaryExample(example);
      case "model":
        return fromSdkModelExample(example);
      case "unknown":
        return fromSdkAnyExample(example);
      case "null":
        return fromSdkNullExample(example);
    }
  }

  function fromSdkStringExample(example: SdkStringExampleValue): InputStringExampleValue {
    return {
      kind: "string",
      type: fromSdkType(sdkContext, example.type),
      value: example.value,
    };
  }

  function fromSdkNumberExample(example: SdkNumberExampleValue): InputNumberExampleValue {
    return {
      kind: "number",
      type: fromSdkType(sdkContext, example.type),
      value: example.value,
    };
  }

  function fromSdkBooleanExample(example: SdkBooleanExampleValue): InputBooleanExampleValue {
    return {
      kind: example.kind,
      type: fromSdkType(sdkContext, example.type) as InputPrimitiveType,
      value: example.value,
    };
  }

  function fromSdkUnionExample(example: SdkUnionExampleValue): InputUnionExampleValue {
    return {
      kind: example.kind,
      type: fromSdkType(sdkContext, example.type) as InputUnionType,
      value: example.value,
    };
  }

  function fromSdkArrayExample(example: SdkArrayExampleValue): InputArrayExampleValue {
    return {
      kind: example.kind,
      type: fromSdkType(sdkContext, example.type) as InputArrayType,
      value: example.value.map((v) => fromSdkExample(v)),
    };
  }

  function fromSdkDictionaryExample(
    example: SdkDictionaryExampleValue,
  ): InputDictionaryExampleValue {
    return {
      kind: example.kind,
      type: fromSdkType(sdkContext, example.type) as InputDictionaryType,
      value: fromExampleRecord(example.value),
    };
  }

  function fromSdkModelExample(example: SdkModelExampleValue): InputModelExampleValue {
    return {
      kind: example.kind,
      type: fromSdkType(sdkContext, example.type) as InputModelType,
      value: fromExampleRecord(example.value),
      additionalPropertiesValue: example.additionalPropertiesValue
        ? fromExampleRecord(example.additionalPropertiesValue)
        : undefined,
    };
  }

  function fromSdkAnyExample(example: SdkUnknownExampleValue): InputUnknownExampleValue {
    return {
      kind: example.kind,
      type: fromSdkType(sdkContext, example.type) as InputPrimitiveType,
      value: example.value,
    };
  }

  function fromSdkNullExample(example: SdkNullExampleValue): InputNullExampleValue {
    return {
      kind: example.kind,
      type: fromSdkType(sdkContext, example.type) as InputNullableType,
      value: example.value,
    };
  }

  function fromExampleRecord(
    value: Record<string, SdkExampleValue>,
  ): Record<string, InputExampleValue> {
    return Object.entries(value).reduce(
      (acc, [key, value]) => {
        acc[key] = fromSdkExample(value);
        return acc;
      },
      {} as Record<string, InputExampleValue>,
    );
  }
}
