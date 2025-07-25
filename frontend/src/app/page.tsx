"use client";
import { useState, useEffect, useCallback, Fragment } from "react";
import dynamic from 'next/dynamic';
import { HelpDialog } from "@/components/editor/help";
// Import the dynamic editor component
const MonacoEditor = dynamic(
  () => import('@/components/editor/dynamic-editor'),
  { ssr: false }
);
import { EditorPlaceholder } from "@/components/editor/editor-placeholder";
import {
  Play,
Save,
FileCode,
User,
ChevronRight
} from "lucide-react";
import { useTheme } from "next-themes";
import { createAuthClient } from "better-auth/react";
const { useSession } = createAuthClient();
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Sidebar } from "@/components/sidebar/sidebar";
import TerminalComponent from "@/components/terminal/terminal";
import useFileStore, { getFullPath} from "@/lib/files-store";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/utils/auth";

// File type for our sandbox
interface FileNode {
  id: number;
  parent_id: number | null;
  name: string;
  is_dir: boolean;
  content: string | null;
  created_at: string;
  updated_at: string;
  children?: FileNode[];
}

export default function Home() {
  const { theme } = useTheme();
  const router = useRouter();

  const {
    fileTree,
    activeFileId,
    setActiveFileId,
    loadFileTree,
    updateFileContent,
    activeFile,
    userId,
    setUserId,
    error,
    fileMap
  } = useFileStore();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [consoleOutput, setConsoleOutput] = useState<string[]>([]);
  const [lastSavedContent, setLastSavedContent] = useState<string>('');
  const [savingState, setSavingState] = useState<'unsaved' | 'saving' | 'saved'>('saved');
  const currentFile = activeFile();

  const {
    data: session
  } = useSession();

  // Load file tree when component mounts
  useEffect(() => {
    if (session?.user?.id) {
      setUserId(session.user.id);
      loadFileTree();
    }
  }, [session, setUserId, loadFileTree]);

  useEffect(() => {
    async function getUser() {
      const user = await getCurrentUser();

      if (!user) {
        router.push("/login");
        return;
      }
      setUserId(user.id || "");
    }
    getUser();
    setIsLoading(false);
  }, [router, setUserId]);

  // Handle file content change - just update local state
  const handleEditorChange = (value: string | undefined) => {
    if (!activeFileId || !value || !currentFile) return;
      setLastSavedContent(value);
      setSavingState('unsaved');
  };

  // Handle save button click
  const handleSave = useCallback(async () => {
    if (!activeFileId || !lastSavedContent) return;
    
    try {
      setSavingState('saving');
      await updateFileContent(activeFileId, lastSavedContent);
      setSavingState('saved');
      } catch (error) {
        console.error("Error saving file:", error);
        // Handle error (e.g., show toast)
      }
  }, [activeFileId, lastSavedContent, setSavingState, updateFileContent]);
    
  // Add keyboard shortcut (Cmd+S or Ctrl+S)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault(); // Prevent the browser's save dialog
        handleSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lastSavedContent, activeFileId, handleSave]);

  // Handle file selection from the tree view
  const handleFileSelect = useCallback((filePath: string) => {
    const file = fileMap[filePath];
    if (file) {
      setActiveFileId(file.id);
    }
  }, [fileMap, setActiveFileId]);

  // Helper function to find a file by ID
  const findFileById = (id: number, nodes: FileNode[]): FileNode | undefined => {
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.children) {
        const found = findFileById(id, node.children);
        if (found) return found;
      }
    }
    return undefined;
  };

  const Breadcrumbs = () => {
    const path = currentFile ? getFullPath(currentFile.id, fileMap).split('/') : [];
    return (
      <div className="flex items-center text-sm overflow-x-auto">
        {path.map((part, i) => (
          <Fragment key={i}>
            {i > 0 && <ChevronRight className="h-3 w-3 mx-1.5 text-muted-foreground" />}
            <span className="whitespace-nowrap text-ellipsis overflow-hidden">
              {part}
            </span>
          </Fragment>
        ))}
      </div>
    );
  };


  // Listen for messages from the iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === "console") {
        setConsoleOutput((prev) => [...prev, event.data.content]);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const renderEditor = () => {
    if (!activeFileId && !currentFile) {
      return <EditorPlaceholder />;
    }
    
    const language = "python";
    const content = currentFile?.content || '';

    return (
      <div className="h-full w-full">
        <MonacoEditor
          key={currentFile?.id}
          language={language}
          value={content}
          onChange={handleEditorChange}
          options={{
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            fontSize: 14,
            wordWrap: "on",
            automaticLayout: true,
          }}
        />
      </div>
    );
  };

  // Loading state
  if (isLoading && fileTree.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading files...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center text-red-500">
          <p>Error: {error}</p>
          <Button onClick={loadFileTree} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Remove fixed height to allow proper flex behavior */}
        <div className="flex">
          <Sidebar userId={userId} onSelectChange={handleFileSelect} />
        </div>

        {/* Main Content - Add min-w-0 to prevent flex item from overflowing */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* File Header */}
          {currentFile ? (
            <>
            
              {/* File Header */}
              <div className="bg-muted/40 border-b flex items-center px-6 py-2.5 justify-between min-w-0">
                {/* Left side - File info */}
                <div className="flex items-center space-x-3 min-w-0">
                  <FileCode className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  <div className="flex items-center space-x-4 min-w-0">
                    <span className="text-sm font-medium text-foreground truncate">{Breadcrumbs()}</span>
                    <div className="h-4 w-px bg-border mx-1 flex-shrink-0"></div>
                    <div className="flex items-center flex-shrink-0">
                      {savingState === 'saving' && (
                        <div className="flex items-center text-xs text-amber-500 bg-amber-50 px-2 py-0.5 rounded-full">
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-amber-500 mr-1.5"></div>
                          <span>Saving...</span>
                        </div>
                      )}  
                      {savingState === 'saved' && (
                        <div className="flex items-center text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                          <svg className="h-3 w-3 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                          <span>Saved</span>
                        </div>
                      )}
                      {savingState === 'unsaved' && (
                        <div className="flex items-center text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                          <div className="h-2 w-2 rounded-full bg-amber-500 mr-1.5"></div>
                          <span>Unsaved changes</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right side - Actions */}
                <div className="flex items-center space-x-2">
                  
                  <HelpDialog />

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          size="sm" 
                          variant="secondary" 
                          onClick={handleSave}
                          className="space-x-1.5"
                        >
                          <Save className="h-3.5 w-3.5" />
                          <span>Save</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="text-xs">
                        <p>Save changes (⌘+S)</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <div className="h-6 w-px bg-border mx-1"></div>

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipContent side="bottom" className="text-xs">
                        <p>Settings</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    disabled={!userId}
                    onClick={() => {createAuthClient().signOut(); router.push("/login")}}
                  >
                    {userId ? (
                      <User className="h-4 w-4" />
                    ) : (
                      <span className="text-sm">Sign In</span>
                    )}
                  </Button>
                </div>
              </div>
            
              {/* Editor */}
              {renderEditor()}
            </>
          ) : (
            <EditorPlaceholder />
          )}

          {/* Console Output */}
          <div className="border-t">
            <Tabs defaultValue="terminal" className="h-full flex flex-col">
              <TabsContent value="terminal" className="flex-1 min-h-0">
                <div className="h-full">
                  <TerminalComponent userId={userId} apiBaseUrl={process.env.NODE_ENV === 'production'
                  ? 'https://api.documix.xyz'  // Your Cloudflare Tunnel URL
                  : 'http://localhost:8000'} />
                </div>
              </TabsContent>
              <TabsContent value="output" className="flex-1 min-h-0">
                <div className="h-full overflow-auto">
                  {consoleOutput.length === 0 ? (
                    <p className="text-muted-foreground text-sm italic p-4">
                      No output yet. Run your code to see results here.
                    </p>
                  ) : (
                    <div className="font-mono text-sm p-4">
                      {consoleOutput.map((output, i) => (
                        <div key={i} className="py-1 border-b">
                          {output}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}
