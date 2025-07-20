import useSWR from 'swr';
import { ProjectStructure } from "./project-structure";
import { getCurrentUser } from '@/utils/auth';
import { TreeDataItem } from './tree-view';

interface ProjectData {
  structure: {
    id: string;
    name: string;
    children?: {
      id: string;
      name: string;
      children?: any[];
    }[];
  }[];
}

interface SidebarProps {
  userId: string;
  onSelectChange: (id: string) => void;
}

// Fetcher function for useSWR
const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function Sidebar({userId, onSelectChange}: SidebarProps) {
  
  // Then fetch project data when user is available
  const { data: projectData, error, isLoading: isLoadingProject } = useSWR<ProjectData>(
    userId ? `/api/file_structure?user_id=${userId}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      shouldRetryOnError: true,
      errorRetryCount: 3,
    }
  );


  if (error) return <div>Error loading project structure: {error.message}</div>;
  if (!projectData) return <div>No project data available</div>;

  return <ProjectStructure data={projectData} onSelectChange={onSelectChange} />;
}

