// chatEngine.js - Fixed Multi-Room Email & Participant Matching

(function () {
  const ChatEngine = {
    // Fetch active chat rooms filtered by user role and active filter state
    async fetchRooms(adminFilterMode = 'my_chats') {
      const db = window.supabaseClient;
      if (!db) return [];

      try {
        const { data: sessionData } = await db.auth.getSession();
        const user = sessionData?.session?.user;
        if (!user) return [];

        const userEmail = (user.email || "").trim().toLowerCase();
        const PRIMARY_ADMIN_UID = "a854c1f9-292f-49ac-89c0-37dd509e683d";
        const promotedAdmins = JSON.parse(localStorage.getItem("promoted_admins") || "[]");
        const isAdmin = user.id === PRIMARY_ADMIN_UID || promotedAdmins.includes(userEmail);

        // Fetch all rooms sorted by newest
        const { data: rooms, error } = await db
          .from('chat_rooms')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        if (!rooms) return [];

        // Helper function to check if current email is in client_email list
        const isUserParticipant = (room) => {
          if (!room.client_email) return false;
          const emails = room.client_email
            .split(',')
            .map(e => e.trim().toLowerCase());
          return emails.includes(userEmail);
        };

        // ADMIN FILTER logic
        if (isAdmin) {
          if (adminFilterMode === 'my_chats') {
            return rooms.filter(isUserParticipant);
          }
          // 'all' mode returns every room in database
          return rooms;
        }

        // CLIENT FILTER logic: Always restrict to rooms where client_email includes their email
        return rooms.filter(isUserParticipant);

      } catch (err) {
        console.error("Error fetching rooms:", err);
        return [];
      }
    },

    // Create a new room mapped to 'name', 'client_name', and 'client_email'
    async createRoom(roomName, clientName, clientEmail) {
      const db = window.supabaseClient;
      if (!db) return null;

      try {
        const { data, error } = await db
          .from('chat_rooms')
          .insert([
            {
              name: roomName,
              client_name: clientName,
              client_email: clientEmail
            }
          ])
          .select()
          .single();

        if (error) throw error;
        return data;
      } catch (err) {
        console.error("Error creating chat room:", err);
        return null;
      }
    },

    // Persist updated participants list to public.chat_rooms
    async updateRoomMembers(roomId, clientEmailStr, clientNameStr) {
      const db = window.supabaseClient;
      if (!db || !roomId) return false;

      try {
        const { error } = await db
          .from('chat_rooms')
          .update({
            client_email: clientEmailStr,
            client_name: clientNameStr
          })
          .eq('id', roomId);

        if (error) throw error;
        return true;
      } catch (err) {
        console.error("Error updating room members:", err);
        return false;
      }
    },

    // Send message to public.messages
    async sendMessage(roomId, senderType, senderName, content) {
      const db = window.supabaseClient;
      if (!db || !roomId) return null;

      try {
        const { data, error } = await db
          .from('messages')
          .insert([
            {
              room_id: roomId,
              sender_type: senderType,
              sender_name: senderName,
              content: content
            }
          ])
          .select()
          .single();

        if (error) throw error;
        return data;
      } catch (err) {
        console.error("Error sending message:", err);
        return null;
      }
    },

    // Realtime channel subscription for active room
    subscribeToRoom(roomId, callback) {
      const db = window.supabaseClient;
      if (!db || !roomId) return;

      db.from('messages')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true })
        .then(({ data, error }) => {
          if (!error && data) {
            callback(data, true);
          }
        });

      return db
        .channel(`room:${roomId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `room_id=eq.${roomId}`
          },
          (payload) => {
            if (payload.new) {
              callback([payload.new], false);
            }
          }
        )
        .subscribe();
    }
  };

  window.ChatEngine = ChatEngine;
})();
