# Change Log - @typespec/json-schema

## 1.2.0

### Bump dependencies

- [#7674](https://github.com/microsoft/typespec/pull/7674) Upgrade dependencies


## 1.1.0

### Bug Fixes

- [#7501](https://github.com/microsoft/typespec/pull/7501) Json schema emitter conflict with other emitters


## 1.0.0

No changes, version bump only.

## 1.0.0-rc.1

### Bug Fixes

- [#6947](https://github.com/microsoft/typespec/pull/6947) Fix crash when using enum values in extension
- [#6887](https://github.com/microsoft/typespec/pull/6887) Fix using union templates


## 1.0.0-rc.0

### Bump dependencies

- [#6595](https://github.com/microsoft/typespec/pull/6595) Upgrade dependencies


## 0.67.0

### Breaking Changes

- [#5977](https://github.com/microsoft/typespec/pull/5977) Minimum node version is now 20

### Bump dependencies

- [#6266](https://github.com/microsoft/typespec/pull/6266) Update dependencies

### Bug Fixes

- [#6411](https://github.com/microsoft/typespec/pull/6411) Add support for new `dryRun` emitter option


## 0.66.0

### Features

- [#5994](https://github.com/microsoft/typespec/pull/5994) Adds `seal-object-schemas` emitter option to automatically set additionalProperties/unevaluatedProperties to `{ not: {} }` wherever possible
- [#5961](https://github.com/microsoft/typespec/pull/5961) Updates JsonSchema and Open API 3.1 emitters to use unevaluatedProperties instead of additionalProperties, and updates Open API 3 emitters to match JsonSchema behavior of treating `Record<never>` as setting `additionalProperties: { not: {} }`


## 0.65.0

### Bump dependencies

- [#5690](https://github.com/microsoft/typespec/pull/5690) Upgrade dependencies

### Features

- [#5699](https://github.com/microsoft/typespec/pull/5699) Promote `unsafe_useStateMap` and `unsafe_useStateSet` experimental APIs to stable version `useStateMap` and `useStateSet`. Old ones are deprecated


## 0.64.0

No changes, version bump only.

## 0.63.0

### Bug Fixes

- [#5189](https://github.com/microsoft/typespec/pull/5189) Fixes crash that occurred when a template instantiation's template argument was a union that references a declaration.


## 0.62.0

### Bug Fixes

- [#4732](https://github.com/microsoft/typespec/pull/4732) Document exported types

### Bump dependencies

- [#4679](https://github.com/microsoft/typespec/pull/4679) Upgrade dependencies - October 2024


## 0.61.0

### Bump dependencies

- [#4424](https://github.com/microsoft/typespec/pull/4424) Bump dependencies

### Features

- [#4447](https://github.com/microsoft/typespec/pull/4447) Example set with `@example` decorator will populate the schema `examples` property


## 0.60.0

### Bug Fixes

- [#4150](https://github.com/microsoft/typespec/pull/4150) Stop json schema from crashing on unknown scalar and handle `unixTimestamp32`

### Features

- [#4139](https://github.com/microsoft/typespec/pull/4139) Internals: Migrate to new api for declaring decorator implementation


## 0.59.0

### Bump dependencies

- [#3948](https://github.com/microsoft/typespec/pull/3948) Update dependencies

### Breaking Changes

- [#3558](https://github.com/microsoft/typespec/pull/3558) Updates `@extension` decorator to support TypeSpec values in addition to types.

In previous versions of the json-schema emitter, the `@extension` decorator only accepted types as the value. These are emitted as JSON schemas. In order to add extensions as raw values, types had to be wrapped in the `Json<>` template when being passed to the `@extension` decorator.

This change allows setting TypeSpec values (introduced in TypeSpec 0.57.0) directly instead.

The following example demonstrates using values directly:

```tsp
@extension("x-example", #{ foo: "bar" })
model Foo {}
```

This change results in scalars being treated as values instead of types. This will result in the `@extension` decorator emitting raw values for scalar types instead of JSON schema. To preserve the previous behavior, use `typeof` when passing in a scalar value.

The following example demonstrates how to pass a scalar value that emits a JSON schema:

```tsp
@extension("x-example", "foo")
model Foo {}
```

To preserve this same behavior, the above example can be updated to the following:

```tsp
@extension("x-example", typeof "foo")
model Foo {}
```


## 0.58.0

### Bug Fixes

- [#3516](https://github.com/microsoft/typespec/pull/3516) Fix issue that could result in invalid document generation when running `tsp compile` from another directory

### Bump dependencies

- [#3718](https://github.com/microsoft/typespec/pull/3718) Dependency updates July 2024


## 0.57.0

### Bug Fixes

- [#3398](https://github.com/microsoft/typespec/pull/3398) Fix decorators application for union variants
- [#3022](https://github.com/microsoft/typespec/pull/3022) Update to support new value types
- [#3430](https://github.com/microsoft/typespec/pull/3430) The emitted JSON Schema now doesn't make root schemas for TypeSpec types which do not have the @jsonSchema decorator or are contained in a namespace with that decorator. Instead, such schemas are put into the $defs of any root schema which references them, and are referenced using JSON Pointers.

### Bump dependencies

- [#3401](https://github.com/microsoft/typespec/pull/3401) Update dependencies - May 2024

### Features

- [#3557](https://github.com/microsoft/typespec/pull/3557) Add support for @oneOf decorator.


## 0.56.0

### Bump dependencies

- [#3169](https://github.com/microsoft/typespec/pull/3169) Update dependencies


## 0.55.0

### Bump dependencies

- [#3027](https://github.com/microsoft/typespec/pull/3027) Update dependencies


## 0.54.0

### Bug Fixes

- [#2977](https://github.com/microsoft/typespec/pull/2977) Respect compiler `noEmit` flag

### Bump dependencies

- [#2900](https://github.com/microsoft/typespec/pull/2900) Update dependencies


## 0.53.1

### Patch Changes

- e6a045b: Allow using default values for union property types
- Updated dependencies [e6a045b]
  - @typespec/compiler@0.53.1

## 0.53.0

### Patch Changes


## 0.52.0

Wed, 24 Jan 2024 05:46:53 GMT

### Updates

- Rename template parameters in preparation for named template argument instantiation.
- Update dependencies

## 0.51.0

Wed, 06 Dec 2023 19:40:58 GMT

### Updates

- Add support for simple literal default on model properties
- Added support for string template literals
- Fix: Enum with a value of `0` would have resulting in `type` of `string` and `number`
- Fix: Scalar constraints combine with base scalar constraints
- JsonSchema: Fix `@maxValueExclusive` setting `minimumExclusive` instead of `maximumExclusive`
- Report diagnostic instead of throwing errors in the case of duplicate ids or unknown scalar
- Add support for templated scalars.

## 0.50.0

Wed, 08 Nov 2023 00:07:17 GMT

### Updates

- Add TupleLiteral support.
- `TypeScript` use `types` entry under `exports` of `package.json` instead of legacy `typesVersions` to provide the definition files
- **BREAKING CHANGE** Dropped support for node 16, minimum node version is now 18

## 0.49.0

Wed, 11 Oct 2023 23:31:35 GMT

### Updates

- Update dependencies
- Disable folding of serialized yaml if line is above 80 characters

## 0.48.0

Tue, 12 Sep 2023 21:47:11 GMT

### Updates

- Changed yaml parser from `js-yaml` to `yaml`
- Support decimal scalar types.

## 0.47.0

Tue, 08 Aug 2023 22:32:10 GMT

### Updates

- Uptake breaking change to `emitSourceFile` returning a `Promise`
- Fix: Crash when using interfaces inside a `@jsonSchema` namespace

## 0.46.0

Tue, 11 Jul 2023 22:06:00 GMT

### Updates

- Add support for enum member references.
- Export the emitter and related types from the package.
- Fix a bug that could result in a schema being bundled more than once.
- By default, types that are not marked with @jsonSchema or are within a namespace with @jsonSchema are bundled into the schemas that reference them. Set the `emitAllRefs` option to true to get the previous behavior of emitting all types referenced as JSON Schema.
- Support @extension for adding arbitrary vendor extensions into the output.
- Breaking change: the namespace has been corrected to TypeSpec.JsonSchema.
- Fix: Make sure `$lib` is exported
- Add support for Record<T>
- Support templates instantiated with intrinsic types and type expressions.
- Update dependencies

## 0.45.0

Tue, 06 Jun 2023 22:44:16 GMT

### Minor changes

- Add @typespec/json-schema for defining and emitting TypeSpec to standard JSON Schema
