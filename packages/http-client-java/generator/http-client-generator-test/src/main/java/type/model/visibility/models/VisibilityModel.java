// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
// Code generated by Microsoft (R) TypeSpec Code Generator.

package type.model.visibility.models;

import com.azure.core.annotation.Generated;
import com.azure.core.annotation.Immutable;
import com.azure.json.JsonReader;
import com.azure.json.JsonSerializable;
import com.azure.json.JsonToken;
import com.azure.json.JsonWriter;
import java.io.IOException;
import java.util.List;

/**
 * Output model with visibility properties.
 */
@Immutable
public final class VisibilityModel implements JsonSerializable<VisibilityModel> {
    /*
     * Required string, illustrating a readonly property.
     */
    @Generated
    private String readProp;

    /*
     * Required int32, illustrating a query property.
     */
    @Generated
    private final Integer queryProp;

    /*
     * Required string[], illustrating a create property.
     */
    @Generated
    private final List<String> createProp;

    /*
     * Required int32[], illustrating a update property.
     */
    @Generated
    private final List<Integer> updateProp;

    /*
     * Required bool, illustrating a delete property.
     */
    @Generated
    private final Boolean deleteProp;

    /**
     * Creates an instance of VisibilityModel class.
     * 
     * @param queryProp the queryProp value to set.
     * @param createProp the createProp value to set.
     * @param updateProp the updateProp value to set.
     * @param deleteProp the deleteProp value to set.
     */
    @Generated
    public VisibilityModel(Integer queryProp, List<String> createProp, List<Integer> updateProp, Boolean deleteProp) {
        this.queryProp = queryProp;
        this.createProp = createProp;
        this.updateProp = updateProp;
        this.deleteProp = deleteProp;
    }

    /**
     * Get the readProp property: Required string, illustrating a readonly property.
     * 
     * @return the readProp value.
     */
    @Generated
    public String getReadProp() {
        return this.readProp;
    }

    /**
     * Get the queryProp property: Required int32, illustrating a query property.
     * 
     * @return the queryProp value.
     */
    @Generated
    public Integer getQueryProp() {
        return this.queryProp;
    }

    /**
     * Get the createProp property: Required string[], illustrating a create property.
     * 
     * @return the createProp value.
     */
    @Generated
    public List<String> getCreateProp() {
        return this.createProp;
    }

    /**
     * Get the updateProp property: Required int32[], illustrating a update property.
     * 
     * @return the updateProp value.
     */
    @Generated
    public List<Integer> getUpdateProp() {
        return this.updateProp;
    }

    /**
     * Get the deleteProp property: Required bool, illustrating a delete property.
     * 
     * @return the deleteProp value.
     */
    @Generated
    public Boolean isDeleteProp() {
        return this.deleteProp;
    }

    /**
     * {@inheritDoc}
     */
    @Generated
    @Override
    public JsonWriter toJson(JsonWriter jsonWriter) throws IOException {
        jsonWriter.writeStartObject();
        jsonWriter.writeNumberField("queryProp", this.queryProp);
        jsonWriter.writeArrayField("createProp", this.createProp, (writer, element) -> writer.writeString(element));
        jsonWriter.writeArrayField("updateProp", this.updateProp, (writer, element) -> writer.writeInt(element));
        jsonWriter.writeBooleanField("deleteProp", this.deleteProp);
        return jsonWriter.writeEndObject();
    }

    /**
     * Reads an instance of VisibilityModel from the JsonReader.
     * 
     * @param jsonReader The JsonReader being read.
     * @return An instance of VisibilityModel if the JsonReader was pointing to an instance of it, or null if it was
     * pointing to JSON null.
     * @throws IllegalStateException If the deserialized JSON object was missing any required properties.
     * @throws IOException If an error occurs while reading the VisibilityModel.
     */
    @Generated
    public static VisibilityModel fromJson(JsonReader jsonReader) throws IOException {
        return jsonReader.readObject(reader -> {
            String readProp = null;
            Integer queryProp = null;
            List<String> createProp = null;
            List<Integer> updateProp = null;
            Boolean deleteProp = null;
            while (reader.nextToken() != JsonToken.END_OBJECT) {
                String fieldName = reader.getFieldName();
                reader.nextToken();

                if ("readProp".equals(fieldName)) {
                    readProp = reader.getString();
                } else if ("queryProp".equals(fieldName)) {
                    queryProp = reader.getNullable(JsonReader::getInt);
                } else if ("createProp".equals(fieldName)) {
                    createProp = reader.readArray(reader1 -> reader1.getString());
                } else if ("updateProp".equals(fieldName)) {
                    updateProp = reader.readArray(reader1 -> reader1.getInt());
                } else if ("deleteProp".equals(fieldName)) {
                    deleteProp = reader.getNullable(JsonReader::getBoolean);
                } else {
                    reader.skipChildren();
                }
            }
            VisibilityModel deserializedVisibilityModel
                = new VisibilityModel(queryProp, createProp, updateProp, deleteProp);
            deserializedVisibilityModel.readProp = readProp;

            return deserializedVisibilityModel;
        });
    }
}
