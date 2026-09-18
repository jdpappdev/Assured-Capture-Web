import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Save,
  Image as ImageIcon,
  Camera,
  Trash2,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Star,
  Check,
  X,
} from 'lucide-react';
import type { Report, Issue, Photo, UploadTaskItem } from '../types';
import { ConfirmDialog } from '../components/ConfirmDialog';
import {
  updateIssue,
  deleteIssue,
  subscribePhotos,
  uploadImageFile,
  createPhoto,
} from '../services/reportService';

interface IssueDetailScreenProps {
  report: Report;
  issue: Issue;
  onBack: () => void;
  onOpenPhoto: (photoId: string) => void;
  onIssueDeleted: () => void;
}

export const IssueDetailScreen: React.FC<IssueDetailScreenProps> = ({
  report,
  issue,
  onBack,
  onOpenPhoto,
  onIssueDeleted,
}) => {
  // Form State
  const [issueName, setIssueName] = useState(issue.issueName);
  const [issueDescription, setIssueDescription] = useState(issue.issueDescription);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Photos State
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(true);

  // Upload Queue State
  const [uploadQueue, setUploadQueue] = useState<UploadTaskItem[]>([]);
  const [isBatchUploading, setIsBatchUploading] = useState(false);

  // Deletion State
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // In-browser webcam fallback modal
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // File input refs
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  // Sync state if issue changes
  useEffect(() => {
    setIssueName(issue.issueName);
    setIssueDescription(issue.issueDescription);
  }, [issue]);

  // Subscribe to photos
  useEffect(() => {
    setIsLoadingPhotos(true);
    const unsubscribe = subscribePhotos(
      report.id,
      issue.id,
      (fetchedPhotos) => {
        setPhotos(fetchedPhotos);
        setIsLoadingPhotos(false);
      },
      (err) => {
        console.error('Error loading photos:', err);
        setIsLoadingPhotos(false);
      }
    );

    return () => unsubscribe();
  }, [report.id, issue.id]);

  // Handle Save Issue information
  const handleSaveIssue = async () => {
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      await updateIssue(report.id, issue.id, {
        issueName: issueName.trim(),
        issueDescription: issueDescription.trim(),
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      console.error('Save issue failed:', err);
      setSaveError('Failed to save issue changes. Please check your connection.');
    } finally {
      setIsSaving(false);
    }
  };

  // MULTI-IMAGE UPLOAD ENGINE (Section 13)
  const handleFilesSelected = async (files: FileList | File[] | null) => {
    if (!files || files.length === 0) return;

    const newTasks: UploadTaskItem[] = Array.from(files).map((file, idx) => ({
      id: `${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
      file,
      name: file.name,
      progress: 0,
      status: 'uploading',
    }));

    setUploadQueue((prev) => [...newTasks, ...prev]);
    setIsBatchUploading(true);

    // Process every selected file in parallel without silent drops
    await Promise.allSettled(
      newTasks.map(async (task) => {
        try {
          // 1. Upload to Firebase Storage with live progress updates
          const { downloadUrl, storagePath } = await uploadImageFile(
            task.file,
            report.id,
            issue.issueNumber,
            (pct) => {
              setUploadQueue((current) =>
                current.map((t) => (t.id === task.id ? { ...t, progress: pct } : t))
              );
            }
          );

          // 2. Create Firestore Photo document with denormalized fields
          const createdPhoto = await createPhoto(report.id, issue.id, {
            imageFile: downloadUrl,
            description: '',
            isReferenceImage: false,
            issueNumber: issue.issueNumber, // Denormalized parent issue number
            jobReference: report.jobReference, // Denormalized parent job reference
            storagePath,
          });

          // 3. Mark complete
          setUploadQueue((current) =>
            current.map((t) =>
              t.id === task.id
                ? { ...t, status: 'complete', progress: 100, photoId: createdPhoto.id }
                : t
            )
          );
        } catch (err: any) {
          console.error(`Upload error for file ${task.name}:`, err);
          setUploadQueue((current) =>
            current.map((t) =>
              t.id === task.id
                ? {
                    ...t,
                    status: 'failed',
                    error: err?.message || 'Upload failed. Tap retry.',
                  }
                : t
            )
          );
        }
      })
    );

    setIsBatchUploading(false);
  };

  // Retry failed upload task
  const retryUploadTask = async (task: UploadTaskItem) => {
    setUploadQueue((current) =>
      current.map((t) => (t.id === task.id ? { ...t, status: 'uploading', progress: 0, error: undefined } : t))
    );

    try {
      const { downloadUrl, storagePath } = await uploadImageFile(
        task.file,
        report.id,
        issue.issueNumber,
        (pct) => {
          setUploadQueue((current) =>
            current.map((t) => (t.id === task.id ? { ...t, progress: pct } : t))
          );
        }
      );

      const createdPhoto = await createPhoto(report.id, issue.id, {
        imageFile: downloadUrl,
        description: '',
        isReferenceImage: false,
        issueNumber: issue.issueNumber,
        jobReference: report.jobReference,
        storagePath,
      });

      setUploadQueue((current) =>
        current.map((t) =>
          t.id === task.id
            ? { ...t, status: 'complete', progress: 100, photoId: createdPhoto.id }
            : t
        )
      );
    } catch (err: any) {
      setUploadQueue((current) =>
        current.map((t) =>
          t.id === task.id ? { ...t, status: 'failed', error: err?.message || 'Retry failed.' } : t
        )
      );
    }
  };

  // Dismiss completed task from queue list
  const dismissTask = (taskId: string) => {
    setUploadQueue((current) => current.filter((t) => t.id !== taskId));
  };

  // In-Browser Live Camera Capture (for devices without native capture input)
  const openDirectCamera = async () => {
    // Try device camera input first on mobile and touch tablets (including iPadOS)
    const isTouchOrMobile =
      /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
      (typeof navigator !== 'undefined' && 'maxTouchPoints' in navigator && navigator.maxTouchPoints > 1);

    if (isTouchOrMobile && cameraInputRef.current) {
      cameraInputRef.current.click();
      return;
    }

    // On desktop / browsers, launch in-app camera modal
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = stream;
      setIsCameraActive(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      }, 200);
    } catch {
      // Fall back to native camera input dialog
      if (cameraInputRef.current) {
        cameraInputRef.current.click();
      }
    }
  };

  const captureVideoFrame = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (blob) {
          const file = new File([blob], `capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
          handleFilesSelected([file]);
        }
        closeCameraModal();
      },
      'image/jpeg',
      0.9
    );
  };

  const closeCameraModal = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const handleDeleteIssueConfirm = async () => {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteIssue(report.id, issue.id);
      setShowDeleteConfirm(false);
      onIssueDeleted();
    } catch (err: any) {
      console.error('Failed to delete issue:', err);
      setDeleteError('Failed to delete issue. Please try again.');
      setIsDeleting(false);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-5 sm:py-7 flex flex-col min-h-screen">
      {/* Header: Back Action & Prominent Issue Number */}
      <div className="pb-4 border-b border-stone-200">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className="min-h-[48px] px-3.5 py-2 -ml-2 text-stone-700 hover:text-stone-950 hover:bg-stone-100 rounded-xl font-bold text-sm inline-flex items-center gap-2 transition-colors"
            id="back-to-report-btn"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>{report.jobReference || 'Report'}</span>
          </button>

          <span className="text-xs font-extrabold px-3 py-1 bg-stone-100 border border-stone-300 rounded-lg text-stone-700">
            {report.jobReference}
          </span>
        </div>

        <div className="mt-2 flex items-baseline gap-3">
          <span className="px-3.5 py-1.5 bg-stone-900 text-white rounded-lg font-black text-base sm:text-lg tracking-wide shrink-0">
            Issue {issue.issueNumber}
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight truncate">
            {issueName || 'New Inspection Issue'}
          </h1>
        </div>
      </div>

      {/* Save Feedback Banner */}
      {saveSuccess && (
        <div className="mt-4 p-3.5 bg-emerald-50 border-2 border-emerald-300 rounded-xl text-emerald-900 text-sm font-bold flex items-center gap-2 animate-fadeIn">
          <Check className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>Issue details saved to Firestore</span>
        </div>
      )}

      {saveError && (
        <div className="mt-4 p-3.5 bg-red-50 border-2 border-red-300 rounded-xl text-red-900 text-sm font-semibold flex items-center gap-2 animate-fadeIn">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <span>{saveError}</span>
        </div>
      )}

      {/* Editable Issue Fields */}
      <div className="mt-5 bg-white border-2 border-stone-300 rounded-2xl p-5 sm:p-6 shadow-2xs space-y-4">
        <div>
          <label
            htmlFor="issueName"
            className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1"
          >
            Issue Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="issueName"
            value={issueName}
            onChange={(e) => setIssueName(e.target.value)}
            placeholder="e.g., Damaged Roof Flashing, Water Ingress"
            className="w-full min-h-[52px] px-4 py-3 bg-stone-50 border-2 border-stone-300 rounded-xl text-stone-900 font-bold text-base sm:text-lg focus:border-blue-700 focus:bg-white focus:outline-hidden"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label
              htmlFor="issueDescription"
              className="text-xs font-bold uppercase tracking-wider text-stone-700"
            >
              Issue Description
            </label>
          </div>
          <textarea
            id="issueDescription"
            rows={3}
            value={issueDescription}
            onChange={(e) => setIssueDescription(e.target.value)}
            placeholder="Document detailed observations, measurements, severity, or remediation recommendations..."
            className="w-full p-4 bg-stone-50 border-2 border-stone-300 rounded-xl text-stone-900 font-medium text-base focus:border-blue-700 focus:bg-white focus:outline-hidden"
          />
        </div>

        <button
          type="button"
          onClick={handleSaveIssue}
          disabled={isSaving}
          id="save-issue-btn"
          className="w-full min-h-[52px] px-6 py-3 bg-blue-700 hover:bg-blue-800 active:bg-blue-900 text-white rounded-xl font-bold text-base shadow-sm transition-all flex items-center justify-center gap-2 border-2 border-blue-800"
        >
          {isSaving ? (
            <>
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Saving Issue...</span>
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              <span>Save Issue Details</span>
            </>
          )}
        </button>
      </div>

      {/* 12. PHOTO ACTIONS (TWO LARGE PRIMARY BUTTONS FOR GLOVED/OUTDOOR USE) */}
      <div className="mt-7">
        <h2 className="text-xs font-bold uppercase tracking-wider text-stone-600 mb-2.5">
          Photo Evidence Actions
        </h2>

        {/* Hidden File Inputs */}
        <input
          type="file"
          ref={galleryInputRef}
          accept="image/*"
          multiple
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              handleFilesSelected(e.target.files);
            }
            e.target.value = '';
          }}
          className="hidden"
          id="gallery-input"
        />

        <input
          type="file"
          ref={cameraInputRef}
          accept="image/*"
          capture="environment"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              handleFilesSelected(e.target.files);
            }
            e.target.value = '';
          }}
          className="hidden"
          id="camera-input"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* Choose from Gallery Button */}
          <button
            type="button"
            onClick={() => galleryInputRef.current?.click()}
            disabled={isBatchUploading}
            id="choose-from-gallery-btn"
            className="min-h-[66px] px-5 py-4 bg-blue-700 hover:bg-blue-800 active:bg-blue-900 text-white rounded-2xl font-black text-lg tracking-wide shadow-md transition-all flex items-center justify-center gap-3 border-2 border-blue-800 active:scale-[0.99] select-none"
          >
            <ImageIcon className="w-7 h-7 stroke-[2.2]" />
            <span>Choose from Gallery</span>
          </button>

          {/* Take Photo Button */}
          <button
            type="button"
            onClick={openDirectCamera}
            disabled={isBatchUploading}
            id="take-photo-btn"
            className="min-h-[66px] px-5 py-4 bg-stone-900 hover:bg-stone-800 active:bg-black text-white rounded-2xl font-black text-lg tracking-wide shadow-md transition-all flex items-center justify-center gap-3 border-2 border-stone-950 active:scale-[0.99] select-none"
          >
            <Camera className="w-7 h-7 stroke-[2.2] text-amber-400" />
            <span>Take Photo</span>
          </button>
        </div>
      </div>

      {/* 13. MULTI-IMAGE UPLOAD STATUS & PROGRESS ENGINE */}
      {uploadQueue.length > 0 && (
        <div className="mt-5 p-4 bg-white border-2 border-stone-300 rounded-2xl shadow-sm space-y-3 animate-fadeIn">
          <div className="flex items-center justify-between pb-2 border-b border-stone-200">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-700">
              Upload Queue ({uploadQueue.filter((t) => t.status === 'complete').length}/
              {uploadQueue.length} Complete)
            </span>
            {isBatchUploading && (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Uploading batch...
              </span>
            )}
          </div>

          <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
            {uploadQueue.map((task) => (
              <div
                key={task.id}
                className="p-3 bg-stone-50 border border-stone-200 rounded-xl flex items-center justify-between gap-3 text-sm"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-stone-900 truncate">{task.name}</p>
                  <div className="w-full bg-stone-200 h-2 rounded-full mt-1.5 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        task.status === 'complete'
                          ? 'bg-emerald-500'
                          : task.status === 'failed'
                          ? 'bg-red-500'
                          : 'bg-blue-600'
                      }`}
                      style={{ width: `${task.progress}%` }}
                    />
                  </div>
                  {task.error && (
                    <p className="text-xs text-red-600 font-medium mt-1">{task.error}</p>
                  )}
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  {task.status === 'uploading' && (
                    <span className="text-xs font-bold text-stone-600">{task.progress}%</span>
                  )}
                  {task.status === 'complete' && (
                    <div className="flex items-center gap-1 text-emerald-700 font-bold text-xs">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      <span>Complete</span>
                    </div>
                  )}
                  {task.status === 'failed' && (
                    <button
                      type="button"
                      onClick={() => retryUploadTask(task)}
                      className="px-2.5 py-1 bg-red-100 hover:bg-red-200 text-red-800 rounded-lg text-xs font-bold border border-red-300"
                    >
                      Retry
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => dismissTask(task.id)}
                    className="p-1 text-stone-400 hover:text-stone-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 14. PHOTO LIST & RESPONSIVE THUMBNAIL GRID */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight flex items-center gap-2">
            <ImageIcon className="w-6 h-6 text-stone-700" />
            <span>Captured Photos</span>
          </h2>
          <span className="px-3 py-1 bg-stone-200 text-stone-800 rounded-lg text-xs font-bold">
            {photos.length} {photos.length === 1 ? 'Photo' : 'Photos'}
          </span>
        </div>

        {isLoadingPhotos ? (
          <div className="py-8 text-center text-stone-500">
            <div className="w-6 h-6 border-2 border-blue-700 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-sm font-semibold">Loading photos...</p>
          </div>
        ) : photos.length === 0 ? (
          <div className="py-12 px-4 text-center bg-stone-100 border-2 border-dashed border-stone-300 rounded-2xl">
            <Camera className="w-12 h-12 text-stone-400 mx-auto mb-2" />
            <h4 className="text-lg font-bold text-stone-800">No photos added yet</h4>
            <p className="text-xs text-stone-600 mt-1 max-w-xs mx-auto">
              Tap "Choose from Gallery" or "Take Photo" to upload photos for Issue {issue.issueNumber}.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
            {photos.map((photo) => (
              <div
                key={photo.id}
                onClick={() => onOpenPhoto(photo.id)}
                className="group relative bg-white border-2 border-stone-300 hover:border-blue-600 rounded-xl overflow-hidden shadow-2xs hover:shadow-md transition-all cursor-pointer select-none active:scale-[0.98]"
                id={`photo-thumbnail-${photo.id}`}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') onOpenPhoto(photo.id);
                }}
              >
                {/* Image Aspect ratio container */}
                <div className="relative aspect-[4/3] w-full bg-stone-100 overflow-hidden">
                  <img
                    src={photo.imageFile}
                    alt={photo.description || `Photo for Issue ${photo.issueNumber}`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    loading="lazy"
                  />

                  {/* Reference Image Badge */}
                  {photo.isReferenceImage && (
                    <div className="absolute top-2 left-2 px-2 py-0.5 bg-amber-500 text-stone-950 font-black text-[11px] rounded-md shadow-md border border-amber-300 flex items-center gap-1">
                      <Star className="w-3 h-3 fill-stone-950" />
                      <span>Reference</span>
                    </div>
                  )}
                </div>

                {/* Description snippet */}
                <div className="p-2.5 bg-white border-t border-stone-200">
                  <p className="text-xs text-stone-700 font-medium line-clamp-1">
                    {photo.description ? (
                      photo.description
                    ) : (
                      <span className="italic text-stone-400">No description</span>
                    )}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 20. DELETE ISSUE (Bottom of Screen per spec) */}
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
          id="delete-issue-btn"
          className="w-full min-h-[52px] px-6 py-3 border-2 border-red-300 hover:border-red-600 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-base rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          <Trash2 className="w-5 h-5 text-red-600" />
          <span>Delete Issue {issue.issueNumber}</span>
        </button>
      </div>

      {/* Confirmation Dialog for Delete Issue */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title={`Delete Issue ${issue.issueNumber}?`}
        message={`Deleting this issue will remove its photos and permanently retire Issue Number ${issue.issueNumber}. Issue numbers are never reused.`}
        confirmLabel="Delete Issue"
        cancelLabel="Cancel"
        isDestructive={true}
        isLoading={isDeleting}
        onConfirm={handleDeleteIssueConfirm}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      {/* Live Camera Viewport Modal (for in-browser capture fallback) */}
      {isCameraActive && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-between p-4 sm:p-6 animate-fadeIn">
          <div className="w-full flex items-center justify-between text-white">
            <span className="font-bold text-lg">Live Camera Capture</span>
            <button
              type="button"
              onClick={closeCameraModal}
              className="p-2 text-white/80 hover:text-white"
            >
              <X className="w-7 h-7" />
            </button>
          </div>

          <div className="relative w-full max-w-lg aspect-[4/3] rounded-2xl overflow-hidden bg-stone-900 border-2 border-white/20 my-auto shadow-2xl">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          </div>

          <div className="w-full max-w-lg flex items-center justify-center pb-6">
            <button
              type="button"
              onClick={captureVideoFrame}
              className="w-20 h-20 rounded-full bg-white border-4 border-stone-400 hover:bg-stone-100 active:scale-95 shadow-xl flex items-center justify-center"
              aria-label="Capture Photo"
            >
              <div className="w-16 h-16 rounded-full bg-blue-700 flex items-center justify-center text-white">
                <Camera className="w-8 h-8" />
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
