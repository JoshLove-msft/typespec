import { Uri, editor, type IDisposable } from "monaco-editor";
import { useEffect, useMemo, useRef, type FunctionComponent } from "react";

export interface EditorProps {
  model: editor.IModel;
  actions?: editor.IActionDescriptor[];
  options: editor.IStandaloneEditorConstructionOptions;
  onMount?: (data: OnMountData) => void;
}

export interface OnMountData {
  editor: editor.IStandaloneCodeEditor;
}

export interface EditorCommand {
  binding: number;
  handle: () => void;
}

export const Editor: FunctionComponent<EditorProps> = ({ model, options, actions, onMount }) => {
  const editorContainerRef = useRef(null);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  useEffect(() => {
    editorRef.current = editor.create(editorContainerRef.current!, {
      model,
      automaticLayout: true,
      fixedOverflowWidgets: true,
      ...options,
    });
    onMount?.({ editor: editorRef.current });
    // This needs special handling where we only want to run this effect once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const disposables: IDisposable[] = [];
    for (const command of actions ?? []) {
      disposables.push(editorRef.current!.addAction(command));
    }
    return () => {
      disposables.forEach((x) => x.dispose());
    };
  }, [actions]);

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.setModel(model);
    }
  }, [model]);

  return (
    <div
      className="monaco-editor-container"
      style={{ width: "100%", height: "100%" }}
      ref={editorContainerRef}
      data-tabster='{"uncontrolled": {}}' // https://github.com/microsoft/tabster/issues/316
    ></div>
  );
};

export function useMonacoModel(uri: string, language?: string): editor.IModel {
  return useMemo(() => {
    const monacoUri = Uri.parse(uri);
    return editor.getModel(monacoUri) ?? editor.createModel("", language, monacoUri);
  }, [uri, language]);
}

/**
 * Manages multiple Monaco models for a set of files.
 * Creates/updates/disposes models as files change.
 * Returns the active model based on the selected file.
 */
export function useMonacoModels(
  files: Record<string, string>,
  selectedFile: string,
  language: string = "typespec",
): { activeModel: editor.IModel; allModels: Map<string, editor.IModel> } {
  const modelsRef = useRef<Map<string, editor.IModel>>(new Map());

  // Sync models with files
  const allModels = useMemo(() => {
    const models = modelsRef.current;
    const currentPaths = new Set(Object.keys(files));

    // Remove models for deleted files
    for (const [path, model] of models) {
      if (!currentPaths.has(path)) {
        model.dispose();
        models.delete(path);
      }
    }

    // Create or update models for current files
    for (const [path, content] of Object.entries(files)) {
      const uri = Uri.parse(`inmemory://test/${path}`);
      let model = models.get(path);
      if (!model) {
        model = editor.getModel(uri) ?? editor.createModel(content, language, uri);
        models.set(path, model);
      } else if (model.getValue() !== content) {
        model.setValue(content);
      }
    }

    return models;
  }, [files, language]);

  // Get or create the active model
  const activeModel = useMemo(() => {
    const model = allModels.get(selectedFile);
    if (model) return model;

    // Fallback: create a model for the selected file
    const uri = Uri.parse(`inmemory://test/${selectedFile}`);
    const fallback =
      editor.getModel(uri) ?? editor.createModel(files[selectedFile] ?? "", language, uri);
    allModels.set(selectedFile, fallback);
    return fallback;
  }, [allModels, selectedFile, files, language]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      for (const model of modelsRef.current.values()) {
        model.dispose();
      }
      modelsRef.current.clear();
    };
  }, []);

  return { activeModel, allModels };
}
