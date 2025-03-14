// <auto-generated/>

#nullable disable

using System;
using System.ClientModel;
using System.ClientModel.Primitives;
using System.Collections.Generic;
using System.Text.Json;

namespace UnbrandedTypeSpec
{
    /// <summary></summary>
    internal partial class ListWithContinuationTokenResponse : IJsonModel<ListWithContinuationTokenResponse>
    {
        internal ListWithContinuationTokenResponse()
        {
        }

        void IJsonModel<ListWithContinuationTokenResponse>.Write(Utf8JsonWriter writer, ModelReaderWriterOptions options)
        {
            writer.WriteStartObject();
            JsonModelWriteCore(writer, options);
            writer.WriteEndObject();
        }

        /// <param name="writer"> The JSON writer. </param>
        /// <param name="options"> The client options for reading and writing models. </param>
        protected virtual void JsonModelWriteCore(Utf8JsonWriter writer, ModelReaderWriterOptions options)
        {
            string format = options.Format == "W" ? ((IPersistableModel<ListWithContinuationTokenResponse>)this).GetFormatFromOptions(options) : options.Format;
            if (format != "J")
            {
                throw new FormatException($"The model {nameof(ListWithContinuationTokenResponse)} does not support writing '{format}' format.");
            }
            writer.WritePropertyName("things"u8);
            writer.WriteStartArray();
            foreach (Thing item in Things)
            {
                writer.WriteObjectValue(item, options);
            }
            writer.WriteEndArray();
            if (Optional.IsDefined(NextToken))
            {
                writer.WritePropertyName("nextToken"u8);
                writer.WriteStringValue(NextToken);
            }
            if (options.Format != "W" && _additionalBinaryDataProperties != null)
            {
                foreach (var item in _additionalBinaryDataProperties)
                {
                    writer.WritePropertyName(item.Key);
#if NET6_0_OR_GREATER
                    writer.WriteRawValue(item.Value);
#else
                    using (JsonDocument document = JsonDocument.Parse(item.Value))
                    {
                        JsonSerializer.Serialize(writer, document.RootElement);
                    }
#endif
                }
            }
        }

        ListWithContinuationTokenResponse IJsonModel<ListWithContinuationTokenResponse>.Create(ref Utf8JsonReader reader, ModelReaderWriterOptions options) => JsonModelCreateCore(ref reader, options);

        /// <param name="reader"> The JSON reader. </param>
        /// <param name="options"> The client options for reading and writing models. </param>
        protected virtual ListWithContinuationTokenResponse JsonModelCreateCore(ref Utf8JsonReader reader, ModelReaderWriterOptions options)
        {
            string format = options.Format == "W" ? ((IPersistableModel<ListWithContinuationTokenResponse>)this).GetFormatFromOptions(options) : options.Format;
            if (format != "J")
            {
                throw new FormatException($"The model {nameof(ListWithContinuationTokenResponse)} does not support reading '{format}' format.");
            }
            using JsonDocument document = JsonDocument.ParseValue(ref reader);
            return DeserializeListWithContinuationTokenResponse(document.RootElement, options);
        }

        internal static ListWithContinuationTokenResponse DeserializeListWithContinuationTokenResponse(JsonElement element, ModelReaderWriterOptions options)
        {
            if (element.ValueKind == JsonValueKind.Null)
            {
                return null;
            }
            IList<Thing> things = default;
            string nextToken = default;
            IDictionary<string, BinaryData> additionalBinaryDataProperties = new ChangeTrackingDictionary<string, BinaryData>();
            foreach (var prop in element.EnumerateObject())
            {
                if (prop.NameEquals("things"u8))
                {
                    List<Thing> array = new List<Thing>();
                    foreach (var item in prop.Value.EnumerateArray())
                    {
                        array.Add(Thing.DeserializeThing(item, options));
                    }
                    things = array;
                    continue;
                }
                if (prop.NameEquals("nextToken"u8))
                {
                    nextToken = prop.Value.GetString();
                    continue;
                }
                if (options.Format != "W")
                {
                    additionalBinaryDataProperties.Add(prop.Name, BinaryData.FromString(prop.Value.GetRawText()));
                }
            }
            return new ListWithContinuationTokenResponse(things, nextToken, additionalBinaryDataProperties);
        }

        BinaryData IPersistableModel<ListWithContinuationTokenResponse>.Write(ModelReaderWriterOptions options) => PersistableModelWriteCore(options);

        /// <param name="options"> The client options for reading and writing models. </param>
        protected virtual BinaryData PersistableModelWriteCore(ModelReaderWriterOptions options)
        {
            string format = options.Format == "W" ? ((IPersistableModel<ListWithContinuationTokenResponse>)this).GetFormatFromOptions(options) : options.Format;
            switch (format)
            {
                case "J":
                    return ModelReaderWriter.Write(this, options);
                default:
                    throw new FormatException($"The model {nameof(ListWithContinuationTokenResponse)} does not support writing '{options.Format}' format.");
            }
        }

        ListWithContinuationTokenResponse IPersistableModel<ListWithContinuationTokenResponse>.Create(BinaryData data, ModelReaderWriterOptions options) => PersistableModelCreateCore(data, options);

        /// <param name="data"> The data to parse. </param>
        /// <param name="options"> The client options for reading and writing models. </param>
        protected virtual ListWithContinuationTokenResponse PersistableModelCreateCore(BinaryData data, ModelReaderWriterOptions options)
        {
            string format = options.Format == "W" ? ((IPersistableModel<ListWithContinuationTokenResponse>)this).GetFormatFromOptions(options) : options.Format;
            switch (format)
            {
                case "J":
                    using (JsonDocument document = JsonDocument.Parse(data))
                    {
                        return DeserializeListWithContinuationTokenResponse(document.RootElement, options);
                    }
                default:
                    throw new FormatException($"The model {nameof(ListWithContinuationTokenResponse)} does not support reading '{options.Format}' format.");
            }
        }

        string IPersistableModel<ListWithContinuationTokenResponse>.GetFormatFromOptions(ModelReaderWriterOptions options) => "J";

        /// <param name="listWithContinuationTokenResponse"> The <see cref="ListWithContinuationTokenResponse"/> to serialize into <see cref="BinaryContent"/>. </param>
        public static implicit operator BinaryContent(ListWithContinuationTokenResponse listWithContinuationTokenResponse)
        {
            if (listWithContinuationTokenResponse == null)
            {
                return null;
            }
            return BinaryContent.Create(listWithContinuationTokenResponse, ModelSerializationExtensions.WireOptions);
        }

        /// <param name="result"> The <see cref="ClientResult"/> to deserialize the <see cref="ListWithContinuationTokenResponse"/> from. </param>
        public static explicit operator ListWithContinuationTokenResponse(ClientResult result)
        {
            using PipelineResponse response = result.GetRawResponse();
            using JsonDocument document = JsonDocument.Parse(response.Content);
            return DeserializeListWithContinuationTokenResponse(document.RootElement, ModelSerializationExtensions.WireOptions);
        }
    }
}
