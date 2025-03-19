// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
// Code generated by Microsoft (R) TypeSpec Code Generator.

package tsptest.multicontenttypes.generated;

import com.azure.core.util.BinaryData;
import com.azure.core.util.Configuration;
import java.nio.charset.StandardCharsets;
import tsptest.multicontenttypes.MultiContentTypesClientBuilder;
import tsptest.multicontenttypes.SingleContentTypeClient;

public class SingleContentTypeUploadImageForSingleContentType {
    public static void main(String[] args) {
        SingleContentTypeClient singleContentTypeClient
            = new MultiContentTypesClientBuilder().endpoint(Configuration.getGlobalConfiguration().get("ENDPOINT"))
                .buildSingleContentTypeClient();
        // BEGIN:tsptest.multicontenttypes.generated.singlecontenttypeuploadimageforsinglecontenttype.singlecontenttypeuploadimageforsinglecontenttype
        singleContentTypeClient.uploadImageForSingleContentType(
            BinaryData.fromBytes("\"D:\\Program Files\"".getBytes(StandardCharsets.UTF_8)));
        // END:tsptest.multicontenttypes.generated.singlecontenttypeuploadimageforsinglecontenttype.singlecontenttypeuploadimageforsinglecontenttype
    }
}
