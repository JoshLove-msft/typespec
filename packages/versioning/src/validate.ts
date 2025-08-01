import {
  getNamespaceFullName,
  getTypeName,
  isTemplateInstance,
  isType,
  navigateProgram,
  type ModelProperty,
  type Namespace,
  type Program,
  type Type,
  type TypeNameOptions,
} from "@typespec/compiler";
import {
  $added,
  $removed,
  findVersionedNamespace,
  getMadeOptionalOn,
  getMadeRequiredOn,
  getRenamedFrom,
  getReturnTypeChangedFrom,
  getTypeChangedFrom,
  getUseDependencies,
} from "./decorators.js";
import { reportDiagnostic } from "./lib.js";
import type { Version } from "./types.js";
import { getVersionAdditionCodefixes, getVersionRemovalCodeFixes } from "./validate.codefix.js";
import {
  Availability,
  getAllVersions,
  getAvailabilityMap,
  getVersionDependencies,
  getVersions,
} from "./versioning.js";

const relationCacheKey = Symbol.for("TypeSpec.Versioning.NamespaceRelationCache");

export function getCachedNamespaceDependencies(
  program: Program,
): Map<Namespace | undefined, Set<Namespace>> | undefined {
  return (program as any)[relationCacheKey];
}

export function $onValidate(program: Program) {
  const namespaceDependencies = new Map<Namespace | undefined, Set<Namespace>>();

  function addNamespaceDependency(source: Namespace | undefined, target: Type | undefined) {
    if (!target || !("namespace" in target) || !target.namespace) {
      return;
    }
    const set = namespaceDependencies.get(source) ?? new Set<Namespace>();
    if (target.namespace !== source) {
      set.add(target.namespace);
    }
    namespaceDependencies.set(source, set);
  }
  (program as any)[relationCacheKey] = namespaceDependencies;

  navigateProgram(
    program,
    {
      model: (model) => {
        // If this is an instantiated type we don't want to keep the mapping.
        if (isTemplateInstance(model)) {
          return;
        }
        addNamespaceDependency(model.namespace, model.sourceModel);
        addNamespaceDependency(model.namespace, model.baseModel);
        for (const prop of model.properties.values()) {
          addNamespaceDependency(model.namespace, prop.type);

          // Validate model -> property have correct versioning
          validateTargetVersionCompatible(program, model, prop, {
            isTargetADependent: true,
          });

          // Validate model property -> type have correct versioning
          const typeChangedFrom = getTypeChangedFrom(program, prop);
          if (typeChangedFrom !== undefined) {
            validateMultiTypeReference(program, prop);
          } else {
            validateReference(program, prop, prop.type);
          }

          // Validate model property type is correct when madeOptional
          validateMadeOptional(program, prop);

          // Validate model property type is correct when madeRequired
          validateMadeRequired(program, prop);
        }
        validateVersionedPropertyNames(program, model);
      },
      union: (union) => {
        // If this is an instantiated type we don't want to keep the mapping.
        if (isTemplateInstance(union)) {
          return;
        }
        if (union.namespace === undefined) {
          return;
        }
        for (const variant of union.variants.values()) {
          addNamespaceDependency(union.namespace, variant.type);
        }
        validateVersionedPropertyNames(program, union);
      },
      operation: (op) => {
        // If this is an instantiated type we don't want to keep the mapping.
        if (isTemplateInstance(op)) {
          return;
        }

        const namespace = op.namespace ?? op.interface?.namespace;
        addNamespaceDependency(namespace, op.sourceOperation);
        addNamespaceDependency(namespace, op.returnType);
        if (op.interface) {
          validateTargetVersionCompatible(program, op.interface, op, { isTargetADependent: true });
        }
        validateReference(program, op, op.returnType);

        // Check that any spread/is/aliased models are valid for this operation
        for (const sourceModel of op.parameters.sourceModels) {
          validateReference(program, op, sourceModel.model);
        }

        for (const prop of op.parameters.properties.values()) {
          // Validate op -> property have correct versioning
          validateTargetVersionCompatible(program, op, prop, {
            isTargetADependent: true,
          });

          // Validate model property -> type have correct versioning
          const typeChangedFrom = getTypeChangedFrom(program, prop);
          if (typeChangedFrom !== undefined) {
            validateMultiTypeReference(program, prop);
          } else {
            validateReference(program, [prop, op], prop.type);
          }
        }
      },
      interface: (iface) => {
        for (const source of iface.sourceInterfaces) {
          validateReference(program, iface, source);
        }
      },
      namespace: (namespace) => {
        validateVersionEnumValuesUnique(program, namespace);
        const versionedNamespace = findVersionedNamespace(program, namespace);
        const dependencies = getVersionDependencies(program, namespace);
        if (dependencies === undefined) {
          return;
        }

        for (const [dependencyNs, value] of dependencies.entries()) {
          if (versionedNamespace) {
            const usingUseDependency = getUseDependencies(program, namespace, false) !== undefined;
            if (usingUseDependency) {
              reportDiagnostic(program, {
                code: "incompatible-versioned-namespace-use-dependency",
                target: namespace,
              });
            }
          } else {
            if (value instanceof Map) {
              reportDiagnostic(program, {
                code: "versioned-dependency-not-picked",
                format: { dependency: getNamespaceFullName(dependencyNs) },
                target: namespace,
              });
            }
          }
        }
      },
      enum: (en) => {
        validateVersionedPropertyNames(program, en);

        // construct the list of tuples in the old format if version
        // information is placed in the Version enum members
        const useDependencies = getUseDependencies(program, en);
        if (!useDependencies) {
          return;
        }
        for (const [depNs, deps] of useDependencies) {
          const set = new Set<Namespace>();
          if (deps instanceof Map) {
            for (const val of deps.values()) {
              set.add(val.namespace);
            }
          } else {
            set.add(deps.namespace);
          }
          namespaceDependencies.set(depNs, set);
        }
      },
    },
    { includeTemplateDeclaration: true },
  );
}

/**
 * Ensures that properties whose type has changed with versioning are valid.
 */
function validateMultiTypeReference(program: Program, source: Type, options?: TypeNameOptions) {
  const versionTypeMap = getVersionedTypeMap(program, source);
  if (versionTypeMap === undefined) return;
  for (const [version, type] of versionTypeMap!) {
    if (type === undefined) continue;
    validateTypeAvailability(program, version, type, source, options);
  }
}

/**
 * Ensures that a type is available in a given version.
 * For types that may wrap other types, e.g. unions, tuples, or template instances,
 * this function will recursively check the wrapped types.
 */
function validateTypeAvailability(
  program: Program,
  version: Version,
  targetType: Type,
  source: Type,
  options?: TypeNameOptions,
) {
  const typesToCheck: Type[] = [targetType];
  while (typesToCheck.length) {
    const type = typesToCheck.pop()!;
    const availMap = getAvailabilityMap(program, type);
    const availability = availMap?.get(version?.name) ?? Availability.Available;
    if (![Availability.Added, Availability.Available].includes(availability)) {
      reportDiagnostic(program, {
        code: "incompatible-versioned-reference",
        messageId: "doesNotExist",
        format: {
          sourceName: getTypeName(source, options),
          targetName: getTypeName(type, options),
          version: prettyVersion(version),
        },
        target: source,
        codefixes: getVersionAdditionCodefixes(version, type, program, options),
      });
    }

    if (isTemplateInstance(type)) {
      for (const arg of type.templateMapper.args) {
        if (isType(arg)) {
          typesToCheck.push(arg);
        }
      }
    } else if (type.kind === "Union") {
      for (const variant of type.variants.values()) {
        if (type.expression) {
          // Union expressions don't have decorators applied,
          // so we need to check the type directly.
          typesToCheck.push(variant.type);
        } else {
          // Named unions can have decorators applied,
          // so we need to check that the variant type is valid
          // for whatever decoration the variant has.
          validateTargetVersionCompatible(program, variant, variant.type);
        }
      }
    } else if (type.kind === "Tuple") {
      for (const value of type.values) {
        typesToCheck.push(value);
      }
    }
  }
}

/**
 * Constructs a map of version to name for the the source.
 */
function getVersionedNameMap(
  program: Program,
  source: Type,
): Map<Version, string | undefined> | undefined {
  const allVersions = getAllVersions(program, source);
  if (allVersions === undefined) return undefined;

  const map: Map<Version, string | undefined> = new Map(allVersions.map((v) => [v, undefined]));
  const availMap = getAvailabilityMap(program, source);
  const alwaysAvail = availMap === undefined;

  // Populate the map with any RenamedFrom data, which may have holes.
  // We will fill these holes in a later pass.
  const renamedFrom = getRenamedFrom(program, source);
  if (renamedFrom !== undefined) {
    for (const rename of renamedFrom) {
      const version = rename.version;
      const oldName = rename.oldName;
      const versionIndex = allVersions.indexOf(version);
      if (versionIndex !== -1) {
        map.set(allVersions[versionIndex - 1], oldName);
      }
    }
  }
  let lastName: string | undefined = undefined;
  switch (source.kind) {
    case "ModelProperty":
      lastName = source.name;
      break;
    case "UnionVariant":
      if (typeof source.name === "string") {
        lastName = source.name;
      }
      break;
    case "EnumMember":
      lastName = source.name;
      break;
    default:
      throw new Error(`Not implemented '${source.kind}'.`);
  }
  for (const version of allVersions.reverse()) {
    const isAvail =
      alwaysAvail ||
      [Availability.Added, Availability.Available].includes(availMap.get(version.name)!);

    // If property is unavailable in this version, it can't have a type
    if (!isAvail) {
      map.set(version, undefined);
      continue;
    }

    // Working backwards, we fill in any holes from the last type we encountered. Since we expect
    // to encounter a hole at the start, we use the raw property type
    const mapType = map.get(version);
    if (mapType !== undefined) {
      lastName = mapType;
    } else {
      map.set(version, lastName);
    }
  }
  return map;
}

/**
 * Constructs a map of version to type for the the source.
 */
function getVersionedTypeMap(
  program: Program,
  source: Type,
): Map<Version, Type | undefined> | undefined {
  const allVersions = getAllVersions(program, source);
  if (allVersions === undefined) return undefined;

  const map: Map<Version, Type | undefined> = new Map(allVersions.map((v) => [v, undefined]));
  const availMap = getAvailabilityMap(program, source);
  const alwaysAvail = availMap === undefined;

  // Populate the map with any typeChangedFrom data, which may have holes.
  // We will fill these holes in a later pass.
  const typeChangedFrom = getTypeChangedFrom(program, source);
  if (typeChangedFrom !== undefined) {
    for (const [version, type] of typeChangedFrom) {
      const versionIndex = allVersions.indexOf(version);
      if (versionIndex !== -1) {
        map.set(allVersions[versionIndex - 1], type);
      }
    }
  }
  let lastType: Type | undefined = undefined;
  switch (source.kind) {
    case "ModelProperty":
      lastType = source.type;
      break;
    default:
      throw new Error(`Not implemented '${source.kind}'.`);
  }
  for (const version of allVersions.reverse()) {
    const isAvail =
      alwaysAvail ||
      [Availability.Added, Availability.Available].includes(availMap.get(version.name)!);

    // If property is unavailable in this version, it can't have a type
    if (!isAvail) {
      map.set(version, undefined);
      continue;
    }

    // Working backwards, we fill in any holes from the last type we encountered. Since we expect
    // to encounter a hole at the start, we use the raw property type
    const mapType = map.get(version);
    if (mapType !== undefined) {
      lastType = mapType;
    } else {
      map.set(version, lastType);
    }
  }
  return map;
}

/**
 * Ensures that the version enum for a @versioned namespace has unique values.
 */
function validateVersionEnumValuesUnique(program: Program, namespace: Namespace) {
  const [_, versionMap] = getVersions(program, namespace);
  if (versionMap === undefined) return;
  const values = new Set(versionMap.getVersions().map((v) => v.value));
  if (versionMap.size !== values.size) {
    const enumName = versionMap.getVersions()[0].enumMember.enum.name;
    reportDiagnostic(program, {
      code: "version-duplicate",
      format: { name: enumName },
      target: namespace,
    });
  }
}

function validateVersionedPropertyNames(program: Program, source: Type) {
  const allVersions = getAllVersions(program, source);
  if (allVersions === undefined) return;

  const versionedNameMap = new Map<Version, string[]>(allVersions.map((v) => [v, []]));

  let values: Iterable<Type> = [];
  if (source.kind === "Model") {
    values = source.properties.values();
  } else if (source.kind === "Enum") {
    values = source.members.values();
  } else if (source.kind === "Union") {
    values = source.variants.values();
  }
  for (const value of values) {
    const nameMap = getVersionedNameMap(program, value);
    if (nameMap === undefined) continue;
    for (const [version, name] of nameMap) {
      if (name === undefined) continue;
      versionedNameMap.get(version)?.push(name);
    }
  }

  // for each version, ensure there are no duplicate property names
  for (const [version, names] of versionedNameMap.entries()) {
    // create a map with names to count of occurrences
    const nameCounts = new Map<string, number>();
    for (const name of names) {
      const count = nameCounts.get(name) ?? 0;
      nameCounts.set(name, count + 1);
    }
    // emit diagnostic for each duplicate name
    for (const [name, count] of nameCounts.entries()) {
      if (name === undefined) continue;
      if (count > 1) {
        reportDiagnostic(program, {
          code: "renamed-duplicate-property",
          format: {
            name: name,
            version: prettyVersion(version),
          },
          target: source,
        });
      }
    }
  }
}

function validateMadeOptional(program: Program, target: Type) {
  if (target.kind === "ModelProperty") {
    const madeOptionalOn = getMadeOptionalOn(program, target);
    if (!madeOptionalOn) {
      return;
    }
    // if the @madeOptional decorator is on a property it MUST be optional
    if (!target.optional) {
      reportDiagnostic(program, {
        code: "made-optional-not-optional",
        format: {
          name: target.name,
        },
        target: target,
      });
      return;
    }
  }
}

function validateMadeRequired(program: Program, target: Type) {
  if (target.kind === "ModelProperty") {
    const madeRequiredOn = getMadeRequiredOn(program, target);
    if (!madeRequiredOn) {
      return;
    }
    // if the @madeRequired decorator is on a property, it MUST NOT be optional
    if (target.optional) {
      reportDiagnostic(program, {
        code: "made-required-optional",
        format: {
          name: target.name,
        },
        target: target,
      });
      return;
    }
  }
}

interface IncompatibleVersionValidateOptions {
  isTargetADependent?: boolean;
}

/**
 * Validate the target reference versioning is compatible with the source versioning.
 * This will also validate any template arguments used in the reference.
 * e.g. The target cannot be added after the source was added.
 * @param source Source type referencing the target type.
 * @param target Type being referenced from the source
 */
function validateReference(program: Program, source: Type | Type[], target: Type) {
  validateTargetVersionCompatible(program, source, target);

  if ("templateMapper" in target) {
    for (const param of target.templateMapper?.args ?? []) {
      if (isType(param)) {
        validateReference(program, source, param);
      }
    }
  }

  switch (target.kind) {
    case "Union":
      if (typeof target.name !== "string") {
        for (const variant of target.variants.values()) {
          validateReference(program, source, variant.type);
        }
      }
      break;
    case "Tuple":
      for (const value of target.values) {
        validateReference(program, source, value);
      }
      break;
  }
}

interface ResolvedAvailability {
  map?: Map<string, Availability>;
  type: Type;
}

/**
 * Return the availability map for a type using the stack to include parent annotations.
 */
function resolveAvailabilityForStack(program: Program, type: Type | Type[]): ResolvedAvailability {
  const types = Array.isArray(type) ? type : [type];
  const first = types[0];
  const map = getAvailabilityMapFromStack(program, types);
  return { type: first, map };
}
/**
 * Return the availability map for a type using the stack to include parent annotations.
 */
function getAvailabilityMapFromStack(
  program: Program,
  typeStack: Type[],
): Map<string, Availability> | undefined {
  for (const type of typeStack) {
    const map = getAvailabilityMap(program, type);
    if (map) {
      return map;
    }
    switch (type.kind) {
      case "Operation": {
        const parentMap = type.interface && getAvailabilityMap(program, type.interface);
        if (parentMap) {
          return parentMap;
        }
        break;
      }
      case "ModelProperty": {
        const parentMap = type.model && getAvailabilityMap(program, type.model);
        if (parentMap) {
          return parentMap;
        }
        break;
      }
    }
  }
  return undefined;
}

/**
 * Validate the target versioning is compatible with the versioning of the source.
 * e.g. The target cannot be added after the source was added.
 * @param source Source type referencing the target type.
 * @param target Type being referenced from the source
 */
function validateTargetVersionCompatible(
  program: Program,
  source: Type | Type[],
  target: Type | Type[],
  validateOptions: IncompatibleVersionValidateOptions = {},
) {
  const sourceAvailability = resolveAvailabilityForStack(program, source);
  const [sourceNamespace] = getVersions(program, sourceAvailability.type);
  // If we cannot get source availability check if there is some different versioning across the stack which would mean we verify across namespace and is causing issues.
  if (sourceAvailability.map === undefined) {
    const sources = Array.isArray(source) ? source : [source];
    const baseNs = getVersions(program, sources[0]);
    for (const type of sources) {
      const ns = getVersions(program, type);
      if (ns !== baseNs) {
        return undefined;
      }
    }
  }
  const targetAvailability = resolveAvailabilityForStack(program, target);
  const [targetNamespace] = getVersions(program, targetAvailability.type);
  if (!targetAvailability.map || !targetNamespace) return;

  let versionMap: Map<Version, Version> | Version | undefined;
  if (sourceNamespace !== targetNamespace) {
    const dependencies = sourceNamespace && getVersionDependencies(program, sourceNamespace);
    versionMap = dependencies?.get(targetNamespace);
    if (versionMap === undefined) return;

    targetAvailability.map = translateAvailability(
      program,
      targetAvailability.map,
      versionMap,
      sourceAvailability.type,
      targetAvailability.type,
    );
    if (!targetAvailability.map) {
      return;
    }
  }

  if (validateOptions.isTargetADependent) {
    validateAvailabilityForContains(
      program,
      sourceAvailability.map,
      targetAvailability.map,
      sourceAvailability.type,
      targetAvailability.type,
    );
  } else {
    validateAvailabilityForRef(
      program,
      sourceAvailability.map,
      targetAvailability.map,
      sourceAvailability.type,
      targetAvailability.type,
      versionMap instanceof Map ? versionMap : undefined,
    );
  }
}

function translateAvailability(
  program: Program,
  avail: Map<string, Availability>,
  versionMap: Map<Version, Version> | Version,
  source: Type,
  target: Type,
): Map<string, Availability> | undefined {
  if (!(versionMap instanceof Map)) {
    const version = versionMap;
    if ([Availability.Removed, Availability.Unavailable].includes(avail.get(version.name)!)) {
      const addedAfter = findAvailabilityAfterVersion(version.name, Availability.Added, avail);
      const removedBefore = findAvailabilityOnOrBeforeVersion(
        version.name,
        Availability.Removed,
        avail,
      );
      if (addedAfter) {
        reportDiagnostic(program, {
          code: "incompatible-versioned-reference",
          messageId: "versionedDependencyAddedAfter",
          format: {
            sourceName: getTypeName(source),
            targetName: getTypeName(target),
            dependencyVersion: prettyVersion(version),
            targetAddedOn: addedAfter,
          },
          target: source,
          codefixes: getVersionAdditionCodefixes(version, target, program),
        });
      }
      if (removedBefore) {
        reportDiagnostic(program, {
          code: "incompatible-versioned-reference",
          messageId: "versionedDependencyRemovedBefore",
          format: {
            sourceName: getTypeName(source),
            targetName: getTypeName(target),
            dependencyVersion: prettyVersion(version),
            targetAddedOn: removedBefore,
          },
          target: source,
          codefixes: getVersionAdditionCodefixes(version, target, program),
        });
      }
    }
    return undefined;
  } else {
    const newAvail = new Map<string, Availability>();
    for (const [key, val] of versionMap) {
      const isAvail = avail.get(val.name)!;
      newAvail.set(key.name, isAvail);
    }
    return newAvail;
  }
}

function findAvailabilityAfterVersion(
  version: string,
  status: Availability,
  avail: Map<string, Availability>,
): string | undefined {
  let search = false;
  for (const [key, val] of avail) {
    if (version === key) {
      search = true;
      continue;
    }
    if (!search) continue;
    if (val === status) return key;
  }
  return undefined;
}

function findAvailabilityOnOrBeforeVersion(
  version: string,
  status: Availability,
  avail: Map<string, Availability>,
): string | undefined {
  let search = false;
  for (const [key, val] of avail) {
    if ([Availability.Added, Availability.Added].includes(val)) {
      search = true;
    }
    if (!search) continue;
    if (val === status) {
      return key;
    }
    if (key === version) {
      break;
    }
  }
  return undefined;
}

function validateAvailabilityForRef(
  program: Program,
  sourceAvail: Map<string, Availability> | undefined,
  targetAvail: Map<string, Availability>,
  source: Type,
  target: Type,
  versionMap?: Map<Version, Version>,
) {
  // if source is unversioned and target is versioned
  if (sourceAvail === undefined) {
    if (!isAvailableInAllVersion(targetAvail)) {
      const firstAvailableVersion = Array.from(targetAvail.entries())
        .filter(([_, val]) => val === Availability.Available || val === Availability.Added)
        .map(([key, _]) => key)
        .sort()
        .shift();
      reportDiagnostic(program, {
        code: "incompatible-versioned-reference",
        messageId: "default",
        format: {
          sourceName: getTypeName(source),
          targetName: getTypeName(target),
        },
        target: source,
        codefixes: firstAvailableVersion
          ? getVersionAdditionCodefixes(firstAvailableVersion, source, program)
          : undefined,
      });
    }
    return;
  }
  let keyValSource: string[] = [...sourceAvail.keys(), ...targetAvail.keys()];
  const sourceTypeChanged = getTypeChangedFrom(program, source);
  if (sourceTypeChanged !== undefined) {
    const sourceTypeChangedKeys = [...sourceTypeChanged.keys()].map((item) => item.name);
    keyValSource = [...keyValSource, ...sourceTypeChangedKeys];
  }
  const sourceReturnTypeChanged = getReturnTypeChangedFrom(program, source);
  if (sourceReturnTypeChanged !== undefined) {
    const sourceReturnTypeChangedKeys = [...sourceReturnTypeChanged.keys()].map(
      (item) => item.name,
    );
    keyValSource = [...keyValSource, ...sourceReturnTypeChangedKeys];
  }
  const keySet = new Set(keyValSource);

  for (const key of keySet) {
    const sourceVal = sourceAvail.get(key)!;
    const targetVal = targetAvail.get(key)!;
    if (
      [Availability.Added].includes(sourceVal) &&
      [Availability.Removed, Availability.Unavailable].includes(targetVal)
    ) {
      const targetAddedOn = findAvailabilityAfterVersion(key, Availability.Added, targetAvail);
      let targetVersion: Version | string = key;
      if (versionMap) {
        // the `key` here could have already been converted to source version string, thus we need to find the
        // original target version so that we can provide the correct codefix
        targetVersion = findMatchingTargetVersion(key, versionMap) ?? key;
      }

      reportDiagnostic(program, {
        code: "incompatible-versioned-reference",
        messageId: "addedAfter",
        format: {
          sourceName: getTypeName(source),
          targetName: getTypeName(target),
          sourceAddedOn: key,
          targetAddedOn: targetAddedOn!,
        },
        target: source,
        codefixes: getVersionAdditionCodefixes(targetVersion, target, program),
      });
    }
    if (
      [Availability.Removed].includes(sourceVal) &&
      [Availability.Unavailable].includes(targetVal)
    ) {
      const targetRemovedOn = findAvailabilityOnOrBeforeVersion(
        key,
        Availability.Removed,
        targetAvail,
      );

      let targetVersion: Version | string = key;
      if (versionMap) {
        targetVersion = findMatchingTargetVersion(key, versionMap) ?? key;
      }

      reportDiagnostic(program, {
        code: "incompatible-versioned-reference",
        messageId: "removedBefore",
        format: {
          sourceName: getTypeName(source),
          targetName: getTypeName(target),
          sourceRemovedOn: key,
          targetRemovedOn: targetRemovedOn!,
        },
        target: source,
        codefixes: getVersionAdditionCodefixes(targetVersion, target, program),
      });
    }
  }
}

function canIgnoreDependentVersioning(type: Type, versioning: "added" | "removed") {
  if (type.kind === "ModelProperty") {
    return canIgnoreVersioningOnProperty(type, versioning);
  }
  return false;
}

function canIgnoreVersioningOnProperty(
  prop: ModelProperty,
  versioning: "added" | "removed",
): boolean {
  if (prop.sourceProperty === undefined) {
    return false;
  }

  const decoratorFn = versioning === "added" ? $added : $removed;
  // Check if the decorator was defined on this property or a source property. If source property ignore.
  const selfDecorators = prop.decorators.filter((x) => x.decorator === decoratorFn);
  const sourceDecorators = prop.sourceProperty.decorators.filter(
    (x) => x.decorator === decoratorFn,
  );
  return !selfDecorators.some((x) => !sourceDecorators.some((y) => x.node === y.node));
}

function validateAvailabilityForContains(
  program: Program,
  sourceAvail: Map<string, Availability> | undefined,
  targetAvail: Map<string, Availability>,
  source: Type,
  target: Type,
  sourceOptions?: TypeNameOptions,
  targetOptions?: TypeNameOptions,
) {
  if (!sourceAvail) return;

  const keySet = new Set([...sourceAvail.keys(), ...targetAvail.keys()]);

  for (const key of keySet) {
    const sourceVal = sourceAvail.get(key)!;
    const targetVal = targetAvail.get(key)!;
    if (sourceVal === targetVal) continue;
    if (
      [Availability.Added].includes(targetVal) &&
      [Availability.Removed, Availability.Unavailable].includes(sourceVal) &&
      !canIgnoreDependentVersioning(target, "added")
    ) {
      const sourceAddedOn = findAvailabilityOnOrBeforeVersion(key, Availability.Added, sourceAvail);
      reportDiagnostic(program, {
        code: "incompatible-versioned-reference",
        messageId: "dependentAddedAfter",
        format: {
          sourceName: getTypeName(source, sourceOptions),
          targetName: getTypeName(target, targetOptions),
          sourceAddedOn: sourceAddedOn!,
          targetAddedOn: key,
        },
        target: target,
        codefixes: getVersionAdditionCodefixes(key, source, program, targetOptions),
      });
    }
    if (
      [Availability.Removed].includes(sourceVal) &&
      [Availability.Added, Availability.Available].includes(targetVal) &&
      !canIgnoreDependentVersioning(target, "removed")
    ) {
      const targetRemovedOn = findAvailabilityAfterVersion(key, Availability.Removed, targetAvail);
      reportDiagnostic(program, {
        code: "incompatible-versioned-reference",
        messageId: "dependentRemovedBefore",
        format: {
          sourceName: getTypeName(source),
          targetName: getTypeName(target),
          sourceRemovedOn: key,
          targetRemovedOn: targetRemovedOn!,
        },
        target: target,
        codefixes: getVersionRemovalCodeFixes(key, target, program, targetOptions),
      });
    }
  }
}

function isAvailableInAllVersion(avail: Map<string, Availability>): boolean {
  for (const val of avail.values()) {
    if ([Availability.Removed, Availability.Unavailable].includes(val)) return false;
  }
  return true;
}

function prettyVersion(version: Version | undefined): string {
  return version?.value ?? "<n/a>";
}

function findMatchingTargetVersion(
  sourceVersion: string,
  versionMap: Map<Version, Version>,
): Version | undefined {
  for (const [source, target] of versionMap.entries()) {
    if (source.value === sourceVersion) {
      return target;
    }
  }
  return undefined;
}
