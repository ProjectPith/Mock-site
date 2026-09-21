// chatEngine.js - Fixed Schema Column Mapping (name, client_name, client_email)

(function () {
  const ChatEngine = {
    // Fetch all active chat rooms
    async fetchRooms() {
      const db = window.supabaseClient;
      if (!db) return [];

      try {
        const { data, error } = await db
          .from('chat_rooms')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
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
              name: roomName,           // Fixed: schema uses 'name'
              client_name: clientName,   // Fixed: schema uses 'client_name'
              client_email: clientEmail  // Fixed: schema uses 'client_email'
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

      // 1. Initial load of existing messages
      db.from('messages')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true })
        .then(({ data, error }) => {
          if (!error && data) {
            callback(data, true);
          }
        });

      // 2. Realtime listener for incoming messages
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
