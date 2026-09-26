import { useState, useMemo, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useBranding } from '@/hooks/queries/useBranding';
import {
  Printer,
  FileText,
  School,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  Award,
  BookOpen,
  DollarSign,
  User,
} from 'lucide-react';
import {
  extractAvailableReportMonths,
  filterAttendanceByMonth,
  filterGradesByMonth,
  filterCurriculumByMonth,
  calculateReportStats,
  getGradeRowDetails,
} from '@/utils/studentReportCalculations';

interface StudentReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentData: any;
}

export function StudentReportModal({
  isOpen,
  onClose,
  studentData,
}: StudentReportModalProps) {
  const { data: branding } = useBranding();
  const reportRef = useRef<HTMLDivElement>(null);

  // Settings State
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [showInfo, setShowInfo] = useState<boolean>(true);
  const [showAttendance, setShowAttendance] = useState<boolean>(true);
  const [showGrades, setShowGrades] = useState<boolean>(true);
  const [showFees, setShowFees] = useState<boolean>(true);
  const [showCurriculum, setShowCurriculum] = useState<boolean>(true);
  const [showNotes, setShowNotes] = useState<boolean>(true);
  const [showSignatures, setShowSignatures] = useState<boolean>(true);

  // Parse records
  const student = studentData || {};
  const grades = useMemo(() => (studentData?.grades || []) as any[], [studentData]);
  const attendance = useMemo(() => (studentData?.attendance || []) as any[], [studentData]);
  const curriculum = useMemo(() => (studentData?.curriculum || []) as any[], [studentData]);
  const fees = useMemo(() => (studentData?.fees || []) as any[], [studentData]);
  const payments = useMemo(() => (studentData?.payments || []) as any[], [studentData]);

  // Extract all available months from data via pure helper
  const availableMonths = useMemo(() => {
    return extractAvailableReportMonths(attendance, grades, curriculum);
  }, [attendance, grades, curriculum]);

  // Filter Data by selected month via pure helpers
  const filteredAttendance = useMemo(() => {
    return filterAttendanceByMonth(attendance, selectedMonth);
  }, [attendance, selectedMonth]);

  const filteredGrades = useMemo(() => {
    return filterGradesByMonth(grades, selectedMonth);
  }, [grades, selectedMonth]);

  const filteredCurriculum = useMemo(() => {
    return filterCurriculumByMonth(curriculum, selectedMonth);
  }, [curriculum, selectedMonth]);

  // Aggregate Counts & Totals via pure calculation function
  const stats = useMemo(() => {
    return calculateReportStats({
      attendance: filteredAttendance,
      grades: filteredGrades,
      fees,
      payments,
      monthlyFee: student?.monthly_fee,
    });
  }, [filteredAttendance, filteredGrades, fees, payments, student]);

  // Robust, 100% Reliable Print Function via Isolated IFrame with ALL application styles
  const handlePrint = () => {
    const reportElement = document.getElementById('student-official-report');
    if (!reportElement) return;

    // Grab all current stylesheets and style tags from the document head (Tailwind, Fonts, Icons, etc.)
    const headStyles = Array.from(document.head.querySelectorAll('style, link[rel="stylesheet"]'))
      .map((el) => el.outerHTML)
      .join('\n');

    // Create an isolated hidden iframe
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) return;

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <title>تقرير الطالب - ${student?.name || 'سجل شامل'}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
        ${headStyles}
        <style>
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
            box-sizing: border-box;
          }
          @page {
            size: A4 portrait;
            margin: 8mm 10mm 8mm 10mm;
          }
          html, body {
            background-color: #ffffff !important;
            color: #0f172a !important;
            direction: rtl;
            margin: 0;
            padding: 0;
            font-family: 'Cairo', system-ui, -apple-system, sans-serif !important;
          }
          .report-print-container {
            width: 100%;
            max-width: 100%;
            margin: 0 auto;
            padding: 4mm;
            background: #ffffff !important;
          }
          .page-break-inside-avoid {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          svg {
            display: inline-block;
            vertical-align: middle;
          }
        </style>
      </head>
      <body>
        <div class="report-print-container">
          <div class="w-full bg-white text-slate-900 rounded-[16px] p-6 space-y-6 text-right border border-slate-300">
            ${reportElement.innerHTML}
          </div>
        </div>
      </body>
      </html>
    `);
    doc.close();

    // Trigger printing once styles and content are loaded
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.error('Print trigger error:', err);
      } finally {
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 1500);
      }
    }, 400);
  };

  const todayArabic = new Date().toLocaleDateString('ar-EG', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl p-0 overflow-hidden bg-slate-900 text-slate-100 border-slate-800 max-h-[94vh] flex flex-col rounded-[28px] shadow-2xl" dir="rtl">
        
        {/* Modal Top Header (Interactive toolbar) */}
        <div className="bg-slate-900 border-b border-slate-800/80 px-6 py-4 flex flex-wrap items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <DialogTitle className="text-base md:text-lg font-black text-white flex items-center gap-2.5">
                تقرير السجل الشامل للطالب
                <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded-lg">
                  جاهز للطباعة والتصدير
                </span>
              </DialogTitle>
              <p className="text-xs text-slate-400 font-medium">
                تخصيص بنود التقرير والطباعة المباشرة بأعلى دقة رسمية
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={handlePrint}
              className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black px-5 rounded-xl shadow-lg shadow-emerald-950/40 gap-2 text-xs h-10 transition-all active:scale-95"
            >
              <Printer className="w-4 h-4" />
              طباعة التقرير (Print / PDF)
            </Button>
            <Button
              variant="outline"
              onClick={onClose}
              className="bg-white/5 border-white/10 hover:bg-white/10 text-white font-bold rounded-xl text-xs h-10"
            >
              إغلاق
            </Button>
          </div>
        </div>

        {/* Settings Bar (Controls) */}
        <div className="bg-slate-950 border-b border-slate-800/80 px-6 py-3.5 overflow-x-auto shrink-0 hide-scrollbar">
          <div className="flex flex-wrap items-center gap-3 md:gap-4 text-xs">
            
            {/* Month Filter */}
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-700/80 px-3 py-1.5 rounded-xl">
              <Calendar className="w-4 h-4 text-indigo-400 shrink-0" />
              <span className="text-slate-400 font-bold whitespace-nowrap">الفترة:</span>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent text-white font-bold outline-none cursor-pointer text-xs pr-1"
              >
                <option value="all" className="bg-slate-900 text-white">كل الشهور (السجل الكامل)</option>
                {availableMonths.map((m) => (
                  <option key={m.key} value={m.key} className="bg-slate-900 text-white">
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="h-5 w-px bg-slate-800 hidden sm:block" />

            {/* Toggle Switches */}
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 cursor-pointer bg-slate-900/60 hover:bg-slate-900 border border-slate-800 px-2.5 py-1.5 rounded-xl transition-all">
                <Switch checked={showInfo} onCheckedChange={setShowInfo} className="scale-75 data-[state=checked]:bg-indigo-600" />
                <span className="font-bold text-slate-300 text-[11px]">البيانات الأساسية</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer bg-slate-900/60 hover:bg-slate-900 border border-slate-800 px-2.5 py-1.5 rounded-xl transition-all">
                <Switch checked={showAttendance} onCheckedChange={setShowAttendance} className="scale-75 data-[state=checked]:bg-indigo-600" />
                <span className="font-bold text-slate-300 text-[11px]">سجل الحضور</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer bg-slate-900/60 hover:bg-slate-900 border border-slate-800 px-2.5 py-1.5 rounded-xl transition-all">
                <Switch checked={showGrades} onCheckedChange={setShowGrades} className="scale-75 data-[state=checked]:bg-indigo-600" />
                <span className="font-bold text-slate-300 text-[11px]">كشف الدرجات</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer bg-slate-900/60 hover:bg-slate-900 border border-slate-800 px-2.5 py-1.5 rounded-xl transition-all">
                <Switch checked={showFees} onCheckedChange={setShowFees} className="scale-75 data-[state=checked]:bg-indigo-600" />
                <span className="font-bold text-slate-300 text-[11px]">السجل المالي</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer bg-slate-900/60 hover:bg-slate-900 border border-slate-800 px-2.5 py-1.5 rounded-xl transition-all">
                <Switch checked={showCurriculum} onCheckedChange={setShowCurriculum} className="scale-75 data-[state=checked]:bg-indigo-600" />
                <span className="font-bold text-slate-300 text-[11px]">المنهج الدراسي</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer bg-slate-900/60 hover:bg-slate-900 border border-slate-800 px-2.5 py-1.5 rounded-xl transition-all">
                <Switch checked={showSignatures} onCheckedChange={setShowSignatures} className="scale-75 data-[state=checked]:bg-indigo-600" />
                <span className="font-bold text-slate-300 text-[11px]">الاعتماد والختم</span>
              </label>
            </div>
          </div>
        </div>

        {/* Paper Sheet Preview Area */}
        <div className="overflow-y-auto flex-1 p-3 md:p-8 bg-slate-950/90 flex justify-center custom-scrollbar">
          
          <div
            ref={reportRef}
            id="student-official-report"
            className="w-full max-w-[820px] bg-white text-slate-900 rounded-[16px] p-6 md:p-8 shadow-2xl space-y-6 text-right border border-slate-200"
            style={{ fontFamily: "'Cairo', sans-serif" }}
          >
            {/* ── Official Institutional Header ── */}
            <div className="border-b-2 border-slate-900 pb-5">
              <div className="flex items-start justify-between gap-4">
                {/* School Name & Logo */}
                <div className="flex items-center gap-3.5">
                  {branding?.logo_url ? (
                    <img
                      src={branding.logo_url}
                      alt={branding.name}
                      className="w-16 h-16 object-contain rounded-xl border border-slate-200 p-1"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black">
                      <School className="w-8 h-8" />
                    </div>
                  )}
                  <div>
                    <h2 className="text-lg md:text-xl font-black text-slate-900 leading-tight">
                      {branding?.name || 'إدارة شؤون الطلاب والتعليم'}
                    </h2>
                    <p className="text-[11px] font-bold text-slate-500 mt-1">
                      نظام إدارة ومتابعة الأداء الطلابي الشامل
                    </p>
                  </div>
                </div>

                {/* Report Meta / Stamp Box */}
                <div className="text-left space-y-1">
                  <div className="inline-block bg-slate-900 text-white font-black text-xs px-3 py-1 rounded-lg">
                    تقرير السجل الشامل للطالب
                  </div>
                  <p className="text-[11px] font-bold text-slate-600">
                    تاريخ الاستخراج: {todayArabic}
                  </p>
                  <p className="text-[11px] font-bold text-slate-600">
                    العام الدراسي: {student?.academic_year || '2025 / 2026'}
                  </p>
                </div>
              </div>
            </div>

            {/* ── Student Information Table ── */}
            {showInfo && (
              <div className="rounded-xl border border-slate-300 overflow-hidden">
                <div className="bg-slate-100 px-4 py-2 border-b border-slate-300 flex items-center justify-between">
                  <span className="font-black text-xs text-slate-800 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-indigo-700" />
                    بيانات الطالب الأساسية
                  </span>
                  <span className="text-[10px] font-bold text-slate-500">
                    كود الطالب: {student?.id?.split('-')[0]?.toUpperCase() || '---'}
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y divide-x-reverse divide-slate-200 text-xs bg-white">
                  <div className="p-3">
                    <span className="text-[10px] font-bold text-slate-400 block mb-0.5">اسم الطالب</span>
                    <strong className="text-sm font-black text-slate-900">{student?.name || '---'}</strong>
                  </div>
                  <div className="p-3">
                    <span className="text-[10px] font-bold text-slate-400 block mb-0.5">الصف / الفصل</span>
                    <strong className="text-xs font-black text-indigo-700">{student?.classes?.name || student?.className || 'غير مسجل'}</strong>
                  </div>
                  <div className="p-3">
                    <span className="text-[10px] font-bold text-slate-400 block mb-0.5">معلم الفصل المشرف</span>
                    <strong className="text-xs font-bold text-slate-800">{student?.classes?.teacher?.full_name || '---'}</strong>
                  </div>
                  <div className="p-3">
                    <span className="text-[10px] font-bold text-slate-400 block mb-0.5">هاتف ولي الأمر</span>
                    <strong className="text-xs font-bold text-slate-800" dir="ltr">{student?.parent_phone || '---'}</strong>
                  </div>
                  {student?.address && (
                    <div className="p-3 col-span-2">
                      <span className="text-[10px] font-bold text-slate-400 block mb-0.5">العنوان السكني</span>
                      <strong className="text-xs font-medium text-slate-700">{student.address}</strong>
                    </div>
                  )}
                  {student?.birth_date && (
                    <div className="p-3 col-span-2">
                      <span className="text-[10px] font-bold text-slate-400 block mb-0.5">تاريخ الميلاد</span>
                      <strong className="text-xs font-medium text-slate-700">{new Date(student.birth_date).toLocaleDateString('ar-EG')}</strong>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── 1. Attendance Section (Pure Total Counts) ── */}
            {showAttendance && (
              <div className="space-y-2.5 page-break-inside-avoid">
                <div className="flex items-center justify-between border-b border-slate-300 pb-1.5">
                  <h3 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-emerald-700" />
                    سجل الحضور والانضباط المدرسي
                  </h3>
                  <span className="text-[11px] font-bold text-slate-600">
                    إجمالي الأيام المسجلة: <strong className="text-slate-900 font-black">{stats.totalAttendanceDays} يوم</strong>
                  </span>
                </div>

                {/* Stat Boxes with Total Counts */}
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="border border-emerald-300 bg-emerald-50/70 p-2.5 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-black text-emerald-800 block">إجمالي أيام الحضور</span>
                      <strong className="text-lg font-black text-emerald-950">{stats.presentCount} <span className="text-xs font-bold">يوم</span></strong>
                    </div>
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  </div>

                  <div className="border border-rose-300 bg-rose-50/70 p-2.5 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-black text-rose-800 block">إجمالي أيام الغياب</span>
                      <strong className="text-lg font-black text-rose-950">{stats.absentCount} <span className="text-xs font-bold">يوم</span></strong>
                    </div>
                    <XCircle className="w-5 h-5 text-rose-600" />
                  </div>

                  <div className="border border-amber-300 bg-amber-50/70 p-2.5 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-black text-amber-800 block">إجمالي أيام التأخير</span>
                      <strong className="text-lg font-black text-amber-950">{stats.lateCount} <span className="text-xs font-bold">يوم</span></strong>
                    </div>
                    <Clock className="w-5 h-5 text-amber-600" />
                  </div>
                </div>
              </div>
            )}

            {/* ── 2. Grades & Performance Section (Pure Total Counts) ── */}
            {showGrades && (
              <div className="space-y-2.5 page-break-inside-avoid">
                <div className="flex items-center justify-between border-b border-slate-300 pb-1.5">
                  <h3 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5 text-amber-700" />
                    كشف النتائج والتقييمات الأكاديمية
                  </h3>
                  {stats.numericSubjectsCount > 0 ? (
                    <span className="text-[11px] font-bold text-slate-700">
                      المجموع الكلي: <strong className="text-indigo-900 font-black text-sm">{stats.totalScoreObtained}</strong> من أصل <strong className="text-slate-900">{stats.totalMaxScorePossible} درجة</strong>
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold text-slate-600">
                      إجمالي التقييمات: <strong className="text-slate-900">{stats.textSubjectsCount} مواد</strong> (تقييم وصفي)
                    </span>
                  )}
                </div>

                {filteredGrades.length === 0 ? (
                  <p className="text-xs text-slate-400 p-3 bg-slate-50 rounded-xl text-center border border-slate-200">
                    لا توجد تقييمات أو درجات مسجلة في هذا النطاق.
                  </p>
                ) : (
                  <div className="border border-slate-300 rounded-xl overflow-hidden text-xs">
                    <table className="w-full text-right border-collapse">
                      <thead className="bg-slate-100 text-slate-800 font-black border-b border-slate-300 text-[11px]">
                        <tr>
                          <th className="p-2">#</th>
                          <th className="p-2">المادة الدراسية</th>
                          <th className="p-2">نوع التقييم / الشهر</th>
                          <th className="p-2 text-center">الدرجة / التقييم</th>
                          <th className="p-2 text-center">الدرجة العظمى</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-[11px]">
                        {filteredGrades.map((g, idx) => {
                          const { subjectName, examTitle, isTextGrade, maxScore } = getGradeRowDetails(g);
                          return (
                            <tr key={g.id || idx}>
                              <td className="p-2 text-slate-400 font-bold">{idx + 1}</td>
                              <td className="p-2 font-black text-slate-900">{subjectName}</td>
                              <td className="p-2 text-slate-600 font-medium">{examTitle}</td>
                              <td className="p-2 text-center font-black text-slate-900 bg-slate-50/50">
                                {isTextGrade ? (
                                  <span className="inline-block px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-900 font-black text-[11px] border border-indigo-200">
                                    {g.score || 'تم التقييم'}
                                  </span>
                                ) : (
                                  <span className="font-black text-slate-900 text-xs">{g.score}</span>
                                )}
                              </td>
                              <td className="p-2 text-center text-slate-500 font-bold">
                                {maxScore}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="bg-slate-100 border-t-2 border-slate-400 font-black text-slate-900 text-xs">
                        {stats.numericSubjectsCount > 0 ? (
                          <tr>
                            <td colSpan={3} className="p-2.5">
                              المجموع الإجمالي ({stats.numericSubjectsCount} مادة رقمية)
                              {stats.textSubjectsCount > 0 && (
                                <span className="text-slate-500 font-normal text-[10px] mr-1.5">
                                  + ({stats.textSubjectsCount} تقييم وصفي)
                                </span>
                              )}
                            </td>
                            <td className="p-2.5 text-center text-sm font-black text-indigo-900 bg-indigo-50 border-x border-indigo-200">
                              {stats.totalScoreObtained}
                            </td>
                            <td className="p-2.5 text-center text-sm font-black text-slate-800">
                              {stats.totalMaxScorePossible}
                            </td>
                          </tr>
                        ) : (
                          <tr>
                            <td colSpan={5} className="p-2.5 text-center text-slate-600">
                              إجمالي المواد المقيّمة وصفياً: {stats.textSubjectsCount} مواد
                            </td>
                          </tr>
                        )}
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ── 3. Financial Statement Section (Pure Amounts) ── */}
            {showFees && (
              <div className="space-y-2.5 page-break-inside-avoid">
                <div className="flex items-center justify-between border-b border-slate-300 pb-1.5">
                  <h3 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-indigo-700" />
                    الموقف المالي والمصروفات الدراسية
                  </h3>
                </div>

                <div className="grid grid-cols-3 gap-2.5 text-xs">
                  <div className="border border-slate-300 bg-slate-50 p-2.5 rounded-xl">
                    <span className="text-[10px] font-black text-slate-500 block mb-0.5">إجمالي الرسوم المقررة</span>
                    <strong className="text-base font-black text-slate-900">{stats.totalFeeAmount.toLocaleString()} ج.م</strong>
                  </div>

                  <div className="border border-emerald-300 bg-emerald-50/70 p-2.5 rounded-xl">
                    <span className="text-[10px] font-black text-emerald-800 block mb-0.5">إجمالي المبلغ المسدد</span>
                    <strong className="text-base font-black text-emerald-950">{stats.totalPaidAmount.toLocaleString()} ج.م</strong>
                  </div>

                  <div className="border border-rose-300 bg-rose-50/70 p-2.5 rounded-xl">
                    <span className="text-[10px] font-black text-rose-800 block mb-0.5">إجمالي المبلغ المتبقي</span>
                    <strong className="text-base font-black text-rose-950">{stats.totalRemainingAmount.toLocaleString()} ج.م</strong>
                  </div>
                </div>
              </div>
            )}

            {/* ── 4. Curriculum / Syllabus Plan ── */}
            {showCurriculum && filteredCurriculum.length > 0 && (
              <div className="space-y-2.5 page-break-inside-avoid">
                <div className="flex items-center justify-between border-b border-slate-300 pb-1.5">
                  <h3 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-purple-700" />
                    المقررات والخطة المنجزة ({filteredCurriculum.length} مقررات)
                  </h3>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  {filteredCurriculum.map((c) => (
                    <div key={c.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg space-y-0.5">
                      <strong className="font-black text-slate-900 block text-xs">{c.subject_name}</strong>
                      <p className="text-slate-600 font-medium text-[11px] leading-relaxed line-clamp-2">
                        {c.content || 'تم استكمال الخطة المقررة.'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── 5. General Remarks / Notes ── */}
            {showNotes && student?.notes && (
              <div className="border border-amber-300 bg-amber-50/60 p-3 rounded-xl text-xs space-y-0.5 page-break-inside-avoid">
                <strong className="text-amber-950 font-black block">ملاحظات المدرسة والإدارة:</strong>
                <p className="text-slate-700 font-medium leading-relaxed">{student.notes}</p>
              </div>
            )}

            {/* ── 6. Official Signatures & School Stamp ── */}
            {showSignatures && (
              <div className="pt-6 border-t-2 border-slate-900 grid grid-cols-3 gap-4 text-center text-xs page-break-inside-avoid">
                <div className="space-y-6">
                  <span className="font-black text-slate-800 block">رائد / معلم الفصل</span>
                  <div className="border-b border-dashed border-slate-400 w-28 mx-auto" />
                </div>

                <div className="space-y-6">
                  <span className="font-black text-slate-800 block">شؤون الطلاب والتسجيل</span>
                  <div className="border-b border-dashed border-slate-400 w-28 mx-auto" />
                </div>

                <div className="space-y-4">
                  <span className="font-black text-slate-800 block">اعتماد مدير المدرسة</span>
                  <div className="w-16 h-16 border-2 border-dashed border-slate-400 rounded-full mx-auto flex items-center justify-center text-[9px] font-black text-slate-400">
                    ختم المدرسة
                  </div>
                </div>
              </div>
            )}

          </div>

        </div>

      </DialogContent>
    </Dialog>
  );
}
