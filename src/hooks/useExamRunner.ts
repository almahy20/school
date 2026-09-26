import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  useExamQuestions,
  useSubmitExamAttempt,
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

export function useExamRunner({ exam, studentId }: UseExamRunnerParams) {
  const [screen, setScreen] = useState<ExamScreen>('confirm');
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState(exam.duration_minutes * 60);
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const answersRef = useRef<Record<string, string>>({});
  const isSubmittingRef = useRef<boolean>(false);

  // ── Anti-Cheat State ────────────────────────────────────────────────────────
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [showCheatWarning, setShowCheatWarning] = useState(false);
  const [cheatWarningMsg, setCheatWarningMsg] = useState('');
  const tabSwitchCountRef = useRef(0);
  const MAX_TAB_SWITCHES = 3;

  const { data: rawQuestions = [], isLoading: qLoading } = useExamQuestions(exam.id);
  const submitAttempt = useSubmitExamAttempt();

  // Shuffle questions and options deterministically per student
  const questions = useMemo(() => {
    if (rawQuestions.length === 0) return rawQuestions;
    const seed = `${exam.id}-${studentId}`;
    return seededShuffle(rawQuestions, seed).map(q => {
      if (q.question_type === 'multiple_choice' && Array.isArray(q.options)) {
        return { ...q, options: seededShuffle(q.options as string[], seed + q.id) };
      }
      return q;
    });
  }, [rawQuestions, exam.id, studentId]);

  const isExpired = exam.available_until ? new Date() > new Date(exam.available_until) : false;
  const isNotStarted = exam.available_from ? new Date() < new Date(exam.available_from) : false;

  const storageKey = `exam_progress_${exam.id}_${studentId}`;

  // Restore active session on page reload if exam is still in progress
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        const spent = Math.floor((Date.now() - parsed.startTime) / 1000);
        const remaining = (exam.duration_minutes * 60) - spent;
        if (remaining > 5 && parsed.answers) {
          startTimeRef.current = parsed.startTime;
          setTimeLeft(remaining);
          answersRef.current = parsed.answers;
          setAnswers(parsed.answers);
          if (typeof parsed.currentQ === 'number' && parsed.currentQ >= 0) {
            setCurrentQ(parsed.currentQ);
          }
          if (parsed.tabSwitchCount) {
            tabSwitchCountRef.current = parsed.tabSwitchCount;
            setTabSwitchCount(parsed.tabSwitchCount);
          }
          setScreen('taking');
          toast.info('تم استعادة إجاباتك ومتابعة الاختبار 🔄');
        } else {
          sessionStorage.removeItem(storageKey);
        }
      }
    } catch {
      // sessionStorage unavailable or corrupted — start fresh
    }
  }, [storageKey, exam.duration_minutes]);

  // Always keep answersRef in sync with latest answers and auto-save
  const updateAnswer = useCallback((questionId: string, value: string) => {
    setAnswers(prev => {
      const next = { ...prev, [questionId]: value };
      answersRef.current = next;
      try {
        sessionStorage.setItem(storageKey, JSON.stringify({
          startTime: startTimeRef.current,
          answers: next,
          currentQ,
          tabSwitchCount: tabSwitchCountRef.current,
        }));
      } catch {
        // sessionStorage write failed — non-critical
      }
      return next;
    });
  }, [storageKey, currentQ]);

  // Update currentQ in storage on change
  const navigateToQ = useCallback((idx: number) => {
    setCurrentQ(idx);
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        sessionStorage.setItem(storageKey, JSON.stringify({
          ...parsed,
          currentQ: idx,
        }));
      }
    } catch {
      // sessionStorage unavailable — non-critical
    }
  }, [storageKey]);

  const handleSubmit = useCallback(async (auto = false) => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    if (timerRef.current) clearInterval(timerRef.current);

    const spent = Math.round((Date.now() - startTimeRef.current) / 1000);
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
      try {
        sessionStorage.removeItem(storageKey);
      } catch {
        // sessionStorage unavailable — non-critical
      }
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

  // Timer
  useEffect(() => {
    if (screen !== 'taking') return;
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          handleSubmitRef.current(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [screen]);

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

  // ── Anti-Cheat: Visibility change detection only (safe for mobile) ────────
  useEffect(() => {
    if (screen !== 'taking') return;

    const handleVisibilityChange = () => {
      // Only count true tab/app hidden states, never trigger on keyboard focus / blur
      if (document.visibilityState === 'hidden') {
        tabSwitchCountRef.current += 1;
        const count = tabSwitchCountRef.current;
        setTabSwitchCount(count);

        if (count >= MAX_TAB_SWITCHES) {
          toast.error('⚠️ تم رصد مغادرة متكررة لشاشة الاختبار — سيتم تسليم الاختبار تلقائياً!');
          handleSubmitRef.current(true);
        } else {
          const remaining = MAX_TAB_SWITCHES - count;
          setCheatWarningMsg(`⚠️ تنبيه أمني: تم رصد مغادرة شاشة الاختبار! (مخالفة ${count} من ${MAX_TAB_SWITCHES}). يرجى البقاء في صفحة الاختبار.`);
          setShowCheatWarning(true);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [screen]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleStart = () => {
    if (isExpired || isNotStarted) return;
    const now = Date.now();
    startTimeRef.current = now;
    setTimeLeft(exam.duration_minutes * 60);
    answersRef.current = {};
    setAnswers({});
    setCurrentQ(0);
    isSubmittingRef.current = false;
    tabSwitchCountRef.current = 0;
    setTabSwitchCount(0);
    setShowCheatWarning(false);
    try {
      sessionStorage.setItem(storageKey, JSON.stringify({
        startTime: now,
        answers: {},
        currentQ: 0,
        tabSwitchCount: 0,
      }));
    } catch {
      // sessionStorage unavailable — non-critical
    }
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
