import { editor, Range } from "monaco-editor";
import { useCallback, useEffect, useRef, useState, type FunctionComponent } from "react";
import "./editor-decorations.css";
import { Editor, useMonacoModel, type EditorProps } from "./editor.js";
import type { PlaygroundEditorsOptions } from "./playground.js";

// Re-export for backward compatibility
export { getChangedLineNumbers } from "./diff-utils.js";

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
