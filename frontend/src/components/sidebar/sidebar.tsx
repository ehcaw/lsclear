import useSWR from 'swr';
import useSWRSubscription from "swr/subscription";
import { useEffect} from 'react';
import { ProjectStructure } from "./project-structure";

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
}

// Fetcher function for useSWR
const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function Sidebar({userId, onSelectChange}: SidebarProps) {

  // Fetch project data when user is available
  const { data: projectData, error, isLoading: isLoadingProject, mutate } = useSWR<FileNode[]>(
    userId ? `/api/files/tree?userId=${userId}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      shouldRetryOnError: true,
      errorRetryCount: 3,
    }
  );

  const { data: wsData } = useSWRSubscription(
    userId ? `/db_update/ws/${userId}` : null,
    (key, { next }) => {
      if (!userId) return () => {};

      const ws = new WebSocket(`ws://localhost:8000${key}`);

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log("wsData", data);
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
      console.log("wsData", wsData);
      mutate();
    }
  }, [wsData, mutate]);

  if (error) return <div>Error loading project structure: {error.message}</div>;
  if (!projectData) return <div>Loading project structure...</div>;

  return <ProjectStructure data={projectData} onSelectChange={onSelectChange} />;
}
