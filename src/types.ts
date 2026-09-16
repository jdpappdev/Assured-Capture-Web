export type ReportStatus =
  | 'Draft'
  | 'In Progress'
  | 'Awaiting Review'
  | 'Completed'
  | 'Sent to Client';

export interface InspectionDateHistoryRecord {
  date: string; // ISO date string or formatted date
  changedAt: string; // ISO timestamp
}

export interface Report {
  id: string;
  jobReference: string;
  reportName: string;
  clientName: string;
  address: string;
  reportDate: string;
  status: ReportStatus;
  inspectionDate: string;
  inspectionDateHistory: InspectionDateHistoryRecord[];
  highestIssueNumberAssigned?: number;
  userId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Issue {
  id: string;
  reportId: string;
  issueNumber: number;
  issueName: string;
  issueDescription: string;
  createdAt: string;
  updatedAt: string;
}

export interface Photo {
  id: string;
  reportId: string;
  issueId: string;
  imageFile: string; // Storage download URL, storage path, or data URL
  description: string;
  isReferenceImage: boolean;
  issueNumber: number; // Denormalized from parent Issue
  jobReference: string; // Denormalized from parent Report
  storagePath?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UploadTaskItem {
  id: string;
  file: File;
  name: string;
  progress: number;
  status: 'uploading' | 'complete' | 'failed';
  error?: string;
  photoId?: string;
}

export type ScreenName = 'reports_home' | 'report_detail' | 'issue_detail' | 'photo_detail';

export interface AppNavigation {
  screen: ScreenName;
  reportId?: string;
  issueId?: string;
  photoId?: string;
}
