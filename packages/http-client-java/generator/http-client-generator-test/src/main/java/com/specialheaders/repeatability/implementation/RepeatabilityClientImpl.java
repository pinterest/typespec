// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
// Code generated by Microsoft (R) TypeSpec Code Generator.

package com.specialheaders.repeatability.implementation;

import com.azure.core.annotation.ExpectedResponses;
import com.azure.core.annotation.Host;
import com.azure.core.annotation.HostParam;
import com.azure.core.annotation.Post;
import com.azure.core.annotation.ReturnType;
import com.azure.core.annotation.ServiceInterface;
import com.azure.core.annotation.ServiceMethod;
import com.azure.core.annotation.UnexpectedResponseExceptionType;
import com.azure.core.exception.ClientAuthenticationException;
import com.azure.core.exception.HttpResponseException;
import com.azure.core.exception.ResourceModifiedException;
import com.azure.core.exception.ResourceNotFoundException;
import com.azure.core.http.HttpHeaderName;
import com.azure.core.http.HttpPipeline;
import com.azure.core.http.HttpPipelineBuilder;
import com.azure.core.http.policy.RetryPolicy;
import com.azure.core.http.policy.UserAgentPolicy;
import com.azure.core.http.rest.RequestOptions;
import com.azure.core.http.rest.Response;
import com.azure.core.http.rest.RestProxy;
import com.azure.core.util.Context;
import com.azure.core.util.CoreUtils;
import com.azure.core.util.DateTimeRfc1123;
import com.azure.core.util.FluxUtil;
import com.azure.core.util.serializer.JacksonAdapter;
import com.azure.core.util.serializer.SerializerAdapter;
import java.time.OffsetDateTime;
import reactor.core.publisher.Mono;

/**
 * Initializes a new instance of the RepeatabilityClient type.
 */
public final class RepeatabilityClientImpl {
    /**
     * The proxy service used to perform REST calls.
     */
    private final RepeatabilityClientService service;

    /**
     * Service host.
     */
    private final String endpoint;

    /**
     * Gets Service host.
     * 
     * @return the endpoint value.
     */
    public String getEndpoint() {
        return this.endpoint;
    }

    /**
     * The HTTP pipeline to send requests through.
     */
    private final HttpPipeline httpPipeline;

    /**
     * Gets The HTTP pipeline to send requests through.
     * 
     * @return the httpPipeline value.
     */
    public HttpPipeline getHttpPipeline() {
        return this.httpPipeline;
    }

    /**
     * The serializer to serialize an object into a string.
     */
    private final SerializerAdapter serializerAdapter;

    /**
     * Gets The serializer to serialize an object into a string.
     * 
     * @return the serializerAdapter value.
     */
    public SerializerAdapter getSerializerAdapter() {
        return this.serializerAdapter;
    }

    /**
     * Initializes an instance of RepeatabilityClient client.
     * 
     * @param endpoint Service host.
     */
    public RepeatabilityClientImpl(String endpoint) {
        this(new HttpPipelineBuilder().policies(new UserAgentPolicy(), new RetryPolicy()).build(),
            JacksonAdapter.createDefaultSerializerAdapter(), endpoint);
    }

    /**
     * Initializes an instance of RepeatabilityClient client.
     * 
     * @param httpPipeline The HTTP pipeline to send requests through.
     * @param endpoint Service host.
     */
    public RepeatabilityClientImpl(HttpPipeline httpPipeline, String endpoint) {
        this(httpPipeline, JacksonAdapter.createDefaultSerializerAdapter(), endpoint);
    }

    /**
     * Initializes an instance of RepeatabilityClient client.
     * 
     * @param httpPipeline The HTTP pipeline to send requests through.
     * @param serializerAdapter The serializer to serialize an object into a string.
     * @param endpoint Service host.
     */
    public RepeatabilityClientImpl(HttpPipeline httpPipeline, SerializerAdapter serializerAdapter, String endpoint) {
        this.httpPipeline = httpPipeline;
        this.serializerAdapter = serializerAdapter;
        this.endpoint = endpoint;
        this.service
            = RestProxy.create(RepeatabilityClientService.class, this.httpPipeline, this.getSerializerAdapter());
    }

    /**
     * The interface defining all the services for RepeatabilityClient to be used by the proxy service to perform REST
     * calls.
     */
    @Host("{endpoint}")
    @ServiceInterface(name = "RepeatabilityClient")
    public interface RepeatabilityClientService {
        @Post("/special-headers/repeatability/immediateSuccess")
        @ExpectedResponses({ 204 })
        @UnexpectedResponseExceptionType(value = ClientAuthenticationException.class, code = { 401 })
        @UnexpectedResponseExceptionType(value = ResourceNotFoundException.class, code = { 404 })
        @UnexpectedResponseExceptionType(value = ResourceModifiedException.class, code = { 409 })
        @UnexpectedResponseExceptionType(HttpResponseException.class)
        Mono<Response<Void>> immediateSuccess(@HostParam("endpoint") String endpoint, RequestOptions requestOptions,
            Context context);

        @Post("/special-headers/repeatability/immediateSuccess")
        @ExpectedResponses({ 204 })
        @UnexpectedResponseExceptionType(value = ClientAuthenticationException.class, code = { 401 })
        @UnexpectedResponseExceptionType(value = ResourceNotFoundException.class, code = { 404 })
        @UnexpectedResponseExceptionType(value = ResourceModifiedException.class, code = { 409 })
        @UnexpectedResponseExceptionType(HttpResponseException.class)
        Response<Void> immediateSuccessSync(@HostParam("endpoint") String endpoint, RequestOptions requestOptions,
            Context context);
    }

    /**
     * Check we recognize Repeatability-Request-ID and Repeatability-First-Sent.
     * <p><strong>Header Parameters</strong></p>
     * <table border="1">
     * <caption>Header Parameters</caption>
     * <tr><th>Name</th><th>Type</th><th>Required</th><th>Description</th></tr>
     * <tr><td>repeatability-request-id</td><td>String</td><td>No</td><td>Repeatability request ID header</td></tr>
     * <tr><td>repeatability-first-sent</td><td>String</td><td>No</td><td>Repeatability first sent header as
     * HTTP-date</td></tr>
     * </table>
     * You can add these to a request with {@link RequestOptions#addHeader}
     * 
     * @param requestOptions The options to configure the HTTP request before HTTP client sends it.
     * @throws HttpResponseException thrown if the request is rejected by server.
     * @throws ClientAuthenticationException thrown if the request is rejected by server on status code 401.
     * @throws ResourceNotFoundException thrown if the request is rejected by server on status code 404.
     * @throws ResourceModifiedException thrown if the request is rejected by server on status code 409.
     * @return the {@link Response} on successful completion of {@link Mono}.
     */
    @ServiceMethod(returns = ReturnType.SINGLE)
    public Mono<Response<Void>> immediateSuccessWithResponseAsync(RequestOptions requestOptions) {
        RequestOptions requestOptionsLocal = requestOptions == null ? new RequestOptions() : requestOptions;
        requestOptionsLocal.addRequestCallback(requestLocal -> {
            if (requestLocal.getHeaders().get(HttpHeaderName.fromString("repeatability-request-id")) == null) {
                requestLocal.getHeaders()
                    .set(HttpHeaderName.fromString("repeatability-request-id"), CoreUtils.randomUuid().toString());
            }
        });
        requestOptionsLocal.addRequestCallback(requestLocal -> {
            if (requestLocal.getHeaders().get(HttpHeaderName.fromString("repeatability-first-sent")) == null) {
                requestLocal.getHeaders()
                    .set(HttpHeaderName.fromString("repeatability-first-sent"),
                        DateTimeRfc1123.toRfc1123String(OffsetDateTime.now()));
            }
        });
        return FluxUtil
            .withContext(context -> service.immediateSuccess(this.getEndpoint(), requestOptionsLocal, context));
    }

    /**
     * Check we recognize Repeatability-Request-ID and Repeatability-First-Sent.
     * <p><strong>Header Parameters</strong></p>
     * <table border="1">
     * <caption>Header Parameters</caption>
     * <tr><th>Name</th><th>Type</th><th>Required</th><th>Description</th></tr>
     * <tr><td>repeatability-request-id</td><td>String</td><td>No</td><td>Repeatability request ID header</td></tr>
     * <tr><td>repeatability-first-sent</td><td>String</td><td>No</td><td>Repeatability first sent header as
     * HTTP-date</td></tr>
     * </table>
     * You can add these to a request with {@link RequestOptions#addHeader}
     * 
     * @param requestOptions The options to configure the HTTP request before HTTP client sends it.
     * @throws HttpResponseException thrown if the request is rejected by server.
     * @throws ClientAuthenticationException thrown if the request is rejected by server on status code 401.
     * @throws ResourceNotFoundException thrown if the request is rejected by server on status code 404.
     * @throws ResourceModifiedException thrown if the request is rejected by server on status code 409.
     * @return the {@link Response}.
     */
    @ServiceMethod(returns = ReturnType.SINGLE)
    public Response<Void> immediateSuccessWithResponse(RequestOptions requestOptions) {
        RequestOptions requestOptionsLocal = requestOptions == null ? new RequestOptions() : requestOptions;
        requestOptionsLocal.addRequestCallback(requestLocal -> {
            if (requestLocal.getHeaders().get(HttpHeaderName.fromString("repeatability-request-id")) == null) {
                requestLocal.getHeaders()
                    .set(HttpHeaderName.fromString("repeatability-request-id"), CoreUtils.randomUuid().toString());
            }
        });
        requestOptionsLocal.addRequestCallback(requestLocal -> {
            if (requestLocal.getHeaders().get(HttpHeaderName.fromString("repeatability-first-sent")) == null) {
                requestLocal.getHeaders()
                    .set(HttpHeaderName.fromString("repeatability-first-sent"),
                        DateTimeRfc1123.toRfc1123String(OffsetDateTime.now()));
            }
        });
        return service.immediateSuccessSync(this.getEndpoint(), requestOptionsLocal, Context.NONE);
    }
}