import React from 'react';
import { Calendar, Clock, X, History } from 'lucide-react';
import type { InspectionDateHistoryRecord } from '../types';

interface InspectionHistoryModalProps {
  isOpen: boolean;
  history: InspectionDateHistoryRecord[];
  currentDate: string;
  onClose: () => void;
}

export const InspectionHistoryModal: React.FC<InspectionHistoryModalProps> = ({
  isOpen,
  history,
  currentDate,
  onClose,
}) => {
  if (!isOpen) return null;

  const formatDateString = (isoOrDate: string) => {
    try {
      const d = new Date(isoOrDate);
      if (isNaN(d.getTime())) return isoOrDate;
      return d.toLocaleDateString(undefined, {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return isoOrDate;
    }
  };

  const formatTimestamp = (isoString: string) => {
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      return d.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn"
      role="dialog"
      aria-modal="true"
      id="inspection-history-modal"
    >
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-stone-300 p-6 sm:p-7 flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between pb-4 border-b border-stone-200">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-stone-100 text-stone-800 rounded-xl">
              <History className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-stone-900 tracking-tight">
                Inspection Date History
              </h3>
              <p className="text-xs text-stone-500 uppercase tracking-wider font-semibold">
                Read-Only Audit Trail
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-stone-800 hover:bg-stone-100 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Current Active Date Banner */}
        <div className="mt-4 p-4 rounded-xl bg-stone-100 border border-stone-300 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">
              Current Active Date
            </span>
            <div className="text-lg font-bold text-stone-900 mt-0.5">
              {formatDateString(currentDate)}
            </div>
          </div>
          <span className="px-3 py-1 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-md text-xs font-bold uppercase tracking-wider">
            Active
          </span>
        </div>

        {/* Append-only history list */}
        <div className="mt-5 flex-1 overflow-y-auto space-y-3 pr-1">
          <h4 className="text-xs font-bold text-stone-500 uppercase tracking-wider">
            Previous Recorded Dates ({history.length})
          </h4>

          {history.length === 0 ? (
            <div className="py-8 text-center text-stone-500 bg-stone-50 rounded-xl border border-dashed border-stone-300">
              <Clock className="w-8 h-8 mx-auto text-stone-400 mb-2 opacity-60" />
              <p className="text-base font-semibold text-stone-700">No date changes recorded yet</p>
              <p className="text-xs text-stone-500 mt-1 max-w-xs mx-auto">
                Whenever the inspection date is modified, the previous date and timestamp are permanently recorded here.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {history.map((record, idx) => (
                <div
                  key={`${record.changedAt}-${idx}`}
                  className="p-4 rounded-xl border border-stone-200 bg-stone-50 flex items-start justify-between gap-3 hover:border-stone-300 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-white text-stone-700 border border-stone-200 rounded-lg shrink-0 mt-0.5">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs text-stone-500 font-semibold uppercase tracking-wider">
                        Previous Inspection Date
                      </div>
                      <div className="text-base font-bold text-stone-900 mt-0.5">
                        {formatDateString(record.date)}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-stone-500 mt-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Changed on: {formatTimestamp(record.changedAt)}</span>
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 bg-stone-200 text-stone-700 rounded-md shrink-0">
                    Record #{history.length - idx}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 pt-4 border-t border-stone-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto min-h-[48px] px-6 py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl font-bold text-base transition-colors shadow-sm"
          >
            Close History
          </button>
        </div>
      </div>
    </div>
  );
};
