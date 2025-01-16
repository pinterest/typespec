// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
// Code generated by Microsoft (R) TypeSpec Code Generator.

package client.clientnamespace.second;

import client.clientnamespace.implementation.ClientNamespaceSecondClientImpl;
import client.clientnamespace.second.models.SecondClientResult;
import com.azure.core.annotation.Generated;
import com.azure.core.annotation.ReturnType;
import com.azure.core.annotation.ServiceClient;
import com.azure.core.annotation.ServiceMethod;
import com.azure.core.exception.ClientAuthenticationException;
import com.azure.core.exception.HttpResponseException;
import com.azure.core.exception.ResourceModifiedException;
import com.azure.core.exception.ResourceNotFoundException;
import com.azure.core.http.rest.RequestOptions;
import com.azure.core.http.rest.Response;
import com.azure.core.util.BinaryData;
import com.azure.core.util.FluxUtil;
import reactor.core.publisher.Mono;

/**
 * Initializes a new instance of the asynchronous ClientNamespaceSecondClient type.
 */
@ServiceClient(builder = ClientNamespaceSecondClientBuilder.class, isAsync = true)
public final class ClientNamespaceSecondAsyncClient {
    @Generated
    private final ClientNamespaceSecondClientImpl serviceClient;

    /**
     * Initializes an instance of ClientNamespaceSecondAsyncClient class.
     * 
     * @param serviceClient the service client implementation.
     */
    @Generated
    ClientNamespaceSecondAsyncClient(ClientNamespaceSecondClientImpl serviceClient) {
        this.serviceClient = serviceClient;
    }

    /**
     * The getSecond operation.
     * <p><strong>Response Body Schema</strong></p>
     * 
     * <pre>
     * {@code
     * {
     *     type: String(second) (Required)
     * }
     * }
     * </pre>
     * 
     * @param requestOptions The options to configure the HTTP request before HTTP client sends it.
     * @throws HttpResponseException thrown if the request is rejected by server.
     * @throws ClientAuthenticationException thrown if the request is rejected by server on status code 401.
     * @throws ResourceNotFoundException thrown if the request is rejected by server on status code 404.
     * @throws ResourceModifiedException thrown if the request is rejected by server on status code 409.
     * @return the response body along with {@link Response} on successful completion of {@link Mono}.
     */
    @Generated
    @ServiceMethod(returns = ReturnType.SINGLE)
    public Mono<Response<BinaryData>> getSecondWithResponse(RequestOptions requestOptions) {
        return this.serviceClient.getSecondWithResponseAsync(requestOptions);
    }

    /**
     * The getSecond operation.
     * 
     * @throws HttpResponseException thrown if the request is rejected by server.
     * @throws ClientAuthenticationException thrown if the request is rejected by server on status code 401.
     * @throws ResourceNotFoundException thrown if the request is rejected by server on status code 404.
     * @throws ResourceModifiedException thrown if the request is rejected by server on status code 409.
     * @throws RuntimeException all other wrapped checked exceptions if the request fails to be sent.
     * @return the response body on successful completion of {@link Mono}.
     */
    @Generated
    @ServiceMethod(returns = ReturnType.SINGLE)
    public Mono<SecondClientResult> getSecond() {
        // Generated convenience method for getSecondWithResponse
        RequestOptions requestOptions = new RequestOptions();
        return getSecondWithResponse(requestOptions).flatMap(FluxUtil::toMono)
            .map(protocolMethodData -> protocolMethodData.toObject(SecondClientResult.class));
    }
}