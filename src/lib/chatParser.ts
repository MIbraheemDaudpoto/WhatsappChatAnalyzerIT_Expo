export interface ChatMessage {
  date: Date;
  user: string;
  message: string;
  isMedia: boolean;
  isNotification: boolean;
  isEdited?: boolean;   
  isCall?: boolean,
  callType?: "voice" | "video",
  callDuration?: number,
  callDirection?: "incoming" | "outgoing",
  reactions: string
}

export interface ParsedChat {
  messages: ChatMessage[];
  users: string[];
}

export interface ChatStats {
  totalMessages: number;
  totalWords: number;
  totalMedia: number;
  totalLinks: number;
  messagesWithMedia: number; // NEW
}

export function getUserInsights(messages) {
  const userStats = {};

  messages.forEach(msg => {
    if (!msg.user || !msg.message) return;

    if (!userStats[msg.user]) {
      userStats[msg.user] = {
        totalWords: 0,
        emojis: {},
        longestMessage: "",
        wordSet: new Set(),
        totalMessages: 0
      };
    }

    const words = msg.message.split(/\s+/);
    const emojis = msg.message.match(/\p{Emoji_Presentation}/gu) || [];

    userStats[msg.user].totalWords += words.length;
    userStats[msg.user].totalMessages++;
    emojis.forEach(e => {
      userStats[msg.user].emojis[e] = (userStats[msg.user].emojis[e] || 0) + 1;
    });
    words.forEach(w => userStats[msg.user].wordSet.add(w.toLowerCase()));

    if (words.length > userStats[msg.user].longestMessage.split(/\s+/).length) {
      userStats[msg.user].longestMessage = msg.message;
    }
  });


  return Object.entries(userStats).map(([user, stats]) => ({
    user,
    totalWords: stats.totalWords,
    mostUsedEmojis: Object.entries(stats.emojis)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([emoji]) => emoji),
    longestMessageLength: stats.longestMessage.split(/\s+/).length,
    uniqueWords: stats.wordSet.size,
    avgWordsPerMessage: (stats.totalWords / stats.totalMessages).toFixed(1),
  }));
}

export function parseWhatsAppChat(text: string): ParsedChat {
  const lines = text.split("\n");
  const messages: ChatMessage[] = [];
  const users = new Set<string>();

  // Pattern for WhatsApp messages: "DD/MM/YY, HH:MM AM/PM - User: Message"
  const messagePattern =
    /^(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s*(\d{1,2}:\d{2})\s*(AM|PM|am|pm)?\s*-\s*([^:]+):\s*(.+)$/;
  const notificationPattern =
    /^(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s*(\d{1,2}:\d{2})\s*(AM|PM|am|pm)?\s*-\s*(.+)$/;

  let currentMessage: ChatMessage | null = null;

  for (const line of lines) {
    const messageMatch = line.match(messagePattern);
    
    if (messageMatch) {
      // Save previous message if exists
      if (currentMessage) {
        messages.push(currentMessage);
      }

      const [, dateStr, timeStr, , user, message] = messageMatch;
      const date = parseDate(dateStr, timeStr);

      currentMessage = {
        date,
        user: user.trim(),
        message: message.trim(),
        isMedia:
          message.includes("<Media omitted>") ||
          message.includes("image omitted") ||
          message.includes("video omitted") ||
          message.includes("audio omitted") ||
          message.includes("document omitted"),
        isNotification: false,
      };

      users.add(user.trim());
    } else {
      const notificationMatch = line.match(notificationPattern);

      if (notificationMatch) {
        if (currentMessage) messages.push(currentMessage);

        const [, dateStr, timeStr, , message] = notificationMatch;
        const date = parseDate(dateStr, timeStr);

        currentMessage = {
          date,
          user: "Group Notification",
          message: message.trim(),
          isMedia: false,
          isNotification: true,
        };
      } else if (currentMessage && line.trim()) {
        // Multi-line message continuation
        currentMessage.message += "\n" + line.trim();
      }
    }
  }

  // Add the last message
  if (currentMessage) {
    messages.push(currentMessage);
  }

  return {
    messages,
    users: Array.from(users)
      .filter((u) => u !== "Group Notification")
      .sort(),
  };
}

function parseDate(dateStr: string, timeStr: string): Date {
  const [day, month, year] = dateStr.split("/").map(Number);
  const [hour, minute] = timeStr.split(":").map(Number);
  const fullYear = year < 100 ? 2000 + year : year;
  return new Date(fullYear, month - 1, day, hour, minute);
}

// 🧠 UPDATED FUNCTION
export function getStats(messages: ChatMessage[], selectedUser: string): ChatStats {
  const filtered =
    selectedUser === "Overall"
      ? messages.filter((m) => !m.isNotification)
      : messages.filter((m) => m.user === selectedUser && !m.isNotification);

  const totalMessages = filtered.length;
  const totalWords = filtered.reduce(
    (sum, m) => sum + (m.isMedia ? 0 : m.message.split(/\s+/).length),
    0
  );

  const totalMedia = filtered.filter((m) => m.isMedia).length;

  const urlPattern = /(https?:\/\/[^\s]+)/g;
  const totalLinks = filtered.reduce((sum, m) => {
    const matches = m.message.match(urlPattern);
    return sum + (matches?.length || 0);
  }, 0);

  // ✅ NEW FEATURE — messages that contain text + media together
  const messagesWithMedia = filtered.filter(
    (m) => m.isMedia && m.message.split(/\s+/).length > 1
  ).length;

  return {
    totalMessages,
    totalWords,
    totalMedia,
    totalLinks,
    messagesWithMedia,
  };
}

export function getBusiestUsers(messages: ChatMessage[]) {
  const userCounts = new Map<string, number>();

  messages
    .filter((m) => !m.isNotification)
    .forEach((m) => {
      userCounts.set(m.user, (userCounts.get(m.user) || 0) + 1);
    });

  return Array.from(userCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
}

export function getCommonWords(messages: ChatMessage[], selectedUser: string) {
  const filtered =
    selectedUser === "Overall"
      ? messages.filter((m) => !m.isNotification && !m.isMedia)
      : messages.filter((m) => m.user === selectedUser && !m.isMedia);

  const wordCount = new Map<string, number>();
  const stopWords = new Set([
    "the", "is", "at", "which", "on", "a", "an", "and", "or", "but", "in", "with", "to", "for", "of", "as",
    "i", "you", "he", "she", "it", "we", "they", "me", "him", "her", "us", "them",
    "my", "your", "his", "its", "our", "their", "this", "that", "these", "those",
    "am", "are", "was", "were", "be", "been", "being", "have", "has", "had",
    "do", "does", "did", "will", "would", "should", "could", "may", "might", "must",
    "can", "hai", "ka", "ki", "ke", "ko", "se", "me", "ne", "hi", "ho", "na",
  ]);

  filtered.forEach((m) => {
    const words = m.message
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stopWords.has(w));

    words.forEach((word) => {
      wordCount.set(word, (wordCount.get(word) || 0) + 1);
    });
  });

  return Array.from(wordCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);
}

export function getEmojis(messages: ChatMessage[], selectedUser: string) {
  const filtered =
    selectedUser === "Overall"
      ? messages.filter((m) => !m.isNotification)
      : messages.filter((m) => m.user === selectedUser);

  const emojiCount = new Map<string, number>();
  const emojiRegex =
    /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;

  filtered.forEach((m) => {
    const emojis = m.message.match(emojiRegex);
    if (emojis) {
      emojis.forEach((emoji) => {
        emojiCount.set(emoji, (emojiCount.get(emoji) || 0) + 1);
      });
    }
  });

  return Array.from(emojiCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
}

export function getActivityByDay(messages: ChatMessage[], selectedUser: string) {
  const filtered =
    selectedUser === "Overall"
      ? messages.filter((m) => !m.isNotification)
      : messages.filter((m) => m.user === selectedUser);

  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const dayCount = new Map<string, number>();

  filtered.forEach((m) => {
    const day = days[m.date.getDay()];
    dayCount.set(day, (dayCount.get(day) || 0) + 1);
  });

  return days.map((day) => ({ day, count: dayCount.get(day) || 0 }));
}

export function getActivityByMonth(messages: ChatMessage[], selectedUser: string) {
  const filtered =
    selectedUser === "Overall"
      ? messages.filter((m) => !m.isNotification)
      : messages.filter((m) => m.user === selectedUser);

  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];

  const monthYearCount = new Map<string, number>();

  filtered.forEach((m) => {
    const month = months[m.date.getMonth()];
    const year = m.date.getFullYear();
    const key = `${month} ${year}`;
    monthYearCount.set(key, (monthYearCount.get(key) || 0) + 1);
  });

  // Sort by actual chronological order
  const sorted = Array.from(monthYearCount.entries()).sort((a, b) => {
    const [monthA, yearA] = a[0].split(" ");
    const [monthB, yearB] = b[0].split(" ");
    const dateA = new Date(`${monthA} 1, ${yearA}`);
    const dateB = new Date(`${monthB} 1, ${yearB}`);
    return dateA.getTime() - dateB.getTime();
  });

  return sorted.map(([monthYear, count]) => ({
    monthYear,
    count,
  }));
}

// New function for Mood Detector
export function getMoodAnalysis(messages: ChatMessage[], selectedUser: string) {
  const filtered =
    selectedUser === "Overall"
      ? messages.filter((m) => !m.isNotification)
      : messages.filter((m) => m.user === selectedUser);

  const moods = {
    Happy: ['lol', 'haha', 'great', 'awesome', 'love', 'excited', 'yay'],
    Sad: ['sad', 'cry', 'sorry', 'unhappy', 'depressed'],
    Angry: ['angry', 'mad', 'hate', 'furious', 'annoyed'],
    Crazy: ['crazy', 'insane', 'wild', 'nuts', 'mad'],
    Normal: [] // Default if no keywords match
  };

  const moodCounts = { Happy: 0, Sad: 0, Angry: 0, Crazy: 0, Normal: 0 };

  filtered.forEach((msg) => {
    const text = msg.message.toLowerCase();
    let detected = false;
    for (const [mood, keywords] of Object.entries(moods)) {
      if (mood === 'Normal') continue;
      if (keywords.some((k) => text.includes(k))) {
        moodCounts[mood]++;
        detected = true;
        break; // Use first matching mood
      }
    }
    if (!detected) moodCounts.Normal++;
  });

  return moodCounts;
}
