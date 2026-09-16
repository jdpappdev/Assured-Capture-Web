import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  isDestructive = true,
  isLoading = false,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn"
      role="dialog"
      aria-modal="true"
      id="confirm-modal"
    >
      <div className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-stone-300 p-6 sm:p-7">
        <div className="flex items-start gap-4">
          <div
            className={`p-3 rounded-xl shrink-0 ${
              isDestructive ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
            }`}
          >
            <AlertTriangle className="w-7 h-7" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-xl font-bold text-stone-900 tracking-tight">
              {title}
            </h3>
            <p className="mt-2 text-base text-stone-700 leading-relaxed font-normal">
              {message}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="p-2 -mr-2 -mt-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="mt-7 flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="w-full sm:w-auto min-h-[52px] px-6 py-3 border-2 border-stone-300 rounded-xl text-base font-semibold text-stone-800 bg-stone-100 hover:bg-stone-200 active:bg-stone-300 transition-colors shadow-xs"
            id="modal-cancel-btn"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`w-full sm:w-auto min-h-[52px] px-7 py-3 rounded-xl text-base font-bold text-white transition-colors shadow-md flex items-center justify-center gap-2 ${
              isDestructive
                ? 'bg-red-600 hover:bg-red-700 active:bg-red-800 focus:ring-4 focus:ring-red-200'
                : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
            }`}
            id="modal-confirm-btn"
          >
            {isLoading ? (
              <>
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
