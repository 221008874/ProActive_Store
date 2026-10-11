// Bottom sheet and toast.
//
// Both are the "transient surface" half of the design system: the sheet for
// anything that takes over the screen on a phone (filters, menu, map editor),
// the toast for confirming an action the shopper just took.
//
// Accessibility is the reason these exist as components rather than markup:
// a sheet must trap focus, close on Escape and restore focus on close, and a
// toast must be announced without stealing focus. Getting that right per call
// site is where it goes wrong.

import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from "react";
import { IconClose } from "./icons";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * BottomSheet — slides up from the bottom, 12px top corners, dimmed backdrop,
 * drag handle, optional sticky footer.
 *
 * Traps Tab inside itself, closes on Escape or backdrop click, locks the page
 * behind it, and returns focus to whatever opened it.
 */
export function BottomSheet({ title, onClose, footer, children, className = "" }) {
  const sheetRef = useRef(null);
  const headingId = useId();
  const openerRef = useRef(null);

  // Captured at mount, before the sheet can steal focus, so closing gives the
  // shopper back the control they used.
  useEffect(() => {
    try { openerRef.current = document.activeElement } catch { /* non-DOM */ }
    return () => {
      const opener = openerRef.current;
      if (opener && typeof opener.focus === "function") opener.focus();
    };
  }, []);

  // Focus the dialog itself (not its first control) so the screen reader
  // announces the dialog name before its content.
  useEffect(() => { sheetRef.current?.focus?.(); }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") { e.stopPropagation(); onClose?.(); return; }
      if (e.key !== "Tab") return;
      const nodes = Array.from(sheetRef.current?.querySelectorAll(FOCUSABLE) ?? [])
        .filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  // Lock the page behind the sheet without letting the lock outlive it.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev };
  }, []);

  return (
    <>
      <div className="pa-sheet-backdrop" onClick={onClose} />
      <div
        ref={sheetRef}
        className={`pa-sheet pa-sheet--open ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        tabIndex={-1}
      >
        <div className="pa-sheet__grip" aria-hidden="true" />
        {(title || onClose) && (
          <div className="pa-sheet__head">
            {title && <h2 id={headingId} className="pa-sheet__title">{title}</h2>}
            <button type="button" className="pa-icon-btn" style={{ width: 44, height: 44 }} aria-label="Close" onClick={onClose}>
              <IconClose width={22} height={22} />
            </button>
          </div>
        )}
        <div className="pa-sheet__body">{children}</div>
        {footer && <div className="pa-sheet__foot">{footer}</div>}
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------- */

const ToastContext = createContext(null);

/**
 * Toast stack: one provider at the app root, `useToast()` anywhere below it.
 *
 * A toast is announced politely and never takes focus, so it cannot interrupt
 * someone mid-typing. Only one toast shows at a time — a new one replaces the
 * old rather than stacking into an unreadable pile.
 */
export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const timer = useRef(null);

  const show = useCallback((message, options = {}) => {
    setToast({
      message,
      actionLabel: options.actionLabel,
      onAction: options.onAction,
      duration: options.duration ?? 4000
    });
  }, []);
  const hide = useCallback(() => setToast(null), []);

  useEffect(() => () => clearTimeout(timer.current), []);

  useEffect(() => {
    if (!toast) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), toast.duration);
    return () => clearTimeout(timer.current);
  }, [toast]);

  return (
    <ToastContext.Provider value={{ show, hide }}>
      {children}
      {/* aria-live on the region rather than the toast, so a replacement is
          still announced; the region stays mounted and empty otherwise. */}
      <div className="pa-toast-stack" role="status" aria-live="polite">
        {toast && (
          <div className="pa-toast">
            <span>{toast.message}</span>
            {toast.actionLabel && (
              <button type="button" className="pa-toast__action" onClick={() => { toast.onAction?.(); hide(); }}>
                {toast.actionLabel}
              </button>
            )}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

/** `show(message, { actionLabel, onAction, duration })`. */
export function useToast() {
  return useContext(ToastContext) ?? { show: () => {}, hide: () => {} };
}
