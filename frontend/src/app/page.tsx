"use client";
import { useState, useEffect, useRef } from "react";
import dynamic from 'next/dynamic';

// Import the dynamic editor component
const MonacoEditor = dynamic(
  () => import('@/components/editor/dynamic-editor'),
  { ssr: false }
);
import { EditorPlaceholder } from "@/components/editor/editor-placeholder";
import {
  Play,
  Plus,
  Save,
  Settings,
  Code,
  X,
  Terminal,
  FileCode,
  Trash2,
  User,
} from "lucide-react";
import { useTheme } from "next-themes";
import { createAuthClient } from "better-auth/react";
const { useSession } = createAuthClient();
import { Button } from "@/components/ui/button";
import { Card, CardContent} from "@/components/ui/card";
import { Tabs, TabsContent, } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Sidebar } from "@/components/sidebar/sidebar";
import TerminalComponent from "@/components/terminal/terminal";
import useFileStore from "@/lib/files-store";
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
    createFile,
    createDirectory,
    updateFileContent,
    deleteNode,
    activeFile,
    userId,
    setUserId,
    error,
    fileMap
  } = useFileStore();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [consoleOutput, setConsoleOutput] = useState<string[]>([]);
  const [newFileName, setNewFileName] = useState("");
  const [newFileDialogOpen, setNewFileDialogOpen] = useState(false);
  const [lastSavedContent, setLastSavedContent] = useState("");
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(
    null,
  );
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const currentFile = activeFile();

  const {
    data: session,
    isPending, //loading state
    error: err, //error object
    refetch, //refetch the session
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

      console.log(user.id);
      setUserId(user.id || "");
    }
    getUser();
    setIsLoading(false);
  }, [router]);

  // Handle file content change with debouncing
  const handleEditorChange = (value: string | undefined) => {
    if (!activeFileId || !value || !currentFile) return;
    
    // Update local state immediately for a responsive UI
    updateFileContent(activeFileId, value);
    
    // Debounce the API call to save changes
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    
    const timer = setTimeout(async () => {
      try {
        await updateFileContent(activeFileId, value);
        setLastSavedContent(value);
      } catch (error) {
        console.error("Error saving file:", error);
        // Handle error (e.g., show toast)
      }
    }, 1000);
    
    setDebounceTimer(timer);
  };

  // Handle file selection from the tree view
  const handleFileSelect = (filePath: string) => {
    console.log(filePath)
    // Find the file in your fileTree by path
    setActiveFileId(fileMap[filePath].id);
  };

  // Update last saved content when active file changes
  useEffect(() => {
    if (currentFile) {
      setLastSavedContent(currentFile.content || "");
    }
  }, [currentFile?.id]);

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

  // Run the code
  const runCode = () => {
    // Implementation for running code
    console.log("Running code...");
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
    if (!currentFile) {
      return <EditorPlaceholder />;
    }

    const language = "python";
    const content = currentFile.content || '';

    return (
      <div className="h-full w-full">
        <MonacoEditor
          key={currentFile.id}
          language={language}
          value={content}
          onChange={handleEditorChange}
          theme={theme === "dark" ? "vs-dark" : "light"}
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
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="border-b py-2 px-4 flex items-center justify-between bg-card">
        <div className="flex items-center space-x-2">
          <Code className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold">AfterQuery Sandbox</h1>
        </div>
        <div className="flex space-x-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button onClick={runCode} size="sm" variant="default">
                  <Play className="h-4 w-4 mr-2" /> Run
                </Button>
              </TooltipTrigger>
              <TooltipContent>Run your code</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="secondary">
                  <Save className="h-4 w-4 mr-2" /> Save
                </Button>
              </TooltipTrigger>
              <TooltipContent>Files are auto-saved</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="ghost">
                  <Settings className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Settings</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button
            variant="ghost"
            disabled={userId}
            onClick={() => {
              router.push("/login");
            }}
          >
            {userId ? <User className="h-4 w-4" /> : <div>Sign In</div>}
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex h-screen">
          <Sidebar userId={userId} onSelectChange={handleFileSelect} />
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* File Header */}
          {currentFile ? (
            <>
              {/* File Header */}
              <div className="bg-muted/40 border-b flex items-center px-4 py-1.5">
                <FileCode className="h-4 w-4 mr-2 text-muted-foreground" />
                <span className="text-sm font-medium">{currentFile.name}</span>
                {isLoading && (
                  <div className="ml-2 animate-spin rounded-full h-3 w-3 border-b-2 border-primary"></div>
                )}
              </div>
            
              {/* Editor */}
              {renderEditor()}
            </>
          ) : (
            <EditorPlaceholder />
          )}

          {/* Console Output */}
          <Card className="rounded-none border-t border-l-0 border-r-0 border-b-0">
            <Tabs defaultValue="terminal">
              <TabsContent value="terminal">
                <Card
                  id="terminal-container"
                  className="rounded-none border-t border-l-0 border-r-0 border-b-0 h-80"
                >
                  <TerminalComponent userId={userId} apiBaseUrl={process.env.NEXT_PUBLIC_REACT_APP_API_URL} />
                </Card>
              </TabsContent>
              <TabsContent value="output">
                <Card className="rounded-none border-t border-l-0 border-r-0 border-b-0">
                  <CardContent className="p-0">
                    <ScrollArea className="h-40 w-full">
                      <div className="p-4">
                        {consoleOutput.length === 0 ? (
                          <p className="text-muted-foreground text-sm italic">
                            No output yet. Run your code to see results here.
                          </p>
                        ) : (
                          <div className="font-mono text-sm">
                            {consoleOutput.map((output, i) => (
                              <div key={i} className="py-1 border-b">
                                {output}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </Card>
        </div>
      </div>
    </div>
  );
}
