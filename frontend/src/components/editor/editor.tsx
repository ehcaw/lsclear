// In editor.tsx
import { useEffect, useRef } from "react";
import * as monaco from "monaco-editor";
import { useTheme } from "next-themes";

interface MonacoEditorProps {
  value: string;
  onChange?: (value: string) => void;
  language?: string;
  theme?: 'light' | 'dark' | 'vs-dark';
  options?: monaco.editor.IStandaloneEditorConstructionOptions;
  className?: string;
}

export default function MonacoEditor({
  value,
  onChange,
  language = "python",
  options = {},
  className = "",
}: MonacoEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const monacoEditorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const { theme } = useTheme();

  // Initialize editor and handle theme changes
  useEffect(() => {
    if (!editorRef.current) return;

    // Only create the editor if it doesn't exist
    if (!monacoEditorRef.current) {
      // Define theme
      monaco.editor.defineTheme("customTheme", {
        base: theme === "dark" ? "vs-dark" : "vs",
        inherit: true,
        rules: [],
        colors: {},
      });

      // Create editor
      monacoEditorRef.current = monaco.editor.create(editorRef.current, {
        value,
        language,
        theme: "vs-dark",
        automaticLayout: true,
        minimap: { enabled: true },
        scrollBeyondLastLine: false,
        ...options,
      });

      // Set up change handler
      const model = monacoEditorRef.current.getModel();
      if (model) {
        const changeSubscription = model.onDidChangeContent(() => {
          onChange?.(model.getValue());
        });
        
        // Clean up subscription on unmount
        return () => {
          changeSubscription.dispose();
          monacoEditorRef.current?.dispose();
          monacoEditorRef.current = null;
        };
      }
    }
  }, []); // Empty dependency array - only run on mount

  // Update theme when it changes
  useEffect(() => {
    if (monacoEditorRef.current) {
      monaco.editor.setTheme(theme === "dark" ? "vs-dark" : "vs");
    }
  }, [theme]);

  // Update value when it changes from outside
  useEffect(() => {
    if (monacoEditorRef.current) {
      const model = monacoEditorRef.current.getModel();
      if (model && value !== model.getValue()) {
        // Preserve cursor position
        const position = monacoEditorRef.current.getPosition();
        model.setValue(value);
        if (position) {
          monacoEditorRef.current.setPosition(position);
        }
      }
    }
  }, [value]);

  // Update language when it changes
  useEffect(() => {
    if (monacoEditorRef.current) {
      const model = monacoEditorRef.current.getModel();
      if (model) {
        monaco.editor.setModelLanguage(model, language);
      }
    }
  }, [language]);

  // Update options when they change
  useEffect(() => {
    if (monacoEditorRef.current) {
      monacoEditorRef.current.updateOptions(options);
    }
  }, [options]);

  return <div ref={editorRef} className={className} style={{ height: "100%", width: "100%" }} />;
}