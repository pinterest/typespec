// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
// Code generated by Microsoft (R) TypeSpec Code Generator.

package com.type.property.additionalproperties.models;

import com.azure.core.annotation.Fluent;
import com.azure.core.annotation.Generated;
import com.azure.json.JsonReader;
import com.azure.json.JsonSerializable;
import com.azure.json.JsonToken;
import com.azure.json.JsonWriter;
import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * The model spread Record&lt;ModelForRecord&gt; with the different known property type.
 */
@Fluent
public class DifferentSpreadModelRecord implements JsonSerializable<DifferentSpreadModelRecord> {
    /*
     * The knownProp property.
     */
    @Generated
    private final String knownProp;

    /*
     * Additional properties
     */
    @Generated
    private Map<String, ModelForRecord> additionalProperties;

    /**
     * Creates an instance of DifferentSpreadModelRecord class.
     * 
     * @param knownProp the knownProp value to set.
     */
    @Generated
    public DifferentSpreadModelRecord(String knownProp) {
        this.knownProp = knownProp;
    }

    /**
     * Get the knownProp property: The knownProp property.
     * 
     * @return the knownProp value.
     */
    @Generated
    public String getKnownProp() {
        return this.knownProp;
    }

    /**
     * Get the additionalProperties property: Additional properties.
     * 
     * @return the additionalProperties value.
     */
    @Generated
    public Map<String, ModelForRecord> getAdditionalProperties() {
        return this.additionalProperties;
    }

    /**
     * Set the additionalProperties property: Additional properties.
     * 
     * @param additionalProperties the additionalProperties value to set.
     * @return the DifferentSpreadModelRecord object itself.
     */
    @Generated
    public DifferentSpreadModelRecord setAdditionalProperties(Map<String, ModelForRecord> additionalProperties) {
        this.additionalProperties = additionalProperties;
        return this;
    }

    /**
     * {@inheritDoc}
     */
    @Generated
    @Override
    public JsonWriter toJson(JsonWriter jsonWriter) throws IOException {
        jsonWriter.writeStartObject();
        jsonWriter.writeStringField("knownProp", this.knownProp);
        if (additionalProperties != null) {
            for (Map.Entry<String, ModelForRecord> additionalProperty : additionalProperties.entrySet()) {
                jsonWriter.writeUntypedField(additionalProperty.getKey(), additionalProperty.getValue());
            }
        }
        return jsonWriter.writeEndObject();
    }

    /**
     * Reads an instance of DifferentSpreadModelRecord from the JsonReader.
     * 
     * @param jsonReader The JsonReader being read.
     * @return An instance of DifferentSpreadModelRecord if the JsonReader was pointing to an instance of it, or null if
     * it was pointing to JSON null.
     * @throws IllegalStateException If the deserialized JSON object was missing any required properties.
     * @throws IOException If an error occurs while reading the DifferentSpreadModelRecord.
     */
    @Generated
    public static DifferentSpreadModelRecord fromJson(JsonReader jsonReader) throws IOException {
        return jsonReader.readObject(reader -> {
            String knownProp = null;
            Map<String, ModelForRecord> additionalProperties = null;
            while (reader.nextToken() != JsonToken.END_OBJECT) {
                String fieldName = reader.getFieldName();
                reader.nextToken();

                if ("knownProp".equals(fieldName)) {
                    knownProp = reader.getString();
                } else {
                    if (additionalProperties == null) {
                        additionalProperties = new LinkedHashMap<>();
                    }

                    additionalProperties.put(fieldName, ModelForRecord.fromJson(reader));
                }
            }
            DifferentSpreadModelRecord deserializedDifferentSpreadModelRecord
                = new DifferentSpreadModelRecord(knownProp);
            deserializedDifferentSpreadModelRecord.additionalProperties = additionalProperties;

            return deserializedDifferentSpreadModelRecord;
        });
    }
}