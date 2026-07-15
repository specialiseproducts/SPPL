import { parseBulletPoints } from './bulletPointUtils';

interface BulletPointListProps {
  text: string | undefined | null;
  emptyLabel?: string;
}

export default function BulletPointList({ text, emptyLabel = '—' }: BulletPointListProps) {
  const points = parseBulletPoints(text).filter((p) => p.trim().length > 0);

  if (points.length === 0) {
    return <span className="text-sm text-[#212529]">{emptyLabel}</span>;
  }

  return (
    <ul className="list-none space-y-1.5 text-sm text-[#212529]">
      {points.map((point, index) => (
        <li key={index} className="flex gap-2 break-words">
          <span className="shrink-0 font-medium text-gray-500">•</span>
          <span>{point}</span>
        </li>
      ))}
    </ul>
  );
}
