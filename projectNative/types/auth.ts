export type AppRole = 'admin' | 'teacher' | 'parent';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export type SchoolStatus = 'active' | 'suspended';

export interface AppUser {
  id: string;
  email: string;
  phone: string;
  fullName: string;
  role: AppRole;
  isSuperAdmin: boolean;
  schoolId: string | null;
  schoolName: string | null;
  schoolLogo: string | null;
  schoolStatus: SchoolStatus;
  approvalStatus: ApprovalStatus;
  subscriptionExpired: boolean;
  specialization?: string | null;
  lastSeen?: string | null;
}
