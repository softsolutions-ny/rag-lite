"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
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

interface Thread {
  id: string;
  title: string;
  updated_at: string;
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { userId } = useAuth();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [currentThreadId, setCurrentThreadId] = useState<string | undefined>(
    () => {
      return searchParams.get("thread") || undefined;
    }
  );
  const [isLoading, setIsLoading] = useState(true);

  const fetchThreads = useCallback(async () => {
    if (!userId) return;

    try {
      console.log("Fetching threads...");
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/chat/threads?user_id=${userId}`
      );
      console.log("Threads response status:", response.status);

      if (response.ok) {
        const data = await response.json();
        console.log("Fetched threads:", data);
        setThreads(data);
      } else {
        const errorText = await response.text();
        console.error(
          "Failed to fetch threads. Status:",
          response.status,
          "Error:",
          errorText
        );
      }
    } catch (error) {
      console.error("Failed to fetch threads:", error);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // Fetch threads when userId is available
  useEffect(() => {
    if (userId) {
      fetchThreads();
    }
  }, [userId, fetchThreads]);

  // Update currentThreadId when URL changes
  useEffect(() => {
    const threadId = searchParams.get("thread");
    setCurrentThreadId(threadId || undefined);
  }, [searchParams]);

  const handleNewThread = async () => {
    if (!userId) return;

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/chat/threads`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            user_id: userId,
          }),
        }
      );

      if (response.ok) {
        const thread = await response.json();
        setThreads((prev) => [thread, ...prev]);
        router.push(`/dashboard/chat?thread=${thread.id}`);
      }
    } catch (error) {
      console.error("Failed to create thread:", error);
    }
  };

  const handleSelectThread = (threadId: string) => {
    router.push(`/dashboard/chat?thread=${threadId}`);
  };

  const handleDeleteThread = async (threadId: string) => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/chat/threads/${threadId}`,
        {
          method: "DELETE",
        }
      );

      if (response.ok) {
        // Remove the thread from the local state
        setThreads((prev) => prev.filter((t) => t.id !== threadId));

        // If the deleted thread was selected, redirect to chat home
        if (currentThreadId === threadId) {
          router.push("/dashboard/chat");
        }
      } else {
        console.error("Failed to delete thread");
      }
    } catch (error) {
      console.error("Error deleting thread:", error);
    }
  };

  const handleRenameThread = async (threadId: string, newTitle: string) => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/chat/threads/${threadId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: newTitle,
          }),
        }
      );

      if (response.ok) {
        const updatedThread = await response.json();
        setThreads((prev) =>
          prev.map((t) => (t.id === threadId ? updatedThread : t))
        );
      } else {
        console.error("Failed to rename thread");
      }
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
