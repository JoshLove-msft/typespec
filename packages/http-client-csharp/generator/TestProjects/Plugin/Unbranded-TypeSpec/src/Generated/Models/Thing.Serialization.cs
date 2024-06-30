// <auto-generated/>

#nullable disable

using System;
using System.ClientModel;
using System.ClientModel.Primitives;
using System.Collections.Generic;
using System.Text.Json;
using UnbrandedTypeSpec;

namespace UnbrandedTypeSpec.Models
{
    /// <summary></summary>
    public partial class Thing : IJsonModel<Thing>
    {
        private IDictionary<string, BinaryData> _serializedAdditionalRawData;

        internal Thing(string name, BinaryData requiredUnion, ThingRequiredLiteralString requiredLiteralString, ThingRequiredLiteralInt requiredLiteralInt, ThingRequiredLiteralFloat requiredLiteralFloat, bool requiredLiteralBool, ThingOptionalLiteralString optionalLiteralString, ThingOptionalLiteralInt optionalLiteralInt, ThingOptionalLiteralFloat optionalLiteralFloat, bool optionalLiteralBool, string requiredBadDescription, IList<int> optionalNullableList, IList<int> requiredNullableList, IDictionary<string, BinaryData> serializedAdditionalRawData)
        {
            Name = name;
            RequiredUnion = requiredUnion;
            RequiredLiteralString = requiredLiteralString;
            RequiredLiteralInt = requiredLiteralInt;
            RequiredLiteralFloat = requiredLiteralFloat;
            RequiredLiteralBool = requiredLiteralBool;
            OptionalLiteralString = optionalLiteralString;
            OptionalLiteralInt = optionalLiteralInt;
            OptionalLiteralFloat = optionalLiteralFloat;
            OptionalLiteralBool = optionalLiteralBool;
            RequiredBadDescription = requiredBadDescription;
            OptionalNullableList = optionalNullableList;
            RequiredNullableList = requiredNullableList;
            _serializedAdditionalRawData = serializedAdditionalRawData;
        }

        internal Thing()
        {
        }

        void IJsonModel<Thing>.Write(Utf8JsonWriter writer, ModelReaderWriterOptions options)
        {
            writer.WriteStartObject();
            JsonModelWriteCore(writer, options);
            writer.WriteEndObject();
        }

        /// <param name="writer"> The JSON writer. </param>
        /// <param name="options"> The client options for reading and writing models. </param>
        protected virtual void JsonModelWriteCore(Utf8JsonWriter writer, ModelReaderWriterOptions options)
        {
            string format = options.Format == "W" ? ((IPersistableModel<Thing>)this).GetFormatFromOptions(options) : options.Format;
            if (format != "J")
            {
                throw new FormatException($"The model {nameof(Thing)} does not support writing '{format}' format.");
            }
            writer.WritePropertyName("name"u8);
            writer.WriteStringValue(Name);
            writer.WritePropertyName("requiredUnion"u8);
#if NET6_0_OR_GREATER
            writer.WriteRawValue(RequiredUnion);
#else
            using (JsonDocument document = JsonDocument.Parse(RequiredUnion))
            {
                JsonSerializer.Serialize(writer, document.RootElement);
            }
#endif
            writer.WritePropertyName("requiredLiteralString"u8);
            writer.WriteStringValue(RequiredLiteralString.ToString());
            writer.WritePropertyName("requiredLiteralInt"u8);
            writer.WriteNumberValue(RequiredLiteralInt.ToSerialInt32());
            writer.WritePropertyName("requiredLiteralFloat"u8);
            writer.WriteNumberValue(RequiredLiteralFloat.ToSerialSingle());
            writer.WritePropertyName("requiredLiteralBool"u8);
            writer.WriteBooleanValue(RequiredLiteralBool);
            writer.WritePropertyName("optionalLiteralString"u8);
            writer.WriteStringValue(OptionalLiteralString.ToString());
            writer.WritePropertyName("optionalLiteralInt"u8);
            writer.WriteNumberValue(OptionalLiteralInt.ToSerialInt32());
            writer.WritePropertyName("optionalLiteralFloat"u8);
            writer.WriteNumberValue(OptionalLiteralFloat.ToSerialSingle());
            writer.WritePropertyName("optionalLiteralBool"u8);
            writer.WriteBooleanValue(OptionalLiteralBool);
            writer.WritePropertyName("requiredBadDescription"u8);
            writer.WriteStringValue(RequiredBadDescription);
            if (Optional.IsCollectionDefined(OptionalNullableList))
            {
                if (OptionalNullableList != null)
                {
                    writer.WritePropertyName("optionalNullableList"u8);
                    writer.WriteStartArray();
                    foreach (var item in OptionalNullableList)
                    {
                        writer.WriteNumberValue(item);
                    }
                    writer.WriteEndArray();
                }
                else
                {
                    writer.WriteNull("optionalNullableList"u8);
                }
            }
            if (RequiredNullableList != null && Optional.IsCollectionDefined(RequiredNullableList))
            {
                writer.WritePropertyName("requiredNullableList"u8);
                writer.WriteStartArray();
                foreach (var item in RequiredNullableList)
                {
                    writer.WriteNumberValue(item);
                }
                writer.WriteEndArray();
            }
            else
            {
                writer.WriteNull("requiredNullableList"u8);
            }
            if (options.Format != "W" && _serializedAdditionalRawData != null)
            {
                foreach (var item in _serializedAdditionalRawData)
                {
                    writer.WritePropertyName(item.Key);
#if NET6_0_OR_GREATER
                    writer.WriteRawValue(item.Value);
#else
                    using (JsonDocument document = JsonDocument.Parse(item.Value))
                    {
                        JsonSerializer.Serialize(writer, document.RootElement);
                    }
#endif
                }
            }
        }

        Thing IJsonModel<Thing>.Create(ref Utf8JsonReader reader, ModelReaderWriterOptions options)
        {
            throw new NotImplementedException("Not implemented");
        }

        BinaryData IPersistableModel<Thing>.Write(ModelReaderWriterOptions options)
        {
            throw new NotImplementedException("Not implemented");
        }

        Thing IPersistableModel<Thing>.Create(BinaryData data, ModelReaderWriterOptions options)
        {
            throw new NotImplementedException("Not implemented");
        }

        string IPersistableModel<Thing>.GetFormatFromOptions(ModelReaderWriterOptions options) => "J";

        /// <param name="thing"> The <see cref="Thing"/> to serialize into <see cref="BinaryContent"/>. </param>
        public static implicit operator BinaryContent(Thing thing)
        {
            throw new NotImplementedException("Not implemented");
        }

        /// <param name="result"> The <see cref="ClientResult"/> to deserialize the <see cref="Thing"/> from. </param>
        public static explicit operator Thing(ClientResult result)
        {
            throw new NotImplementedException("Not implemented");
        }
    }
}