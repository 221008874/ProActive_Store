// Form controls that sit next to the design system's Field: a native select,
// a checkbox row, a radio card, a colour selector and the admin stepper.
//
// All of them keep the platform control (real <select>, <input type=checkbox>)
// so keyboard and screen-reader behaviour is the browser's, not ours. Only the
// paint is custom, via the classes in components.css.

import { IconChevron } from "./icons";
import { swatchNeedsBorder } from "../utils/color";

/**
 * Select. Renders a native <select> with the board's 48px box (40px with
 * `admin`). `children` are the <option>s.
 */
export function Select({ id, label, hint, error, admin, className = "", children, ...rest }) {
  return (
    <div className={`pa-field ${className}`}>
      {label && <label className="pa-label" htmlFor={id}>{label}</label>}
      <select
        id={id}
        className={`pa-select ${admin ? "pa-input--admin" : ""}`}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error || hint ? `${id}-msg` : undefined}
        {...rest}
      >
        {children}
      </select>
      {(error || hint) && <div id={`${id}-msg`} className={error ? "pa-error" : "pa-subtitle"}>{error || hint}</div>}
    </div>
  );
}

/**
 * Checkbox with its label as the row. `plain` drops the 600 weight for dense
 * admin tables.
 */
export function Checkbox({ id, label, hint, checked, onChange, disabled, plain, className = "", ...rest }) {
  return (
    <div className={`pa-field ${className}`}>
      <label className={`pa-check ${plain ? "pa-check--plain" : ""}`} htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          checked={!!checked}
          disabled={disabled}
          onChange={(e) => onChange?.(e.target.checked, e)}
          {...rest}
        />
        <span>{label}{hint && <span className="pa-subtitle" style={{ display: "block", fontWeight: 400 }}>{hint}</span>}</span>
      </label>
    </div>
  );
}

/**
 * Radio card. The whole card is the <label> so tapping anywhere selects it;
 * state is exposed with aria-checked (not aria-pressed) because these are
 * radios. A disabled card is announced as disabled rather than hidden.
 */
export function RadioCard({ name, value, checked, onChange, title, description, disabled, id }) {
  return (
    <label
      className="pa-radio-card"
      htmlFor={id}
      role="radio"
      aria-checked={!!checked}
      aria-disabled={disabled ? "true" : undefined}
    >
      <input
        id={id}
        type="radio"
        name={name}
        value={value}
        checked={!!checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.value, e)}
      />
      <span>
        <b>{title}</b>
        {description && <span>{description}</span>}
      </span>
    </label>
  );
}

/**
 * Colour selector. A 44px hit target with a 38px painted circle (28px with
 * `small`), named for screen readers and pressed-state aware. `colors` is
 * [{ id, name: {ar,en}, hex }].
 *
 * The name is carried three ways on purpose: aria-label for assistive tech,
 * title for the hover tooltip, and both are on the element so the CSS tooltip
 * can read it. Light colours (white, off-white/beige) get a darker edge via
 * --sw-line — without it a white swatch and a beige swatch are two nearly
 * identical circles on paper and neither looks selected.
 */
export function ColorDot({ color, selected, onSelect, lang = "en", name, small, disabled, ...rest }) {
  const label = name ?? (color?.name && typeof color.name === "object"
    ? (color.name[lang] ?? color.name.en ?? color.id)
    : color?.name ?? color?.id);
  return (
    <button
      type="button"
      className={`pa-swatch ${small ? "pa-swatch--sm" : ""}`}
      style={{ "--sw": color?.hex, "--sw-line": swatchNeedsBorder(color?.hex) ? "var(--pa-ink)" : "var(--pa-muted)" }}
      aria-pressed={!!selected}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={() => onSelect?.(color?.id, color)}
      {...rest}
    />
  );
}

/**
 * Admin quantity stepper: 44x44 buttons around a 56px readout, for the quick
 * stock edit screen. The storefront's compact QtyStepper lives in commerce.jsx.
 */
export function StepperField({ value, onChange, min = 0, max = 99, labels = {} }) {
  const dec = labels.dec ?? "Decrease";
  const inc = labels.inc ?? "Increase";
  const numeric = Math.max(0, Math.floor(Number(value) || 0));
  return (
    <div className="pa-qty pa-qty--admin">
      <button type="button" aria-label={dec} disabled={numeric <= min} onClick={() => onChange?.(numeric - 1)}>
        <IconChevron dir="up" width={16} height={16} style={{ transform: "rotate(-90deg)" }} />
      </button>
      <output aria-live="polite">{numeric}</output>
      <button type="button" aria-label={inc} disabled={numeric >= max} onClick={() => onChange?.(numeric + 1)}>
        <IconChevron dir="down" width={16} height={16} style={{ transform: "rotate(-90deg)" }} />
      </button>
    </div>
  );
}
