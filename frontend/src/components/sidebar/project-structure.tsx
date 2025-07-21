import { useState, useEffect, useMemo } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarProvider,
} from "@/components/ui/sidebar";
import {
  FolderIcon,
  FileIcon,
  ChevronRightIcon,
  ChevronDownIcon,
} from "lucide-react"; // Assuming you use lucide icons
import useFileStore from "@/lib/files-store";

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

  const toggleFolder = (id: number) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const buildFileMap = (nodes: FileNode[]): Record<string, FileNode> => {
    const map: Record<string, FileNode> = {};
    
    const processNode = (node: FileNode, currentPath: string = '') => {
      const nodePath = currentPath ? `${currentPath}/${node.name}` : node.name;
      
      // Only add files to the map, not directories
      if (!node.is_dir) {
        map[node.id] = node;
      }
      
      // Process children if they exist
      if (node.children) {
        node.children.forEach(child => processNode(child, nodePath));
      }
    };
    
    // Process the root nodes
    nodes.forEach(node => processNode(node));
    setFileMap(map);
    return map;
  };

  // Only build file map once when component mounts or data changes
  useEffect(() => {
    buildFileMap(data);
  }, [data]);

  const renderNode = (node: FileNode) => {
    const isFolder = node.is_dir;
    const isExpanded = expandedFolders[node.id] || false;

    if (isFolder) {
      return (
        <SidebarMenuItem key={node.id}>
          <SidebarMenuButton
            onClick={() => toggleFolder(node.id)}
            icon={
              isExpanded ? (
                <ChevronDownIcon className="h-4 w-4" />
              ) : (
                <ChevronRightIcon className="h-4 w-4" />
              )
            }
          >
            <FolderIcon className="h-4 w-4 mr-2" />
            {node.name}
          </SidebarMenuButton>

          {isExpanded && node.children && (
            <SidebarMenuSub>
              {node.children.map((child) => (
                <SidebarMenuSubItem key={child.id}>
                  {renderNode(child)}
                </SidebarMenuSubItem>
              ))}
            </SidebarMenuSub>
          )}
        </SidebarMenuItem>
      );
    }

    return (
      <SidebarMenuItem key={node.id}>
        <SidebarMenuButton
          onClick={() => onSelectChange(node.id.toString())}
          icon={<FileIcon className="h-4 w-4" />}
        >
          {node.name}
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarContent>
          <SidebarGroup>
            <SidebarMenu>
              {data.map((node) => (
                <div key={node.id}>{renderNode(node)}</div>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
    </SidebarProvider>
  );
}
