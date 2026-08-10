import type { PlayRecord } from '@/types';
import { formatDuration, formatScore } from '@/utils/format';

interface RecordListProps {
  records: PlayRecord[];
  title?: string;
  emptyText?: string;
}

/** 최근 기록 목록. (요구사항 34) */
export function RecordList({
  records,
  title = '최근 플레이',
  emptyText = '아직 기록이 없습니다. 첫 퍼즐을 풀어 보세요.',
}: RecordListProps) {
  return (
    <section className="records" aria-label={title}>
      <h2 className="records__title">{title}</h2>
      {records.length === 0 ? (
        <p className="records__empty">{emptyText}</p>
      ) : (
        <ol className="records__list">
          {records.map((record, index) => (
            <li key={record.recordId} className="records__item">
              <span className="records__rank">{index + 1}</span>
              <span className="records__score">{formatScore(record.score)}점</span>
              <span className="records__time">{formatDuration(record.elapsedMs)}</span>
              <span
                className={`records__status ${
                  record.status === 'COMPLETED' ? 'records__status--clear' : ''
                }`}
              >
                {record.status === 'COMPLETED' ? '클리어' : `${record.solvedWords}/${record.totalWords}`}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
