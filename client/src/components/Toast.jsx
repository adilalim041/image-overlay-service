import React from 'react';

export default function Toast({ show, message, type = 'success' }) {
  if (!show) return null;
  return (
    <div className="glass-panel fixed bottom-4 left-1/2 z-50 -translate-x-1/2 animate-[toastUp_0.2s_ease] rounded-xl px-4 py-2 text-[13px] text-[var(--text-primary)] shadow-[0_0_0_1px_var(--accent),0_0_16px_var(--accent-glow)]">
      <span className="mr-2">{type === 'warning' ? '⚠' : '✓'}</span>
      {message}
    </div>
  );
}
