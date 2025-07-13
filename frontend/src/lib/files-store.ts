import { create } from "zustand";
import { createClient } from "@/utils/supabase/client";

interface File {
  id: string;
  name: string;
  language: string;
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
  files: [],
  activeFileId: null,
  isLoading: false,
  error: null,

  initWithDefaults: () => {
    const defaultFiles = [
      {
        id: "main.py",
        name: "main.py",
        language: "python",
        content: `# Welcome to Python Sandbox!
print("Hello World!")

# Try changing this function
def greet(name):
    return f"Hello, {name}!"

print(greet("Developer"))
`,
      },
    ];

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
    console.log("Loading files from Supabase...");
    const supabase = createClient();

    try {
      set({ isLoading: true, error: null });

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        console.error("Auth error:", authError);
        get().initWithDefaults();
        return;
      }

      if (!user) {
        console.log("No user found, using default files");
        get().initWithDefaults();
        return;
      }

      console.log("User found:", user.email);

      const { data: files, error } = await supabase
        .from("files")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Database error:", error);
        get().initWithDefaults();
        return;
      }

      console.log("Files loaded:", files);

      if (!files || files.length === 0) {
        console.log("No files found in database, using defaults");
        get().initWithDefaults();
        return;
      }

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
    const supabase = createClient();

    try {
      set({ isLoading: true, error: null });

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
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

      const { data: newFile, error } = await supabase
        .from("files")
        .insert([fileData])
        .select()
        .single();

      if (error) {
        console.error("Error adding file to database:", error);
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
        return;
      }

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
    const supabase = createClient();

    set((state) => ({
      files: state.files.map((file) =>
        file.id === id ? { ...file, content } : file,
      ),
    }));

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        return;
      }

      const { error } = await supabase
        .schema("afterquery ")
        .from("files")
        .update({ content, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) {
        console.error("Error updating file in database:", error);
      }
    } catch (error) {
      console.error("Error updating file:", error);
    }
  },

  deleteFile: async (id) => {
    const supabase = createClient();

    try {
      set({ isLoading: true, error: null });

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
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

      const { error } = await supabase.from("files").delete().eq("id", id);

      if (error) {
        console.error("Error deleting file from database:", error);
      }

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
