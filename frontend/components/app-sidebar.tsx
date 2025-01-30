"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";
import { useAuth } from "@clerk/nextjs";
import { debounce } from "lodash";
import { cn } from "@/lib/utils";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { ThreadList } from "./chat/thread-list";
import { useFoldersStore, useThreadsStore } from "@/lib/store";
import { Thread } from "@/lib/types";
import { Button } from "./ui/button";
import { FolderPlus, PlusIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Input } from "./ui/input";
import { useState } from "react";

const NewChatButton = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<typeof Button>
>((props, ref) => (
  <Button {...props} ref={ref}>
    {props.children}
  </Button>
));
NewChatButton.displayName = "NewChatButton";

const DialogTriggerButton = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<typeof Button>
>((props, ref) => (
  <Button {...props} ref={ref}>
    {props.children}
  </Button>
));
DialogTriggerButton.displayName = "DialogTriggerButton";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { userId } = useAuth();
  const {
    threads,
    isLoading: isLoadingThreads,
    fetchThreads,
    createThread,
    updateThread,
    deleteThread,
  } = useThreadsStore();
  const {
    folders,
    isLoading: isLoadingFolders,
    createFolder,
    fetchFolders,
  } = useFoldersStore();
  const currentThreadId = searchParams.get("thread") || undefined;
  const [isNewFolderDialogOpen, setIsNewFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [isCreatingThread, setIsCreatingThread] = useState(false);

  // Debounced fetch functions for subsequent updates
  const debouncedFetch = useMemo(
    () =>
      debounce(() => {
        fetchThreads();
        fetchFolders();
      }, 1000),
    [fetchThreads, fetchFolders]
  );

  // Immediate fetch on mount, debounced for updates
  useEffect(() => {
    if (userId) {
      // Immediate fetch on mount
      const initialFetch = async () => {
        try {
          await Promise.all([fetchThreads(), fetchFolders()]);
        } catch (error) {
          console.error("Error fetching initial data:", error);
        }
      };
      initialFetch();

      // Setup debounced fetch for subsequent updates
      const cleanup = () => {
        debouncedFetch.cancel();
      };

      return cleanup;
    }
  }, [userId, fetchThreads, fetchFolders, debouncedFetch]);

  const handleNewThread = async () => {
    if (!userId || isCreatingThread) return;

    try {
      setIsCreatingThread(true);

      // Create optimistic thread
      const tempId = `temp-${Date.now()}`;
      const optimisticThread: Thread = {
        id: tempId,
        user_id: userId,
        title: "New Thread",
        label: null,
        folder_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Update UI optimistically
      useThreadsStore.setState((state) => ({
        threads: [optimisticThread, ...state.threads],
      }));

      // Create the actual thread
      const thread = await createThread();

      // Update URL without a full navigation
      router.replace(`/dashboard/chat?thread=${thread.id}`, {
        scroll: false,
      });

      // Remove optimistic thread and add real thread
      useThreadsStore.setState((state) => ({
        threads: state.threads
          .filter((t) => t.id !== tempId)
          .map((t) => (t.id === thread.id ? thread : t)),
      }));
    } catch (error) {
      console.error("Failed to create thread:", error);
      // Remove optimistic thread on error
      useThreadsStore.setState((state) => ({
        threads: state.threads.filter((t) => t.id !== `temp-${Date.now()}`),
      }));
    } finally {
      setIsCreatingThread(false);
    }
  };

  const handleSelectThread = (threadId: string) => {
    // Update the URL without a full navigation
    router.replace(`/dashboard/chat?thread=${threadId}`, {
      scroll: false,
    });
  };

  const handleDeleteThread = async (threadId: string) => {
    try {
      // Delete the thread first
      await deleteThread(threadId);

      // If the deleted thread was selected, redirect to chat home and wait for navigation
      if (currentThreadId === threadId) {
        await router.push("/dashboard/chat");
      }
    } catch (error) {
      console.error("Error deleting thread:", error);
    }
  };

  const handleRenameThread = async (threadId: string, newTitle: string) => {
    try {
      await updateThread(threadId, { title: newTitle });
    } catch (error) {
      console.error("Error renaming thread:", error);
    }
  };

  const handleCreateFolder = async () => {
    if (!userId || !newFolderName.trim()) return;

    try {
      await createFolder({
        name: newFolderName.trim(),
      });
      setNewFolderName("");
      setIsNewFolderDialogOpen(false);
    } catch (error) {
      console.error("Error creating folder:", error);
    }
  };

  // Memoize organized threads calculation
  const organizedThreads = useMemo(() => {
    if (isLoadingThreads || isLoadingFolders)
      return { unfoldered: [], foldered: new Map() };

    // Sort threads by updated_at date
    const sortedThreads = [...threads].sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );

    // Initialize foldered with empty arrays for all folders
    const foldered = new Map<string, Thread[]>();
    folders.forEach((folder) => {
      foldered.set(folder.id, []);
    });

    // First pass: organize threads into folders
    sortedThreads.forEach((thread) => {
      if (thread.folder_id) {
        const folderThreads = foldered.get(thread.folder_id);
        if (folderThreads) {
          folderThreads.push(thread);
        }
      }
    });

    // Get unfoldered threads
    const unfoldered = sortedThreads.filter((t) => !t.folder_id);

    return {
      unfoldered,
      foldered,
    };
  }, [threads, folders, isLoadingThreads, isLoadingFolders]);

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <div className="flex items-center justify-between px-.5 py-1">
          <h1 className="text-xl font-bold">elucide</h1>
          <div className="flex items-center gap-1">
            <TooltipProvider>
              <Dialog
                open={isNewFolderDialogOpen}
                onOpenChange={setIsNewFolderDialogOpen}
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DialogTrigger asChild>
                      <DialogTriggerButton
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                      >
                        <FolderPlus className="h-4 w-4" />
                      </DialogTriggerButton>
                    </DialogTrigger>
                  </TooltipTrigger>
                  <TooltipContent>New folder</TooltipContent>
                </Tooltip>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create new folder</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="flex items-center gap-4">
                      <Input
                        placeholder="Folder name"
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleCreateFolder();
                          }
                        }}
                      />
                      <Button onClick={handleCreateFolder}>Create</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              <Tooltip>
                <TooltipTrigger asChild>
                  <NewChatButton
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={handleNewThread}
                    disabled={isCreatingThread}
                  >
                    <PlusIcon
                      className={cn(
                        "h-4 w-4",
                        isCreatingThread && "animate-spin"
                      )}
                    />
                  </NewChatButton>
                </TooltipTrigger>
                <TooltipContent>New chat</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <ThreadList
              threads={organizedThreads.unfoldered}
              folders={folders}
              folderedThreads={organizedThreads.foldered}
              currentThreadId={currentThreadId}
              onSelectThread={handleSelectThread}
              onDeleteThread={handleDeleteThread}
              onRenameThread={handleRenameThread}
              isLoading={isLoadingThreads || isLoadingFolders}
            />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
