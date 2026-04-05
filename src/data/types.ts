export type UserRole = 'admin' | 'teacher' | 'parent';

export interface User {
  id: string;
  username: string;
  password: string;
  name: string;
  role: UserRole;
  linkedId?: string; // teacherId or parentId
}

export interface Student {
  id: string;
  name: string;
  classId: string;
  parentId: string;
  birthDate: string;
  phone: string;
  address: string;
}

export interface Teacher {
  id: string;
  name: string;
  subject: string;
  phone: string;
  email: string;
  classIds: string[];
}

export interface Parent {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  childrenIds: string[];
}

export interface SchoolClass {
  id: string;
  name: string;
  grade: string;
  teacherId: string;
  studentIds: string[];
}

export interface Attendance {
  id: string;
  studentId: string;
  date: string;
  status: 'present' | 'absent' | 'late';
}

export interface Grade {
  id: string;
  studentId: string;
  subject: string;
  score: number;
  maxScore: number;
  date: string;
  term: string;
}

export interface Message {
  id: string;
  fromId: string;
  toParentId: string;
  studentId: string;
  content: string;
  date: string;
  read: boolean;
}
