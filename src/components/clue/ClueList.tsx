import type { ClueView } from '@/types';

interface ClueListProps {
  title: string;
  clues: ClueView[];
  selectedIndex: number | null;
  solved: readonly boolean[];
  onSelect: (index: number) => void;
}

/** 가로 또는 세로 문제 목록. (요구사항 16) */
export function ClueList({ title, clues, selectedIndex, solved, onSelect }: ClueListProps) {
  if (clues.length === 0) return null;

  return (
    <section className="clue-list" aria-label={`${title} 문제 목록`}>
      <h3 className="clue-list__title">{title}</h3>
      <ul>
        {clues.map((clue) => {
          const isSolved = solved[clue.index];
          const isSelected = selectedIndex === clue.index;
          return (
            <li key={`${clue.direction}-${clue.number}`}>
              <button
                type="button"
                className={[
                  'clue-item',
                  isSelected ? 'clue-item--active' : '',
                  isSolved ? 'clue-item--solved' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => onSelect(clue.index)}
                aria-current={isSelected ? 'true' : undefined}
              >
                <span className="clue-item__number">{clue.number}</span>
                <span className="clue-item__text">{clue.clue}</span>
                <span className="clue-item__meta">
                  {isSolved ? '완료' : `${clue.length}글자`}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
