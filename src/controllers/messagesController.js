const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// POST /api/messages  { toId, content }
async function send(req, res) {
  try {
    const { toId, content } = req.body;
    const from = req.session.user;
    if (!toId || !content || !content.trim()) {
      return res.status(400).json({ success: false, message: 'toId and content are required.' });
    }

    // Get recipient name
    const { data: toUser } = await supabase.from('users').select('fullName').eq('id', toId).single();
    if (!toUser) return res.status(404).json({ success: false, message: 'Recipient not found.' });

    const { data, error } = await supabase.from('messages').insert({
      fromId:   from.id,
      toId,
      fromName: from.fullName || from.email,
      toName:   toUser.fullName,
      content:  content.trim(),
      isRead:   false,
      createdAt: new Date().toISOString(),
    }).select().single();

    if (error) throw error;
    res.json({ success: true, message: data });
  } catch (e) {
    console.error('[messages:send]', e.message);
    res.status(500).json({ success: false, message: 'Could not send message.' });
  }
}

// GET /api/messages/conversations
async function conversations(req, res) {
  try {
    const userId = req.session.user.id;

    // All messages involving current user
    const { data: sent }     = await supabase.from('messages').select('*').eq('fromId', userId).order('createdAt', { ascending: false });
    const { data: received } = await supabase.from('messages').select('*').eq('toId',   userId).order('createdAt', { ascending: false });

    const all = [...(sent || []), ...(received || [])];
    // Group by the other participant
    const map = {};
    for (const m of all) {
      const otherId   = m.fromId === userId ? m.toId   : m.fromId;
      const otherName = m.fromId === userId ? m.toName : m.fromName;
      if (!map[otherId]) {
        map[otherId] = { otherId, otherName, lastMessage: m, unread: 0 };
      } else {
        const existing = new Date(map[otherId].lastMessage.createdAt);
        if (new Date(m.createdAt) > existing) map[otherId].lastMessage = m;
      }
      if (!m.isRead && m.toId === userId) map[otherId].unread++;
    }

    const list = Object.values(map).sort(
      (a, b) => new Date(b.lastMessage.createdAt) - new Date(a.lastMessage.createdAt)
    );
    res.json({ success: true, conversations: list });
  } catch (e) {
    console.error('[messages:conversations]', e.message);
    res.status(500).json({ success: false, message: 'Could not load conversations.' });
  }
}

// GET /api/messages/thread/:otherId
async function thread(req, res) {
  try {
    const userId  = req.session.user.id;
    const otherId = req.params.otherId;

    const { data: msgs, error } = await supabase
      .from('messages')
      .select('*')
      .or(`and(fromId.eq.${userId},toId.eq.${otherId}),and(fromId.eq.${otherId},toId.eq.${userId})`)
      .order('createdAt', { ascending: true });

    if (error) throw error;

    // Mark received messages as read
    await supabase
      .from('messages')
      .update({ isRead: true })
      .eq('fromId', otherId)
      .eq('toId', userId)
      .eq('isRead', false);

    res.json({ success: true, messages: msgs || [] });
  } catch (e) {
    console.error('[messages:thread]', e.message);
    res.status(500).json({ success: false, message: 'Could not load thread.' });
  }
}

// GET /api/messages/unread-count
async function unreadCount(req, res) {
  try {
    const userId = req.session.user.id;
    const { count, error } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('toId', userId)
      .eq('isRead', false);
    if (error) throw error;
    res.json({ success: true, count: count || 0 });
  } catch (e) {
    console.error('[messages:unreadCount]', e.message);
    res.status(500).json({ success: false, message: 'Could not get unread count.' });
  }
}

module.exports = { send, conversations, thread, unreadCount };
