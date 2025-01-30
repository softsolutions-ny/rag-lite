import * as React from "react";
import { Button } from "@/components/ui/button";
import {
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
import { useState, useEffect, useCallback, memo } from "react";
import { Thread, Folder } from "@/lib/types";
import { useFoldersStore, useThreadsStore } from "@/lib/store";
import { MessageCache } from "@/lib/services/cache";
import { Skeleton } from "@/components/ui/skeleton";
import * as messageActions from "@/lib/actions/message";

interface ThreadListProps {
  threads: Thread[];
  folders: Folder[];
  folderedThreads: Map<string, Thread[]>;
  currentThreadId?: string;
  onSelectThread: (threadId: string) => void;
  onDeleteThread?: (threadId: string) => void;
  onRenameThread?: (threadId: string, newTitle: string) => void;
  isLoading?: boolean;
}

// Memoize the thread item component
const ThreadItem = memo(
  ({
    thread,
    isInFolder,
    currentThreadId,
    onSelect,
    onDelete,
    onRename,
    onMoveToFolder,
  }: {
    thread: Thread;
    isInFolder: boolean;
    currentThreadId?: string;
    onSelect: (threadId: string) => void;
    onDelete?: (threadId: string) => void;
    onRename?: (threadId: string, newTitle: string) => void;
    onMoveToFolder: (threadId: string, folderId: string | undefined) => void;
  }) => {
    const [editingTitle, setEditingTitle] = useState("");
    const [isEditing, setIsEditing] = useState(false);

    // Preload messages on hover
    const handleMouseEnter = useCallback(async () => {
      // Skip if this is the current thread or messages are already cached
      if (
        currentThreadId === thread.id ||
        MessageCache.getCachedMessages(thread.id)
      ) {
        return;
      }

      try {
        const messages = await messageActions.fetchMessages(thread.id);
        MessageCache.cacheMessages(thread.id, messages);
      } catch (error) {
        console.error("Error preloading messages:", error);
      }
    }, [thread.id, currentThreadId]);

    return (
      <div
        key={thread.id}
        className="flex items-center min-w-0"
        onMouseEnter={handleMouseEnter}
      >
        {isEditing ? (
          <div className="flex-1 px-1">
            <Input
              autoFocus
              value={editingTitle}
              onChange={(e) => setEditingTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  onRename?.(thread.id, editingTitle.trim());
                  setIsEditing(false);
                } else if (e.key === "Escape") {
                  setIsEditing(false);
                }
              }}
              onBlur={() => {
                if (editingTitle.trim()) {
                  onRename?.(thread.id, editingTitle.trim());
                }
                setIsEditing(false);
              }}
              className="h-7"
            />
          </div>
        ) : (
          <Button
            variant="ghost"
            className={cn(
              "flex items-center gap-1.5 flex-1 min-w-0 justify-start text-left h-8",
              currentThreadId === thread.id && "bg-muted hover:bg-muted",
              isInFolder ? "pl-8" : "pl-2"
            )}
            onClick={() => onSelect(thread.id)}
          >
            <div className="flex items-center min-w-0 flex-1">
              <span className="truncate text-sm leading-none">
                {thread.title || thread.id}
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
            <DropdownMenuItem
              onSelect={() => {
                setEditingTitle(thread.title || "");
                setIsEditing(true);
              }}
            >
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
                  onSelect={() => onMoveToFolder(thread.id, undefined)}
                >
                  <FolderInput className="h-3.5 w-3.5 mr-2" />
                  Remove from folder
                </DropdownMenuItem>
                {/* Folder items rendered by parent component */}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={() => onDelete?.(thread.id)}
            >
              Delete thread
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }
);
ThreadItem.displayName = "ThreadItem";

export function ThreadList({
  threads,
  folders,
  folderedThreads,
  currentThreadId,
  onSelectThread,
  onDeleteThread,
  onRenameThread,
  isLoading = false,
}: ThreadListProps) {
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editFolderName, setEditFolderName] = useState("");
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set()
  );
  const { moveThreadToFolder, fetchThreads } = useThreadsStore();
  const { deleteFolder, updateFolder } = useFoldersStore();

  // Auto-expand folder containing current thread
  useEffect(() => {
    if (currentThreadId) {
      // Find which folder contains the current thread
      folders.forEach((folder) => {
        const folderThreads = folderedThreads.get(folder.id) || [];
        if (folderThreads.some((thread) => thread.id === currentThreadId)) {
          setExpandedFolders(
            (prev) => new Set(Array.from(prev).concat([folder.id]))
          );
        }
      });
    }
  }, [currentThreadId, folders, folderedThreads]);

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

  const handleMoveToFolder = async (
    threadId: string,
    folderId: string | undefined
  ) => {
    try {
      await moveThreadToFolder(threadId, folderId);
      // Refresh threads to ensure UI is in sync
      await fetchThreads();
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

  // Update the renderThread function to use the memoized component
  const renderThread = (
    thread: Thread,
    isInFolder: boolean = false,
    currentThreadId?: string,
    onSelectThread?: (threadId: string) => void,
    onDeleteThread?: (threadId: string) => void,
    onRenameThread?: (threadId: string, newTitle: string) => void,
    onMoveToFolder?: (threadId: string, folderId: string | undefined) => void
  ) => (
    <ThreadItem
      key={thread.id}
      thread={thread}
      isInFolder={isInFolder}
      currentThreadId={currentThreadId}
      onSelect={onSelectThread!}
      onDelete={onDeleteThread}
      onRename={onRenameThread}
      onMoveToFolder={onMoveToFolder!}
    />
  );

  if (isLoading) {
    return (
      <div className="flex flex-col gap-1 p-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-2">
            <Skeleton className="h-8 flex-1" />
            <Skeleton className="h-8 w-8" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 p-2">
      {/* Empty state when no threads or folders exist */}
      {threads.length === 0 && folders.length === 0 && (
        <div className="px-2 py-3 text-sm text-muted-foreground">
          Click the + button above to start a new conversation.
        </div>
      )}
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
                  {folderThreads.map((thread) =>
                    renderThread(
                      thread,
                      true,
                      currentThreadId,
                      onSelectThread,
                      onDeleteThread,
                      onRenameThread,
                      handleMoveToFolder
                    )
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Render unfoldered threads */}
        {threads.length > 0 && (
          <div className="space-y-1">
            {threads.map((thread) =>
              renderThread(
                thread,
                false,
                currentThreadId,
                onSelectThread,
                onDeleteThread,
                onRenameThread,
                handleMoveToFolder
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
