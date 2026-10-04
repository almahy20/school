import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useBranding } from '@/hooks/queries/useBranding';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import {
  Printer,
  FileSpreadsheet,
  School,
} from 'lucide-react';
import { QueryStateHandler } from '@/components/QueryStateHandler';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface SubjectTemplate {
  id: string;
  subject: string;
  score_type?: 'numeric' | 'text';
  max_score?: number;
}

interface CardGradesExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  classId: string;
  className: string;
  folderName: string;
  subjects: SubjectTemplate[];
}

export function CardGradesExportModal({
  isOpen,
  onClose,
  classId,
  className,
  folderName,
  subjects,
}: CardGradesExportModalProps) {
  const { user } = useAuth();
  const { data: branding } = useBranding();

  // Settings State - Default to A1 as requested
  const [pageSize, setPageSize] = useState<'a1' | 'a3' | 'a4'>('a1');
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const [showSchoolHeader, setShowSchoolHeader] = useState(true);
  const [showLogo, setShowLogo] = useState(true);
  const [showTotals, setShowTotals] = useState(true);
  const [showPercentage, setShowPercentage] = useState(true);
  const [showSignatures, setShowSignatures] = useState(true);

  // Fetch all students in this class with their grades
  const {
    data: rawStudentsData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['card-matrix-grades', classId, folderName, user?.schoolId],
    queryFn: async () => {
      if (!user?.schoolId || !classId) return [];
      const { data, error } = await supabase
        .from('students')
        .select(`
          id,
          name,
          grades!grades_student_id_fkey(
            id,
            score,
            exam_template_id,
            subject,
            term
          )
        `)
        .eq('school_id', user.schoolId)
        .eq('class_id', classId)
        .order('name');

      if (error) throw error;
      return data || [];
    },
    enabled: isOpen && !!(user?.schoolId && classId),
  });

  const students = useMemo(() => rawStudentsData || [], [rawStudentsData]);

  // Check if any subjects are numeric to calculate totals
  const hasNumericSubjects = useMemo(() => {
    return subjects.some(s => s.score_type !== 'text');
  }, [subjects]);

  const totalMaxScore = useMemo(() => {
    return subjects.reduce((acc, s) => {
      if (s.score_type !== 'text') {
        return acc + (Number(s.max_score) || 100);
      }
      return acc;
    }, 0);
  }, [subjects]);

  // Transform into full matrix data
  const matrixData = useMemo(() => {
    return students.map(student => {
      const studentGradesList = Array.isArray(student.grades) ? student.grades : [];

      let totalNumericScore = 0;
      let hasAnyNumericGrade = false;

      const subjectScores = subjects.map(subj => {
        const gradeRecord = studentGradesList.find((g: any) =>
          g.exam_template_id === subj.id ||
          (!g.exam_template_id && g.subject === subj.subject && (g.term === folderName))
        );

        const rawScore = gradeRecord ? String(gradeRecord.score).trim() : '';

        if (subj.score_type !== 'text' && rawScore !== '') {
          const num = Number(rawScore);
          if (!isNaN(num)) {
            totalNumericScore += num;
            hasAnyNumericGrade = true;
          }
        }

        return {
          subjectId: subj.id,
          subjectName: subj.subject,
          scoreType: subj.score_type || 'text',
          maxScore: subj.max_score || 100,
          score: rawScore || '-',
        };
      });

      const percentage = hasNumericSubjects && totalMaxScore > 0 && hasAnyNumericGrade
        ? Math.round((totalNumericScore / totalMaxScore) * 100)
        : null;

      let generalEvaluation = '-';
      if (percentage !== null) {
        if (percentage >= 90) generalEvaluation = 'ممتاز';
        else if (percentage >= 80) generalEvaluation = 'جيد جداً';
        else if (percentage >= 70) generalEvaluation = 'جيد';
        else if (percentage >= 60) generalEvaluation = 'مقبول';
        else generalEvaluation = 'يحتاج لمتابعة';
      }

      return {
        id: student.id,
        name: student.name,
        subjectScores,
        totalNumericScore: hasAnyNumericGrade ? totalNumericScore : '-',
        percentage: percentage !== null ? `${percentage}%` : '-',
        generalEvaluation,
      };
    });
  }, [students, subjects, folderName, hasNumericSubjects, totalMaxScore]);

  // Export to Excel / CSV with UTF-8 BOM
  const handleExportExcel = () => {
    if (matrixData.length === 0) {
      toast.error('لا توجد بيانات لتصديرها');
      return;
    }

    const headers = [
      'م',
      'اسم الطالب',
      ...subjects.map(s => s.score_type === 'text' ? s.subject : `${s.subject} (${s.max_score || 100})`),
      ...(hasNumericSubjects && showTotals ? ['المجموع', 'الدرجة الكلية'] : []),
      ...(hasNumericSubjects && showPercentage ? ['النسبة المئوية', 'التقدير العام'] : []),
    ];

    const rows = matrixData.map((row, idx) => {
      const subjectVals = row.subjectScores.map(s => s.score);
      return [
        idx + 1,
        `"${row.name.replace(/"/g, '""')}"`,
        ...subjectVals.map(v => `"${v}"`),
        ...(hasNumericSubjects && showTotals ? [row.totalNumericScore, totalMaxScore] : []),
        ...(hasNumericSubjects && showPercentage ? [row.percentage, `"${row.generalEvaluation}"`] : []),
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `كشف_درجات_${folderName}_${className}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('تم تصدير ملف الإكسل بنجاح 📊');
  };

  // 100% Identical Wysiwyg Vector Print with Full Cairo Font and Multi-page Support
  const handlePrintPdf = () => {
    const reportElement = document.getElementById('card-grades-printable-doc');
    if (!reportElement) {
      toast.error('تعذر إيجاد مستند الطباعة');
      return;
    }

    // Grab all stylesheets and font links from main document
    const headStyles = Array.from(document.head.querySelectorAll('style, link[rel="stylesheet"]'))
      .map((el) => el.outerHTML)
      .join('\n');

    // Create an iframe with real viewport dimensions so the browser print engine computes multi-page pagination accurately
    const iframe = document.createElement('iframe');
    iframe.id = 'grades-print-frame';
    iframe.style.position = 'fixed';
    iframe.style.top = '0';
    iframe.style.left = '0';
    iframe.style.width = '100vw';
    iframe.style.height = '100vh';
    iframe.style.zIndex = '-999999';
    iframe.style.opacity = '0';
    iframe.style.border = 'none';
    iframe.style.pointerEvents = 'none';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) return;

    const paperSizeCss = `${pageSize.toUpperCase()} ${orientation}`;
    const pageMargin = pageSize === 'a1' ? '12mm 15mm' : pageSize === 'a3' ? '10mm 12mm' : '8mm 10mm';

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <title>كشف درجات - ${folderName} - ${className}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
        ${headStyles}
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&display=swap');
          
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
            box-sizing: border-box !important;
            font-family: 'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif !important;
          }
          
          @page {
            size: ${paperSizeCss};
            margin: ${pageMargin};
          }
          
          html, body, .print-wrapper, #card-grades-printable-doc {
            background-color: #ffffff !important;
            color: #0f172a !important;
            direction: rtl;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            min-height: auto !important;
            max-height: none !important;
            overflow: visible !important;
            overflow-x: visible !important;
            overflow-y: visible !important;
            position: static !important;
            font-family: 'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif !important;
            -webkit-font-smoothing: antialiased;
          }

          #card-grades-printable-doc {
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
          }

          /* Ensure table repeats header on new pages & cleanly breaks rows across pages */
          table {
            display: table !important;
            border-collapse: collapse !important;
            border-spacing: 0 !important;
            width: 100% !important;
            page-break-inside: auto !important;
            break-inside: auto !important;
            font-family: 'Cairo', sans-serif !important;
          }
          
          thead {
            display: table-header-group !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          
          tbody {
            display: table-row-group !important;
          }
          
          tr {
            display: table-row !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            page-break-after: auto !important;
            break-after: auto !important;
          }
          
          th, td {
            border: 1.5px solid #94a3b8 !important;
            padding: 6px 8px !important;
            text-align: center;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          th {
            background-color: #1e293b !important;
            color: #ffffff !important;
            font-weight: 800 !important;
          }

          .student-name-cell {
            text-align: right !important;
            font-weight: 800 !important;
            color: #0f172a !important;
            padding-right: 12px !important;
          }

          .bg-zebra {
            background-color: #f8fafc !important;
          }

          .total-header {
            background-color: #312e81 !important;
            color: #ffffff !important;
          }

          .total-cell {
            background-color: #eef2ff !important;
            color: #1e1b4b !important;
            font-weight: 900 !important;
          }

          .pct-cell {
            color: #4338ca !important;
            font-weight: 900 !important;
          }

          .badge-excellent {
            background-color: #d1fae5 !important;
            color: #065f46 !important;
            font-weight: 800 !important;
            padding: 2px 8px !important;
            border-radius: 6px !important;
            display: inline-block;
          }

          .badge-very-good {
            background-color: #dbeafe !important;
            color: #1e40af !important;
            font-weight: 800 !important;
            padding: 2px 8px !important;
            border-radius: 6px !important;
            display: inline-block;
          }

          .badge-good {
            background-color: #fef3c7 !important;
            color: #92400e !important;
            font-weight: 800 !important;
            padding: 2px 8px !important;
            border-radius: 6px !important;
            display: inline-block;
          }

          .badge-pass {
            background-color: #ecfdf5 !important;
            color: #047857 !important;
            font-weight: 800 !important;
            padding: 2px 8px !important;
            border-radius: 6px !important;
            display: inline-block;
          }

          .badge-fail {
            background-color: #ffe4e6 !important;
            color: #be123c !important;
            font-weight: 800 !important;
            padding: 2px 8px !important;
            border-radius: 6px !important;
            display: inline-block;
          }

          .signatures-block {
            margin-top: 24px !important;
            padding-top: 16px !important;
            border-top: 2px solid #cbd5e1 !important;
            display: flex !important;
            justify-content: space-around !important;
            text-align: center !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          
          .sig-col {
            width: 30%;
            text-align: center;
          }

          .sig-line {
            margin-top: 40px;
            border-bottom: 1.5px dashed #94a3b8;
            width: 80%;
            margin-left: auto;
            margin-right: auto;
          }
        </style>
      </head>
      <body>
        <div class="print-wrapper">
          ${reportElement.innerHTML}
        </div>
      </body>
      </html>
    `);
    doc.close();

    const triggerPrint = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.error('Print error:', err);
      } finally {
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 5000);
      }
    };

    if (doc.fonts && doc.fonts.ready) {
      doc.fonts.ready.then(() => {
        setTimeout(triggerPrint, 400);
      });
    } else {
      setTimeout(triggerPrint, 1200);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent
        className="max-w-6xl max-h-[92vh] flex flex-col p-0 overflow-hidden bg-slate-50 border-slate-200 text-right rounded-[32px]"
        dir="rtl"
      >
        <DialogTitle className="sr-only">تصدير كشف درجات الطلاب</DialogTitle>

        {/* Modal Top Header & Actions */}
        <div className="p-5 sm:p-6 bg-white border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 shadow-xs">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 shadow-inner">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-900">تصدير كشف درجات الكارت</h2>
                <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100 border-indigo-200 font-bold text-xs">
                  {folderName}
                </Badge>
              </div>
              <p className="text-xs text-slate-400 font-bold mt-0.5">
                {className} • {subjects.length} مواد دراسية • {students.length} طالب
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 flex-wrap justify-end">
            <Button
              onClick={handleExportExcel}
              variant="outline"
              className="h-11 px-4 rounded-xl border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-black text-xs gap-2 transition-all shadow-xs"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              تصدير Excel (CSV)
            </Button>

            <Button
              onClick={handlePrintPdf}
              className="h-11 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs gap-2 shadow-md transition-all"
            >
              <Printer className="w-4 h-4" />
              طباعة / حفظ PDF
            </Button>
          </div>
        </div>

        {/* Settings Bar */}
        <div className="px-6 py-3.5 bg-slate-100/90 border-b border-slate-200 flex items-center justify-between gap-4 flex-wrap text-xs font-bold text-slate-600 shrink-0">
          <div className="flex items-center gap-5 flex-wrap">
            {/* Paper Size */}
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-black">حجم الورق:</span>
              <div className="flex bg-white rounded-xl p-1 border border-slate-200 shadow-2xs">
                {(['a4', 'a3', 'a1'] as const).map(sz => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => setPageSize(sz)}
                    className={cn(
                      'px-3 py-1 rounded-lg text-xs font-black transition-all uppercase',
                      pageSize === sz ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                    )}
                  >
                    {sz.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Orientation */}
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-black">الاتجاه:</span>
              <div className="flex bg-white rounded-xl p-1 border border-slate-200 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setOrientation('landscape')}
                  className={cn(
                    'px-3 py-1 rounded-lg text-xs font-black transition-all',
                    orientation === 'landscape' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  )}
                >
                  عرضي (Landscape)
                </button>
                <button
                  type="button"
                  onClick={() => setOrientation('portrait')}
                  className={cn(
                    'px-3 py-1 rounded-lg text-xs font-black transition-all',
                    orientation === 'portrait' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  )}
                >
                  طولي (Portrait)
                </button>
              </div>
            </div>

            {/* Toggle options */}
            <div className="flex items-center gap-2">
              <Switch checked={showSchoolHeader} onCheckedChange={setShowSchoolHeader} id="hdr" />
              <label htmlFor="hdr" className="cursor-pointer text-slate-700 select-none">ترويسة المدرسة</label>
            </div>

            {hasNumericSubjects && (
              <>
                <div className="flex items-center gap-2">
                  <Switch checked={showTotals} onCheckedChange={setShowTotals} id="tot" />
                  <label htmlFor="tot" className="cursor-pointer text-slate-700 select-none">المجموع</label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={showPercentage} onCheckedChange={setShowPercentage} id="pct" />
                  <label htmlFor="pct" className="cursor-pointer text-slate-700 select-none">النسبة والتقدير</label>
                </div>
              </>
            )}

            <div className="flex items-center gap-2">
              <Switch checked={showSignatures} onCheckedChange={setShowSignatures} id="sig" />
              <label htmlFor="sig" className="cursor-pointer text-slate-700 select-none">التوقيعات والختم</label>
            </div>
          </div>
        </div>

        {/* Modal Scrollable Document Preview */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-200/60 flex justify-center">
          <QueryStateHandler
            loading={isLoading}
            error={error}
            data={students}
            onRetry={refetch}
            loadingMessage="جاري تجميع درجات جميع المواد..."
            isEmpty={students.length === 0}
            emptyMessage="لا يوجد طلاب في هذا الفصل."
          >
            {/* The Exact Printable Container */}
            <div
              id="card-grades-printable-doc"
              className={cn(
                'bg-white rounded-2xl shadow-xl p-6 sm:p-8 text-slate-900 mx-auto transition-all border border-slate-200',
                orientation === 'landscape' ? 'w-full max-w-[1100px]' : 'w-full max-w-[850px]'
              )}
              style={{ fontFamily: "'Cairo', 'Segoe UI', Tahoma, sans-serif" }}
            >
              {/* Header */}
              {showSchoolHeader && (
                <div style={{ borderBottom: '2.5px solid #1e293b', paddingBottom: '16px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ textAlign: 'right' }}>
                    <h1 style={{ fontSize: '20px', fontWeight: 900, color: '#0f172a', margin: '0 0 4px 0' }}>
                      {branding?.name || 'إدارة المدرسة'}
                    </h1>
                    <p style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', margin: '0 0 8px 0' }}>
                      كشف رصد وتقييم درجات الطلاب الرسمي
                    </p>
                    <div style={{ display: 'flex', gap: '10px', fontSize: '11px', fontWeight: 800 }}>
                      <span style={{ backgroundColor: '#f1f5f9', padding: '4px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                        الفصل: {className}
                      </span>
                      <span style={{ backgroundColor: '#e0e7ff', color: '#3730a3', padding: '4px 10px', borderRadius: '6px', border: '1px solid #c7d2fe' }}>
                        الكارت: {folderName}
                      </span>
                    </div>
                  </div>

                  <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                    {showLogo && branding?.logo_url ? (
                      <img
                        src={branding.logo_url}
                        alt="شعار المدرسة"
                        style={{ height: '60px', width: '60px', objectFit: 'contain', borderRadius: '10px', border: '1px solid #e2e8f0' }}
                      />
                    ) : (
                      <div style={{ height: '52px', width: '52px', borderRadius: '12px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                        <School className="w-6 h-6" />
                      </div>
                    )}
                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8' }}>
                      تاريخ الإصدار: {new Date().toLocaleDateString('ar-SA')}
                    </span>
                  </div>
                </div>
              )}

              {/* Matrix Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', direction: 'rtl' }}>
                <thead>
                  <tr style={{ backgroundColor: '#1e293b', color: '#ffffff' }}>
                    <th style={{ padding: '8px 6px', width: '36px', textAlign: 'center', border: '1.5px solid #94a3b8' }}>م</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', minWidth: '160px', border: '1.5px solid #94a3b8' }}>اسم الطالب</th>
                    {subjects.map(s => (
                      <th key={s.id} style={{ padding: '8px 6px', textAlign: 'center', border: '1.5px solid #94a3b8', minWidth: '85px' }}>
                        <div>{s.subject}</div>
                        {s.score_type !== 'text' && (
                          <div style={{ fontSize: '10px', fontWeight: 500, color: '#cbd5e1' }}>
                            ({s.max_score || 100})
                          </div>
                        )}
                      </th>
                    ))}
                    {hasNumericSubjects && showTotals && (
                      <th className="total-header" style={{ padding: '8px 6px', textAlign: 'center', border: '1.5px solid #94a3b8', minWidth: '70px', backgroundColor: '#312e81', color: '#ffffff' }}>
                        <div>المجموع</div>
                        <div style={{ fontSize: '10px', fontWeight: 500, color: '#c7d2fe' }}>({totalMaxScore})</div>
                      </th>
                    )}
                    {hasNumericSubjects && showPercentage && (
                      <>
                        <th style={{ padding: '8px 6px', textAlign: 'center', border: '1.5px solid #94a3b8', minWidth: '65px', backgroundColor: '#1e1b4b', color: '#ffffff' }}>
                          النسبة
                        </th>
                        <th style={{ padding: '8px 6px', textAlign: 'center', border: '1.5px solid #94a3b8', minWidth: '80px', backgroundColor: '#0f172a', color: '#ffffff' }}>
                          التقدير
                        </th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody style={{ fontWeight: 700, color: '#0f172a' }}>
                  {matrixData.map((row, idx) => (
                    <tr
                      key={row.id}
                      className={idx % 2 === 1 ? 'bg-zebra' : ''}
                      style={{ backgroundColor: idx % 2 === 1 ? '#f8fafc' : '#ffffff' }}
                    >
                      <td style={{ padding: '6px', textAlign: 'center', color: '#64748b', border: '1.5px solid #94a3b8' }}>
                        {idx + 1}
                      </td>
                      <td className="student-name-cell" style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 800, border: '1.5px solid #94a3b8' }}>
                        {row.name}
                      </td>
                      {row.subjectScores.map(scoreItem => {
                        let badgeClass = '';
                        if (scoreItem.score === 'ممتاز') badgeClass = 'badge-excellent';
                        else if (scoreItem.score === 'جيد جداً') badgeClass = 'badge-very-good';
                        else if (scoreItem.score === 'جيد') badgeClass = 'badge-good';
                        else if (scoreItem.score === 'مجتاز') badgeClass = 'badge-pass';
                        else if (scoreItem.score === 'غير مجتاز' || scoreItem.score === 'ضعيف') badgeClass = 'badge-fail';

                        return (
                          <td
                            key={scoreItem.subjectId}
                            style={{ padding: '6px', textAlign: 'center', border: '1.5px solid #94a3b8' }}
                          >
                            <span className={badgeClass}>
                              {scoreItem.score}
                            </span>
                          </td>
                        );
                      })}
                      {hasNumericSubjects && showTotals && (
                        <td className="total-cell" style={{ padding: '6px', textAlign: 'center', fontWeight: 900, backgroundColor: '#eef2ff', color: '#1e1b4b', border: '1.5px solid #94a3b8' }}>
                          {row.totalNumericScore}
                        </td>
                      )}
                      {hasNumericSubjects && showPercentage && (
                        <>
                          <td className="pct-cell" style={{ padding: '6px', textAlign: 'center', fontWeight: 900, color: '#4338ca', border: '1.5px solid #94a3b8' }}>
                            {row.percentage}
                          </td>
                          <td style={{ padding: '6px', textAlign: 'center', border: '1.5px solid #94a3b8' }}>
                            <span
                              className={cn(
                                row.generalEvaluation === 'ممتاز' ? 'badge-excellent' :
                                row.generalEvaluation === 'جيد جداً' ? 'badge-very-good' :
                                row.generalEvaluation === 'جيد' ? 'badge-good' :
                                row.generalEvaluation === 'مقبول' ? 'badge-pass' : ''
                              )}
                            >
                              {row.generalEvaluation}
                            </span>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Signatures & Accreditation */}
              {showSignatures && (
                <div className="signatures-block" style={{ marginTop: '30px', paddingTop: '20px', borderTop: '2px solid #cbd5e1', display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
                  <div className="sig-col" style={{ width: '30%', textAlign: 'center' }}>
                    <p style={{ fontSize: '12px', fontWeight: 800, color: '#334155', margin: 0 }}>معلم / مربي الفصل</p>
                    <div className="sig-line" style={{ marginTop: '40px', borderBottom: '1.5px dashed #94a3b8', width: '80%', margin: '40px auto 0' }} />
                  </div>
                  <div className="sig-col" style={{ width: '30%', textAlign: 'center' }}>
                    <p style={{ fontSize: '12px', fontWeight: 800, color: '#334155', margin: 0 }}>وكيل الشؤون التعليمية</p>
                    <div className="sig-line" style={{ marginTop: '40px', borderBottom: '1.5px dashed #94a3b8', width: '80%', margin: '40px auto 0' }} />
                  </div>
                  <div className="sig-col" style={{ width: '30%', textAlign: 'center' }}>
                    <p style={{ fontSize: '12px', fontWeight: 800, color: '#334155', margin: 0 }}>مدير المدرسة والختم الرسمي</p>
                    <div className="sig-line" style={{ marginTop: '40px', borderBottom: '1.5px dashed #94a3b8', width: '80%', margin: '40px auto 0' }} />
                  </div>
                </div>
              )}
            </div>
          </QueryStateHandler>
        </div>
      </DialogContent>
    </Dialog>
  );
}
