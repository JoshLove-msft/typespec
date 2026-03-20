// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

using System;
using System.Collections.Generic;
using Microsoft.TypeSpec.Generator.Input.Extensions;

namespace Microsoft.TypeSpec.Generator.Shared
{
    internal static class ClientHelper
    {
        /// <summary>
        /// Builds a name with the specified prefix and suffix, ensuring no duplicate prefix or suffix
        /// if the namespace/service segment already contains them.
        /// </summary>
        /// <param name="serviceName">The full service name.</param>
        /// <param name="prefix">The prefix to ensure (e.g., "Service", "Latest").</param>
        /// <param name="suffix">The suffix to ensure (e.g., "Version").</param>
        /// <returns>A name with the specified prefix and suffix.</returns>
        public static string BuildNameForService(string serviceName, string prefix, string suffix)
        {
            var lastNamespaceSegment = serviceName.AsSpan();
            int lastDotIndex = serviceName.LastIndexOf('.');
            if (lastDotIndex >= 0)
            {
                lastNamespaceSegment = lastNamespaceSegment.Slice(lastDotIndex + 1);
            }

            bool hasPrefix = lastNamespaceSegment.StartsWith(prefix.AsSpan(), StringComparison.OrdinalIgnoreCase);
            bool hasSuffix = lastNamespaceSegment.EndsWith(suffix.AsSpan(), StringComparison.OrdinalIgnoreCase);

            return (hasPrefix, hasSuffix) switch
            {
                (true, true) => lastNamespaceSegment.ToString(),
                (true, false) => $"{lastNamespaceSegment}{suffix}",
                (false, true) => $"{prefix}{lastNamespaceSegment}",
                (false, false) => $"{prefix}{lastNamespaceSegment}{suffix}"
            };
        }

        /// <summary>
        /// Builds a name for a service, using the minimum number of trailing namespace segments
        /// needed to avoid collisions with other services. Falls back to more segments only when
        /// the short name (last segment) would collide with another service.
        /// </summary>
        /// <param name="serviceName">The full service name.</param>
        /// <param name="prefix">The prefix to ensure (e.g., "Service", "Latest").</param>
        /// <param name="suffix">The suffix to ensure (e.g., "Version").</param>
        /// <param name="allServiceNamespaces">All service namespaces to check for collisions.</param>
        /// <returns>A name with the specified prefix and suffix, using the minimum segments for uniqueness.</returns>
        public static string BuildNameForService(string serviceName, string prefix, string suffix, IReadOnlyList<string> allServiceNamespaces)
        {
            // First try the short name (last segment only) — this is the common case
            var shortName = BuildNameForService(serviceName, prefix, suffix);
            if (!HasCollision(shortName, serviceName, prefix, suffix, 1, allServiceNamespaces))
            {
                return shortName;
            }

            // Collision detected — progressively add more trailing segments until unique
            var segments = serviceName.Split('.');
            for (int numSegments = 2; numSegments <= segments.Length; numSegments++)
            {
                var candidate = BuildCandidateFromSegments(segments, numSegments, prefix, suffix);
                if (!HasCollision(candidate, serviceName, prefix, suffix, numSegments, allServiceNamespaces))
                {
                    return candidate;
                }
            }

            // Full namespace is always unique since different services have different namespaces
            return BuildCandidateFromSegments(segments, segments.Length, prefix, suffix);
        }

        private static bool HasCollision(
            string candidate,
            string serviceName,
            string prefix,
            string suffix,
            int numSegments,
            IReadOnlyList<string> allServiceNamespaces)
        {
            foreach (var other in allServiceNamespaces)
            {
                if (string.IsNullOrEmpty(other) || other == serviceName)
                {
                    continue;
                }

                var otherCandidate = numSegments == 1
                    ? BuildNameForService(other, prefix, suffix)
                    : BuildCandidateFromSegments(other.Split('.'), numSegments, prefix, suffix);

                if (candidate == otherCandidate)
                {
                    return true;
                }
            }

            return false;
        }

        private static string BuildCandidateFromSegments(string[] segments, int numSegments, string prefix, string suffix)
        {
            int actualSegments = Math.Min(numSegments, segments.Length);
            int startIndex = segments.Length - actualSegments;
            var partial = string.Join(".", segments, startIndex, actualSegments);
            var identifier = partial.ToIdentifierName();

            if (string.IsNullOrEmpty(identifier))
            {
                return $"{prefix}{suffix}";
            }

            bool hasPrefix = identifier.StartsWith(prefix, StringComparison.OrdinalIgnoreCase);
            bool hasSuffix = identifier.EndsWith(suffix, StringComparison.OrdinalIgnoreCase);

            return (hasPrefix, hasSuffix) switch
            {
                (true, true) => identifier,
                (true, false) => $"{identifier}{suffix}",
                (false, true) => $"{prefix}{identifier}",
                (false, false) => $"{prefix}{identifier}{suffix}"
            };
        }
    }
}
