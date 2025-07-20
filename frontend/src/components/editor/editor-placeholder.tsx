import { FileText, Code, Terminal, Zap } from "lucide-react";

// Add this component before your main component
export const EditorPlaceholder = () => (
  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
    <div className="bg-muted/50 p-6 rounded-lg max-w-md w-full">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-4">
        <Code className="h-6 w-6 text-primary" />
      </div>
      <h3 className="text-lg font-medium mb-2">No File Selected</h3>
      <p className="text-muted-foreground text-sm mb-6">
        Select a file from the sidebar or create a new one to start editing.
      </p>
      <div className="space-y-3 text-sm text-muted-foreground text-left">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-500" />
          <span>Quickly open files with <kbd className="px-1.5 py-0.5 text-xs rounded bg-muted border font-mono">⌘K</kbd></span>
        </div>
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-green-500" />
          <span>Use the terminal for advanced operations</span>
        </div>
      </div>
    </div>
  </div>
);