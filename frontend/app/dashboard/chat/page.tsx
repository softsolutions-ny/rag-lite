import { ChatContainer } from "@/components/chat/chat-container";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

function ChatSkeleton() {
  return (
    <div className="space-y-4">
      <div className="mx-auto max-w-3xl w-full px-4">
        <div className="flex w-full justify-end">
          <div className="max-w-[75%]">
            <Skeleton className="h-12 w-64" />
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-3xl w-full px-4">
        <div className="flex w-full justify-start">
          <div className="max-w-[75%] space-y-3">
            <Skeleton className="h-4 w-72" />
            <Skeleton className="h-4 w-80" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-3xl w-full px-4">
        <div className="flex w-full justify-end">
          <div className="max-w-[75%]">
            <Skeleton className="h-10 w-52" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <main className="container mx-auto flex flex-col gap-8 p-8">
      <div className="flex flex-col gap-2"></div>
      <Suspense fallback={<ChatSkeleton />}>
        <ChatContainer />
      </Suspense>
    </main>
  );
}
