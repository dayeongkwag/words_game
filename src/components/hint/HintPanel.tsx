import { Modal } from '@/components/common/Modal';
import type { HintAvailability } from '@/game/hintSystem';
import type { HintType } from '@/types';

interface HintPanelProps {
  open: boolean;
  availability: HintAvailability;
  onClose: () => void;
  onSelect: (type: HintType) => void;
}

/**
 * 힌트 선택 UI. (요구사항 26)
 * 각 힌트의 차감 점수와 남은 횟수를 함께 보여 준다.
 * 점수 값은 hintSystem 이 gameConfig 로부터 계산한 것을 그대로 표시한다.
 */
export function HintPanel({ open, availability, onClose, onSelect }: HintPanelProps) {
  return (
    <Modal open={open} title="힌트를 선택하세요" onClose={onClose}>
      <p className="hint-panel__remaining">
        남은 힌트 <strong>{availability.remaining}</strong> / {availability.max}회
      </p>

      <ul className="hint-panel__options">
        {availability.options.map((option) => (
          <li key={option.type}>
            <button
              type="button"
              className="hint-option"
              disabled={!option.enabled}
              onClick={() => {
                onSelect(option.type);
                onClose();
              }}
            >
              <span className="hint-option__main">
                <span className="hint-option__label">{option.label}</span>
                <span className="hint-option__desc">
                  {option.enabled ? option.description : option.disabledReason}
                </span>
              </span>
              <span className={`hint-option__cost ${option.cost === 0 ? 'hint-option__cost--free' : ''}`}>
                {option.cost === 0 ? '무료' : `-${option.cost}점`}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
