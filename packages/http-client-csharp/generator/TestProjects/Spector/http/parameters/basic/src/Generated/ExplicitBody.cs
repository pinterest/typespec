// <auto-generated/>

#nullable disable

using System.ClientModel;
using System.ClientModel.Primitives;
using System.Threading;
using System.Threading.Tasks;

namespace Parameters.Basic._ExplicitBody
{
    public partial class ExplicitBody
    {
        protected ExplicitBody() => throw null;

        public ClientPipeline Pipeline => throw null;

        public virtual ClientResult Simple(BinaryContent content, RequestOptions options = null) => throw null;

        public virtual Task<ClientResult> SimpleAsync(BinaryContent content, RequestOptions options = null) => throw null;

        public virtual ClientResult Simple(User body, CancellationToken cancellationToken = default) => throw null;

        public virtual Task<ClientResult> SimpleAsync(User body, CancellationToken cancellationToken = default) => throw null;
    }
}
