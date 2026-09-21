// chatEngine.js
window.ChatEngine = {
  // 1. Manual Creation (For now, via Email / Name)
  async createRoom({ name, clientName, clientEmail, projectId = null }) {
    const db = window.supabaseClient;
    
    // Check if room already exists for this client/project
    let query = db.from('chat_rooms').select('*');
    if (projectId) {
      query = query.eq('project_id', projectId);
    } else if (clientEmail) {
      query = query.eq('client_email', clientEmail);
    }

    const { data: existing } = await query.maybeSingle();
    if (existing) return existing;

    // Create new room if it doesn't exist
    const { data: newRoom, error } = await db
      .from('chat_rooms')
      .insert([{
        name: name,
        client_name: clientName,
        client_email: clientEmail,
        project_id: projectId
      }])
      .select()
      .single();

    if (error) console.error("Error creating chat room:", error);
    return newRoom;
  },

  // 2. Fetch all active chat rooms for the admin panel
  async fetchRooms() {
    const db = window.supabaseClient;
    if (!db) {
      console.warn("Supabase client not initialized yet.");
      return [];
    }

    const { data, error } = await db.from('chat_rooms').select('*');
    if (error) {
      console.error("Error fetching rooms:", error);
      return [];
    }
    return data;
  }

  // 3. Listen to Realtime updates in a room
  subscribeToRoom(roomId, onNewMessage) {
    const db = window.supabaseClient;

    // Fetch historical messages first
    db.from('messages')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true })
      .then(({ data }) => onNewMessage(data || [], true));

    // Subscribe to incoming messages live
    return db
      .channel(`room:${roomId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` },
        (payload) => {
          onNewMessage([payload.new], false);
        }
      )
      .subscribe();
  },

  // 4. Send a Message
  async sendMessage(roomId, senderType, senderName, content) {
    const db = window.supabaseClient;
    const { error } = await db
      .from('messages')
      .insert([{
        room_id: roomId,
        sender_type: senderType,
        sender_name: senderName,
        content: content
      }]);

    if (error) console.error("Error sending message:", error);
  }
};
