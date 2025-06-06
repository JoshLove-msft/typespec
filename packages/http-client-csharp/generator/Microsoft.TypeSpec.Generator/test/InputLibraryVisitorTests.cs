// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

using System;
using Microsoft.TypeSpec.Generator.Input;
using Microsoft.TypeSpec.Generator.Providers;
using Microsoft.TypeSpec.Generator.Tests.Common;
using Moq;
using Moq.Protected;
using NUnit.Framework;

namespace Microsoft.TypeSpec.Generator.Tests
{
    public class InputLibraryVisitorTests
    {
#pragma warning disable CS8618 // Non-nullable field must contain a non-null value when exiting constructor. Consider declaring as nullable.
        private Mock<CodeModelGenerator> _mockGenerator;
        private Mock<LibraryVisitor> _mockVisitor;
        private Mock<InputLibrary> _mockInputLibrary;
#pragma warning restore CS8618 // Non-nullable field must contain a non-null value when exiting constructor. Consider declaring as nullable.

        [SetUp]
        public void Setup()
        {
            _mockGenerator = MockHelpers.LoadMockGenerator(
                createModelCore: inputModelType => new ModelProvider(inputModelType),
                createEnumCore: (inputEnumType, _) => EnumProvider.Create(inputEnumType));
            _mockVisitor = new Mock<LibraryVisitor> { CallBase = true };
            _mockInputLibrary = new Mock<InputLibrary>();
            _mockGenerator.Setup(p => p.InputLibrary).Returns(_mockInputLibrary.Object);
        }

        [Test]
        public void PreVisitsProperties()
        {
            _mockGenerator.Object.AddVisitor(_mockVisitor.Object);
            var inputModelProperty = InputFactory.Property("prop1", InputPrimitiveType.Any, true, true);
            var inputModel = InputFactory.Model("foo", access: "internal", usage: InputModelTypeUsage.Input, properties: [inputModelProperty]);

            _mockInputLibrary.Setup(l => l.InputNamespace).Returns(InputFactory.Namespace("test library", models: [inputModel]));

            _mockVisitor.Object.VisitLibrary(_mockGenerator.Object.OutputLibrary);

            _mockVisitor.Protected().Verify<TypeProvider>("PreVisitModel", Times.Once(), inputModel, ItExpr.Is<ModelProvider>(m => m.Name == new ModelProvider(inputModel).Name));
            _mockVisitor.Protected().Verify<PropertyProvider>("PreVisitProperty", Times.Once(), inputModelProperty, ItExpr.Is<PropertyProvider>(m => m.Name == new PropertyProvider(inputModelProperty, TestTypeProvider.Empty).Name));
        }

        [Test]
        public void PreVisitsEnum()
        {
            _mockGenerator.Object.AddVisitor(_mockVisitor.Object);
            var inputEnum = InputFactory.Int32Enum("enum", [("value", 1)], usage: InputModelTypeUsage.Input);
            var inputModelProperty = InputFactory.Property("prop1", inputEnum, true, true);
            var inputModel = InputFactory.Model("foo", access: "internal", usage: InputModelTypeUsage.Input, properties: [inputModelProperty]);

            _mockInputLibrary.Setup(l => l.InputNamespace).Returns(InputFactory.Namespace("test library", models: [inputModel]));

            _mockVisitor.Object.VisitLibrary(_mockGenerator.Object.OutputLibrary);

            _mockVisitor.Protected().Verify<TypeProvider>("PreVisitEnum", Times.Once(), inputEnum, ItExpr.Is<EnumProvider>(m => m.Name == EnumProvider.Create(inputEnum, null).Name));
        }

        [Test]
        public void PreVisitsModel()
        {
            _mockGenerator.Object.AddVisitor(_mockVisitor.Object);
            var inputEnum = InputFactory.Int32Enum("enum", [("value", 1)], usage: InputModelTypeUsage.Input);
            var inputModelProperty = InputFactory.Property("prop1", inputEnum, true, true);
            var inputModel = InputFactory.Model("foo", access: "internal", usage: InputModelTypeUsage.Input, properties: [inputModelProperty]);

            _mockInputLibrary.Setup(l => l.InputNamespace).Returns(InputFactory.Namespace("test library", models: [inputModel]));

            _mockVisitor.Object.VisitLibrary(_mockGenerator.Object.OutputLibrary);

            _mockVisitor.Protected().Verify<TypeProvider>("PreVisitModel", Times.Once(), inputModel, ItExpr.Is<ModelProvider>(m => m.Name == new ModelProvider(inputModel).Name));
        }

        [Test]
        public void RemovedInputModelCausesExceptionWhenReferencedInDifferentModel()
        {
            var inputModel1Property = InputFactory.Property("prop1", InputPrimitiveType.Any, true, true);
            var inputModel1 = InputFactory.Model("Model1", access: "internal", usage: InputModelTypeUsage.Input, properties: [inputModel1Property]);

            var inputModel2Property = InputFactory.Property("prop2", inputModel1, true, true);

            var inputModel2 = InputFactory.Model("Model2", access: "internal", usage: InputModelTypeUsage.Input, properties: [inputModel2Property]);

            _mockInputLibrary.Setup(l => l.InputNamespace).Returns(InputFactory.Namespace("test library", models: [inputModel1, inputModel2]));

            var visitor = new PreVisitor();
            _mockGenerator.Object.AddVisitor(visitor);
            Assert.Throws<InvalidOperationException>(() => visitor.VisitLibrary(_mockGenerator.Object.OutputLibrary));
        }

        [Test]
        public void CanCleanUpRemovedReferencesToRemovedModels()
        {
            var inputModel1Property = InputFactory.Property("prop1", InputPrimitiveType.Any, true, true);
            var inputModel1 = InputFactory.Model("Model1", access: "internal", usage: InputModelTypeUsage.Input, properties: [inputModel1Property]);

            var inputModel2Property = InputFactory.Property("prop2", inputModel1, true, true);

            var inputModel2 = InputFactory.Model("Model2", access: "internal", usage: InputModelTypeUsage.Input, properties: [inputModel2Property]);

            _mockInputLibrary.Setup(l => l.InputNamespace).Returns(InputFactory.Namespace("test library", models: [inputModel1, inputModel2]));

            var visitor = new PreVisitor(true);
            _mockGenerator.Object.AddVisitor(visitor);
            Assert.DoesNotThrow(() => visitor.VisitLibrary(_mockGenerator.Object.OutputLibrary));
        }

        private class PreVisitor : LibraryVisitor
        {
            private readonly bool _cleanupReference;

            public PreVisitor(bool cleanupReference = false)
            {
                _cleanupReference = cleanupReference;
            }
            protected internal override ModelProvider? PreVisitModel(InputModelType inputModel, ModelProvider? typeProvider)
            {
                if (inputModel.Name == "Model1")
                {
                    return null;
                }
                return base.PreVisitModel(inputModel, typeProvider);
            }

            protected internal override PropertyProvider? PreVisitProperty(InputProperty inputModelProperty, PropertyProvider? propertyProvider)
            {
                if (_cleanupReference && inputModelProperty.Type.Name == "Model1")
                {
                    return null;
                }
                return new PropertyProvider(inputModelProperty, new TestTypeProvider());
            }
        }
    }
}
