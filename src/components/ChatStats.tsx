import { StatsCard } from "@/components/StatsCard";
import { MessageSquare, FileText, Image, Link2, Play } from "lucide-react";
import { getStats } from "@/lib/chatParser";

interface ChatStatsProps {
  messages: any[];
  selectedUser: string;
}


export function ChatStats({ messages, selectedUser }: ChatStatsProps) {
  const stats = getStats(messages, selectedUser);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <StatsCard title="Total Messages" value={stats.totalMessages} icon={MessageSquare} />
      <StatsCard title="Total Words" value={stats.totalWords} icon={FileText} />
      <StatsCard title="Media Shared" value={stats.totalMedia} icon={Image} />
      <StatsCard title="Links Shared" value={stats.totalLinks} icon={Link2} />
      <StatsCard title="Messages with Media" value={stats.messagesWithMedia} icon={Play} />
    </div>
  );
}
