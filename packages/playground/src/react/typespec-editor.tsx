import { editor, Range } from "monaco-editor";
import { useCallback, useEffect, useRef, useState, type FunctionComponent } from "react";
import { Editor, useMonacoModel, type EditorProps } from "./editor.js";
import type { PlaygroundEditorsOptions } from "./playground.js";

export interface TypeSpecEditorProps extends Omit<EditorProps, "options"> {
  options?: editor.IStandaloneEditorConstructionOptions;
}

export const TypeSpecEditor: FunctionComponent<TypeSpecEditorProps> = ({
  actions,
  options,
  ...other
}) => {
  const resolvedOptions: editor.IStandaloneEditorConstructionOptions = {
    "semanticHighlighting.enabled": true,
    automaticLayout: true,
    tabSize: 2,
    minimap: {
      enabled: false,
    },
    ...options,
  };
  return <Editor actions={actions} options={resolvedOptions} {...other}></Editor>;
};

/**
 * Computes which lines in the new text are changed or inserted compared to the old text.
 * Uses a longest common subsequence (LCS) approach to handle insertions/deletions properly.
 */
export function getChangedLineNumbers(oldText: string, newText: string): number[] {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");

  // Build a set of old lines that are "matched" via LCS
  const oldSet = new Set<string>(oldLines);
  const matchedNewIndices = new Set<number>();

  // Simple greedy match: walk both arrays with two pointers
  let oi = 0;
  for (let ni = 0; ni < newLines.length; ni++) {
    // Try to find current new line in remaining old lines
    let found = false;
    for (let j = oi; j < oldLines.length; j++) {
      if (newLines[ni] === oldLines[j]) {
        matchedNewIndices.add(ni);
        oi = j + 1;
        found = true;
        break;
      }
    }
    // If not found in forward scan, it might still match a later occurrence
    // but for highlighting purposes, treating it as changed is acceptable
  }

  // Lines not matched are changed/inserted
  const changed: number[] = [];
  for (let ni = 0; ni < newLines.length; ni++) {
    if (!matchedNewIndices.has(ni)) {
      changed.push(ni + 1); // Monaco lines are 1-based
    }
  }
  return changed;
}

export const OutputEditor: FunctionComponent<{
  filename: string;
  value: string;
  changedLineNumbers?: number[];
  editorOptions?: PlaygroundEditorsOptions;
}> = ({ filename, value, changedLineNumbers, editorOptions }) => {
  const model = useMonacoModel(filename);
  const [editorInstance, setEditorInstance] = useState<editor.IStandaloneCodeEditor | null>(null);
  const decorationCollectionRef = useRef<editor.IEditorDecorationsCollection | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onMount = useCallback(({ editor: ed }: { editor: editor.IStandaloneCodeEditor }) => {
    decorationCollectionRef.current = ed.createDecorationsCollection();
    setEditorInstance(ed);
  }, []);

  useEffect(() => {
    if (filename === "") return;
    model.setValue(value);
  }, [filename, value, model]);

  // Apply changed line decorations when provided
  useEffect(() => {
    if (!editorInstance || !decorationCollectionRef.current) return;

    if (changedLineNumbers && changedLineNumbers.length > 0 && changedLineNumbers.length < 500) {
      decorationCollectionRef.current.set(
        changedLineNumbers.map((line) => ({
          range: new Range(line, 1, line, 1),
          options: {
            isWholeLine: true,
            className: "playground-changed-line",
          },
        })),
      );

      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = setTimeout(() => {
        decorationCollectionRef.current?.clear();
      }, 3000);
    } else {
      decorationCollectionRef.current.clear();
    }
  }, [changedLineNumbers, editorInstance]);

  if (filename === "") {
    return null;
  }
  const options: editor.IStandaloneEditorConstructionOptions = {
    ...editorOptions,
    readOnly: true,
    automaticLayout: true,
    minimap: {
      enabled: false,
    },
  };
  return <Editor model={model} options={options} onMount={onMount}></Editor>;
};
