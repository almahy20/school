// React Query hooks for data caching
// Import from here instead of calling Supabase directly in components

export { useStudents, useDeleteStudent, useAddStudent } from './useStudents';
export type { Student } from './useStudents';

export { useTeachers, useDeleteTeacher } from './useTeachers';
export type { Teacher } from './useTeachers';

export { useClasses, useTeacherClasses, useDeleteClass } from './useClasses';
export type { Class } from './useClasses';

export { useParents } from './useParents';
export type { Parent } from './useParents';

export { useAttendance, useAddAttendance } from './useAttendance';
export type { AttendanceRecord } from './useAttendance';

export { useGrades, useAddGrade, useDeleteGrade } from './useGrades';
export type { Grade } from './useGrades';

export { useAssignments, useSubmissions, useCreateAssignment, useDeleteAssignment } from './useAssignments';
export type { Assignment, Submission } from './useAssignments';
