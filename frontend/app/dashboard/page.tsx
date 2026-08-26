"use client";

import {
  ChangeEvent,
  CSSProperties,
  DragEvent as ReactDragEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";

// Backend API base URL. Set NEXT_PUBLIC_API_URL in Vercel/production.
// The localhost fallback keeps local development working.
const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

type FileItem = {
  id: string;
  name: string;
  originalName: string;
  contentType: string;
  size: number;
  starred: boolean;
  trashed: boolean;
  storagePath: string;
  folderId: string | null;
  createdAt: string;
  updatedAt: string;
};

type FolderItem = {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
};

type UserInfo = {
  userId: string;
  email: string;
  fullName: string;
};

type StorageInfo = {
  storageUsed: number;
  storageQuota: number;
  storageRemaining: number;
  usagePercentage: number;
  fileCount: number;
};

type ViewMode = "all" | "starred" | "trash";
type LayoutMode = "list" | "grid";
type SortOption =
  | "name"
  | "newest"
  | "oldest"
  | "largest"
  | "smallest";

function formatStorageSize(bytes: number): string {
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  );

  return `${(bytes / Math.pow(1024, index)).toFixed(2)} ${units[index]}`;
}

function getFileVisual(file: FileItem) {
  const type = (file.contentType || "").toLowerCase();
  const name = (file.originalName || file.name || "").toLowerCase();

  if (type.startsWith("image/")) return { kind: "image", label: "IMG", symbol: "◈" };
  if (type.startsWith("video/")) return { kind: "video", label: "VIDEO", symbol: "▶" };
  if (type.startsWith("audio/")) return { kind: "audio", label: "AUDIO", symbol: "♪" };
  if (type === "application/pdf" || name.endsWith(".pdf")) return { kind: "pdf", label: "PDF", symbol: "PDF" };

  if (
    type.includes("spreadsheet") ||
    type.includes("excel") ||
    /\.(xlsx?|csv|ods)$/i.test(name)
  ) return { kind: "spreadsheet", label: "SHEET", symbol: "XLS" };

  if (
    type.includes("presentation") ||
    type.includes("powerpoint") ||
    /\.(pptx?|odp)$/i.test(name)
  ) return { kind: "presentation", label: "SLIDE", symbol: "PPT" };

  if (
    type.includes("word") ||
    type.includes("document") ||
    type.includes("opendocument.text") ||
    /\.(docx?|odt|rtf)$/i.test(name)
  ) return { kind: "document", label: "DOC", symbol: "DOC" };

  if (
    type.includes("zip") ||
    type.includes("compressed") ||
    type.includes("archive") ||
    /\.(zip|rar|7z|tar|gz)$/i.test(name)
  ) return { kind: "archive", label: "ARCHIVE", symbol: "ZIP" };

  if (
    type.includes("javascript") ||
    type.includes("typescript") ||
    type.includes("json") ||
    type.includes("html") ||
    type.includes("css") ||
    type.includes("xml") ||
    /\.(js|jsx|ts|tsx|json|html?|css|scss|xml|py|java|cpp|c|cs|php|sql|sh)$/i.test(name)
  ) return { kind: "code", label: "CODE", symbol: "</>" };

  if (type.startsWith("text/")) return { kind: "text", label: "TEXT", symbol: "TXT" };

  return { kind: "file", label: "FILE", symbol: "FILE" };
}

function FileTypeIcon({ file }: { file: FileItem }) {
  const visual = getFileVisual(file);

  return (
    <div className={`file-type-glyph file-type-${visual.kind}`} aria-hidden="true">
      <span className="file-type-glyph-symbol">{visual.symbol}</span>
      <span className="file-type-glyph-label">{visual.label}</span>

      {visual.kind === "video" && (
        <span className="file-type-play-badge">▶</span>
      )}

      {visual.kind === "audio" && (
        <span className="file-type-wave">•••</span>
      )}
    </div>
  );
}

type UploadQueueItem = {
  id: string;
  file: File;
  progress: number;
  status: "queued" | "uploading" | "success" | "error";
  error?: string;
};

export default function DashboardPage() {
  const router = useRouter();

  const [files, setFiles] = useState<FileItem[]>([]);
  const [folders, setFolders] = useState<FolderItem[]>([]);

  const [user, setUser] =
    useState<UserInfo | null>(null);

  const [storageInfo, setStorageInfo] =
    useState<StorageInfo | null>(null);

  const [storageLoading, setStorageLoading] =
    useState(true);

  const [viewMode, setViewMode] =
    useState<ViewMode>("all");

  const [currentFolder, setCurrentFolder] =
    useState<FolderItem | null>(null);

  const [folderPath, setFolderPath] =
    useState<FolderItem[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [uploading, setUploading] =
    useState(false);

  const [uploadQueue, setUploadQueue] =
    useState<UploadQueueItem[]>([]);

  const [dragActive, setDragActive] =
    useState(false);

  const [profileOpen, setProfileOpen] =
    useState(false);

  const [creatingFolder, setCreatingFolder] =
    useState(false);

  const [renamingFolder, setRenamingFolder] =
    useState(false);

  const [deletingFolder, setDeletingFolder] =
    useState(false);

  // Three-dot folder actions menu
  const [folderMenuOpen, setFolderMenuOpen] =
    useState(false);

  // Three-dot file actions menu
  const [fileMenuOpenId, setFileMenuOpenId] =
    useState<string | null>(null);

  // Cached object URLs for image thumbnails in Grid View
  const [imageThumbnailUrls, setImageThumbnailUrls] =
    useState<Record<string, string>>({});

  const [downloadingId, setDownloadingId] =
    useState<string | null>(null);

  const [deletingId, setDeletingId] =
    useState<string | null>(null);

  const [starringId, setStarringId] =
    useState<string | null>(null);

  const [restoringId, setRestoringId] =
    useState<string | null>(null);

  const [
    permanentlyDeletingId,
    setPermanentlyDeletingId,
  ] = useState<string | null>(null);

  // =========================================================
  // FILE PREVIEW
  // =========================================================

  const [previewFile, setPreviewFile] =
    useState<FileItem | null>(null);

  const [previewUrl, setPreviewUrl] =
    useState<string | null>(null);

  const [previewText, setPreviewText] =
    useState<string | null>(null);

  const [previewLoading, setPreviewLoading] =
    useState(false);

  const [previewError, setPreviewError] =
    useState("");

  // =========================================================
  // FILE RENAME
  // =========================================================

  const [renamingFileId, setRenamingFileId] =
    useState<string | null>(null);

  const [renameFileName, setRenameFileName] =
    useState("");

  // =========================================================
  // SEARCH
  // =========================================================

  const [searchQuery, setSearchQuery] =
    useState("");

  const [searchLoading, setSearchLoading] =
    useState(false);

  const [searchFolders, setSearchFolders] =
    useState<FolderItem[]>([]);

  const [searchFiles, setSearchFiles] =
    useState<FileItem[]>([]);

  // =========================================================
  // SORT & VIEW
  // =========================================================

  const [sortOption, setSortOption] =
    useState<SortOption>("name");

  const [sortAscending, setSortAscending] =
    useState(true);

  const [layoutMode, setLayoutMode] =
    useState<LayoutMode>("list");


  const [error, setError] =
    useState("");

  const [message, setMessage] =
    useState("");


  // =========================================================
  // AUTHENTICATION
  // =========================================================

  const getToken = () => {
    const token =
      localStorage.getItem(
        "storeroom_token"
      );

    if (!token) {
      router.push("/");
      return null;
    }

    return token;
  };


  const handleUnauthorized = () => {
    localStorage.removeItem(
      "storeroom_token"
    );

    localStorage.removeItem(
      "storeroom_user"
    );

    router.push("/");
  };


  // =========================================================
  // LOAD ROOT FOLDERS
  // =========================================================

  const loadRootFolders = async () => {
    const token = getToken();

    if (!token) {
      return;
    }

    const response =
      await fetch(
        `${API_BASE}/api/folders`,
        {
          headers: {
            Authorization:
              `Bearer ${token}`,
          },
        }
      );

    if (
      response.status === 401 ||
      response.status === 403
    ) {
      handleUnauthorized();
      return;
    }

    if (!response.ok) {
      throw new Error(
        "Unable to load folders."
      );
    }

    const data: FolderItem[] =
      await response.json();

    setFolders(data);
  };


  // =========================================================
  // LOAD FOLDER CHILDREN
  // =========================================================

  const loadFolderChildren = async (
    folderId: string
  ) => {
    const token = getToken();

    if (!token) {
      return;
    }

    const response =
      await fetch(
        `${API_BASE}/api/folders/${folderId}/children`,
        {
          headers: {
            Authorization:
              `Bearer ${token}`,
          },
        }
      );

    if (
      response.status === 401 ||
      response.status === 403
    ) {
      handleUnauthorized();
      return;
    }

    if (!response.ok) {
      throw new Error(
        "Unable to load subfolders."
      );
    }

    const data: FolderItem[] =
      await response.json();

    setFolders(data);
  };


  // =========================================================
  // LOAD STORAGE USAGE
  // =========================================================

  const loadStorageUsage = async () => {
    const token = getToken();

    if (!token) {
      return;
    }

    try {
      setStorageLoading(true);

      const response =
        await fetch(
          `${API_BASE}/api/files/storage`,
          {
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        );

      if (
        response.status === 401 ||
        response.status === 403
      ) {
        handleUnauthorized();
        return;
      }

      if (!response.ok) {
        throw new Error(
          `Storage request failed with status ${response.status}`
        );
      }

      const data: StorageInfo =
        await response.json();

      setStorageInfo(data);

    } catch (err) {
      console.error(err);
    } finally {
      setStorageLoading(false);
    }
  };


  // =========================================================
  // LOAD FILES
  // =========================================================

  const loadFiles = async () => {
    const token = getToken();

    if (!token) {
      return;
    }

    loadStorageUsage();

    let endpoint =
      `${API_BASE}/api/files`;

    if (viewMode === "starred") {
      endpoint =
        `${API_BASE}/api/files/starred`;
    }

    if (viewMode === "trash") {
      endpoint =
        `${API_BASE}/api/files/trash`;
    }

    if (
      viewMode === "all" &&
      currentFolder
    ) {
      endpoint =
        `${API_BASE}/api/files?folderId=${currentFolder.id}`;
    }

    const response =
      await fetch(
        endpoint,
        {
          headers: {
            Authorization:
              `Bearer ${token}`,
          },
        }
      );

    if (
      response.status === 401 ||
      response.status === 403
    ) {
      handleUnauthorized();
      return;
    }

    if (!response.ok) {
      throw new Error(
        `Server returned ${response.status}`
      );
    }

    const data: FileItem[] =
      await response.json();

    setFiles(data);
  };


  // =========================================================
  // GLOBAL SEARCH
  // =========================================================

  const performGlobalSearch = async (
    query: string
  ) => {
    const token = getToken();

    if (!token) {
      return;
    }

    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      setSearchFiles([]);
      setSearchFolders([]);
      setSearchLoading(false);
      return;
    }

    try {
      setSearchLoading(true);
      setError("");

      const response = await fetch(
        `${API_BASE}/api/files/search?q=${encodeURIComponent(
          trimmedQuery
        )}`,
        {
          headers: {
            Authorization:
              `Bearer ${token}`,
          },
        }
      );

      if (
        response.status === 401 ||
        response.status === 403
      ) {
        handleUnauthorized();
        return;
      }

      if (!response.ok) {
        throw new Error(
          `Search failed with status ${response.status}`
        );
      }

      const data = await response.json();

      setSearchFiles(
        data.files || []
      );

      setSearchFolders(
        data.folders || []
      );

    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to search files."
      );

      setSearchFiles([]);
      setSearchFolders([]);

    } finally {
      setSearchLoading(false);
    }
  };


  // =========================================================
  // LOAD DASHBOARD
  // =========================================================

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError("");

      const storedUser =
        localStorage.getItem(
          "storeroom_user"
        );

      if (storedUser) {
        setUser(
          JSON.parse(storedUser)
        );
      }

      if (viewMode === "starred") {
        setFolders([]);
        await loadFiles();
        return;
      }

      if (viewMode === "trash") {
        setFolders([]);
        await loadFiles();
        return;
      }

      if (currentFolder) {
        await loadFolderChildren(
          currentFolder.id
        );
      } else {
        await loadRootFolders();
      }

      await loadFiles();

    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load your files."
      );
    } finally {
      setLoading(false);
    }
  };


  // =========================================================
  // INITIAL LOAD
  // =========================================================

  useEffect(() => {
    setFolderMenuOpen(false);
    setFileMenuOpenId(null);
    loadDashboard();
  }, [
    viewMode,
    currentFolder,
  ]);


  // =========================================================
  // GLOBAL SEARCH EFFECT
  // =========================================================

  useEffect(() => {
    const trimmedQuery =
      searchQuery.trim();

    if (!trimmedQuery) {
      setSearchFiles([]);
      setSearchFolders([]);
      setSearchLoading(false);
      return;
    }

    const timeout = setTimeout(() => {
      performGlobalSearch(
        trimmedQuery
      );
    }, 300);

    return () => {
      clearTimeout(timeout);
    };
  }, [searchQuery]);


  // =========================================================
  // CHANGE VIEW
  // =========================================================

  const changeView = (
    mode: ViewMode
  ) => {
    setMessage("");
    setError("");
    setSearchQuery("");

    setViewMode(mode);

    if (mode !== "all") {
      setCurrentFolder(null);
      setFolderPath([]);
    }
  };


  // =========================================================
  // OPEN FOLDER
  // =========================================================

  const openFolder = (
    folder: FolderItem
  ) => {
    setMessage("");
    setError("");
    setSearchQuery("");

    setViewMode("all");

    setFolderPath(
      (currentPath) => [
        ...currentPath,
        folder,
      ]
    );

    setCurrentFolder(folder);
  };


  // =========================================================
  // GO BACK
  // =========================================================

  const goBack = () => {
    setMessage("");
    setError("");
    setSearchQuery("");

    if (folderPath.length <= 1) {
      setFolderPath([]);
      setCurrentFolder(null);
      return;
    }

    const newPath =
      folderPath.slice(
        0,
        -1
      );

    const parentFolder =
      newPath[
        newPath.length - 1
      ];

    setFolderPath(
      newPath
    );

    setCurrentFolder(
      parentFolder
    );
  };


  // =========================================================
  // GO TO ROOT
  // =========================================================

  const goToRoot = () => {
    setMessage("");
    setError("");
    setSearchQuery("");

    setFolderPath([]);
    setCurrentFolder(null);
    setViewMode("all");
  };


  // =========================================================
  // CREATE FOLDER
  // =========================================================

  const handleCreateFolder =
    async () => {
      const name =
        window.prompt(
          "Enter folder name:"
        );

      if (!name) {
        return;
      }

      const trimmedName =
        name.trim();

      if (!trimmedName) {
        return;
      }

      try {
        setCreatingFolder(true);
        setError("");
        setMessage("");

        const token =
          getToken();

        if (!token) {
          return;
        }

        const body: {
          name: string;
          parentId?: string;
        } = {
          name: trimmedName,
        };

        if (currentFolder) {
          body.parentId =
            currentFolder.id;
        }

        const response =
          await fetch(
            `${API_BASE}/api/folders`,
            {
              method: "POST",
              headers: {
                Authorization:
                  `Bearer ${token}`,
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify(
                body
              ),
            }
          );

        if (
          response.status === 401 ||
          response.status === 403
        ) {
          handleUnauthorized();
          return;
        }

        let data: {
          message?: string;
        } = {};

        try {
          data =
            await response.json();
        } catch {
          // no JSON response
        }

        if (!response.ok) {
          throw new Error(
            data.message ||
              "Unable to create folder."
          );
        }

        setMessage(
          `Folder "${trimmedName}" created successfully.`
        );

        await loadDashboard();

      } catch (err) {
        console.error(err);

        setError(
          err instanceof Error
            ? err.message
            : "Unable to create folder."
        );
      } finally {
        setCreatingFolder(false);
      }
    };


  // =========================================================
  // RENAME FOLDER
  // =========================================================

  const handleRenameFolder =
    async () => {
      if (!currentFolder) {
        return;
      }

      const name =
        window.prompt(
          "Enter new folder name:",
          currentFolder.name
        );

      if (!name) {
        return;
      }

      const trimmedName =
        name.trim();

      if (!trimmedName) {
        return;
      }

      try {
        setRenamingFolder(true);
        setError("");
        setMessage("");

        const token =
          getToken();

        if (!token) {
          return;
        }

        const response =
          await fetch(
            `${API_BASE}/api/folders/${currentFolder.id}`,
            {
              method: "PUT",
              headers: {
                Authorization:
                  `Bearer ${token}`,
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify({
                name: trimmedName,
              }),
            }
          );

        if (
          response.status === 401 ||
          response.status === 403
        ) {
          handleUnauthorized();
          return;
        }

        let data: any = null;

        try {
          data =
            await response.json();
        } catch {
          // no JSON response
        }

        if (!response.ok) {
          throw new Error(
            data?.message ||
              "Unable to rename folder."
          );
        }

        if (
          data &&
          data.id
        ) {
          setCurrentFolder(
            data
          );

          setFolderPath(
            (path) =>
              path.map(
                (folder) =>
                  folder.id ===
                  data.id
                    ? data
                    : folder
              )
          );
        } else {
          setCurrentFolder(
            (folder) =>
              folder
                ? {
                    ...folder,
                    name:
                      trimmedName,
                  }
                : folder
          );

          setFolderPath(
            (path) =>
              path.map(
                (folder) =>
                  folder.id ===
                  currentFolder.id
                    ? {
                        ...folder,
                        name:
                          trimmedName,
                      }
                    : folder
              )
          );
        }

        setMessage(
          `Folder renamed to "${trimmedName}".`
        );

        await loadDashboard();

      } catch (err) {
        console.error(err);

        setError(
          err instanceof Error
            ? err.message
            : "Unable to rename folder."
        );
      } finally {
        setRenamingFolder(false);
      }
    };


  // =========================================================
  // DELETE FOLDER
  // =========================================================

  const handleDeleteFolder =
    async () => {
      if (!currentFolder) {
        return;
      }

      const confirmed =
        window.confirm(
          `Delete folder "${currentFolder.name}"?`
        );

      if (!confirmed) {
        return;
      }

      try {
        setDeletingFolder(true);
        setError("");
        setMessage("");

        const token =
          getToken();

        if (!token) {
          return;
        }

        const response =
          await fetch(
            `${API_BASE}/api/folders/${currentFolder.id}`,
            {
              method: "DELETE",
              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          );

        if (
          response.status === 401 ||
          response.status === 403
        ) {
          handleUnauthorized();
          return;
        }

        let data: {
          message?: string;
        } = {};

        try {
          data =
            await response.json();
        } catch {
          // no JSON response
        }

        if (!response.ok) {
          throw new Error(
            data.message ||
              "Unable to delete folder."
          );
        }

        setMessage(
          `Folder "${currentFolder.name}" deleted successfully.`
        );

        goBack();

      } catch (err) {
        console.error(err);

        setError(
          err instanceof Error
            ? err.message
            : "Unable to delete folder."
        );
      } finally {
        setDeletingFolder(false);
      }
    };


  // =========================================================
  // UPLOAD FILE
  // =========================================================

  const uploadFiles = async (selectedFiles: File[]) => {
    if (!selectedFiles.length) return;

    const token = getToken();
    if (!token) return;

    const validFiles = selectedFiles.filter((file) => file.size > 0);

    if (!validFiles.length) {
      setError("Please choose a non-empty file.");
      return;
    }

    const queueItems: UploadQueueItem[] = validFiles.map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
      file,
      progress: 0,
      status: "queued",
    }));

    setUploadQueue(queueItems);
    setUploading(true);
    setError("");
    setMessage("");

    let completed = 0;
    let failed = 0;

    for (const item of queueItems) {
      setUploadQueue((current) =>
        current.map((entry) =>
          entry.id === item.id
            ? { ...entry, status: "uploading", progress: 0 }
            : entry
        )
      );

      try {
        const formData = new FormData();
        formData.append("file", item.file);

        let endpoint = `${API_BASE}/api/files/upload`;

        if (viewMode === "all" && currentFolder) {
          endpoint += `?folderId=${currentFolder.id}`;
        }

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();

          xhr.open("POST", endpoint);
          xhr.setRequestHeader("Authorization", `Bearer ${token}`);

          xhr.upload.onprogress = (event) => {
            if (!event.lengthComputable) return;

            const progress = Math.round(
              (event.loaded / event.total) * 100
            );

            setUploadQueue((current) =>
              current.map((entry) =>
                entry.id === item.id
                  ? { ...entry, progress }
                  : entry
              )
            );
          };

          xhr.onload = () => {
            let data: { message?: string } = {};

            try {
              data = JSON.parse(xhr.responseText || "{}");
            } catch {
              // Empty/non-JSON backend response is allowed.
            }

            if (xhr.status === 401 || xhr.status === 403) {
              handleUnauthorized();
              reject(new Error("Your session has expired."));
              return;
            }

            if (xhr.status < 200 || xhr.status >= 300) {
              reject(
                new Error(data.message || "File upload failed.")
              );
              return;
            }

            resolve();
          };

          xhr.onerror = () =>
            reject(new Error("Unable to connect to STOREROOM."));

          xhr.onabort = () =>
            reject(new Error("Upload was cancelled."));

          xhr.send(formData);
        });

        completed += 1;

        setUploadQueue((current) =>
          current.map((entry) =>
            entry.id === item.id
              ? { ...entry, progress: 100, status: "success" }
              : entry
          )
        );
      } catch (err) {
        failed += 1;

        const reason =
          err instanceof Error ? err.message : "File upload failed.";

        setUploadQueue((current) =>
          current.map((entry) =>
            entry.id === item.id
              ? { ...entry, status: "error", error: reason }
              : entry
          )
        );
      }
    }

    await loadDashboard();

    if (failed === 0) {
      setMessage(
        completed === 1
          ? `${validFiles[0].name} uploaded successfully.`
          : `${completed} files uploaded successfully.`
      );
    } else {
      setError(`${completed} uploaded successfully, ${failed} failed.`);
    }

    setUploading(false);

    window.setTimeout(() => setUploadQueue([]), 3200);
  };

  const handleUpload = async (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    await uploadFiles(Array.from(event.target.files || []));
    event.target.value = "";
  };

  const handleDropUpload = async (
    event: ReactDragEvent<HTMLDivElement>
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);

    if (uploading || viewMode === "trash") return;

    await uploadFiles(Array.from(event.dataTransfer.files || []));
  };

  // =========================================================
  // FILE RENAME
  // =========================================================

  const getFileExtension = (name: string) => {
    const dot = name.lastIndexOf(".");
    return dot > 0 ? name.slice(dot) : "";
  };

  const startFileRename = (file: FileItem) => {
    setError("");
    setMessage("");
    setRenamingFileId(file.id);
    setRenameFileName(file.originalName || file.name);
  };

  const cancelFileRename = () => {
    setRenamingFileId(null);
    setRenameFileName("");
  };

  const handleRenameFile = async (file: FileItem) => {
    const entered = renameFileName.trim();
    const extension = getFileExtension(file.originalName || file.name);

    if (!entered) {
      setError("File name cannot be empty.");
      return;
    }

    const baseName = extension && entered.toLowerCase().endsWith(extension.toLowerCase())
      ? entered.slice(0, -extension.length).trim()
      : entered;

    if (!baseName) {
      setError("Enter a valid file name.");
      return;
    }

    const finalName = `${baseName}${extension}`;

    try {
      setError("");
      setMessage("");

      const token = getToken();
      if (!token) return;

      const response = await fetch(
        `${API_BASE}/api/files/${file.id}/rename`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name: finalName }),
        }
      );

      if (response.status === 401 || response.status === 403) {
        handleUnauthorized();
        return;
      }

      let data: { message?: string } = {};
      try {
        data = await response.json();
      } catch {
        // no JSON response
      }

      if (!response.ok) {
        throw new Error(data.message || "Unable to rename file.");
      }

      setFiles((currentFiles) =>
        currentFiles.map((item) =>
          item.id === file.id
            ? {
                ...item,
                name: finalName,
                originalName: finalName,
                updatedAt: new Date().toISOString(),
              }
            : item
        )
      );

      setSearchFiles((currentFiles) =>
        currentFiles.map((item) =>
          item.id === file.id
            ? {
                ...item,
                name: finalName,
                originalName: finalName,
                updatedAt: new Date().toISOString(),
              }
            : item
        )
      );

      setMessage(`File renamed to "${finalName}".`);
      cancelFileRename();
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to rename file."
      );
    }
  };

  // =========================================================
  // FILE PREVIEW
  // =========================================================

  const closePreview = () => {
    if (previewUrl) {
      window.URL.revokeObjectURL(previewUrl);
    }

    setPreviewFile(null);
    setPreviewUrl(null);
    setPreviewText(null);
    setPreviewError("");
    setPreviewLoading(false);
  };

  // Close preview with Escape and prevent the dashboard from
  // scrolling behind the preview modal.
  useEffect(() => {
    if (!previewFile) {
      return;
    }

    const previousOverflow = document.body.style.overflow;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closePreview();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [previewFile]);

  const handlePreview = async (
    file: FileItem
  ) => {
    try {
      if (previewUrl) {
        window.URL.revokeObjectURL(previewUrl);
      }

      setPreviewFile(file);
      setPreviewUrl(null);
      setPreviewText(null);
      setPreviewError("");
      setPreviewLoading(true);

      const token = getToken();

      if (!token) {
        return;
      }

      const response = await fetch(
        `${API_BASE}/api/files/${file.id}/download`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (
        response.status === 401 ||
        response.status === 403
      ) {
        handleUnauthorized();
        return;
      }

      if (!response.ok) {
        let errorData: {
          message?: string;
        } = {};

        try {
          errorData = await response.json();
        } catch {
          // no JSON
        }

        throw new Error(
          errorData.message ||
            "Unable to preview this file."
        );
      }

      const blob = await response.blob();

      const contentType =
        file.contentType ||
        blob.type ||
        "application/octet-stream";

      const isText =
        contentType.startsWith("text/") ||
        contentType === "application/json" ||
        contentType === "application/xml" ||
        contentType === "application/javascript" ||
        contentType === "application/x-javascript" ||
        contentType === "application/csv";

      if (isText) {
        const textContent =
          await blob.text();

        setPreviewText(textContent);
        return;
      }

      const supportedBinaryPreview =
        contentType === "application/pdf" ||
        contentType.startsWith("image/") ||
        contentType.startsWith("video/") ||
        contentType.startsWith("audio/");

      if (supportedBinaryPreview) {
        const objectUrl =
          window.URL.createObjectURL(blob);

        setPreviewUrl(objectUrl);
        return;
      }

      setPreviewError(
        "Preview is not available for this file type. You can download the file instead."
      );

    } catch (err) {
      console.error(err);

      setPreviewError(
        err instanceof Error
          ? err.message
          : "Unable to preview this file."
      );
    } finally {
      setPreviewLoading(false);
    }
  };

  // =========================================================
  // DOWNLOAD FILE
  // =========================================================

  const handleDownload = async (
    file: FileItem
  ) => {
    try {
      setDownloadingId(file.id);
      setError("");
      setMessage("");

      const token =
        getToken();

      if (!token) {
        return;
      }

      const response =
        await fetch(
          `${API_BASE}/api/files/${file.id}/download`,
          {
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        );

      if (
        response.status === 401 ||
        response.status === 403
      ) {
        handleUnauthorized();
        return;
      }

      if (!response.ok) {
        let errorData: {
          message?: string;
        } = {};

        try {
          errorData =
            await response.json();
        } catch {
          // no JSON
        }

        throw new Error(
          errorData.message ||
            "File download failed."
        );
      }

      const blob =
        await response.blob();

      const downloadUrl =
        window.URL.createObjectURL(
          blob
        );

      const link =
        document.createElement(
          "a"
        );

      link.href =
        downloadUrl;

      link.download =
        file.originalName ||
        file.name ||
        "download";

      document.body.appendChild(
        link
      );

      link.click();
      link.remove();

      window.URL.revokeObjectURL(
        downloadUrl
      );

      setMessage(
        `${file.originalName} downloaded successfully.`
      );

    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "File download failed."
      );
    } finally {
      setDownloadingId(null);
    }
  };


  // =========================================================
  // STAR / UNSTAR
  // =========================================================

  const handleToggleStar = async (
    file: FileItem
  ) => {
    try {
      setStarringId(file.id);
      setError("");
      setMessage("");

      const token =
        getToken();

      if (!token) {
        return;
      }

      const response =
        await fetch(
          `${API_BASE}/api/files/${file.id}/star`,
          {
            method: "PUT",
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        );

      if (
        response.status === 401 ||
        response.status === 403
      ) {
        handleUnauthorized();
        return;
      }

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Unable to update star status."
        );
      }

      const newStarred =
        Boolean(data.starred);

      if (
        viewMode === "starred" &&
        !newStarred
      ) {
        setFiles(
          (currentFiles) =>
            currentFiles.filter(
              (item) =>
                item.id !== file.id
            )
        );
      } else {
        setFiles(
          (currentFiles) =>
            currentFiles.map(
              (item) =>
                item.id === file.id
                  ? {
                      ...item,
                      starred:
                        newStarred,
                    }
                  : item
            )
        );
      }

      setMessage(
        newStarred
          ? `${file.originalName} added to Starred.`
          : `${file.originalName} removed from Starred.`
      );

    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to update star status."
      );
    } finally {
      setStarringId(null);
    }
  };


  // =========================================================
  // MOVE FILE TO TRASH
  // =========================================================

  const handleDelete = async (
    file: FileItem
  ) => {
    const confirmed =
      window.confirm(
        `Move "${file.originalName}" to Trash?`
      );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(file.id);
      setError("");
      setMessage("");

      const token =
        getToken();

      if (!token) {
        return;
      }

      const response =
        await fetch(
          `${API_BASE}/api/files/${file.id}`,
          {
            method: "DELETE",
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        );

      if (
        response.status === 401 ||
        response.status === 403
      ) {
        handleUnauthorized();
        return;
      }

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Unable to move file to Trash."
        );
      }

      setFiles(
        (currentFiles) =>
          currentFiles.filter(
            (item) =>
              item.id !== file.id
          )
      );

      await loadStorageUsage();

      setMessage(
        `${file.originalName} moved to Trash.`
      );

    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to move file to Trash."
      );
    } finally {
      setDeletingId(null);
    }
  };


  // =========================================================
  // RESTORE
  // =========================================================

  const handleRestore = async (
    file: FileItem
  ) => {
    try {
      setRestoringId(file.id);
      setError("");
      setMessage("");

      const token =
        getToken();

      if (!token) {
        return;
      }

      const response =
        await fetch(
          `${API_BASE}/api/files/${file.id}/restore`,
          {
            method: "PUT",
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        );

      if (
        response.status === 401 ||
        response.status === 403
      ) {
        handleUnauthorized();
        return;
      }

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Unable to restore file."
        );
      }

      setFiles(
        (currentFiles) =>
          currentFiles.filter(
            (item) =>
              item.id !== file.id
          )
      );

      await loadStorageUsage();

      setMessage(
        `${file.originalName} restored successfully.`
      );

    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to restore file."
      );
    } finally {
      setRestoringId(null);
    }
  };


  // =========================================================
  // PERMANENT DELETE
  // =========================================================

  const handlePermanentDelete =
    async (
      file: FileItem
    ) => {
      const confirmed =
        window.confirm(
          `Permanently delete "${file.originalName}"?\n\nThis cannot be undone.`
        );

      if (!confirmed) {
        return;
      }

      try {
        setPermanentlyDeletingId(
          file.id
        );

        setError("");
        setMessage("");

        const token =
          getToken();

        if (!token) {
          return;
        }

        const response =
          await fetch(
            `${API_BASE}/api/files/${file.id}/permanent`,
            {
              method: "DELETE",
              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          );

        if (
          response.status === 401 ||
          response.status === 403
        ) {
          handleUnauthorized();
          return;
        }

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.message ||
              "Permanent deletion failed."
          );
        }

        setFiles(
          (currentFiles) =>
            currentFiles.filter(
              (item) =>
                item.id !== file.id
            )
        );

        await loadStorageUsage();

        setMessage(
          `${file.originalName} permanently deleted.`
        );

      } catch (err) {
        console.error(err);

        setError(
          err instanceof Error
            ? err.message
            : "Permanent deletion failed."
        );
      } finally {
        setPermanentlyDeletingId(
          null
        );
      }
    };


  // =========================================================
  // LOGOUT
  // =========================================================

  const logout = () => {
    localStorage.removeItem(
      "storeroom_token"
    );

    localStorage.removeItem(
      "storeroom_user"
    );

    router.push("/");
  };


  // =========================================================
  // FORMAT SIZE
  // =========================================================

  const formatSize = (
    bytes: number
  ) => {
    if (bytes < 1024) {
      return `${bytes} B`;
    }

    if (
      bytes <
      1024 * 1024
    ) {
      return `${(
        bytes / 1024
      ).toFixed(1)} KB`;
    }

    if (
      bytes <
      1024 * 1024 * 1024
    ) {
      return `${(
        bytes /
        (1024 * 1024)
      ).toFixed(1)} MB`;
    }

    return `${(
      bytes /
      (1024 * 1024 * 1024)
    ).toFixed(1)} GB`;
  };


  // =========================================================
  // SEARCH & SORTED RESULTS
  // =========================================================

  const normalizedSearch =
    searchQuery
      .trim()
      .toLowerCase();

  const baseFolders =
    normalizedSearch
      ? searchFolders
      : folders;

  const baseFiles =
    normalizedSearch
      ? searchFiles
      : files;

  const compareText = (
    first: string,
    second: string
  ) => {
    return first.localeCompare(
      second,
      undefined,
      {
        numeric: true,
        sensitivity: "base",
      }
    );
  };

  const sortFolders = (
    items: FolderItem[]
  ) => {
    const sorted = [...items];

    sorted.sort((a, b) => {
      let result = 0;

      if (sortOption === "name") {
        result = compareText(
          a.name,
          b.name
        );
      } else if (
        sortOption === "newest"
      ) {
        result =
          new Date(
            b.createdAt
          ).getTime() -
          new Date(
            a.createdAt
          ).getTime();
      } else if (
        sortOption === "oldest"
      ) {
        result =
          new Date(
            a.createdAt
          ).getTime() -
          new Date(
            b.createdAt
          ).getTime();
      }

      return sortAscending
        ? result
        : -result;
    });

    return sorted;
  };

  const sortFiles = (
    items: FileItem[]
  ) => {
    const sorted = [...items];

    sorted.sort((a, b) => {
      let result = 0;

      if (sortOption === "name") {
        result = compareText(
          a.originalName || a.name,
          b.originalName || b.name
        );
      } else if (
        sortOption === "newest"
      ) {
        result =
          new Date(
            b.createdAt
          ).getTime() -
          new Date(
            a.createdAt
          ).getTime();
      } else if (
        sortOption === "oldest"
      ) {
        result =
          new Date(
            a.createdAt
          ).getTime() -
          new Date(
            b.createdAt
          ).getTime();
      } else if (
        sortOption === "largest"
      ) {
        result =
          b.size - a.size;
      } else if (
        sortOption === "smallest"
      ) {
        result =
          a.size - b.size;
      }

      return sortAscending
        ? result
        : -result;
    });

    return sorted;
  };

  const displayedFolders =
    sortFolders(baseFolders);

  const displayedFiles =
    sortFiles(baseFiles);

  const totalSearchResults =
    displayedFolders.length +
    displayedFiles.length;


  // =========================================================
  // IMAGE THUMBNAILS
  // =========================================================

  useEffect(() => {
    if (layoutMode !== "grid") {
      return;
    }

    const imageFiles = displayedFiles.filter(
      (file) =>
        viewMode !== "trash" &&
        file.contentType?.toLowerCase().startsWith("image/")
    );

    if (imageFiles.length === 0) {
      return;
    }

    let cancelled = false;
    const createdUrls: string[] = [];

    const loadThumbnails = async () => {
      const token = getToken();

      if (!token) {
        return;
      }

      const entries: Record<string, string> = {};

      await Promise.all(
        imageFiles.map(async (file) => {
          try {
            const response = await fetch(
              `${API_BASE}/api/files/${file.id}/download`,
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              }
            );

            if (!response.ok) {
              return;
            }

            const blob = await response.blob();
            const objectUrl = window.URL.createObjectURL(blob);

            createdUrls.push(objectUrl);
            entries[file.id] = objectUrl;
          } catch (error) {
            console.error(
              "Unable to load image thumbnail:",
              error
            );
          }
        })
      );

      if (!cancelled) {
        setImageThumbnailUrls((current) => {
          const next = { ...current };

          Object.entries(entries).forEach(
            ([fileId, url]) => {
              const previous = next[fileId];

              if (previous) {
                window.URL.revokeObjectURL(previous);
              }

              next[fileId] = url;
            }
          );

          return next;
        });
      } else {
        createdUrls.forEach((url) =>
          window.URL.revokeObjectURL(url)
        );
      }
    };

    void loadThumbnails();

    return () => {
      cancelled = true;

      createdUrls.forEach((url) =>
        window.URL.revokeObjectURL(url)
      );
    };
  }, [
    layoutMode,
    viewMode,
    currentFolder,
    displayedFiles,
  ]);

  // =========================================================
  // SORT CONTROLS
  // =========================================================

  const handleSortChange = (
    event: ChangeEvent<HTMLSelectElement>
  ) => {
    setSortOption(
      event.target.value as SortOption
    );
  };

  const toggleSortDirection = () => {
    setSortAscending(
      (current) => !current
    );
  };


  // =========================================================
  // PAGE TITLE
  // =========================================================

  const pageTitle =
    viewMode === "starred"
      ? "Starred Files"
      : viewMode === "trash"
      ? "Trash"
      : currentFolder
      ? currentFolder.name
      : "My Files";

  // =========================================================
  // DASHBOARD SKY ANIMATION
  // =========================================================
  // The background uses three subtle layers:
  // 1. Constant twinkling stars.
  // 2. A small number of slow falling crystal shards.
  // 3. Only two occasional comet-like falling stars with tails.
  //
  // Values are deterministic so the animation is stable across
  // server/client rendering.
  const skyStars = useMemo(() => {
    return Array.from({ length: 46 }, (_, index) => {
      const left = (index * 47 + 7) % 100;
      const top = (index * 29 + 11) % 94;
      const size = 1.5 + ((index * 17) % 24) / 10;
      const duration = 2.8 + ((index * 13) % 34) / 10;
      const delay = -((index * 1.37) % duration);
      const glow = 7 + ((index * 9) % 13);

      return {
        left: `${left}%`,
        top: `${top}%`,
        width: `${size}px`,
        height: `${size}px`,
        animationDuration: `${duration}s`,
        animationDelay: `${delay}s`,
        boxShadow: `0 0 ${glow}px rgba(190, 220, 255, .72)`,
      } satisfies CSSProperties;
    });
  }, []);

  const crystalShards = useMemo(() => {
    // A few more slow, translucent shards create depth without
    // competing with the shooting stars.
    return Array.from({ length: 14 }, (_, index) => {
      const left = (index * 43 + 13) % 104;
      const width = 20 + ((index * 13) % 22);
      const height = 28 + ((index * 17) % 34);
      const duration = 15 + ((index * 7) % 11);
      const delay = -((index * 4.1) % duration);
      const opacity = 0.38 + ((index * 11) % 28) / 100;

      return {
        left: `${left}%`,
        width: `${width}px`,
        height: `${height}px`,
        animationDuration: `${duration}s`,
        animationDelay: `${delay}s`,
        opacity,
      } satisfies CSSProperties;
    });
  }, []);

  const comets = useMemo(() => {
    /*
     * Four independent shooting-star routes with an intentional speed pattern: fast → slow → fast → fast, then repeat.
     *
     * IMPORTANT: only ONE comet is visible at a time. Each route gets a
     * different start delay inside the same 20-second animation cycle.
     * The comet travels for the first part of its cycle and then stays
     * invisible until its next turn. This prevents multiple shooting
     * stars from appearing together while keeping their positions and
     * directions varied.
     *
     * All trajectories move DOWN the page (positive Y). Left-side routes
     * travel down-right; right-side routes travel down-left.
     */
    return [
      {
        // Left side -> down-right
        left: "3%",
        top: "-12%",
        animationDuration: "20s",
        animationDelay: "0s",
         ["--comet-speed-class" as string]: "fast",
        ["--comet-dx" as string]: "76vw",
        ["--comet-dy" as string]: "118vh",
        ["--tail-angle" as string]: "42deg",
        ["--tail-flip" as string]: "1",
      },
      {
        // Upper-middle -> down-right
        left: "37%",
        top: "-22%",
        animationDuration: "20s",
        animationDelay: "5s",
         ["--comet-speed-class" as string]: "slow",
        ["--comet-dx" as string]: "48vw",
        ["--comet-dy" as string]: "128vh",
        ["--tail-angle" as string]: "46deg",
        ["--tail-flip" as string]: "1",
      },
      {
        // Right side -> down-left
        left: "94%",
        top: "7%",
        animationDuration: "20s",
        animationDelay: "10s",
         ["--comet-speed-class" as string]: "fast",
        ["--comet-dx" as string]: "-64vw",
        ["--comet-dy" as string]: "112vh",
        ["--tail-angle" as string]: "-46deg",
        ["--tail-flip" as string]: "-1",
      },
      {
        // Far-right / lower start -> down-left
        left: "82%",
        top: "-18%",
        animationDuration: "20s",
        animationDelay: "15s",
         ["--comet-speed-class" as string]: "fast",
        ["--comet-dx" as string]: "-52vw",
        ["--comet-dy" as string]: "136vh",
        ["--tail-angle" as string]: "-43deg",
        ["--tail-flip" as string]: "-1",
      },
    ] satisfies CSSProperties[];
  }, []);


  return (
    <main
      className="storeroom-dashboard min-h-screen bg-slate-50"
      onDragEnter={(event) => {
        if (
          viewMode !== "trash" &&
          event.dataTransfer.types.includes("Files")
        ) {
          setDragActive(true);
        }
      }}
      onDragOver={(event) => {
        if (
          viewMode !== "trash" &&
          event.dataTransfer.types.includes("Files")
        ) {
          event.preventDefault();
          event.dataTransfer.dropEffect = uploading ? "none" : "copy";
          setDragActive(true);
        }
      }}
      onDrop={handleDropUpload}
    >

      {/* =====================================================
          FALLING CRYSTAL SHARDS
      ====================================================== */}

      <div
        className="sky-effects"
        aria-hidden="true"
      >
        <div className="twinkling-stars">
          {skyStars.map((style, index) => (
            <span
              key={`star-${index}`}
              className="sky-star"
              style={style}
            />
          ))}
        </div>

        <div className="crystal-rain">
          {crystalShards.map((style, index) => (
            <span
              key={`crystal-${index}`}
              className="crystal-shard"
              style={style}
            />
          ))}
        </div>

        <div className="comet-layer">
          {comets.map((style, index) => (
            <span
              key={`comet-${index}`}
              className={`falling-comet ${style["--comet-speed-class"] === "slow" ? "comet-slow" : "comet-fast"}`}
              style={style}
            >
              <span className="comet-head" />
              <span className="comet-tail" />
            </span>
          ))}
        </div>
      </div>

      {/* =====================================================
          HEADER
      ====================================================== */}

      <header className="border-b bg-white">

        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">

          <div>

            <h1 className="text-2xl font-bold text-slate-900">
              STOREROOM
            </h1>

            <p className="text-sm text-slate-500">
              Your personal cloud storage
            </p>

          </div>

          <div className="relative flex items-center gap-3">
            <button
              type="button"
              onClick={() => setProfileOpen((open) => !open)}
              className="storeroom-profile-button flex items-center gap-3 rounded-xl px-2 py-2 text-left transition"
              aria-expanded={profileOpen}
              aria-haspopup="menu"
            >
              <span className="storeroom-avatar">
                {(user?.fullName || "U").trim().charAt(0).toUpperCase()}
              </span>

              <span className="hidden min-w-0 text-right sm:block">
                <span className="block max-w-[180px] truncate text-sm font-semibold text-white">
                  {user?.fullName || "User"}
                </span>
                <span className="block max-w-[180px] truncate text-xs text-slate-300">
                  {user?.email || ""}
                </span>
              </span>

              <span className="text-xs text-slate-300">
                {profileOpen ? "▲" : "▼"}
              </span>
            </button>

            {profileOpen && (
              <>
                <button
                  type="button"
                  aria-label="Close profile menu"
                  className="storeroom-profile-backdrop fixed inset-0 z-40 cursor-default"
                  onClick={() => setProfileOpen(false)}
                />

                <div
                  role="menu"
                  className="storeroom-profile-menu absolute right-0 top-14 z-50 w-72 overflow-hidden rounded-2xl p-2"
                >
                  <div className="px-4 py-4">
                    <p
                      className="storeroom-profile-menu-label text-xs uppercase tracking-[0.16em]"
                      style={{ color: "#b8c7e3" }}
                    >
                      Signed in as
                    </p>
                    <p
                      className="storeroom-profile-menu-name mt-1 truncate text-sm font-semibold"
                      style={{ color: "#ffffff" }}
                    >
                      {user?.fullName || "User"}
                    </p>
                    <p
                      className="storeroom-profile-menu-email truncate text-xs"
                      style={{ color: "#c4d2ea" }}
                    >
                      {user?.email || ""}
                    </p>
                  </div>

                  <div className="mx-2 border-t border-white/10" />

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setProfileOpen(false);
                      logout();
                    }}
                    className="storeroom-profile-logout mt-1 flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold transition"
                    style={{ color: "#ffb4b4", background: "rgba(239,68,68,.08)" }}
                  >
                    <span style={{ color: "#ffb4b4" }}>↪</span>
                    <span style={{ color: "#ffb4b4" }}>Sign out of STOREROOM</span>
                  </button>
                </div>
              </>
            )}
          </div>

        </div>

      </header>


      {/* =====================================================
          MAIN
      ====================================================== */}

      <section className="mx-auto max-w-6xl px-6 py-8">

        {/* =====================================================
            TABS
        ====================================================== */}

        <div className="mb-6 flex gap-2">

          <button
            type="button"
            onClick={() =>
              changeView("all")
            }
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              viewMode === "all"
                ? "bg-slate-900 text-white"
                : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
            }`}
          >
            📁 My Files
          </button>

          <button
            type="button"
            onClick={() =>
              changeView("starred")
            }
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              viewMode === "starred"
                ? "bg-yellow-500 text-white"
                : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
            }`}
          >
            ⭐ Starred
          </button>

          <button
            type="button"
            onClick={() =>
              changeView("trash")
            }
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              viewMode === "trash"
                ? "bg-red-600 text-white"
                : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
            }`}
          >
            🗑️ Trash
          </button>

        </div>


        {/* =====================================================
            SEARCH BAR
        ====================================================== */}

        <div className="mb-6">

          <div className="relative">

            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg text-slate-400">
              🔍
            </span>

            <input
              type="text"
              value={searchQuery}
              onChange={(event) =>
                setSearchQuery(
                  event.target.value
                )
              }
              placeholder={
                viewMode === "trash"
                  ? "Search files in Trash..."
                  : viewMode === "starred"
                  ? "Search starred files..."
                  : currentFolder
                  ? `Search inside ${currentFolder.name}...`
                  : "Search files and folders..."
              }
              className="storeroom-search-input w-full rounded-xl border border-slate-300 bg-white py-3 pl-12 pr-12 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
            />

            {searchQuery && (
              <button
                type="button"
                onClick={() =>
                  setSearchQuery("")
                }
                className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full px-2 py-1 text-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Clear search"
              >
                ×
              </button>
            )}

          </div>

          {normalizedSearch && (
            <div className="mt-2 flex items-center justify-between px-1">

              <p className="text-sm text-slate-500">
                {searchLoading
                  ? "Searching..."
                  : `${totalSearchResults} ${
                      totalSearchResults === 1
                        ? "result"
                        : "results"
                    } found for `}
                {!searchLoading && (
                  <span className="font-medium text-slate-700">
                    "{searchQuery.trim()}"
                  </span>
                )}
              </p>

              {!searchLoading &&
                totalSearchResults === 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setSearchQuery("")
                    }
                    className="text-sm font-medium text-slate-700 hover:underline"
                  >
                    Clear search
                  </button>
                )}

            </div>
          )}

        </div>


        {/* TITLE + ACTIONS */}

        <div className="mb-6 flex items-center justify-between">

          <div>

            <h2 className="text-3xl font-bold text-slate-900">
              {pageTitle}
            </h2>

            <p className="mt-1 text-slate-500">
              {viewMode === "starred"
                ? "Your favorite files."
                : viewMode === "trash"
                ? "Files moved to Trash."
                : currentFolder
                ? `Files and folders inside ${currentFolder.name}.`
                : "Manage your files stored in STOREROOM."}
            </p>

          </div>


          <div className="flex items-center gap-3">

            {viewMode === "all" && (
              <button
                type="button"
                onClick={
                  handleCreateFolder
                }
                disabled={
                  creatingFolder
                }
                className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
              >
                {creatingFolder
                  ? "Creating..."
                  : "📁 New Folder"}
              </button>
            )}

            {viewMode !== "trash" && (
              <label className="storeroom-upload-button cursor-pointer px-5 py-3 text-sm font-semibold text-white transition">
                <span className="relative z-10">
                  {uploading ? "Uploading..." : "⬆ Upload Files"}
                </span>

                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleUpload}
                  disabled={uploading}
                />
              </label>
            )}

          </div>

        </div>




        {/* =====================================================
            SORT & VIEW CONTROLS
        ====================================================== */}

        {!searchLoading && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">

            <div className="flex items-center gap-2">

              <span className="text-sm font-medium text-slate-600">
                Sort by
              </span>

              <select
                value={sortOption}
                onChange={
                  handleSortChange
                }
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              >
                <option value="name">
                  Name
                </option>
                <option value="newest">
                  Newest
                </option>
                <option value="oldest">
                  Oldest
                </option>
                <option value="largest">
                  Largest
                </option>
                <option value="smallest">
                  Smallest
                </option>
              </select>

              <button
                type="button"
                onClick={
                  toggleSortDirection
                }
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                title={
                  sortAscending
                    ? "Ascending"
                    : "Descending"
                }
              >
                {sortAscending
                  ? "↑ Ascending"
                  : "↓ Descending"}
              </button>

            </div>

            <div className="flex items-center gap-2">

              <span className="text-sm font-medium text-slate-600">
                View
              </span>

              <button
                type="button"
                onClick={() =>
                  setLayoutMode("list")
                }
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  layoutMode === "list"
                    ? "bg-slate-900 text-white"
                    : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                }`}
                aria-label="List view"
              >
                ☰ List
              </button>

              <button
                type="button"
                onClick={() =>
                  setLayoutMode("grid")
                }
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  layoutMode === "grid"
                    ? "bg-slate-900 text-white"
                    : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                }`}
                aria-label="Grid view"
              >
                ▦ Grid
              </button>

            </div>

          </div>
        )}


        {/* =====================================================
            BREADCRUMB
        ====================================================== */}

        {viewMode === "all" &&
          (currentFolder ||
            folderPath.length > 0) && (

            <div className="mb-6 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3">

              <button
                type="button"
                onClick={
                  goToRoot
                }
                className="font-medium text-slate-700 hover:text-slate-900"
              >
                🏠 My Files
              </button>

              {folderPath.map(
                (
                  folder,
                  index
                ) => {

                  const isLast =
                    index ===
                    folderPath.length -
                      1;

                  return (
                    <div
                      key={
                        folder.id
                      }
                      className="flex items-center gap-2"
                    >

                      <span className="text-slate-400">
                        /
                      </span>

                      <button
                        type="button"
                        disabled={
                          isLast
                        }
                        onClick={() => {

                          if (
                            index ===
                            0
                          ) {
                            setFolderPath(
                              [
                                folder,
                              ]
                            );
                          } else {
                            setFolderPath(
                              folderPath.slice(
                                0,
                                index +
                                  1
                              )
                            );
                          }

                          setSearchQuery("");

                          setCurrentFolder(
                            folder
                          );

                        }}
                        className={`font-medium ${
                          isLast
                            ? "text-slate-900"
                            : "text-slate-500 hover:text-slate-900"
                        }`}
                      >
                        📁 {folder.name}
                      </button>

                    </div>
                  );
                }
              )}

            </div>
          )}


        {/* =====================================================
            FOLDER ACTIONS
        ====================================================== */}

        {viewMode === "all" &&
          currentFolder && (

            <div className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-4 sm:px-5">

              <div className="flex min-w-0 items-center gap-3">

                <button
                  type="button"
                  onClick={
                    goBack
                  }
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  ← Back
                </button>

                <span className="text-sm text-slate-500">
                  Inside:
                </span>

                <span className="min-w-0 truncate font-semibold text-slate-900">
                  📁 {currentFolder.name}
                </span>

              </div>

              <div
                className={`relative ${
                  folderMenuOpen
                    ? "storeroom-folder-menu-open"
                    : ""
                }`}
              >

                <button
                  type="button"
                  onClick={() =>
                    setFolderMenuOpen(
                      (current) => !current
                    )
                  }
                  disabled={
                    renamingFolder ||
                    deletingFolder
                  }
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-xl font-bold leading-none text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
                  aria-label="Folder actions"
                  aria-expanded={folderMenuOpen}
                  title="Folder actions"
                >
                  ⋮
                </button>

                {folderMenuOpen && (
                  <>
                    {/* Invisible backdrop closes the menu when clicking elsewhere */}
                    <button
                      type="button"
                      aria-label="Close folder actions"
                      className="fixed inset-0 z-40 cursor-default"
                      onClick={() =>
                        setFolderMenuOpen(false)
                      }
                    />

                    <div className="storeroom-folder-dropdown absolute right-0 bottom-12 z-50 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl">

                      <button
                        type="button"
                        onClick={() => {
                          setFolderMenuOpen(false);
                          void handleRenameFolder();
                        }}
                        disabled={renamingFolder}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                      >
                        <span className="text-base">
                          ✏️
                        </span>
                        <span>
                          {renamingFolder
                            ? "Renaming..."
                            : "Rename"}
                        </span>
                      </button>

                      <div className="mx-3 border-t border-slate-100" />

                      <button
                        type="button"
                        onClick={() => {
                          setFolderMenuOpen(false);
                          void handleDeleteFolder();
                        }}
                        disabled={deletingFolder}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                      >
                        <span className="text-base">
                          🗑️
                        </span>
                        <span>
                          {deletingFolder
                            ? "Deleting..."
                            : "Delete Folder"}
                        </span>
                      </button>

                    </div>
                  </>
                )}

              </div>

            </div>
          )}


        {/* =====================================================
            TRASH INFO
        ====================================================== */}

        {viewMode === "trash" && (
          <div className="mb-6 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
            Files in Trash still use your storage space until permanently deleted.
          </div>
        )}


        {/* =====================================================
            MESSAGES
        ====================================================== */}

        {message && (
          <div className="storeroom-toast storeroom-toast-success mb-4 rounded-lg px-4 py-3 text-sm">
            {message}
          </div>
        )}

        {error && (
          <div className="storeroom-toast storeroom-toast-error mb-6 rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}


        {/* =====================================================
            LOADING
        ====================================================== */}

        {loading && (
          <div className="rounded-xl border bg-white p-10 text-center">

            <p className="text-slate-500">
              Loading STOREROOM...
            </p>

          </div>
        )}


        {/* =====================================================
            FOLDERS
        ====================================================== */}

        {!loading &&
          !error &&
          viewMode === "all" &&
          displayedFolders.length > 0 && (

            <div className="storeroom-folder-panel mb-6 rounded-xl border bg-white shadow-sm">

              <div className="border-b px-6 py-4">

                <p className="font-semibold text-slate-900">
                  Folders
                </p>

              </div>

              <div
                className={
                  layoutMode === "grid"
                    ? "grid grid-cols-2 gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3"
                    : "divide-y"
                }
              >

                {displayedFolders.map(
                  (folder) => (

                    <button
                      key={
                        folder.id
                      }
                      type="button"
                      onClick={() =>
                        openFolder(
                          folder
                        )
                      }
                      className={
                        layoutMode === "grid"
                          ? "storeroom-folder-card flex min-w-0 flex-col items-center rounded-xl border border-slate-200 bg-white p-4 text-center transition hover:border-slate-400 hover:bg-slate-50"
                          : "storeroom-folder-card storeroom-folder-row flex w-full items-center gap-4 px-6 py-4 text-left transition hover:bg-slate-50"
                      }
                    >

                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-yellow-50 text-3xl">
                        📁
                      </div>

                      <div className="min-w-0">

                        <p className="truncate font-semibold text-slate-900">
                          {folder.name}
                        </p>

                        <p className="text-xs text-slate-500">
                          Open folder →
                        </p>

                      </div>

                    </button>

                  )
                )}

              </div>

            </div>
          )}


        {/* =====================================================
            FILES
        ====================================================== */}

        {!loading &&
          !error &&
          displayedFiles.length > 0 && (

            <div className="storeroom-file-panel relative overflow-visible rounded-xl border bg-white shadow-sm">

              <div className="border-b px-6 py-4">

                <p className="font-semibold text-slate-900">
                  {displayedFiles.length}{" "}
                  {displayedFiles.length === 1
                    ? "file"
                    : "files"}
                </p>

              </div>

              <div
                className={
                  layoutMode === "grid"
                    ? "grid grid-cols-2 gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                    : "divide-y"
                }
              >

                {displayedFiles.map(
                  (file) => (

                    <div
                      key={
                        file.id
                      }
                      className={
                        layoutMode === "grid"
                          ? "storeroom-file-card relative flex min-w-0 flex-col rounded-xl border border-slate-200 bg-white p-3 transition hover:border-slate-400 hover:bg-slate-50"
                          : "storeroom-file-card storeroom-file-row flex items-center justify-between px-6 py-5 transition hover:bg-slate-50"
                      }
                    >

                      {/* FILE */}

                      <button
                        type="button"
                        onClick={() => void handlePreview(file)}
                        title="Open file"
                        className={
                          layoutMode === "grid"
                            ? "storeroom-file-open group flex w-full min-w-0 max-w-full flex-1 flex-col items-center gap-2 overflow-hidden rounded-lg text-center transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300"
                            : "storeroom-file-open flex min-w-0 max-w-full flex-1 items-center gap-4 overflow-hidden rounded-lg text-left transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300"
                        }
                      >

                        <div
                          className={
                            layoutMode === "grid"
                              ? "storeroom-file-icon flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 text-3xl"
                              : "storeroom-file-icon flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-2xl"
                          }
                        >
                          {viewMode === "trash" ? (
                            "🗑️"
                          ) : layoutMode === "grid" &&
                            file.contentType
                              ?.toLowerCase()
                              .startsWith("image/") &&
                            imageThumbnailUrls[file.id] ? (
                            <img
                              src={imageThumbnailUrls[file.id]}
                              alt={file.originalName}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <FileTypeIcon file={file} />
                          )}
                        </div>

                        <div className="min-w-0 w-full max-w-full flex-1 overflow-hidden">

                          <p
                            className="block w-full max-w-full min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-sm font-medium text-slate-900"
                            title={file.originalName}
                          >
                            {file.originalName}
                          </p>

                          <p
                            className="block w-full max-w-full min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-xs text-slate-500"
                            title={file.contentType}
                          >
                            {file.contentType}
                          </p>

                          <p className="truncate text-xs text-slate-500">
                            {formatSize(file.size)}
                          </p>

                        </div>

                      </button>


                      {/* ACTIONS */}

                      <div
                        className={`storeroom-file-actions ${
                          layoutMode === "grid"
                            ? "mt-3 flex w-full items-center justify-between gap-2"
                            : "ml-4 flex shrink-0 items-center gap-2"
                        }`}
                      >

                        {viewMode === "trash" ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleDownload(file)}
                              disabled={downloadingId === file.id}
                              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                            >
                              {downloadingId === file.id
                                ? "Downloading..."
                                : "⬇ Download"}
                            </button>

                            <div
                              className={`relative ${
                                fileMenuOpenId === file.id
                                  ? "storeroom-file-menu-open"
                                  : ""
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  setFileMenuOpenId((current) =>
                                    current === file.id ? null : file.id
                                  )
                                }
                                disabled={
                                  restoringId === file.id ||
                                  permanentlyDeletingId === file.id
                                }
                                className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-xl font-bold leading-none text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
                                aria-label={`Actions for ${file.originalName}`}
                                aria-expanded={fileMenuOpenId === file.id}
                                title="File actions"
                              >
                                ⋮
                              </button>

                              {fileMenuOpenId === file.id && (
                                <>
                                  <button
                                    type="button"
                                    aria-label="Close file actions"
                                    className="fixed inset-0 z-40 cursor-default"
                                    onClick={() => setFileMenuOpenId(null)}
                                  />

                                  <div className="absolute right-0 top-12 z-50 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setFileMenuOpenId(null);
                                        void handleRestore(file);
                                      }}
                                      disabled={restoringId === file.id}
                                      className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-green-700 transition hover:bg-green-50 disabled:opacity-50"
                                    >
                                      <span>♻️</span>
                                      <span>
                                        {restoringId === file.id
                                          ? "Restoring..."
                                          : "Restore"}
                                      </span>
                                    </button>

                                    <div className="mx-3 border-t border-slate-100" />

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setFileMenuOpenId(null);
                                        void handlePermanentDelete(file);
                                      }}
                                      disabled={permanentlyDeletingId === file.id}
                                      className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                                    >
                                      <span>❌</span>
                                      <span>
                                        {permanentlyDeletingId === file.id
                                          ? "Deleting..."
                                          : "Delete Forever"}
                                      </span>
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          </>
                        ) : (
                          <>
                            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                              Stored
                            </span>

                            <div
                              className={`relative ${
                                fileMenuOpenId === file.id
                                  ? "storeroom-file-menu-open"
                                  : ""
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  setFileMenuOpenId((current) =>
                                    current === file.id ? null : file.id
                                  )
                                }
                                disabled={
                                  starringId === file.id ||
                                  deletingId === file.id
                                }
                                className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-xl font-bold leading-none text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
                                aria-label={`Actions for ${file.originalName}`}
                                aria-expanded={fileMenuOpenId === file.id}
                                title="File actions"
                              >
                                ⋮
                              </button>

                              {fileMenuOpenId === file.id && (
                                <>
                                  <button
                                    type="button"
                                    aria-label="Close file actions"
                                    className="fixed inset-0 z-40 cursor-default"
                                    onClick={() => setFileMenuOpenId(null)}
                                  />

                                  <div className="absolute right-0 top-12 z-50 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setFileMenuOpenId(null);
                                        handleToggleStar(file);
                                      }}
                                      disabled={starringId === file.id}
                                      className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium transition ${
                                        file.starred
                                          ? "text-yellow-700 hover:bg-yellow-50"
                                          : "text-slate-700 hover:bg-slate-50"
                                      }`}
                                    >
                                      <span>
                                        {file.starred ? "★" : "☆"}
                                      </span>
                                      <span>
                                        {starringId === file.id
                                          ? "Updating..."
                                          : file.starred
                                          ? "Unstar"
                                          : "Star"}
                                      </span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setFileMenuOpenId(null);
                                        startFileRename(file);
                                      }}
                                      className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                                    >
                                      <span>✏️</span>
                                      <span>Rename</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setFileMenuOpenId(null);
                                        void handleDownload(file);
                                      }}
                                      disabled={downloadingId === file.id}
                                      className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                                    >
                                      <span>⬇️</span>
                                      <span>
                                        {downloadingId === file.id
                                          ? "Downloading..."
                                          : "Download"}
                                      </span>
                                    </button>

                                    <div className="mx-3 border-t border-slate-100" />

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setFileMenuOpenId(null);
                                        void handleDelete(file);
                                      }}
                                      disabled={deletingId === file.id}
                                      className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                                    >
                                      <span>🗑️</span>
                                      <span>
                                        {deletingId === file.id
                                          ? "Moving..."
                                          : "Move to Trash"}
                                      </span>
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          </>
                        )}

                      </div>

                    </div>

                  )
                )}

              </div>

            </div>
          )}


        {/* =====================================================
            SEARCH EMPTY STATE
        ====================================================== */}

        {!loading &&
          !error &&
          !searchLoading &&
          normalizedSearch &&
          totalSearchResults === 0 && (

            <div className="rounded-xl border bg-white p-12 text-center">

              <div className="mb-3 text-5xl">
                🔍
              </div>

              <h3 className="text-lg font-semibold text-slate-900">
                No results found
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                No files or folders match "{searchQuery.trim()}".
              </p>

              <button
                type="button"
                onClick={() =>
                  setSearchQuery("")
                }
                className="mt-5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
              >
                Clear Search
              </button>

            </div>
          )}


        {/* =====================================================
            NORMAL EMPTY STATE
        ====================================================== */}

        {!loading &&
          !error &&
          !normalizedSearch &&
          displayedFolders.length === 0 &&
          displayedFiles.length === 0 && (

            <div className="rounded-xl border bg-white p-12 text-center">

              <div className="mb-3 text-5xl">
                {viewMode ===
                "starred"
                  ? "⭐"
                  : viewMode ===
                    "trash"
                  ? "🗑️"
                  : currentFolder
                  ? "📂"
                  : "📁"}
              </div>

              <h3 className="text-lg font-semibold text-slate-900">

                {viewMode ===
                "starred"
                  ? "No starred files"
                  : viewMode ===
                    "trash"
                  ? "Trash is empty"
                  : currentFolder
                  ? "This folder is empty"
                  : "No files or folders yet"}

              </h3>

              <p className="mt-1 text-sm text-slate-500">

                {viewMode ===
                "starred"
                  ? "Star a file to see it here."
                  : viewMode ===
                    "trash"
                  ? "Files moved to Trash will appear here."
                  : currentFolder
                  ? "Upload a file or create a new folder."
                  : "Create a folder or upload your first file."}

              </p>

            </div>
          )}

      </section>

      {dragActive && viewMode !== "trash" && (
        <div className="storeroom-drop-overlay" aria-hidden="true">
          <div className="storeroom-drop-overlay-card">
            <div className="storeroom-drop-overlay-icon">✦</div>
            <p className="text-lg font-semibold text-white">Drop files to upload</p>
            <p className="mt-1 text-sm text-slate-400">
              STOREROOM will upload them securely.
            </p>
          </div>
        </div>
      )}

      {uploadQueue.length > 0 && (
        <div className="storeroom-upload-panel fixed bottom-5 right-5 z-[80] w-[min(420px,calc(100vw-2rem))] overflow-hidden rounded-2xl p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">
                {uploading ? "Uploading files" : "Upload complete"}
              </p>
              <p className="text-xs text-slate-400">
                {uploadQueue.filter((item) => item.status === "success").length} / {uploadQueue.length} completed
              </p>
            </div>
            <span className="text-lg">↑</span>
          </div>

          <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
            {uploadQueue.map((item) => (
              <div key={item.id} className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-sm text-indigo-200">
                    {item.status === "success" ? "✓" : item.status === "error" ? "!" : "↑"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-slate-100">{item.file.name}</p>
                    <p className="mt-0.5 text-[10px] text-slate-400">
                      {item.status === "uploading"
                        ? `${item.progress}%`
                        : item.status === "success"
                        ? "Uploaded"
                        : item.status === "error"
                        ? item.error || "Upload failed"
                        : "Waiting..."}
                    </p>
                  </div>
                </div>

                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                  <div
                    className={`h-full rounded-full transition-[width] duration-300 ${
                      item.status === "error"
                        ? "bg-red-400"
                        : item.status === "success"
                        ? "bg-emerald-400"
                        : "bg-gradient-to-r from-cyan-400 via-indigo-400 to-violet-500"
                    }`}
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =====================================================
          FILE RENAME MODAL
      ====================================================== */}

      {renamingFileId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-slate-900">
              Rename file
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Enter a new name for the file.
            </p>

            <input
              type="text"
              value={renameFileName}
              onChange={(event) => setRenameFileName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  const file = files.find((item) => item.id === renamingFileId);
                  if (file) void handleRenameFile(file);
                }
                if (event.key === "Escape") {
                  cancelFileRename();
                }
              }}
              autoFocus
              className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
            />

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={cancelFileRename}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => {
                  const file = files.find((item) => item.id === renamingFileId);
                  if (file) void handleRenameFile(file);
                }}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          FILE PREVIEW MODAL
      ====================================================== */}

      {previewFile && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closePreview();
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="file-preview-title"
            className="flex h-[92vh] max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:h-[90vh]"
          >

            <div className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3 sm:px-5 sm:py-4">
              <div className="min-w-0">
                <h3
                  id="file-preview-title"
                  className="truncate text-base font-semibold text-slate-900 sm:text-lg"
                >
                  {previewFile.originalName}
                </h3>

                <p className="text-xs text-slate-500">
                  {previewFile.contentType} •{" "}
                  {formatSize(previewFile.size)}
                </p>
              </div>

              <div className="ml-2 flex shrink-0 items-center gap-2 sm:ml-4">
                <button
                  type="button"
                  onClick={() =>
                    handleDownload(previewFile)
                  }
                  disabled={
                    downloadingId ===
                    previewFile.id
                  }
                  className="hidden rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 sm:block"
                >
                  {downloadingId ===
                  previewFile.id
                    ? "Downloading..."
                    : "⬇ Download"}
                </button>

                <button
                  type="button"
                  onClick={closePreview}
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 text-2xl leading-none text-slate-600 hover:bg-slate-100"
                  aria-label="Close preview"
                  title="Close preview (Esc)"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto bg-slate-100 p-3 sm:p-4">

              <div className="mb-3 flex justify-end sm:hidden">
                <button
                  type="button"
                  onClick={() => handleDownload(previewFile)}
                  disabled={downloadingId === previewFile.id}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-100 disabled:opacity-50"
                >
                  {downloadingId === previewFile.id
                    ? "Downloading..."
                    : "⬇ Download"}
                </button>
              </div>

              {previewLoading && (
                <div className="flex min-h-[420px] items-center justify-center rounded-xl bg-white">
                  <p className="text-sm text-slate-500">
                    Loading preview...
                  </p>
                </div>
              )}

              {!previewLoading &&
                !previewError &&
                previewText !== null && (
                  <pre className="min-h-[420px] whitespace-pre-wrap break-words rounded-xl bg-white p-6 text-sm leading-6 text-slate-800 shadow-sm">
                    {previewText}
                  </pre>
                )}

              {!previewLoading &&
                !previewError &&
                previewUrl &&
                previewFile.contentType ===
                  "application/pdf" && (
                  <iframe
                    src={previewUrl}
                    title={`Preview of ${previewFile.originalName}`}
                    className="h-[75vh] min-h-[500px] w-full rounded-xl border-0 bg-white"
                  />
                )}

              {!previewLoading &&
                !previewError &&
                previewUrl &&
                previewFile.contentType.startsWith(
                  "image/"
                ) && (
                  <div className="flex min-h-[280px] items-center justify-center rounded-xl bg-slate-900 p-2 sm:min-h-[500px] sm:p-4">
                    <img
                      src={previewUrl}
                      alt={previewFile.originalName}
                      className="max-h-[68vh] max-w-full rounded-lg object-contain sm:max-h-[72vh]"
                    />
                  </div>
                )}

              {!previewLoading &&
                !previewError &&
                previewUrl &&
                previewFile.contentType.startsWith(
                  "video/"
                ) && (
                  <div className="flex min-h-[280px] items-center justify-center rounded-xl bg-black p-2 sm:min-h-[500px] sm:p-4">
                    <video
                      src={previewUrl}
                      controls
                      className="max-h-[68vh] max-w-full rounded-lg sm:max-h-[72vh]"
                    >
                      Your browser does not support video playback.
                    </video>
                  </div>
                )}

              {!previewLoading &&
                !previewError &&
                previewUrl &&
                previewFile.contentType.startsWith(
                  "audio/"
                ) && (
                  <div className="flex min-h-[240px] items-center justify-center rounded-xl bg-white p-6 sm:min-h-[300px] sm:p-8">
                    <div className="w-full max-w-xl text-center">
                      <div className="mb-6 text-6xl">
                        🎵
                      </div>

                      <p className="mb-6 font-medium text-slate-900">
                        {previewFile.originalName}
                      </p>

                      <audio
                        src={previewUrl}
                        controls
                        className="w-full"
                      />
                    </div>
                  </div>
                )}

              {!previewLoading &&
                previewError && (
                  <div className="flex min-h-[420px] items-center justify-center rounded-xl bg-white p-8 text-center">
                    <div>
                      <div className="mb-4 text-5xl">
                        📄
                      </div>

                      <h4 className="text-lg font-semibold text-slate-900">
                        Preview unavailable
                      </h4>

                      <p className="mx-auto mt-2 max-w-lg text-sm text-slate-500">
                        {previewError}
                      </p>

                      <button
                        type="button"
                        onClick={() =>
                          handleDownload(
                            previewFile
                          )
                        }
                        disabled={
                          downloadingId ===
                          previewFile.id
                        }
                        className="mt-5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                      >
                        {downloadingId ===
                        previewFile.id
                          ? "Downloading..."
                          : "⬇ Download File"}
                      </button>
                    </div>
                  </div>
                )}

            </div>

          </div>
        </div>
      )}

        {viewMode !== "trash" && (
          <div className="mx-auto max-w-6xl px-6 pb-2">
            <div
              className={`storeroom-dropzone ${dragActive ? "is-active" : ""}`}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "copy";
                setDragActive(true);
              }}
              onDrop={handleDropUpload}
            >
              <div className="storeroom-dropzone-icon">✦</div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">
                  {dragActive ? "Drop your files here" : "Drag & drop files here"}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Upload multiple files at once, or use the Upload Files button.
                </p>
              </div>
              <span className="hidden rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400 sm:inline-flex">
                Secure upload
              </span>
            </div>
          </div>
        )}



        {/* =====================================================
            STORAGE USAGE
        ====================================================== */}

        <div className="mx-auto max-w-6xl px-6 pb-8">
          <div className="storeroom-storage-card rounded-xl border border-slate-200 bg-white p-5 shadow-sm">

          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">

            <div>
              <p className="text-sm font-semibold text-slate-900">
                Storage
              </p>

              <p className="text-xs text-slate-500">
                {storageLoading
                  ? "Loading storage usage..."
                  : storageInfo
                  ? `${formatStorageSize(
                      storageInfo.storageUsed
                    )} of ${formatStorageSize(
                      storageInfo.storageQuota
                    )} used`
                  : "Storage information unavailable"}
              </p>
            </div>

            {!storageLoading &&
              storageInfo && (
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-900">
                    {storageInfo.usagePercentage < 0.01
                      ? "<0.01"
                      : storageInfo.usagePercentage.toFixed(
                          2
                        )}%
                  </p>

                  <p className="text-xs text-slate-500">
                    {storageInfo.fileCount}{" "}
                    {storageInfo.fileCount === 1
                      ? "file"
                      : "files"}
                  </p>
                </div>
              )}

          </div>

          <div className="storeroom-storage-track h-3 overflow-hidden rounded-full bg-slate-100">
            <div
              className="storeroom-storage-bar h-full rounded-full transition-all duration-700"
              style={{
                width: `${Math.min(
                  storageInfo?.usagePercentage || 0,
                  100
                )}%`,
              }}
            />
          </div>

          {!storageLoading &&
            storageInfo && (
              <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-slate-500">
                <span>
                  {formatStorageSize(
                    storageInfo.storageRemaining
                  )} remaining
                </span>

                <span>
                  Trash files continue to use storage until permanently deleted.
                </span>
              </div>
            )}

          </div>
        </div>


      <style jsx global>{`
        .storeroom-dashboard {
          position: relative;
          isolation: isolate;
          overflow-x: hidden;
          min-height: 100vh;
          background:
            radial-gradient(circle at 8% 4%, rgba(14, 165, 233, .28), transparent 30%),
            radial-gradient(circle at 88% 86%, rgba(124, 58, 237, .30), transparent 34%),
            radial-gradient(circle at 55% 40%, rgba(49, 46, 129, .18), transparent 36%),
            linear-gradient(135deg, #061527 0%, #030817 48%, #09051e 100%) !important;
        }

        .storeroom-dashboard::before {
          content: "";
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: -2;
          background:
            linear-gradient(rgba(99, 102, 241, .032) 1px, transparent 1px),
            linear-gradient(90deg, rgba(99, 102, 241, .032) 1px, transparent 1px);
          background-size: 34px 34px;
          mask-image: linear-gradient(to bottom, black, transparent 82%);
        }

        /* =====================================================
           SKY
           ===================================================== */

        .sky-effects {
          position: fixed;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          overflow: hidden;
        }

        .twinkling-stars {
          position: absolute;
          inset: 0;
        }

        .sky-star {
          position: absolute;
          display: block;
          border-radius: 999px;
          background: rgba(232, 244, 255, .92);
          animation: storeroom-star-twinkle ease-in-out infinite;
          will-change: opacity, transform;
        }

        @keyframes storeroom-star-twinkle {
          0%, 100% {
            opacity: .18;
            transform: scale(.72);
          }
          45% {
            opacity: .98;
            transform: scale(1.18);
          }
          60% {
            opacity: .48;
            transform: scale(.9);
          }
        }

        /* =====================================================
           CRYSTAL SHARDS
           ===================================================== */

        .crystal-rain {
          position: absolute;
          inset: 0;
          overflow: hidden;
        }

        .crystal-shard {
          position: absolute;
          top: -90px;
          display: block;
          border: 1px solid rgba(190, 220, 255, .08);
          border-radius: 7px 3px 9px 4px;
          clip-path: polygon(
            50% 0%,
            88% 18%,
            100% 61%,
            67% 100%,
            26% 87%,
            4% 42%,
            19% 15%
          );
          background:
            linear-gradient(
              135deg,
              rgba(103, 196, 255, .34) 0%,
              rgba(70, 110, 190, .24) 38%,
              rgba(139, 92, 246, .28) 72%,
              rgba(76, 29, 149, .25) 100%
            );
          box-shadow:
            0 0 14px rgba(96, 165, 250, .11),
            0 0 30px rgba(124, 58, 237, .08);
          filter: saturate(1.15) brightness(1.16);
          transform: rotate(-18deg);
          animation-name: storeroom-crystal-fall;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
          will-change: transform, top, opacity;
        }

        .crystal-shard::before {
          content: "";
          position: absolute;
          inset: 0;
          clip-path: polygon(
            50% 0%,
            50% 100%,
            4% 42%,
            19% 15%
          );
          background: linear-gradient(
            145deg,
            rgba(255,255,255,.16),
            rgba(125,211,252,.05) 48%,
            transparent 70%
          );
        }

        .crystal-shard::after {
          content: "";
          position: absolute;
          width: 180%;
          height: 2px;
          left: -55%;
          bottom: 8%;
          border-radius: 999px;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(125, 211, 252, .16),
            rgba(167, 139, 250, .12),
            transparent
          );
          filter: blur(1px);
          transform: rotate(-24deg);
          transform-origin: center;
        }

        @keyframes storeroom-crystal-fall {
          0% {
            top: -12vh;
            transform: translate3d(-18px, 0, 0) rotate(-24deg) scale(.82);
            opacity: 0;
          }

          8% {
            opacity: .54;
          }

          45% {
            opacity: .32;
          }

          78% {
            opacity: .15;
          }

          100% {
            top: 112vh;
            transform: translate3d(105px, 0, 0) rotate(155deg) scale(1.05);
            opacity: 0;
          }
        }

        /* =====================================================
           FALLING COMETS
           ===================================================== */

        .comet-layer {
          position: absolute;
          inset: 0;
        }

        .falling-comet {
          position: absolute;
          width: 13px;
          height: 13px;
          display: block;
          animation: storeroom-comet-fall-fast 20s linear infinite;
          will-change: transform, opacity;
        }

        .comet-head {
          position: absolute;
          right: 0;
          top: 0;
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: #f7fbff;
          box-shadow:
            0 0 5px rgba(255,255,255,.98),
            0 0 13px rgba(125,211,252,.88),
            0 0 25px rgba(139,92,246,.48);
          z-index: 2;
        }

        /*
         * The tail is anchored directly behind the star head.
         * Its angle is supplied independently for every comet so the
         * tail always points opposite the direction of travel.
         */
        .comet-tail {
          position: absolute;
          right: 4px;
          top: 3px;
          width: 145px;
          height: 2.5px;
          border-radius: 999px;
          transform-origin: right center;
          transform: rotate(var(--tail-angle)) scaleX(var(--tail-flip, 1));
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(99,102,241,.08) 18%,
            rgba(139,92,246,.20) 45%,
            rgba(125,211,252,.48) 72%,
            rgba(255,255,255,.92) 100%
          );
          filter: blur(.8px);
          box-shadow:
            0 0 8px rgba(125,211,252,.28),
            0 0 18px rgba(139,92,246,.12);
          opacity: .78;
        }

        @keyframes storeroom-comet-fall-fast {
          /* Fast turn: reaches the end of its route quickly, then waits. */
          0% {
            transform: translate3d(0, 0, 0) scale(.78);
            opacity: 0;
          }
          2% { opacity: 0; }
          4% { opacity: .92; }
          8% { opacity: 1; }
          13% { opacity: .82; }
          17% {
            transform: translate3d(var(--comet-dx), var(--comet-dy), 0) scale(1.04);
            opacity: .16;
          }
          19% {
            transform: translate3d(var(--comet-dx), var(--comet-dy), 0) scale(1.04);
            opacity: 0;
          }
          100% {
            transform: translate3d(var(--comet-dx), var(--comet-dy), 0) scale(1.04);
            opacity: 0;
          }
        }

        @keyframes storeroom-comet-fall-slow {
          /* Slow turn: stays visible longer, but still finishes before the
             next 5-second slot begins, so only one shooting star is visible. */
          0% {
            transform: translate3d(0, 0, 0) scale(.78);
            opacity: 0;
          }
          2% { opacity: 0; }
          4% { opacity: .88; }
          9% { opacity: 1; }
          17% { opacity: .82; }
          22% {
            transform: translate3d(var(--comet-dx), var(--comet-dy), 0) scale(1.04);
            opacity: .16;
          }
          24% {
            transform: translate3d(var(--comet-dx), var(--comet-dy), 0) scale(1.04);
            opacity: 0;
          }
          100% {
            transform: translate3d(var(--comet-dx), var(--comet-dy), 0) scale(1.04);
            opacity: 0;
          }
        }

        .falling-comet.comet-slow {
          animation-name: storeroom-comet-fall-slow;
        }

        /* =====================================================
           CONTENT ABOVE SKY
           ===================================================== */

        .storeroom-dashboard > header,
        .storeroom-dashboard > section,
        .storeroom-dashboard > .mx-auto.max-w-6xl {
          position: relative;
          z-index: 10;
        }

        .storeroom-dashboard > header {
          position: sticky;
          top: 0;
          z-index: 30;
          border-color: rgba(148, 163, 184, .18) !important;
          background: rgba(4, 9, 25, .72) !important;
          backdrop-filter: blur(18px);
          box-shadow:
            0 8px 35px rgba(0, 0, 0, .24),
            inset 0 -1px 0 rgba(129, 140, 248, .08);
        }

        .storeroom-dashboard header h1 {
          color: #f4f7ff !important;
          letter-spacing: .12em;
          text-shadow:
            0 0 18px rgba(129, 140, 248, .28),
            0 0 34px rgba(59, 130, 246, .14);
        }

        .storeroom-dashboard header p {
          color: rgba(191, 204, 230, .72) !important;
        }

        .storeroom-dashboard header button {
          border-color: rgba(148, 163, 184, .32) !important;
          background: rgba(15, 23, 42, .42) !important;
          color: #e8edff !important;
        }

        .storeroom-dashboard header button:hover {
          background: rgba(79, 70, 229, .22) !important;
          border-color: rgba(129, 140, 248, .55) !important;
          box-shadow: 0 0 22px rgba(79, 70, 229, .16);
        }

        /* =====================================================
           DARK GLASS DASHBOARD SURFACES
           ===================================================== */

        .storeroom-dashboard section h2,
        .storeroom-dashboard section h3,
        .storeroom-dashboard section h4,
        .storeroom-dashboard section p,
        .storeroom-dashboard section span,
        .storeroom-dashboard section label {
          color: #e8edff;
        }

        .storeroom-dashboard section .text-slate-900 {
          color: #f3f6ff !important;
        }

        .storeroom-dashboard section .text-slate-700 {
          color: #cbd5e1 !important;
        }

        .storeroom-dashboard section .text-slate-600,
        .storeroom-dashboard section .text-slate-500,
        .storeroom-dashboard section .text-slate-400 {
          color: #94a8c5 !important;
        }

        /*
         * Remove the white-card appearance. Folder, Starred,
         * Trash, search, sorting, file lists and storage surfaces
         * all use the same blue/violet glass language as the sky.
         */
        .storeroom-dashboard section .bg-white,
        .storeroom-dashboard section .bg-slate-50,
        .storeroom-dashboard section .bg-slate-100,
        .storeroom-dashboard section .border.bg-white,
        .storeroom-dashboard section .border.border-slate-200.bg-white,
        .storeroom-dashboard > .mx-auto.max-w-6xl .bg-white {
          border-color: rgba(129, 140, 248, .18) !important;
          background:
            linear-gradient(
              135deg,
              rgba(16, 30, 58, .78),
              rgba(20, 18, 55, .70)
            ) !important;
          color: #e8edff !important;
          backdrop-filter: blur(16px);
          box-shadow:
            0 14px 38px rgba(0, 0, 0, .20),
            inset 0 1px 0 rgba(255,255,255,.045);
        }

        .storeroom-dashboard section .bg-white:hover,
        .storeroom-dashboard section .bg-slate-50:hover,
        .storeroom-dashboard section .bg-slate-100:hover {
          border-color: rgba(129, 140, 248, .34) !important;
          box-shadow:
            0 16px 42px rgba(0, 0, 0, .24),
            0 0 26px rgba(79, 70, 229, .07),
            inset 0 1px 0 rgba(255,255,255,.055);
        }

        /* Keep dividers subtle instead of black/white. */
        .storeroom-dashboard section .border-b,
        .storeroom-dashboard section .divide-y > * {
          border-color: rgba(148, 163, 184, .14) !important;
        }

        /* Search and select fields match the dashboard glass. */
        .storeroom-dashboard input,
        .storeroom-dashboard select {
          border-color: rgba(129, 140, 248, .20) !important;
          background: rgba(7, 16, 36, .58) !important;
          color: #eef4ff !important;
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,.025),
            0 4px 18px rgba(0,0,0,.10);
        }

        .storeroom-dashboard input::placeholder {
          color: #7185a5 !important;
        }

        .storeroom-dashboard input:focus,
        .storeroom-dashboard select:focus {
          border-color: rgba(99, 102, 241, .62) !important;
          box-shadow:
            0 0 0 4px rgba(79, 70, 229, .12),
            0 0 24px rgba(79, 70, 229, .08) !important;
        }

        .storeroom-dashboard option {
          background: #0b1428;
          color: #eef4ff;
        }

        /* Tabs and view buttons should never turn into white boxes. */
        .storeroom-dashboard section button.bg-white,
        .storeroom-dashboard section button[class*="bg-white"] {
          background:
            linear-gradient(
              135deg,
              rgba(18, 34, 64, .78),
              rgba(25, 21, 62, .70)
            ) !important;
          border-color: rgba(129, 140, 248, .20) !important;
          color: #dbe7ff !important;
        }

        .storeroom-dashboard section button.bg-white:hover,
        .storeroom-dashboard section button[class*="bg-white"]:hover {
          background:
            linear-gradient(
              135deg,
              rgba(29, 51, 91, .86),
              rgba(42, 31, 88, .78)
            ) !important;
          border-color: rgba(129, 140, 248, .40) !important;
          color: #ffffff !important;
        }

        /* Folder/file rows and cards receive a gentle hover glow. */
        .storeroom-dashboard .grid > button:hover,
        .storeroom-dashboard .grid > div:hover,
        .storeroom-dashboard .divide-y > div:hover {
          transform: translateY(-2px);
          box-shadow:
            0 12px 28px rgba(0, 0, 0, .18),
            0 0 22px rgba(79, 70, 229, .06);
        }

        .storeroom-dashboard .grid > button,
        .storeroom-dashboard .grid > div,
        .storeroom-dashboard .divide-y > div {
          border-color: rgba(129, 140, 248, .12) !important;
        }

        .storeroom-dashboard .truncate,
        .storeroom-dashboard [class*="text-ellipsis"] {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        /* Status pill */
        .storeroom-dashboard .bg-green-100 {
          background: rgba(16, 185, 129, .12) !important;
          color: #72f0c1 !important;
          border: 1px solid rgba(52, 211, 153, .14);
        }

        /* Buttons keep the purple/blue accent language. */
        .storeroom-dashboard button {
          transition:
            transform .16s ease,
            box-shadow .16s ease,
            background-color .16s ease,
            border-color .16s ease,
            color .16s ease;
        }

        .storeroom-dashboard button:not(:disabled):active {
          transform: translateY(1px) scale(.99);
        }

        .storeroom-dashboard button.border-slate-300,
        .storeroom-dashboard label.border-slate-300 {
          border-color: rgba(129, 140, 248, .22) !important;
          color: #dbe7ff !important;
        }

        .storeroom-dashboard button.border-slate-300:hover {
          background: rgba(79, 70, 229, .14) !important;
          border-color: rgba(129, 140, 248, .42) !important;
          color: #ffffff !important;
        }

        .storeroom-dashboard label[class*="bg-slate-900"],
        .storeroom-dashboard button[class*="bg-slate-900"] {
          background:
            linear-gradient(
              135deg,
              #4f46e5,
              #7c3aed
            ) !important;
          color: #ffffff !important;
          box-shadow:
            0 10px 28px rgba(79, 70, 229, .24),
            0 0 26px rgba(124, 58, 237, .10);
        }

        .storeroom-dashboard label[class*="bg-slate-900"]:hover,
        .storeroom-dashboard button[class*="bg-slate-900"]:hover {
          background:
            linear-gradient(
              135deg,
              #6366f1,
              #8b5cf6
            ) !important;
          box-shadow:
            0 14px 34px rgba(79, 70, 229, .30),
            0 0 32px rgba(124, 58, 237, .15);
        }

        /* Modal styling stays readable but follows the same theme. */
        .storeroom-dashboard [role="dialog"],
        .storeroom-dashboard .fixed.inset-0.z-50 > div {
          border: 1px solid rgba(129, 140, 248, .22);
          background:
            linear-gradient(
              135deg,
              rgba(12, 23, 47, .96),
              rgba(20, 17, 49, .96)
            ) !important;
          color: #e8edff;
          box-shadow:
            0 24px 70px rgba(0,0,0,.48),
            0 0 42px rgba(79,70,229,.10);
          backdrop-filter: blur(22px);
        }

        .storeroom-dashboard [role="dialog"] .bg-slate-100,
        .storeroom-dashboard [role="dialog"] .bg-white {
          background: rgba(5, 12, 28, .74) !important;
          color: #e8edff !important;
        }

        .storeroom-dashboard [role="dialog"] .text-slate-900 {
          color: #f3f6ff !important;
        }

        .storeroom-dashboard [role="dialog"] .text-slate-500,
        .storeroom-dashboard [role="dialog"] .text-slate-700 {
          color: #9fb0ca !important;
        }

        .storeroom-dashboard [role="dialog"] input {
          background: rgba(7, 16, 36, .78) !important;
        }

        .storeroom-dashboard [role="dialog"] [class*="bg-black"] {
          background: rgba(0,0,0,.55) !important;
        }

        .storeroom-dashboard [role="dialog"] pre {
          color: #dbe7ff !important;
        }

        .storeroom-dashboard [role="dialog"] audio {
          filter: invert(.88);
        }

        .storeroom-dashboard [role="dialog"] {
          animation: storeroom-dialog-in .2s ease-out both;
        }

        .storeroom-dashboard .fixed.inset-0.z-50 {
          animation: storeroom-fade-in .18s ease-out both;
        }

        @keyframes storeroom-dialog-in {
          from {
            opacity: 0;
            transform: translateY(8px) scale(.985);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes storeroom-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @media (max-width: 640px) {
          /* Keep the profile menu fully inside the phone viewport.
             The menu is anchored to the profile button and never pushes
             outside the right edge of the screen. */
          .storeroom-dashboard header .storeroom-profile-menu {
            position: fixed !important;
            top: 4.35rem !important;
            right: .75rem !important;
            left: auto !important;
            width: min(18rem, calc(100vw - 1.5rem)) !important;
            max-width: calc(100vw - 1.5rem) !important;
            z-index: 9999 !important;
          }

          .storeroom-dashboard header .storeroom-profile-menu > div {
            min-width: 0;
          }

          .storeroom-dashboard section {
            padding-left: 1rem !important;
            padding-right: 1rem !important;
          }

          .storeroom-dashboard header > div {
            padding-left: 1rem !important;
            padding-right: 1rem !important;
          }

          .storeroom-dashboard h2 {
            font-size: 1.65rem !important;
            line-height: 1.2 !important;
          }

          .crystal-shard {
            opacity: .28;
          }

          .comet-tail {
            width: 105px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .storeroom-dashboard *,
          .storeroom-dashboard *::before,
          .storeroom-dashboard *::after {
            animation-duration: .01ms !important;
            transition-duration: .01ms !important;
            scroll-behavior: auto !important;
          }
        }

        /* =====================================================
           FINAL POLISH: TRANSPARENT GLASS + NON-WHITE HOVER
        ===================================================== */

        /*
         * Keep every major dashboard surface translucent so the
         * stars and comets remain visible through the UI.
         */
        .storeroom-dashboard section .bg-white,
        .storeroom-dashboard section .bg-slate-50,
        .storeroom-dashboard section .bg-slate-100,
        .storeroom-dashboard section .border.bg-white,
        .storeroom-dashboard section .border.border-slate-200.bg-white,
        .storeroom-dashboard > .mx-auto.max-w-6xl > div {
          background:
            linear-gradient(
              135deg,
              rgba(14, 28, 55, .38),
              rgba(28, 20, 67, .32)
            ) !important;
          border-color:
            rgba(129, 140, 248, .20) !important;
          backdrop-filter: blur(13px);
          -webkit-backdrop-filter: blur(13px);
          box-shadow:
            0 12px 34px rgba(0, 0, 0, .18),
            inset 0 1px 0 rgba(255,255,255,.035);
        }

        /*
         * Individual folder/file rows are even more transparent.
         * This lets the animated sky remain visible without reducing
         * text readability.
         */
        .storeroom-dashboard .grid > button,
        .storeroom-dashboard .grid > div,
        .storeroom-dashboard .divide-y > div {
          background:
            linear-gradient(
              135deg,
              rgba(12, 25, 51, .16),
              rgba(35, 25, 72, .12)
            ) !important;
          border-color:
            rgba(129, 140, 248, .12) !important;
        }

        /*
         * IMPORTANT: Tailwind hover:bg-slate-50 / hover:bg-slate-100
         * was turning selected file/folder rows bright white.
         * Override those hover utilities while keeping the glow.
         */
        .storeroom-dashboard [class*="hover:bg-slate-50"]:hover,
        .storeroom-dashboard [class*="hover:bg-slate-100"]:hover,
        .storeroom-dashboard [class*="hover:bg-yellow-50"]:hover {
          background:
            linear-gradient(
              135deg,
              rgba(39, 59, 104, .48),
              rgba(62, 42, 108, .42)
            ) !important;
          border-color:
            rgba(129, 140, 248, .34) !important;
          color: #f4f7ff !important;
          box-shadow:
            0 10px 28px rgba(0, 0, 0, .16),
            0 0 24px rgba(99, 102, 241, .08),
            inset 0 1px 0 rgba(255,255,255,.045);
        }

        /*
         * Keep text readable inside translucent surfaces, especially
         * the Storage card where the previous theme made text dark.
         */
        .storeroom-dashboard > .mx-auto.max-w-6xl.pb-8,
        .storeroom-dashboard > .mx-auto.max-w-6xl.pb-8 > div {
          color: #eaf0ff !important;
        }

        .storeroom-dashboard > .mx-auto.max-w-6xl.pb-8 p,
        .storeroom-dashboard > .mx-auto.max-w-6xl.pb-8 span {
          color: #b9c8e3 !important;
        }

        .storeroom-dashboard > .mx-auto.max-w-6xl.pb-8 p.text-slate-900,
        .storeroom-dashboard > .mx-auto.max-w-6xl.pb-8 p.text-slate-500 {
          color: #eaf0ff !important;
        }

        .storeroom-dashboard > .mx-auto.max-w-6xl.pb-8
          .bg-slate-100 {
          background: rgba(126, 151, 190, .16) !important;
        }

        .storeroom-dashboard > .mx-auto.max-w-6xl.pb-8
          .bg-slate-900 {
          background:
            linear-gradient(
              90deg,
              #6366f1,
              #8b5cf6,
              #7c3aed
            ) !important;
          box-shadow:
            0 0 18px rgba(99,102,241,.20);
        }

        /*
         * Make search/sort controls translucent too.
         */
        .storeroom-dashboard input,
        .storeroom-dashboard select {
          background:
            rgba(7, 16, 36, .46) !important;
        }

        /*
         * Comets: the tail is attached to the head and follows the
         * actual down-right / down-left trajectory instead of being
         * a straight horizontal line.
         */
        .falling-comet .comet-tail {
          transform: rotate(var(--tail-angle)) scaleX(var(--tail-flip, 1));
        }

        /*
         * Slightly softer comet glow so it reads as a shooting star,
         * not a bright UI element.
         */
        .comet-head {
          box-shadow:
            0 0 6px rgba(255,255,255,.9),
            0 0 16px rgba(125,211,252,.72),
            0 0 28px rgba(139,92,246,.38);
        }

        /*
         * Keep the dashboard header translucent as well.
         */
        .storeroom-dashboard > header {
          background:
            rgba(4, 9, 25, .60) !important;
        }

        /* Final readability: keep text bright even when surfaces are very transparent. */
        .storeroom-dashboard h1,
        .storeroom-dashboard h2,
        .storeroom-dashboard h3,
        .storeroom-dashboard h4,
        .storeroom-dashboard .font-semibold,
        .storeroom-dashboard .font-bold {
          color: #edf3ff !important;
        }

        .storeroom-dashboard .text-slate-900,
        .storeroom-dashboard .text-slate-800,
        .storeroom-dashboard .text-slate-700 {
          color: #e7eefc !important;
        }

        .storeroom-dashboard .text-slate-600,
        .storeroom-dashboard .text-slate-500,
        .storeroom-dashboard .text-slate-400 {
          color: #aebedb !important;
        }

        /* Never flash to white when hovering/selecting a folder or file. */
        .storeroom-dashboard [class*="hover:bg-white"]:hover,
        .storeroom-dashboard [class*="hover:bg-slate-50"]:hover,
        .storeroom-dashboard [class*="hover:bg-slate-100"]:hover {
          background: rgba(49, 61, 105, .28) !important;
        }

        @media (max-width: 640px) {
          .comet-tail {
            width: 110px;
          }

          .storeroom-dashboard section .bg-white,
          .storeroom-dashboard section .bg-slate-50,
          .storeroom-dashboard section .bg-slate-100 {
            background:
              linear-gradient(
                135deg,
                rgba(14, 28, 55, .42),
                rgba(28, 20, 67, .36)
              ) !important;
          }
        }


        /* =====================================================
           PREMIUM FILE + FOLDER CARDS
           ===================================================== */

        .storeroom-folder-panel,
        .storeroom-file-panel {
          position: relative;
          overflow: visible !important;
          border-color: rgba(129, 140, 248, .18) !important;
          background:
            linear-gradient(
              135deg,
              rgba(12, 25, 52, .30),
              rgba(31, 23, 70, .24)
            ) !important;
          box-shadow:
            0 16px 42px rgba(0, 0, 0, .16),
            inset 0 1px 0 rgba(255,255,255,.035);
        }

        .storeroom-folder-panel::before,
        .storeroom-file-panel::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            radial-gradient(circle at 12% 0%, rgba(56,189,248,.08), transparent 28%),
            radial-gradient(circle at 92% 100%, rgba(139,92,246,.08), transparent 30%);
          opacity: .9;
        }

        .storeroom-folder-panel > *,
        .storeroom-file-panel > * {
          position: relative;
          z-index: 1;
        }

        .storeroom-folder-card,
        .storeroom-file-card {
          position: relative;
          overflow: visible !important;
          border-color: rgba(129, 140, 248, .14) !important;
          background:
            linear-gradient(
              135deg,
              rgba(17, 32, 63, .25),
              rgba(35, 25, 76, .20)
            ) !important;
          box-shadow: inset 0 1px 0 rgba(255,255,255,.025);
          transition:
            transform .24s cubic-bezier(.2,.75,.25,1),
            border-color .24s ease,
            background .24s ease,
            box-shadow .24s ease;
        }

        .storeroom-folder-card::after,
        .storeroom-file-card::after {
          content: "";
          position: absolute;
          width: 130px;
          height: 130px;
          right: -70px;
          top: -75px;
          border-radius: 999px;
          background: radial-gradient(circle, rgba(129,140,248,.16), transparent 68%);
          opacity: 0;
          transition: opacity .28s ease, transform .28s ease;
          pointer-events: none;
        }

        .storeroom-folder-card:hover,
        .storeroom-file-card:hover {
          transform: translateY(-3px);
          border-color: rgba(129, 140, 248, .34) !important;
          background:
            linear-gradient(
              135deg,
              rgba(29, 49, 91, .38),
              rgba(57, 37, 103, .32)
            ) !important;
          box-shadow:
            0 18px 34px rgba(0,0,0,.20),
            0 0 28px rgba(99,102,241,.09),
            inset 0 1px 0 rgba(255,255,255,.055);
        }

        .storeroom-folder-card:hover::after,
        .storeroom-file-card:hover::after {
          opacity: 1;
          transform: scale(1.18);
        }

        .storeroom-folder-row,
        .storeroom-file-row {
          min-height: 92px;
        }

        .storeroom-folder-card > div:first-of-type {
          background:
            linear-gradient(145deg, rgba(251,191,36,.18), rgba(245,158,11,.07)) !important;
          border: 1px solid rgba(251,191,36,.14);
          box-shadow:
            0 8px 22px rgba(245,158,11,.08),
            inset 0 1px 0 rgba(255,255,255,.08);
          transition: transform .24s ease, box-shadow .24s ease;
        }

        .storeroom-folder-card:hover > div:first-of-type {
          transform: translateY(-2px) rotate(-2deg) scale(1.04);
          box-shadow:
            0 12px 26px rgba(245,158,11,.14),
            0 0 18px rgba(251,191,36,.08);
        }

        .storeroom-file-icon {
          background:
            linear-gradient(145deg, rgba(57,72,112,.28), rgba(75,48,122,.20)) !important;
          border: 1px solid rgba(129,140,248,.13);
          box-shadow:
            0 8px 22px rgba(0,0,0,.14),
            inset 0 1px 0 rgba(255,255,255,.045);
          transition: transform .24s ease, border-color .24s ease, box-shadow .24s ease;
        }

        .storeroom-file-card:hover .storeroom-file-icon {
          transform: translateY(-2px) scale(1.035);
          border-color: rgba(129,140,248,.30);
          box-shadow:
            0 12px 28px rgba(0,0,0,.18),
            0 0 22px rgba(99,102,241,.10),
            inset 0 1px 0 rgba(255,255,255,.06);
        }

        .storeroom-file-open {
          position: relative;
          z-index: 1;
        }

        .storeroom-file-open:focus-visible,
        .storeroom-folder-card:focus-visible {
          outline: none !important;
          box-shadow:
            0 0 0 2px rgba(99,102,241,.72),
            0 0 0 6px rgba(99,102,241,.12),
            0 14px 30px rgba(0,0,0,.18) !important;
        }

        .storeroom-file-actions {
          position: relative;
          z-index: 3;
        }

        .storeroom-file-actions .bg-green-100 {
          box-shadow: 0 0 18px rgba(52,211,153,.07);
        }

        /* =====================================================
           THREE-DOT MENU OVERFLOW + STACKING FIX
        ===================================================== */

        /*
         * Menus must be able to leave their cards and panels.
         * This removes clipping at every level that contains the
         * three-dot action menu.
         */
        .storeroom-folder-panel,
        .storeroom-file-panel,
        .storeroom-folder-card,
        .storeroom-file-card {
          overflow: visible !important;
        }

        /*
         * IMPORTANT: the whole main <section> is itself a stacking
         * context (z-index: 10), and the Storage block below it is a
         * later sibling with the same z-index. A high z-index on the
         * menu/card alone therefore cannot escape the section and will
         * still be painted underneath Storage. Raise the section while
         * any three-dot menu is open.
         */
        .storeroom-dashboard > section:has(.storeroom-file-menu-open),
        .storeroom-dashboard > section:has(.storeroom-folder-menu-open) {
          position: relative;
          z-index: 60 !important;
        }

        /*
         * Grid items and folder/file cards must participate in the same
         * stacking order so the active menu can overlap neighbouring
         * cards, rows and the space below the card.
         */
        .storeroom-file-card:has(.storeroom-file-menu-open),
        .storeroom-folder-card:has(.storeroom-folder-menu-open),
        .storeroom-file-menu-open,
        .storeroom-folder-menu-open {
          position: relative;
          z-index: 100 !important;
        }

        /* Keep the active dropdown itself above every card surface. */
        .storeroom-file-card .z-50,
        .storeroom-folder-panel .z-50,
        .storeroom-file-panel .z-50 {
          z-index: 110 !important;
        }

        /* The panel also needs to sit above other dashboard surfaces. */
        .storeroom-folder-panel:has(.storeroom-folder-menu-open),
        .storeroom-file-panel:has(.storeroom-file-menu-open) {
          position: relative;
          z-index: 90 !important;
        }

        /*
         * Folder actions are intentionally opened UPWARD. The folder
         * actions bar sits directly above the files/storage surfaces,
         * so opening downward would cover those blocks on shorter
         * screens. Opening upward keeps Rename/Delete fully visible
         * without covering the blocks below.
         */
        .storeroom-folder-dropdown {
          top: auto !important;
          bottom: calc(100% + .75rem) !important;
          z-index: 120 !important;
        }

        @media (max-width: 640px) {
          .storeroom-folder-dropdown {
            width: min(12rem, calc(100vw - 2rem)) !important;
          }
        }

        /* =====================================================
           PREMIUM FILE TYPE GLYPHS + IMAGE THUMBNAILS
        ===================================================== */

        .file-type-glyph {
          position: relative;
          display: flex;
          width: 100%;
          height: 100%;
          min-height: 64px;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          border-radius: 12px;
          background:
            radial-gradient(circle at 28% 18%, rgba(125,211,252,.16), transparent 38%),
            linear-gradient(145deg, rgba(30,48,88,.72), rgba(54,34,94,.58));
          border: 1px solid rgba(165,180,252,.16);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,.07),
            0 10px 24px rgba(0,0,0,.14);
          color: #eef4ff;
          transition: transform .28s ease, filter .28s ease, box-shadow .28s ease;
        }

        .storeroom-file-card:hover .file-type-glyph {
          transform: scale(1.035);
          filter: brightness(1.08);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,.09),
            0 14px 30px rgba(0,0,0,.20),
            0 0 24px rgba(99,102,241,.10);
        }

        .file-type-glyph-symbol {
          position: relative;
          z-index: 2;
          font-size: 1.25rem;
          font-weight: 800;
          letter-spacing: -.04em;
          text-shadow: 0 2px 12px rgba(0,0,0,.28);
        }

        .file-type-glyph-label {
          position: absolute;
          right: 7px;
          bottom: 6px;
          z-index: 2;
          border: 1px solid rgba(255,255,255,.10);
          border-radius: 5px;
          padding: 2px 5px;
          background: rgba(2,8,23,.46);
          color: rgba(226,232,240,.78);
          font-size: 8px;
          font-weight: 800;
          letter-spacing: .08em;
          line-height: 1;
          backdrop-filter: blur(7px);
        }

        .file-type-glyph::before {
          content: "";
          position: absolute;
          width: 58px;
          height: 58px;
          left: -16px;
          top: -18px;
          border-radius: 999px;
          background: rgba(125,211,252,.12);
          filter: blur(3px);
        }

        .file-type-pdf {
          background:
            radial-gradient(circle at 30% 20%, rgba(248,113,113,.20), transparent 40%),
            linear-gradient(145deg, rgba(93,27,47,.74), rgba(57,26,68,.60));
          border-color: rgba(248,113,113,.22);
        }

        .file-type-spreadsheet {
          background:
            radial-gradient(circle at 28% 18%, rgba(74,222,128,.18), transparent 38%),
            linear-gradient(145deg, rgba(18,66,59,.72), rgba(26,54,67,.60));
          border-color: rgba(74,222,128,.20);
        }

        .file-type-presentation {
          background:
            radial-gradient(circle at 28% 18%, rgba(251,146,60,.18), transparent 38%),
            linear-gradient(145deg, rgba(92,48,31,.72), rgba(65,35,65,.60));
          border-color: rgba(251,146,60,.20);
        }

        .file-type-document,
        .file-type-text {
          background:
            radial-gradient(circle at 28% 18%, rgba(96,165,250,.20), transparent 38%),
            linear-gradient(145deg, rgba(24,52,91,.74), rgba(37,31,76,.60));
          border-color: rgba(96,165,250,.20);
        }

        .file-type-code {
          background:
            radial-gradient(circle at 28% 18%, rgba(45,212,191,.16), transparent 38%),
            linear-gradient(145deg, rgba(15,59,62,.72), rgba(35,32,79,.60));
          border-color: rgba(45,212,191,.18);
        }

        .file-type-archive {
          background:
            radial-gradient(circle at 28% 18%, rgba(192,132,252,.18), transparent 38%),
            linear-gradient(145deg, rgba(57,35,89,.74), rgba(35,31,75,.60));
          border-color: rgba(192,132,252,.20);
        }

        .file-type-audio {
          background:
            radial-gradient(circle at 28% 18%, rgba(244,114,182,.18), transparent 38%),
            linear-gradient(145deg, rgba(77,32,70,.74), rgba(42,32,78,.60));
          border-color: rgba(244,114,182,.20);
        }

        .file-type-video {
          background:
            radial-gradient(circle at 28% 18%, rgba(125,211,252,.20), transparent 38%),
            linear-gradient(145deg, rgba(20,57,83,.74), rgba(46,30,84,.60));
          border-color: rgba(125,211,252,.20);
        }

        .file-type-play-badge {
          position: absolute;
          left: 8px;
          top: 8px;
          display: flex;
          width: 25px;
          height: 25px;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(255,255,255,.16);
          border-radius: 999px;
          background: rgba(3,8,22,.52);
          color: #f8fbff;
          font-size: 9px;
          box-shadow: 0 4px 14px rgba(0,0,0,.20);
          backdrop-filter: blur(7px);
        }

        .file-type-wave {
          position: absolute;
          left: 9px;
          top: 10px;
          color: rgba(244,114,182,.72);
          font-size: 9px;
          letter-spacing: 2px;
        }

        .storeroom-file-icon img {
          display: block;
          transform: scale(1.001);
          transition: transform .5s cubic-bezier(.2,.75,.25,1), filter .35s ease;
        }

        .storeroom-file-card:hover .storeroom-file-icon img {
          transform: scale(1.08);
          filter: saturate(1.08) brightness(1.05);
        }

        .storeroom-file-icon:has(img)::after {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: linear-gradient(
            135deg,
            rgba(255,255,255,.10),
            transparent 34%,
            transparent 68%,
            rgba(129,140,248,.10)
          );
          opacity: .8;
        }


        /* =====================================================
           STOREROOM UI UPGRADES 3–10
        ===================================================== */

        .storeroom-upload-button {
          position: relative;
          overflow: hidden;
          border: 1px solid rgba(129,140,248,.42);
          border-radius: 12px;
          background: linear-gradient(135deg, rgba(37,99,235,.88), rgba(124,58,237,.88));
          box-shadow: 0 10px 30px rgba(37,99,235,.16), inset 0 1px 0 rgba(255,255,255,.13);
        }
        .storeroom-upload-button::before {
          content: "";
          position: absolute;
          inset: -80%;
          background: linear-gradient(115deg, transparent 38%, rgba(255,255,255,.16) 50%, transparent 62%);
          transform: translateX(-35%) rotate(8deg);
          transition: transform .7s ease;
        }
        .storeroom-upload-button:hover::before { transform: translateX(35%) rotate(8deg); }
        .storeroom-upload-button:hover {
          transform: translateY(-1px);
          box-shadow: 0 14px 34px rgba(99,102,241,.24), 0 0 24px rgba(56,189,248,.08), inset 0 1px 0 rgba(255,255,255,.16);
        }

        .storeroom-dropzone {
          display: flex;
          align-items: center;
          gap: 14px;
          min-height: 82px;
          padding: 16px 18px;
          border: 1px dashed rgba(129,140,248,.20);
          border-radius: 18px;
          background: rgba(5,14,35,.28);
          box-shadow: inset 0 1px 0 rgba(255,255,255,.035);
          backdrop-filter: blur(12px);
          transition: border-color .25s ease, background .25s ease, transform .25s ease, box-shadow .25s ease;
        }
        .storeroom-dropzone:hover,
        .storeroom-dropzone.is-active {
          border-color: rgba(96,165,250,.48);
          background: rgba(30,41,80,.34);
          box-shadow: 0 0 35px rgba(59,130,246,.08), inset 0 1px 0 rgba(255,255,255,.06);
        }
        .storeroom-dropzone.is-active { transform: translateY(-1px) scale(1.005); }

        .storeroom-dropzone-icon,
        .storeroom-drop-overlay-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          width: 42px;
          height: 42px;
          border-radius: 13px;
          background: linear-gradient(135deg, rgba(56,189,248,.14), rgba(139,92,246,.18));
          border: 1px solid rgba(129,140,248,.22);
          color: #c4b5fd;
          box-shadow: 0 0 24px rgba(99,102,241,.10);
        }
        .storeroom-drop-overlay {
          position: fixed;
          inset: 0;
          z-index: 75;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          background: rgba(1,5,18,.42);
          backdrop-filter: blur(6px);
        }
        .storeroom-drop-overlay-card {
          width: min(460px, 100%);
          padding: 34px;
          text-align: center;
          border: 1px solid rgba(129,140,248,.28);
          border-radius: 26px;
          background: radial-gradient(circle at 50% 0%, rgba(59,130,246,.16), transparent 55%), rgba(8,16,40,.72);
          box-shadow: 0 30px 80px rgba(0,0,0,.42), 0 0 70px rgba(99,102,241,.10);
          backdrop-filter: blur(22px);
          animation: storeroom-drop-pop .25s ease-out both;
        }
        .storeroom-drop-overlay-icon { width: 64px; height: 64px; margin: 0 auto 16px; font-size: 26px; }
        @keyframes storeroom-drop-pop {
          from { opacity: 0; transform: scale(.96) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }

        .storeroom-upload-panel {
          border: 1px solid rgba(129,140,248,.24);
          background: radial-gradient(circle at 15% 0%, rgba(56,189,248,.10), transparent 45%), rgba(5,12,31,.78);
          box-shadow: 0 26px 70px rgba(0,0,0,.40), 0 0 40px rgba(99,102,241,.08);
          backdrop-filter: blur(22px);
          animation: storeroom-panel-in .3s ease-out both;
        }
        @keyframes storeroom-panel-in {
          from { opacity: 0; transform: translateY(12px) scale(.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .storeroom-search-input {
          border-color: rgba(129,140,248,.18) !important;
          background: rgba(4,12,30,.34) !important;
          color: #eef4ff !important;
          box-shadow: inset 0 1px 0 rgba(255,255,255,.025);
          backdrop-filter: blur(12px);
        }
        .storeroom-search-input:focus {
          border-color: rgba(96,165,250,.50) !important;
          box-shadow: 0 0 0 3px rgba(59,130,246,.08), 0 0 28px rgba(99,102,241,.07);
        }

        .storeroom-profile-button {
          border: 1px solid rgba(129,140,248,.28) !important;
          background: linear-gradient(135deg, rgba(17,31,62,.72), rgba(28,22,64,.72)) !important;
          color: #f4f7ff !important;
          box-shadow: 0 8px 26px rgba(0,0,0,.18), inset 0 1px 0 rgba(255,255,255,.05);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
        }
        .storeroom-dashboard header .storeroom-profile-button {
          border: 1px solid rgba(129,140,248,.34) !important;
          background: linear-gradient(135deg, rgba(17,31,62,.82), rgba(28,22,64,.82)) !important;
          color: #f4f7ff !important;
        }
        .storeroom-dashboard header .storeroom-profile-button:hover {
          border-color: rgba(129,140,248,.58) !important;
          background: linear-gradient(135deg, rgba(24,43,80,.90), rgba(40,30,84,.90)) !important;
          box-shadow: 0 10px 30px rgba(0,0,0,.22), 0 0 24px rgba(99,102,241,.10);
        }
        .storeroom-dashboard header .storeroom-profile-button span {
          color: #f4f7ff !important;
          opacity: 1 !important;
        }
        .storeroom-dashboard header .storeroom-profile-button span span:first-child {
          color: #ffffff !important;
          text-shadow: 0 0 10px rgba(255,255,255,.10);
        }
        .storeroom-dashboard header .storeroom-profile-button span span:nth-child(2) {
          color: #b9c9e5 !important;
        }
        .storeroom-dashboard header .storeroom-profile-button > span:last-child {
          color: #aebfe0 !important;
        }
        .storeroom-profile-button:hover { background: rgba(255,255,255,.05); }
        .storeroom-avatar {
          display: flex; width: 38px; height: 38px; align-items: center; justify-content: center;
          border: 1px solid rgba(129,140,248,.35); border-radius: 13px;
          background: linear-gradient(135deg, rgba(56,189,248,.22), rgba(139,92,246,.30));
          color: #eef4ff; font-size: 13px; font-weight: 800;
          box-shadow: 0 0 22px rgba(99,102,241,.13);
        }
        .storeroom-profile-menu {
          position: absolute !important;
          right: 0 !important;
          top: 3.5rem !important;
          width: min(18rem, calc(100vw - 1.5rem)) !important;
          max-width: calc(100vw - 1.5rem) !important;
          border: 1px solid rgba(129,140,248,.30) !important;
          background:
            linear-gradient(135deg, rgba(10,20,42,.97), rgba(18,15,48,.97)) !important;
          color: #f4f7ff !important;
          box-shadow:
            0 24px 60px rgba(0,0,0,.55),
            0 0 35px rgba(99,102,241,.12);
          backdrop-filter: blur(22px);
          -webkit-backdrop-filter: blur(22px);
          animation: storeroom-menu-in .18s ease-out both;
        }

        /* Final profile-menu overrides: these intentionally come after
           the broad dashboard/header text and button theme rules. */
        .storeroom-profile-backdrop {
          background: transparent !important;
          border: 0 !important;
          box-shadow: none !important;
        }

        /* Profile menu: high-specificity rules intentionally override the
           dashboard/header theme so every menu label remains readable. */
        .storeroom-dashboard header .storeroom-profile-menu p.storeroom-profile-menu-label {
          color: #b8c7e3 !important;
          opacity: 1 !important;
        }

        .storeroom-dashboard header .storeroom-profile-menu p.storeroom-profile-menu-name {
          color: #ffffff !important;
          opacity: 1 !important;
          text-shadow: 0 0 10px rgba(255,255,255,.08);
        }

        .storeroom-dashboard header .storeroom-profile-menu p.storeroom-profile-menu-email {
          color: #c4d2ea !important;
          opacity: 1 !important;
        }

        .storeroom-dashboard header .storeroom-profile-menu .storeroom-profile-logout {
          border: 1px solid rgba(248,113,113,.18) !important;
          background: rgba(127,29,29,.20) !important;
          color: #ffb4b4 !important;
          box-shadow: none !important;
        }

        .storeroom-dashboard header .storeroom-profile-menu .storeroom-profile-logout:hover {
          background: rgba(239,68,68,.22) !important;
          color: #ffffff !important;
          border-color: rgba(248,113,113,.35) !important;
          box-shadow: 0 0 18px rgba(239,68,68,.10) !important;
        }

        .storeroom-dashboard header .storeroom-profile-menu .storeroom-profile-logout span {
          color: inherit !important;
        }
        @keyframes storeroom-menu-in {
          from { opacity: 0; transform: translateY(-4px) scale(.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .storeroom-storage-card {
          border-color: rgba(129,140,248,.18) !important;
          background: radial-gradient(circle at 15% 0%, rgba(56,189,248,.07), transparent 45%), rgba(4,12,30,.40) !important;
          box-shadow: inset 0 1px 0 rgba(255,255,255,.035), 0 18px 45px rgba(0,0,0,.12) !important;
          backdrop-filter: blur(14px);
        }
        .storeroom-storage-track { background: rgba(255,255,255,.06) !important; }
        .storeroom-storage-bar {
          position: relative; overflow: hidden;
          background: linear-gradient(90deg, #22d3ee, #6366f1, #a855f7) !important;
          box-shadow: 0 0 18px rgba(99,102,241,.24);
        }
        .storeroom-storage-bar::after {
          content: ""; position: absolute; inset: 0; width: 35%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,.26), transparent);
          animation: storeroom-storage-shimmer 2.8s ease-in-out infinite;
        }
        @keyframes storeroom-storage-shimmer {
          from { transform: translateX(-130%); }
          to { transform: translateX(320%); }
        }

        .storeroom-toast {
          border: 1px solid rgba(129,140,248,.18);
          background: rgba(5,12,31,.70);
          color: #e8f0ff;
          box-shadow: 0 14px 35px rgba(0,0,0,.20);
          backdrop-filter: blur(16px);
          animation: storeroom-toast-in .28s ease-out both;
        }
        .storeroom-toast-success { border-color: rgba(52,211,153,.20); }
        .storeroom-toast-error { border-color: rgba(248,113,113,.24); color: #fecaca; }
        @keyframes storeroom-toast-in {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .storeroom-dashboard header {
          border-color: rgba(129,140,248,.14) !important;
          background: rgba(3,9,24,.52) !important;
          backdrop-filter: blur(16px);
        }
        .storeroom-dashboard .bg-white {
          background-color: rgba(4,12,30,.42) !important;
          border-color: rgba(129,140,248,.15) !important;
        }
        .storeroom-dashboard .bg-slate-50 { background-color: rgba(5,14,35,.32) !important; }
        .storeroom-dashboard .bg-slate-100 { background-color: rgba(30,41,59,.28) !important; }
        .storeroom-dashboard .border-slate-200,
        .storeroom-dashboard .border-slate-300 { border-color: rgba(129,140,248,.15) !important; }
        .storeroom-dashboard .text-slate-900 { color: #eef4ff !important; }
        .storeroom-dashboard .text-slate-700 { color: #dbe7ff !important; }
        .storeroom-dashboard .text-slate-600 { color: #b7c5dc !important; }
        .storeroom-dashboard .text-slate-500 { color: #8fa2c1 !important; }
        .storeroom-dashboard .hover\\:bg-slate-50:hover,
        .storeroom-dashboard .hover\\:bg-slate-100:hover { background-color: rgba(99,102,241,.09) !important; }

        .storeroom-dashboard button,
        .storeroom-dashboard label,
        .storeroom-dashboard input,
        .storeroom-dashboard select {
          -webkit-tap-highlight-color: transparent;
        }
        .storeroom-dashboard button {
          transition-property: transform, background-color, border-color, box-shadow, color, opacity;
          transition-duration: .2s;
        }
        .storeroom-dashboard button:active:not(:disabled) { transform: scale(.98); }

        @media (prefers-reduced-motion: reduce) {
          .storeroom-upload-button,
          .storeroom-dropzone,
          .storeroom-upload-panel,
          .storeroom-profile-menu,
          .storeroom-toast,
          .storeroom-storage-bar::after {
            animation: none !important;
            transition: none !important;
          }
        }

        @media (max-width: 640px) {
          .storeroom-folder-row,
          .storeroom-file-row {
            min-height: 78px;
          }

          .storeroom-folder-card,
          .storeroom-file-card {
            box-shadow: inset 0 1px 0 rgba(255,255,255,.025);
          }

          .file-type-glyph-label {
            font-size: 7px;
            right: 5px;
            bottom: 5px;
          }
        }

      `}</style>
    </main>
  );
}