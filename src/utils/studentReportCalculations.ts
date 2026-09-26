/**
 * Pure calculation and data-aggregation functions for Student Report Cards.
 * Zero JSX, zero DOM, zero side-effects.
 */

export interface ReportAttendanceStats {
  presentCount: number;
  absentCount: number;
  lateCount: number;
  totalAttendanceDays: number;
}

export interface ReportGradesStats {
  totalScoreObtained: number;
  totalMaxScorePossible: number;
  numericSubjectsCount: number;
  textSubjectsCount: number;
}

export interface ReportFinancialStats {
  totalFeeAmount: number;
  totalPaidAmount: number;
  totalRemainingAmount: number;
}

export interface ReportStats extends ReportAttendanceStats, ReportGradesStats, ReportFinancialStats {}

export interface MonthOption {
  key: string;
  label: string;
}

/**
 * Extracts all unique available months/terms from attendance, grades, and curriculum records.
 */
export function extractAvailableReportMonths(
  attendance: any[] = [],
  grades: any[] = [],
  curriculum: any[] = []
): MonthOption[] {
  const monthsMap = new Map<string, string>(); // key -> label

  attendance.forEach((rec) => {
    if (rec.date) {
      const d = new Date(rec.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });
      monthsMap.set(key, label);
    }
  });

  grades.forEach((g) => {
    const termOrDate = g.exam_templates?.term || g.term || g.created_at;
    if (termOrDate && !monthsMap.has(termOrDate)) {
      monthsMap.set(termOrDate, termOrDate);
    }
  });

  curriculum.forEach((c) => {
    if (c.term && !monthsMap.has(c.term)) {
      monthsMap.set(c.term, c.term);
    }
  });

  return Array.from(monthsMap.entries()).map(([key, label]) => ({ key, label }));
}

/**
 * Filters attendance records by selected month key.
 */
export function filterAttendanceByMonth(attendance: any[] = [], selectedMonth = 'all'): any[] {
  if (selectedMonth === 'all') return attendance;
  return attendance.filter((rec) => {
    if (!rec.date) return false;
    const d = new Date(rec.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return key === selectedMonth || d.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' }) === selectedMonth;
  });
}

/**
 * Filters grades records by selected month/term key.
 */
export function filterGradesByMonth(grades: any[] = [], selectedMonth = 'all'): any[] {
  if (selectedMonth === 'all') return grades;
  return grades.filter((g) => {
    const term = g.exam_templates?.term || g.term || '';
    const cardTitle = g.exam_templates?.title || g.title || '';
    return term === selectedMonth || cardTitle.includes(selectedMonth);
  });
}

/**
 * Filters curriculum records by selected term.
 */
export function filterCurriculumByMonth(curriculum: any[] = [], selectedMonth = 'all'): any[] {
  if (selectedMonth === 'all') return curriculum;
  return curriculum.filter((c) => c.term === selectedMonth);
}

/**
 * Calculates aggregate counts and sums for attendance, grades, and financial records.
 * Preserves exact calculation formulas.
 */
export function calculateReportStats(params: {
  attendance?: any[];
  grades?: any[];
  fees?: any[];
  payments?: any[];
  monthlyFee?: number | string | null;
}): ReportStats {
  const { attendance = [], grades = [], fees = [], payments = [], monthlyFee } = params;

  // 1. Attendance counts
  let presentCount = 0;
  let absentCount = 0;
  let lateCount = 0;

  attendance.forEach((rec) => {
    if (rec.status === 'present') presentCount++;
    else if (rec.status === 'absent') absentCount++;
    else if (rec.status === 'late') lateCount++;
  });

  const totalAttendanceDays = presentCount + absentCount + lateCount;

  // 2. Grades sums (Distinguishing numeric vs text assessments)
  let totalScoreObtained = 0;
  let totalMaxScorePossible = 0;
  let numericSubjectsCount = 0;
  let textSubjectsCount = 0;

  grades.forEach((g) => {
    const isText = g.exam_templates?.score_type === 'text' || isNaN(Number(g.score));
    if (isText) {
      textSubjectsCount++;
    } else {
      const scoreNum = Number(g.score);
      const maxScoreNum = Number(g.exam_templates?.max_score ?? g.max_score ?? 100);
      totalScoreObtained += scoreNum;
      totalMaxScorePossible += maxScoreNum;
      numericSubjectsCount++;
    }
  });

  // 3. Financial totals
  let totalFeeAmount = 0;
  let totalPaidAmount = 0;

  fees.forEach((f) => {
    totalFeeAmount += Number(f.amount || 0);
  });
  if (totalFeeAmount === 0 && monthlyFee) {
    totalFeeAmount = Number(monthlyFee);
  }

  payments.forEach((p) => {
    totalPaidAmount += Number(p.amount || 0);
  });
  const totalRemainingAmount = Math.max(0, totalFeeAmount - totalPaidAmount);

  return {
    presentCount,
    absentCount,
    lateCount,
    totalAttendanceDays,
    totalScoreObtained,
    totalMaxScorePossible,
    numericSubjectsCount,
    textSubjectsCount,
    totalFeeAmount,
    totalPaidAmount,
    totalRemainingAmount,
  };
}

/**
 * Extracts and formats individual grade row details.
 */
export function getGradeRowDetails(grade: any) {
  const subjectName = grade.exam_templates?.subject || grade.subject || 'مادة دراسية';
  const examTitle = grade.exam_templates?.title || grade.title || 'تقييم شهري';
  const isTextGrade = grade.exam_templates?.score_type === 'text' || isNaN(Number(grade.score));
  const maxScore = isTextGrade ? '---' : (grade.exam_templates?.max_score ?? grade.max_score ?? '---');

  return {
    subjectName,
    examTitle,
    isTextGrade,
    maxScore,
  };
}
