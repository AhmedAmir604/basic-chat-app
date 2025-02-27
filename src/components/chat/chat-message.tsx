interface MessageProps {
  message: {
    id: string;
    content: string;
    sender_id: string;
    created_at: string;
  };
  isOwn: boolean;
}

export function ChatMessage({ message, isOwn }: MessageProps) {
  return (
    <div 
      className={`p-3 rounded-lg ${
        isOwn 
          ? "bg-primary text-primary-foreground ml-auto" 
          : "bg-muted"
      } max-w-[75%]`}
    >
      {message.content}
    </div>
  );
} 