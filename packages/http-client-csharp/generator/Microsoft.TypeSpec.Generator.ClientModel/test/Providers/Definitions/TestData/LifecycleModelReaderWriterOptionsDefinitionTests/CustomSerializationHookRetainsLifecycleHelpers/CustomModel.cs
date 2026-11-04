// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

using System.Text.Json;
using Microsoft.TypeSpec.Generator.Customizations;

namespace Sample.Models
{
    [CodeGenSerialization(nameof(StringProperty), SerializationValueHook = nameof(WriteValue))]
    public partial class CustomModel
    {
        private void WriteValue(Utf8JsonWriter writer)
        {
            var options = new LifecycleModelReaderWriterOptions(LifecycleVisibility.Create);
            writer.WriteStringValue(LifecycleModelReaderWriterOptions.IsVisible(options, LifecycleVisibility.Create)
                ? StringProperty : null);
        }
    }
}
