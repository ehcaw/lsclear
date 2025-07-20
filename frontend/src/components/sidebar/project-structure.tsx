import { useState } from "react";
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

interface FileNode {
  id: string;
  name: string;
  children?: FileNode[];
}

interface ProjectStructureProps {
  data: { structure: FileNode[] };
}

export function ProjectStructure({ data }: ProjectStructureProps) {
  const [expandedFolders, setExpandedFolders] = useState<
    Record<string, boolean>
  >({});

  const toggleFolder = (id: string) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

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
      <SidebarMenuSubButton key={node.id}>
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
            <SidebarMenu>{data.data[0].structure.map(renderNode)}</SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
    </SidebarProvider>
  );
}
