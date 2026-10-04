import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { useSessionState } from '@/hooks/useSessionState';
import {
  BookOpen, Plus, Trash2, Save, FolderOpen, Sparkles, Search,
  ArrowRight, ChevronLeft, ArrowUp, ArrowDown, RotateCcw,
  CheckCircle2, Wand2, Eraser, MoreVertical, AlertCircle, FileSpreadsheet, Download
} from 'lucide-react';
import { CardGradesExportModal } from './CardGradesExportModal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  useExamTemplates,
  useStudentGrades,
  useCreateExamTemplate,
  useDeleteExamTemplate,
  useUpsertGrades,
} from '@/hooks/queries';
import { QueryStateHandler } from '@/components/QueryStateHandler';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ClassExamsViewProps {
  classId: string;
  className: string;
}

type ViewState = 'folders' | 'grading';

const DESCRIPTIVE_PRESETS = ['ممتاز', 'جيد جداً', 'جيد', 'مجتاز', 'غير مجتاز'];

// ── Autocomplete Input ────────────────────────────────────────────────────────
function AutocompleteInput({
  value,
  onChange,
  suggestions,
  placeholder,
  inputRef,
  onKeyDown,
}: {
  value: string;
  onChange: (v: string) => void;
  suggestions: string[];
  placeholder?: string;
  inputRef?: React.Ref<HTMLInputElement>;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!value.trim()) return suggestions.slice(0, 6);
    const q = value.trim().toLowerCase();
    return suggestions.filter(s => s.toLowerCase().includes(q) && s !== value).slice(0, 6);
  }, [value, suggestions]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={containerRef} className="relative flex-1 min-w-0">
      <Input
        ref={inputRef}
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className="h-11 sm:h-10 text-sm sm:text-xs font-bold rounded-xl text-right bg-slate-50 border-slate-200 focus:bg-white focus:border-indigo-400 w-full transition-all"
      />
      {open && filtered.length > 0 && (
        <div className="absolute top-[calc(100%+4px)] right-0 left-0 z-50 bg-white border border-slate-100 rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          {filtered.map((s, i) => (
            <button
              key={i}
              type="button"
              onMouseDown={e => { e.preventDefault(); onChange(s); setOpen(false); }}
              className="w-full text-right px-4 py-3 sm:py-2.5 text-sm sm:text-xs font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors border-b border-slate-50 last:border-0 active:bg-indigo-100"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function ClassExamsView({ classId, className }: ClassExamsViewProps) {
  const { toast } = useToast();
  const { user } = useAuth();

  const [view, setView] = useState<ViewState>('folders');
  const [selectedFolderName, setSelectedFolderName] = useState<string>('');
  const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showAddSubjectDialog, setShowAddSubjectDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteExamTargetId, setDeleteExamTargetId] = useState<string | null>(null);
  const [deleteFolderTargetName, setDeleteFolderTargetName] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportModalFolderName, setExportModalFolderName] = useState<string>('');

  const handleOpenExportModal = (folderName: string) => {
    setExportModalFolderName(folderName);
    setShowExportModal(true);
  };

  // References for keyboard navigation across student inputs
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // ── بطاقات الشهور المنشأة محلياً (لتظهر فور إنشائها حتى قبل إضافة أول مادة) ──
  const [storedCards, setStoredCards] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(`exam_cards_${classId}`);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const saveStoredCards = (cards: string[]) => {
    setStoredCards(cards);
    try {
      localStorage.setItem(`exam_cards_${classId}`, JSON.stringify(cards));
    } catch { /* ignore */ }
  };

  // ── ترتيب مؤقت للجلسة ──
  const [customOrder, setCustomOrder] = useSessionState<string[]>(`grades:order:${classId}`, []);

  const {
    data: templatesData,
    isLoading: templatesLoading,
    error: templatesError,
    refetch: refetchTemplates
  } = useExamTemplates(classId, null, 1, 100);

  const templates = useMemo(() => templatesData?.data || [], [templatesData]);

  const monthFolders = useMemo(() => {
    const folders: Record<string, any[]> = {};
    
    // 1. بطاقات الشهور المحفوظة
    storedCards.forEach(cardName => {
      if (cardName && cardName.trim()) {
        folders[cardName.trim()] = [];
      }
    });

    // 2. تجميع المواد من قاعدة البيانات
    templates.forEach(t => {
      const key = (t.title || t.term || 'تقييم شهري').trim();
      if (!folders[key]) folders[key] = [];
      folders[key].push(t);
    });
    return folders;
  }, [templates, storedCards]);

  const monthFolderKeys = Object.keys(monthFolders);

  const {
    data: studentGradesData,
    isLoading: gradesLoading,
    error: gradesError,
    refetch: refetchGrades
  } = useStudentGrades(selectedTemplate || null, classId);

  const studentGrades = useMemo(() => studentGradesData || [], [studentGradesData]);
  const [localGrades, setLocalGrades] = useState(studentGrades);

  // Sync loaded student grades
  useEffect(() => {
    if (!studentGrades.length) {
      setLocalGrades([]);
      setHasUnsavedChanges(false);
      return;
    }
    if (customOrder.length > 0) {
      const sorted = [...studentGrades].sort((a, b) => {
        const ia = customOrder.indexOf(a.studentId);
        const ib = customOrder.indexOf(b.studentId);
        if (ia === -1 && ib === -1) return 0;
        if (ia === -1) return 1;
        if (ib === -1) return -1;
        return ia - ib;
      });
      setLocalGrades(sorted);
    } else {
      setLocalGrades(studentGrades);
    }
    setHasUnsavedChanges(false);
  }, [studentGrades, customOrder]);

  // Reset order when class changes
  const prevClassId = useRef(classId);
  useEffect(() => {
    if (prevClassId.current !== classId) {
      setCustomOrder([]);
      prevClassId.current = classId;
    }
  }, [classId, setCustomOrder]);

  const handleGradeChange = (studentId: string, score: string) => {
    setLocalGrades(prev => prev.map(g => g.studentId === studentId ? { ...g, score } : g));
    setHasUnsavedChanges(true);
  };

  // Fast Bulk Fill
  const handleBulkFill = (scoreValue: string) => {
    setLocalGrades(prev => prev.map(g => ({ ...g, score: scoreValue })));
    setHasUnsavedChanges(true);
    toast({ title: `تم تعبئة جميع الطلاب بالقيمة: "${scoreValue}"` });
  };

  const handleClearAll = () => {
    setLocalGrades(prev => prev.map(g => ({ ...g, score: '' })));
    setHasUnsavedChanges(true);
    toast({ title: 'تم مسح درجات جميع الطلاب' });
  };

  // Keyboard navigation
  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      if (index + 1 < filteredGrades.length) {
        inputRefs.current[index + 1]?.focus();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (index - 1 >= 0) {
        inputRefs.current[index - 1]?.focus();
      }
    }
  };

  // Reordering helpers
  const moveUp = useCallback((idx: number) => {
    if (idx === 0) return;
    setLocalGrades(prev => {
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      setCustomOrder(next.map(g => g.studentId));
      return next;
    });
  }, [setCustomOrder]);

  const moveDown = useCallback((idx: number) => {
    setLocalGrades(prev => {
      if (idx === prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      setCustomOrder(next.map(g => g.studentId));
      return next;
    });
  }, [setCustomOrder]);

  const resetOrder = useCallback(() => {
    setCustomOrder([]);
    setLocalGrades(studentGrades);
  }, [studentGrades, setCustomOrder]);

  const isCustomOrdered = customOrder.length > 0;

  // Autocomplete suggestions
  const autocompleteSuggestions = useMemo(() => {
    const seen = new Set<string>(DESCRIPTIVE_PRESETS);
    localGrades.forEach(g => {
      if (g.score?.trim()) seen.add(g.score.trim());
    });
    return Array.from(seen);
  }, [localGrades]);

  const filteredGrades = useMemo(() => {
    return localGrades.filter(sg =>
      (sg.studentName || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [localGrades, searchQuery]);

  // Statistics
  const gradedCount = useMemo(() => {
    return localGrades.filter(g => g.score && String(g.score).trim() !== '').length;
  }, [localGrades]);

  const createExamMutation = useCreateExamTemplate();
  const deleteExamMutation = useDeleteExamTemplate();
  const upsertGradesMutation = useUpsertGrades();

  const handleSaveGrades = async () => {
    if (!selectedTemplate) return;
    const gradesToSave = localGrades
      .filter(g => g.score && String(g.score).trim() !== '')
      .map(g => ({
        student_id: g.studentId,
        exam_template_id: selectedTemplate.id,
        score: g.score,
        max_score: selectedTemplate.max_score || 100,
        subject: selectedTemplate.subject || '',
        term: selectedTemplate.term || '',
        date: new Date().toISOString(),
      }));

    try {
      if (gradesToSave.length > 0) {
        await upsertGradesMutation.mutateAsync(gradesToSave);
      }
      setHasUnsavedChanges(false);
      toast({ title: 'تم حفظ التقييمات بنجاح 🌟' });
      refetchGrades();
    } catch (err: any) {
      toast({ title: 'خطأ أثناء الحفظ', description: err.message, variant: 'destructive' });
    }
  };

  // ✅ FIX: Deleting a subject stays inside the card if other subjects exist!
  const handleDeleteExam = async (templateId: string) => {
    try {
      await deleteExamMutation.mutateAsync(templateId);
      toast({ title: 'تم حذف المادة بنجاح' });
      
      const currentSubjects = monthFolders[selectedFolderName] || [];
      const remaining = currentSubjects.filter(t => t.id !== templateId);

      if (remaining.length > 0) {
        // Stay in the card and select the next subject seamlessly
        setSelectedTemplate(remaining[0]);
      } else {
        // If no subjects left in this card, return to folder list
        setView('folders');
        setSelectedTemplate(null);
      }
      refetchTemplates();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    } finally {
      setDeleteExamTargetId(null);
    }
  };

  // ✅ Delete Entire Card (all subjects in this folder)
  const handleDeleteFolder = async (folderName: string) => {
    const subjectsInFolder = monthFolders[folderName] || [];
    try {
      for (const t of subjectsInFolder) {
        await deleteExamMutation.mutateAsync(t.id);
      }
      saveStoredCards(storedCards.filter(c => c !== folderName));
      toast({ title: `تم حذف كارت "${folderName}" بالكامل` });
      if (selectedFolderName === folderName) {
        setView('folders');
        setSelectedTemplate(null);
      }
      refetchTemplates();
    } catch (err: any) {
      toast({ title: 'خطأ أثناء حذف الكارت', description: err.message, variant: 'destructive' });
    } finally {
      setDeleteFolderTargetName(null);
    }
  };

  const enterFolder = (folderName: string) => {
    setSelectedFolderName(folderName);
    const folderTemplates = monthFolders[folderName] || [];
    setSelectedTemplate(folderTemplates[0] || null);
    setView('grading');
  };

  // ─── VIEW 1: Cards/Folders Grid ──────────────────────────────────────────
  if (view === 'folders') {
    return (
      <div className="space-y-6 animate-in fade-in duration-400 text-right" dir="rtl">
        {/* Top Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white px-6 py-5 rounded-[28px] border border-slate-100 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-inner">
              <FolderOpen className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">سجل التقييمات والاختبارات</h2>
              <p className="text-xs text-slate-400 font-bold mt-0.5">
                {className} • {monthFolderKeys.length} كروت تقييم منشأة
              </p>
            </div>
          </div>
          <Button
            onClick={() => setShowCreateDialog(true)}
            className="h-11 px-5 rounded-xl bg-slate-900 hover:bg-indigo-600 text-white font-black text-xs shadow-md gap-2 transition-all"
          >
            <Plus className="w-4 h-4" />
            إنشاء كارت تقييم جديد
          </Button>
        </div>

        <QueryStateHandler
          loading={templatesLoading}
          error={templatesError}
          data={templates}
          onRetry={refetchTemplates}
          loadingMessage="جاري تحميل كروت التقييم..."
          isEmpty={monthFolderKeys.length === 0}
          emptyMessage="لا توجد كروت تقييم بعد. اضغط على 'إنشاء كارت تقييم جديد' للبدء."
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {monthFolderKeys.map(folderName => {
              const folderTemplates = monthFolders[folderName] || [];
              return (
                <div
                  key={folderName}
                  className="group relative text-right p-6 rounded-[28px] border border-slate-100 bg-white hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-50/60 transition-all duration-300 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div
                        onClick={() => enterFolder(folderName)}
                        className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all shrink-0 cursor-pointer shadow-sm"
                      >
                        <FolderOpen className="w-7 h-7" />
                      </div>
                      
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteFolderTargetName(folderName);
                          }}
                          className="w-8 h-8 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors"
                          title="حذف الكارت بالكامل"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => enterFolder(folderName)}
                          className="w-8 h-8 rounded-lg text-slate-300 group-hover:text-indigo-600 flex items-center justify-center transition-colors"
                        >
                          <ChevronLeft className="w-5 h-5" />
                        </button>
                      </div>
                    </div>

                    <div onClick={() => enterFolder(folderName)} className="cursor-pointer">
                      <h3 className="font-black text-slate-900 text-base mb-1 hover:text-indigo-600 transition-colors">
                        {folderName}
                      </h3>
                      <p className="text-xs text-slate-400 font-bold mb-4">
                        {folderTemplates.length} مواد دراسية
                      </p>

                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {folderTemplates.slice(0, 5).map(t => (
                          <span
                            key={t.id}
                            className="text-[11px] font-bold bg-slate-50 text-slate-600 border border-slate-100 px-2.5 py-1 rounded-lg"
                          >
                            {t.subject}
                          </span>
                        ))}
                        {folderTemplates.length > 5 && (
                          <span className="text-[11px] font-bold bg-indigo-50 text-indigo-600 px-2 py-1 rounded-lg">
                            +{folderTemplates.length - 5}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 mt-4 border-t border-slate-50 flex items-center justify-between gap-2">
                    <Button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenExportModal(folderName);
                      }}
                      variant="outline"
                      className="h-8 px-3 rounded-lg text-xs font-black border-slate-200 text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 gap-1.5 transition-all shadow-2xs"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-600" />
                      <span>تصدير الكشف</span>
                    </Button>
                    <Button
                      onClick={() => enterFolder(folderName)}
                      variant="ghost"
                      className="h-8 px-3 rounded-lg text-xs font-black text-indigo-600 hover:bg-indigo-50"
                    >
                      فتح الكارت
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </QueryStateHandler>

        {showCreateDialog && (
          <CreateMonthCardDialog
            className={className}
            onClose={() => setShowCreateDialog(false)}
            onSuccess={(folderName) => {
              setShowCreateDialog(false);
              saveStoredCards(Array.from(new Set([...storedCards, folderName])));
              setSelectedFolderName(folderName);
              setSelectedTemplate(null);
              setView('grading');
            }}
          />
        )}

        {/* Card Grades Matrix Export Modal */}
        {showExportModal && (
          <CardGradesExportModal
            isOpen={showExportModal}
            onClose={() => setShowExportModal(false)}
            classId={classId}
            className={className}
            folderName={exportModalFolderName}
            subjects={monthFolders[exportModalFolderName] || []}
          />
        )}

        {/* Delete Folder Alert Dialog */}
        <AlertDialog open={!!deleteFolderTargetName} onOpenChange={(open) => { if (!open) setDeleteFolderTargetName(null); }}>
          <AlertDialogContent dir="rtl">
            <AlertDialogHeader>
              <AlertDialogTitle>حذف كارت التقييم بالكامل</AlertDialogTitle>
              <AlertDialogDescription>
                هل أنت متأكد من حذف كارت "{deleteFolderTargetName}" وجميع المواد ودرجات الطلاب المسجلة داخله؟ هذا الإجراء لا يمكن التراجع عنه.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2">
              <AlertDialogCancel>إلغاء</AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={() => deleteFolderTargetName && handleDeleteFolder(deleteFolderTargetName)}
              >
                {deleteExamMutation.isPending ? 'جاري الحذف...' : 'حذف الكارت بالكامل'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // ─── VIEW 2: Subject & Grades Management ──────────────────────────────────
  const currentFolderTemplates = monthFolders[selectedFolderName] || [];

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-400 text-right" dir="rtl">
      {/* Top Header & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-[28px] border border-slate-100 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setView('folders')}
            className="flex items-center gap-2 text-sm font-black text-slate-500 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 px-3.5 py-2 rounded-xl transition-colors"
          >
            <ArrowRight className="w-4 h-4" />
            كروت التقييم
          </button>
          <span className="text-slate-200">/</span>
          <div>
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-indigo-600" />
              {selectedFolderName}
            </h2>
            <p className="text-[11px] text-slate-400 font-bold">{className}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          <Button
            type="button"
            onClick={() => handleOpenExportModal(selectedFolderName)}
            variant="outline"
            className="h-10 px-4 rounded-xl border-slate-200 bg-white hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 text-slate-700 font-black text-xs gap-2 shadow-2xs transition-all"
          >
            <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
            <span>تصدير الكشف (PDF/Excel)</span>
          </Button>

          <Button
            onClick={() => setShowAddSubjectDialog(true)}
            className="h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs gap-2 shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            إضافة مادة للكارت
          </Button>

          <Button
            onClick={() => setDeleteFolderTargetName(selectedFolderName)}
            variant="outline"
            className="h-10 px-3 rounded-xl border-rose-100 bg-rose-50 text-rose-600 hover:bg-rose-100 font-black text-xs gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">حذف الكارت</span>
          </Button>
        </div>
      </div>

      <div className="bg-white border border-slate-100 rounded-[32px] overflow-hidden shadow-sm">
        {/* Subject Tabs */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/70 flex items-center gap-2.5 overflow-x-auto hide-scrollbar">
          <span className="text-xs font-black text-slate-400 shrink-0 ml-1">المواد:</span>
          {currentFolderTemplates.length === 0 ? (
            <span className="text-xs text-slate-400 font-bold">لا توجد مواد دراسية بعد — أضف مادة للبدء</span>
          ) : (
            <div className="flex items-center gap-2">
              {currentFolderTemplates.map(t => {
                const isSelected = selectedTemplate?.id === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      if (hasUnsavedChanges) {
                        handleSaveGrades();
                      }
                      setSelectedTemplate(t);
                    }}
                    className={cn(
                      'px-4 py-2.5 rounded-xl text-xs font-black transition-all whitespace-nowrap shrink-0 flex items-center gap-2',
                      isSelected
                        ? 'bg-slate-900 text-white shadow-md'
                        : 'bg-white text-slate-600 border border-slate-100 hover:border-slate-300 hover:text-slate-900'
                    )}
                  >
                    <span>{t.subject}</span>
                    {t.score_type !== 'text' && (
                      <span className={cn(
                        'text-[10px] px-1.5 py-0.5 rounded-md font-bold',
                        isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                      )}>
                        من {t.max_score}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {selectedTemplate ? (
          <>
            {/* Subject Control Toolbar */}
            <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                    {selectedTemplate.subject}
                    <Badge variant="outline" className="text-[11px] font-bold border-indigo-100 bg-indigo-50/50 text-indigo-700">
                      {selectedTemplate.score_type === 'text' ? '📝 تقييم وصفي / مهارات' : `🔢 درجات رقمية (من ${selectedTemplate.max_score})`}
                    </Badge>
                  </h3>
                  <p className="text-xs text-slate-400 font-bold mt-0.5">
                    تم رصد: <span className="text-indigo-600 font-black">{gradedCount}</span> من أصل <span className="font-black">{localGrades.length}</span> طالب
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap justify-end">
                {hasUnsavedChanges && (
                  <Badge className="bg-amber-500 text-white gap-1 text-[11px] font-bold px-2.5 py-1">
                    <AlertCircle className="w-3 h-3" />
                    تغييرات غير محفوظة
                  </Badge>
                )}

                {isCustomOrdered && (
                  <button
                    onClick={resetOrder}
                    title="إعادة الترتيب الافتراضي"
                    className="h-10 px-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 hover:bg-amber-100 flex items-center gap-1.5 text-xs font-black transition-all"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">إعادة الترتيب</span>
                  </button>
                )}

                <div className="relative">
                  <Search className="w-4 h-4 text-slate-300 absolute right-3 top-1/2 -translate-y-1/2" />
                  <Input
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="بحث عن طالب..."
                    className="pr-9 h-10 bg-slate-50 border-slate-200 text-xs font-bold rounded-xl w-32 sm:w-44 focus:bg-white"
                  />
                </div>

                <button
                  onClick={() => setDeleteExamTargetId(selectedTemplate.id)}
                  title="حذف هذه المادة"
                  className="w-10 h-10 rounded-xl bg-rose-50 text-rose-500 hover:bg-rose-100 flex items-center justify-center transition-all shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                <Button
                  onClick={handleSaveGrades}
                  disabled={upsertGradesMutation.isPending}
                  className={cn(
                    'h-10 px-5 rounded-xl text-white font-black text-xs shadow-md gap-2 transition-all',
                    hasUnsavedChanges
                      ? 'bg-emerald-600 hover:bg-emerald-700 animate-pulse'
                      : 'bg-indigo-600 hover:bg-indigo-700'
                  )}
                >
                  <Save className="w-4 h-4" />
                  {upsertGradesMutation.isPending ? 'جاري الحفظ...' : 'حفظ الدرجات'}
                </Button>
              </div>
            </div>

            {/* Quick Bulk Presets Bar */}
            <div className="px-5 py-3 bg-slate-50/90 border-b border-slate-100 flex items-center justify-between gap-3 overflow-x-auto hide-scrollbar">
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[11px] font-black text-slate-500 flex items-center gap-1.5">
                  <Wand2 className="w-3.5 h-3.5 text-indigo-500" />
                  تعبئة سريعة للكل:
                </span>
                {selectedTemplate.score_type === 'text' ? (
                  DESCRIPTIVE_PRESETS.map(preset => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handleBulkFill(preset)}
                      className="px-3 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 transition-all shadow-2xs"
                    >
                      {preset}
                    </button>
                  ))
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => handleBulkFill(String(selectedTemplate.max_score || 100))}
                      className="px-3 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition-all"
                    >
                      الدرجة النهائية ({selectedTemplate.max_score || 100})
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBulkFill(String(Math.round((selectedTemplate.max_score || 100) * 0.9)))}
                      className="px-3 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-all"
                    >
                      90% ({Math.round((selectedTemplate.max_score || 100) * 0.9)})
                    </button>
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={handleClearAll}
                className="text-[11px] font-bold text-rose-500 hover:text-rose-700 flex items-center gap-1 shrink-0 px-2 py-1 rounded-lg hover:bg-rose-50 transition-colors"
              >
                <Eraser className="w-3 h-3" />
                مسح الكل
              </button>
            </div>

            {/* Grade rows */}
            <QueryStateHandler
              loading={gradesLoading}
              error={gradesError}
              data={studentGrades}
              onRetry={refetchGrades}
              loadingMessage="جاري تحميل قائمة الطلاب..."
            >
              <div className="divide-y divide-slate-100">
                {filteredGrades.map((grade, idx) => (
                  <div
                    key={grade.studentId}
                    className="px-4 sm:px-6 py-3.5 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 hover:bg-slate-50/70 transition-colors border-b border-slate-50 last:border-0"
                  >
                    {/* Index + Name + Reordering */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {!searchQuery && (
                        <div className="flex sm:flex-col gap-1 sm:gap-0.5 shrink-0">
                          <button
                            onClick={() => moveUp(idx)}
                            disabled={idx === 0}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                            title="تحريك لأعلى"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => moveDown(idx)}
                            disabled={idx === filteredGrades.length - 1}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                            title="تحريك لأسفل"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-100 text-slate-600 text-xs font-black flex items-center justify-center shrink-0 shadow-2xs">
                        {idx + 1}
                      </div>
                      <span className="font-black text-slate-900 text-sm sm:text-base leading-snug break-words">
                        {grade.studentName}
                      </span>
                    </div>

                    {/* Inputs */}
                    <div className="flex items-center gap-2.5 w-full sm:w-72 sm:justify-end shrink-0 pl-1">
                      {selectedTemplate.score_type === 'text' ? (
                        <AutocompleteInput
                          inputRef={el => (inputRefs.current[idx] = el)}
                          value={grade.score}
                          onChange={v => handleGradeChange(grade.studentId, v)}
                          onKeyDown={e => handleKeyDown(idx, e)}
                          suggestions={autocompleteSuggestions}
                          placeholder="ممتاز، جيد جداً..."
                        />
                      ) : (
                        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                          <Input
                            ref={el => (inputRefs.current[idx] = el)}
                            type="number"
                            value={grade.score}
                            onChange={e => handleGradeChange(grade.studentId, e.target.value)}
                            onKeyDown={e => handleKeyDown(idx, e)}
                            placeholder="0"
                            className="h-11 w-24 sm:w-28 text-center font-black text-base rounded-xl bg-slate-50 border-slate-200 focus:bg-white focus:border-indigo-400 shadow-2xs"
                          />
                          <span className="text-xs font-black text-slate-400 shrink-0 min-w-[45px]">
                            من {selectedTemplate.max_score}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </QueryStateHandler>
          </>
        ) : (
          <div className="py-16 text-center text-slate-400 space-y-3">
            <Sparkles className="w-10 h-10 mx-auto text-slate-200" />
            <p className="font-bold text-sm">اضغط "إضافة مادة للكارت" لإضافة مادة دراسية والبدء برصد الدرجات</p>
          </div>
        )}
      </div>

      {showAddSubjectDialog && (
        <AddSubjectDialog
          classId={classId}
          folderName={selectedFolderName}
          onClose={() => setShowAddSubjectDialog(false)}
          onSuccess={(newTemplate) => {
            setShowAddSubjectDialog(false);
            refetchTemplates();
            if (newTemplate) {
              setSelectedTemplate(newTemplate);
            }
          }}
        />
      )}

      {/* Card Grades Matrix Export Modal */}
      {showExportModal && (
        <CardGradesExportModal
          isOpen={showExportModal}
          onClose={() => setShowExportModal(false)}
          classId={classId}
          className={className}
          folderName={exportModalFolderName}
          subjects={monthFolders[exportModalFolderName] || []}
        />
      )}

      {/* Delete Subject Alert Dialog */}
      <AlertDialog open={!!deleteExamTargetId} onOpenChange={(open) => { if (!open) setDeleteExamTargetId(null); }}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف المادة من الكارت</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف هذه المادة؟ سيتم حذف جميع درجات الطلاب المرتبطة بها في هذا الكارت.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => deleteExamTargetId && handleDeleteExam(deleteExamTargetId)}
            >
              {deleteExamMutation.isPending ? 'جاري الحذف...' : 'حذف المادة'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Create Month Card Dialog ─────────────────────────────────────────────────
function CreateMonthCardDialog({
  className,
  onClose,
  onSuccess
}: {
  className: string;
  onClose: () => void;
  onSuccess: (folderName: string) => void;
}) {
  const { toast } = useToast();
  const [monthTitle, setMonthTitle] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const title = monthTitle.trim();
    if (!title) {
      toast({ title: 'يرجى إدخال اسم الشهر / الكارت', variant: 'destructive' });
      return;
    }
    toast({
      title: `تم إنشاء كارت "${title}" بنجاح 🌟`,
      description: 'يمكنك الآن إضافة المواد الدراسية للكارت'
    });
    onSuccess(title);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4 text-right" onClick={onClose} dir="rtl">
      <div className="bg-white border border-slate-100 shadow-2xl w-full max-w-md p-6 sm:p-8 rounded-[36px] animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-5">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0">
            <FolderOpen className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900">إنشاء كارت تقييم جديد</h2>
            <p className="text-xs text-slate-400 font-bold mt-0.5">فصل: {className}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-xs font-black text-slate-700">اسم الكارت / الشهر *</label>
            <Input
              value={monthTitle}
              onChange={e => setMonthTitle(e.target.value)}
              className="h-12 px-4 rounded-xl border-slate-200 bg-slate-50 focus:bg-white font-bold text-sm"
              placeholder="مثال: تقييم شهر أكتوبر"
              required
              autoFocus
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="submit"
              className="flex-1 h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black shadow-lg text-sm transition-all"
            >
              إنشاء الكارت
            </Button>
            <Button
              type="button"
              onClick={onClose}
              variant="ghost"
              className="h-12 px-6 rounded-xl bg-slate-100 text-slate-600 font-black text-sm"
            >
              إلغاء
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Add Subject Dialog ───────────────────────────────────────────────────────
function AddSubjectDialog({
  classId,
  folderName,
  onClose,
  onSuccess
}: {
  classId: string;
  folderName: string;
  onClose: () => void;
  onSuccess: (newTemplate: any) => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [subjectName, setSubjectName] = useState('');
  const [scoreType, setScoreType] = useState<'numeric' | 'text'>('text');
  const [maxScore, setMaxScore] = useState('100');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const createMutation = useCreateExamTemplate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectName.trim()) return;
    setIsSubmitting(true);
    try {
      const created = await createMutation.mutateAsync({
        class_id: classId,
        subject: subjectName.trim(),
        exam_type: 'monthly',
        max_score: Number(maxScore) || 100,
        weight: 1,
        term: folderName,
        title: folderName,
        score_type: scoreType,
        teacher_id: user?.id || ''
      });
      toast({ title: `تم إضافة مادة "${subjectName}" بنجاح 🌟` });
      onSuccess(created);
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4 text-right" onClick={onClose} dir="rtl">
      <div className="bg-white border border-slate-100 shadow-2xl w-full max-w-md p-6 sm:p-8 rounded-[36px] animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900">إضافة مادة دراسية للكارت</h2>
            <p className="text-xs text-slate-400 font-bold mt-0.5">كارت: {folderName}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-xs font-black text-slate-700">اسم المادة *</label>
            <Input
              value={subjectName}
              onChange={e => setSubjectName(e.target.value)}
              className="h-12 px-4 rounded-xl border-slate-200 bg-slate-50 focus:bg-white font-bold text-sm"
              placeholder="اكتب اسم المادة هنا..."
              required
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-black text-slate-700">نوع التقييم</label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { val: 'text', label: 'تقييم وصفي / مهارات' },
                { val: 'numeric', label: 'درجات رقمية' }
              ].map(opt => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => setScoreType(opt.val as any)}
                  className={cn(
                    'h-12 rounded-xl border flex items-center justify-center font-black text-xs transition-all',
                    scoreType === opt.val
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 bg-slate-50 text-slate-400 hover:border-slate-300'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {scoreType === 'numeric' && (
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-700">الدرجة النهائية</label>
              <Input
                type="number"
                value={maxScore}
                onChange={e => setMaxScore(e.target.value)}
                className="h-12 px-5 rounded-xl border-slate-200 bg-slate-50 font-black text-center text-sm"
              />
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black shadow-lg text-sm transition-all"
            >
              {isSubmitting ? 'جاري الإضافة...' : 'إضافة المادة والبدء بالرصد'}
            </Button>
            <Button
              type="button"
              onClick={onClose}
              variant="ghost"
              className="h-12 px-6 rounded-xl bg-slate-100 text-slate-600 font-black text-sm"
            >
              إلغاء
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
