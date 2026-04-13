vi.resetModules();

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GenerateOptions } from "../../src/emit-generate.js";
import type { CSharpEmitterContext } from "../../src/sdk-context.js";

// Mock @typespec/compiler to provide resolvePath
vi.mock("@typespec/compiler", () => ({
  resolvePath: (...segments: string[]) => segments.join("/"),
}));

// Create a mock context with a writable host
function createMockContext(): CSharpEmitterContext {
  return {
    program: {
      host: {
        writeFile: vi.fn(),
      },
    },
  } as unknown as CSharpEmitterContext;
}

const defaultOptions: GenerateOptions = {
  outputFolder: "/output",
  generatorName: "ScmCodeModelGenerator",
  packageName: "TestPackage",
  newProject: false,
  debug: false,
  saveInputs: false,
};

describe("emit-generate.browser", () => {
  let generate: typeof import("../../src/emit-generate.browser.js").generate;

  beforeEach(async () => {
    vi.resetModules();
    // Clear any custom server URL
    delete (globalThis as any).__TYPESPEC_PLAYGROUND_SERVER_URL__;
    // Re-import to pick up fresh module state
    generate = (await import("../../src/emit-generate.browser.js")).generate;
  });

  it("should POST code model to the default server URL", async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({ files: [] }),
    };
    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    const ctx = createMockContext();
    await generate(ctx, '{"model":"test"}', '{"config":"test"}', defaultOptions);

    expect(fetch).toHaveBeenCalledWith(
      "https://csharp-playground-server.azurewebsites.net/generate",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    );
  });

  it("should use custom server URL from globalThis when set", async () => {
    (globalThis as any).__TYPESPEC_PLAYGROUND_SERVER_URL__ = "https://custom-server.example.com";
    // Re-import to pick up the new global
    generate = (await import("../../src/emit-generate.browser.js")).generate;

    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({ files: [] }),
    };
    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    const ctx = createMockContext();
    await generate(ctx, '{"model":"test"}', '{"config":"test"}', defaultOptions);

    expect(fetch).toHaveBeenCalledWith(
      "https://custom-server.example.com/generate",
      expect.anything(),
    );
  });

  it("should send codeModel, configuration, and generatorName in request body", async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({ files: [] }),
    };
    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    const ctx = createMockContext();
    await generate(ctx, '{"model":"data"}', '{"namespace":"Test"}', {
      ...defaultOptions,
      generatorName: "CustomGenerator",
    });

    const callArgs = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(callArgs[1]!.body as string);
    expect(body).toEqual({
      codeModel: '{"model":"data"}',
      configuration: '{"namespace":"Test"}',
      generatorName: "CustomGenerator",
    });
  });

  it("should write response files to the host", async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        files: [
          { path: "src/Generated/Model.cs", content: "public class Model {}" },
          { path: "src/Generated/Client.cs", content: "public class Client {}" },
        ],
      }),
    };
    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    const ctx = createMockContext();
    await generate(ctx, '{"model":"test"}', '{"config":"test"}', defaultOptions);

    const writeFile = vi.mocked(ctx.program.host.writeFile);
    expect(writeFile).toHaveBeenCalledTimes(2);
    expect(writeFile).toHaveBeenCalledWith(
      "/output/src/Generated/Model.cs",
      "public class Model {}",
    );
    expect(writeFile).toHaveBeenCalledWith(
      "/output/src/Generated/Client.cs",
      "public class Client {}",
    );
  });

  it("should throw on non-OK response", async () => {
    const mockResponse = {
      ok: false,
      status: 500,
      text: vi.fn().mockResolvedValue('{"error":"Generator failed"}'),
    };
    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    const ctx = createMockContext();
    await expect(
      generate(ctx, '{"model":"test"}', '{"config":"test"}', defaultOptions),
    ).rejects.toThrow("Playground server error (500)");
  });

  it("should handle empty files array in response", async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({ files: [] }),
    };
    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    const ctx = createMockContext();
    await generate(ctx, '{"model":"test"}', '{"config":"test"}', defaultOptions);

    const writeFile = vi.mocked(ctx.program.host.writeFile);
    expect(writeFile).not.toHaveBeenCalled();
  });
});
