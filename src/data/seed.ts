import { User, Student, Teacher, Parent, SchoolClass, Attendance, Grade, Message } from './types';

// --- Users ---
export const seedUsers: User[] = [
  { id: 'u1', username: 'admin', password: 'admin123', name: 'أحمد الإداري', role: 'admin' },
  { id: 'u2', username: 'teacher1', password: 'teacher123', name: 'محمد العلي', role: 'teacher', linkedId: 't1' },
  { id: 'u3', username: 'teacher2', password: 'teacher123', name: 'فاطمة الزهراء', role: 'teacher', linkedId: 't2' },
  { id: 'u4', username: 'parent1', password: 'parent123', name: 'خالد المنصور', role: 'parent', linkedId: 'p1' },
  { id: 'u5', username: 'parent2', password: 'parent123', name: 'سارة الحمد', role: 'parent', linkedId: 'p2' },
];

// --- Teachers ---
export const seedTeachers: Teacher[] = [
  { id: 't1', name: 'محمد العلي', subject: 'الرياضيات', phone: '0551234567', email: 'mali@school.sa', classIds: ['c1', 'c2'] },
  { id: 't2', name: 'فاطمة الزهراء', subject: 'اللغة العربية', phone: '0559876543', email: 'fatima@school.sa', classIds: ['c3'] },
  { id: 't3', name: 'عبدالله السعيد', subject: 'العلوم', phone: '0553456789', email: 'abdullah@school.sa', classIds: ['c1', 'c3'] },
];

// --- Parents ---
export const seedParents: Parent[] = [
  { id: 'p1', name: 'خالد المنصور', phone: '0561112233', email: 'khalid@email.com', address: 'الرياض، حي النزهة', childrenIds: ['s1', 's2'] },
  { id: 'p2', name: 'سارة الحمد', phone: '0562223344', email: 'sara@email.com', address: 'الرياض، حي الملقا', childrenIds: ['s3'] },
  { id: 'p3', name: 'فهد الدوسري', phone: '0563334455', email: 'fahd@email.com', address: 'جدة، حي الشاطئ', childrenIds: ['s4', 's5'] },
  { id: 'p4', name: 'نورة القحطاني', phone: '0564445566', email: 'noura@email.com', address: 'الدمام، حي الفيصلية', childrenIds: ['s6'] },
];

// --- Classes ---
export const seedClasses: SchoolClass[] = [
  { id: 'c1', name: 'الصف الأول - أ', grade: 'الأول', teacherId: 't1', studentIds: ['s1', 's3', 's4'] },
  { id: 'c2', name: 'الصف الثاني - أ', grade: 'الثاني', teacherId: 't1', studentIds: ['s2', 's5'] },
  { id: 'c3', name: 'الصف الثالث - أ', grade: 'الثالث', teacherId: 't2', studentIds: ['s6'] },
];

// --- Students ---
export const seedStudents: Student[] = [
  { id: 's1', name: 'عمر المنصور', classId: 'c1', parentId: 'p1', birthDate: '2015-03-12', phone: '0561112233', address: 'الرياض' },
  { id: 's2', name: 'ليلى المنصور', classId: 'c2', parentId: 'p1', birthDate: '2014-07-22', phone: '0561112233', address: 'الرياض' },
  { id: 's3', name: 'يوسف الحمد', classId: 'c1', parentId: 'p2', birthDate: '2015-01-05', phone: '0562223344', address: 'الرياض' },
  { id: 's4', name: 'ريم الدوسري', classId: 'c1', parentId: 'p3', birthDate: '2015-09-18', phone: '0563334455', address: 'جدة' },
  { id: 's5', name: 'سلطان الدوسري', classId: 'c2', parentId: 'p3', birthDate: '2014-11-30', phone: '0563334455', address: 'جدة' },
  { id: 's6', name: 'هند القحطاني', classId: 'c3', parentId: 'p4', birthDate: '2013-05-14', phone: '0564445566', address: 'الدمام' },
];

// --- Attendance (last 5 days) ---
const today = new Date();
const days = Array.from({ length: 5 }, (_, i) => {
  const d = new Date(today);
  d.setDate(d.getDate() - i);
  return d.toISOString().split('T')[0];
});

export const seedAttendance: Attendance[] = seedStudents.flatMap((s, si) =>
  days.map((date, di) => ({
    id: `att-${s.id}-${di}`,
    studentId: s.id,
    date,
    status: (si + di) % 5 === 0 ? 'absent' as const : (si + di) % 7 === 0 ? 'late' as const : 'present' as const,
  }))
);

// --- Grades ---
export const seedGrades: Grade[] = [
  { id: 'g1', studentId: 's1', subject: 'الرياضيات', score: 92, maxScore: 100, date: '2025-12-15', term: 'الفصل الأول' },
  { id: 'g2', studentId: 's1', subject: 'اللغة العربية', score: 88, maxScore: 100, date: '2025-12-15', term: 'الفصل الأول' },
  { id: 'g3', studentId: 's2', subject: 'الرياضيات', score: 75, maxScore: 100, date: '2025-12-15', term: 'الفصل الأول' },
  { id: 'g4', studentId: 's3', subject: 'الرياضيات', score: 95, maxScore: 100, date: '2025-12-15', term: 'الفصل الأول' },
  { id: 'g5', studentId: 's3', subject: 'العلوم', score: 80, maxScore: 100, date: '2025-12-15', term: 'الفصل الأول' },
  { id: 'g6', studentId: 's4', subject: 'الرياضيات', score: 68, maxScore: 100, date: '2025-12-15', term: 'الفصل الأول' },
  { id: 'g7', studentId: 's5', subject: 'الرياضيات', score: 85, maxScore: 100, date: '2025-12-15', term: 'الفصل الأول' },
  { id: 'g8', studentId: 's6', subject: 'اللغة العربية', score: 97, maxScore: 100, date: '2025-12-15', term: 'الفصل الأول' },
];

// --- Messages ---
export const seedMessages: Message[] = [
  { id: 'm1', fromId: 't1', toParentId: 'p1', studentId: 's1', content: 'عمر طالب مجتهد ومتميز في الرياضيات. أرجو تشجيعه على المواصلة.', date: '2025-12-20', read: false },
  { id: 'm2', fromId: 't2', toParentId: 'p4', studentId: 's6', content: 'هند تحتاج لمزيد من التدريب على القراءة في المنزل.', date: '2025-12-18', read: true },
  { id: 'm3', fromId: 't1', toParentId: 'p2', studentId: 's3', content: 'يوسف حصل على أعلى درجة في اختبار الرياضيات. أحسنتم!', date: '2025-12-22', read: false },
];
