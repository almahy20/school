import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  useExamQuestions,
  useSubmitExamAttempt,
  safeParseOptions,
  fetchExamDraft,
  saveExamDraft,
  deleteExamDraft,
  type ElectronicExam,
  type ExamQuestion,
} from '@/hooks/queries/useElectronicExams';

// ── Seeded Shuffle (deterministic per student+exam, consistent across renders)
function seededShuffle<T>(arr: T[], seed: string): T[] {
  const out = [...arr];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  for (let i = out.length - 1; i > 0; i--) {
    h = (Math.imul(h ^ (h >>> 16), 0x45d9f3b)) | 0;
    const j = Math.abs(h) % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export type ExamScreen = 'confirm' | 'taking' | 'result';

export interface SubmitResult {
  score: number;
  totalScore: number;
  questions: ExamQuestion[];
  answers: Record<string, string>;
}

export interface UseExamRunnerParams {
  exam: ElectronicExam;
  studentId: string;
}

/** فاصل الحفظ التدريجي على السيرفر أثناء الحل */
const DRAFT_AUTOSAVE_MS = 15_000;

export function useExamRunner({ exam, studentId }: UseExamRunnerParams) {
  const { user } = useAuth();
  const parentId = user?.id ?? '';
  const schoolId = exam.school_id || user?.schoolId || '';

  const [screen, setScreen] = useState<ExamScreen>('confirm');
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState(exam.duration_minutes * 60);
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);
  const startTimeRef = useRef<number>(0);
  const currentQRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const answersRef = useRef<Record<string, string>>({});
  const isSubmittingRef = useRef<boolean>(false);
  /** وقت البداية الحقيقي (ISO) — يُحفظ على السيرفر ليعرف الزمن المستهلك حتى لو مات الجهاز */
  const draftStartedAtRef = useRef<string>(new Date().toISOString());

  // ── Anti-Cheat State ────────────────────────────────────────────────────────
  // ملاحظة تصميمية: كل مغادرة للشاشة (hidden) تُحتسب في سجل النزاهة،
  // لكن لا يوجد تسليم تلقائي عند تجاوز حد معيّن — لأن انقطاع الجهاز أو مكالمة
  // واردة كانا يُسقطان الاختبار بالإجابات الناقصة. القرار النهائي للمعلم.
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [showCheatWarning, setShowCheatWarning] = useState(false);
  const [cheatWarningMsg, setCheatWarningMsg] = useState('');
  const tabSwitchCountRef = useRef(0);

  const { data: rawQuestions = [], isLoading: qLoading } = useExamQuestions(exam.id, { excludeAnswer: true });
  const submitAttempt = useSubmitExamAttempt();

  // Shuffle questions and options deterministically per student
  const questions = useMemo(() => {
    if (rawQuestions.length === 0) return rawQuestions;
    const seed = `${exam.id}-${studentId}`;
    return seededShuffle(rawQuestions, seed).map(q => {
      if (q.question_type === 'multiple_choice') {
        const parsedOpts = safeParseOptions(q.options);
        return { ...q, options: seededShuffle(parsedOpts, seed + q.id) };
      }
      return q;
    });
  }, [rawQuestions, exam.id, studentId]);

  const isExpired = exam.available_until ? new Date() > new Date(exam.available_until) : false;
  const isNotStarted = exam.available_from ? new Date() < new Date(exam.available_from) : false;

  const storageKey = `exam_progress_${exam.id}_${studentId}`;

  // ── نسخة محلية (localStorage) — تصمد أمام إغلاق التاب وموت الجهاز ──────────
  const persistLocal = useCallback(
    (overrides?: Partial<{ answers: Record<string, string>; currentQ: number; tabSwitchCount: number }>) => {
      try {
        localStorage.setItem(storageKey, JSON.stringify({
          startTime: startTimeRef.current,
          startedAt: draftStartedAtRef.current,
          answers: overrides?.answers ?? answersRef.current,
          currentQ: overrides?.currentQ ?? currentQRef.current,
          tabSwitchCount: overrides?.tabSwitchCount ?? tabSwitchCountRef.current,
        }));
      } catch {
        // localStorage غير متاح — غير حرج
      }
    },
    [storageKey],
  );

  // ── حفظ تدريجي على السيرفر (كل 15 ثانية وعند كل مغادرة للشاشة) ─────────────
  const persistDraft = useCallback(() => {
    if (!parentId || !schoolId || !startTimeRef.current) return;
    void saveExamDraft({
      exam_id: exam.id,
      student_id: studentId,
      parent_id: parentId,
      school_id: schoolId,
      answers: answersRef.current,
      current_question_index: currentQRef.current,
      tab_switches_count: tabSwitchCountRef.current,
      started_at: draftStartedAtRef.current,
    });
  }, [exam.id, studentId, parentId, schoolId]);

  // ── استرجاع الاختبار الجاري (من السيرفر أولاً ثم من النسخة المحلية) ─────────
  useEffect(() => {
    let cancelled = false;

    const applyRestore = (
      startMs: number,
      restoredAnswers: Record<string, string>,
      restoredQ: number,
      restoredTabSwitches: number,
      startedAtIso: string,
    ) => {
      startTimeRef.current = startMs;
      draftStartedAtRef.current = startedAtIso;
      answersRef.current = restoredAnswers;
      setAnswers(restoredAnswers);
      currentQRef.current = restoredQ;
      setCurrentQ(restoredQ);
      tabSwitchCountRef.current = restoredTabSwitches;
      setTabSwitchCount(restoredTabSwitches);
      setTimeLeft(Math.max(0, exam.duration_minutes * 60 - Math.floor((Date.now() - startMs) / 1000)));
      setScreen('taking');
    };

    const restore = async () => {
      // 1) النسخة المحلية — أحدث الإجابات دائماً (تُكتب لحظياً مع كل ضغطة)
      let localAnswers: Record<string, string> = {};
      let localStartMs = 0;
      let localStartedAt = '';
      let localQ = 0;
      let localTabSwitches = 0;
      let localValid = false;
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed?.startTime && parsed.answers && typeof parsed.answers === 'object') {
            localStartMs = parsed.startTime;
            localStartedAt = parsed.startedAt || new Date(parsed.startTime).toISOString();
            localAnswers = parsed.answers;
            localQ = typeof parsed.currentQ === 'number' ? parsed.currentQ : 0;
            localTabSwitches = parsed.tabSwitchCount || 0;
            localValid = (exam.duration_minutes * 60 - Math.floor((Date.now() - localStartMs) / 1000)) > 5;
          }
          if (!localValid) localStorage.removeItem(storageKey);
        }
      } catch {
        // نسخة محلية تالفة — نتجاهلها ونكمل من السيرفر
      }

      // 2) مسودة السيرفر — المرجع الحقيقي لوقت البداية (يُحسم عند تغيير الجهاز)
      let draft = null as Awaited<ReturnType<typeof fetchExamDraft>>;
      try {
        draft = await fetchExamDraft(exam.id, studentId);
      } catch {
        draft = null;
      }
      if (cancelled || startTimeRef.current !== 0) return; // الطالب بدأ يدوياً بالفعل

      if (draft) {
        const draftStartMs = new Date(draft.started_at).getTime();
        if (!Number.isNaN(draftStartMs)) {
          // دمج الإجابات: المحلية تتقدّم لأنها الأحدث، والمسودة تغطي ما لم يُكتب محلياً
          const merged = { ...draft.answers, ...localAnswers };
          const hasMergedAnswers = Object.keys(merged).length > 0;
          applyRestore(
            draftStartMs,
            merged,
            hasMergedAnswers ? draft.current_question_index : localQ,
            Math.max(draft.tab_switches_count, localTabSwitches),
            draft.started_at,
          );
          persistLocal({ answers: merged });
          toast.info('تم استرجاع إجاباتك ومتابعة الاختبار من حيث توقفت 🔄');
          return;
        }
      }

      if (localValid) {
        applyRestore(localStartMs, localAnswers, localQ, localTabSwitches, localStartedAt);
        toast.info('تم استرجاع إجاباتك ومتابعة الاختبار 🔄');
      }
    };

    void restore();
    return () => { cancelled = true; };
  }, [storageKey, exam.id, studentId, exam.duration_minutes, persistLocal]);

  // Always keep answersRef in sync with latest answers and auto-save locally
  const updateAnswer = useCallback((questionId: string, value: string) => {
    setAnswers(prev => {
      const next = { ...prev, [questionId]: value };
      answersRef.current = next;
      persistLocal({ answers: next });
      return next;
    });
  }, [persistLocal]);

  const navigateToQ = useCallback((idx: number) => {
    currentQRef.current = idx;
    setCurrentQ(idx);
    persistLocal({ currentQ: idx });
  }, [persistLocal]);

  const handleSubmit = useCallback(async (auto = false) => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const startedMs = startTimeRef.current || Date.now();
    const spent = Math.round((Date.now() - startedMs) / 1000);
    // Always use the latest answers from answersRef to prevent stale closure data loss
    const currentAnswers = { ...answersRef.current };

    try {
      const result = await submitAttempt.mutateAsync({
        examId: exam.id,
        studentId,
        answers: currentAnswers,
        timeSpentSeconds: spent,
        questions,
        tabSwitchesCount: tabSwitchCountRef.current,
      });
      // نُنظّف المسودة والنسخة المحلية بعد نجاح التسليم فقط
      try {
        localStorage.removeItem(storageKey);
      } catch {
        // localStorage غير متاح — غير حرج
      }
      // ننتظر الحذف حتى لا تبقى مسودة قديمة تُعيد الطالب للاختبار بعد تسليمه
      await deleteExamDraft(exam.id, studentId);
      setSubmitResult({
        score: result.score,
        totalScore: result.totalScore,
        questions: result.questions,
        answers: currentAnswers,
      });
      setScreen('result');
      if (auto) {
        toast.info('انتهى وقت الاختبار — تم إرسال وتصحيح جميع إجاباتك التي قمت بحلها تلقائياً');
      }
    } catch (err: any) {
      toast.error('حدث خطأ أثناء إرسال الاختبار', { description: err.message });
      isSubmittingRef.current = false;
    }
    setShowEndDialog(false);
  }, [exam.id, studentId, submitAttempt, questions, storageKey]);

  const handleSubmitRef = useRef(handleSubmit);
  useEffect(() => {
    handleSubmitRef.current = handleSubmit;
  }, [handleSubmit]);

  /** يقيس الوقت من الساعة الحقيقية — لا يعتمد على نُقرات setInterval المخنوقة في التاب المخفي */
  const resyncTime = useCallback(() => {
    if (!startTimeRef.current) return;
    const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
    const remaining = Math.max(0, exam.duration_minutes * 60 - elapsed);
    setTimeLeft(remaining);
    if (remaining <= 0) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      handleSubmitRef.current(true);
    }
  }, [exam.duration_minutes]);

  // Timer — الزمن الحقيقي الفعلي وليس عدد النُقرات
  useEffect(() => {
    if (screen !== 'taking') return;
    resyncTime();
    timerRef.current = setInterval(resyncTime, 1000);
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [screen, resyncTime]);

  // Keep Supabase session fresh during the exam so JWT never expires
  useEffect(() => {
    if (screen !== 'taking') return;
    const keepAliveTimer = setInterval(async () => {
      try {
        await supabase.auth.getSession();
      } catch {
        // session check failed — will retry on next interval
      }
    }, 3 * 60 * 1000); // Check/refresh every 3 minutes
    return () => clearInterval(keepAliveTimer);
  }, [screen]);

  // ── حفظ تدريجي دوري أثناء الحل ─────────────────────────────────────────────
  useEffect(() => {
    if (screen !== 'taking') return;
    persistDraft();
    const id = setInterval(persistDraft, DRAFT_AUTOSAVE_MS);
    return () => clearInterval(id);
  }, [screen, persistDraft]);

  // ── Anti-Cheat: رصد مغادرة الشاشة (بدون تسليم تلقائي) ──────────────────────
  useEffect(() => {
    if (screen !== 'taking') return;

    const handleVisibilityChange = () => {
      // Only count true tab/app hidden states, never trigger on keyboard focus / blur
      if (document.visibilityState === 'hidden') {
        tabSwitchCountRef.current += 1;
        const count = tabSwitchCountRef.current;
        setTabSwitchCount(count);
        persistLocal({ tabSwitchCount: count });
        setCheatWarningMsg(
          `⚠️ تنبيه أمني: تم رصد مغادرة شاشة الاختبار! (مخالفة ${count}). يُرجى البقاء في صفحة الاختبار — كل مغادرة تُسجَّل في تقرير النزاهة.`,
        );
        setShowCheatWarning(true);
        // احفظ التقدّم فور مغادرة الشاشة حتى يصمد أمام موت الجهاز أو انقطاع الشبكة
        persistDraft();
      } else {
        // عاد الطالب — أعِد حساب الوقت الحقيقي فوراً (المؤقّت كان مُخنَقاً أثناء الغياب)
        resyncTime();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [screen, persistDraft, persistLocal, resyncTime]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleStart = () => {
    if (isExpired || isNotStarted) return;
    const now = Date.now();
    startTimeRef.current = now;
    draftStartedAtRef.current = new Date(now).toISOString();
    setTimeLeft(exam.duration_minutes * 60);
    answersRef.current = {};
    setAnswers({});
    currentQRef.current = 0;
    setCurrentQ(0);
    isSubmittingRef.current = false;
    tabSwitchCountRef.current = 0;
    setTabSwitchCount(0);
    setShowCheatWarning(false);
    persistLocal({ answers: {}, currentQ: 0, tabSwitchCount: 0 });
    try {
      if (typeof document !== 'undefined' && document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } catch {
      // fullscreen API not available — non-critical
    }
    setScreen('taking');
  };

  return {
    screen,
    setScreen,
    currentQ,
    answers,
    timeLeft,
    showEndDialog,
    setShowEndDialog,
    submitResult,
    tabSwitchCount,
    showCheatWarning,
    setShowCheatWarning,
    cheatWarningMsg,
    questions,
    qLoading,
    isExpired,
    isNotStarted,
    isSubmitting: submitAttempt.isPending,
    formatTime,
    updateAnswer,
    navigateToQ,
    handleStart,
    handleSubmit,
  };
}
