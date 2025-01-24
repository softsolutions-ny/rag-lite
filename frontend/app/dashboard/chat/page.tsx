import { ChatContainer } from "@/components/chat/chat-container";

export default function ChatPage() {
  return (
    <main className="container mx-auto flex flex-col gap-8 p-8">
      <div className="flex flex-col gap-2"></div>
      <ChatContainer />
    </main>
  );
}
