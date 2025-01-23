"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@clerk/nextjs";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { ThreadList } from "./chat/thread-list";
import { useThreadsStore } from "@/lib/store";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { userId } = useAuth();
  const {
    threads,
    isLoading,
    fetchThreads,
    createThread,
    updateThread,
    deleteThread,
  } = useThreadsStore();
  const currentThreadId = searchParams.get("thread") || undefined;

  // Fetch threads when userId is available
  useEffect(() => {
    if (userId) {
      fetchThreads(userId);
    }
  }, [userId, fetchThreads]);

  const handleNewThread = async () => {
    if (!userId) return;

    try {
      const thread = await createThread(userId);
      router.push(`/dashboard/chat?thread=${thread.id}`);
    } catch (error) {
      console.error("Failed to create thread:", error);
    }
  };

  const handleSelectThread = (threadId: string) => {
    router.push(`/dashboard/chat?thread=${threadId}`);
  };

  const handleDeleteThread = async (threadId: string) => {
    try {
      await deleteThread(threadId);
      // If the deleted thread was selected, redirect to chat home
      if (currentThreadId === threadId) {
        router.push("/dashboard/chat");
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

  const isInChat = pathname?.startsWith("/dashboard/chat");

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <h1 className="text-xl font-bold px-2 py-1">elucide</h1>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <a href="/dashboard/chat">Chat</a>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <a href="/dashboard/upload">Upload</a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isInChat && (
          <SidebarGroup>
            <SidebarGroupContent>
              <ThreadList
                threads={threads}
                currentThreadId={currentThreadId}
                onNewThread={handleNewThread}
                onSelectThread={handleSelectThread}
                onDeleteThread={handleDeleteThread}
                onRenameThread={handleRenameThread}
                isLoading={isLoading}
              />
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
