export type TableName = 'students' | 'classes' | 'grades' | 'attendance' | 'student_parents' | 'exam_templates';

export interface TableConfig {
  name: TableName;
  label: string;
  columns: { key: string; label: string; editable: boolean }[];
}

export const TABLES: TableConfig[] = [
  {
    name: 'students',
    label: 'الطلاب',
    columns: [
      { key: 'id', label: 'المعرف', editable: false },
      { key: 'name', label: 'الاسم', editable: true },
      { key: 'class_id', label: 'معرف الفصل', editable: true },
      { key: 'birth_date', label: 'تاريخ الميلاد', editable: true },
      { key: 'notes', label: 'ملاحظات', editable: true },
      { key: 'created_at', label: 'تاريخ الإنشاء', editable: false },
    ],
  },
  {
    name: 'classes',
    label: 'الفصول',
    columns: [
      { key: 'id', label: 'المعرف', editable: false },
      { key: 'name', label: 'اسم الفصل', editable: true },
      { key: 'grade_level', label: 'المرحلة', editable: true },
      { key: 'teacher_id', label: 'معرف المعلم', editable: true },
      { key: 'created_at', label: 'تاريخ الإنشاء', editable: false },
    ],
  },
  {
    name: 'grades',
    label: 'الدرجات',
    columns: [
      { key: 'id', label: 'المعرف', editable: false },
      { key: 'student_id', label: 'معرف الطالب', editable: true },
      { key: 'subject', label: 'المادة', editable: true },
      { key: 'score', label: 'الدرجة', editable: true },
      { key: 'max_score', label: 'الدرجة القصوى', editable: true },
      { key: 'term', label: 'الفصل الدراسي', editable: true },
      { key: 'date', label: 'التاريخ', editable: true },
    ],
  },
  {
    name: 'attendance',
    label: 'الحضور',
    columns: [
      { key: 'id', label: 'المعرف', editable: false },
      { key: 'student_id', label: 'معرف الطالب', editable: true },
      { key: 'date', label: 'التاريخ', editable: true },
      { key: 'status', label: 'الحالة', editable: true },
      { key: 'created_at', label: 'تاريخ الإنشاء', editable: false },
    ],
  },
  {
    name: 'student_parents',
    label: 'ربط الطلاب بأولياء الأمور',
    columns: [
      { key: 'id', label: 'المعرف', editable: false },
      { key: 'student_id', label: 'معرف الطالب', editable: true },
      { key: 'parent_id', label: 'معرف ولي الأمر', editable: true },
      { key: 'created_at', label: 'تاريخ الإنشاء', editable: false },
    ],
  },
  {
    name: 'exam_templates',
    label: 'قوالب الامتحانات',
    columns: [
      { key: 'id', label: 'المعرف', editable: false },
      { key: 'title', label: 'العنوان', editable: true },
      { key: 'subject', label: 'المادة', editable: true },
      { key: 'class_id', label: 'معرف الفصل', editable: true },
      { key: 'teacher_id', label: 'معرف المعلم', editable: true },
      { key: 'max_score', label: 'الدرجة القصوى', editable: true },
      { key: 'exam_type', label: 'نوع الامتحان', editable: true },
      { key: 'term', label: 'الفصل', editable: true },
    ],
  },
];
