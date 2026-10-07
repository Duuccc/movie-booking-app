import { AlertTriangle } from 'lucide-react'
import Modal from './Modal'

/**
 * Replaces window.confirm() with a styled modal. Pass `danger` for
 * destructive actions (delete) to get the red confirm button and warning
 * icon; omit it for neutral confirmations (e.g. granting admin).
 */
function ConfirmDialog({ title, message, confirmLabel = 'Confirm', danger = false, onConfirm, onCancel }) {
  return (
    <Modal title={title} onClose={onCancel}>
      <div className="confirm-dialog">
        {danger && (
          <div className="confirm-dialog-icon">
            <AlertTriangle size={20} />
          </div>
        )}
        <p className="confirm-dialog-message">{message}</p>
        <div className="confirm-dialog-actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className={danger ? 'btn btn-danger' : 'btn btn-primary'}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default ConfirmDialog