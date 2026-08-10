import { useEffect, useRef, type ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** 모바일에서 하단 시트 형태로 표시할지. (요구사항 22·42) */
  sheetOnMobile?: boolean;
}

/**
 * 공통 모달. 모바일에서는 하단 시트로 올라와 화면을 덜 가린다.
 * Esc 로 닫히고, 열려 있는 동안 배경 스크롤을 막는다.
 */
export function Modal({ open, title, onClose, children, sheetOnMobile = true }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal" role="presentation" onClick={onClose}>
      <div
        ref={panelRef}
        className={`modal__panel ${sheetOnMobile ? 'modal__panel--sheet' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal__header">
          <h2 className="modal__title">{title}</h2>
          <button type="button" className="modal__close" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>
        <div className="modal__body">{children}</div>
      </div>
    </div>
  );
}
