// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

using System.ClientModel.Primitives;
using System.Collections.Generic;
using System.Text.Json.Nodes;
using System.Threading.Tasks;
using NUnit.Framework;
using Payload.Pageable;

namespace TestProjects.Spector.Tests.Http.Payload.Pageable
{
    public class NextLinkPaginationTests : SpectorTestBase
    {
        [SpectorTest]
        [Ignore("https://github.com/microsoft/typespec/issues/8009")]
        public Task ConvenienceMethod() => Test(async (host) =>
        {
            var client = new PageableClient(host, null);
            var result = client.GetServerDrivenPaginationClient().LinkAsync();
            int count = 0;
            var expectedPets = new Dictionary<string, string>()
            {
                { "1", "dog" },
                { "2", "cat" },
                { "3", "bird" },
                { "4", "fish" },
            };
            await foreach (var pet in result)
            {
                Assert.IsNotNull(pet);
                Assert.AreEqual((++count).ToString(), pet.Id);
                Assert.AreEqual(expectedPets[pet.Id], pet.Name);
            }
        });

        [SpectorTest]
        [Ignore("https://github.com/microsoft/typespec/issues/8009")]
        public Task ConvenienceMethodSync() => Test((host) =>
        {
            var client = new PageableClient(host, null);
            var result = client.GetServerDrivenPaginationClient().Link();
            int count = 0;
            var expectedPets = new Dictionary<string, string>()
            {
                { "1", "dog" },
                { "2", "cat" },
                { "3", "bird" },
                { "4", "fish" },
            };
            foreach (var pet in result)
            {
                Assert.IsNotNull(pet);
                Assert.AreEqual((++count).ToString(), pet.Id);
                Assert.AreEqual(expectedPets[pet.Id], pet.Name);
            }
            return Task.CompletedTask;
        });

        [SpectorTest]
        [Ignore("https://github.com/microsoft/typespec/issues/8009")]
        public Task ProtocolMethod() => Test(async (host) =>
        {
            var client = new PageableClient(host, null);
            var result = client.GetServerDrivenPaginationClient().LinkAsync(new RequestOptions());
            int count = 0;
            var expectedPets = new Dictionary<string, string>()
            {
                { "1", "dog" },
                { "2", "cat" },
                { "3", "bird" },
                { "4", "fish" },
            };
            await foreach (var page in result.GetRawPagesAsync())
            {
                Assert.IsNotNull(page);
                var pageResult = JsonNode.Parse(page.GetRawResponse().Content.ToString())!;
                foreach (var pet in (pageResult["pets"] as JsonArray)!)
                {
                    Assert.IsNotNull(pet);
                    Assert.IsNotNull(pet);
                    Assert.AreEqual((++count).ToString(), pet!["id"]!.ToString());
                    Assert.AreEqual(expectedPets[pet["id"]!.ToString()], pet["name"]!.ToString());
                }
            }
        });

        [SpectorTest]
        [Ignore("https://github.com/microsoft/typespec/issues/8009")]
        public Task ProtocolMethodSync() => Test((host) =>
        {
            var client = new PageableClient(host, null);
            var result = client.GetServerDrivenPaginationClient().Link(new RequestOptions());
            int count = 0;
            var expectedPets = new Dictionary<string, string>()
            {
                { "1", "dog" },
                { "2", "cat" },
                { "3", "bird" },
                { "4", "fish" },
            };
            foreach (var page in result.GetRawPages())
            {
                Assert.IsNotNull(page);
                var pageResult = JsonNode.Parse(page.GetRawResponse().Content.ToString())!;
                foreach (var pet in (pageResult["pets"] as JsonArray)!)
                {
                    Assert.IsNotNull(pet);
                    Assert.IsNotNull(pet);
                    Assert.AreEqual((++count).ToString(), pet!["id"]!.ToString());
                    Assert.AreEqual(expectedPets[pet["id"]!.ToString()], pet["name"]!.ToString());
                }
            }
            return Task.CompletedTask;
        });
    }
}
