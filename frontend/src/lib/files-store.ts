import { create } from "zustand";

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

interface FileStore {
  userId: string;
  fileTree: FileNode[];
  fileMap: Record<string, FileNode>;
  activeFileId: number | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  setUserId: (userId: string) => void;
  loadFileTree: () => Promise<void>;
  setFileMap: (fileMap: Record<string, FileNode>) => void;
  
  // File operations
  createFile: (name: string, parentId?: number | null) => Promise<FileNode>;
  createDirectory: (name: string, parentId?: number | null) => Promise<FileNode>;
  updateFileContent: (id: number, content: string) => Promise<void>;
  renameNode: (id: number, newName: string) => Promise<void>;
  deleteNode: (id: number) => Promise<void>;
  
  // Navigation
  setActiveFileId: (id: number | null) => void;
  
  // Helpers
  findNode: (id: number) => FileNode | undefined;
  activeFile: () => FileNode | undefined;
  
  // Initialization
  initWithDefaults: () => void;
}

const useFileStore = create<FileStore>((set, get) => ({
  userId: "",
  fileTree: [],
  fileMap: {},
  activeFileId: null,
  isLoading: false,
  error: null,

  initWithDefaults: () => {
    
    set({
      fileTree: [],
      activeFileId: 1,
      isLoading: false,
      error: null,
    });
  },

  setUserId: (userId: string) => {
    set({ userId });
  },

  loadFileTree: async () => {
    const { userId } = get();

    try {
      set({ isLoading: true, error: null });

      if (!userId) {
        get().initWithDefaults();
        return;
      }

      const response = await fetch(`/api/files/tree?userId=${userId}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const fileTree = await response.json();

      set({
        fileTree: fileTree || [],
        isLoading: false,
        activeFileId: fileTree?.length > 0 ? findFirstFile(fileTree)?.id || null : null,
      });
    } catch (error) {
      console.error("Error loading file tree:", error);
      set({ error: "Failed to load file tree", isLoading: false });
    }
  },
  
  createFile: async (name: string, parentId: number | null = null) => {
    const { userId } = get();
    if (!userId) throw new Error("User not authenticated");
    
    const response = await fetch('/api/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, name, parentId, isDir: false })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to create file: ${response.statusText}`);
    }
    
    const newFile = await response.json();
    await get().loadFileTree();
    return newFile;
  },

  setFileMap: (fileMap: Record<string, FileNode>) => {
    set({ fileMap });
  },
  
  createDirectory: async (name: string, parentId: number | null = null) => {
    const { userId } = get();
    if (!userId) throw new Error("User not authenticated");
    
    const response = await fetch('/api/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, name, parentId, isDir: true })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to create directory: ${response.statusText}`);
    }
    
    const newDir = await response.json();
    await get().loadFileTree();
    return newDir;
  },
  
  renameNode: async (id: number, newName: string) => {
    const { userId } = get();
    if (!userId) throw new Error("User not authenticated");
    
    const response = await fetch(`/api/files/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to rename: ${response.statusText}`);
    }
    
    await get().loadFileTree();
  },
  
  deleteNode: async (id: number) => {
    const { userId } = get();
    if (!userId) throw new Error("User not authenticated");
    
    const response = await fetch(`/api/files/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to delete: ${response.statusText}`);
    }
    
    const { fileTree, activeFileId } = get();
    if (activeFileId === id) {
      // If we're deleting the active file, find another file to activate
      const firstFile = findFirstFile(fileTree);
      set({ activeFileId: firstFile?.id || null });
    }
    
    await get().loadFileTree();
  },

  addFile: async (fileData: FileNode) => {
    const { userId } = get();

    try {
      set({ isLoading: true, error: null });

      // Use fetch to call a server API endpoint
      const response = await fetch("/api/files", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...fileData,
          userId,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log(data);
      const newFile = data.file;
      await get().loadFileTree();
      return newFile;
    } catch (error) {
      console.error("Error adding file:", error);
      set({ isLoading: false });
      throw error;
    }
  },

  updateFileContent: async (id, content) => {
    const { userId } = get();
    if (!userId) throw new Error("User not authenticated");
    
    const response = await fetch(`/api/files/${id}`, { 
     method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, userId })
    });

    if (!response.ok) {
      throw new Error(`Failed to update file: ${response.statusText}`);
    }
    
    // Update the local state optimistically
    const updateNodeContent = (nodes: FileNode[]): FileNode[] => {
      return nodes.map(node => {
        if (node.id === id && !node.is_dir) {
          return { ...node, content, updated_at: new Date().toISOString() };
        }
        if (node.children) {
          return { ...node, children: updateNodeContent(node.children) };
        }
        return node;
      });
    };
    
    set(state => ({
      fileTree: updateNodeContent(state.fileTree)
    }));
  },

  deleteFile: async (id: number) => {
    const { userId } = get();

    try {
      set({ isLoading: true, error: null });

      // Use fetch to call a server API endpoint
      await fetch(`/api/files/${id}?userId=${userId}`, {
        method: "DELETE",
      });
      await get().loadFileTree();
    } catch (error) {
      console.error("Error deleting file:", error);
      set({ isLoading: false });
    }
  },

  setActiveFileId: (id) => {
    set({ activeFileId: id });
  },
  
  findNode: (id: number): FileNode | undefined => {
    const { fileTree } = get();
    
    const findInTree = (nodes: FileNode[]): FileNode | undefined => {
      for (const node of nodes) {
        if (node.id === id) return node;
        if (node.children) {
          const found = findInTree(node.children);
          if (found) return found;
        }
      }
      return undefined;
    };
    
    return findInTree(fileTree);
  },

  activeFile: () => {
    const { activeFileId, findNode } = get();
    return activeFileId ? findNode(activeFileId) : undefined;
  },
}));

// Helper function to find the first file in the tree (depth-first)
function findFirstFile(nodes: FileNode[]): FileNode | undefined {
  for (const node of nodes) {
    if (!node.is_dir) return node;
    if (node.children?.length) {
      const found = findFirstFile(node.children);
      if (found) return found;
    }
  }
  return undefined;
}

export function getFullPath(fileId: number, fileMap: Record<number, FileNode>): string { 
  const segments: string[] = [];
  let current = fileMap[fileId];

  if (!current) {
    throw new Error(`File with ID ${fileId} not found`);
  }

  // Walk up until root (parentId === null)
  while (current) {
    segments.unshift(current.name);
    if (current.parent_id === null) break;
    const parent = fileMap[current.parent_id];
    if (!parent) {
      throw new Error(
        `Parent with ID ${current.parent_id} not found for file ${current.id}`
      );
    }
    current = parent;
  }

  // Prepend slash for absolute path
  return "/" + segments.join("/");
}

export default useFileStore;
