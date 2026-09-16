import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Save,
  Trash2,
  AlertCircle,
  Check,
  Star,
  Tag,
  Hash,
  FileText,
} from 'lucide-react';
import type { Report, Issue, Photo } from '../types';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { VoiceTranscriber } from '../components/VoiceTranscriber';
import { updatePhoto, deletePhoto } from '../services/reportService';

interface PhotoDetailScreenProps {
  report: Report;
  issue: Issue;
  photo: Photo;
  onBack: () => void;
  onPhotoDeleted: () => void;
}

export const PhotoDetailScreen: React.FC<PhotoDetailScreenProps> = ({
  report,
  issue,
  photo,
  onBack,
  onPhotoDeleted,
}) => {
  const [description, setDescription] = useState(photo.description);
  const [isReferenceImage, setIsReferenceImage] = useState(photo.isReferenceImage);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Sync state if photo updates externally
  useEffect(() => {
    setDescription(photo.description);
    setIsReferenceImage(photo.isReferenceImage);
  }, [photo]);

  // Handle explicit Save
  const handleSavePhoto = async () => {
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      await updatePhoto(report.id, issue.id, photo.id, {
        description: description.trim(),
        isReferenceImage,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      console.error('Save photo error:', err);
      setSaveError('Failed to save photo details to Firestore. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Immediate toggle for Reference Image per Section 17
  // "Changing the value must persist to Firestore."
  const handleToggleReference = async (checked: boolean) => {
    setIsReferenceImage(checked);
    try {
      await updatePhoto(report.id, issue.id, photo.id, {
        isReferenceImage: checked,
      });
    } catch (err: any) {
      console.error('Error updating reference image state:', err);
      setIsReferenceImage(!checked); // revert on failure
      setSaveError('Failed to update Reference Image toggle.');
    }
  };

  // Voice transcription handler
  const handleVoiceTranscript = (newText: string) => {
    setDescription(newText);
    // Auto-persist voice transcript to Firestore
    updatePhoto(report.id, issue.id, photo.id, {
      description: newText,
    }).catch((err) => console.warn('Auto-save transcript error:', err));
  };

  // Delete photo confirmation handler
  const handleDeletePhotoConfirm = async () => {
    setIsDeleting(true);
    setDeleteError(null);

    try {
      await deletePhoto(report.id, issue.id, photo.id, photo.storagePath);
      setShowDeleteConfirm(false);
      onPhotoDeleted();
    } catch (err: any) {
      console.error('Failed to delete photo:', err);
      setDeleteError('Failed to delete photo. Please try again.');
      setIsDeleting(false);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-5 sm:py-7 flex flex-col min-h-screen">
      {/* Header: Back navigation & Denormalized Context */}
      <div className="pb-4 border-b border-stone-200">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className="min-h-[48px] px-3.5 py-2 -ml-2 text-stone-700 hover:text-stone-950 hover:bg-stone-100 rounded-xl font-bold text-sm inline-flex items-center gap-2 transition-colors"
            id="back-to-issue-btn"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Issue {issue.issueNumber}</span>
          </button>

          {/* Denormalized Context Badges */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold px-2.5 py-1 bg-stone-100 border border-stone-300 rounded-lg text-stone-700">
              {photo.jobReference || report.jobReference}
            </span>
            <span className="text-xs font-black px-2.5 py-1 bg-stone-900 text-white rounded-lg">
              Issue {photo.issueNumber || issue.issueNumber}
            </span>
          </div>
        </div>

        <div className="mt-2">
          <h1 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight">
            Photo Detail & Evidence
          </h1>
          <p className="text-xs text-stone-500 font-medium mt-0.5">
            Document observations with typed text or voice transcription
          </p>
        </div>
      </div>

      {/* Save Feedback Banner */}
      {saveSuccess && (
        <div className="mt-4 p-3.5 bg-emerald-50 border-2 border-emerald-300 rounded-xl text-emerald-900 text-sm font-bold flex items-center gap-2 animate-fadeIn">
          <Check className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>Photo description saved to Firestore</span>
        </div>
      )}

      {saveError && (
        <div className="mt-4 p-3.5 bg-red-50 border-2 border-red-300 rounded-xl text-red-900 text-sm font-semibold flex items-center gap-2 animate-fadeIn">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <span>{saveError}</span>
        </div>
      )}

      {/* 15. PROMINENT IMAGE DISPLAY (Appropriate scaling without distortion) */}
      <div className="mt-5 bg-stone-950 border-2 border-stone-800 rounded-2xl overflow-hidden shadow-md flex items-center justify-center relative min-h-[260px] max-h-[460px]">
        <img
          src={photo.imageFile}
          alt={description || 'Inspection photo'}
          className="w-full h-auto max-h-[460px] object-contain select-none"
        />

        {isReferenceImage && (
          <div className="absolute top-3 left-3 px-3 py-1 bg-amber-500 text-stone-950 font-black text-xs rounded-lg shadow-lg border border-amber-300 flex items-center gap-1.5">
            <Star className="w-4 h-4 fill-stone-950" />
            <span>REFERENCE IMAGE</span>
          </div>
        )}
      </div>

      {/* 15 & 16. DESCRIPTION (TYPED OR VOICE TRANSCRIPTION) */}
      <div className="mt-6 bg-white border-2 border-stone-300 rounded-2xl p-5 sm:p-6 shadow-2xs space-y-5">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="photo-description"
              className="text-xs font-bold uppercase tracking-wider text-stone-700 flex items-center gap-1.5"
            >
              <FileText className="w-4 h-4 text-stone-500" />
              <span>Photo Description / Field Notes</span>
            </label>
            <span className="text-[11px] font-medium text-stone-400">
              Type or speak below
            </span>
          </div>

          <textarea
            id="photo-description"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Type defect notes, location details, or tap 'Describe by Voice' below..."
            className="w-full p-4 bg-stone-50 border-2 border-stone-300 rounded-xl text-stone-900 font-medium text-base focus:border-blue-700 focus:bg-white focus:outline-hidden leading-relaxed shadow-2xs"
          />
        </div>

        {/* 16. CRITICAL VOICE TRANSCRIPTION ENGINE */}
        <div className="pt-1">
          <VoiceTranscriber
            currentText={description}
            onTranscript={handleVoiceTranscript}
          />
        </div>

        {/* 17. REFERENCE IMAGE CHECKBOX / TOGGLE */}
        <div className="pt-2 border-t border-stone-200">
          <label
            htmlFor="reference-image-toggle"
            className="flex items-center gap-3.5 p-3.5 rounded-xl border-2 border-stone-200 hover:border-amber-400 bg-stone-50 cursor-pointer select-none transition-colors"
          >
            <input
              type="checkbox"
              id="reference-image-toggle"
              checked={isReferenceImage}
              onChange={(e) => handleToggleReference(e.target.checked)}
              className="w-6 h-6 rounded-md text-amber-500 focus:ring-amber-400 border-2 border-stone-400 cursor-pointer shrink-0"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-stone-900">
                  Reference Image
                </span>
                {isReferenceImage && (
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-900 font-bold text-xs rounded-md border border-amber-300">
                    Flagged
                  </span>
                )}
              </div>
              <p className="text-xs text-stone-500 mt-0.5">
                Mark as the key reference or benchmark photo for this issue.
              </p>
            </div>
            <Star
              className={`w-6 h-6 ${
                isReferenceImage ? 'text-amber-500 fill-amber-500' : 'text-stone-300'
              }`}
            />
          </label>
        </div>

        {/* Save Photo Button */}
        <div className="pt-1">
          <button
            type="button"
            onClick={handleSavePhoto}
            disabled={isSaving}
            id="save-photo-btn"
            className="w-full min-h-[52px] px-6 py-3 bg-blue-700 hover:bg-blue-800 active:bg-blue-900 text-white rounded-xl font-bold text-base shadow-sm transition-all flex items-center justify-center gap-2 border-2 border-blue-800"
          >
            {isSaving ? (
              <>
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Saving Photo...</span>
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                <span>Save Description & Changes</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 21. DELETE PHOTO (Bottom of Screen per spec) */}
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
          id="delete-photo-btn"
          className="w-full min-h-[52px] px-6 py-3 border-2 border-red-300 hover:border-red-600 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-base rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          <Trash2 className="w-5 h-5 text-red-600" />
          <span>Delete Photo</span>
        </button>
      </div>

      {/* Confirmation Dialog for Delete Photo */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Delete this photo?"
        message="This photo record and its image file will be permanently deleted from Firebase. This action cannot be undone."
        confirmLabel="Delete Photo"
        cancelLabel="Cancel"
        isDestructive={true}
        isLoading={isDeleting}
        onConfirm={handleDeletePhotoConfirm}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
};
