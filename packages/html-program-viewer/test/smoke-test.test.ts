import type { BasicTestRunner } from "@typespec/compiler/testing";
import { beforeEach, it } from "vitest";
import { createViewerTestRunner } from "./test-host.js";

let runner: BasicTestRunner;

beforeEach(async () => {
  runner = await createViewerTestRunner();
});

it("create html view", async () => {
  await runner.compile(`op foo(): string;`);
});

it("compile unnamed union variant without error", async () => {
  await runner.compile(`union Foo { "a", "b" }`);
});
