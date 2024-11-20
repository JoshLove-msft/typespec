// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
// Code generated by Microsoft (R) TypeSpec Code Generator.

package encode.duration.models;

import com.azure.core.annotation.Generated;
import com.azure.core.annotation.Immutable;
import com.azure.json.JsonReader;
import com.azure.json.JsonSerializable;
import com.azure.json.JsonToken;
import com.azure.json.JsonWriter;
import java.io.IOException;
import java.time.Duration;

/**
 * The Float64SecondsDurationProperty model.
 */
@Immutable
public final class Float64SecondsDurationProperty implements JsonSerializable<Float64SecondsDurationProperty> {
    /*
     * The value property.
     */
    @Generated
    private final double value;

    /**
     * Creates an instance of Float64SecondsDurationProperty class.
     * 
     * @param value the value value to set.
     */
    @Generated
    public Float64SecondsDurationProperty(Duration value) {
        if (value == null) {
            this.value = 0.0;
        } else {
            this.value = (double) value.toNanos() / 1000_000_000L;
        }
    }

    /**
     * Get the value property: The value property.
     * 
     * @return the value value.
     */
    @Generated
    public Duration getValue() {
        return Duration.ofNanos((long) (this.value * 1000_000_000L));
    }

    /**
     * {@inheritDoc}
     */
    @Generated
    @Override
    public JsonWriter toJson(JsonWriter jsonWriter) throws IOException {
        jsonWriter.writeStartObject();
        jsonWriter.writeDoubleField("value", this.value);
        return jsonWriter.writeEndObject();
    }

    /**
     * Reads an instance of Float64SecondsDurationProperty from the JsonReader.
     * 
     * @param jsonReader The JsonReader being read.
     * @return An instance of Float64SecondsDurationProperty if the JsonReader was pointing to an instance of it, or
     * null if it was pointing to JSON null.
     * @throws IllegalStateException If the deserialized JSON object was missing any required properties.
     * @throws IOException If an error occurs while reading the Float64SecondsDurationProperty.
     */
    @Generated
    public static Float64SecondsDurationProperty fromJson(JsonReader jsonReader) throws IOException {
        return jsonReader.readObject(reader -> {
            Duration value = null;
            while (reader.nextToken() != JsonToken.END_OBJECT) {
                String fieldName = reader.getFieldName();
                reader.nextToken();

                if ("value".equals(fieldName)) {
                    value = Duration.ofNanos((long) (reader.getDouble() * 1000_000_000L));
                } else {
                    reader.skipChildren();
                }
            }
            return new Float64SecondsDurationProperty(value);
        });
    }
}