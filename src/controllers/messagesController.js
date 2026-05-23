const { createClient } = require('@supabase/supabase-js');
const { notify } = require('../services/notificationService');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// POST /api/messages  { toId, content }
async function send(req, res) {
  try {
    const { toId, content } = req.body;
    const fromId = req.session.userId;
    if (!toId || !content || !content.trim()) {
      return res.status(400).json({ success: false, message: 'toId and content are required.' });
    }

    // Get sender and recipient names
    const [{ data: fromUser }, { data: toUser }] = await Promise.all([
      supabase.from('users').select('fullName,email').eq('id', fromId).single(),
      supabase.from('users').select('fullName').eq('id', toId).single(),
    ]);
    if (!toUser) return res.status(404).json({ success: false, message: 'Recipient not found.' });

    const { data, error } = await supabase.from('messages').insert({
      fromId,
      toId,
      fromName: fromUser?.fullName || fromUser?.email || fromId,
      toName:   toUser.fullName,
      content:  content.trim(),
      isRead:   false,
      createdAt: new Date().toISOString(),
    }).select().single();

    if (error) throw error;

    // Notify the recipient (in-app, no email — too noisy for chat)
    notify({
      userId: toId,
      type: 'message',
      title: 'New message',
      body: `${data.fromName}: ${data.content.slice(0, 80)}${data.content.length > 80 ? '…' : ''}`,
      link: '/' + (req.session.userType === 'tourist' ? 'tourist-dashboard' : req.session.userType === 'guide' ? 'guide-dashboard' : 'company-dashboard') + '.html#messages',
      metadata: { fromId, conversationId: [fromId, toId].sort().join('_') },
    });

    res.json({ success: true, message: data });
  } catch (e) {
    console.error('[messages:send]', e.message);
    res.status(500).json({ success: false, message: 'Could not send message.' });
  }
}

// GET /api/messages/conversations
async function conversations(req, res) {
  try {
    const userId = req.session.userId;

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
    const userId  = req.session.userId;
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
    const userId = req.session.userId;
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
