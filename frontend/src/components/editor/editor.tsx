"use client";
import React, { useRef, useEffect } from "react";
import * as monaco from "monaco-editor";

interface MonacoEditorProps {
  value: string;
  language?: string;
  theme?: string;
  options?: monaco.editor.IStandaloneEditorConstructionOptions;
  onChange?: (value: string) => void;
  height?: string;
  width?: string;
}

const MonacoEditor: React.FC<MonacoEditorProps> = ({
  value,
  language = "python",
  theme = "vs-dark",
  options = {},
  onChange,
  height = "500px",
  width = "100%",
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const monacoEditorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(
    null,
  );

  useEffect(() => {
    if (editorRef.current) {
      monaco.editor.defineTheme("customTheme", {
        base: theme === "vs-dark" ? "vs-dark" : "vs",
        inherit: true,
        rules: [],
        colors: {},
      });

      monacoEditorRef.current = monaco.editor.create(editorRef.current, {
        value,
        language,
        theme: "customTheme",
        automaticLayout: true,
        minimap: { enabled: true },
        scrollBeyondLastLine: false,
        ...options,
      });

      monacoEditorRef.current.onDidChangeModelContent(() => {
        if (onChange && monacoEditorRef.current) {
          onChange(monacoEditorRef.current.getValue());
        }
      });
    }

    return () => {
      monacoEditorRef.current?.dispose();
    };
  }, []);
  useEffect(() => {
    if (
      monacoEditorRef.current &&
      typeof value === "string" &&
      value !== monacoEditorRef.current.getValue()
    ) {
      monacoEditorRef.current.setValue(value);
    }
  }, [value]);

  // Update language and theme when they change
  useEffect(() => {
    if (monacoEditorRef.current) {
      monaco.editor.setModelLanguage(
        monacoEditorRef.current.getModel()!,
        language,
      );
      monaco.editor.setTheme(theme === "vs-dark" ? "vs-dark" : "vs");
    }
  }, [language, theme]);

  // Update options when they change
  useEffect(() => {
    if (monacoEditorRef.current) {
      monacoEditorRef.current.updateOptions(options);
    }
  }, [options]);

  return <div ref={editorRef} style={{ height, width }} />;
};

export default MonacoEditor;
