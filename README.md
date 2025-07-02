# Simple Chat Application

A basic real-time chat application built with Next.js and Supabase. Perfect for beginners to understand how real-time messaging works!

## 🚀 Features

- ✅ Send and receive messages in real-time
- ✅ Create conversations with other users
- ✅ View conversation history
- ✅ User authentication (login/signup)
- ✅ Responsive design

## 🏗️ How It Works

### 1. **Database Structure**
- **`messages`** table: Stores all chat messages
- **`profiles`** table: Stores user information (name, email)

### 2. **Key Components**

#### **Real-time Chat (`src/lib/realtime.ts`)**
```javascript
// Listens for new messages in real-time
subscribeToMessages(partnerId, onNewMessage)

// Sends a message to someone
sendMessage(receiverId, content)
```

#### **Dashboard (`src/app/dashboard/page.tsx`)**
- Shows list of conversations on the left
- Shows selected conversation messages on the right
- Input box to type and send messages

### 3. **How Messages Work**

1. **Sending a Message:**
   - User types message and clicks "Send"
   - Message gets saved to database
   - Real-time system broadcasts to receiver

2. **Receiving a Message:**
   - Supabase real-time listens for new messages
   - When new message arrives, it appears instantly
   - Conversation list updates with latest message

## 🔧 Setup Instructions

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   Create `.env.local` file with your Supabase credentials:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

3. **Run the database setup:**
   Execute the SQL files in your Supabase dashboard:
   - `supabase-setup.sql`
   - `messaging-schema.sql`

4. **Start the application:**
   ```bash
   npm run dev
   ```

## 💡 Understanding the Code

### State Management (Beginner-Friendly)
```javascript
// These variables hold our app's data
const [conversations, setConversations] = useState([]);     // List of people we've chatted with
const [messages, setMessages] = useState([]);              // Messages in current conversation
const [newMessage, setNewMessage] = useState("");          // What user is typing
const [activeConversation, setActiveConversation] = useState(null); // Which chat is open
```

### Real-time Connection
```javascript
// Create connection to Supabase real-time
const realtimeChat = createRealtimeChat(userId);

// Listen for new messages
realtimeChat.subscribeToMessages(partnerId, (newMessage) => {
    // Add new message to our list
    setMessages(prev => [...prev, newMessage]);
});
```

### Sending Messages
```javascript
const sendMessage = async () => {
    // Send message to database
    const sent = await realtimeChat.sendMessage(partnerId, messageText);
    
    // Add to our local list
    if (sent) {
        setMessages(prev => [...prev, sent]);
    }
};
```

## 🎯 Key Learning Points

1. **Real-time Updates:** Uses Supabase's real-time features to instantly show new messages
2. **State Management:** React hooks manage what data is shown on screen
3. **Database Operations:** Simple INSERT operations to send messages
4. **Event Handling:** Listen for user actions (typing, clicking send)

## 🔄 How Data Flows

1. User types message → `newMessage` state updates
2. User clicks Send → `sendMessage()` function runs
3. Message saved to database → Supabase real-time triggers
4. Real-time listener receives message → `setMessages()` updates screen
5. All users in conversation see the new message instantly!

## 🎨 Next Steps (Features You Can Add Later)

- Typing indicators ("User is typing...")
- Online/offline status
- Message read receipts
- File/image sharing
- Group chats
- Message reactions
- Dark/light theme
- Push notifications

## 🐛 Common Issues

1. **Messages not appearing in real-time:** Check your Supabase real-time settings
2. **Can't find users by email:** Make sure profiles table has email column
3. **Permission errors:** Check your Row Level Security (RLS) policies

## 📚 Learn More

- [Supabase Real-time Documentation](https://supabase.com/docs/guides/realtime)
- [React Hooks Guide](https://react.dev/reference/react)
- [Next.js Documentation](https://nextjs.org/docs)

---

**Happy Coding! 🚀** This is your foundation - now you can build amazing chat features on top of it!
