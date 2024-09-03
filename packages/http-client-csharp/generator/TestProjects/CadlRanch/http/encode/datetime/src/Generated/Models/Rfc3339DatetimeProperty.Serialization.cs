// <auto-generated/>

#nullable disable

using System;
using System.ClientModel;
using System.ClientModel.Primitives;
using System.Text.Json;

namespace Encode.Datetime.Models
{
    public partial class Rfc3339DatetimeProperty : IJsonModel<Rfc3339DatetimeProperty>
    {
        void IJsonModel<Rfc3339DatetimeProperty>.Write(Utf8JsonWriter writer, ModelReaderWriterOptions options) => throw null;

        protected virtual void JsonModelWriteCore(Utf8JsonWriter writer, ModelReaderWriterOptions options) => throw null;

        Rfc3339DatetimeProperty IJsonModel<Rfc3339DatetimeProperty>.Create(ref Utf8JsonReader reader, ModelReaderWriterOptions options) => throw null;

        protected virtual Rfc3339DatetimeProperty JsonModelCreateCore(ref Utf8JsonReader reader, ModelReaderWriterOptions options) => throw null;

        BinaryData IPersistableModel<Rfc3339DatetimeProperty>.Write(ModelReaderWriterOptions options) => throw null;

        protected virtual BinaryData PersistableModelWriteCore(ModelReaderWriterOptions options) => throw null;

        Rfc3339DatetimeProperty IPersistableModel<Rfc3339DatetimeProperty>.Create(BinaryData data, ModelReaderWriterOptions options) => throw null;

        protected virtual Rfc3339DatetimeProperty PersistableModelCreateCore(BinaryData data, ModelReaderWriterOptions options) => throw null;

        string IPersistableModel<Rfc3339DatetimeProperty>.GetFormatFromOptions(ModelReaderWriterOptions options) => throw null;

        public static implicit operator BinaryContent(Rfc3339DatetimeProperty rfc3339DatetimeProperty) => throw null;

        public static explicit operator Rfc3339DatetimeProperty(ClientResult result) => throw null;
    }
}