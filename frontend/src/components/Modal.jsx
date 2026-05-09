import styles from './Modal.module.css'

export function Modal({ title, children, onClose }) {
  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.titleRow}>
          {title && <div className={styles.title}>{title}</div>}
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function ModalActions({ children }) {
  return <div className={styles.actions}>{children}</div>
}
