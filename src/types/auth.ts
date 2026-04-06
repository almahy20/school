export type AppRole = 'admin' | 'teacher' | 'parent';

export interface AppUser {
  id: string;
  email: string;
  phone: string;
  fullName: string;
  role: AppRole;
  isSuperAdmin: boolean;
  schoolId: string | null;
  schoolStatus: 'active' | 'suspended';
  approvalStatus: 'pending' | 'approved' | 'rejected';
  subscriptionExpired: boolean;
}
