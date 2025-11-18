import { Card } from '@/components/ui/card';

interface EmojiAnalysisProps {
  data: [string, number][];
}

export function EmojiAnalysis({ data }: EmojiAnalysisProps) {
  const total = data.reduce((sum, [, count]) => sum + count, 0);

  return (
    <Card className="p-6">
      <h2 className="text-xl font-semibold mb-4">Emoji Analysis</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
        {data.map(([emoji, count]) => {
          const percentage = ((count / total) * 100).toFixed(1);
          return (
            <div key={emoji} className="flex flex-col items-center p-4 rounded-lg bg-muted hover:bg-muted/80 transition-colors">
              <span className="text-4xl mb-2">{emoji}</span>
              <span className="text-lg font-semibold">{count}</span>
              <span className="text-xs text-muted-foreground">{percentage}%</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
