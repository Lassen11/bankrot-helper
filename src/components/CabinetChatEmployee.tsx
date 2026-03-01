import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Send, Paperclip, FileText, Download } from "lucide-react";

interface Message {
  id: string;
  sender_type: string;
  sender_id: string | null;
  message: string;
  file_url: string | null;
  file_name: string | null;
  created_at: string;
}

interface CabinetChatEmployeeProps {
  clientId: string;
}

export function CabinetChatEmployee({ clientId }: CabinetChatEmployeeProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [clientId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  const fetchMessages = async () => {
    const { data, error } = await supabase
      .from("cabinet_messages")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: true });

    if (!error && data) {
      setMessages(data as Message[]);
      // Mark client messages as read by employee
      const unreadIds = data
        .filter((m: any) => m.sender_type === "client" && !m.is_read_by_employee)
        .map((m: any) => m.id);
      if (unreadIds.length > 0) {
        await supabase
          .from("cabinet_messages")
          .update({ is_read_by_employee: true })
          .in("id", unreadIds);
      }
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !user) return;
    setSending(true);
    try {
      const { error } = await supabase.from("cabinet_messages").insert({
        client_id: clientId,
        sender_type: "employee",
        sender_id: user.id,
        message: newMessage.trim(),
      });

      if (error) throw error;
      setNewMessage("");
      fetchMessages();
    } catch {
      toast.error("Ошибка отправки сообщения");
    } finally {
      setSending(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    try {
      const filePath = `${clientId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("cabinet-files")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("cabinet-files")
        .getPublicUrl(filePath);

      const { error } = await supabase.from("cabinet_messages").insert({
        client_id: clientId,
        sender_type: "employee",
        sender_id: user.id,
        message: "",
        file_url: urlData.publicUrl,
        file_name: file.name,
      });

      if (error) throw error;
      fetchMessages();
    } catch {
      toast.error("Ошибка загрузки файла");
    } finally {
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
            Нет сообщений. Напишите клиенту первым.
          </p>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.sender_type === "employee" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-3 py-2 ${
                msg.sender_type === "employee"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted"
              }`}
            >
              <span className={`text-[10px] font-medium block mb-0.5 ${
                msg.sender_type === "employee" ? "text-primary-foreground/70" : "text-muted-foreground"
              }`}>
                {msg.sender_type === "employee" ? "Вы" : "Клиент"}
              </span>
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
                msg.sender_type === "employee" ? "text-primary-foreground/70" : "text-muted-foreground"
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
