const { createClient } = require('@supabase/supabase-js');
const { notify } = require('../services/notificationService');
const sse = require('../services/sseHub');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

// Attachment columns may be missing until migration 023 runs — strip & retry.
const OPTIONAL_MSG_COLS = ['attachmentUrl', 'attachmentType', 'attachmentName'];
const isMissingColumnError = (msg) =>
  /Could not find the '\w+' column|column \S+ does not exist|schema cache/i.test(msg || '');

async function insertMessageSafe(record) {
  let { data, error } = await supabase.from('messages').insert(record).select().single();
  if (error && isMissingColumnError(error.message)) {
    const clean = { ...record };
    OPTIONAL_MSG_COLS.forEach(c => delete clean[c]);
    ({ data, error } = await supabase.from('messages').insert(clean).select().single());
  }
  if (error) throw error;
  return data;
}

const convId = (a, b) => [a, b].sort().join('_');

// POST /api/messages  { toId, content, attachmentUrl?, attachmentType?, attachmentName? }
async function send(req, res) {
  try {
    const { toId, content, attachmentUrl, attachmentType, attachmentName } = req.body;
    const fromId = req.session.userId;
    let text = (content || '').trim();
    if (!toId || (!text && !attachmentUrl)) {
      return res.status(400).json({ success: false, message: 'toId and content (or attachment) are required.' });
    }

    // Anti-platform-avoidance: strip phone numbers, emails, and external
    // chat handles from message bodies. Admins are exempt for moderation.
    const isAdminUser = req.session.userType === 'admin' || req.session.userType === 'staff';
    let contactFlagged = false;
    if (text && !isAdminUser) {
      const { sanitizeMessageBody } = require('../utils/sanitizeContact');
      const r = sanitizeMessageBody(text);
      text = r.clean;
      contactFlagged = r.flagged;
    }

    // Get sender and recipient names
    const [{ data: fromUser }, { data: toUser }] = await Promise.all([
      supabase.from('users').select('fullName,email,photo').eq('id', fromId).single(),
      supabase.from('users').select('fullName').eq('id', toId).single(),
    ]);
    if (!toUser) return res.status(404).json({ success: false, message: 'Recipient not found.' });

    const record = {
      fromId,
      toId,
      fromName: fromUser?.fullName || fromUser?.email || fromId,
      toName:   toUser.fullName,
      content:  text,
      isRead:   false,
      createdAt: new Date().toISOString(),
    };
    if (attachmentUrl) {
      record.attachmentUrl  = String(attachmentUrl).slice(0, 1000);
      record.attachmentType = attachmentType === 'file' ? 'file' : 'image';
      record.attachmentName = (attachmentName || '').slice(0, 200);
    }

    const data = await insertMessageSafe(record);

    // ── Real-time push (SSE) to BOTH participants ──
    // Recipient sees it appear instantly; sender's other tabs stay in sync.
    sse.publish(toId,   'message', data);
    sse.publish(fromId, 'message', data);

    // Notify the recipient (in-app) — only if they're not actively connected
    const snippet = (data.content || (data.attachmentType === 'image' ? '📷 Photo' : '📎 Attachment')).slice(0, 80);
    notify({
      userId: toId,
      type: 'message',
      title:   'New message',
      titleAr: 'رسالة جديدة',
      body:   `${data.fromName}: ${snippet}`,
      bodyAr: `من ${data.fromName}: ${snippet}`,
      link: '/' + (req.session.userType === 'tourist' ? 'tourist-dashboard' : req.session.userType === 'guide' ? 'guide-dashboard' : 'company-dashboard') + '.html#messages',
      metadata: { fromId, conversationId: convId(fromId, toId) },
    });

    res.json({
      success: true,
      message: data,
      contactFlagged,
      ...(contactFlagged ? { warning: 'Phone numbers, emails and external chat links are removed automatically. Please keep your conversation on Guideon for booking protection and dispute support.' } : {}),
    });
  } catch (e) {
    console.error('[messages:send]', e.message);
    res.status(500).json({ success: false, message: 'Could not send message.' });
  }
}

// GET /api/messages/conversations
async function conversations(req, res) {
  try {
    const userId = req.session.userId;

    const { data: sent }     = await supabase.from('messages').select('*').eq('fromId', userId).order('createdAt', { ascending: false });
    const { data: received } = await supabase.from('messages').select('*').eq('toId',   userId).order('createdAt', { ascending: false });

    const all = [...(sent || []), ...(received || [])];
    const map = {};
    for (const m of all) {
      const otherId   = m.fromId === userId ? m.toId   : m.fromId;
      const otherName = m.fromId === userId ? m.toName : m.fromName;
      if (!map[otherId]) {
        map[otherId] = { otherId, otherName, lastMessage: m, unread: 0, online: sse.isOnline(otherId) };
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
// Match the id shapes the app actually issues. Block anything else so we
// never interpolate user input into a PostgREST .or() clause unguarded.
const ID_PATTERN = /^[a-zA-Z0-9_-]{3,64}$/;

async function thread(req, res) {
  try {
    const userId  = req.session.userId;
    const otherId = req.params.otherId;

    if (!ID_PATTERN.test(otherId)) {
      return res.status(400).json({ success: false, message: 'Invalid recipient id.' });
    }

    const { data: msgs, error } = await supabase
      .from('messages')
      .select('*')
      .or(`and(fromId.eq.${userId},toId.eq.${otherId}),and(fromId.eq.${otherId},toId.eq.${userId})`)
      .order('createdAt', { ascending: true });

    if (error) throw error;

    // Mark received messages as read
    const hadUnread = (msgs || []).some(m => m.fromId === otherId && m.toId === userId && !m.isRead);
    if (hadUnread) {
      await supabase
        .from('messages')
        .update({ isRead: true })
        .eq('fromId', otherId)
        .eq('toId', userId)
        .eq('isRead', false);

      // Tell the OTHER user (the sender) that their messages were read → ✓✓
      sse.publish(otherId, 'read', { by: userId, conversationId: convId(userId, otherId) });
    }

    res.json({ success: true, messages: msgs || [], online: sse.isOnline(otherId) });
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

// GET /api/messages/support-agent — who a tourist/guide should message for help
async function supportAgent(req, res) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id,fullName')
      .eq('userType', 'admin')
      .order('createdAt', { ascending: true })
      .limit(1);
    if (error) throw error;
    if (!data || !data.length) {
      return res.status(404).json({ success: false, message: 'Support is unavailable right now.' });
    }
    // Friendly display name instead of the admin's personal name
    res.json({ success: true, agent: { id: data[0].id, name: 'Guideon Support', nameAr: 'دعم Guideon', online: sse.isOnline(data[0].id) } });
  } catch (e) {
    console.error('[messages:supportAgent]', e.message);
    res.status(500).json({ success: false, message: 'Could not reach support.' });
  }
}

// POST /api/messages/typing  { toId, isTyping }
function typing(req, res) {
  const { toId, isTyping } = req.body;
  const fromId = req.session.userId;
  if (toId) {
    sse.publish(toId, 'typing', { fromId, isTyping: !!isTyping });
  }
  res.json({ success: true });
}

// GET /api/messages/stream — Server-Sent Events real-time channel
function stream(req, res) {
  const userId = req.session.userId;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no', // disable proxy buffering
  });
  res.write('retry: 5000\n\n');
  res.write('event: ready\ndata: {"ok":true}\n\n');

  sse.addClient(userId, res);

  // Heartbeat so proxies don't close the idle connection
  const ping = setInterval(() => {
    try { res.write(': ping\n\n'); } catch { clearInterval(ping); }
  }, 25000);

  req.on('close', () => clearInterval(ping));
}

// ── ADMIN: view all conversations and threads (moderation) ──────────
// Lets admin/staff inspect any conversation between two users to
// investigate disputes or platform-avoidance attempts. Messages are
// returned WITH their masked content (••••) so admins can also see
// which messages were sanitized. Raw original text is NOT stored —
// sanitization happens at write time, so even admin sees the masked
// version.  This is by design: we don't want a leaked admin token to
// expose phone numbers we promised not to retain.
async function adminListConversations(req, res) {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 200, 500);
    // Pull recent messages and group by (smaller, larger) participant pair
    const { data: msgs, error } = await supabase
      .from('messages')
      .select('*')
      .order('createdAt', { ascending: false })
      .limit(limit * 5); // grab a wider window so we can group
    if (error) throw error;

    const pairs = {};
    for (const m of (msgs || [])) {
      const a = m.fromId < m.toId ? m.fromId : m.toId;
      const b = m.fromId < m.toId ? m.toId   : m.fromId;
      const key = `${a}__${b}`;
      if (!pairs[key]) {
        pairs[key] = {
          aId: a, bId: b,
          aName: m.fromId === a ? m.fromName : m.toName,
          bName: m.fromId === b ? m.fromName : m.toName,
          lastMessage: m,
          count: 1,
        };
      } else {
        pairs[key].count++;
        if (new Date(m.createdAt) > new Date(pairs[key].lastMessage.createdAt)) {
          pairs[key].lastMessage = m;
        }
      }
    }
    const list = Object.values(pairs)
      .sort((x, y) => new Date(y.lastMessage.createdAt) - new Date(x.lastMessage.createdAt))
      .slice(0, limit);
    res.json({ success: true, conversations: list, totalPairs: Object.keys(pairs).length });
  } catch (e) {
    console.error('[messages:adminListConversations]', e.message);
    res.status(500).json({ success: false, message: 'Could not load conversations.' });
  }
}

async function adminViewThread(req, res) {
  try {
    const { a, b } = req.query;
    if (!a || !b || !ID_PATTERN.test(a) || !ID_PATTERN.test(b)) {
      return res.status(400).json({ success: false, message: 'Two valid user ids (a, b) are required.' });
    }
    const { data: msgs, error } = await supabase
      .from('messages')
      .select('*')
      .or(`and(fromId.eq.${a},toId.eq.${b}),and(fromId.eq.${b},toId.eq.${a})`)
      .order('createdAt', { ascending: true });
    if (error) throw error;
    res.json({ success: true, messages: msgs || [] });
  } catch (e) {
    console.error('[messages:adminViewThread]', e.message);
    res.status(500).json({ success: false, message: 'Could not load thread.' });
  }
}

module.exports = { send, conversations, thread, unreadCount, typing, stream, supportAgent, adminListConversations, adminViewThread };
