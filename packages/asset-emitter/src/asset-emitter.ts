import {
  type EmitContext,
  type Model,
  type Namespace,
  type Program,
  type Type,
  compilerAssert,
  getTypeName,
  isTemplateDeclaration,
  joinPaths,
} from "@typespec/compiler";
import { $ } from "@typespec/compiler/typekit";
import { CustomKeyMap } from "./custom-key-map.js";
import { Placeholder } from "./placeholder.js";
import { resolveDeclarationReferenceScope } from "./ref-scope.js";
import { ReferenceCycle } from "./reference-cycle.js";
import { TypeEmitter } from "./type-emitter.js";
import {
  type AssetEmitter,
  CircularEmit,
  type ContextState,
  Declaration,
  type EmitEntity,
  type EmitTypeReferenceOptions,
  EmitterResult,
  type EmitterState,
  type LexicalTypeStackEntry,
  type NamespaceScope,
  NoEmit,
  RawCode,
  type Scope,
  type SourceFile,
  type SourceFileScope,
  type TypeEmitterMethod,
  type TypeSpecDeclaration,
} from "./types.js";

/**
 * Represent an entry in the reference chain.
 */
interface ReferenceChainEntry {
  method: string;
  type: Type;
  context: ContextState;
}

export function createAssetEmitter<T, TOptions extends object>(
  program: Program,
  TypeEmitterClass: typeof TypeEmitter<T, TOptions>,
  emitContext: EmitContext<TOptions>,
): AssetEmitter<T, TOptions> {
  const sourceFiles: SourceFile<T>[] = [];

  const options = {
    noEmit: program.compilerOptions.dryRun ?? false,
    emitterOutputDir: emitContext.emitterOutputDir,
    ...emitContext.options,
  };
  const typeId = CustomKeyMap.objectKeyer();
  const contextId = CustomKeyMap.objectKeyer();
  const entryId = CustomKeyMap.objectKeyer();

  // This is effectively a seen set, ensuring that we don't emit the same
  // type with the same context twice. So the map stores a triple of:
  //
  // 1. the method of TypeEmitter we would call
  // 2. the tsp type we're emitting.
  // 3. the current context.
  //
  // Note that in order for this to work, context needs to be interned so
  // contexts with the same values inside are treated as identical in the
  // map. See createInterner for more details.
  const typeToEmitEntity = new CustomKeyMap<[string, Type, ContextState], EmitEntity<T>>(
    ([method, type, context]) => {
      return `${method}-${typeId.getKey(type)}-${contextId.getKey(context)}`;
    },
  );

  // When we encounter a circular reference, this map will hold a callback
  // that should be called when the circularly referenced type has completed
  // its emit.
  const waitingCircularRefs = new CustomKeyMap<
    [string, Type, ContextState],
    {
      state: EmitterState;
      cb: (entity: EmitEntity<T>) => EmitEntity<T>;
    }[]
  >(([method, type, context]) => {
    return `${method}-${typeId.getKey(type)}-${contextId.getKey(context)}`;
  });

  // Similar to `typeToEmitEntity`, this ensures we don't recompute context
  // for types that we already have context for. Note that context is
  // dependent on the context of the context call, e.g. if a model is
  // referenced with reference context set we need to get its declaration
  // context again. So we use the context's context as a key. Context must
  // be interned, see createInterner for more details.
  const knownContexts = new CustomKeyMap<[LexicalTypeStackEntry, ContextState], ContextState>(
    ([entry, context]) => {
      return `${entryId.getKey(entry)}-${contextId.getKey(context)}`;
    },
  );

  // The stack of types that the currently emitted type is lexically
  // contained in. This gets pushed to when we visit a type that is
  // lexically contained in the current type, and is reset when we jump via
  // reference to another type in a different lexical context. Note that
  // this does not correspond to tsp's lexical nesting, e.g. in the case of
  // an alias to a model expression, the alias is lexically outside the
  // model, but in the type graph we will consider it to be lexically inside
  // whatever references the alias.
  let lexicalTypeStack: LexicalTypeStackEntry[] = [];
  let referenceTypeChain: ReferenceChainEntry[] = [];

  // Internally, context is is split between lexicalContext and
  // referenceContext because when a reference is made, we carry over
  // referenceContext but leave lexical context behind. When context is
  // accessed by the user, they are merged by getContext().
  let context: ContextState = {
    lexicalContext: {},
    referenceContext: {},
  };
  let programContext: ContextState | null = null;

  // Incoming reference context is reference context that comes from emitting a
  // type reference. Incoming reference context is only set on the
  // incomingReferenceContextTarget and types lexically contained within it. For
  // example, when referencing a model with reference context set, we may need
  // to get context from the referenced model's namespaces, and such namespaces
  // will not see the reference context. However, the reference context will be
  // available for the model, its properties, and any types nested within it
  // (e.g. anonymous models).
  let incomingReferenceContext: Record<string, string> | null = null;
  let incomingReferenceContextTarget: Type | null = null;
  const stateInterner = createInterner();
  const stackEntryInterner = createInterner();

  const assetEmitter: AssetEmitter<T, TOptions> = {
    getContext() {
      return {
        ...context.lexicalContext,
        ...context.referenceContext,
      };
    },

    getOptions() {
      return options;
    },

    getProgram() {
      return program;
    },

    result: {
      declaration(name, value) {
        const scope = currentScope();
        compilerAssert(
          scope,
          "Emit context must have a scope set in order to create declarations. Consider setting scope to a new source file's global scope in the `programContext` method of `TypeEmitter`.",
        );
        return new Declaration(name, scope, value);
      },
      rawCode(value) {
        return new RawCode(value);
      },
      none() {
        return new NoEmit();
      },
    },
    createScope(block, name, parentScope: Scope<T> | null = null) {
      let newScope: Scope<T>;
      if (!parentScope) {
        // create source file scope
        newScope = {
          kind: "sourceFile",
          name,
          sourceFile: block,
          parentScope,
          childScopes: [],
          declarations: [],
        } as SourceFileScope<T>;
      } else {
        newScope = {
          kind: "namespace",
          name,
          namespace: block,
          childScopes: [],
          declarations: [],
          parentScope,
        } as NamespaceScope<T>;
      }

      parentScope?.childScopes.push(newScope);
      return newScope as any; // the overload of createScope causes type weirdness
    },

    createSourceFile(path): SourceFile<T> {
      const basePath = options.emitterOutputDir;
      const sourceFile = {
        globalScope: undefined as any,
        path: joinPaths(basePath, path),
        imports: new Map(),
        meta: {},
      };
      sourceFile.globalScope = this.createScope(sourceFile, "");
      sourceFiles.push(sourceFile);
      return sourceFile;
    },

    emitTypeReference(target, options?: EmitTypeReferenceOptions): EmitEntity<T> {
      return withPatchedReferenceContext(options?.referenceContext, () => {
        const oldIncomingReferenceContext = incomingReferenceContext;
        const oldIncomingReferenceContextTarget = incomingReferenceContextTarget;

        incomingReferenceContext = context.referenceContext ?? null;
        incomingReferenceContextTarget = incomingReferenceContext ? target : null;

        let result;
        if (target.kind === "ModelProperty") {
          result = invokeTypeEmitter("modelPropertyReference", target);
        } else if (target.kind === "EnumMember") {
          result = invokeTypeEmitter("enumMemberReference", target);
        }

        if (result) {
          incomingReferenceContext = oldIncomingReferenceContext;
          incomingReferenceContextTarget = oldIncomingReferenceContextTarget;
          return result;
        }

        const entity = this.emitType(target);

        incomingReferenceContext = oldIncomingReferenceContext;
        incomingReferenceContextTarget = oldIncomingReferenceContextTarget;

        let placeholder: Placeholder<T> | null = null;

        if (entity.kind === "circular") {
          let waiting = waitingCircularRefs.get(entity.emitEntityKey);
          if (!waiting) {
            waiting = [];
            waitingCircularRefs.set(entity.emitEntityKey, waiting);
          }

          const typeChainSnapshot = referenceTypeChain;
          waiting.push({
            state: {
              lexicalTypeStack,
              context,
            },
            cb: (resolvedEntity) =>
              invokeReference(
                this,
                resolvedEntity,
                true,
                resolveReferenceCycle(typeChainSnapshot, entity, typeToEmitEntity as any),
              ),
          });

          placeholder = new Placeholder();
          return this.result.rawCode(placeholder);
        } else {
          return invokeReference(this, entity, false);
        }

        function invokeReference(
          assetEmitter: AssetEmitter<T, TOptions>,
          entity: EmitEntity<T>,
          circular: boolean,
          cycle?: ReferenceCycle,
        ): EmitEntity<T> {
          let ref;
          const scope = currentScope();

          if (circular) {
            ref = typeEmitter.circularReference(entity, scope, cycle!);
          } else {
            if (entity.kind !== "declaration") {
              return entity;
            }
            compilerAssert(
              scope,
              "Emit context must have a scope set in order to create references to declarations.",
            );
            const { pathUp, pathDown, commonScope } = resolveDeclarationReferenceScope(
              entity,
              scope,
            );
            ref = typeEmitter.reference(entity, pathUp, pathDown, commonScope);
          }

          if (!(ref instanceof EmitterResult)) {
            ref = assetEmitter.result.rawCode(ref) as RawCode<T>;
          }

          if (placeholder) {
            // this should never happen as this function shouldn't be called until
            // the target declaration is finished being emitted.
            compilerAssert(
              ref.kind !== "circular",
              "TypeEmitter `reference` returned circular emit",
            );

            // this could presumably be allowed if we want.
            compilerAssert(
              ref.kind === "none" || !(ref.value instanceof Placeholder),
              "TypeEmitter's `reference` method cannot return a placeholder.",
            );

            switch (ref.kind) {
              case "code":
              case "declaration":
                placeholder.setValue(ref.value as T);
                break;
              case "none":
                // this cast is incorrect, think about what should happen
                // if reference returns noEmit...
                placeholder.setValue("" as T);
                break;
            }
          }

          return ref;
        }
      });
    },

    emitDeclarationName(type): string | undefined {
      return typeEmitter.declarationName!(type);
    },

    async writeOutput() {
      return typeEmitter.writeOutput(sourceFiles);
    },

    getSourceFiles() {
      return sourceFiles;
    },

    emitType(type, context?: ContextState) {
      if (context?.referenceContext) {
        incomingReferenceContext = context?.referenceContext ?? incomingReferenceContext;
        incomingReferenceContextTarget = type ?? incomingReferenceContextTarget;
      }

      const declName =
        isDeclaration(type) && type.kind !== "Namespace" ? typeEmitter.declarationName(type) : null;
      const key = typeEmitterKey(type);
      let args: any[];
      switch (key) {
        case "scalarDeclaration":
        case "scalarInstantiation":
        case "modelDeclaration":
        case "modelInstantiation":
        case "operationDeclaration":
        case "interfaceDeclaration":
        case "interfaceOperationDeclaration":
        case "enumDeclaration":
        case "unionDeclaration":
        case "unionInstantiation":
          args = [declName];
          break;

        case "arrayDeclaration":
          const arrayDeclElement = (type as Model).indexer!.value;
          args = [declName, arrayDeclElement];
          break;
        case "arrayLiteral":
          const arrayLiteralElement = (type as Model).indexer!.value;
          args = [arrayLiteralElement];
          break;
        case "intrinsic":
          args = [declName];
          break;
        default:
          args = [];
      }

      const result = (invokeTypeEmitter as any)(key, type, ...args);

      return result;
    },

    emitProgram(options) {
      const namespace = program.getGlobalNamespaceType();
      if (options?.emitGlobalNamespace) {
        this.emitType(namespace);
        return;
      }

      for (const ns of namespace.namespaces.values()) {
        if (ns.name === "TypeSpec" && !options?.emitTypeSpecNamespace) continue;
        this.emitType(ns);
      }

      for (const model of namespace.models.values()) {
        if (!isTemplateDeclaration(model)) {
          this.emitType(model);
        }
      }

      for (const operation of namespace.operations.values()) {
        if (!isTemplateDeclaration(operation)) {
          this.emitType(operation);
        }
      }

      for (const enumeration of namespace.enums.values()) {
        this.emitType(enumeration);
      }

      for (const union of namespace.unions.values()) {
        if (!isTemplateDeclaration(union)) {
          this.emitType(union);
        }
      }

      for (const iface of namespace.interfaces.values()) {
        if (!isTemplateDeclaration(iface)) {
          this.emitType(iface);
        }
      }

      for (const scalar of namespace.scalars.values()) {
        this.emitType(scalar);
      }
    },

    emitModelProperties(model) {
      const res = invokeTypeEmitter("modelProperties", model);
      if (res instanceof EmitterResult) {
        return res as any;
      } else {
        return this.result.rawCode(res);
      }
    },

    emitModelProperty(property) {
      return invokeTypeEmitter("modelPropertyLiteral", property);
    },

    emitOperationParameters(operation) {
      return invokeTypeEmitter("operationParameters", operation, operation.parameters);
    },

    emitOperationReturnType(operation) {
      return invokeTypeEmitter("operationReturnType", operation, operation.returnType);
    },

    emitInterfaceOperations(iface) {
      return invokeTypeEmitter("interfaceDeclarationOperations", iface);
    },

    emitInterfaceOperation(operation) {
      const name = typeEmitter.declarationName(operation);
      if (name === undefined) {
        // the general approach of invoking the expression form doesn't work here
        // because TypeSpec doesn't have operation expressions.
        compilerAssert(false, "Unnamed operations are not supported");
      }
      return invokeTypeEmitter("interfaceOperationDeclaration", operation, name);
    },

    emitEnumMembers(en) {
      return invokeTypeEmitter("enumMembers", en);
    },

    emitUnionVariants(union) {
      return invokeTypeEmitter("unionVariants", union);
    },

    emitTupleLiteralValues(tuple) {
      return invokeTypeEmitter("tupleLiteralValues", tuple);
    },

    async emitSourceFile(sourceFile) {
      return await typeEmitter.sourceFile(sourceFile);
    },
  };

  const typeEmitter = new TypeEmitterClass(assetEmitter);
  return assetEmitter;

  /**
   * This function takes care of calling a method on the TypeEmitter to
   * convert it to some emitted output. It will return a cached type if we
   * have seen it before (and the context is the same). It will establish
   * the emit context by calling the appropriate methods before getting the
   * emit result. Also if a type emitter returns just a T or a
   * Placeholder<T>, it will convert that to a RawCode result.
   */
  function invokeTypeEmitter<TMethod extends TypeEmitterMethod>(
    method: TMethod,
    ...args: Parameters<TypeEmitter<T, TOptions>[TMethod]>
  ): EmitEntity<T> {
    const type = args[0];
    let entity: EmitEntity<T>;
    let emitEntityKey: [string, Type, ContextState];
    let cached = false;

    withTypeContext(method, args, () => {
      emitEntityKey = [method, type, context];
      const seenEmitEntity = typeToEmitEntity.get(emitEntityKey);

      if (seenEmitEntity) {
        entity = seenEmitEntity;
        cached = true;
        return;
      }

      typeToEmitEntity.set(emitEntityKey, new CircularEmit(emitEntityKey));
      compilerAssert(typeEmitter[method], `TypeEmitter doesn't have a method named ${method}.`);
      entity = liftToRawCode((typeEmitter[method] as any)(...args));
    });

    if (cached) {
      return entity!;
    }

    if (entity! instanceof Placeholder) {
      entity.onValue((v) => handleCompletedEntity(v));
      return entity;
    }

    handleCompletedEntity(entity!);

    return entity!;

    function handleCompletedEntity(entity: EmitEntity<T>) {
      typeToEmitEntity.set(emitEntityKey!, entity!);
      const waitingRefCbs = waitingCircularRefs.get(emitEntityKey!);
      if (waitingRefCbs) {
        for (const record of waitingRefCbs) {
          withContext(record.state, () => {
            record.cb(entity);
          });
        }
        waitingCircularRefs.set(emitEntityKey!, []);
      }

      if (entity!.kind === "declaration") {
        entity!.scope.declarations.push(entity!);
      }
    }

    function liftToRawCode(value: EmitEntity<T> | Placeholder<T> | T): EmitEntity<T> {
      if (value instanceof EmitterResult) {
        return value;
      }

      return assetEmitter.result.rawCode(value);
    }
  }

  function isInternalMethod(
    method: TypeEmitterMethod,
  ): method is Exclude<
    TypeEmitterMethod,
    | "interfaceDeclarationOperations"
    | "interfaceOperationDeclaration"
    | "operationParameters"
    | "operationReturnType"
    | "modelProperties"
    | "enumMembers"
    | "tupleLiteralValues"
    | "unionVariants"
  > {
    return (
      method === "interfaceDeclarationOperations" ||
      method === "interfaceOperationDeclaration" ||
      method === "operationParameters" ||
      method === "operationReturnType" ||
      method === "modelProperties" ||
      method === "enumMembers" ||
      method === "tupleLiteralValues" ||
      method === "unionVariants"
    );
  }
  /**
   * This helper takes a type and sets the `context` state to what it should
   * be in order to invoke the type emitter method for that type. This needs
   * to take into account the current context and any incoming reference
   * context.
   */
  function setContextForType<TMethod extends TypeEmitterMethod>(
    method: TMethod,
    args: Parameters<TypeEmitter<T, TOptions>[TMethod]>,
  ) {
    const type = args[0];
    let newTypeStack: LexicalTypeStackEntry[];

    // if we've walked into a new declaration, reset the lexical type stack
    // to the lexical containers of the current type.
    if (isDeclaration(type) && type.kind !== "Intrinsic" && !isInternalMethod(method)) {
      newTypeStack = [stackEntryInterner.intern({ method, args: stackEntryInterner.intern(args) })];
      let ns = type.namespace;
      while (ns) {
        if (ns.name === "") break;
        newTypeStack.unshift(
          stackEntryInterner.intern({ method: "namespace", args: stackEntryInterner.intern([ns]) }),
        );
        ns = ns.namespace;
      }
    } else {
      newTypeStack = [
        ...lexicalTypeStack,
        stackEntryInterner.intern({ method, args: stackEntryInterner.intern(args) }),
      ];
    }

    lexicalTypeStack = newTypeStack;

    if (!programContext) {
      programContext = stateInterner.intern({
        lexicalContext: typeEmitter.programContext(program),
        referenceContext: stateInterner.intern({}),
      });
    }

    // Establish our context by starting from program and walking up the type stack
    // and merging in context for each of the lexical containers.
    context = programContext;

    for (const entry of lexicalTypeStack) {
      if (incomingReferenceContext && entry.args[0] === incomingReferenceContextTarget) {
        // bring in any reference context so it is available for any types nested beneath this type.
        context = stateInterner.intern({
          lexicalContext: context.lexicalContext,
          referenceContext: stateInterner.intern({
            ...context.referenceContext,
            ...incomingReferenceContext,
          }),
        });
      }

      const seenContext = knownContexts.get([entry, context]);
      if (seenContext) {
        context = seenContext;
        continue;
      }

      const lexicalKey = entry.method + "Context";
      const referenceKey = entry.method + "ReferenceContext";

      if (keyHasContext(entry.method)) {
        compilerAssert(
          (typeEmitter as any)[lexicalKey],
          `TypeEmitter doesn't have a method named ${lexicalKey}`,
        );
      }

      if (keyHasReferenceContext(entry.method)) {
        compilerAssert(
          (typeEmitter as any)[referenceKey],
          `TypeEmitter doesn't have a method named ${referenceKey}`,
        );
      }

      const newContext = keyHasContext(entry.method)
        ? (typeEmitter as any)[lexicalKey](...entry.args)
        : {};

      const newReferenceContext = keyHasReferenceContext(entry.method)
        ? (typeEmitter as any)[referenceKey](...entry.args)
        : {};

      // assemble our new reference and lexical contexts.
      const newContextState = stateInterner.intern({
        lexicalContext: stateInterner.intern({
          ...context.lexicalContext,
          ...newContext,
        }),
        referenceContext: stateInterner.intern({
          ...context.referenceContext,
          ...newReferenceContext,
        }),
      });

      knownContexts.set([entry, context], newContextState);
      context = newContextState;
    }

    if (!isInternalMethod(method)) {
      referenceTypeChain = [
        ...referenceTypeChain,
        stackEntryInterner.intern({
          method,
          type,
          context,
        }),
      ];
    }
  }

  /**
   * Invoke the callback with the proper context for a given type.
   */
  function withTypeContext<TMethod extends TypeEmitterMethod>(
    method: TMethod,
    args: Parameters<TypeEmitter<T, TOptions>[TMethod]>,
    cb: () => void,
  ) {
    const oldContext = context;
    const oldTypeStack = lexicalTypeStack;
    const oldRefTypeStack = referenceTypeChain;

    setContextForType(method, args);

    cb();

    context = oldContext;
    lexicalTypeStack = oldTypeStack;
    referenceTypeChain = oldRefTypeStack;
  }

  function withPatchedReferenceContext<T>(
    referenceContext: Record<string, any> | undefined,
    cb: () => T,
  ): T {
    if (referenceContext !== undefined) {
      const oldContext = context;

      context = stateInterner.intern({
        lexicalContext: context.lexicalContext,
        referenceContext: stateInterner.intern({
          ...context.referenceContext,
          ...referenceContext,
        }),
      });

      const result = cb();
      context = oldContext;
      return result;
    } else {
      return cb();
    }
  }

  /**
   * Invoke the callback with the given context.
   */
  function withContext(newContext: EmitterState, cb: () => void) {
    const oldContext = context;
    const oldTypeStack = lexicalTypeStack;
    context = newContext.context;
    lexicalTypeStack = newContext.lexicalTypeStack;

    cb();

    context = oldContext;
    lexicalTypeStack = oldTypeStack;
  }

  function typeEmitterKey(type: Type) {
    switch (type.kind) {
      case "Model":
        if ($(program).array.is(type) && type.name === "Array") {
          // likely an array literal, though could be a bare reference to Array maybe?
          return "arrayLiteral";
        }

        if (type.name === "") {
          return "modelLiteral";
        }

        if (type.templateMapper) {
          return "modelInstantiation";
        }

        if (type.indexer && type.indexer.key!.name === "integer") {
          return "arrayDeclaration";
        }

        return "modelDeclaration";

      case "Namespace":
        return "namespace";
      case "ModelProperty":
        return "modelPropertyLiteral";
      case "StringTemplate":
        return "stringTemplate";
      case "Boolean":
        return "booleanLiteral";
      case "String":
        return "stringLiteral";
      case "Number":
        return "numericLiteral";
      case "Operation":
        if (type.interface) {
          return "interfaceOperationDeclaration";
        } else {
          return "operationDeclaration";
        }
      case "Interface":
        return "interfaceDeclaration";
      case "Enum":
        return "enumDeclaration";
      case "EnumMember":
        return "enumMember";
      case "Union":
        if (!type.name) {
          return "unionLiteral";
        }

        if (type.templateMapper) {
          return "unionInstantiation";
        }

        return "unionDeclaration";
      case "UnionVariant":
        return "unionVariant";
      case "Tuple":
        return "tupleLiteral";
      case "Scalar":
        if (type.templateMapper) {
          return "scalarInstantiation";
        } else {
          return "scalarDeclaration";
        }

      case "Intrinsic":
        return "intrinsic";
      default:
        compilerAssert(false, `Encountered type ${type.kind} which we don't know how to emit.`);
    }
  }
  function currentScope() {
    return context.referenceContext?.scope ?? context.lexicalContext?.scope ?? null;
  }
}

/**
 * Returns true if the given type is a declaration or an instantiation of a declaration.
 * @param type
 * @returns
 */
function isDeclaration(type: Type): type is TypeSpecDeclaration | Namespace {
  switch (type.kind) {
    case "Namespace":
    case "Interface":
    case "Enum":
    case "Operation":
    case "Scalar":
    case "Intrinsic":
      return true;

    case "Model":
      return type.name ? type.name !== "" && type.name !== "Array" : false;
    case "Union":
      return type.name ? type.name !== "" : false;
    default:
      return false;
  }
}

/**
 * An interner takes an object and returns either that same object, or a
 * previously seen object that has the identical shape.
 */
function createInterner() {
  type PlainObject = Record<string, any>;
  const emptyObject = {};
  // Root map: key = property count, value = Map of property names
  const root = new Map();

  function intern<T extends PlainObject>(object: T): T {
    if (object === null || typeof object !== "object") return object;
    const keys = Object.keys(object);
    if (keys.length === 0) return emptyObject as any;

    // Use property count as first-level key for efficiency
    let node = root.get(keys.length);
    if (!node) {
      node = new Map();
      root.set(keys.length, node);
    }

    // Sort keys for stable structure
    const sortedKeys = keys.sort();
    let curr = node;
    for (const key of sortedKeys) {
      if (!curr.has(key)) curr.set(key, new Map());
      curr = curr.get(key);
    }

    // Now curr is a map from values to interned objects
    // Use WeakMap for object values, Map for primitives
    let valueNode = curr.valueNode;
    if (!valueNode) {
      valueNode = new Map();
      curr.valueNode = valueNode;
    }

    // Build a tuple of values for this key order
    const values = sortedKeys.map((k) => object[k]);
    let leaf = valueNode;
    for (let i = 0; i < values.length; i++) {
      const v = values[i];
      const isObj = v && typeof v === "object";
      let next;
      if (isObj) {
        if (!leaf.has("obj")) leaf.set("obj", new WeakMap());
        next = leaf.get("obj");
        if (!next.has(v)) next.set(v, new Map());
        next = next.get(v);
      } else {
        if (!leaf.has("prim")) leaf.set("prim", new Map());
        next = leaf.get("prim");
        if (!next.has(v)) next.set(v, new Map());
        next = next.get(v);
      }
      leaf = next;
    }

    // At the leaf, check for existing interned object
    if (leaf.has("interned")) {
      return leaf.get("interned");
    }
    leaf.set("interned", object);
    return object;
  }

  return { intern };
}

const noContext = new Set<string>(["modelPropertyReference", "enumMemberReference"]);

function keyHasContext(key: keyof TypeEmitter<any, any>) {
  return !noContext.has(key);
}
const noReferenceContext = new Set<string>([
  ...noContext,
  "booleanLiteral",
  "stringTemplate",
  "stringLiteral",
  "numericLiteral",
  "scalarInstantiation",
  "enumMember",
  "enumMembers",
  "intrinsic",
]);

function keyHasReferenceContext(key: keyof TypeEmitter<any, any>): boolean {
  return !noReferenceContext.has(key);
}

function resolveReferenceCycle(
  stack: ReferenceChainEntry[],
  entity: CircularEmit,
  typeToEmitEntity: CustomKeyMap<[string, Type, ContextState], EmitEntity<unknown>>,
): ReferenceCycle {
  for (let i = stack.length - 1; i >= 0; i--) {
    if (stack[i].type === entity.emitEntityKey[1]) {
      return new ReferenceCycle(
        stack.slice(i).map((x) => {
          return {
            type: x.type,
            entity: typeToEmitEntity.get([x.method, x.type, x.context])!,
          };
        }),
      );
    }
  }
  throw new Error(
    `Couldn't resolve the circular reference stack for ${getTypeName(entity.emitEntityKey[1])}`,
  );
}
