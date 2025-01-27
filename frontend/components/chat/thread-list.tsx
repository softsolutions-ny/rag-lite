import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  PlusIcon,
  Loader2,
  MoreHorizontal,
  Pencil,
  FolderIcon,
  FolderInput,
  ChevronRight,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useState, useRef } from "react";
import { Thread, Folder } from "@/lib/types";
import { useFoldersStore, useThreadsStore } from "@/lib/store";
import { useAuth } from "@clerk/nextjs";

interface ThreadListProps {
  threads: Thread[];
  folders: Folder[];
  folderedThreads: Map<string, Thread[]>;
  currentThreadId?: string;
  onNewThread: () => void;
  onSelectThread: (threadId: string) => void;
  onDeleteThread?: (threadId: string) => void;
  onRenameThread?: (threadId: string, newTitle: string) => void;
  isLoading?: boolean;
}

export function ThreadList({
  threads,
  folders,
  folderedThreads,
  currentThreadId,
  onNewThread,
  onSelectThread,
  onDeleteThread,
  onRenameThread,
  isLoading = false,
}: ThreadListProps) {
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editFolderName, setEditFolderName] = useState("");
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set()
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const { userId } = useAuth();
  const { moveThreadToFolder, fetchThreads } = useThreadsStore();
  const { deleteFolder, updateFolder } = useFoldersStore();

  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "numeric",
      day: "numeric",
      year: "2-digit",
    });
  };

  const formatTitle = (thread: Thread) => {
    return thread.title || thread.id;
  };

  const handleStartRename = (thread: Thread) => {
    setEditingThreadId(thread.id);
    setEditTitle(thread.title || "");
  };

  const handleRenameSubmit = async (threadId: string) => {
    if (onRenameThread && editTitle.trim()) {
      await onRenameThread(threadId, editTitle.trim());
    }
    setEditingThreadId(null);
    setEditTitle("");
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent, threadId: string) => {
    if (e.key === "Enter") {
      handleRenameSubmit(threadId);
    } else if (e.key === "Escape") {
      setEditingThreadId(null);
      setEditTitle("");
    }
  };

  const handleMoveToFolder = async (
    threadId: string,
    folderId: string | undefined
  ) => {
    try {
      await moveThreadToFolder(threadId, folderId);
      // Refresh threads to ensure UI is in sync
      if (userId) {
        await fetchThreads(userId);
      }
    } catch (error) {
      console.error("Error moving thread to folder:", error);
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    try {
      await deleteFolder(folderId);
    } catch (error) {
      console.error("Error deleting folder:", error);
    }
  };

  const handleStartRenameFolder = (folder: Folder) => {
    setEditingFolderId(folder.id);
    setEditFolderName(folder.name);
  };

  const handleRenameFolderSubmit = async (folderId: string) => {
    if (editFolderName.trim()) {
      try {
        await updateFolder(folderId, { name: editFolderName.trim() });
      } catch (error) {
        console.error("Error renaming folder:", error);
      }
    }
    setEditingFolderId(null);
    setEditFolderName("");
  };

  const handleRenameFolderKeyDown = (
    e: React.KeyboardEvent,
    folderId: string
  ) => {
    if (e.key === "Enter") {
      handleRenameFolderSubmit(folderId);
    } else if (e.key === "Escape") {
      setEditingFolderId(null);
      setEditFolderName("");
    }
  };

  const renderThread = (thread: Thread, isInFolder: boolean = false) => (
    <div key={thread.id} className="flex items-center min-w-0">
      {editingThreadId === thread.id ? (
        <div className="flex-1 px-1">
          <Input
            autoFocus
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onKeyDown={(e) => handleRenameKeyDown(e, thread.id)}
            onBlur={() => handleRenameSubmit(thread.id)}
            className="h-7"
          />
        </div>
      ) : (
        <Button
          variant="ghost"
          className={cn(
            "flex items-center gap-1.5 flex-1 min-w-0 justify-start text-left h-8",
            currentThreadId === thread.id && "bg-muted",
            isInFolder ? "pl-8" : "pl-2"
          )}
          onClick={() => onSelectThread(thread.id)}
        >
          <div className="flex items-center min-w-0 flex-1">
            <span className="truncate text-sm leading-none">
              {formatTitle(thread)}
            </span>
          </div>
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="h-7 w-7 p-0 hover:bg-muted focus-visible:ring-0 focus-visible:ring-offset-0 shrink-0 ml-1"
          >
            <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[160px]">
          <DropdownMenuItem onSelect={() => handleStartRename(thread)}>
            <Pencil className="h-3.5 w-3.5 mr-2" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <FolderIcon className="h-3.5 w-3.5 mr-2" />
              Move to folder
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem
                onSelect={() => handleMoveToFolder(thread.id, undefined)}
              >
                <FolderInput className="h-3.5 w-3.5 mr-2" />
                Remove from folder
              </DropdownMenuItem>
              {folders.map((folder) => (
                <DropdownMenuItem
                  key={folder.id}
                  onSelect={() => handleMoveToFolder(thread.id, folder.id)}
                >
                  <FolderIcon className="h-3.5 w-3.5 mr-2" />
                  {folder.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={() => onDeleteThread?.(thread.id)}
          >
            Delete thread
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-4">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-col gap-1">
        {/* Render folders first */}
        {folders.map((folder) => {
          const folderThreads = folderedThreads.get(folder.id) || [];
          const isExpanded = expandedFolders.has(folder.id);

          return (
            <div key={folder.id}>
              <div className="flex items-center">
                {editingFolderId === folder.id ? (
                  <div className="flex-1 px-1">
                    <Input
                      autoFocus
                      value={editFolderName}
                      onChange={(e) => setEditFolderName(e.target.value)}
                      onKeyDown={(e) => handleRenameFolderKeyDown(e, folder.id)}
                      onBlur={() => handleRenameFolderSubmit(folder.id)}
                      className="h-7"
                    />
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    className="flex items-center gap-1.5 flex-1 justify-start hover:bg-muted px-2 h-8 group"
                    onClick={() => toggleFolder(folder.id)}
                  >
                    <ChevronRight
                      className={cn(
                        "h-3.5 w-3.5 shrink-0 transition-transform",
                        isExpanded && "rotate-90"
                      )}
                    />
                    <FolderIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-foreground" />
                    <span className="text-sm">{folder.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {folderThreads.length}
                    </span>
                  </Button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="h-7 w-7 p-0 hover:bg-muted focus-visible:ring-0 focus-visible:ring-offset-0 shrink-0"
                    >
                      <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="sr-only">Folder menu</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-[160px]">
                    <DropdownMenuItem
                      onSelect={() => handleStartRenameFolder(folder)}
                    >
                      <Pencil className="h-3.5 w-3.5 mr-2" />
                      Rename folder
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onSelect={() => handleDeleteFolder(folder.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-2" />
                      Delete folder
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              {isExpanded && (
                <div className="pl-4 space-y-1">
                  {folderThreads.map((thread) => renderThread(thread, true))}
                </div>
              )}
            </div>
          );
        })}

        {/* Render unfoldered threads */}
        {threads.length > 0 && (
          <div className="space-y-1">
            {threads.map((thread) => renderThread(thread, false))}
          </div>
        )}
      </div>
    </div>
  );
}
