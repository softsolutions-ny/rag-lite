import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  PlusIcon,
  MessageSquare,
  Loader2,
  MoreHorizontal,
  Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useState, useRef } from "react";
import { Thread } from "@/lib/types";

interface ThreadListProps {
  threads: Thread[];
  currentThreadId?: string;
  onNewThread: () => void;
  onSelectThread: (threadId: string) => void;
  onDeleteThread?: (threadId: string) => void;
  onRenameThread?: (threadId: string, newTitle: string) => void;
  isLoading?: boolean;
}

export function ThreadList({
  threads,
  currentThreadId,
  onNewThread,
  onSelectThread,
  onDeleteThread,
  onRenameThread,
  isLoading = false,
}: ThreadListProps) {
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
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

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-4">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Button
        variant="ghost"
        className="flex items-center gap-1.5 w-full justify-start hover:bg-muted px-2 h-8"
        onClick={onNewThread}
      >
        <PlusIcon className="h-3.5 w-3.5" />
        New Chat
      </Button>

      <div className="flex flex-col gap-1">
        {threads.map((thread) => (
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
                  "flex items-center gap-1.5 flex-1 min-w-0 justify-start text-left px-2 h-8",
                  currentThreadId === thread.id && "bg-muted"
                )}
                onClick={() => onSelectThread(thread.id)}
              >
                <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="truncate text-sm leading-none">
                    {formatTitle(thread)}
                  </span>
                  <span className="text-[10px] text-muted-foreground leading-none mt-1">
                    {formatDate(thread.updated_at)}
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
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onSelect={() => onDeleteThread?.(thread.id)}
                >
                  Delete thread
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
      </div>
    </div>
  );
}
