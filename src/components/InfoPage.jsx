// Legal / informational page shell.
//
// Privacy, About and Terms are the same shape of page: a back link, a title, a
// "last updated" line, and a column of prose. Before this existed each page
// rolled its own, and they drifted apart badly enough that the review caught:
//
//   * the title rendered OUTSIDE .pa-container while the body rendered inside
//     it, so in RTL the title's start edge sat flush against the viewport and
//     the first glyphs were clipped at x=1270 on a 1280px screen;
//   * the back control was a bordered Button as the first child of a flex row,
//     which in RTL pushed it to x=0 — glued to the screen edge, no gutter;
//   * the closing rule was a direct child of the page, so it spanned the full
//     viewport (~60–1860px) while the heading above it spanned the container
//     (~110–1810px).
//
// Everything here is logical-property only (inline-start/end, margin-inline,
// padding-block). Nothing measures the viewport in JS: the reading column is a
// max-width on a container that is already centred, so RTL is a mirror of the
// LTR layout for free rather than a special case with its own rules.
//
// Date formatting lives in utils/policyDate.js — a component file that exports
// a helper forces a full reload on every edit in dev (react-refresh).

import { Link } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext'
import { IconBack } from '../ui'
import { formatPolicyDate, policyDateMachine } from '../utils/policyDate'

/**
 * @param title        the page heading
 * @param updatedAt    ISO string | Date — the document's revision date, as
 *                     content metadata rather than a literal in the markup
 * @param contentLang  which language the document is written in ('ar' | 'en');
 *                     decides the date's digits, not the UI's
 * @param updatedLabel "Last updated" / "آخر تحديث"
 * @param backHref     where the text link returns to (default /home)
 * @param backLabel    its text
 * @param children     the prose sections
 */
export default function InfoPage({
  title,
  updatedAt,
  contentLang = 'en',
  updatedLabel,
  backHref = '/home',
  backLabel,
  children
}) {
  // lang is read so a language switch re-renders the date even when the
  // document's own contentLang did not change (the Arabic revision of a page
  // that is still showing the English one).
  useLanguage();

  const machine = policyDateMachine(updatedAt);

  return (
    <div className="pa-info">
      {/* Full-bleed band, container inside: the heading and the body share one
          measure, so they cannot disagree about where the start edge is. */}
      <div className="pa-container pa-info__container">
        <div className="pa-info__col">
          {/* Text link above the title, not a button beside it. A control in the
              flex row lands at the outer edge in RTL; above the title it lands
              on the reading edge with the rest of the content. */}
          <Link to={backHref} className="pa-info__back">
            <IconBack width={18} height={18} />
            <span>{backLabel}</span>
          </Link>

          <h1 className="pa-info__title">{title}</h1>

          {machine && (
            <p className="pa-info__updated">
              {updatedLabel}{' '}
              <time dateTime={machine}>{formatPolicyDate(updatedAt, contentLang)}</time>
            </p>
          )}

          <div className="pa-info__body">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
