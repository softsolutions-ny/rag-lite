import { ChatContainer } from "@/components/chat/chat-container";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

function ChatSkeleton() {
  return (
    <div className="flex flex-col gap-4 px-4">
      <div className="space-y-4 py-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-4">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-[250px]" />
              <Skeleton className="h-4 w-full max-w-[600px]" />
            </div>
          </div>
        ))}
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
