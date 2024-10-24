// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

using System.ClientModel.Primitives;
using Microsoft.Generator.CSharp.ClientModel.Providers;
using Microsoft.Generator.CSharp.Expressions;
using Microsoft.Generator.CSharp.Snippets;

namespace Microsoft.Generator.CSharp.ClientModel.Snippets
{
    internal static class PipelineMessageSnippets
    {
        public static ScopedApi<PipelineRequest> Request(this ScopedApi<PipelineMessage> pipelineMessage)
            => pipelineMessage.Property(nameof(PipelineMessage.Request)).As<PipelineRequest>();

        public static HttpResponseApi Response(this ScopedApi<PipelineMessage> pipelineMessage)
            => pipelineMessage.Property(nameof(PipelineMessage.Response)).ToApi<HttpResponseApi>();

        public static ScopedApi<bool> BufferResponse(this ScopedApi<PipelineMessage> pipelineMessage)
            => pipelineMessage.Property(nameof(PipelineMessage.BufferResponse)).As<bool>();

        public static HttpResponseApi ExtractResponse(this ScopedApi<PipelineMessage> pipelineMessage)
            => pipelineMessage.Invoke(nameof(PipelineMessage.ExtractResponse), []).ToApi<HttpResponseApi>();

        public static ScopedApi<PipelineMessageClassifier> ResponseClassifier(this ScopedApi<PipelineMessage> pipelineMessage)
            => pipelineMessage.Property(nameof(PipelineMessage.ResponseClassifier)).As<PipelineMessageClassifier>();

        public static InvokeMethodExpression Apply(this ScopedApi<PipelineMessage> pipelineMessage, ValueExpression options)
            => pipelineMessage.Invoke(nameof(PipelineMessage.Apply), options);
    }
}
