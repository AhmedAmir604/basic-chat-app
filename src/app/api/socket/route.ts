import { Server as NetServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { headers } from "next/headers";

let io: SocketIOServer;

export async function GET(req: Request) {
  if (io) {
    console.log("Socket is already running");
    return new Response(null, { status: 200 });
  }

  io = new SocketIOServer({ 
    path: "/api/socket",
    addTrailingSlash: false,
  });

  io.on("connection", (socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.on("join_chat", (chatId) => {
      socket.join(chatId);
    });

    socket.on("send_message", (message) => {
      io.to(message.chat_id).emit("new_message", message);
    });

    socket.on("disconnect", () => {
      console.log(`User disconnected: ${socket.id}`);
    });
  });

  console.log("Setting up socket");
  return new Response(null, { status: 200 });
} 