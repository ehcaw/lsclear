import useSWR from 'swr';
import useSWRSubscription from "swr/subscription";
import { useEffect } from 'react';
import { ProjectStructure } from "./project-structure";
import { FolderTree, Code } from 'lucide-react';
import { cn } from "@/lib/utils";
import useFileStore  from "@/lib/files-store";

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

interface SidebarProps {
  userId: string;
  onSelectChange: (id: string) => void;
  className?: string;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function Sidebar({ userId, onSelectChange, className }: SidebarProps) {
  const { loadFileTree } = useFileStore();
  const { data: projectData, error, isLoading: isLoadingProject, mutate } = useSWR<FileNode[]>(
    userId ? `/api/files/tree?userId=${userId}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      shouldRetryOnError: true,
      errorRetryCount: 3,
      revalidateOnMount: true,
      refreshInterval: 0,
    }
  );

  const { data: wsData } = useSWRSubscription(
    userId ? `/db_update/ws/${userId}` : null,
    (key, { next }) => {
      if (!userId) return () => {};

      const ws = new WebSocket(`ws://localhost:8000${key}`);

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        next(null, data);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        next(error);
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
      };

      return () => {
        ws.close();
      };
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      shouldRetryOnError: true,
      errorRetryCount: 3,
    }
  );

  useEffect(() => {
    if (wsData) {
      mutate();
      loadFileTree();
    }
  }, [wsData, mutate]);

  if (error) return (
    <div className="p-4 text-sm text-red-500 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-md m-2">
      Error loading project structure
    </div>
  );

  if (!projectData) return (
    <div className="p-4 text-sm text-gray-500 dark:text-gray-400">
      Loading project structure...
    </div>
  );

  return (
    <div className={cn(
      "flex flex-col h-full w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800",
      className
    )}>
      {/* Header with Logo */}
      <div className="flex items-center h-16 px-4 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center space-x-2">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-br from-blue-600 to-blue-500 text-white">
            <Code className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">LSClear</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">Code Explorer</p>
          </div>
        </div>
      </div>
      
      {/* Project Structure */}
      <div className="flex-1 overflow-y-auto py-3 px-2">
        <div className="mb-2 px-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          Project Files
        </div>
        <ProjectStructure data={projectData} onSelectChange={onSelectChange} />
      </div>
    </div>
  );
}
