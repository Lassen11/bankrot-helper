import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { Send, Paperclip, FileText, Download } from "lucide-react";

interface Message {
  id: string;
  sender_type: string;
  message: string;
  file_url: string | null;
  file_name: string | null;
  created_at: string;
}

interface CabinetChatClientProps {
  token: string;
}

export function CabinetChatClient({ token }: CabinetChatClientProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [token]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  const fetchMessages = async () => {
    const { data } = await supabase.functions.invoke("cabinet-chat", {
      body: { action: "get_messages", token },
    });
    if (data?.messages) setMessages(data.messages);
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    setSending(true);
    try {
      const { data } = await supabase.functions.invoke("cabinet-chat", {
        body: { action: "send_message", token, message: newMessage.trim() },
      });
      if (data?.message) {
        setMessages((prev) => [...prev, data.message]);
        setNewMessage("");
      }
    } finally {
      setSending(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert("Максимальный размер файла 10 МБ");
      return;
    }

    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        const { data: uploadData } = await supabase.functions.invoke("cabinet-chat", {
          body: {
            action: "upload_file",
            token,
            file_data: base64,
            file_name: file.name,
            content_type: file.type,
          },
        });

        if (uploadData?.file_url) {
          const { data } = await supabase.functions.invoke("cabinet-chat", {
            body: {
              action: "send_message",
              token,
              message: "",
              file_url: uploadData.file_url,
              file_name: uploadData.file_name,
            },
          });
          if (data?.message) setMessages((prev) => [...prev, data.message]);
        }
      };
      reader.readAsDataURL(file);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-[400px]">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-center text-muted-foreground text-sm py-8">
            Напишите сообщение вашему специалисту
          </p>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.sender_type === "client" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-3 py-2 ${
                msg.sender_type === "client"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted"
              }`}
            >
              {msg.message && <p className="text-sm">{msg.message}</p>}
              {msg.file_url && (
                <a
                  href={msg.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs mt-1 underline"
                >
                  <FileText className="h-3 w-3" />
                  {msg.file_name || "Файл"}
                  <Download className="h-3 w-3" />
                </a>
              )}
              <span className={`text-[10px] mt-1 block ${
                msg.sender_type === "client" ? "text-primary-foreground/70" : "text-muted-foreground"
              }`}>
                {new Date(msg.created_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t p-3 flex gap-2">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileUpload}
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          <Paperclip className="h-4 w-4" />
        </Button>
        <Input
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Введите сообщение..."
          disabled={sending}
        />
        <Button onClick={sendMessage} disabled={sending || !newMessage.trim()} size="icon">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
