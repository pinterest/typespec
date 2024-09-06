// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
// Code generated by Microsoft (R) TypeSpec Code Generator.

package com.cadl.naming.models;

/**
 * Defines values for RequestParametersType.
 */
public enum RequestParametersType {
    /**
     * Enum value Type1.
     */
    TYPE1("Type1"),

    /**
     * Enum value Type2.
     */
    TYPE2("Type2");

    /**
     * The actual serialized value for a RequestParametersType instance.
     */
    private final String value;

    RequestParametersType(String value) {
        this.value = value;
    }

    /**
     * Parses a serialized value to a RequestParametersType instance.
     * 
     * @param value the serialized value to parse.
     * @return the parsed RequestParametersType object, or null if unable to parse.
     */
    public static RequestParametersType fromString(String value) {
        if (value == null) {
            return null;
        }
        RequestParametersType[] items = RequestParametersType.values();
        for (RequestParametersType item : items) {
            if (item.toString().equalsIgnoreCase(value)) {
                return item;
            }
        }
        return null;
    }

    /**
     * {@inheritDoc}
     */
    @Override
    public String toString() {
        return this.value;
    }
}