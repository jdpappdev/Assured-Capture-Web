import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Save,
  Trash2,
  Calendar,
  History,
  AlertCircle,
  Check,
  Camera,
  Layers,
} from 'lucide-react';
import type { Report, Issue, ReportStatus } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { InspectionHistoryModal } from '../components/InspectionHistoryModal';
import {
  updateReport,
  deleteReport,
  subscribeIssues,
  getPhotosCountForIssue,
} from '../services/reportService';

interface ReportDetailScreenProps {
  report: Report;
  isNewReport?: boolean;
  onBack: () => void;
  onOpenIssue: (issueId: string) => void;
  onNavigateToAddIssue: () => void;
  onReportSaved?: () => void;
  onReportDeleted: () => void;
}

export const ReportDetailScreen: React.FC<ReportDetailScreenProps> = ({
  report,
  isNewReport = false,
  onBack,
  onOpenIssue,
  onNavigateToAddIssue,
  onReportSaved,
  onReportDeleted,
}) => {
  // Form State
  const defaultRef = 'BBC-26-';
  const [jobReference, setJobReference] = useState(report.jobReference || defaultRef);
  const [reportName, setReportName] = useState(report.reportName);
  const [clientName, setClientName] = useState(report.clientName);
  const [address, setAddress] = useState(report.address);
  const [reportDate, setReportDate] = useState(report.reportDate);
  const [status, setStatus] = useState<ReportStatus>(report.status);
  const [inspectionDate, setInspectionDate] = useState(report.inspectionDate);

  // Issues and counts
  const [issues, setIssues] = useState<Issue[]>([]);
  const [photoCounts, setPhotoCounts] = useState<Record<string, number>>({});
  const [isLoadingIssues, setIsLoadingIssues] = useState(true);

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Sync props if report updates externally
  useEffect(() => {
    setJobReference(report.jobReference || defaultRef);
    setReportName(report.reportName);
    setClientName(report.clientName);
    setAddress(report.address);
    setReportDate(report.reportDate);
    setStatus(report.status);
    setInspectionDate(report.inspectionDate);
  }, [report]);

  // Subscribe to issues for this report
  useEffect(() => {
    setIsLoadingIssues(true);
    const unsubscribe = subscribeIssues(
      report.id,
      async (fetchedIssues) => {
        setIssues(fetchedIssues);
        setIsLoadingIssues(false);
        // Fetch photo counts for each issue
        const counts: Record<string, number> = {};
        for (const iss of fetchedIssues) {
          counts[iss.id] = await getPhotosCountForIssue(report.id, iss.id);
        }
        setPhotoCounts(counts);
      },
      (err) => {
        console.error('Error loading issues:', err);
        setIsLoadingIssues(false);
      }
    );

    return () => unsubscribe();
  }, [report.id]);

  const handleSaveReport = async () => {
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      await updateReport(
        report.id,
        {
          jobReference: jobReference.trim(),
          reportName: reportName.trim(),
          clientName: clientName.trim(),
          address: address.trim(),
          reportDate,
          status,
          inspectionDate,
        },
        report
      );
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);

      // If this report was just created, save and navigate straight to the Add Issue page
      if (isNewReport && onReportSaved) {
        onReportSaved();
      }
    } catch (err: any) {
      console.error('Save report failed:', err);
      setSaveError(
        'Failed to save report to Firestore. Please check your network and try again.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteReport(report.id);
      setShowDeleteConfirm(false);
      onReportDeleted();
    } catch (err: any) {
      console.error('Failed to delete report:', err);
      setDeleteError('Failed to delete report. Please try again.');
      setIsDeleting(false);
    }
  };

  const allowedStatuses: ReportStatus[] = [
    'Draft',
    'In Progress',
    'Awaiting Review',
    'Completed',
    'Sent to Client',
  ];

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-5 sm:py-7 flex flex-col min-h-screen">
      {/* Header with clear context & Back Action */}
      <div className="pb-4 border-b border-stone-200">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className="min-h-[48px] px-3.5 py-2 -ml-2 text-stone-700 hover:text-stone-950 hover:bg-stone-100 rounded-xl font-bold text-sm inline-flex items-center gap-2 transition-colors"
            id="back-to-reports-btn"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Reports</span>
          </button>

          <div className="flex items-center gap-2">
            <StatusBadge status={status} size="sm" />
          </div>
        </div>

        <div className="mt-2">
          <span className="text-xs font-bold text-blue-700 uppercase tracking-wider block">
            Editing Report
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight">
            {jobReference || 'New Report'}
          </h1>
        </div>
      </div>

      {/* Save Feedback Banner */}
      {saveSuccess && (
        <div className="mt-4 p-3.5 bg-emerald-50 border-2 border-emerald-300 rounded-xl text-emerald-900 text-sm font-bold flex items-center gap-2 animate-fadeIn">
          <Check className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>Report successfully saved to Firestore</span>
        </div>
      )}

      {saveError && (
        <div className="mt-4 p-3.5 bg-red-50 border-2 border-red-300 rounded-xl text-red-900 text-sm font-semibold flex items-center gap-2 animate-fadeIn">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <span>{saveError}</span>
        </div>
      )}

      {/* Editable Report Fields (Outdoor Large Input Controls) */}
      <div className="mt-5 bg-white border-2 border-stone-300 rounded-2xl p-5 sm:p-6 shadow-2xs space-y-4">
        {/* Job Reference */}
        <div>
          <label
            htmlFor="jobReference"
            className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1"
          >
            Job Reference <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="jobReference"
            value={jobReference}
            onChange={(e) => setJobReference(e.target.value)}
            placeholder="BBC-26-"
            className="w-full min-h-[52px] px-4 py-3 bg-stone-50 border-2 border-stone-300 rounded-xl text-stone-900 font-bold text-lg focus:border-blue-700 focus:bg-white focus:outline-hidden"
          />
          <p className="text-xs text-stone-500 mt-1 font-medium">
            Pre-fills with BBC-26- and remains editable.
          </p>
        </div>

        {/* Report Name */}
        <div>
          <label
            htmlFor="reportName"
            className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1"
          >
            Report Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="reportName"
            value={reportName}
            onChange={(e) => setReportName(e.target.value)}
            placeholder="e.g., Roof & Structural Survey"
            className="w-full min-h-[52px] px-4 py-3 bg-stone-50 border-2 border-stone-300 rounded-xl text-stone-900 font-semibold text-base focus:border-blue-700 focus:bg-white focus:outline-hidden"
          />
        </div>

        {/* Client Name & Address */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="clientName"
              className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1"
            >
              Client Name
            </label>
            <input
              type="text"
              id="clientName"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="e.g., Apex Properties Ltd"
              className="w-full min-h-[52px] px-4 py-3 bg-stone-50 border-2 border-stone-300 rounded-xl text-stone-900 font-medium text-base focus:border-blue-700 focus:bg-white focus:outline-hidden"
            />
          </div>

          <div>
            <label
              htmlFor="status"
              className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1"
            >
              Status <span className="text-red-500">*</span>
            </label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as ReportStatus)}
              className="w-full min-h-[52px] px-4 py-3 bg-stone-50 border-2 border-stone-300 rounded-xl text-stone-900 font-bold text-base focus:border-blue-700 focus:bg-white focus:outline-hidden cursor-pointer"
            >
              {allowedStatuses.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Address */}
        <div>
          <label
            htmlFor="address"
            className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1"
          >
            Site Address
          </label>
          <input
            type="text"
            id="address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="e.g., 42 High Street, Birmingham, B1 1BB"
            className="w-full min-h-[52px] px-4 py-3 bg-stone-50 border-2 border-stone-300 rounded-xl text-stone-900 font-medium text-base focus:border-blue-700 focus:bg-white focus:outline-hidden"
          />
        </div>

        {/* Report Date & Inspection Date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          <div>
            <label
              htmlFor="reportDate"
              className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1"
            >
              Report Date
            </label>
            <input
              type="date"
              id="reportDate"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
              className="w-full min-h-[52px] px-4 py-3 bg-stone-50 border-2 border-stone-300 rounded-xl text-stone-900 font-medium text-base focus:border-blue-700 focus:bg-white focus:outline-hidden"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="inspectionDate"
                className="text-xs font-bold uppercase tracking-wider text-stone-700"
              >
                Inspection Date
              </label>
              <button
                type="button"
                onClick={() => setShowHistoryModal(true)}
                className="text-xs font-bold text-blue-700 hover:text-blue-900 inline-flex items-center gap-1 underline underline-offset-2"
                id="view-date-history-btn"
              >
                <History className="w-3.5 h-3.5" />
                <span>View history ({report.inspectionDateHistory?.length || 0})</span>
              </button>
            </div>
            <input
              type="date"
              id="inspectionDate"
              value={inspectionDate}
              onChange={(e) => setInspectionDate(e.target.value)}
              className="w-full min-h-[52px] px-4 py-3 bg-stone-50 border-2 border-stone-300 rounded-xl text-stone-900 font-semibold text-base focus:border-blue-700 focus:bg-white focus:outline-hidden"
            />
          </div>
        </div>

        {/* Save Report Action Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={handleSaveReport}
            disabled={isSaving}
            id="save-report-btn"
            className="w-full min-h-[54px] px-6 py-3.5 bg-blue-700 hover:bg-blue-800 active:bg-blue-900 text-white rounded-xl font-bold text-base shadow-md transition-all flex items-center justify-center gap-2 border-2 border-blue-800"
          >
            {isSaving ? (
              <>
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Saving Report...</span>
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                <span>Save Report Information</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ISSUES SECTION (Hidden when creating a new report until report information is saved) */}
      {!isNewReport && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight flex items-center gap-2">
                <Layers className="w-6 h-6 text-stone-700" />
                <span>Inspection Issues</span>
              </h2>
              <p className="text-xs text-stone-500 font-medium">
                Permanent sequential issue tracking for field inspection
              </p>
            </div>
            <span className="px-3 py-1 bg-stone-200 text-stone-800 rounded-lg text-xs font-bold">
              {issues.length} {issues.length === 1 ? 'Issue' : 'Issues'}
            </span>
          </div>

          {/* Full-Width Add Issue Button (Navigates to separate page) */}
          <button
            type="button"
            onClick={onNavigateToAddIssue}
            id="add-issue-btn"
            className="w-full min-h-[56px] px-6 py-3.5 bg-blue-700 hover:bg-blue-800 active:bg-blue-900 text-white rounded-xl font-extrabold text-base tracking-wide shadow-md transition-all flex items-center justify-center border-2 border-blue-800 active:scale-[0.99] cursor-pointer"
          >
            <span>Add Issue</span>
          </button>

          {/* Issues List */}
          <div className="mt-4 space-y-3">
            {isLoadingIssues ? (
              <div className="py-8 text-center text-stone-500">
                <div className="w-6 h-6 border-2 border-blue-700 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-sm font-semibold">Loading issues...</p>
              </div>
            ) : issues.length === 0 ? (
              <div className="py-10 px-4 text-center bg-stone-100 border-2 border-dashed border-stone-300 rounded-2xl">
                <Layers className="w-10 h-10 text-stone-400 mx-auto mb-2" />
                <h4 className="text-lg font-bold text-stone-800">No issues added yet</h4>
                <p className="text-xs text-stone-600 mt-1 max-w-xs mx-auto">
                  Tap the "Add Issue" button above to record findings, defects, and photos.
                </p>
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={onNavigateToAddIssue}
                    className="min-h-[46px] px-5 py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl font-bold text-sm shadow-sm inline-flex items-center justify-center cursor-pointer"
                  >
                    <span>Add Issue</span>
                  </button>
                </div>
              </div>
            ) : (
              issues.map((iss) => {
                const count = photoCounts[iss.id] || 0;
                return (
                  <div
                    key={iss.id}
                    onClick={() => onOpenIssue(iss.id)}
                    className="bg-white border-2 border-stone-300 hover:border-blue-600 rounded-xl p-4 sm:p-5 shadow-2xs hover:shadow-md transition-all cursor-pointer select-none active:scale-[0.99] flex items-center justify-between gap-4"
                    id={`issue-card-${iss.id}`}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') onOpenIssue(iss.id);
                    }}
                  >
                    <div className="flex items-start gap-3.5">
                      <div className="px-3 py-2 bg-stone-900 text-white rounded-lg font-black text-sm tracking-wide shrink-0">
                        Issue {iss.issueNumber}
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-stone-900 leading-tight">
                          {iss.issueName || <span className="italic text-stone-400">Untitled Issue</span>}
                        </h3>
                        {iss.issueDescription && (
                          <p className="text-xs text-stone-600 line-clamp-1 mt-1">
                            {iss.issueDescription}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 border border-stone-200 rounded-lg text-xs font-bold text-stone-700">
                      <Camera className="w-4 h-4 text-stone-500" />
                      <span>
                        {count} {count === 1 ? 'photo' : 'photos'}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Delete Report Action (Bottom of Screen per spec) */}
      <div className="mt-12 pt-6 border-t-2 border-stone-200">
        {deleteError && (
          <div className="mb-3 p-3 bg-red-50 border border-red-300 rounded-xl text-red-800 text-sm">
            {deleteError}
          </div>
        )}
        <button
          type="button"
          onClick={() => setShowDeleteConfirm(true)}
          disabled={isDeleting}
          id="delete-report-btn"
          className="w-full min-h-[52px] px-6 py-3 border-2 border-red-300 hover:border-red-600 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-base rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          <Trash2 className="w-5 h-5 text-red-600" />
          <span>Delete Report</span>
        </button>
      </div>

      {/* Reusable Confirmation Dialog for Delete Report */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Delete this report?"
        message={`This will permanently delete report "${jobReference || report.id}", along with all its issues and photos. This action cannot be undone.`}
        confirmLabel="Delete Report"
        cancelLabel="Cancel"
        isDestructive={true}
        isLoading={isDeleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      {/* Inspection Date History Modal */}
      <InspectionHistoryModal
        isOpen={showHistoryModal}
        history={report.inspectionDateHistory || []}
        currentDate={inspectionDate}
        onClose={() => setShowHistoryModal(false)}
      />
    </div>
  );
};
