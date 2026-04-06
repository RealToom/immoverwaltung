import { useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useTenantMessages, useSendMessage } from "@/hooks/api/useTenantMessages";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Send } from "lucide-react";

export default function Messages() {
  const { slug } = useParams<{ slug: string }>();
  const { data: messages, isLoading } = useTenantMessages(slug!);
  const sendMutation = useSendMessage(slug!);
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  async function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || sendMutation.isPending) return;
    setText("");
    await sendMutation.mutateAsync(trimmed);
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <div className="bg-white border-b px-4 py-4 flex-shrink-0">
        <h1 className="text-xl font-semibold">Nachrichten</h1>
        <p className="text-xs text-gray-500 mt-0.5">Direkte Kommunikation mit Ihrer Verwaltung</p>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 pb-24">
        {isLoading ? (
          [1, 2].map((i) => (
            <div key={i} className={`max-w-xs rounded-2xl p-3 animate-pulse h-14 ${i % 2 === 0 ? "ml-auto bg-primary/20" : "bg-white border"}`} />
          ))
        ) : !messages?.length ? (
          <div className="flex flex-col items-center justify-center h-full text-center pt-16">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-3">
              <Send className="w-7 h-7 text-gray-300" />
            </div>
            <p className="text-sm text-gray-500">Noch keine Nachrichten.</p>
            <p className="text-xs text-gray-400 mt-1">Schreiben Sie Ihrer Verwaltung direkt.</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMine = msg.direction === "TENANT_TO_ADMIN";
            return (
              <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[78%] rounded-2xl px-4 py-2.5 ${
                  isMine
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-white border text-gray-900 rounded-bl-sm"
                }`}>
                  <p className="text-sm whitespace-pre-wrap">{msg.body}</p>
                  <p className={`text-[10px] mt-1 ${isMine ? "opacity-70 text-right" : "text-gray-400"}`}>
                    {format(new Date(msg.createdAt), "dd.MM. HH:mm", { locale: de })}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="fixed bottom-16 left-0 right-0 bg-white border-t px-4 py-3 flex items-end gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Nachricht schreiben…"
          rows={1}
          className="flex-1 border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none max-h-28 overflow-y-auto"
        />
        <button
          onClick={handleSend}
          disabled={!text.trim() || sendMutation.isPending}
          className="w-10 h-10 bg-primary text-primary-foreground rounded-xl flex items-center justify-center flex-shrink-0 disabled:opacity-40"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
