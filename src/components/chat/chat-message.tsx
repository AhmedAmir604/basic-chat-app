import { Message } from "@/src/lib/supabase";
import { useAuth } from "@/src/lib/auth-context";
import { format } from "date-fns";

interface MessageProps {
  message: Message;
}

export function ChatMessage({ message }: MessageProps) {
  const { user } = useAuth();
  const isOwn = message.user_id === user?.id;
  const displayName = message.profiles?.full_name || message.profiles?.username || 'Anonymous';

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-4`}>
      <div 
        className={`p-3 rounded-lg max-w-[75%] ${
          isOwn 
            ? "bg-primary text-primary-foreground" 
            : "bg-muted"
        }`}
      >
        {!isOwn && (
          <div className="text-xs font-medium mb-1 opacity-75">
            {displayName}
          </div>
        )}
        <div className="break-words">{message.content}</div>
        <div className="text-xs mt-1 opacity-60">
          {format(new Date(message.created_at), 'HH:mm')}
        </div>
      </div>
    </div>
  );
} 