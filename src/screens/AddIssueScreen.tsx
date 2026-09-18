import React, { useState, useEffect } from 'react';
import { ArrowLeft, AlertCircle, Layers, FileText } from 'lucide-react';
import type { Report, Issue } from '../types';
import { createIssue, subscribeIssues } from '../services/reportService';

interface AddIssueScreenProps {
  report: Report;
  onBack: () => void;
  onIssueCreated: (newIssueId: string) => void;
}

export const AddIssueScreen: React.FC<AddIssueScreenProps> = ({
  report,
  onBack,
  onIssueCreated,
}) => {
  const [issueName, setIssueName] = useState('');
  const [issueDescription, setIssueDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Determine the next issue number to display to the user
  const [nextIssueNumber, setNextIssueNumber] = useState<number>(
    (report.highestIssueNumberAssigned || 0) + 1
  );

  useEffect(() => {
    const unsub = subscribeIssues(report.id, (issues: Issue[]) => {
      let maxNum = report.highestIssueNumberAssigned || 0;
      issues.forEach((iss) => {
        if (iss.issueNumber > maxNum) {
          maxNum = iss.issueNumber;
        }
      });
      setNextIssueNumber(maxNum + 1);
    });

    return () => unsub();
  }, [report.id, report.highestIssueNumberAssigned]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!issueName.trim()) {
      setErrorMessage('Please enter an issue name before creating the issue.');
      return;
    }

    setIsCreating(true);
    setErrorMessage(null);

    try {
      const createdIssue = await createIssue(report, {
        issueName: issueName.trim(),
        issueDescription: issueDescription.trim(),
      });
      onIssueCreated(createdIssue.id);
    } catch (err: any) {
      console.error('Failed to create issue:', err);
      setErrorMessage(err?.message || 'Failed to create issue. Please check your connection.');
      setIsCreating(false);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-5 sm:py-7 flex flex-col min-h-screen">
      {/* Top Navigation */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-stone-200">
        <button
          type="button"
          onClick={onBack}
          id="back-to-report-btn"
          className="min-h-[44px] px-3 py-2 -ml-2 rounded-xl text-stone-700 hover:text-stone-950 hover:bg-stone-200 font-bold text-sm flex items-center gap-1.5 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>{report.jobReference || 'Back to Report'}</span>
        </button>

        <span className="text-xs font-extrabold px-3 py-1 bg-stone-100 border border-stone-300 rounded-lg text-stone-700">
          {report.jobReference}
        </span>
      </div>

      {/* Screen Title & Issue Counter Badge */}
      <div className="mt-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight">
            Add Issue
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 font-medium mt-0.5">
            Record defect findings, measurements, or site observations.
          </p>
        </div>
        <div className="px-3.5 py-1.5 bg-stone-900 text-white rounded-xl font-black text-base tracking-wide shrink-0">
          Issue {nextIssueNumber}
        </div>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="mt-4 p-3.5 bg-red-50 border-2 border-red-300 rounded-xl text-red-900 text-sm font-semibold flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Add Issue Form */}
      <form onSubmit={handleSubmit} className="mt-5 space-y-5">
        <div className="bg-white border-2 border-stone-300 rounded-2xl p-5 sm:p-6 shadow-2xs space-y-5">
          {/* Issue Name */}
          <div>
            <label
              htmlFor="add-issue-name"
              className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1"
            >
              Issue Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="add-issue-name"
              value={issueName}
              onChange={(e) => {
                setIssueName(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              placeholder="e.g., Damaged Roof Flashing, Foundation Crack, Water Ingress"
              className="w-full min-h-[52px] px-4 py-3 bg-stone-50 border-2 border-stone-300 rounded-xl text-stone-900 font-bold text-base sm:text-lg focus:border-blue-700 focus:bg-white focus:outline-hidden"
              autoFocus
            />
          </div>

          {/* Issue Description */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="add-issue-description"
                className="text-xs font-bold uppercase tracking-wider text-stone-700 flex items-center gap-1.5"
              >
                <FileText className="w-4 h-4 text-stone-500" />
                <span>Issue Description</span>
              </label>
            </div>
            <textarea
              id="add-issue-description"
              rows={4}
              value={issueDescription}
              onChange={(e) => setIssueDescription(e.target.value)}
              placeholder="Document detailed observations, defect extent, severity, or remediation recommendations..."
              className="w-full p-4 bg-stone-50 border-2 border-stone-300 rounded-xl text-stone-900 font-medium text-base focus:border-blue-700 focus:bg-white focus:outline-hidden leading-relaxed"
            />
          </div>
        </div>

        {/* Action Button: only "Add Issue" inside button (no + + text) */}
        <div className="pt-2 space-y-3">
          <button
            type="submit"
            disabled={isCreating}
            id="add-issue-submit-btn"
            className="w-full min-h-[56px] px-6 py-3.5 bg-blue-700 hover:bg-blue-800 active:bg-blue-900 text-white rounded-xl font-extrabold text-base tracking-wide shadow-md transition-all flex items-center justify-center border-2 border-blue-800 active:scale-[0.99] cursor-pointer disabled:opacity-70"
          >
            {isCreating ? (
              <div className="flex items-center gap-3">
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Adding Issue...</span>
              </div>
            ) : (
              <span>Add Issue</span>
            )}
          </button>

          <button
            type="button"
            onClick={onBack}
            disabled={isCreating}
            className="w-full min-h-[48px] px-6 py-2.5 bg-transparent hover:bg-stone-200 text-stone-700 rounded-xl font-bold text-sm transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};
