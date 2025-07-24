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
  updateFileContent: (id: number, content: string) => Promise<void>;
  
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

  loadFileTree: async (fileTree?: any) => {
    const { userId } = get();

    try {
      set({ isLoading: true, error: null });

      if (!userId) {
        get().initWithDefaults();
        return;
      }
      if(!fileTree){
      const response = await fetch(`/api/files/tree?userId=${userId}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

        fileTree = await response.json();
      }

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
  

  updateFileContent: async (id, content) => {
    const { userId } = get();
    if (!userId) return;
  
    try {
      set({ isLoading: true, error: null });
  
      const response = await fetch(`/api/files/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, userId })
      });
  
      if (!response.ok) {
        throw new Error('Failed to update file');
      }
  
      // Update the local state
      set(state => {
        const updateNode = (nodes: FileNode[]): FileNode[] => {
          return nodes.map(node => {
            if (node.id === id) {
              return { ...node, content, updated_at: new Date().toISOString() };
            }
            if (node.children) {
              return { ...node, children: updateNode(node.children) };
            }
            return node;
          });
        };
  
        return {
          fileTree: updateNode(state.fileTree),
          fileMap: {
            ...state.fileMap,
            [id]: {
              ...state.fileMap[id],
              content,
              updated_at: new Date().toISOString()
            }
          }
        };
      });
  
    } catch (error) {
      console.error('Error updating file:', error);
      set({ error: 'Failed to update file' });
    } finally {
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
