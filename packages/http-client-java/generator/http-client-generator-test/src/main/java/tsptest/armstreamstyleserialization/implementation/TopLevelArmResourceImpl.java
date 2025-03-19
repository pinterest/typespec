// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
// Code generated by Microsoft (R) TypeSpec Code Generator.

package tsptest.armstreamstyleserialization.implementation;

import com.azure.core.management.SystemData;
import java.util.Collections;
import java.util.Map;
import tsptest.armstreamstyleserialization.fluent.models.TopLevelArmResourceInner;
import tsptest.armstreamstyleserialization.models.TopLevelArmResource;
import tsptest.armstreamstyleserialization.models.TopLevelArmResourceProperties;

public final class TopLevelArmResourceImpl implements TopLevelArmResource {
    private TopLevelArmResourceInner innerObject;

    private final tsptest.armstreamstyleserialization.ArmStreamStyleSerializationManager serviceManager;

    TopLevelArmResourceImpl(TopLevelArmResourceInner innerObject,
        tsptest.armstreamstyleserialization.ArmStreamStyleSerializationManager serviceManager) {
        this.innerObject = innerObject;
        this.serviceManager = serviceManager;
    }

    public String id() {
        return this.innerModel().id();
    }

    public String name() {
        return this.innerModel().name();
    }

    public String type() {
        return this.innerModel().type();
    }

    public String location() {
        return this.innerModel().location();
    }

    public Map<String, String> tags() {
        Map<String, String> inner = this.innerModel().tags();
        if (inner != null) {
            return Collections.unmodifiableMap(inner);
        } else {
            return Collections.emptyMap();
        }
    }

    public TopLevelArmResourceProperties properties() {
        return this.innerModel().properties();
    }

    public SystemData systemData() {
        return this.innerModel().systemData();
    }

    public TopLevelArmResourceInner innerModel() {
        return this.innerObject;
    }

    private tsptest.armstreamstyleserialization.ArmStreamStyleSerializationManager manager() {
        return this.serviceManager;
    }
}
