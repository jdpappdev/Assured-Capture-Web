import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import {
  db,
  storage,
  handleFirestoreError,
  OperationType,
} from '../firebase';
import type {
  Report,
  Issue,
  Photo,
  InspectionDateHistoryRecord,
} from '../types';

// Helper to generate IDs
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Recursively removes all keys with undefined values so Firestore setDoc/updateDoc never rejects payloads.
 */
export function cleanPayload<T extends Record<string, any>>(obj: T): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        result[key] = cleanPayload(value);
      } else {
        result[key] = value;
      }
    }
  }
  return result;
}

// Generate BBC-[YY]- default job reference (prefills with BBC-26- only)
export function generateDefaultJobReference(): string {
  const currentYear = new Date().getFullYear().toString().slice(-2); // e.g. "26"
  return `BBC-${currentYear}-`;
}

export function formatCurrentDate(): string {
  const today = new Date();
  return today.toISOString().split('T')[0]; // "YYYY-MM-DD"
}

// ==========================================
// REPORTS
// ==========================================

export function subscribeReports(onReports: (reports: Report[]) => void, onError?: (err: Error) => void) {
  const reportsCol = collection(db, 'reports');
  const q = query(reportsCol, orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const reports: Report[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          jobReference: data.jobReference || '',
          reportName: data.reportName || '',
          clientName: data.clientName || '',
          address: data.address || '',
          reportDate: data.reportDate || formatCurrentDate(),
          status: data.status || 'Draft',
          inspectionDate: data.inspectionDate || formatCurrentDate(),
          inspectionDateHistory: Array.isArray(data.inspectionDateHistory)
            ? data.inspectionDateHistory
            : [],
          highestIssueNumberAssigned: data.highestIssueNumberAssigned || 0,
          userId: data.userId,
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt || new Date().toISOString(),
        };
      });
      onReports(reports);
    },
    (err) => {
      console.error('Failed to subscribe to reports:', err);
      const errorObj = handleFirestoreError(err, OperationType.LIST, 'reports');
      if (onError) onError(errorObj);
    }
  );
}

export async function createReport(userId?: string): Promise<Report> {
  const newId = generateId();
  const today = formatCurrentDate();
  const defaultJobRef = generateDefaultJobReference();

  const newReport: Report = {
    id: newId,
    jobReference: defaultJobRef,
    reportName: 'New Inspection Report',
    clientName: '',
    address: '',
    reportDate: today,
    status: 'Draft',
    inspectionDate: today,
    inspectionDateHistory: [],
    highestIssueNumberAssigned: 0,
    ...(userId ? { userId } : {}),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  try {
    await setDoc(doc(db, 'reports', newId), cleanPayload(newReport));
    return newReport;
  } catch (err) {
    throw handleFirestoreError(err, OperationType.CREATE, `reports/${newId}`);
  }
}

export async function updateReport(
  reportId: string,
  updates: Partial<Report>,
  previousReport: Report
): Promise<void> {
  try {
    const finalUpdates: Record<string, any> = {
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    // Rule 4: Inspection Date History is append-only
    // "When the inspection date changes:
    //  Read the existing inspection date.
    //  Append the previous date and current timestamp to inspectionDateHistory.
    //  Save the new inspection date.
    //  If the inspection date has not changed, do not create a new history entry."
    if (
      updates.inspectionDate &&
      updates.inspectionDate !== previousReport.inspectionDate
    ) {
      const historyEntry: InspectionDateHistoryRecord = {
        date: previousReport.inspectionDate,
        changedAt: new Date().toISOString(),
      };
      const existingHistory = previousReport.inspectionDateHistory || [];
      finalUpdates.inspectionDateHistory = [historyEntry, ...existingHistory];
    }

    await updateDoc(doc(db, 'reports', reportId), cleanPayload(finalUpdates));
  } catch (err) {
    throw handleFirestoreError(err, OperationType.UPDATE, `reports/${reportId}`);
  }
}

export async function deleteReport(reportId: string): Promise<void> {
  try {
    // Delete issues subcollection first
    const issuesSnap = await getDocs(collection(db, 'reports', reportId, 'issues'));
    for (const issueDoc of issuesSnap.docs) {
      const photosSnap = await getDocs(
        collection(db, 'reports', reportId, 'issues', issueDoc.id, 'photos')
      );
      for (const photoDoc of photosSnap.docs) {
        await deleteDoc(doc(db, 'reports', reportId, 'issues', issueDoc.id, 'photos', photoDoc.id));
      }
      await deleteDoc(doc(db, 'reports', reportId, 'issues', issueDoc.id));
    }
    // Delete main report
    await deleteDoc(doc(db, 'reports', reportId));
  } catch (err) {
    throw handleFirestoreError(err, OperationType.DELETE, `reports/${reportId}`);
  }
}

// ==========================================
// ISSUES
// ==========================================

export function subscribeIssues(
  reportId: string,
  onIssues: (issues: Issue[]) => void,
  onError?: (err: Error) => void
) {
  const issuesCol = collection(db, 'reports', reportId, 'issues');
  const q = query(issuesCol, orderBy('issueNumber', 'asc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const issues: Issue[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          reportId,
          issueNumber: data.issueNumber,
          issueName: data.issueName || '',
          issueDescription: data.issueDescription || '',
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt || new Date().toISOString(),
        };
      });
      onIssues(issues);
    },
    (err) => {
      console.error(`Failed to subscribe to issues for report ${reportId}:`, err);
      const errorObj = handleFirestoreError(
        err,
        OperationType.LIST,
        `reports/${reportId}/issues`
      );
      if (onError) onError(errorObj);
    }
  );
}

/**
 * Creates a new Issue with permanent sequential issue numbering.
 * Rule: Next unused issue number within the report.
 * Once assigned, permanently retired if deleted.
 * Never reuse numbers from deleted issues.
 */
export async function createIssue(
  report: Report,
  initialData?: { issueName?: string; issueDescription?: string }
): Promise<Issue> {
  const issuesCol = collection(db, 'reports', report.id, 'issues');
  const issuesSnap = await getDocs(issuesCol);
  
  let currentMaxNumber = report.highestIssueNumberAssigned || 0;
  issuesSnap.docs.forEach((d) => {
    const num = d.data().issueNumber;
    if (typeof num === 'number' && num > currentMaxNumber) {
      currentMaxNumber = num;
    }
  });

  const nextIssueNumber = currentMaxNumber + 1;
  const issueId = generateId();

  const newIssue: Issue = {
    id: issueId,
    reportId: report.id,
    issueNumber: nextIssueNumber,
    issueName: initialData?.issueName?.trim() || '',
    issueDescription: initialData?.issueDescription?.trim() || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  try {
    // Save new issue
    await setDoc(doc(db, 'reports', report.id, 'issues', issueId), cleanPayload(newIssue));

    // Update highestIssueNumberAssigned in parent report so it is never reused
    await updateDoc(doc(db, 'reports', report.id), cleanPayload({
      highestIssueNumberAssigned: nextIssueNumber,
      updatedAt: new Date().toISOString(),
    }));

    return newIssue;
  } catch (err) {
    throw handleFirestoreError(
      err,
      OperationType.CREATE,
      `reports/${report.id}/issues/${issueId}`
    );
  }
}

export async function updateIssue(
  reportId: string,
  issueId: string,
  updates: Partial<Issue>
): Promise<void> {
  try {
    await updateDoc(doc(db, 'reports', reportId, 'issues', issueId), cleanPayload({
      ...updates,
      updatedAt: new Date().toISOString(),
    }));
  } catch (err) {
    throw handleFirestoreError(
      err,
      OperationType.UPDATE,
      `reports/${reportId}/issues/${issueId}`
    );
  }
}

export async function deleteIssue(reportId: string, issueId: string): Promise<void> {
  try {
    // Delete photos inside issue
    const photosSnap = await getDocs(
      collection(db, 'reports', reportId, 'issues', issueId, 'photos')
    );
    for (const photoDoc of photosSnap.docs) {
      await deleteDoc(
        doc(db, 'reports', reportId, 'issues', issueId, 'photos', photoDoc.id)
      );
    }
    // Delete issue document
    await deleteDoc(doc(db, 'reports', reportId, 'issues', issueId));
  } catch (err) {
    throw handleFirestoreError(
      err,
      OperationType.DELETE,
      `reports/${reportId}/issues/${issueId}`
    );
  }
}

// ==========================================
// PHOTOS
// ==========================================

export function subscribePhotos(
  reportId: string,
  issueId: string,
  onPhotos: (photos: Photo[]) => void,
  onError?: (err: Error) => void
) {
  const photosCol = collection(db, 'reports', reportId, 'issues', issueId, 'photos');
  const q = query(photosCol, orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const photos: Photo[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          reportId,
          issueId,
          imageFile: data.imageFile || '',
          description: data.description || '',
          isReferenceImage: Boolean(data.isReferenceImage),
          issueNumber: data.issueNumber,
          jobReference: data.jobReference || '',
          storagePath: data.storagePath || '',
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt || new Date().toISOString(),
        };
      });
      onPhotos(photos);
    },
    (err) => {
      console.error(`Failed to subscribe to photos for issue ${issueId}:`, err);
      const errorObj = handleFirestoreError(
        err,
        OperationType.LIST,
        `reports/${reportId}/issues/${issueId}/photos`
      );
      if (onError) onError(errorObj);
    }
  );
}

export async function getPhotosCountForIssue(
  reportId: string,
  issueId: string
): Promise<number> {
  try {
    const photosSnap = await getDocs(
      collection(db, 'reports', reportId, 'issues', issueId, 'photos')
    );
    return photosSnap.size;
  } catch {
    return 0;
  }
}

export async function createPhoto(
  reportId: string,
  issueId: string,
  data: {
    imageFile: string;
    description?: string;
    isReferenceImage?: boolean;
    issueNumber: number; // Copied from parent Issue
    jobReference: string; // Copied from parent Report
    storagePath?: string;
  }
): Promise<Photo> {
  const photoId = generateId();
  const newPhoto: Photo = {
    id: photoId,
    reportId,
    issueId,
    imageFile: data.imageFile,
    description: data.description || '',
    isReferenceImage: Boolean(data.isReferenceImage),
    issueNumber: data.issueNumber,
    jobReference: data.jobReference,
    storagePath: data.storagePath || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  try {
    await setDoc(
      doc(db, 'reports', reportId, 'issues', issueId, 'photos', photoId),
      cleanPayload(newPhoto)
    );
    return newPhoto;
  } catch (err) {
    throw handleFirestoreError(
      err,
      OperationType.CREATE,
      `reports/${reportId}/issues/${issueId}/photos/${photoId}`
    );
  }
}

export async function updatePhoto(
  reportId: string,
  issueId: string,
  photoId: string,
  updates: Partial<Photo>
): Promise<void> {
  try {
    await updateDoc(
      doc(db, 'reports', reportId, 'issues', issueId, 'photos', photoId),
      cleanPayload({
        ...updates,
        updatedAt: new Date().toISOString(),
      })
    );
  } catch (err) {
    throw handleFirestoreError(
      err,
      OperationType.UPDATE,
      `reports/${reportId}/issues/${issueId}/photos/${photoId}`
    );
  }
}

export async function deletePhoto(
  reportId: string,
  issueId: string,
  photoId: string,
  storagePath?: string
): Promise<void> {
  try {
    if (storagePath) {
      try {
        const storageRef = ref(storage, storagePath);
        await deleteObject(storageRef);
      } catch (storageErr) {
        console.warn('Storage file deletion warning (continuing doc deletion):', storageErr);
      }
    }
    await deleteDoc(
      doc(db, 'reports', reportId, 'issues', issueId, 'photos', photoId)
    );
  } catch (err) {
    throw handleFirestoreError(
      err,
      OperationType.DELETE,
      `reports/${reportId}/issues/${issueId}/photos/${photoId}`
    );
  }
}

// ==========================================
// FIREBASE STORAGE IMAGE UPLOAD
// ==========================================

export interface UploadProgressCallback {
  (progress: number): void;
}

/**
 * Converts File to Base64 data URL for fallback if offline / storage fails
 */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Uploads a single image to Firebase Storage with progress tracking.
 * If Storage upload fails, falls back gracefully to resilient dataUrl so field inspector data is never lost.
 */
export async function uploadImageFile(
  file: File,
  reportId: string,
  issueNumber: number,
  onProgress?: UploadProgressCallback
): Promise<{ downloadUrl: string; storagePath: string }> {
  const timestamp = Date.now();
  const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `reports/${reportId}/issues/issue_${issueNumber}/${timestamp}_${cleanName}`;
  const storageRef = ref(storage, storagePath);

  try {
    const uploadTask = uploadBytesResumable(storageRef, file);

    return await new Promise((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = Math.round(
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100
          );
          if (onProgress) onProgress(progress);
        },
        async (error) => {
          console.warn('Firebase Storage upload error, using local fallback:', error);
          try {
            const fallbackUrl = await fileToDataUrl(file);
            if (onProgress) onProgress(100);
            resolve({
              downloadUrl: fallbackUrl,
              storagePath: `fallback://${storagePath}`,
            });
          } catch (fbErr) {
            reject(error);
          }
        },
        async () => {
          try {
            const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
            if (onProgress) onProgress(100);
            resolve({ downloadUrl, storagePath });
          } catch (urlErr) {
            console.warn('Could not retrieve download URL, using data URL fallback:', urlErr);
            const fallbackUrl = await fileToDataUrl(file);
            resolve({
              downloadUrl: fallbackUrl,
              storagePath: `fallback://${storagePath}`,
            });
          }
        }
      );
    });
  } catch (err) {
    console.warn('Direct upload failed, providing local dataUrl fallback:', err);
    const fallbackUrl = await fileToDataUrl(file);
    if (onProgress) onProgress(100);
    return {
      downloadUrl: fallbackUrl,
      storagePath: `fallback://${storagePath}`,
    };
  }
}
