/**
 * kindlink AI + FAQ Chatbot Route
 * POST /api/chatbot/ask — accepts { message } in body
 *
 * If GEMINI_API_KEY is set in .env, uses Google Gemini 1.5-Flash.
 * Falls back to keyword-based FAQ matching if no key or API fails.
 */
const express = require('express');
const router = express.Router();

// ── System prompt for Gemini ──────────────────────────────────────────────
const SYSTEM_PROMPT = `You are a friendly, concise AI assistant for kindlink — a community volunteering and help platform designed for India.

About kindlink:
- Anyone can POST a help request (education, medical, groceries, transport, elderly care, childcare, disability support, etc.)
- Volunteers BROWSE nearby open requests and ACCEPT tasks they can help with
- Once accepted, a GROUP CHAT opens between the requester and all volunteers for coordination
- After completion, both parties can rate each other (1–5 stars) and leave feedback
- COMPLAINTS can be filed for specific task issues or general platform concerns (admin-only visibility)
- Requests have URGENCY levels: High (time-critical), Medium (flexible), Low (no deadline)
- Requests can optionally have a DEADLINE date visible to volunteers as a countdown
- PINCODES determine "nearby" matching — set yours in Profile

Answer ONLY questions about kindlink and community volunteering topics.
If asked about unrelated topics, politely redirect.
Keep answers short (3–5 sentences max). Be warm, helpful, and encouraging.`;

// ── FAQ knowledge base (keyword-based fallback) ───────────────────────────
const FAQ = [
  {
    keywords: ['what', 'kindlink', 'about', 'platform', 'purpose', 'is this', 'explain'],
    answer: 'kindlink is a community help and volunteering platform that connects people who need help with nearby volunteers. Anyone can post a request for help — from grocery runs to medical transport — or browse open requests and volunteer for others in their community.',
  },
  {
    keywords: ['post', 'create request', 'ask for help', 'need help', 'how do i post'],
    answer: 'To post a request, go to Dashboard → "Post a Request". Fill in the title, describe what you need, choose a category and urgency level, add your pincode, and optionally set a deadline. Volunteers in your area will be able to see and accept your request immediately.',
  },
  {
    keywords: ['volunteer', 'accept', 'browse', 'how to help', 'how do i help', 'accept task'],
    answer: 'To volunteer, go to "Browse Requests" to see open requests near you, filtered by urgency and category. Click "Accept" on any request to take it up. Once accepted, a shared chat opens between you and the requester for coordination.',
  },
  {
    keywords: ['chat', 'message', 'communicate', 'talk', 'how to chat'],
    answer: 'After a task is accepted, a group chat opens between the requester and all volunteers. You can access it from "My Tasks" or the request details page. All messages are saved so you can refer back anytime.',
  },
  {
    keywords: ['urgency', 'priority', 'high', 'urgent', 'emergency'],
    answer: 'Urgency levels help volunteers prioritise: High = time-sensitive needs (medical, transport emergencies), Medium = needed within a few days, Low = flexible timeline. On the Browse page, High-urgency rows are highlighted with a red indicator.',
  },
  {
    keywords: ['deadline', 'due date', 'time left', 'expire'],
    answer: 'Requesters can optionally set a deadline when posting. On the Browse page, each request shows a countdown ("3 days left", "Overdue") so volunteers know when help is needed by. Requests near their deadline are highlighted.',
  },
  {
    keywords: ['delete', 'remove request', 'cancel post'],
    answer: 'You can delete your own request from the "My Tasks" page or Dashboard, but ONLY if no volunteer has accepted it yet and it is not completed. Once a volunteer accepts, deletion is locked to protect the volunteer\'s commitment.',
  },
  {
    keywords: ['leave', 'withdraw', 'quit task', 'cancel task', 'back out'],
    answer: 'As a volunteer, you can withdraw from a task on the "My Tasks" page as long as it has not been marked completed. The request will re-open automatically for other volunteers.',
  },
  {
    keywords: ['complete', 'finish', 'mark done', 'done'],
    answer: 'Volunteers mark tasks complete from the Task Details page. Once all accepted volunteers mark it done, the request status moves to Completed. The requester receives a notification and can then leave feedback.',
  },
  {
    keywords: ['feedback', 'rating', 'review', 'stars', 'rate'],
    answer: 'After a task is completed, both the requester and each volunteer can leave a star rating (1–5) and a written comment. Ratings build your public reputation score, helping others decide if they want to work with you.',
  },
  {
    keywords: ['complaint', 'report', 'issue', 'problem', 'abuse'],
    answer: 'You can file complaints in two ways: (1) Task-specific complaint via Task Details — for issues with a specific person on that task. (2) General complaint from the Dashboard — for platform-wide issues or bugs. All complaints are only visible to the admin.',
  },
  {
    keywords: ['category', 'type', 'kinds of requests', 'what can i ask'],
    answer: 'Available request categories: Education, Medical, Groceries, Transport, Elderly Care, Children, Disability Support, and Other. Choose the most specific category when posting — it helps volunteers filter requests they are best suited for.',
  },
  {
    keywords: ['pincode', 'location', 'nearby', 'area', 'local'],
    answer: 'Requests are matched by pincode. Set your pincode in Profile → it makes nearby requests appear at the top of the Browse page. Requests with the same or a similar pincode prefix (first 3 digits) appear in the "Nearby" section.',
  },
  {
    keywords: ['notification', 'alert', 'badge', 'bell'],
    answer: 'You get notifications when: someone accepts your request, a task is completed, a volunteer leaves your request, or when you accept a new task. Unread notifications appear as a number badge on the "Dashboard" link in the navigation bar.',
  },
  {
    keywords: ['admin', 'who manages', 'moderation'],
    answer: 'Platform admins can view all users, requests, complaints, and feedback. They can ban users who violate platform rules and resolve complaints. If you face a serious issue, submit a General Complaint from your Dashboard.',
  },
  {
    keywords: ['login', 'register', 'sign up', 'account', 'password', 'forgot'],
    answer: 'Click "Signup" to create a free account with your name, email, a password, and your pincode. For login issues or a forgotten password, use the "Forgot Password" link on the login page to receive a reset email.',
  },
  {
    keywords: ['volunteer progress', 'slots', 'how many', 'needed'],
    answer: 'Each request specifies how many volunteers are needed. The Browse page shows a visual progress bar (e.g., 1/3 volunteers) so you can instantly see if there is still room to help. Fully-filled requests are marked as Full and cannot be accepted.',
  },
];

// ── Keyword matcher ─────────────────────────────────────────────────────────
function matchFAQ(message) {
  const msg = message.toLowerCase();
  let best = null;
  let bestScore = 0;
  for (const item of FAQ) {
    const score = item.keywords.filter((k) => msg.includes(k.toLowerCase())).length;
    if (score > bestScore) { bestScore = score; best = item; }
  }
  return bestScore >= 1 ? best.answer : null;
}

// ── Gemini API call ─────────────────────────────────────────────────────────
async function callGemini(message) {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key === 'your_gemini_api_key_here') return null;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: 'user', parts: [{ text: message }] }],
          generationConfig: { maxOutputTokens: 300, temperature: 0.65 },
        }),
      },
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
  } catch {
    return null;
  }
}

// ── POST /api/chatbot/ask ─────────────────────────────────────────────────
router.post('/ask', async (req, res) => {
  const message = String(req.body?.message || '').trim();
  if (!message) return res.status(400).json({ error: 'Message required' });

  // 1. Try AI first
  const aiAnswer = await callGemini(message);
  if (aiAnswer) return res.json({ answer: aiAnswer, isAI: true });

  // 2. FAQ fallback
  const faqAnswer = matchFAQ(message);
  if (faqAnswer) return res.json({ answer: faqAnswer, isAI: false });

  // 3. Default catch-all
  return res.json({
    answer: "I'm not sure about that specific question. Try asking about how to post a request, browse and accept tasks, the chat system, urgency levels, feedback, or how complaints work. You can also explore the platform directly!",
    isAI: false,
  });
});

// ── GET /api/chatbot/faq — quick questions list for the widget ──────────────
router.get('/faq', (_req, res) => {
  res.json({
    questions: [
      'What is kindlink?',
      'How do I post a request?',
      'How do I volunteer for a task?',
      'How does the chat work?',
      'How are requests matched by location?',
      'What do urgency levels mean?',
      'Can I delete my request?',
      'How does the feedback system work?',
      'How do I leave a task I accepted?',
      'How do complaints work?',
    ],
    hasAI: !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here'),
  });
});

module.exports = router;
