'use client';
import { digitsOnly } from '@/lib/validation';
import { PHOTO_PREFIX, PHOTO_MAX_DIGITS } from '@/lib/constants';

/** Invoerveld met vaste TLP-prefix. value/onChange werken met alleen de cijfers. */
export default function PhotoCodeInput({ id, value, onChange, error, label, showPreview = true, autoFocus }) {
  const digits = value || '';
  return (
    <div>
      <div className={`code-input${error ? ' has-error' : ''}`}>
        <span className="code-prefix" aria-hidden="true">{PHOTO_PREFIX}</span>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          maxLength={PHOTO_MAX_DIGITS + PHOTO_PREFIX.length}
          placeholder="024"
          aria-label={label || 'Fotonummer (alleen cijfers)'}
          aria-invalid={!!error}
          autoFocus={autoFocus}
          value={digits}
          onChange={(e) => onChange(digitsOnly(e.target.value))}
          onPaste={(e) => {
            e.preventDefault();
            onChange(digitsOnly(e.clipboardData.getData('text')));
          }}
        />
      </div>
      {showPreview && (
        <div className="code-preview" aria-live="polite">
          {digits ? <>Wordt opgeslagen als <b>{PHOTO_PREFIX}{digits}</b></> : <>Typ alleen de cijfers, bijvoorbeeld 024 → <b>{PHOTO_PREFIX}024</b></>}
        </div>
      )}
      {error && <div className="error-text" role="alert">{error}</div>}
    </div>
  );
}
