import { ChatContainer } from "@/components/chat/chat-container";
import { Suspense } from "react";

export default function ChatPage() {
  return (
    <main className="container mx-auto flex flex-col gap-8 p-8">
      <div className="flex flex-col gap-2"></div>
      <Suspense fallback={<div>Loading...</div>}>
        <ChatContainer />
      </Suspense>
    </main>
  );
}
