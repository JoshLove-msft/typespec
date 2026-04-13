import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { usePlaygroundState, type PlaygroundState } from "../src/react/use-playground-state.js";

function renderPlaygroundState(initialState: PlaygroundState = {}) {
  return renderHook(() =>
    usePlaygroundState({
      libraries: ["@typespec/http"],
      defaultPlaygroundState: { emitter: "@typespec/openapi3", ...initialState },
    }),
  );
}

describe("usePlaygroundState multi-file support", () => {
  describe("files normalization", () => {
    it("normalizes single-file content to { 'main.tsp': content }", () => {
      const { result } = renderPlaygroundState({ content: "model Foo {}" });
      expect(result.current.files).toEqual({ "main.tsp": "model Foo {}" });
    });

    it("uses files when provided", () => {
      const files = { "main.tsp": "import './models';", "models.tsp": "model Bar {}" };
      const { result } = renderPlaygroundState({ files });
      expect(result.current.files).toEqual(files);
    });

    it("defaults to main.tsp with empty content when nothing provided", () => {
      const { result } = renderPlaygroundState({});
      expect(result.current.files).toEqual({ "main.tsp": "" });
    });
  });

  describe("isMultiFile", () => {
    it("returns false for single-file mode", () => {
      const { result } = renderPlaygroundState({ content: "model Foo {}" });
      expect(result.current.isMultiFile).toBe(false);
    });

    it("returns true when multiple files are present", () => {
      const files = { "main.tsp": "import './models';", "models.tsp": "model Bar {}" };
      const { result } = renderPlaygroundState({ files });
      expect(result.current.isMultiFile).toBe(true);
    });

    it("returns false when files has a single entry", () => {
      const { result } = renderPlaygroundState({ files: { "main.tsp": "model Foo {}" } });
      expect(result.current.isMultiFile).toBe(false);
    });
  });

  describe("selectedFile", () => {
    it("defaults to first file when not specified", () => {
      const files = { "main.tsp": "", "models.tsp": "" };
      const { result } = renderPlaygroundState({ files });
      expect(result.current.selectedFile).toBe("main.tsp");
    });

    it("uses selectedFile when specified", () => {
      const files = { "main.tsp": "", "models.tsp": "" };
      const { result } = renderPlaygroundState({ files, selectedFile: "models.tsp" });
      expect(result.current.selectedFile).toBe("models.tsp");
    });

    it("defaults to main.tsp in single-file mode", () => {
      const { result } = renderPlaygroundState({ content: "model Foo {}" });
      expect(result.current.selectedFile).toBe("main.tsp");
    });
  });

  describe("onSelectedFileChange", () => {
    it("changes the selected file", () => {
      const files = { "main.tsp": "", "models.tsp": "" };
      const { result } = renderPlaygroundState({ files });

      act(() => {
        result.current.onSelectedFileChange("models.tsp");
      });

      expect(result.current.selectedFile).toBe("models.tsp");
    });
  });

  describe("onFilesChange", () => {
    it("updates all files", () => {
      const { result } = renderPlaygroundState({ content: "model Foo {}" });
      const newFiles = { "main.tsp": "import './bar';", "bar.tsp": "model Bar {}" };

      act(() => {
        result.current.onFilesChange(newFiles);
      });

      expect(result.current.files).toEqual(newFiles);
      expect(result.current.isMultiFile).toBe(true);
    });
  });

  describe("onFileContentChange", () => {
    it("updates a specific file in multi-file mode", () => {
      const files = { "main.tsp": "import './models';", "models.tsp": "model Bar {}" };
      const { result } = renderPlaygroundState({ files });

      act(() => {
        result.current.onFileContentChange("models.tsp", "model UpdatedBar {}");
      });

      expect(result.current.files["models.tsp"]).toBe("model UpdatedBar {}");
      expect(result.current.files["main.tsp"]).toBe("import './models';");
    });

    it("creates files from content in single-file mode", () => {
      const { result } = renderPlaygroundState({ content: "model Foo {}" });

      act(() => {
        result.current.onFileContentChange("main.tsp", "model UpdatedFoo {}");
      });

      expect(result.current.files["main.tsp"]).toBe("model UpdatedFoo {}");
    });
  });
});
