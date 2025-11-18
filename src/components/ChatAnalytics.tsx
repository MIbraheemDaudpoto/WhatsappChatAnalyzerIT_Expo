import { useState, useMemo, useRef, useEffect } from 'react';
import {
  MessageSquare,
  FileText,
  Image,
  Link2,
  Download,
  BarChart3,
  Smile,
  MessageSquare as MessageIcon,
  Star,
  TrendingUp,
  ArrowUp,
  ArrowDown,
  Search,
  Calendar,
  Moon,
  Sun,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { StatsCard } from './StatsCard';
import { BusiestUsersChart } from './charts/BusiestUsersChart';
import { CommonWordsChart } from './charts/CommonWordsChart';
import { ActivityChart } from './charts/ActivityChart';
import { EmojiAnalysis } from './EmojiAnalysis';
import { getUserInsights } from '@/lib/chatParser';
import {
  ParsedChat,
  getStats,
  getBusiestUsers,
  getCommonWords,
  getEmojis,
  getActivityByDay,
  getActivityByMonth,
} from '@/lib/chatParser';
import { exportToPDF } from '@/lib/pdfExporter';

interface ChatAnalyticsProps {
  data: ParsedChat;
  onReset: () => void;
  isLoading?: boolean;
}

/** ------------------------
 *  Enhanced Mood detector helper
 *  - multilingual keyword lists (English + Roman Urdu + Sindhi hints)
 *  - weighted emoji scoring
 *  - sentence-level rules
 *  - recent-window boost to detect mood swings/streaks
 *  - returns { mood, scores, description }
 *  ------------------------ */
function detectMoodFromMessages(messages: any[], selectedUser: string) {
  const filtered =
    selectedUser === "Overall"
      ? messages.filter((m) => !m.isNotification && !m.isMedia)
      : messages.filter(
          (m) => m.user === selectedUser && !m.isNotification && !m.isMedia
        );

  if (!filtered || filtered.length === 0) {
    return {
      mood: "Normal",
      scores: { happy: 0, sad: 0, angry: 0, crazy: 0, normal: 1 },
      description: "No messages to analyze.",
    };
  }

  // Base score buckets
  const scores = {
    happy: 0,
    sad: 0,
    angry: 0,
    crazy: 0,
    normal: 0,
  };

  // Common greeting / neutral words
  const neutralWords = ["ok", "okay", "hmm", "hahaha?", "hmm ok", "fine", "acha thik", "yo", "hmm okay"];

  // Keyword dictionaries
  const happyWords = [
    "haha",
    "lol",
    "love",
    "amazing",
    "great",
    "happy",
    "good",
    "acha",
    "achi",
    "bhalo",
    "mast",
    "maza",
    "maze",
    "khushi",
    "khush",
    "thanks",
    "thank you",
    "shukriya",
    "nice",
    "great",
    "wonderful",
    "😂",
    "🤣",
    "😊",
    "😄",
    "😍",
  ];
  const sadWords = [
    "sad",
    "miss",
    "hurt",
    "cry",
    "alone",
    "tension",
    "pressure",
    "pareshan",
    "dukhi",
    "udaas",
    "ghabrahat",
    "ro",
    "thak",
    "thak gya",
    "thak gyi",
    "exhausted",
    "stress",
    "😔",
    "🥺",
    "😭",
    "💔",
  ];
  const angryWords = [
    "angry",
    "hate",
    "stupid",
    "idiot",
    "gussa",
    "naraz",
    "bkwas",
    "annoy",
    "🤬",
    "😡",
  ];
  const crazyWords = [
    "crazy",
    "mad",
    "insane",
    "pagal",
    "pagalpan",
    "chill",
    "scene on",
    "🤪",
    "😜",
    "🤯",
  ];

  const stressWords = [
    "assignment",
    "exam",
    "midterm",
    "final",
    "paper",
    "prepare",
    "prep",
    "study",
    "homework",
    "kaam",
    "work",
    "load",
  ];

  // Emoji weight map
  const emojiScores = {
    "😂": { happy: 2 },
    "🤣": { happy: 3 },
    "😄": { happy: 1.5 },
    "😊": { happy: 1.2 },
    "😍": { happy: 2 },
    "🥺": { sad: 2 },
    "😔": { sad: 2.5 },
    "😭": { sad: 3 },
    "💔": { sad: 2 },
    "😡": { angry: 3 },
    "🤬": { angry: 3 },
    "🤪": { crazy: 2 },
    "😜": { crazy: 1.2 },
    "🤯": { crazy: 1.5 },
  };

  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const whole = (w: string) => new RegExp(`(^|\\s|[.,!?])${escape(w)}($|\\s|[.,!?])`, "i");

  const RECENT_WINDOW = 12;
  const recent = filtered.slice(-RECENT_WINDOW);

  // Recent mood trend scoring
  let trend = { happy: 0, sad: 0, angry: 0, crazy: 0 };

  filtered.forEach((msg) => {
    const raw = msg.message || "";
    const text = raw.toLowerCase();
    if (!text) return;

    // Neutral detection
    if (neutralWords.some((w) => whole(w).test(text))) {
      scores.normal += 0.3;
    }

    // Keyword detection
    happyWords.forEach((w) => whole(w).test(text) && (scores.happy += 1));
    sadWords.forEach((w) => whole(w).test(text) && (scores.sad += 1));
    angryWords.forEach((w) => whole(w).test(text) && (scores.angry += 1));
    crazyWords.forEach((w) => whole(w).test(text) && (scores.crazy += 1));
    stressWords.forEach((w) => whole(w).test(text) && (scores.sad += 1.3));

    // Emoji based scoring
    Object.keys(emojiScores).forEach((emoji) => {
      if (text.includes(emoji)) {
        const map = emojiScores[emoji];
        Object.entries(map).forEach(([k, v]) => (scores[k] += v));
      }
    });

    // Punctuation analysis
    if (raw.includes("!!!")) scores.crazy += 1.2;
    if (raw.includes("??")) scores.angry += 0.8;
    if (raw.includes("...")) scores.sad += 0.6;

    // Sarcasm detection
    if (/wow.*great|wah.*kya/i.test(text)) {
      scores.angry += 1.2;
    }

    // Overlong messages often indicate stress or anger
    const wordCount = raw.split(/\s+/).length;
    if (wordCount > 25) scores.sad += 0.7;

    // Recent-window trend boost
    if (recent.includes(msg)) {
      if (happyWords.some((w) => whole(w).test(text))) trend.happy++;
      if (sadWords.some((w) => whole(w).test(text))) trend.sad++;
      if (angryWords.some((w) => whole(w).test(text))) trend.angry++;
      if (crazyWords.some((w) => whole(w).test(text))) trend.crazy++;
    }

    // Reactions scoring
    if (msg.reactions) {
      for (const emoji of Object.keys(msg.reactions)) {
        if (emojiScores[emoji])
          Object.entries(emojiScores[emoji]).forEach(
            ([k, v]) => (scores[k] += v * 0.5)
          );
        else scores.normal += 0.1;
      }
    }
  });

  // Apply recent trend boost
  const trendTotal = Object.values(trend).reduce((a, b) => a + b, 0);
  if (trendTotal > 0) {
    scores.happy += trend.happy * 0.4;
    scores.sad += trend.sad * 0.5;
    scores.angry += trend.angry * 0.6;
    scores.crazy += trend.crazy * 0.5;
  }

  // Normalize academic stress bias
  scores.sad *= 0.9;

  // Determine mood
  const ordered = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [topMood, topScore] = ordered[0];
  const total = Object.values(scores).reduce((a, b) => a + b, 0);

  let mood = "Normal";
  if (topScore / total > 0.25) mood = capitalize(topMood);

  // Description
  const description = moodDescription(mood, scores, filtered);

  return { mood, scores, description };
}


function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function moodDescription(mood: string, scores: Record<string, number>, messages: any[]) {
  // we can be a bit more descriptive using the scores and message examples
  switch (mood) {
    case 'Happy': {
      const ex = findRepresentativeMessage(messages, ['😂','🤣','😍','😊','thanks','shukriya','khush','khushi','mast']);
      return `Mostly positive and friendly messages — laughs, gratitude and light banter detected. ${ex ? `Example: "${truncate(ex)}"` : ''}`;
    }
    case 'Sad': {
      const ex = findRepresentativeMessage(messages, ['tension','tired','😔','😭','pareshan','dukhi','thak']);
      return `There are signs of stress, worry, or sadness (assignments/exams or emotional lines). ${ex ? `Example: "${truncate(ex)}"` : ''}`;
    }
    case 'Angry': {
      const ex = findRepresentativeMessage(messages, ['😡','🤬','angry','hate','stupid','gussa']);
      return `Heated or annoyed messages detected — possible frustration or arguments. ${ex ? `Example: "${truncate(ex)}"` : ''}`;
    }
    case 'Crazy': {
      const ex = findRepresentativeMessage(messages, ['🤪','😜','crazy','pagal','scene on','!!!']);
      return `High-energy, joking, or chaotic messages — lots of memes, hype or playful chaos. ${ex ? `Example: "${truncate(ex)}"` : ''}`;
    }
    default:
      return 'Casual conversation without a dominant emotional tone.';
  }
}

function findRepresentativeMessage(messages: any[], tokens: string[]) {
  for (let i = messages.length - 1; i >= 0; i--) {
    const txt = (messages[i].message || '').toString().toLowerCase();
    for (const t of tokens) {
      if (t.length > 1 ? txt.includes(t) : txt.includes(t)) {
        return messages[i].message;
      }
    }
  }
  return null;
}

function truncate(s: string | null | undefined, n = 120) {
  if (!s) return '';
  if (s.length <= n) return s;
  return `${s.slice(0, n)}...`;
}

export function ChatAnalytics({ data, onReset, isLoading = false }: ChatAnalyticsProps) {
  // ——— LOADING SPINNER ———
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0B141A]">
        <div className="text-center space-y-4">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-[#1F2C34] rounded-full animate-spin"></div>
            <div
              className="absolute top-0 left-0 w-16 h-16 border-4 border-t-[#00A884] border-r-[#00A884] border-b-transparent border-l-transparent rounded-full animate-spin"
              style={{ animationDelay: '-0.3s' }}
            ></div>
          </div>
          <p className="text-[#8696A0] text-lg animate-pulse">Analyzing your chat...</p>
        </div>
      </div>
    );
  }

  const [selectedUser, setSelectedUser] = useState('Overall');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [darkMode, setDarkMode] = useState(true);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const userInsights = getUserInsights(data.messages);

  const stats = getStats(data.messages, selectedUser);
  const busiestUsers = getBusiestUsers(data.messages);
  const commonWords = getCommonWords(data.messages, selectedUser);
  const emojis = getEmojis(data.messages, selectedUser);
  const activityByDay = getActivityByDay(data.messages, selectedUser);
  const activityByMonth = getActivityByMonth(data.messages, selectedUser);

  const filteredMessages = data.messages.filter(
    (m) =>
      !m.isNotification &&
      !m.message.includes('Messages and calls are end-to-end encrypted.')
  );

  // MOOD
  const moodResult = useMemo(() => detectMoodFromMessages(filteredMessages, selectedUser), [filteredMessages, selectedUser]);

  // ——— USER INSIGHTS ———
  const sortedInsights = [...userInsights].sort((a, b) => b.totalWords - a.totalWords);
  const showAll = sortedInsights.length === 2;
  const topCount = showAll ? sortedInsights.length : Math.ceil(sortedInsights.length * 0.05);
  const topInsights = sortedInsights.slice(0, topCount);

  const filteredInsights = selectedUser === 'Overall'
    ? topInsights
    : userInsights.filter(u => u.user === selectedUser);

  const firstMessage = filteredMessages[0] || null;
  const lastMessage = filteredMessages[filteredMessages.length - 1] || null;

  // ——— SEARCH ———
  const searchedMessages = useMemo(() => {
    if (!searchQuery.trim()) return filteredMessages;
    const query = searchQuery.toLowerCase();
    return filteredMessages.filter(m =>
      (m.message || '').toLowerCase().includes(query) ||
      (m.user || '').toLowerCase().includes(query)
    );
  }, [filteredMessages, searchQuery]);

  // ——— GROUP BY DATE ———
  const groupedMessages = useMemo(() => {
    const sorted = [...searchedMessages].sort((a, b) =>
      sortOrder === 'desc'
        ? b.date.getTime() - a.date.getTime()
        : a.date.getTime() - b.date.getTime()
    );

    const groups: Record<string, typeof searchedMessages> = {};

    sorted.forEach((msg) => {
      const date = msg.date;
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);

      let key: string;
      if (
        date.getDate() === today.getDate() &&
        date.getMonth() === today.getMonth() &&
        date.getFullYear() === today.getFullYear()
      ) {
        key = 'Today';
      } else if (
        date.getDate() === yesterday.getDate() &&
        date.getMonth() === yesterday.getMonth() &&
        date.getFullYear() === yesterday.getFullYear()
      ) {
        key = 'Yesterday';
      } else {
        key = date.toLocaleDateString('en-US', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });
      }

      if (!groups[key]) groups[key] = [];
      groups[key].push(msg);
    });

    return Object.entries(groups).sort(([a], [b]) => {
      if (a === 'Today') return -1;
      if (b === 'Today') return 1;
      if (a === 'Yesterday') return -1;
      if (b === 'Yesterday') return 1;
      const dateA = new Date(a.includes(',') ? a : `${a}, ${new Date().getFullYear()}`);
      const dateB = new Date(b.includes(',') ? b : `${b}, ${new Date().getFullYear()}`);
      return sortOrder === 'desc'
        ? dateB.getTime() - dateA.getTime()
        : dateA.getTime() - dateB.getTime();
    });
  }, [searchedMessages, sortOrder]);

  // ——— JUMP TO DATE ———
  const scrollToDate = (dateLabel: string) => {
    const element = document.getElementById(`date-${dateLabel}`);
    if (element && chatContainerRef.current) {
      const container = chatContainerRef.current;
      const offset = element.offsetTop - container.offsetTop - 20;
      container.scrollTo({ top: offset, behavior: 'smooth' });
    }
  };

  // ——— EXPORT TXT ———
  const exportAsTxt = () => {
    const lines: string[] = [];
    groupedMessages.forEach(([dateLabel, msgs]) => {
      lines.push(`\n--- ${dateLabel} ---\n`);
      msgs.forEach(msg => {
        const time = msg.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const edited = msg.isEdited ? ' (edited)' : '';
        const reactions = msg.reactions ? ` ${Object.entries(msg.reactions).map(([e, u]) => `${e}${u.length > 1 ? u.length : ''}`).join(' ')}` : '';
        lines.push(`[${time}] ${msg.user}: ${msg.message}${edited}${reactions}`);
      });
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `whatsapp-chat-${selectedUser === 'Overall' ? 'group' : selectedUser}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ——— AVATAR ———
  const getAvatarUrl = (user: string) => {
    return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user)}`;
  };

  const handleExportPDF = () => {
    exportToPDF(
      selectedUser,
      stats,
      busiestUsers,
      commonWords,
      emojis,
      activityByDay,
      activityByMonth
    );
  };

  // ——— WHATSAPP DARK MODE COLORS ———
  const bg = darkMode ? 'bg-[#0B141A]' : 'bg-white';
  const text = darkMode ? 'text-[#E9EDF0]' : 'text-gray-900';
  const cardBg = darkMode ? 'bg-[#111B21] border-[#222D34]' : 'bg-white border-gray-200';
  const inputBg = darkMode ? 'bg-[#1F2C34] border-[#2A3942]' : 'bg-white border-gray-300';
  const bubbleMe = darkMode ? 'bg-[#005C4B] text-white' : 'bg-green-600 text-white';
  const bubbleOther = darkMode ? 'bg-[#202C33] text-[#E9EDF0]' : 'bg-gray-200 text-gray-900';
  const dateBadge = darkMode ? 'bg-[#182229] text-[#8696A0]' : 'bg-gray-300 text-gray-700';
  const placeholder = darkMode ? 'placeholder-[#8696A0]' : 'placeholder-gray-500';

  return (
    <div className={`min-h-screen ${bg} ${text} transition-colors duration-200`}>
      <div className="space-y-6 p-4 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-[#128C7E] text-white p-4">
          <div className="w-full sm:w-64">
            <label className={`text-sm font-medium mb-2 block text-white`}>
              Analyze for:
            </label>
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger className={`bg-[#25D366] text-white`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#128C7E] border-white text-white">
                <SelectItem value="Overall" className="text-white">Overall</SelectItem>
                {data.users.map((user) => (
                  <SelectItem key={user} value={user} className="text-white">{user}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 items-center">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setDarkMode(!darkMode)}
              className={`h-9 w-9 bg-[#25D366] text-white border-white`}
            >
              {darkMode ? <Sun className="h-4 w-4 text-white" /> : <Moon className="h-4 w-4 text-white" />}
            </Button>

            <Button onClick={handleExportPDF} className="gap-2 bg-white text-[#128C7E]">
              <Download className="w-4 h-4" />
              Export PDF
            </Button>

            <Button onClick={exportAsTxt} variant="outline" className="gap-2 border-white text-white">
              <Download className="w-4 h-4" />
              Export TXT
            </Button>

            <Button onClick={onReset} variant="outline" className="border-white text-white">
              Upload New Chat
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div id="analytics-content">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
            <StatsCard title="Total Messages" value={stats.totalMessages} icon={MessageSquare} darkMode={darkMode} className={darkMode ? 'bg-[#111B21] border-[#222D34]' : ''} />
            <StatsCard title="Total Words" value={stats.totalWords} icon={FileText} darkMode={darkMode} className={darkMode ? 'bg-[#111B21] border-[#222D34]' : ''} />
            <StatsCard title="Media Shared" value={stats.totalMedia} icon={Image} darkMode={darkMode} className={darkMode ? 'bg-[#111B21] border-[#222D34]' : ''} />
            <StatsCard title="Links Shared" value={stats.totalLinks} icon={Link2} darkMode={darkMode} className={darkMode ? 'bg-[#111B21] border-[#222D34]' : ''} />
            {/* Mood Detector Card */}
            <Card className={`p-4 ${cardBg} flex flex-col justify-center items-start`}>
              <div className="flex items-center gap-3">
                <Smile className={`h-6 w-6 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`} />
                <div>
                  <div className="text-sm font-semibold">Mood Detector</div>
                  <div className="text-xs mt-1 text-[#8696A0]">Overall: <span className="font-medium text-white">{moodResult.mood}</span></div>
                </div>
              </div>

              <div className="mt-3 w-full">
                {/* simple bar visualization */}
                {Object.entries(moodResult.scores).map(([k, v]) => (
                  <div key={k} className="text-xs mb-2">
                    <div className="flex justify-between">
                      <span className="capitalize">{k}</span>
                      <span>{Math.round(Number(v))}</span>
                    </div>
                    <div className="h-2 bg-[#182229] rounded mt-1 overflow-hidden">
                      <div style={{ width: `${Math.min(100, Number(v) * 12)}%` }} className="h-full bg-[#00A884]" />
                    </div>
                  </div>
                ))}
                <p className="mt-2 text-xs text-[#8696A0]">{moodResult.description}</p>
              </div>
            </Card>
          </div>

          {/* First & Last Message */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <Card className={`p-6 ${cardBg}`}>
              <h2 className="text-xl font-semibold mb-4">First Message</h2>
              {firstMessage ? (
                <>
                  <p className="mb-1"><strong>Sender:</strong> {firstMessage.user}</p>
                  <p className={`text-sm mb-2 ${darkMode ? 'text-[#8696A0]' : 'text-gray-600'}`}>
                    {firstMessage.date.toLocaleString()}
                  </p>
                  <p className={`text-sm line-clamp-3 ${darkMode ? 'text-[#E9EDF0]' : 'text-gray-700'}`}>
                    <strong>Message:</strong> {firstMessage.message}
                  </p>
                </>
              ) : (
                <p className="italic text-[#8696A0]">No valid messages found.</p>
              )}
            </Card>

            <Card className={`p-6 ${cardBg}`}>
              <h2 className="text-xl font-semibold mb-4">Last Message</h2>
              {lastMessage ? (
                <>
                  <p className="mb-1"><strong>Sender:</strong> {lastMessage.user}</p>
                  <p className={`text-sm mb-2 ${darkMode ? 'text-[#8696A0]' : 'text-gray-600'}`}>
                    {lastMessage.date.toLocaleString()}
                  </p>
                  <p className={`text-sm line-clamp-3 ${darkMode ? 'text-[#E9EDF0]' : 'text-gray-700'}`}>
                    <strong>Message:</strong> {lastMessage.message}
                  </p>
                </>
              ) : (
                <p className="italic text-[#8696A0]">No valid messages found.</p>
              )}
            </Card>
          </div>

          {/* User Insights */}
          <Card className={`p-6 mb-6 ${cardBg}`}>
            <h2 className="text-xl font-semibold mb-4">
              User Insights
              {selectedUser === 'Overall' && (
                <span className={`text-sm font-normal ${darkMode ? 'text-[#8696A0]' : 'text-gray-600'}`}>
                  {' '}
                  {showAll ? '(All Users)' : `All  Users`}

                </span>
              )}
              {selectedUser !== 'Overall' && (
                <span className={`${darkMode ? 'text-[#8696A0]' : 'text-gray-600'}`}> – {selectedUser}</span>
              )}
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredInsights.map((u, idx) => {
                const colors = ['bg-emerald-500', 'bg-cyan-500', 'bg-orange-500', 'bg-amber-500', 'bg-teal-600'];
                const headerBg = colors[idx % colors.length];

                return (
                  <div key={u.user} className={`flex flex-col rounded-lg border ${darkMode ? 'bg-[#111B21] border-[#222D34]' : 'bg-white border-gray-200'} overflow-hidden shadow-sm`}>
                    <div className={`${headerBg} px-4 py-3 text-white font-bold text-lg`}>
                      {u.user}
                    </div>
                    <div className="flex-1 p-4 space-y-3 text-sm">
                      <p className="flex items-center gap-3">
                        <BarChart3 className={`h-5 w-5 ${darkMode ? 'text-emerald-400' : 'text-emerald-600'}`} />
                        <span><strong>Total words:</strong> {u.totalWords.toLocaleString()}</span>
                      </p>
                      <p className="flex items-center gap-3">
                        <Smile className={`h-5 w-5 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`} />
                        <span><strong>Top emojis:</strong> {u.mostUsedEmojis.slice(0, 5).join(' ') || '—'}</span>
                      </p>
                      <p className="flex items-center gap-3">
                        <MessageIcon className={`h-5 w-5 ${darkMode ? 'text-[#8696A0]' : 'text-gray-600'}`} />
                        <span><strong>Longest:</strong> {u.longestMessageLength} words</span>
                      </p>
                      <p className="flex items-center gap-3">
                        <Star className={`h-5 w-5 ${darkMode ? 'text-yellow-400' : 'text-yellow-600'}`} />
                        <span><strong>Wordstock:</strong> {u.uniqueWords}</span>
                      </p>
                      <p className="flex items-center gap-3">
                        <TrendingUp className={`h-5 w-5 ${darkMode ? 'text-green-400' : 'text-green-600'}`} />
                        <span><strong>Avg words/msg:</strong> {isNaN(u.avgWordsPerMessage) ? '—' : Math.round(u.avgWordsPerMessage)}</span>
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Chat Preview */}
          <Card className={`p-6 mb-6 ${cardBg}`}>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
              <h2 className="text-xl font-semibold">Chat Preview</h2>
              <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:flex-initial">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#8696A0]" />
                  <Input
                    placeholder="Search messages..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={`pl-10 pr-3 py-1.5 text-sm ${inputBg} ${placeholder}`}
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                  className={`flex items-center gap-2 text-xs ${darkMode ? 'bg-[#1F2C34] border-[#2A3942] hover:bg-[#2A3942]' : 'bg-white border-gray-300'}`}
                >
                  {sortOrder === 'desc' ? <><ArrowDown className="w-4 h-4" /> Newest</> : <><ArrowUp className="w-4 h-4" /> Oldest</>}
                </Button>
              </div>
            </div>

            {groupedMessages.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
                {groupedMessages.map(([dateLabel]) => (
                  <Button
                    key={dateLabel}
                    variant="ghost"
                    size="sm"
                    onClick={() => scrollToDate(dateLabel)}
                    className={`text-xs ${darkMode ? 'text-[#8696A0] hover:text-white hover:bg-[#2A3942]' : 'text-gray-600 hover:text-gray-900'}`}
                  >
                    <Calendar className="w-3 h-3 mr-1" />
                    {dateLabel}
                  </Button>
                ))}
              </div>
            )}

            <div
              ref={chatContainerRef}
              className={`h-96 overflow-y-auto rounded-lg p-4 space-y-6 ${darkMode ? 'bg-[#0B141A] bg-[url(\"/whatsapp-bg.png\")] bg-repeat' : 'bg-gray-50'}`}
            >
              {groupedMessages.length > 0 ? (
                groupedMessages.map(([dateLabel, msgs]) => (
                  <div key={dateLabel} id={`date-${dateLabel}`} className="space-y-3">
                    <div className="flex justify-center my-2">
                      <span className={`text-xs px-3 py-1 rounded-full ${dateBadge}`}>
                        {dateLabel}
                      </span>
                    </div>

                    {msgs.map((msg, i) => {
                      const msgIndex = filteredMessages.indexOf(msg);
                      const isMe = selectedUser !== 'Overall' && msg.user === selectedUser;
                      const avatarUrl = getAvatarUrl(msg.user);

                      return (
                        <div key={i} className={`flex ${isMe ? 'justify-end' : 'justify-start'} items-end gap-2`}>
                          {!isMe && (
                            <div className="w-8 h-8 rounded-full bg-[#2A3942] flex items-center justify-center text-xs font-bold text-white overflow-hidden">
                              {avatarUrl ? (
                                <img src={avatarUrl} alt={msg.user} className="w-full h-full object-cover" />
                              ) : (
                                msg.user?.charAt(0).toUpperCase()
                              )}
                            </div>
                          )}

                          <div className={`max-w-xs px-3 py-2 rounded-lg ${isMe ? bubbleMe : bubbleOther}`}>
                            {msg.isNotification ? (
                              <p className={`text-xs italic text-center ${darkMode ? 'text-[#8696A0]' : 'text-gray-500'}`}>
                                {msg.message}
                              </p>
                            ) : (
                              <>
                                {selectedUser === 'Overall' && !isMe && (
                                  <p className="text-xs font-semibold text-[#00A884] mb-1">{msg.user}</p>
                                )}
                                <p className="text-sm break-words">{msg.message}</p>

                                {/* show edited indicator as its own line */}
                                {msg.isEdited && (
                                  <p className="text-xs italic mt-1" style={{ color: darkMode ? '#8696A0' : '#6B7280' }}>
                                    (edited)
                                  </p>
                                )}

                                {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                                  <div className="flex gap-1 mt-1 flex-wrap">
                                    {Object.entries(msg.reactions).map(([emoji, users]) => (
                                      <span
                                        key={emoji}
                                        className={`text-xs px-1.5 py-0.5 rounded-full ${darkMode ? 'bg-[#2A3942]' : 'bg-gray-300'}`}
                                        title={users.join(', ')}
                                      >
                                        {emoji}{users.length > 1 && users.length}
                                      </span>
                                    ))}
                                  </div>
                                )}

                                <div className="flex items-center justify-end gap-1 mt-1 text-xs text-[#8696A0]">
                                  <span>
                                    {msg.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                              </>
                            )}
                          </div>

                          {isMe && (
                            <div className="w-8 h-8 rounded-full bg-[#00A884] flex items-center justify-center text-xs font-bold text-white overflow-hidden">
                              {avatarUrl ? (
                                <img src={avatarUrl} alt={msg.user} className="w-full h-full object-cover" />
                              ) : (
                                msg.user?.charAt(0).toUpperCase()
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))
              ) : (
                <p className={`text-center ${darkMode ? 'text-[#8696A0]' : 'text-gray-500'}`}>
                  No messages match your search.
                </p>
              )}
            </div>

            <p className={`mt-2 text-sm text-right ${darkMode ? 'text-[#8696A0]' : 'text-gray-600'}`}>
              {searchedMessages.length} message{searchedMessages.length !== 1 ? 's' : ''} shown
            </p>
          </Card>

          {/* Charts */}
          {selectedUser === 'Overall' && busiestUsers.length > 0 && (
            <Card className={`p-6 mb-6 ${cardBg}`}>
              <h2 className="text-xl font-semibold mb-4">Most Active Users</h2>
              <BusiestUsersChart data={busiestUsers} />
            </Card>
          )}

          {commonWords.length > 0 && (
            <Card className={`p-6 mb-6 ${cardBg}`}>
              <h2 className="text-xl font-semibold mb-4">Most Common Words</h2>
              <CommonWordsChart data={commonWords} />
            </Card>
          )}

          {emojis.length > 0 && (
            <div className="mb-6">
              <EmojiAnalysis data={emojis} />
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className={`p-6 ${cardBg}`}>
              <h2 className="text-xl font-semibold mb-4">Activity by Day</h2>
              <ActivityChart data={activityByDay} dataKey="day" />
            </Card>
            <Card className={`p-6 ${cardBg}`}>
              <h2 className="text-xl font-semibold mb-4">Activity by Month</h2>
              <ActivityChart data={activityByMonth} dataKey="monthYear" />
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
