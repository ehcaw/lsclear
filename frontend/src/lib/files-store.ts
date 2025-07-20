import { create } from "zustand";

interface File {
  id: string;
  name: string;
  content: string;
  created_at?: string;
  updated_at?: string;
}

interface FileStore {
  userId: string;
  files: File[];
  activeFileId: string | null;
  isLoading: boolean;
  error: string | null;

  setUserId: (userId: string) => void;
  loadFiles: () => Promise<void>;
  addFile: (
    file: Omit<File, "id" | "created_at" | "updated_at">,
  ) => Promise<void>;
  updateFileContent: (id: string, content: string) => Promise<void>;
  deleteFile: (id: string) => Promise<void>;
  setActiveFileId: (id: string) => void;

  activeFile: () => File | undefined;

  initWithDefaults: () => void;
}

const useFileStore = create<FileStore>((set, get) => ({
  userId: "",
  files: [],
  activeFileId: null,
  isLoading: false,
  error: null,

  initWithDefaults: () => {
    const defaultFiles = [];
    set({
      files: defaultFiles,
      activeFileId: "main.py",
      isLoading: false,
      error: null,
    });
  },

  setUserId: (userId: string) => {
    set({ userId });
  },

  loadFiles: async () => {
    console.log("Loading files from API...");
    const { userId } = get();

    try {
      set({ isLoading: true, error: null });

      if (!userId) {
        console.log("No user ID found, using default files");
        get().initWithDefaults();
        return;
      }

      console.log("Loading files for user:", userId);

      // Use fetch to call a server API endpoint
      const response = await fetch(`/api/files?userId=${userId}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const files = data.files;

      if (!files || files.length === 0) {
        console.log("No files found in database, using defaults");
        get().initWithDefaults();
        return;
      }

      console.log("Files loaded:", files);

      set({
        files: files || [],
        isLoading: false,
        activeFileId: files && files.length > 0 ? files[0].id : null,
      });
    } catch (error) {
      console.error("Error loading files:", error);
      get().initWithDefaults();
    }
  },

  addFile: async (fileData) => {
    const { userId } = get();

    try {
      set({ isLoading: true, error: null });

      if (!userId) {
        const newFile = {
          id: Date.now().toString(),
          ...fileData,
          created_at: new Date().toISOString(),
        };

        set((state) => ({
          files: [newFile, ...state.files],
          activeFileId: newFile.id,
          isLoading: false,
        }));
        return;
      }

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

      set((state) => ({
        files: [newFile, ...state.files],
        activeFileId: newFile.id,
        isLoading: false,
      }));
    } catch (error) {
      console.error("Error adding file:", error);
      const fallbackFile = {
        id: Date.now().toString(),
        ...fileData,
        created_at: new Date().toISOString(),
      };

      set((state) => ({
        files: [fallbackFile, ...state.files],
        activeFileId: fallbackFile.id,
        isLoading: false,
      }));
    }
  },

  updateFileContent: async (id, content) => {
    const { userId } = get();

    set((state) => ({
      files: state.files.map((file) =>
        file.id === id ? { ...file, content } : file,
      ),
    }));

    try {
      if (!userId) {
        return;
      }

      // Use fetch to call a server API endpoint
      await fetch(`/api/files/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content,
          userId,
        }),
      });
    } catch (error) {
      console.error("Error updating file:", error);
    }
  },

  deleteFile: async (id) => {
    const { userId } = get();

    try {
      set({ isLoading: true, error: null });

      if (!userId) {
        set((state) => {
          const updatedFiles = state.files.filter((file) => file.id !== id);
          return {
            files: updatedFiles,
            activeFileId:
              state.activeFileId === id
                ? updatedFiles.length > 0
                  ? updatedFiles[0].id
                  : null
                : state.activeFileId,
            isLoading: false,
          };
        });
        return;
      }

      // Use fetch to call a server API endpoint
      await fetch(`/api/files/${id}?userId=${userId}`, {
        method: "DELETE",
      });

      set((state) => {
        const updatedFiles = state.files.filter((file) => file.id !== id);
        return {
          files: updatedFiles,
          activeFileId:
            state.activeFileId === id
              ? updatedFiles.length > 0
                ? updatedFiles[0].id
                : null
              : state.activeFileId,
          isLoading: false,
        };
      });
    } catch (error) {
      console.error("Error deleting file:", error);
      set({ isLoading: false });
    }
  },

  setActiveFileId: (id) => set({ activeFileId: id }),

  activeFile: () => {
    const { files, activeFileId } = get();
    return files.find((file) => file.id === activeFileId);
  },
}));

export default useFileStore;
