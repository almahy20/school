// ── School ────────────────────────────────────────────────────────────────────
export interface School {
  id: string;
  name: string;
  slug: string | null;
  logoUrl: string | null;
  plan: 'basic' | 'pro' | 'enterprise' | null;
  status: 'active' | 'suspended';
  subscriptionDate: string | null;
  subscriptionEndDate: string | null;
  createdAt: string;
}

// ── Profile ───────────────────────────────────────────────────────────────────
export interface Profile {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  schoolId: string | null;
  specialization: string | null;
  lastSeen: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Student ───────────────────────────────────────────────────────────────────
export interface Student {
  id: string;
  name: string;
  classId: string | null;
  className?: string | null;
  schoolId: string;
  birthDate: string | null;
  parentPhone: string | null;
  notes: string | null;
  monthlyFee?: number | null;
  createdAt: string;
  updatedAt: string;
}

// ── Class ─────────────────────────────────────────────────────────────────────
export interface Class {
  id: string;
  name: string;
  gradeLevel: string | null;
  teacherId: string | null;
  teacherName?: string | null;
  schoolId: string;
  curriculumId: string | null;
  studentCount?: number;
  createdAt: string;
}

// ── Attendance ────────────────────────────────────────────────────────────────
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

export interface AttendanceRecord {
  id: string;
  studentId: string;
  studentName?: string;
  classId: string | null;
  schoolId: string;
  date: string;
  status: AttendanceStatus;
  createdAt: string;
}

export interface TeacherAttendanceRecord {
  id: string;
  teacherId: string;
  teacherName?: string;
  schoolId: string;
  date: string;
  status: AttendanceStatus;
  createdAt: string;
}

// ── Grades ────────────────────────────────────────────────────────────────────
export type ExamType = 'daily' | 'monthly' | 'final' | 'quiz';
export type ScoreType = 'numeric' | 'text';

export interface ExamTemplate {
  id: string;
  classId: string;
  teacherId: string;
  schoolId: string;
  title: string;
  subject: string;
  examType: ExamType;
  maxScore: number;
  weight: number;
  term: string;
  scoreType: ScoreType;
  expectedResults: string[] | null;
  createdAt: string;
}

export interface Grade {
  id: string;
  studentId: string;
  studentName?: string;
  teacherId: string | null;
  schoolId: string;
  subject: string;
  score: number;
  maxScore: number;
  term: string;
  examTemplateId: string | null;
  date: string;
  createdAt: string;
}

// ── Fees ──────────────────────────────────────────────────────────────────────
export type FeeStatus = 'paid' | 'unpaid' | 'partial';

export interface Fee {
  id: string;
  studentId: string;
  studentName?: string;
  schoolId: string;
  term: string;
  amountDue: number;
  amountPaid: number;
  status: FeeStatus;
  createdAt: string;
  updatedAt: string;
}

export interface FeePayment {
  id: string;
  feeId: string;
  schoolId: string;
  amount: number;
  paymentDate: string;
  paymentMethod: string | null;
}

// ── Messages ──────────────────────────────────────────────────────────────────
export interface Message {
  id: string;
  senderId: string;
  senderName?: string;
  receiverId: string;
  receiverName?: string;
  studentId: string | null;
  schoolId: string;
  content: string;
  isRead: boolean;
  createdAt: string;
}

// ── Complaints ────────────────────────────────────────────────────────────────
export type ComplaintStatus = 'pending' | 'in_progress' | 'resolved';

export interface Complaint {
  id: string;
  parentId: string;
  parentName?: string;
  studentId: string | null;
  studentName?: string;
  schoolId: string;
  content: string;
  status: ComplaintStatus;
  adminResponse: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Notifications ─────────────────────────────────────────────────────────────
export type NotificationType = 'attendance' | 'grade' | 'fee' | 'message' | 'complaint' | 'general';

export interface Notification {
  id: string;
  userId: string;
  schoolId: string;
  title: string;
  body: string;
  type: NotificationType;
  isRead: boolean;
  data?: Record<string, unknown>;
  createdAt: string;
}

// ── Curriculum ────────────────────────────────────────────────────────────────
export interface Curriculum {
  id: string;
  name: string;
  schoolId: string;
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface CurriculumSubject {
  id: string;
  curriculumId: string;
  subjectName: string;
  content: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── School Order ──────────────────────────────────────────────────────────────
export type OrderStatus = 'pending' | 'approved' | 'rejected';

export interface SchoolOrder {
  id: string;
  schoolName: string;
  schoolSlug: string;
  adminName: string;
  adminPhone: string;
  adminWhatsapp: string;
  plan: string;
  status: OrderStatus;
  logoUrl: string | null;
  receiptUrl: string | null;
  receiptNote: string | null;
  rejectionNote: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Stats ─────────────────────────────────────────────────────────────────────
export interface AdminStats {
  totalStudents: number;
  totalTeachers: number;
  totalParents: number;
  totalClasses: number;
  todayAttendanceRate: number;
  totalFeesCollected: number;
  totalFeesDue: number;
  pendingComplaints: number;
}

export interface TeacherStats {
  totalClasses: number;
  totalStudents: number;
  todayAttendanceRate: number;
}

export interface ParentChildSummary {
  studentId: string;
  studentName: string;
  className: string | null;
  attendanceRate: number;
  feeStatus: FeeStatus;
  amountDue: number;
  amountPaid: number;
  lastGrade?: number | null;
}
