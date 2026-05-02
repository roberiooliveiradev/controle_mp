// src/app/ui/common/ModalShell.jsx

import "./ModalShell.css";

export function ModalShell({
  title,
  subtitle,
  onClose,
  children,
  footer,
  size = "lg",
  closeLabel = "Fechar",
  className = "",
}) {
  return (
    <div
      className="cmp-modal-shell"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose?.();
        }
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={[
          "cmp-modal-shell__panel",
          `cmp-modal-shell__panel--${size}`,
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <header className="cmp-modal-shell__header">
          <div className="cmp-modal-shell__heading">
            <strong className="cmp-modal-shell__title">{title}</strong>

            {subtitle ? (
              <span className="cmp-modal-shell__subtitle">{subtitle}</span>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="cmp-modal-shell__close"
          >
            {closeLabel}
          </button>
        </header>

        <div className="cmp-modal-shell__body">{children}</div>

        {footer ? (
          <footer className="cmp-modal-shell__footer">{footer}</footer>
        ) : null}
      </section>
    </div>
  );
}