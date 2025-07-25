import { useState, useEffect, useCallback } from "react";
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarProvider,
} from "@/components/ui/sidebar";
import {
  FolderIcon,
  FileIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  FileText,
  FolderOpen,
} from "lucide-react";
import useFileStore from "@/lib/files-store";
import { cn } from "@/lib/utils";

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

interface ProjectStructureProps { 
  onSelectChange: (id: string) => void;
  data: FileNode[];
}

export function ProjectStructure({ data, onSelectChange }: ProjectStructureProps) {
  const { setFileMap } = useFileStore();
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  const toggleFolder = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedFolders(prev => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleFileClick = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFile(id);
    onSelectChange(id); // This should call setActiveFileId in the parent
  }, [onSelectChange]);

  const buildFileMap = useCallback((nodes: FileNode[]): Record<string, FileNode> => {
    type FileMap = {
      [key: string]: FileNode;
    };
    const fileMap: FileMap = {};
  
    function processNode(node: FileNode) {
      // Add the current node to the map
      fileMap[node.id.toString()] = {
        ...node,
        // Ensure children is always an array
        children: node.children ? [...node.children] : []
      };
      
      // Process children if they exist
      if (node.children) {
        node.children.forEach(child => processNode(child));
      }
    }
    
    // Process each root node
    nodes.forEach(node => processNode(node));
    setFileMap(fileMap)
    return fileMap;
  }, [setFileMap]);

useEffect(() => {
    buildFileMap(data);
  }, [data, buildFileMap]);

  const renderNode = (node: FileNode, depth = 0) => {
    const isFolder = node.is_dir;
    const isExpanded = expandedFolders[node.id] || false;
    const isSelected = selectedFile === String(node.id);

    if (isFolder) {
      return (
        <SidebarMenuItem key={node.id} className="group">
          <SidebarMenuButton
            onClick={(e) => toggleFolder(node.id, e)}
            className={cn(
              "w-full flex items-center py-1.5 px-3 rounded-md text-sm transition-colors",
              "hover:bg-gray-100 dark:hover:bg-gray-800",
              isSelected && "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
            )}
            style={{ paddingLeft: `${depth * 12 + 12}px` }}
          >
            <div className="flex items-center flex-1 min-w-0">
              {isExpanded ? (
                <ChevronDownIcon className="h-3.5 w-3.5 mr-2 text-gray-500 dark:text-gray-400 flex-shrink-0" />
              ) : (
                <ChevronRightIcon className="h-3.5 w-3.5 mr-2 text-gray-500 dark:text-gray-400 flex-shrink-0" />
              )}
              {isExpanded ? (
                <FolderOpen className="h-4 w-4 mr-2 text-blue-500 dark:text-blue-400 flex-shrink-0" />
              ) : (
                <FolderIcon className="h-4 w-4 mr-2 text-blue-500 dark:text-blue-400 flex-shrink-0" />
              )}
              <span className="truncate">{node.name}</span>
            </div>
          </SidebarMenuButton>

          {isExpanded && node.children && (
            <SidebarMenuSub className="ml-1">
              {node.children.map((child) => renderNode(child, depth + 1))}
            </SidebarMenuSub>
          )}
        </SidebarMenuItem>
      );
    }

    return (
      <SidebarMenuItem key={node.id}>
        <SidebarMenuButton
          onClick={(e) => handleFileClick(String(node.id), e)}
          className={cn(
            "w-full flex items-center py-1.5 px-3 rounded-md text-sm transition-colors",
            "hover:bg-gray-100 dark:hover:bg-gray-800",
            isSelected && "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
          )}
          style={{ paddingLeft: `${depth * 12 + 36}px` }}
        >
          <FileText className="h-3.5 w-3.5 mr-2 text-gray-500 dark:text-gray-400 flex-shrink-0" />
          <span className="truncate">{node.name}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <div className="text-sm text-gray-700 dark:text-gray-300">
      <SidebarProvider>
        <SidebarMenu>
          {data.map((node) => renderNode(node))}
        </SidebarMenu>
      </SidebarProvider>
    </div>
  );
}
