// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

using System;
using System.Collections.Generic;
using System.Data.Common;
using System.Diagnostics;
using System.Linq;
using System.Reflection;
using System.Reflection.Metadata;
using System.Text;
using Microsoft.CodeAnalysis;
using Microsoft.TypeSpec.Generator.Expressions;
using Microsoft.TypeSpec.Generator.Primitives;
using Microsoft.TypeSpec.Generator.Providers;
using Microsoft.TypeSpec.Generator.Snippets;
using Microsoft.TypeSpec.Generator.Statements;
using Microsoft.TypeSpec.Generator.Utilities;
using static Microsoft.TypeSpec.Generator.Snippets.Snippet;

namespace Microsoft.TypeSpec.Generator
{
    internal sealed partial class CodeWriter : IDisposable
    {
        private const char _newLine = '\n';
        private const char _space = ' ';

        // Sentinel used in place of GlobalPrefix when writing types inside XML doc comments. The
        // ShortenQualifiedNames rewrite intentionally leaves these alone so Roslyn's Simplifier can
        // handle the cref reduction natively (and preserve cref-specific annotations like `?`); we
        // swap them back to "global::" right before returning the body.
        private const string GlobalDocSentinel = "global!doc::";
        private const string GlobalPrefix = "global::";

        private readonly HashSet<string> _usingNamespaces = new HashSet<string>();

        // Tracks every (namespace, headName) pair we've written as a global::-qualified name.
        // headName is the outermost named type (DeclaringType.Name for nested, otherwise Name).
        // Used in ToString() to drop redundant namespace prefixes (replaces the work NameReducer did).
        private readonly HashSet<(string Namespace, string HeadName)> _emittedTypeRefs = new();

        private readonly Stack<CodeScope> _scopes;
        private string? _currentNamespace;
        private TypeProvider? _primaryType;
        private UnsafeBufferSequence _builder;
        private bool _atBeginningOfLine;
        private bool _writingXmlDocumentation;
        private bool _writingNewInstance;
        internal CodeWriter()
            : this(null)
        {
        }

        internal CodeWriter(TypeProvider? primaryType)
        {
            _builder = new UnsafeBufferSequence(1024);
            _primaryType = primaryType;

            _scopes = new Stack<CodeScope>();
            _scopes.Push(new CodeScope(this, "", false, 0));
            _atBeginningOfLine = true;
        }

        public CodeScope Scope(FormattableString line, string start = "{", string end = "}", bool newLine = true)
        {
            CodeScope codeWriterScope = new CodeScope(this, end, newLine, _scopes.Peek().Depth + 1);
            WriteLine(line);
            WriteRawLine(start);
            _scopes.Push(codeWriterScope);
            return codeWriterScope;
        }

        public CodeScope Scope()
        {
            return ScopeRaw();
        }

        internal CodeScope ScopeRaw(string start = "{", string end = "}", bool newLine = true)
        {
            WriteRawLine(start);
            CodeScope codeWriterScope = new CodeScope(this, end, newLine, _scopes.Peek().Depth + 1);
            _scopes.Push(codeWriterScope);
            return codeWriterScope;
        }

        public CodeScope SetNamespace(string @namespace)
        {
            _currentNamespace = @namespace;
            WriteLine($"namespace {@namespace}");
            return Scope();
        }

        public CodeWriter Append(FormattableString formattableString)
        {
            if (formattableString.ArgumentCount == 0)
            {
                return AppendRaw(formattableString.ToString());
            }

            const string literalFormatString = ":L";
            const string declarationFormatString = ":D"; // :D :)
            const string identifierFormatString = ":I";
            const string crefFormatString = ":C"; // wraps content into "see cref" tag, available only in xmlDoc
            foreach ((var span, bool isLiteral, int index) in StringExtensions.GetFormattableStringFormatParts(formattableString.Format))
            {
                if (isLiteral)
                {
                    AppendRaw(span);
                    continue;
                }

                var argument = formattableString.GetArgument(index);
                var isDeclaration = span.EndsWith(declarationFormatString);
                var isIdentifier = span.EndsWith(identifierFormatString);
                var isLiteralFormat = span.EndsWith(literalFormatString);
                var isCref = span.EndsWith(crefFormatString);

                if (isCref)
                {
                    if (!_writingXmlDocumentation)
                    {
                        throw new InvalidOperationException($"':C' formatter can be used only inside XmlDoc");
                    }

                    switch (argument)
                    {
                        case Type t:
                            AppendTypeForCRef(new CSharpType(t));
                            break;
                        case CSharpType t:
                            AppendTypeForCRef(t);
                            break;
                        default:
                            Append($"<see cref=\"{argument}\"/>");
                            break;
                    }

                    continue;
                }

                switch (argument)
                {
                    case IEnumerable<FormattableString> fss:
                        foreach (var fs in fss)
                        {
                            Append(fs);
                        }
                        break;
                    case FormattableString fs:
                        Append(fs);
                        break;
                    case Type t:
                        AppendType(new CSharpType(t), false, false);
                        break;
                    case CSharpType t:
                        AppendType(t, isDeclaration, false);
                        break;
                    case CodeWriterDeclaration declaration when isDeclaration:
                        WriteDeclaration(declaration);
                        break;
                    case CodeWriterDeclaration declaration:
                        Append(declaration);
                        break;
                    case ValueExpression expression:
                        expression.Write(this);
                        break;
                    case var _ when isLiteralFormat:
                        Literal(argument).Write(this);
                        break;
                    case DateTimeOffset dto:
                        //windows and linux us different default dto ToString so we need to be explicit here
                        //using 02/03/0001 04:05:06 +00:00
                        AppendRaw(dto.ToString("MM/dd/yyyy HH:mm:ss zzz"));
                        break;
                    default:
                        string? s = argument?.ToString();
                        if (s == null)
                        {
                            throw new ArgumentNullException(index.ToString());
                        }

                        if (isDeclaration)
                        {
                            WriteDeclaration(s);
                        }
                        else if (isIdentifier)
                        {
                            WriteIdentifier(s);
                        }
                        else
                        {
                            AppendRaw(s);
                        }
                        break;
                }
            }

            return this;
        }

        public void WriteMethod(MethodProvider method)
        {
            ArgumentNullException.ThrowIfNull(method, nameof(method));

            using (WriteXmlDocs(method.XmlDocs))
            {
                if (method.BodyStatements is { } body)
                {
                    foreach (var suppression in method.Suppressions)
                    {
                        suppression.DisableStatement.Write(this);
                    }
                    using (WriteMethodDeclaration(method.Signature))
                    {
                        body.Write(this);
                    }
                    foreach (var suppression in method.Suppressions)
                    {
                        suppression.RestoreStatement.Write(this);
                    }
                }
                else if (method.BodyExpression is { } expression)
                {
                    foreach (var suppression in method.Suppressions)
                    {
                        suppression.DisableStatement.Write(this);
                    }
                    using (WriteMethodDeclarationNoScope(method.Signature))
                    {
                        AppendRaw(" => ");
                        expression.Write(this);
                        WriteRawLine(";");
                    }
                    foreach (var suppression in method.Suppressions)
                    {
                        suppression.RestoreStatement.Write(this);
                    }
                }
                else if (method.Signature.Modifiers.HasFlag(MethodSignatureModifiers.Partial)
                    || method.Signature.Modifiers.HasFlag(MethodSignatureModifiers.Abstract))
                {
                    using (WriteMethodDeclarationNoScope(method.Signature))
                    {
                        WriteRawLine(";");
                    }
                }
            }
        }

        public void WriteConstructor(ConstructorProvider ctor)
        {
            ArgumentNullException.ThrowIfNull(ctor, nameof(ctor));

            using (WriteXmlDocs(ctor.XmlDocs))
            {
                if (ctor.BodyStatements is { } body)
                {
                    foreach (var suppression in ctor.Suppressions)
                    {
                        suppression.DisableStatement.Write(this);
                    }

                    using (WriteMethodDeclaration(ctor.Signature))
                    {
                        body.Write(this);
                    }

                    foreach (var suppression in ctor.Suppressions)
                    {
                        suppression.RestoreStatement.Write(this);
                    }
                }
                else if (ctor.BodyExpression is { } expression)
                {
                    foreach (var suppression in ctor.Suppressions)
                    {
                        suppression.DisableStatement.Write(this);
                    }

                    using (WriteMethodDeclarationNoScope(ctor.Signature))
                    {
                        AppendRaw(" => ");
                        expression.Write(this);
                        WriteRawLine(";");
                    }

                    foreach (var suppression in ctor.Suppressions)
                    {
                        suppression.RestoreStatement.Write(this);
                    }
                }
            }
        }

        internal IDisposable WriteXmlDocs(XmlDocProvider? docs)
        {
            var scope = AmbientScope();
            if (CodeModelGenerator.Instance.Configuration.DisableXmlDocs || docs is null)
            {
                return scope;
            }

            WriteXmlDocsNoScope(docs);
            return scope;
        }

        internal void WriteXmlDocsNoScope(XmlDocProvider? docs)
        {
            if (CodeModelGenerator.Instance.Configuration.DisableXmlDocs || docs is null)
                return;

            if (docs.Inherit is not null)
            {
                docs.Inherit.Write(this);
                return; //skip all other docs
            }

            if (docs.Summary is not null)
            {
                docs.Summary.Write(this);
            }

            foreach (var param in docs.Parameters)
            {
                param.Write(this);
            }

            foreach (var exception in docs.Exceptions)
            {
                exception.Write(this);
            }

            if (docs.Returns is not null)
            {
                docs.Returns.Write(this);
            }
        }

        public void WriteProperty(PropertyProvider property)
        {
            WriteXmlDocsNoScope(property.XmlDocs);

            if (property.Attributes.Count > 0)
            {
                foreach (var attr in property.Attributes)
                {
                    attr.Write(this);
                }
            }

            CodeScope? indexerScope = null;

            var modifiers = property.Modifiers;
            AppendRawIf("public ", modifiers.HasFlag(MethodSignatureModifiers.Public))
                .AppendRawIf("protected ", modifiers.HasFlag(MethodSignatureModifiers.Protected))
                .AppendRawIf("internal ", modifiers.HasFlag(MethodSignatureModifiers.Internal))
                .AppendRawIf("private ", modifiers.HasFlag(MethodSignatureModifiers.Private))
                .AppendRawIf("new ", modifiers.HasFlag(MethodSignatureModifiers.New))
                .AppendRawIf("override ", modifiers.HasFlag(MethodSignatureModifiers.Override))
                .AppendRawIf("static ", modifiers.HasFlag(MethodSignatureModifiers.Static))
                .AppendRawIf("virtual ", modifiers.HasFlag(MethodSignatureModifiers.Virtual));

            AppendRawIf("ref ", property.IsRef);

            Append($"{property.Type} ");

            if (property.ExplicitInterface is not null)
            {
                Append($"{property.ExplicitInterface}.");
            }
            if (property is IndexPropertyProvider indexer)
            {
                indexerScope = AmbientScope();
                Append($"{indexer.Name}[{indexer.IndexerParameter.Type} {indexer.IndexerParameter.AsVariable().Declaration}]");
            }
            else
            {
                Append($"{property.Name:I}");
            }

            switch (property.Body)
            {
                case ExpressionPropertyBody(var getter, var setter):
                    if (setter is null)
                    {
                        getter.Write(AppendRaw(" => "));
                        AppendRaw(";");
                    }
                    else
                    {
                        WriteLine();
                        using (var scope = ScopeRaw(newLine: false))
                        {
                            getter.Write(AppendRaw("get => "));
                            WriteRawLine(";");
                            setter.Write(AppendRaw("set => "));
                            WriteRawLine(";");
                        }
                    }
                    break;
                case AutoPropertyBody(var hasSetter, var setterModifiers, var initialization):
                    AppendRaw(" { get;");
                    if (hasSetter)
                    {
                        AppendRaw(" ");
                        WritePropertyAccessorModifiers(setterModifiers);
                        AppendRaw("set;");
                    }
                    AppendRaw(" }");
                    if (initialization is not null)
                    {
                        initialization.Write(AppendRaw(" = "));
                        AppendRaw(";");
                    }
                    break;
                case MethodPropertyBody(var getter, var setter, var setterModifiers):
                    WriteLine();
                    using (ScopeRaw(newLine: false))
                    {
                        // write getter
                        WriteMethodPropertyAccessor("get", getter);
                        // write setter
                        if (setter is not null)
                        {
                            WriteMethodPropertyAccessor("set", setter, setterModifiers);
                        }
                    }
                    break;
                default:
                    throw new InvalidOperationException($"Unhandled property body type {property.Body}");
            }

            indexerScope?.Dispose();
            WriteLine();

            void WriteMethodPropertyAccessor(string name, MethodBodyStatement body, MethodSignatureModifiers modifiers = MethodSignatureModifiers.None)
            {
                WritePropertyAccessorModifiers(modifiers);
                WriteLine($"{name}");
                using (Scope())
                {
                    body.Write(this);
                }
            }

            void WritePropertyAccessorModifiers(MethodSignatureModifiers modifiers)
            {
                AppendRawIf("protected ", modifiers.HasFlag(MethodSignatureModifiers.Protected))
                    .AppendRawIf("internal ", modifiers.HasFlag(MethodSignatureModifiers.Internal))
                    .AppendRawIf("private ", modifiers.HasFlag(MethodSignatureModifiers.Private));
            }
        }

        public void UseNamespace(string @namespace)
        {
            if (_currentNamespace == @namespace)
            {
                return;
            }

            _usingNamespaces.Add(@namespace);
        }

        public CodeWriter AppendIf(FormattableString formattableString, bool condition)
        {
            if (condition)
            {
                Append(formattableString);
            }

            return this;
        }

        public CodeWriter AppendRawIf(string str, bool condition)
        {
            if (condition)
            {
                AppendRaw(str);
            }

            return this;
        }

        public void WriteParameter(ParameterProvider parameter)
        {
            if (parameter.Attributes.Count > 0)
            {
                parameter.Attributes[0].Write(this);
                for (int i = 1; i < parameter.Attributes.Count; i++)
                {
                    AppendRaw(" ");
                    parameter.Attributes[i].Write(this);
                }
            }

            AppendRawIf("out ", parameter.IsOut);
            AppendRawIf("in ", parameter.IsIn);
            AppendRawIf("ref ", parameter.IsRef);
            AppendRawIf("params ", parameter.IsParams);

            Append($"{parameter.Type} {parameter.AsVariable().Declaration}");
            if (parameter.DefaultValue != null)
            {
                AppendRaw(" = ");
                parameter.DefaultValue.Write(this);
            }
        }

        public CodeWriter WriteField(FieldProvider field)
        {
            WriteXmlDocsNoScope(field.XmlDocs);

            if (field.Attributes.Count > 0)
            {
                foreach (var attr in field.Attributes)
                {
                    attr.Write(this);
                }
            }

            var modifiers = field.Modifiers;

            AppendRaw(modifiers.HasFlag(FieldModifiers.Public) ? "public " : (modifiers.HasFlag(FieldModifiers.Internal) ? "internal " : "private "))
                .AppendRawIf("protected ", modifiers.HasFlag(FieldModifiers.Protected))
                .AppendRawIf("const ", modifiers.HasFlag(FieldModifiers.Const))
                .AppendRawIf("static ", modifiers.HasFlag(FieldModifiers.Static))
                .AppendRawIf("readonly ", modifiers.HasFlag(FieldModifiers.ReadOnly));

            if (field.Declaration.HasBeenDeclared(_scopes))
            {
                Append($"{field.Type} {field.Declaration:I}");
            }
            else
            {
                Append($"{field.Type} {field.Declaration:D}");
            }

            if (field.InitializationValue != null)
            {
                AppendRaw(" = ");
                field.InitializationValue.Write(this);
            }

            return WriteLine($";");
        }

        internal string GetTemporaryVariable(string s)
        {
            if (IsAvailable(s))
            {
                return s;
            }

            for (int i = 0; i < 100; i++)
            {
                var name = s + i;
                if (IsAvailable(name))
                {
                    return name;
                }
            }
            throw new InvalidOperationException("Can't find suitable variable name.");
        }

        private bool IsAvailable(string s)
        {
            if (_scopes.TryPeek(out var currentScope))
            {
                if (currentScope.AllDefinedIdentifiers.Contains(s))
                {
                    return false;
                }
            }

            foreach (CodeScope codeWriterScope in _scopes)
            {
                if (codeWriterScope.Identifiers.Contains(s))
                {
                    return false;
                }
            }

            return true;
        }

        private void AppendTypeForCRef(CSharpType type)
        {
            // Because of the limitations of type cref in XmlDoc
            // we add "?" nullability operator after `cref` block
            var isNullable = type is { IsNullable: true, IsValueType: true };
            var arguments = type.IsGenericType ? type.Arguments : null;

            type = type.WithNullable(false);
            if (type.IsGenericType)
            {
                type = type.GetGenericTypeDefinition();
            }

            AppendRaw($"<see cref=\"");
            AppendType(type, false, false);
            AppendRaw($"\"/>");

            if (isNullable)
            {
                AppendRaw("?");
            }

            if (arguments is not null)
            {
                for (int i = 0; i < arguments.Count; i++)
                {
                    var argument = arguments[i];
                    if (argument is { IsFrameworkType: true, FrameworkType.IsGenericParameter: true })
                    {
                        continue;
                    }

                    AppendRaw(" where <c>");
                    AppendType(type.Arguments[i], false, false);
                    AppendRaw("</c> is");
                    if (argument.IsArray)
                    {
                        AppendRaw(" an array of type ");
                        argument = argument.ElementType;
                    }
                    else
                    {
                        AppendRaw(" of type ");
                    }

                    // If argument type is non-generic, we can provide "see cref" for it
                    // Otherwise, just write its name
                    if (argument.IsGenericType)
                    {
                        AppendRaw("<c>");
                        AppendType(argument, false, true);
                        AppendRaw("</c>");
                    }
                    else
                    {
                        AppendTypeForCRef(argument);
                    }

                    if (i < arguments.Count - 1)
                        AppendRaw(",");
                }
            }
        }

        private void AppendType(CSharpType type, bool isDeclaration, bool writeTypeNameOnly, int genericDepth = 0)
        {
            if (type.IsArray && type.FrameworkType.GetGenericArguments().Any())
            {
                AppendType(type.FrameworkType.GetElementType()!, isDeclaration, writeTypeNameOnly, genericDepth);
                AppendRaw("[]");
                return;
            }

            if (type.TryGetCSharpFriendlyName(out var keywordName))
            {
                AppendRaw(keywordName);
                if (type.FrameworkType.IsGenericParameter && type.IsNullable)
                {
                    AppendRaw("?");
                }
            }
            else if (isDeclaration && !type.IsFrameworkType)
            {
                AppendRaw(type.Name);
            }
            else if (writeTypeNameOnly)
            {
                AppendRaw(type.Name);
            }
            else
            {
                UseNamespace(type.Namespace);
                // Use a distinct sentinel for types referenced from XML doc comments (crefs) so the
                // ToString rewrite below leaves them fully qualified. Roslyn's cref-aware reducer can
                // then normalize the cref signature itself (e.g. preserving `?` nullability annotations
                // on the parameter types) better than our string replacement could.
                if (_writingXmlDocumentation)
                {
                    AppendRaw(GlobalDocSentinel);
                }
                else
                {
                    _emittedTypeRefs.Add((type.Namespace, type.DeclaringType?.Name ?? type.Name));
                    AppendRaw(GlobalPrefix);
                }
                AppendRaw(type.Namespace);
                AppendRaw(".");
                if (type.DeclaringType is not null)
                    AppendRaw($"{type.DeclaringType.Name}.");
                AppendRaw(type.Name);
            }

            if (type.Arguments.Any())
            {
                AppendRaw(_writingXmlDocumentation ? "{" : "<");
                for (int i = 0; i < type.Arguments.Count; i++)
                {
                    AppendType(type.Arguments[i], false, writeTypeNameOnly, genericDepth + 1);
                    if (i != type.Arguments.Count - 1)
                    {
                        AppendRaw(_writingXmlDocumentation ? "," : ", ");
                    }
                }
                AppendRaw(_writingXmlDocumentation ? "}" : ">");
            }

            // Add '?' for nullable value types, but skip if we're writing new instance UNLESS we're inside generic type arguments
            if ((!_writingNewInstance || genericDepth > 0) && !isDeclaration && type is { IsNullable: true, IsValueType: true })
            {
                AppendRaw("?");
            }
        }

        public CodeWriter WriteLine(FormattableString formattableString)
        {
            Append(formattableString);
            return WriteLine();
        }

        public CodeWriter WriteLine() => AppendRawChar(_newLine);

        public CodeWriter WriteRawLine(string str)
        {
            AppendRaw(str);
            return WriteLine();
        }

        public CodeWriter AppendRaw(string str) => AppendRaw(str.AsSpan());

        private CodeWriter AppendRawChar(char c)
        {
            var destination = _builder.GetSpan(1);
            destination[0] = c;
            _builder.Advance(1);
            _atBeginningOfLine = true;
            return this;
        }

        private CodeWriter AppendRaw(ReadOnlySpan<char> span)
        {
            if (span.Length == 0 )
                return this;

            AddSpaces(span);

            var destination = _builder.GetSpan(span.Length);
            span.CopyTo(destination);
            _builder.Advance(span.Length);

            _atBeginningOfLine = span[span.Length - 1] == _newLine;
            return this;
        }

        private void AddSpaces(ReadOnlySpan<char> span)
        {
            // pre-processor directives do not need indentation
            if (span[0] == '#')
            {
                return;
            }

            int spaces = _atBeginningOfLine ? (_scopes.Peek().Depth) * 4 : 0;
            if (spaces == 0)
                return;

            var destination = _builder.GetSpan(spaces);
            destination.Slice(0, spaces).Fill(_space);
            _builder.Advance(spaces);
        }

        internal CodeWriter WriteIdentifier(string identifier)
        {
            if (_writingXmlDocumentation)
            {
                return AppendRaw(identifier.ToXmlDocIdentifierName());
            }
            if (StringExtensions.IsCSharpKeyword(identifier))
            {
                AppendRaw("@");
            }
            return AppendRaw(identifier);
        }

        internal CodeWriter WriteDeclaration(string declaration)
        {
            foreach (var scope in _scopes)
            {
                scope.AllDefinedIdentifiers.Add(declaration);
            }

            _scopes.Peek().Identifiers.Add(declaration);

            return WriteIdentifier(declaration);
        }

        public CodeWriter WriteDeclaration(CodeWriterDeclaration declaration)
        {
            var currentScope = _scopes.Peek();

            if (!declaration.HasBeenDeclared(_scopes))
            {
                declaration.SetActualName(GetTemporaryVariable(declaration.RequestedName), currentScope);
            }

            return WriteDeclaration(declaration.GetActualName(currentScope));
        }

        public IDisposable WriteMethodDeclaration(MethodSignatureBase methodBase, params string[] disabledWarnings)
        {
            var outerScope = WriteMethodDeclarationNoScope(methodBase, disabledWarnings);
            WriteLine();
            var innerScope = Scope();
            return Disposable.Create(() =>
            {
                innerScope.Dispose();
                outerScope.Dispose();
            });
        }

        public IDisposable WriteMethodDeclarationNoScope(MethodSignatureBase methodBase, params string[] disabledWarnings)
        {
            if (methodBase.NonDocumentComment is { } comment)
            {
                WriteLine($"// {comment}");
            }

            foreach (var attribute in methodBase.Attributes)
            {
                attribute.Write(this);
            }

            foreach (var disabledWarning in disabledWarnings)
            {
                WriteLine($"#pragma warning disable {disabledWarning}");
            }

            AppendRawIf("public ", methodBase.Modifiers.HasFlag(MethodSignatureModifiers.Public))
                .AppendRawIf("private ", methodBase.Modifiers.HasFlag(MethodSignatureModifiers.Private))
                .AppendRawIf("protected ", methodBase.Modifiers.HasFlag(MethodSignatureModifiers.Protected))
                .AppendRawIf("internal ", methodBase.Modifiers.HasFlag(MethodSignatureModifiers.Internal))
                .AppendRawIf("static ", methodBase.Modifiers.HasFlag(MethodSignatureModifiers.Static))
                .AppendRawIf("partial ", methodBase.Modifiers.HasFlag(MethodSignatureModifiers.Partial));

            if (methodBase is MethodSignature method)
            {
                AppendRawIf("virtual ", methodBase.Modifiers.HasFlag(MethodSignatureModifiers.Virtual))
                    .AppendRawIf("abstract ", methodBase.Modifiers.HasFlag(MethodSignatureModifiers.Abstract))
                    .AppendRawIf("override ", methodBase.Modifiers.HasFlag(MethodSignatureModifiers.Override))
                    .AppendRawIf("new ", methodBase.Modifiers.HasFlag(MethodSignatureModifiers.New))
                    .AppendRawIf("async ", methodBase.Modifiers.HasFlag(MethodSignatureModifiers.Async));

                var isImplicit = methodBase.Modifiers.HasFlag(MethodSignatureModifiers.Implicit);
                var isImplicitOrExplicit = isImplicit || methodBase.Modifiers.HasFlag(MethodSignatureModifiers.Explicit);
                if (!isImplicitOrExplicit)
                {
                    if (method.ReturnType != null)
                    {
                        Append($"{method.ReturnType} ");
                    }
                    else
                    {
                        AppendRaw("void ");
                    }
                }

                AppendRawIf("implicit ", methodBase.Modifiers.HasFlag(MethodSignatureModifiers.Implicit))
                    .AppendRawIf("explicit ", methodBase.Modifiers.HasFlag(MethodSignatureModifiers.Explicit))
                    .AppendRawIf("operator ", methodBase.Modifiers.HasFlag(MethodSignatureModifiers.Operator));

                if (method.ExplicitInterface is not null)
                {
                    Append($"{method.ExplicitInterface}.");
                }

                if (isImplicit)
                {
                    // Implicit operator method name is just the return type.
                    // But we need to include the actual CSharpType so that the correct namespace using gets written.
                    AppendIf($"{method.ReturnType}", method.ReturnType is not null);
                }
                else
                {
                    Append($"{methodBase.Name}");
                }

                if (method?.GenericArguments != null)
                {
                    AppendRaw("<");
                    for (int i = 0; i < method.GenericArguments.Count; i++)
                    {
                        Append($"{method.GenericArguments[i]}");
                        if (i != method.GenericArguments.Count - 1)
                        {
                            AppendRaw(", ");
                        }
                    }
                    AppendRaw(">");
                }
            }
            else
            {
                Append($"{methodBase.Name}");
            }

            AppendRaw("(")
                .AppendRawIf("this ", methodBase.Modifiers.HasFlag(MethodSignatureModifiers.Extension));

            var outerScope = AmbientScope();

            for (int i = 0; i < methodBase.Parameters.Count; i++)
            {
                WriteParameter(methodBase.Parameters[i]);
                if (i != methodBase.Parameters.Count - 1)
                {
                    AppendRaw(", ");
                }
            }
            Append($")");

            if (methodBase is MethodSignature { GenericParameterConstraints: { } constraints })
            {
                using (ScopeRaw(string.Empty, string.Empty, false))
                {
                    for (int i = 0; i < constraints.Count; i++)
                    {
                        var constraint = constraints[i];
                        constraint.Write(this);
                        if (i < constraints.Count - 1)
                        {
                            AppendRaw(" ");
                        }
                    }
                }
            }

            if (methodBase is ConstructorSignature { Initializer: { } } constructor)
            {
                var (isBase, arguments) = constructor.Initializer;

                if (!isBase || arguments.Any())
                {
                    AppendRaw(isBase ? " : base(" : " : this(");
                    var iterator = arguments.GetEnumerator();
                    if (iterator.MoveNext())
                    {
                        iterator.Current.Write(this);
                        while (iterator.MoveNext())
                        {
                            AppendRaw(", ");
                            iterator.Current.Write(this);
                        }
                    }
                    AppendRaw(")");
                }
            }

            foreach (var disabledWarning in disabledWarnings)
            {
                WriteLine();
                Append($"#pragma warning restore {disabledWarning}");
            }

            return outerScope;
        }

        public override string ToString()
        {
            return ToString(true);
        }

        public string ToString(bool header)
        {
            using var reader = _builder.ExtractReader();
            var totalLength = reader.Length;
            if (totalLength == 0)
                return string.Empty;

            // Materialize body into a single contiguous string so we can rewrite global::Namespace.HeadName
            // references to short forms. Allocates the final string in one shot via string.Create instead
            // of going through a StringBuilder middleman.
            // Only shorten when emitting a full file (header == true) - otherwise we'd return short
            // names without the matching using directives, which is invalid C# and breaks in-process
            // expression composition (e.g. CSharpType.ToString, MethodBodyStatement.ToString).
            if (totalLength > int.MaxValue)
            {
                throw new InvalidOperationException(
                    $"Generated file is too large to materialize as a string. Length was {totalLength}, max is {int.MaxValue}.");
            }
            string bodyText = string.Create((int)totalLength, reader, static (span, r) => r.CopyTo(span));
            if (header)
            {
                bodyText = ShortenQualifiedNames(bodyText);
            }
            else if (bodyText.Contains(GlobalDocSentinel))
            {
                bodyText = bodyText.Replace(GlobalDocSentinel, GlobalPrefix);
            }

            var builder = new StringBuilder(bodyText.Length + 256);
            IEnumerable<string> namespaces = _usingNamespaces
                .OrderByDescending(ns => ns.StartsWith("System"))
                .ThenBy(ns => ns, StringComparer.Ordinal);
            if (header)
            {
                string licenseString = CodeModelGenerator.Instance.LicenseHeader;
                if (!string.IsNullOrEmpty(licenseString))
                {
                    // split license string into lines on new line
                    var lines = licenseString.Split(["\n", "\r\n"], StringSplitOptions.RemoveEmptyEntries);
                    foreach (var line in lines)
                    {
                        builder.Append("// ");
                        builder.Append(line);
                        builder.Append(_newLine);
                    }
                    builder.Append(_newLine);
                }
                builder.Append("// <auto-generated/>");
                builder.Append(_newLine);
                builder.Append(_newLine);
                builder.Append("#nullable disable");
                builder.Append(_newLine);
                builder.Append(_newLine);

                foreach (string ns in namespaces)
                {
                    builder.Append("using ").Append(ns).Append(";").Append(_newLine);
                }

                if (namespaces.Any())
                {
                    builder.Append(_newLine);
                }
            }

            builder.Append(bodyText);
            return builder.ToString();
        }

        // Replaces fully-qualified `global::Namespace.HeadName...` occurrences in the body with the
        // shortest unambiguous form. For head names emitted from a single namespace, drops the entire
        // `global::Namespace.` prefix (they resolve via the using directives we emit). For head names
        // emitted from multiple namespaces, drops only `global::` to keep them disambiguated.
        // Replacements are applied in descending key length order so longer prefixes win over shorter
        // ones (e.g. `global::ns.FooBar` is rewritten before `global::ns.Foo`).
        private string ShortenQualifiedNames(string bodyText)
        {
            if (_emittedTypeRefs.Count == 0)
            {
                if (bodyText.Contains(GlobalDocSentinel))
                {
                    bodyText = bodyText.Replace(GlobalDocSentinel, GlobalPrefix);
                }
                return bodyText;
            }

            // Only shorten references whose namespace is "safe" - either the current namespace
            // (or an ancestor of it, since C# scoping makes those names directly visible), or a
            // System.* namespace. Other cross-namespace references are left as `global::Ns.X`
            // so Roslyn's Simplifier can handle them safely - it has access to the full
            // SemanticModel including external assemblies (e.g. NuGet packages) and can
            // correctly account for collisions and visibility that this purely-textual rewriter
            // cannot. This also keeps PostProcessor.RemoveAsync's reference search reliable,
            // since SymbolFinder.FindReferencesAsync can miss references when the text resolves
            // ambiguously (e.g. a generated `OpenAI.X` type referenced by simple name in a
            // project that also imports the OpenAI NuGet namespace).
            string[]? currentParts = _currentNamespace?.Split('.');

            // Compute member-name collisions for the same-namespace case: an unqualified
            // reference like `Foo` inside the primary type's body would resolve to a member
            // named `Foo` instead of the type, so we need to prepend the current namespace's
            // last segment in that case.
            var memberCollisions = ComputePrimaryTypeMemberCollisions();

            // Determine which head names from System.* namespaces are ambiguous and need to
            // stay partially qualified (e.g. `System.Threading.Tasks.Task` vs `Task` from
            // another System sub-namespace).
            HashSet<string>? systemCollisions = null;
            var seenSystemHeads = new Dictionary<string, string>();
            foreach (var (ns, headName) in _emittedTypeRefs)
            {
                if (!IsSystemNamespace(ns))
                    continue;
                if (seenSystemHeads.TryGetValue(headName, out var existingNs))
                {
                    if (existingNs != ns)
                    {
                        systemCollisions ??= new HashSet<string>();
                        systemCollisions.Add(headName);
                    }
                }
                else
                {
                    seenSystemHeads[headName] = ns;
                }
            }

            foreach (var (ns, headName) in _emittedTypeRefs.OrderByDescending(t => t.Namespace.Length + t.HeadName.Length))
            {
                bool isSameOrAncestorNamespace = IsSameOrAncestorNamespace(ns, currentParts);
                bool isSystem = IsSystemNamespace(ns);
                if (!isSameOrAncestorNamespace && !isSystem)
                {
                    continue;
                }

                var qualified = $"{GlobalPrefix}{ns}.{headName}";
                string replacement;
                if (isSameOrAncestorNamespace)
                {
                    replacement = ComputeShortestQualifiedForm(ns, headName, currentParts, memberCollisions);
                }
                else if (systemCollisions is not null && systemCollisions.Contains(headName))
                {
                    // Ambiguous System head names - keep partially qualified to disambiguate.
                    replacement = ComputeShortestQualifiedForm(ns, headName, currentParts, memberCollisions: null);
                }
                else if (memberCollisions is not null && memberCollisions.Contains(headName))
                {
                    // The bare name would resolve to a member of the primary type; keep qualified.
                    continue;
                }
                else
                {
                    replacement = headName;
                }
                bodyText = bodyText.Replace(qualified, replacement);
            }

            // Swap the XML-doc sentinel back to "global::" so Roslyn's Simplifier can process those
            // crefs normally during post-processing.
            if (bodyText.Contains(GlobalDocSentinel))
            {
                bodyText = bodyText.Replace(GlobalDocSentinel, GlobalPrefix);
            }

            return bodyText;
        }

        private static bool IsSystemNamespace(string ns)
        {
            return ns == "System" || ns.StartsWith("System.", StringComparison.Ordinal);
        }

        // Returns true if `ns` is the current namespace or an ancestor of it. C# scoping rules
        // make types in ancestor namespaces visible by their unqualified names from a more
        // deeply-nested namespace (e.g. from `Foo.Bar.Models`, a type in `Foo` or `Foo.Bar` can
        // be referenced by its head name).
        private static bool IsSameOrAncestorNamespace(string ns, string[]? currentParts)
        {
            if (currentParts is null)
            {
                return false;
            }
            var nsParts = ns.Split('.');
            if (nsParts.Length > currentParts.Length)
            {
                return false;
            }
            for (int i = 0; i < nsParts.Length; i++)
            {
                if (nsParts[i] != currentParts[i])
                {
                    return false;
                }
            }
            return true;
        }

        // Returns the shortest unambiguous form of `ns.headName` when viewed from `_currentNamespace`.
        // Strips the longest prefix of `ns` shared with the current namespace, producing a relative
        // form like `ServiceA.ServiceA` from inside `Sample` for `Sample.ServiceA.ServiceA`. If the
        // result would be just the bare head name and that head name is shadowed by a member of the
        // primary type, prepends the closest namespace segment (e.g. `Models.Extension` from inside
        // `Foo.Bar.Models` for `Foo.Bar.Models.Extension`). Falls back to the fully-qualified form
        // when no shorter form is unambiguous.
        private static string ComputeShortestQualifiedForm(
            string ns,
            string headName,
            string[]? currentParts,
            HashSet<string>? memberCollisions)
        {
            var nsParts = ns.Split('.');
            int lcp = 0;
            if (currentParts is not null)
            {
                while (lcp < nsParts.Length && lcp < currentParts.Length && nsParts[lcp] == currentParts[lcp])
                {
                    lcp++;
                }
            }

            // If the full namespace is shared with the current namespace, the bare head name is
            // ordinarily unambiguous - but if a member of the primary type shadows it, we need to
            // prepend the last namespace segment (which refers to the current namespace itself).
            if (lcp == nsParts.Length)
            {
                if (memberCollisions is not null && memberCollisions.Contains(headName) && nsParts.Length > 0)
                {
                    return $"{nsParts[nsParts.Length - 1]}.{headName}";
                }
                return headName;
            }

            // Strip the shared prefix; the remaining first segment is itself a sub/sibling namespace
            // visible from the current namespace, which makes the qualifier valid without `global::`.
            var sb = new StringBuilder();
            for (int i = lcp; i < nsParts.Length; i++)
            {
                sb.Append(nsParts[i]).Append('.');
            }
            sb.Append(headName);
            return sb.ToString();
        }

        // Returns the set of member names declared on the primary type being written (and any
        // sibling partial-class TypeProvider parts in the same namespace, e.g. serialization
        // providers). Type references inside the type whose head name matches a member name
        // would resolve to the member, so they must remain qualified.
        private HashSet<string>? ComputePrimaryTypeMemberCollisions()
        {
            if (_primaryType is null)
            {
                return null;
            }

            var generator = CodeModelGenerator.Instance;
            if (generator?.OutputLibrary is not { AreTypeProvidersBuilt: true } outputLibrary)
            {
                return null;
            }

            HashSet<string>? names = null;
            HashSet<string>? ownNames = null;
            var primaryNs = _primaryType.Type.Namespace;
            var primaryName = _primaryType.Type.Name;
            foreach (var typeProvider in outputLibrary.TypeProviders)
            {
                // Include the primary type plus any sibling partial parts (same name + namespace),
                // such as separate model + serialization providers that compile into one class.
                if (typeProvider != _primaryType &&
                    (typeProvider.Type.Name != primaryName || typeProvider.Type.Namespace != primaryNs))
                {
                    continue;
                }
                // "Own" members (declared on the primary type or its serialization partials) -
                // we'll filter out the type's own name from these (a constructor named after the
                // type doesn't shadow the type name within its own body).
                CollectMemberNames(typeProvider, ref ownNames);
                foreach (var serialization in typeProvider.SerializationProviders)
                {
                    CollectMemberNames(serialization, ref ownNames);
                }
                // Inherited members from base types DO shadow the type name - if a base class
                // exposes a property named the same as this type, that property wins over the
                // type reference inside instance method bodies.
                var baseProvider = typeProvider.BaseTypeProvider;
                while (baseProvider is not null)
                {
                    CollectMemberNames(baseProvider, ref names);
                    baseProvider = baseProvider.BaseTypeProvider;
                }
            }

            if (ownNames is not null)
            {
                ownNames.Remove(primaryName);
                if (names is null)
                {
                    names = ownNames;
                }
                else
                {
                    names.UnionWith(ownNames);
                }
            }

            return names;
        }

        private static void CollectMemberNames(TypeProvider typeProvider, ref HashSet<string>? names)
        {
            // Only properties, fields, events and nested types can shadow a same-named type
            // reference within the class body. Methods (including constructors) live in a
            // separate lookup category and do not shadow types.
            foreach (var property in typeProvider.Properties)
            {
                names ??= new HashSet<string>(StringComparer.Ordinal);
                names.Add(property.Name);
            }
            foreach (var field in typeProvider.Fields)
            {
                names ??= new HashSet<string>(StringComparer.Ordinal);
                names.Add(field.Name);
            }
            foreach (var nested in typeProvider.NestedTypes)
            {
                names ??= new HashSet<string>(StringComparer.Ordinal);
                names.Add(nested.Type.Name);
            }
        }

        private void PopScope(CodeScope expected)
        {
            var actual = _scopes.Pop();
            Debug.Assert(actual == expected);
        }

        public CodeScope AmbientScope()
        {
            var codeWriterScope = new CodeScope(this, null, false, _scopes.Peek().Depth);
            _scopes.Push(codeWriterScope);
            return codeWriterScope;
        }

        internal void Append(CodeWriterDeclaration declaration, bool referenceOnly = false)
        {
            if (declaration.HasBeenDeclared(_scopes))
            {
                WriteIdentifier(declaration.GetActualName(_scopes.Peek()));
            }
            else if (referenceOnly)
            {
                WriteIdentifier(declaration.RequestedName);
            }
            else
            {
                WriteDeclaration(declaration);
            }
        }

        internal void WriteTypeModifiers(TypeSignatureModifiers modifiers)
        {
            AppendRawIf("public ", modifiers.HasFlag(TypeSignatureModifiers.Public))
                .AppendRawIf("internal ", modifiers.HasFlag(TypeSignatureModifiers.Internal))
                .AppendRawIf("private ", modifiers.HasFlag(TypeSignatureModifiers.Private))
                .AppendRawIf("readonly ", modifiers.HasFlag(TypeSignatureModifiers.ReadOnly))
                .AppendRawIf("static ", modifiers.HasFlag(TypeSignatureModifiers.Static))
                .AppendRawIf("sealed ", modifiers.HasFlag(TypeSignatureModifiers.Sealed))
                .AppendRawIf("abstract ", modifiers.HasFlag(TypeSignatureModifiers.Abstract))
                .AppendRawIf("partial ", modifiers.HasFlag(TypeSignatureModifiers.Partial)); // partial must be the last to write otherwise compiler will complain

            AppendRawIf("class ", modifiers.HasFlag(TypeSignatureModifiers.Class))
                .AppendRawIf("struct ", modifiers.HasFlag(TypeSignatureModifiers.Struct))
                .AppendRawIf("enum ", modifiers.HasFlag(TypeSignatureModifiers.Enum))
                .AppendRawIf("interface ", modifiers.HasFlag(TypeSignatureModifiers.Interface));
        }

        public void WriteTypeArguments(IEnumerable<CSharpType>? typeArguments)
        {
            if (typeArguments is null || !typeArguments.Any())
            {
                return;
            }

            AppendRaw("<");
            var iterator = typeArguments.GetEnumerator();
            if (iterator.MoveNext())
            {
                Append($"{iterator.Current}");
                while (iterator.MoveNext())
                {
                    AppendRaw(", ");
                    Append($"{iterator.Current}");
                }
            }
            AppendRaw(">");
        }

        public void WriteArguments(IEnumerable<ValueExpression> arguments, bool useSingleLine = true)
        {
            if (useSingleLine)
            {
                AppendRaw("(");
                var iterator = arguments.GetEnumerator();
                if (iterator.MoveNext())
                {
                    iterator.Current.Write(this);
                    while (iterator.MoveNext())
                    {
                        AppendRaw(", ");
                        iterator.Current.Write(this);
                    }
                }
                AppendRaw(")");
            }
            else
            {
                AppendRaw("(");
                var iterator = arguments.GetEnumerator();
                if (iterator.MoveNext())
                {
                    using (ScopeRaw(string.Empty, string.Empty, false))
                    {
                        iterator.Current.Write(this);
                        while (iterator.MoveNext())
                        {
                            WriteRawLine(",");
                            iterator.Current.Write(this);
                        }
                    }
                }
                AppendRaw(")");
            }
        }

        public void Dispose()
        {
            _builder?.Dispose();
        }
    }
}
