// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
// Code generated by Microsoft (R) TypeSpec Code Generator.

package azure.resourcemanager.resources.implementation.models;

import azure.resourcemanager.resources.fluent.models.ExtensionsResourceInner;
import com.azure.core.annotation.Immutable;
import com.azure.core.util.logging.ClientLogger;
import com.azure.json.JsonReader;
import com.azure.json.JsonSerializable;
import com.azure.json.JsonToken;
import com.azure.json.JsonWriter;
import java.io.IOException;
import java.util.List;

/**
 * The response of a ExtensionsResource list operation.
 */
@Immutable
public final class ExtensionsResourceListResult implements JsonSerializable<ExtensionsResourceListResult> {
    /*
     * The ExtensionsResource items on this page
     */
    private List<ExtensionsResourceInner> value;

    /*
     * The link to the next page of items
     */
    private String nextLink;

    /**
     * Creates an instance of ExtensionsResourceListResult class.
     */
    private ExtensionsResourceListResult() {
    }

    /**
     * Get the value property: The ExtensionsResource items on this page.
     * 
     * @return the value value.
     */
    public List<ExtensionsResourceInner> value() {
        return this.value;
    }

    /**
     * Get the nextLink property: The link to the next page of items.
     * 
     * @return the nextLink value.
     */
    public String nextLink() {
        return this.nextLink;
    }

    /**
     * Validates the instance.
     * 
     * @throws IllegalArgumentException thrown if the instance is not valid.
     */
    public void validate() {
        if (value() == null) {
            throw LOGGER.atError()
                .log(new IllegalArgumentException(
                    "Missing required property value in model ExtensionsResourceListResult"));
        } else {
            value().forEach(e -> e.validate());
        }
    }

    private static final ClientLogger LOGGER = new ClientLogger(ExtensionsResourceListResult.class);

    /**
     * {@inheritDoc}
     */
    @Override
    public JsonWriter toJson(JsonWriter jsonWriter) throws IOException {
        jsonWriter.writeStartObject();
        jsonWriter.writeArrayField("value", this.value, (writer, element) -> writer.writeJson(element));
        jsonWriter.writeStringField("nextLink", this.nextLink);
        return jsonWriter.writeEndObject();
    }

    /**
     * Reads an instance of ExtensionsResourceListResult from the JsonReader.
     * 
     * @param jsonReader The JsonReader being read.
     * @return An instance of ExtensionsResourceListResult if the JsonReader was pointing to an instance of it, or null
     * if it was pointing to JSON null.
     * @throws IllegalStateException If the deserialized JSON object was missing any required properties.
     * @throws IOException If an error occurs while reading the ExtensionsResourceListResult.
     */
    public static ExtensionsResourceListResult fromJson(JsonReader jsonReader) throws IOException {
        return jsonReader.readObject(reader -> {
            ExtensionsResourceListResult deserializedExtensionsResourceListResult = new ExtensionsResourceListResult();
            while (reader.nextToken() != JsonToken.END_OBJECT) {
                String fieldName = reader.getFieldName();
                reader.nextToken();

                if ("value".equals(fieldName)) {
                    List<ExtensionsResourceInner> value
                        = reader.readArray(reader1 -> ExtensionsResourceInner.fromJson(reader1));
                    deserializedExtensionsResourceListResult.value = value;
                } else if ("nextLink".equals(fieldName)) {
                    deserializedExtensionsResourceListResult.nextLink = reader.getString();
                } else {
                    reader.skipChildren();
                }
            }

            return deserializedExtensionsResourceListResult;
        });
    }
}
