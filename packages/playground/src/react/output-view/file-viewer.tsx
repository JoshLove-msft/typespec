import { FolderListRegular } from "@fluentui/react-icons";
import { Pane, SplitPane } from "@typespec/react-components";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FileBreadcrumb } from "../breadcrumb/index.js";
import { FileOutput } from "../file-output/file-output.js";
import { FileTreeExplorer } from "../file-tree/index.js";
import { OutputTabs } from "../output-tabs/output-tabs.js";
import type { FileOutputViewer, OutputViewerProps, ProgramViewer } from "../types.js";
import { getChangedLineNumbers } from "../typespec-editor.js";

import style from "./output-view.module.css";

const FileViewerComponent = ({
  program,
  outputFiles,
  fileViewers,
  highlightChanges,
}: OutputViewerProps & {
  fileViewers: Record<string, FileOutputViewer>;
  highlightChanges: boolean;
}) => {
  const [filename, setFilename] = useState<string>("");
  const [content, setContent] = useState<string>("");
  const [changedFiles, setChangedFiles] = useState<Set<string>>(new Set());
  const [changedLines, setChangedLines] = useState<Map<string, number[]>>(new Map());
  const prevContentsRef = useRef<Map<string, string>>(new Map());

  const showFileTree = useMemo(
    () => outputFiles.some((f) => f.includes("/")) || outputFiles.length >= 3,
    [outputFiles],
  );

  const loadOutputFile = useCallback(
    async (path: string) => {
      const contents = await program.host.readFile("./tsp-output/" + path);
      setContent(contents.text);
    },
    [program.host],
  );

  // When output files change, diff all file contents against cached versions
  useEffect(() => {
    if (!highlightChanges) return;
    let cancelled = false;
    async function diffFiles() {
      const changed = new Set<string>();
      const lines = new Map<string, number[]>();
      const newContents = new Map<string, string>();

      // If no files from the new output exist in the cache, this is an emitter
      // switch or initial load — populate the cache without highlighting.
      const isEmitterSwitch =
        prevContentsRef.current.size > 0 &&
        !outputFiles.some((f) => prevContentsRef.current.has(f));

      let hasAnyChange = false;
      for (const file of outputFiles) {
        try {
          const contents = await program.host.readFile("./tsp-output/" + file);
          newContents.set(file, contents.text);
          if (!isEmitterSwitch) {
            const prev = prevContentsRef.current.get(file);
            if (prev === undefined && prevContentsRef.current.size > 0) {
              changed.add(file);
              // New file: highlight all lines
              const lineCount = contents.text.split("\n").length;
              lines.set(
                file,
                Array.from({ length: lineCount }, (_, i) => i + 1),
              );
              hasAnyChange = true;
            } else if (prev !== undefined && prev !== contents.text) {
              changed.add(file);
              lines.set(file, getChangedLineNumbers(prev, contents.text));
              hasAnyChange = true;
            } else if (prev === undefined) {
              hasAnyChange = true;
            }
          } else {
            hasAnyChange = true;
          }
        } catch {
          // file may not be readable
        }
      }
      if (cancelled) return;
      // Only update cache and changed state when something actually changed.
      // This prevents spurious effect re-runs from clearing the highlights.
      if (hasAnyChange || prevContentsRef.current.size === 0) {
        prevContentsRef.current = newContents;
        setChangedFiles(changed);
        setChangedLines(lines);
      }
    }
    void diffFiles();
    return () => {
      cancelled = true;
    };
  }, [program, outputFiles, highlightChanges]);

  useEffect(() => {
    if (outputFiles.length > 0) {
      const fileStillThere = outputFiles.find((x) => x === filename);
      const newFilename = fileStillThere ?? outputFiles[0];
      setFilename(newFilename);
      void loadOutputFile(fileStillThere ?? outputFiles[0]);
    } else {
      setFilename("");
    }
  }, [program, outputFiles, loadOutputFile, filename]);

  const handleFileSelection = useCallback(
    (newFilename: string) => {
      // Only select files, not directories
      if (outputFiles.includes(newFilename)) {
        setFilename(newFilename);
        void loadOutputFile(newFilename);
      }
    },
    [loadOutputFile, outputFiles],
  );

  if (outputFiles.length === 0) {
    return <>No files emitted.</>;
  }

  if (showFileTree) {
    return (
      <div className={style["file-viewer"]}>
        <SplitPane initialSizes={["220px", undefined]}>
          <Pane minSize={120} maxSize={400}>
            <FileTreeExplorer
              files={outputFiles}
              selected={filename}
              onSelect={handleFileSelection}
              changedFiles={highlightChanges ? changedFiles : undefined}
            />
          </Pane>
          <Pane>
            <div className={style["file-viewer-content-with-breadcrumb"]}>
              <FileBreadcrumb path={filename} />
              <div className={style["file-viewer-content"]}>
                <FileOutput
                  filename={filename}
                  content={content}
                  viewers={fileViewers}
                  changedLineNumbers={highlightChanges ? changedLines.get(filename) : undefined}
                />
              </div>
            </div>
          </Pane>
        </SplitPane>
      </div>
    );
  }

  return (
    <div className={style["file-viewer"]}>
      <OutputTabs filenames={outputFiles} selected={filename} onSelect={handleFileSelection} />
      <div className={style["file-viewer-content"]}>
        <FileOutput
          filename={filename}
          content={content}
          viewers={fileViewers}
          changedLineNumbers={highlightChanges ? changedLines.get(filename) : undefined}
        />
      </div>
    </div>
  );
};

export interface FileViewerOptions {
  /** When true, highlights changed files in the tree and changed lines in the editor after recompilation. */
  highlightChanges?: boolean;
}

export function createFileViewer(
  fileViewers: FileOutputViewer[],
  options?: FileViewerOptions,
): ProgramViewer {
  const viewerMap = Object.fromEntries(fileViewers.map((x) => [x.key, x]));
  const highlightChanges = options?.highlightChanges ?? false;
  return {
    key: "file-output",
    label: "Output explorer",
    icon: <FolderListRegular />,
    render: (props) => {
      return (
        <FileViewerComponent
          {...props}
          fileViewers={viewerMap}
          highlightChanges={highlightChanges}
        />
      );
    },
  };
}
