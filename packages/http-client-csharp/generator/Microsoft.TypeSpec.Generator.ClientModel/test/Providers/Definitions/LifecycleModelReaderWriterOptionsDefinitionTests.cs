// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

using System.Linq;
using System.Threading.Tasks;
using Microsoft.TypeSpec.Generator.ClientModel.Providers;
using Microsoft.TypeSpec.Generator.Input;
using Microsoft.TypeSpec.Generator.Primitives;
using Microsoft.TypeSpec.Generator.Tests.Common;
using NUnit.Framework;

namespace Microsoft.TypeSpec.Generator.ClientModel.Tests.Providers.Definitions
{
    public class LifecycleModelReaderWriterOptionsDefinitionTests
    {
        [Test]
        public async Task CustomSerializationHookRetainsLifecycleHelpers()
        {
            var model = InputFactory.Model("CustomModel");
            await MockHelpers.LoadMockGeneratorAsync(inputModels: () => [model],
                compilation: async () => await Helpers.GetCompilationFromDirectoryAsync());
            var types = ScmCodeModelGenerator.Instance.OutputLibrary.TypeProviders;
            foreach (var type in types)
            {
                type.EnsureBuilt();
            }
            using var session = ProviderReferenceMapAnalyzer.PrepareForGeneration(types);
            Assert.IsTrue(types.OfType<LifecycleModelReaderWriterOptionsDefinition>().Any(session.ShouldWriteProvider));
            Assert.IsTrue(types.OfType<LifecycleVisibilityDefinition>().Any(session.ShouldWriteProvider));
        }

        [TestCase(false)]
        [TestCase(true)]
        public void OmitsUnusedLifecycleHelpers(bool hasModel)
        {
            var model = InputFactory.Model("PlainModel");
            MockHelpers.LoadMockGenerator(inputModels: () => hasModel ? [model] : []);

            AssertLifecycleHelpers(false);
        }

        [TestCase(false)]
        [TestCase(true)]
        public void IncludesLifecycleHelpersForModelProperties(bool readOnly)
        {
            var property = InputFactory.Property("Value", InputPrimitiveType.String, isReadOnly: readOnly);
            if (!readOnly)
            {
                property.Update(visibility: InputVisibility.Create);
            }
            var model = InputFactory.Model("LifecycleModel", properties: [property],
                usage: InputModelTypeUsage.Input | InputModelTypeUsage.Output | InputModelTypeUsage.MultipartFormData);
            MockHelpers.LoadMockGenerator(inputModels: () => [model]);

            AssertLifecycleHelpers(true);
        }

        [TestCase("nested")]
        [TestCase("array")]
        [TestCase("dictionary")]
        [TestCase("nullable")]
        [TestCase("union")]
        [TestCase("streaming")]
        [TestCase("base")]
        [TestCase("derived")]
        [TestCase("additional")]
        public void DetectsLifecycleVisibilityForRelatedModels(string relationship)
        {
            var property = InputFactory.Property("Value", InputPrimitiveType.String);
            property.Update(visibility: InputVisibility.Update);
            var lifecycleModel = InputFactory.Model("LifecycleModel", properties: [property]);
            InputType propertyType = relationship switch
            {
                "array" => InputFactory.Array(lifecycleModel),
                "dictionary" => InputFactory.Dictionary(lifecycleModel),
                "nullable" => new InputNullableType(lifecycleModel),
                "union" => InputFactory.Union([InputPrimitiveType.String, lifecycleModel]),
                "streaming" => new InputStreamingType("stream", "stream", lifecycleModel, ["application/jsonl"]),
                _ => lifecycleModel
            };
            var model = relationship switch
            {
                "base" => InputFactory.Model("RelatedModel", baseModel: lifecycleModel),
                "derived" => InputFactory.Model("RelatedModel", derivedModels: [lifecycleModel]),
                "additional" => InputFactory.Model("RelatedModel", additionalProperties: lifecycleModel),
                _ => InputFactory.Model("RelatedModel", properties: [InputFactory.Property("Related", propertyType)])
            };
            Assert.IsTrue(LifecycleModelReaderWriterOptionsDefinition.HasLifecycleVisibility(model, []));
        }

        [TestCase(false)]
        [TestCase(true)]
        public void RequestVisibilityIncludesLifecycleHelpersWithoutLifecycleModels(bool hasVisibility)
        {
            var bodyType = InputFactory.Array(InputPrimitiveType.Int32);
            var operation = InputFactory.Operation("Send",
                parameters: [InputFactory.BodyParameter("data", bodyType, isRequired: true)]);
            if (hasVisibility)
            {
                operation.Update(requestVisibility: InputVisibility.Create);
            }
            var method = InputFactory.BasicServiceMethod("Send", operation, parameters:
                [InputFactory.MethodParameter("data", bodyType, location: InputRequestLocation.Body, isRequired: true)]);
            var client = InputFactory.Client("TestClient");
            InputFactory.Client("ChildClient", parent: client, methods: [method]);
            MockHelpers.LoadMockGenerator(clients: () => [client]);

            AssertLifecycleHelpers(hasVisibility);
        }

        [TestCase(false)]
        [TestCase(true)]
        public void HandlesRecursiveModelGraphs(bool hasVisibility)
        {
            var reference = InputFactory.Property("Reference", InputPrimitiveType.String);
            var value = InputFactory.Property("Value", InputPrimitiveType.String);
            if (hasVisibility)
            {
                value.Update(visibility: InputVisibility.Create);
            }
            var first = InputFactory.Model("First", properties: [reference]);
            var second = InputFactory.Model("Second", properties: [InputFactory.Property("BackReference", first), value]);
            reference.Update(type: second);
            MockHelpers.LoadMockGenerator(inputModels: () => [first, second]);

            AssertLifecycleHelpers(hasVisibility);
        }

        private static void AssertLifecycleHelpers(bool expected)
        {
            var generator = ScmCodeModelGenerator.Instance;
            var types = generator.OutputLibrary.TypeProviders;
            foreach (var type in types)
            {
                type.EnsureBuilt();
            }
            using var session = ProviderReferenceMapAnalyzer.PrepareForGeneration(types);
            Assert.AreEqual(expected, session.ShouldWriteProvider(types.OfType<LifecycleModelReaderWriterOptionsDefinition>().Single()));
            Assert.AreEqual(expected, session.ShouldWriteProvider(types.OfType<LifecycleVisibilityDefinition>().Single()));
            Assert.IsFalse(generator.NonRootTypes.Any(t => t.EndsWith(".LifecycleModelReaderWriterOptions")));
            Assert.IsFalse(generator.NonRootTypes.Any(t => t.EndsWith(".LifecycleVisibility")));
        }

        [Test]
        public void UsesAnInternalVisibilityEnum()
        {
            MockHelpers.LoadMockGenerator();
            var provider = new LifecycleModelReaderWriterOptionsDefinition();
            var visibilityType = provider.Properties.Single().Type;

            Assert.IsTrue(visibilityType.IsEnum);
            Assert.IsFalse(visibilityType.IsPublic);
            Assert.AreEqual(visibilityType, provider.Constructors.Single().Signature.Parameters[0].Type);
            var isVisible = provider.Methods.Single();
            Assert.AreEqual(visibilityType, isVisible.Signature.Parameters[1].Type);
            Assert.IsTrue(isVisible.Signature.Modifiers.HasFlag(MethodSignatureModifiers.Static));
        }
    }
}
