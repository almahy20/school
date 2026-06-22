/**
 * أسماء Collections في Firestore
 * مركزية لتجنب الأخطاء الإملائية
 */
export const COLLECTIONS = {
  SCHOOLS:              'schools',
  PROFILES:             'profiles',
  USER_ROLES:           'userRoles',
  STUDENTS:             'students',
  CLASSES:              'classes',
  ATTENDANCE:           'attendance',
  TEACHER_ATTENDANCE:   'teacherAttendance',
  GRADES:               'grades',
  EXAM_TEMPLATES:       'examTemplates',
  FEES:                 'fees',
  FEE_PAYMENTS:         'feePayments',
  MESSAGES:             'messages',
  COMPLAINTS:           'complaints',
  NOTIFICATIONS:        'notifications',
  CURRICULUMS:          'curriculums',
  CURRICULUM_SUBJECTS:  'curriculumSubjects',
  STUDENT_PARENTS:      'studentParents',
  SCHOOL_ORDERS:        'schoolOrders',
  PUSH_TOKENS:          'pushTokens',
  AUDIT_LOGS:           'auditLogs',
} as const;

export type CollectionName = typeof COLLECTIONS[keyof typeof COLLECTIONS];
