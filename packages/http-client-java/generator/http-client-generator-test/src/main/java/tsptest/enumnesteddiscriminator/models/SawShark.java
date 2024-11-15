// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
// Code generated by Microsoft (R) TypeSpec Code Generator.

package tsptest.enumnesteddiscriminator.models;

import com.azure.core.annotation.Generated;
import com.azure.core.annotation.Immutable;
import com.azure.json.JsonReader;
import com.azure.json.JsonToken;
import com.azure.json.JsonWriter;
import java.io.IOException;

/**
 * The third level model SawShark in polymorphic multiple levels inheritance.
 */
@Immutable
public final class SawShark extends Shark {
    /*
     * discriminator property
     */
    @Generated
    private FishKind kind = FishKind.SHARK;

    /*
     * The sharktype property.
     */
    @Generated
    private SharkKind sharktype = SharkKind.SAW;

    /**
     * Creates an instance of SawShark class.
     * 
     * @param age the age value to set.
     */
    @Generated
    public SawShark(int age) {
        super(age);
    }

    /**
     * Get the kind property: discriminator property.
     * 
     * @return the kind value.
     */
    @Generated
    @Override
    public FishKind getKind() {
        return this.kind;
    }

    /**
     * Get the sharktype property: The sharktype property.
     * 
     * @return the sharktype value.
     */
    @Generated
    @Override
    public SharkKind getSharktype() {
        return this.sharktype;
    }

    /**
     * {@inheritDoc}
     */
    @Generated
    @Override
    public JsonWriter toJson(JsonWriter jsonWriter) throws IOException {
        jsonWriter.writeStartObject();
        jsonWriter.writeStringField("kind", this.kind == null ? null : this.kind.toString());
        jsonWriter.writeIntField("age", getAge());
        jsonWriter.writeStringField("sharktype", this.sharktype == null ? null : this.sharktype.toString());
        return jsonWriter.writeEndObject();
    }

    /**
     * Reads an instance of SawShark from the JsonReader.
     * 
     * @param jsonReader The JsonReader being read.
     * @return An instance of SawShark if the JsonReader was pointing to an instance of it, or null if it was pointing
     * to JSON null.
     * @throws IllegalStateException If the deserialized JSON object was missing any required properties.
     * @throws IOException If an error occurs while reading the SawShark.
     */
    @Generated
    public static SawShark fromJson(JsonReader jsonReader) throws IOException {
        return jsonReader.readObject(reader -> {
            int age = 0;
            SharkKind sharktype = SharkKind.SAW;
            while (reader.nextToken() != JsonToken.END_OBJECT) {
                String fieldName = reader.getFieldName();
                reader.nextToken();

                if ("age".equals(fieldName)) {
                    age = reader.getInt();
                } else if ("sharktype".equals(fieldName)) {
                    sharktype = SharkKind.fromString(reader.getString());
                } else {
                    reader.skipChildren();
                }
            }
            SawShark deserializedSawShark = new SawShark(age);
            deserializedSawShark.sharktype = sharktype;

            return deserializedSawShark;
        });
    }
}