import { User, Student, Teacher, Parent, SchoolClass, Attendance, Grade, Message } from './types';
import { seedUsers, seedTeachers, seedParents, seedClasses, seedStudents, seedAttendance, seedGrades, seedMessages } from './seed';

const STORAGE_KEY = 'school_management_db';

interface Database {
  users: User[];
  students: Student[];
  teachers: Teacher[];
  parents: Parent[];
  classes: SchoolClass[];
  attendance: Attendance[];
  grades: Grade[];
  messages: Message[];
}

function loadDB(): Database {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) return JSON.parse(raw);
  const db: Database = {
    users: seedUsers,
    students: seedStudents,
    teachers: seedTeachers,
    parents: seedParents,
    classes: seedClasses,
    attendance: seedAttendance,
    grades: seedGrades,
    messages: seedMessages,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  return db;
}

function saveDB(db: Database) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

// Generic CRUD
function getAll<K extends keyof Database>(key: K): Database[K] {
  return loadDB()[key];
}

function getById<K extends keyof Database>(key: K, id: string): Database[K][number] | undefined {
  return (loadDB()[key] as any[]).find((item: any) => item.id === id);
}

function add<K extends keyof Database>(key: K, item: Database[K][number]): void {
  const db = loadDB();
  (db[key] as any[]).push(item);
  saveDB(db);
}

function update<K extends keyof Database>(key: K, id: string, updates: Partial<Database[K][number]>): void {
  const db = loadDB();
  const arr = db[key] as any[];
  const idx = arr.findIndex((item: any) => item.id === id);
  if (idx !== -1) {
    arr[idx] = { ...arr[idx], ...updates };
    saveDB(db);
  }
}

function remove<K extends keyof Database>(key: K, id: string): void {
  const db = loadDB();
  (db[key] as any[]) = (db[key] as any[]).filter((item: any) => item.id !== id);
  saveDB(db);
}

// Auth
export function authenticate(username: string, password: string): User | null {
  const users = getAll('users');
  return (users as User[]).find(u => u.username === username && u.password === password) || null;
}

// Students
export const getStudents = () => getAll('students') as Student[];
export const getStudent = (id: string) => getById('students', id) as Student | undefined;
export const addStudent = (s: Student) => add('students', s);
export const updateStudent = (id: string, u: Partial<Student>) => update('students', id, u);
export const deleteStudent = (id: string) => remove('students', id);

// Teachers
export const getTeachers = () => getAll('teachers') as Teacher[];
export const getTeacher = (id: string) => getById('teachers', id) as Teacher | undefined;
export const addTeacher = (t: Teacher) => add('teachers', t);
export const updateTeacher = (id: string, u: Partial<Teacher>) => update('teachers', id, u);
export const deleteTeacher = (id: string) => remove('teachers', id);

// Parents
export const getParents = () => getAll('parents') as Parent[];
export const getParent = (id: string) => getById('parents', id) as Parent | undefined;
export const addParent = (p: Parent) => add('parents', p);
export const updateParent = (id: string, u: Partial<Parent>) => update('parents', id, u);
export const deleteParent = (id: string) => remove('parents', id);

// Classes
export const getClasses = () => getAll('classes') as SchoolClass[];
export const getClass = (id: string) => getById('classes', id) as SchoolClass | undefined;
export const addClass = (c: SchoolClass) => add('classes', c);
export const updateClass = (id: string, u: Partial<SchoolClass>) => update('classes', id, u);
export const deleteClass = (id: string) => remove('classes', id);

// Attendance
export const getAttendance = () => getAll('attendance') as Attendance[];
export const addAttendance = (a: Attendance) => add('attendance', a);
export const updateAttendance = (id: string, u: Partial<Attendance>) => update('attendance', id, u);
export const getStudentAttendance = (studentId: string) =>
  (getAll('attendance') as Attendance[]).filter(a => a.studentId === studentId);

// Grades
export const getGrades = () => getAll('grades') as Grade[];
export const addGrade = (g: Grade) => add('grades', g);
export const getStudentGrades = (studentId: string) =>
  (getAll('grades') as Grade[]).filter(g => g.studentId === studentId);

// Messages
export const getMessages = () => getAll('messages') as Message[];
export const addMessage = (m: Message) => add('messages', m);
export const getParentMessages = (parentId: string) =>
  (getAll('messages') as Message[]).filter(m => m.toParentId === parentId);

// Reset
export function resetDatabase() {
  localStorage.removeItem(STORAGE_KEY);
  loadDB();
}

// Stats
export function getStats() {
  const db = loadDB();
  return {
    totalStudents: db.students.length,
    totalTeachers: db.teachers.length,
    totalParents: db.parents.length,
    totalClasses: db.classes.length,
  };
}
