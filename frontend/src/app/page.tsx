"use client";
import { useState, useEffect, useRef } from "react";
import dynamic from 'next/dynamic';

// Import the dynamic editor component
const MonacoEditor = dynamic(
  () => import('@/components/editor/dynamic-editor'),
  { ssr: false }
);
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
  UserNav,
} from "lucide-react";
import { useTheme } from "next-themes";
import { createAuthClient } from "better-auth/react";
const { useSession } = createAuthClient();
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Sidebar } from "@/components/sidebar/sidebar";
import { Separator } from "@/components/ui/separator";
import TerminalComponent from "@/components/terminal/terminal";
import useFileStore from "@/lib/files-store";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/utils/auth";
import { TreeDataItem } from "@/components/sidebar/tree-view";

// File type for our sandbox
interface File {
  id: string;
  name: string;
  language: string;
  content: string;
  created_at?: string;
  updated_at?: string;
}

export default function Home() {
  const { theme } = useTheme();
  const router = useRouter();

  const {
    userId,
    files,
    activeFileId,
    isLoading,
    error,
    setUserId,
    loadFiles,
    addFile,
    updateFileContent,
    deleteFile,
    setActiveFileId,
    activeFile,
  } = useFileStore();

  const [consoleOutput, setConsoleOutput] = useState<string[]>([]);
  const [newFileName, setNewFileName] = useState("");
  const [newFileDialogOpen, setNewFileDialogOpen] = useState(false);
  const [lastSavedContent, setLastSavedContent] = useState("");
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(
    null,
  );
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const {
    data: session,
    isPending, //loading state
    error: err, //error object
    refetch, //refetch the session
  } = useSession();

  // Load files on component mount
  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

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
  }, [router]);

  // Get current active file
  const currentFile = activeFile();

  // Handle file content change with debouncing
  const handleCodeChange = (value: string) => {
    if (!currentFile) return;

    // Clear existing timer
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    // Set new timer to save after 1 second of no changes
    const newTimer = setTimeout(() => {
      if (value !== lastSavedContent) {
        updateFileContent(currentFile.id, value);
        setLastSavedContent(value);
      }
    }, 1000);

    setDebounceTimer(newTimer);
  };

  const handleFileSelect = (item: TreeDataItem | undefined) => {
    if (item && !item.children) {
      console.log("File selected:", item.name);
      // setCurrentFile(item);
      setActiveFileId(item.id);
      // Add logic to open the file
    }
  };

  // Update last saved content when active file changes
  useEffect(() => {
    if (currentFile) {
      setLastSavedContent(currentFile.content);
    }
  }, [currentFile?.id]);

  // Handle adding new file
  const handleAddFile = async () => {
    if (!newFileName.trim()) return;

    const extension = newFileName.split(".").pop() || "";
    const languageMap: { [key: string]: string } = {
      py: "python",
      js: "javascript",
      ts: "typescript",
      tsx: "typescript",
      jsx: "javascript",
      html: "html",
      css: "css",
      json: "json",
      md: "markdown",
      txt: "plaintext",
    };

    const newFile = {
      name: newFileName,
      language: languageMap[extension] || "plaintext",
      content: "",
    };

    await addFile(newFile);
    setNewFileName("");
    setNewFileDialogOpen(false);
  };

  // Handle file deletion
  const handleDeleteFile = async (fileId: string) => {
    if (files.length <= 1) {
      alert("Cannot delete the last file!");
      return;
    }

    if (confirm("Are you sure you want to delete this file?")) {
      await deleteFile(fileId);
    }
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

  const fileTreeData: TreeDataItem[] = [
    {
      id: "1",
      name: "src",
      children: [
        { id: "2", name: "app.tsx" },
        { id: "3", name: "styles.css" },
        {
          id: "4",
          name: "components",
          children: [{ id: "5", name: "button.tsx" }],
        },
      ],
    },
    {
      id: "6",
      name: "package.json",
    },
    {
      id: "7",
      name: "README.md",
    },
  ];

  // Loading state
  if (isLoading && files.length === 0) {
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
          <Button onClick={loadFiles} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // No active file
  if (!currentFile) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <p className="mb-4">No files available</p>
          <Button onClick={() => setNewFileDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create New File
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
          <div className="bg-muted/40 border-b flex items-center px-4 py-1.5">
            <FileCode className="h-4 w-4 mr-2 text-muted-foreground" />
            <span className="text-sm font-medium">{currentFile.name}</span>
            {isLoading && (
              <div className="ml-2 animate-spin rounded-full h-3 w-3 border-b-2 border-primary"></div>
            )}
          </div>

          {/* Editor */}
          <div className="flex-1 overflow-hidden">
            <MonacoEditor
              value={currentFile.content}
              onChange={handleCodeChange}
              language={currentFile.language}
              theme={theme === "dark" ? "vs-dark" : "vs-light"}
              options={{
                minimap: { enabled: true },
                fontSize: 14,
                scrollBeyondLastLine: false,
                wordWrap: "on",
                automaticLayout: true,
                padding: { top: 10 },
              }}
            />
          </div>

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
