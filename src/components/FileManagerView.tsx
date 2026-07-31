import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { FileItem, SSHConfig } from "../types";
import { INITIAL_FILES, execCommand } from "../services/api";
import { useToast } from "../contexts/ToastContext";
import {
  Folder,
  FileText,
  FileCode,
  FolderPlus,
  FilePlus,
  Trash2,
  Edit,
  Download,
  Lock,
  ChevronRight,
  ArrowLeft,
  Search,
  Check,
  X,
  RefreshCw,
} from "lucide-react";

interface FileManagerViewProps {
  server: SSHConfig;
}

export const FileManagerView: React.FC<FileManagerViewProps> = ({ server }) => {
  const toast = useToast();
  const [currentPath, setCurrentPath] = useState<string>("/var/www/app");
  const [files, setFiles] = useState<FileItem[]>(INITIAL_FILES);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);

  // File Editor Modal state
  const [editingFile, setEditingFile] = useState<FileItem | null>(null);
  const [fileContent, setFileContent] = useState("");
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Chmod Permissions Modal state
  const [permissionFile, setPermissionFile] = useState<FileItem | null>(null);
  const [newMode, setNewMode] = useState("755");

  // New File/Folder state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [isFolder, setIsFolder] = useState(false);

  const fetchDirectoryFiles = async (dirPath: string) => {
    setIsLoading(true);
    try {
      const res = await execCommand(server, `ls -la --time-style=long-iso "${dirPath}" || ls -la "${dirPath}"`);
      if (res && res.stdout) {
        const lines = res.stdout.split("\n").map((l) => l.trim()).filter(Boolean);
        const parsed: FileItem[] = [];

        for (const line of lines) {
          if (line.startsWith("total")) continue;
          // Standard ls -la format: permissions links owner group size date time name
          const parts = line.split(/\s+/);
          if (parts.length >= 8) {
            const permissions = parts[0];
            const owner = parts[2];
            const group = parts[3];
            const sizeRaw = parseInt(parts[4], 10);
            const isDir = permissions.startsWith("d");

            // Name could have spaces or be at the end
            let dateStr = "";
            let name = "";
            if (parts.length >= 9 && parts[5].match(/^\d{4}-\d{2}-\d{2}$/)) {
              dateStr = `${parts[5]} ${parts[6]}`;
              name = parts.slice(7).join(" ");
            } else {
              dateStr = `${parts[5]} ${parts[6]} ${parts[7]}`;
              name = parts.slice(8).join(" ");
            }

            if (!name || name === "." || name === "..") continue;

            const formatSize = (bytes: number) => {
              if (isNaN(bytes)) return parts[4] || "0 B";
              if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
              if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
              if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
              return `${bytes} B`;
            };

            const fullPath = dirPath.endsWith("/") ? `${dirPath}${name}` : `${dirPath}/${name}`;
            const ext = isDir ? undefined : name.split(".").slice(1).pop();

            parsed.push({
              name,
              path: fullPath,
              isDir,
              size: isDir ? "4.0 KB" : formatSize(sizeRaw),
              permissions,
              owner,
              group,
              modified: dateStr,
              extension: ext,
            });
          }
        }
        if (parsed.length > 0) {
          setFiles(parsed);
        }
      }
    } catch (e) {
      console.error("Failed to fetch directory files:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDirectoryFiles(currentPath);
  }, [currentPath, server.id, server.host]);

  // Filter files by search
  const filteredFiles = files.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleOpenFile = async (file: FileItem) => {
    if (file.isDir) {
      setCurrentPath(file.path);
    } else {
      // Open text/code editor with real cat
      setEditingFile(file);
      setIsLoadingContent(true);
      setFileContent("");
      try {
        const res = await execCommand(server, `cat "${file.path}"`);
        setFileContent(res && res.stdout !== undefined ? res.stdout : `# Failed to load content of ${file.path}`);
      } catch (e) {
        setFileContent(`# Error loading file content.`);
      } finally {
        setIsLoadingContent(false);
      }
    }
  };

  const handleSaveFile = async () => {
    setIsSaving(true);
    await execCommand(server, `cat << 'EOF' > ${editingFile?.path}\n${fileContent}\nEOF`);
    setTimeout(() => {
      setIsSaving(false);
      setEditingFile(null);
      toast.success("Файл сохранён", `${editingFile?.name} успешно сохранён через SSH`);
    }, 400);
  };

  const handleDeleteFile = async (file: FileItem) => {
    if (confirm(`Are you sure you want to delete "${file.name}"?`)) {
      await execCommand(server, `rm -rf ${file.path}`);
      setFiles((prev) => prev.filter((f) => f.path !== file.path));
      if (selectedFile?.path === file.path) setSelectedFile(null);
    }
  };

  const handleCreateFileOrFolder = async () => {
    if (!newFileName.trim()) return;
    const newPath = `${currentPath}/${newFileName.trim()}`;
    if (isFolder) {
      await execCommand(server, `mkdir -p ${newPath}`);
    } else {
      await execCommand(server, `touch ${newPath}`);
    }

    const newItem: FileItem = {
      name: newFileName.trim(),
      path: newPath,
      isDir: isFolder,
      size: isFolder ? "4.0 KB" : "0 B",
      permissions: isFolder ? "drwxr-xr-x" : "-rw-r--r--",
      owner: server.username,
      group: server.username,
      modified: "Just now",
      extension: isFolder ? undefined : newFileName.split(".").pop(),
    };

    setFiles((prev) => [newItem, ...prev]);
    setShowCreateModal(false);
    setNewFileName("");
  };

  const handleApplyPermissions = async () => {
    if (!permissionFile) return;
    await execCommand(server, `chmod ${newMode} ${permissionFile.path}`);
    setFiles((prev) =>
      prev.map((f) => (f.path === permissionFile.path ? { ...f, permissions: newMode } : f))
    );
    setPermissionFile(null);
  };

  return (
    <div className="space-y-4 pb-20 lg:pb-8 animate-in fade-in duration-200">
      {/* Top Toolbar */}
      <div className="bg-[#0f0f0f] border border-[#1f1f1f] rounded-3xl p-5 shadow-2xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Folder className="w-5 h-5 text-violet-400" />
              Визуальный Файловый Менеджер
            </h2>
            <p className="text-xs text-gray-400">
              Просмотр, редактирование и управление файлами сервера по SSH
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => fetchDirectoryFiles(currentPath)}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 bg-[#171717] hover:bg-[#202020] text-violet-400 rounded-xl text-xs font-semibold border border-[#2d2d2d] transition disabled:opacity-50"
              title="Обновить содержимое директории"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
              <span>Обновить</span>
            </button>
            <button
              onClick={() => {
                setIsFolder(false);
                setShowCreateModal(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 bg-[#171717] hover:bg-[#202020] text-gray-300 rounded-xl text-xs font-semibold border border-[#2d2d2d] transition"
            >
              <FilePlus className="w-4 h-4 text-violet-400" />
              Новый Файл
            </button>
            <button
              onClick={() => {
                setIsFolder(true);
                setShowCreateModal(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 bg-[#171717] hover:bg-[#202020] text-gray-300 rounded-xl text-xs font-semibold border border-[#2d2d2d] transition"
            >
              <FolderPlus className="w-4 h-4 text-amber-400" />
              Новая Папка
            </button>
          </div>
        </div>

        {/* Breadcrumb Path Bar */}
        <div className="flex items-center gap-2 bg-[#171717] px-3 py-2 rounded-2xl border border-[#242424] text-xs text-gray-300 font-mono overflow-x-auto">
          <button
            onClick={() => {
              const parts = currentPath.split("/").filter(Boolean);
              parts.pop();
              setCurrentPath("/" + parts.join("/"));
            }}
            className="p-1 hover:text-violet-400 text-gray-400 transition"
            title="На уровень выше"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="text-gray-500">Путь:</span>
          <span className="text-violet-300 font-semibold truncate">{currentPath}</span>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-gray-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Поиск файлов или каталогов..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#171717] border border-[#242424] rounded-2xl pl-9 pr-4 py-2 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-violet-500 transition"
          />
        </div>
      </div>

      {/* Files Table / Grid */}
      <div className="bg-[#0f0f0f] border border-[#1f1f1f] rounded-3xl shadow-2xl p-4 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-300">
            <thead>
              <tr className="border-b border-[#242424] text-[10px] text-gray-500 uppercase font-bold tracking-widest bg-[#171717]">
                <th className="py-2.5 px-4">Имя</th>
                <th className="py-2.5 px-3">Размер</th>
                <th className="py-2.5 px-3">Права</th>
                <th className="py-2.5 px-3 hidden sm:table-cell">Владелец:Группа</th>
                <th className="py-2.5 px-3 text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#242424] font-mono text-[11px]">
              {filteredFiles.map((file, idx) => (
                <tr
                  key={idx}
                  onClick={() => setSelectedFile(file)}
                  className={`group hover:bg-[#171717] transition cursor-pointer ${
                    selectedFile?.path === file.path ? "bg-[#202020]" : ""
                  }`}
                >
                  <td className="py-3 px-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenFile(file);
                      }}
                      className="flex items-center gap-2.5 text-gray-200 hover:text-violet-400 text-left font-sans text-xs font-semibold"
                    >
                      {file.isDir ? (
                        <Folder className="w-4 h-4 text-violet-400 shrink-0" />
                      ) : file.extension === "conf" || file.extension === "yml" ? (
                        <FileCode className="w-4 h-4 text-amber-400 shrink-0" />
                      ) : (
                        <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                      )}
                      <span className="truncate max-w-[140px] sm:max-w-xs">{file.name}</span>
                    </button>
                  </td>
                  <td className="py-3 px-3 text-gray-500">{file.size}</td>
                  <td className="py-3 px-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPermissionFile(file);
                      }}
                      className="hover:text-violet-300 transition flex items-center gap-1 text-[10px] bg-[#171717] px-2 py-0.5 rounded-full border border-[#242424]"
                      title="Click to edit permissions (chmod)"
                    >
                      <Lock className="w-2.5 h-2.5 text-gray-500" />
                      {file.permissions}
                    </button>
                  </td>
                  <td className="py-3 px-3 text-gray-500 hidden sm:table-cell">
                    {file.owner}:{file.group}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {!file.isDir && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenFile(file);
                          }}
                          className="p-1.5 hover:bg-[#242424] rounded-lg text-violet-400 transition"
                          title="Edit File"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteFile(file);
                        }}
                        className="p-1.5 hover:bg-[#242424] rounded-lg text-rose-400 transition"
                        title="Delete File"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Code / Text File Editor Modal */}
      {editingFile && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-5">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl h-[85vh] shadow-2xl flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCode className="w-5 h-5 text-fuchsia-400" />
                <div>
                  <h3 className="font-bold text-sm text-white">{editingFile.name}</h3>
                  <p className="text-[10px] text-slate-400 font-mono">{editingFile.path}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleSaveFile}
                  disabled={isSaving}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-semibold text-xs rounded-xl shadow transition"
                >
                  <Check className="w-3.5 h-3.5" />
                  {isSaving ? "Сохранение..." : "Сохранить по SSH"}
                </button>
                <button
                  onClick={() => setEditingFile(null)}
                  className="p-1 text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Code Editor Body */}
            <div className="flex-1 bg-slate-950 p-4 font-mono text-xs text-slate-200 overflow-y-auto relative">
              {isLoadingContent ? (
                <div className="flex items-center justify-center h-full text-violet-400 gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Загрузка содержимого файла по SSH...</span>
                </div>
              ) : (
                <textarea
                  value={fileContent}
                  onChange={(e) => setFileContent(e.target.value)}
                  className="w-full h-full bg-transparent text-violet-400 font-mono focus:outline-none resize-none leading-relaxed"
                  spellCheck={false}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Permissions Editor Modal (chmod) */}
      {permissionFile &&
        createPortal(
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[100] flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm p-4 sm:p-5 space-y-4 shadow-2xl my-auto max-h-[85vh] overflow-y-auto scrollbar-thin">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Lock className="w-4 h-4 text-fuchsia-400" />
                Права Chmod: {permissionFile.name}
              </h3>

              <div className="space-y-2">
                <label className="text-xs text-slate-400">Восьмеричный режим (например: 755, 644, 777)</label>
                <input
                  type="text"
                  value={newMode}
                  onChange={(e) => setNewMode(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-fuchsia-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  onClick={() => setPermissionFile(null)}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs transition"
                >
                  Отмена
                </button>
                <button
                  onClick={handleApplyPermissions}
                  className="px-4 py-2 bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded-xl text-xs font-semibold transition"
                >
                  Применить Chmod
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* New File / Folder Modal */}
      {showCreateModal &&
        createPortal(
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[100] flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm p-4 sm:p-5 space-y-4 shadow-2xl my-auto max-h-[85vh] overflow-y-auto scrollbar-thin">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                {isFolder ? <FolderPlus className="w-4 h-4 text-violet-400" /> : <FilePlus className="w-4 h-4 text-fuchsia-400" />}
                {isFolder ? "Создать папку" : "Создать файл"}
              </h3>

              <div className="space-y-2">
                <label className="text-xs text-slate-400">Имя</label>
                <input
                  type="text"
                  placeholder={isFolder ? "my-new-folder" : "config.json"}
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-fuchsia-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs transition"
                >
                  Отмена
                </button>
                <button
                  onClick={handleCreateFileOrFolder}
                  className="px-4 py-2 bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded-xl text-xs font-semibold transition"
                >
                  Создать
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
