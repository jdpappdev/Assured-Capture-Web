import React, { useState } from 'react';
import {
  Search,
  Calendar,
  User as UserIcon,
  MapPin,
  FileText,
  AlertCircle,
  LogOut,
} from 'lucide-react';
import type { Report } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { createReport } from '../services/reportService';
import { loginWithGoogle, logoutUser, type User } from '../firebase';

interface ReportsHomeScreenProps {
  reports: Report[];
  isLoading: boolean;
  error: string | null;
  currentUser: User | null;
  onOpenReport: (reportId: string, isNew?: boolean) => void;
}

export const ReportsHomeScreen: React.FC<ReportsHomeScreenProps> = ({
  reports,
  isLoading,
  error,
  currentUser,
  onOpenReport,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const handleCreateReport = async () => {
    setIsCreating(true);
    setCreateError(null);
    try {
      const newReport = await createReport(currentUser?.uid);
      onOpenReport(newReport.id, true);
    } catch (err: any) {
      console.error('Error creating report:', err);
      setCreateError('Failed to create new report. Please check your network connection.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleGoogleAuth = async () => {
    try {
      if (currentUser) {
        await logoutUser();
      } else {
        await loginWithGoogle();
      }
    } catch (err: any) {
      console.error('Auth error:', err);
    }
  };

  const filteredReports = reports.filter((r) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      (r.jobReference || '').toLowerCase().includes(q) ||
      (r.reportName || '').toLowerCase().includes(q) ||
      (r.clientName || '').toLowerCase().includes(q)
    );
  });

  const formatDateDisplay = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-5 sm:py-7 flex flex-col min-h-screen">
      {/* Top Header: App Title & User Auth */}
      <header className="flex items-center justify-between gap-4 pb-4 border-b border-stone-200">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900 tracking-tight">
            Assured Capture
          </h1>
        </div>

        {/* User Auth Control */}
        <div className="flex items-center gap-2">
          {currentUser ? (
            <div className="flex items-center gap-2.5 bg-stone-100 border border-stone-300 rounded-xl px-3 py-1.5 shadow-2xs">
              {currentUser.photoURL ? (
                <img
                  src={currentUser.photoURL}
                  alt={currentUser.displayName || 'Inspector'}
                  className="w-7 h-7 rounded-full border border-stone-300 object-cover"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-blue-700 text-white flex items-center justify-center font-bold text-xs">
                  {(currentUser.displayName || currentUser.email || 'I')[0].toUpperCase()}
                </div>
              )}
              <div className="hidden sm:block text-left text-xs">
                <p className="font-bold text-stone-800 leading-tight truncate max-w-[120px]">
                  {currentUser.displayName || currentUser.email?.split('@')[0]}
                </p>
                <p className="text-[10px] text-stone-500">Inspector</p>
              </div>
              <button
                type="button"
                onClick={handleGoogleAuth}
                className="text-stone-500 hover:text-red-700 p-1 rounded-md transition-colors"
                title="Sign Out"
                aria-label="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleGoogleAuth}
              className="w-10 h-10 rounded-full bg-white border-2 border-stone-300 hover:border-blue-600 hover:bg-stone-50 flex items-center justify-center shadow-2xs transition-all active:scale-95 shrink-0"
              id="google-signin-btn"
              title="Sign in with Google"
              aria-label="Sign in with Google"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            </button>
          )}
        </div>
      </header>

      {/* Prominent New Report Action (Outdoor/Gloved Sizing) */}
      <div className="mt-5">
        <button
          type="button"
          onClick={handleCreateReport}
          disabled={isCreating}
          id="new-report-main-btn"
          className="w-full min-h-[58px] px-6 py-4 bg-blue-700 hover:bg-blue-800 active:bg-blue-900 text-white rounded-xl font-extrabold text-lg tracking-wide shadow-md transition-all flex items-center justify-center border-2 border-blue-800 active:scale-[0.99]"
        >
          {isCreating ? (
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Creating Report...</span>
            </div>
          ) : (
            <span>New Report</span>
          )}
        </button>
      </div>

      {createError && (
        <div className="mt-4 p-3.5 bg-red-50 border border-red-300 rounded-xl text-red-800 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <span>{createError}</span>
        </div>
      )}

      {/* Search Field */}
      <div className="mt-5">
        <div className="relative">
          <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search reports..."
            className="w-full min-h-[52px] pl-12 pr-4 py-3 bg-white border-2 border-stone-300 rounded-xl text-stone-900 placeholder:text-stone-500 font-medium text-base focus:border-blue-700 focus:outline-hidden shadow-2xs"
            id="reports-search-input"
          />
        </div>
      </div>

      {/* Loading & Global Error States */}
      {isLoading && (
        <div className="py-16 text-center">
          <div className="w-10 h-10 border-4 border-blue-700 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-base font-semibold text-stone-700">Loading inspection reports...</p>
        </div>
      )}

      {error && (
        <div className="mt-6 p-4 bg-red-50 border-2 border-red-300 rounded-xl text-red-900 text-sm">
          <div className="flex items-center gap-2 font-bold mb-1">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <span>Connection Error</span>
          </div>
          <p>{error}</p>
        </div>
      )}

      {/* Scrollable Report Cards List */}
      {!isLoading && (
        <div className="mt-5 space-y-3.5 flex-1">
          {filteredReports.length > 0 && (
            <div className="flex items-center justify-between px-1 pb-1">
              <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">
                {filteredReports.length} {filteredReports.length === 1 ? 'Report' : 'Reports'}
              </span>
            </div>
          )}

          {filteredReports.length === 0 ? (
            /* Empty State */
            <div className="py-14 px-6 text-center bg-stone-100/70 border-2 border-dashed border-stone-300 rounded-2xl">
              <FileText className="w-12 h-12 text-stone-400 mx-auto mb-3" />
              <h3 className="text-xl font-bold text-stone-800">
                {searchQuery ? 'No matching reports found' : 'No reports yet'}
              </h3>
              <p className="text-sm text-stone-600 mt-1 max-w-sm mx-auto">
                {searchQuery
                  ? `No inspection reports match "${searchQuery}". Clear your search or create a new report.`
                  : 'Start a photo inspection report to document site conditions and issues.'}
              </p>
              <div className="mt-6 flex items-center justify-center">
                <button
                  type="button"
                  onClick={handleCreateReport}
                  disabled={isCreating}
                  className="w-full sm:w-auto min-h-[50px] px-8 py-3 bg-blue-700 hover:bg-blue-800 active:bg-blue-900 text-white rounded-xl font-bold text-base shadow-sm inline-flex items-center justify-center cursor-pointer transition-colors"
                  id="empty-new-report-btn"
                >
                  <span>New Report</span>
                </button>
              </div>
            </div>
          ) : (
            filteredReports.map((report) => (
              <div
                key={report.id}
                onClick={() => onOpenReport(report.id)}
                className="group relative bg-white border-2 border-stone-300 hover:border-blue-600 rounded-xl p-5 shadow-2xs hover:shadow-md transition-all cursor-pointer active:scale-[0.99] select-none"
                id={`report-card-${report.id}`}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    onOpenReport(report.id);
                  }
                }}
              >
                {/* Top Row: Job Reference and Status Badge */}
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <span className="text-xs font-bold text-stone-500 uppercase tracking-wider block">
                      Job Reference
                    </span>
                    <span className="text-lg font-black text-stone-900 tracking-tight group-hover:text-blue-700 transition-colors">
                      {report.jobReference || 'Untitled Ref'}
                    </span>
                  </div>
                  <div className="shrink-0">
                    <StatusBadge status={report.status} size="md" />
                  </div>
                </div>

                {/* Report Name */}
                <h2 className="text-base font-bold text-stone-900 line-clamp-1 mb-2">
                  {report.reportName || 'Unnamed Inspection'}
                </h2>

                {/* Client Name & Inspection Date */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-stone-600 border-t border-stone-100 pt-3 mt-1">
                  <div className="flex items-center gap-2 truncate">
                    <UserIcon className="w-4 h-4 text-stone-400 shrink-0" />
                    <span className="truncate">
                      <span className="font-semibold text-stone-700">Client: </span>
                      {report.clientName || 'Not specified'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-stone-400 shrink-0" />
                    <span>
                      <span className="font-semibold text-stone-700">Inspected: </span>
                      {formatDateDisplay(report.inspectionDate)}
                    </span>
                  </div>
                </div>

                {report.address && (
                  <div className="mt-2 text-xs text-stone-500 flex items-center gap-1.5 truncate">
                    <MapPin className="w-3.5 h-3.5 shrink-0 text-stone-400" />
                    <span className="truncate">{report.address}</span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
