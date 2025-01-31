"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";
import { useAuth } from "@clerk/nextjs";
import { debounce } from "lodash";
import Image from "next/image";
import Link from "next/link";

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

  // Memoize organized threads calculation
  const organizedThreads = useMemo(() => {
    // Don't show loading state for subsequent updates
    if (isLoadingThreads && threads.length > 0) {
      return {
        unfoldered: threads.filter((t) => !t.folder_id),
        foldered: new Map(
          folders.map((f) => [
            f.id,
            threads.filter((t) => t.folder_id === f.id),
          ])
        ),
      };
    }

    // Only show loading state on initial load
    if (isLoadingThreads && threads.length === 0) {
      return { unfoldered: [], foldered: new Map() };
    }

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
  }, [threads, folders, isLoadingThreads]);

  // Optimistic updates for thread operations
  const handleNewThread = async () => {
    try {
      // Create the actual thread first
      const thread = await createThread();

      // Update the URL without a full navigation
      router.replace(`/dashboard/chat?thread=${thread.id}`, {
        scroll: false,
      });
    } catch (error) {
      console.error("Failed to create thread:", error);
    }
  };

  const handleSelectThread = (threadId: string) => {
    // Optimistically update the URL without waiting for navigation
    const url = `/dashboard/chat?thread=${threadId}`;

    // Use replace to avoid adding to history stack
    window.history.replaceState({}, "", url);

    // Then update Next.js router state
    router.replace(url, {
      scroll: false,
    });
  };

  const handleDeleteThread = async (threadId: string) => {
    try {
      // Optimistically update UI
      const threadToDelete = threads.find((t) => t.id === threadId);
      if (!threadToDelete) return;

      // Delete the thread first
      await deleteThread(threadId);

      // If the deleted thread was selected, redirect to chat home and wait for navigation
      if (currentThreadId === threadId) {
        await router.push("/dashboard/chat");
      }
    } catch (error) {
      console.error("Error deleting thread:", error);
      // Error handling is managed by the store
    }
  };

  const handleRenameThread = async (threadId: string, newTitle: string) => {
    try {
      // Optimistically update UI
      const threadToRename = threads.find((t) => t.id === threadId);
      if (!threadToRename) return;

      await updateThread(threadId, { title: newTitle });
    } catch (error) {
      console.error("Error renaming thread:", error);
      // Error handling is managed by the store
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
                  >
                    <PlusIcon className="h-4 w-4" />
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
      <div className="mt-auto p-4">
        <Link
          href="https://github.com/softsolutions-ny/elucide"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <Image
            src="/github-icon.svg"
            alt="GitHub"
            width={16}
            height={16}
            className="dark:invert"
          />
          <span>Source</span>
        </Link>
      </div>
    </Sidebar>
  );
}
