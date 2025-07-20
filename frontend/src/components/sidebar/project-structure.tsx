import { useState, useMemo } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
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
  is_dir?: boolean;
  content: string | null;
  created_at: string;
  updated_at: string;
  children?: FileNode[];
}

interface ProjectStructureProps {
  onSelectChange: (id: string) => void;
  data: { structure: FileNode[] };
}

export function ProjectStructure({ data, onSelectChange }: ProjectStructureProps) {

  const { fileTree, fileMap, setFileMap}  = useFileStore();
  console.log(data)
  console.log(fileTree);
  const [expandedFolders, setExpandedFolders] = useState<
    Record<string, boolean>
  >({});

  const toggleFolder = (id: string) => {
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
        map[nodePath] = node;
      }
      
      // Process children if they exist
      if (node.children) {
        node.children.forEach(child => processNode(child, nodePath));
      }
    };
    
    nodes.forEach(node => processNode(node));
    setFileMap(map);
    return map;
  };

  useMemo(() => buildFileMap(fileTree), [fileTree]);


  const renderNode = (node: FileNode) => {
    const isFolder = !!node.children;
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
      <SidebarMenuSubButton key={node.id} onClick={() => onSelectChange(node.id)}>
        <FileIcon className="h-4 w-4 mr-2" />
        {node.name}
      </SidebarMenuSubButton>
    );
  };

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarContent>
          <SidebarGroup>
            <SidebarMenu>{data.data[0].structure.map(node => renderNode(node))}</SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
    </SidebarProvider>
  );
}
