import { doc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import type { Report, Issue, Photo } from '../types';
import { cleanPayload } from './reportService';

// High quality realistic inspection images (Unsplash direct architecture & construction defect images with permissive CORS)
const DEMO_PHOTOS = {
  roofParapet: 'https://images.unsplash.com/photo-1541888946425-d0fbb1861564?auto=format&fit=crop&w=1200&q=80',
  brickworkCrack: 'https://images.unsplash.com/photo-1590381105924-c72589b9ef3f?auto=format&fit=crop&w=1200&q=80',
  dampBasement: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1200&q=80',
  electricalPanel: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=1200&q=80',
  windowSill: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=1200&q=80',
};

export async function seedDemoReports(currentUserId?: string): Promise<void> {
  const timestamp = new Date().toISOString();

  // ----------------------------------------------------
  // DEMO REPORT 1: Commercial Structural & Envelope Audit
  // ----------------------------------------------------
  const report1Id = 'demo-report-bbc-26-01';
  const report1: Report = {
    id: report1Id,
    jobReference: 'BBC-26-01',
    reportName: 'Commercial Building Envelope Condition Survey',
    clientName: 'Apex Commercial Properties Ltd',
    address: '42 Waterfront Boulevard, Docklands Quarter, Unit 3B',
    reportDate: '2026-09-15',
    status: 'In Progress',
    inspectionDate: '2026-09-15',
    inspectionDateHistory: [
      {
        date: '2026-09-10',
        changedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
      },
    ],
    highestIssueNumberAssigned: 2,
    ...(currentUserId ? { userId: currentUserId } : {}),
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  // Issue 1 for Report 1
  const issue1_1Id = 'demo-issue-bbc-26-01-iss1';
  const issue1_1: Issue = {
    id: issue1_1Id,
    reportId: report1Id,
    issueNumber: 1,
    issueName: 'Roof Parapet Membrane Deterioration & Flashing Separation',
    issueDescription:
      'The bituminous waterproof membrane along the northern elevation parapet exhibits severe blistering, loss of mineral chipping cover, and complete detachment from the aluminum counter-flashing. Standing water was noted ponding adjacent to rainwater outlet #2, presenting an active water penetration hazard to fourth-floor office suites.',
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  // Photos for Issue 1
  const photo1_1_1: Photo = {
    id: 'demo-photo-1-1-1',
    reportId: report1Id,
    issueId: issue1_1Id,
    imageFile: DEMO_PHOTOS.roofParapet,
    description:
      'Northern roof edge showing 3.2m linear run of detached lead flashing and blistered single-ply roofing membrane.',
    isReferenceImage: true,
    issueNumber: 1,
    jobReference: 'BBC-26-01',
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const photo1_1_2: Photo = {
    id: 'demo-photo-1-1-2',
    reportId: report1Id,
    issueId: issue1_1Id,
    imageFile: DEMO_PHOTOS.windowSill,
    description:
      'Close-up view of weathered coping joints adjacent to parapet showing failed polyurethane sealant bead.',
    isReferenceImage: false,
    issueNumber: 1,
    jobReference: 'BBC-26-01',
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  // Issue 2 for Report 1
  const issue1_2Id = 'demo-issue-bbc-26-01-iss2';
  const issue1_2: Issue = {
    id: issue1_2Id,
    reportId: report1Id,
    issueNumber: 2,
    issueName: 'External Masonry Shear Cracking along South Stairwell',
    issueDescription:
      'Step-pattern diagonal diagonal cracking identified in facing brickwork between levels 1 and 2 of south stairwell shaft. Crack gauge reading measured at 4.2mm maximum aperture at sill level. Mortar joints display localized spalling and freeze-thaw damage requiring immediate structural tie pinning.',
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const photo1_2_1: Photo = {
    id: 'demo-photo-1-2-1',
    reportId: report1Id,
    issueId: issue1_2Id,
    imageFile: DEMO_PHOTOS.brickworkCrack,
    description:
      'Diagonal shear fracture propagating along mortar perpends through exterior cavity brick courses.',
    isReferenceImage: true,
    issueNumber: 2,
    jobReference: 'BBC-26-01',
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  // ----------------------------------------------------
  // DEMO REPORT 2: Residential Dilapidation & Pre-Lease Audit
  // ----------------------------------------------------
  const report2Id = 'demo-report-bbc-26-02';
  const report2: Report = {
    id: report2Id,
    jobReference: 'BBC-26-02',
    reportName: 'Residential Substructure & MEP Pre-Lease Inspection',
    clientName: 'Stirling Heritage Housing Trust',
    address: '18 Kensington Crescent, Ground & Basement Suite',
    reportDate: '2026-09-14',
    status: 'Completed',
    inspectionDate: '2026-09-14',
    inspectionDateHistory: [],
    highestIssueNumberAssigned: 2,
    ...(currentUserId ? { userId: currentUserId } : {}),
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  // Issue 1 for Report 2
  const issue2_1Id = 'demo-issue-bbc-26-02-iss1';
  const issue2_1: Issue = {
    id: issue2_1Id,
    reportId: report2Id,
    issueNumber: 1,
    issueName: 'Basement Vault Rising Damp & Efflorescence Infiltration',
    issueDescription:
      'Subterranean front coal vault storage area demonstrates pervasive capillary moisture rise with extensive crystalline efflorescence salts and plaster de-bonding up to 1.4m height. Protimeter moisture meter readings exceeded 90% WME across brick substrate.',
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const photo2_1_1: Photo = {
    id: 'demo-photo-2-1-1',
    reportId: report2Id,
    issueId: issue2_1Id,
    imageFile: DEMO_PHOTOS.dampBasement,
    description:
      'Lower basement retaining wall displaying salt crystallization, plaster deterioration, and active damp penetration.',
    isReferenceImage: true,
    issueNumber: 1,
    jobReference: 'BBC-26-02',
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  // Issue 2 for Report 2
  const issue2_2Id = 'demo-issue-bbc-26-02-iss2';
  const issue2_2: Issue = {
    id: issue2_2Id,
    reportId: report2Id,
    issueNumber: 2,
    issueName: 'Main Electrical Distribution Board Clearance & Labeling Defects',
    issueDescription:
      'Main three-phase distribution board located in plant room lacks mandatory circuit directory labeling. Multiple open breaker knockouts exposed without protective blanking plates. Proximity to redundant domestic water pipework breaches 1.0m statutory clear service zone regulations.',
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const photo2_2_1: Photo = {
    id: 'demo-photo-2-2-1',
    reportId: report2Id,
    issueId: issue2_2Id,
    imageFile: DEMO_PHOTOS.electricalPanel,
    description:
      'Consumer unit enclosure showing unsealed cable penetrations and absence of required warning schedules.',
    isReferenceImage: true,
    issueNumber: 2,
    jobReference: 'BBC-26-02',
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  try {
    // Write Report 1 hierarchy
    await setDoc(doc(db, 'reports', report1Id), cleanPayload(report1));
    await setDoc(doc(db, 'reports', report1Id, 'issues', issue1_1Id), cleanPayload(issue1_1));
    await setDoc(doc(db, 'reports', report1Id, 'issues', issue1_1Id, 'photos', photo1_1_1.id), cleanPayload(photo1_1_1));
    await setDoc(doc(db, 'reports', report1Id, 'issues', issue1_1Id, 'photos', photo1_1_2.id), cleanPayload(photo1_1_2));

    await setDoc(doc(db, 'reports', report1Id, 'issues', issue1_2Id), cleanPayload(issue1_2));
    await setDoc(doc(db, 'reports', report1Id, 'issues', issue1_2Id, 'photos', photo1_2_1.id), cleanPayload(photo1_2_1));

    // Write Report 2 hierarchy
    await setDoc(doc(db, 'reports', report2Id), cleanPayload(report2));
    await setDoc(doc(db, 'reports', report2Id, 'issues', issue2_1Id), cleanPayload(issue2_1));
    await setDoc(doc(db, 'reports', report2Id, 'issues', issue2_1Id, 'photos', photo2_1_1.id), cleanPayload(photo2_1_1));

    await setDoc(doc(db, 'reports', report2Id, 'issues', issue2_2Id), cleanPayload(issue2_2));
    await setDoc(doc(db, 'reports', report2Id, 'issues', issue2_2Id, 'photos', photo2_2_1.id), cleanPayload(photo2_2_1));
  } catch (err) {
    throw handleFirestoreError(err, OperationType.WRITE, `reports/demo-reports-seed`);
  }
}
