// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
// Code generated by Microsoft (R) TypeSpec Code Generator.

package azure.resourcemanager.operationtemplates.implementation;

import azure.resourcemanager.operationtemplates.fluent.CheckNameAvailabilitiesClient;
import azure.resourcemanager.operationtemplates.fluent.models.CheckNameAvailabilityResponseInner;
import azure.resourcemanager.operationtemplates.models.CheckNameAvailabilities;
import azure.resourcemanager.operationtemplates.models.CheckNameAvailabilityRequest;
import azure.resourcemanager.operationtemplates.models.CheckNameAvailabilityResponse;
import com.azure.core.http.rest.Response;
import com.azure.core.http.rest.SimpleResponse;
import com.azure.core.util.Context;
import com.azure.core.util.logging.ClientLogger;

public final class CheckNameAvailabilitiesImpl implements CheckNameAvailabilities {
    private static final ClientLogger LOGGER = new ClientLogger(CheckNameAvailabilitiesImpl.class);

    private final CheckNameAvailabilitiesClient innerClient;

    private final azure.resourcemanager.operationtemplates.OperationTemplatesManager serviceManager;

    public CheckNameAvailabilitiesImpl(CheckNameAvailabilitiesClient innerClient,
        azure.resourcemanager.operationtemplates.OperationTemplatesManager serviceManager) {
        this.innerClient = innerClient;
        this.serviceManager = serviceManager;
    }

    public Response<CheckNameAvailabilityResponse> checkGlobalWithResponse(CheckNameAvailabilityRequest body,
        Context context) {
        Response<CheckNameAvailabilityResponseInner> inner
            = this.serviceClient().checkGlobalWithResponse(body, context);
        if (inner != null) {
            return new SimpleResponse<>(inner.getRequest(), inner.getStatusCode(), inner.getHeaders(),
                new CheckNameAvailabilityResponseImpl(inner.getValue(), this.manager()));
        } else {
            return null;
        }
    }

    public CheckNameAvailabilityResponse checkGlobal(CheckNameAvailabilityRequest body) {
        CheckNameAvailabilityResponseInner inner = this.serviceClient().checkGlobal(body);
        if (inner != null) {
            return new CheckNameAvailabilityResponseImpl(inner, this.manager());
        } else {
            return null;
        }
    }

    public Response<CheckNameAvailabilityResponse> checkLocalWithResponse(String location,
        CheckNameAvailabilityRequest body, Context context) {
        Response<CheckNameAvailabilityResponseInner> inner
            = this.serviceClient().checkLocalWithResponse(location, body, context);
        if (inner != null) {
            return new SimpleResponse<>(inner.getRequest(), inner.getStatusCode(), inner.getHeaders(),
                new CheckNameAvailabilityResponseImpl(inner.getValue(), this.manager()));
        } else {
            return null;
        }
    }

    public CheckNameAvailabilityResponse checkLocal(String location, CheckNameAvailabilityRequest body) {
        CheckNameAvailabilityResponseInner inner = this.serviceClient().checkLocal(location, body);
        if (inner != null) {
            return new CheckNameAvailabilityResponseImpl(inner, this.manager());
        } else {
            return null;
        }
    }

    private CheckNameAvailabilitiesClient serviceClient() {
        return this.innerClient;
    }

    private azure.resourcemanager.operationtemplates.OperationTemplatesManager manager() {
        return this.serviceManager;
    }
}
