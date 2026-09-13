import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Bell, BellRing, Clock, Send, CheckCircle2, 
  AlertTriangle, AlertCircle, Copy, Check, Loader2, Sparkles, X
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface NotificationSettingsCardProps {
  permission: NotificationPermission;
  isSubscribed: boolean;
  onSubscribe: () => Promise<boolean>;
  onUnsubscribe: () => Promise<void>;
  onTestPush?: () => Promise<void>;
  onDelayedPush?: (seconds: number) => void;
  onCancelDelayedPush?: () => void;
  isTesting?: boolean;
  countdown?: number | null;
  userId?: string;
}

// ─── Browser Detection ───────────────────────────────────────────────────────

function detectBrowser(): 'chrome' | 'safari' | 'firefox' | 'other' {
  const ua = navigator.userAgent;
  if (/Chrome/.test(ua) && !/Edg/.test(ua)) return 'chrome';
  if (/Safari/.test(ua) && !/Chrome/.test(ua)) return 'safari';
  if (/Firefox/.test(ua)) return 'firefox';
  return 'other';
}

// ─── Unblock Instructions per Browser ────────────────────────────────────────

const UNBLOCK_INSTRUCTIONS: Record<ReturnType<typeof detectBrowser>, string> = {
  chrome:
    'افتح إعدادات المتصفح ← الخصوصية والأمان ← إعدادات الموقع ← الإشعارات ← ابحث عن هذا الموقع وأزل الحظر',
  safari:
    'افتح إعدادات Safari ← مواقع الويب ← الإشعارات ← ابحث عن هذا الموقع وغيّر الإذن',
  firefox:
    'انقر على أيقونة القفل في شريط العنوان ← إذونات الاتصال ← الإشعارات ← أزل الحظر',
  other:
    'افتح إعدادات المتصفح وابحث عن إعدادات الإشعارات لهذا الموقع',
};

// ─── Component ───────────────────────────────────────────────────────────────

export function NotificationSettingsCard({
  permission,
  isSubscribed,
  onSubscribe,
  onUnsubscribe,
  onTestPush,
  onDelayedPush,
  onCancelDelayedPush,
  isTesting = false,
  countdown = null,
  userId,
}: NotificationSettingsCardProps) {
  const [loading, setLoading] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      await onSubscribe();
    } finally {
      setLoading(false);
    }
  };

  const handleUnsubscribe = async () => {
    setLoading(true);
    try {
      await onUnsubscribe();
    } finally {
      setLoading(false);
    }
  };

  const sqlSnippet = userId 
    ? `INSERT INTO public.notifications (user_id, title, message, type)
VALUES ('${userId}', 'إشعار تجريبي 🚀', 'وصلك الإشعار بنجاح حتى والتطبيق مغلق تماماً!', 'general');`
    : '';

  const handleCopySql = () => {
    if (!sqlSnippet) return;
    navigator.clipboard.writeText(sqlSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // ── State: granted + subscribed ──────────────────────────────────────────
  if (permission === 'granted' && isSubscribed) {
    return (
      <Card className="border border-slate-200/80 dark:border-slate-800 shadow-xl shadow-slate-100/50 dark:shadow-none rounded-[36px] overflow-hidden bg-white dark:bg-slate-900 transition-all">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <BellRing className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <CardTitle className="text-lg font-black text-slate-900 dark:text-white">إشعارات الجوال والنظام</CardTitle>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">جهازك متصل ومسجل لاستقبال الإشعارات اللحظية</p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/30 px-3 py-1 text-xs font-bold gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                الإشعارات مفعّلة
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleUnsubscribe}
                disabled={loading || isTesting || countdown !== null}
                className="text-xs text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl"
              >
                تعطيل
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pt-2">
          {/* Active Countdown Banner */}
          {countdown !== null && (
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-amber-500 to-orange-500 text-white p-6 shadow-lg shadow-amber-500/20 animate-in fade-in zoom-in duration-300">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-right">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0 text-3xl font-black">
                    {countdown}
                  </div>
                  <div>
                    <h4 className="text-base font-black flex items-center justify-center sm:justify-start gap-2">
                      <Clock className="w-5 h-5 animate-spin" />
                      العد التنازلي نشط! أغلِق التطبيق الآن
                    </h4>
                    <p className="text-xs text-amber-100 font-medium mt-1">
                      قم بالخروج من المتصفح أو قفل شاشة الهاتف فوراً. سيتم إرسال الإشعار تلقائياً بعد انتهاء الوقت!
                    </p>
                  </div>
                </div>

                {onCancelDelayedPush && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onCancelDelayedPush}
                    className="bg-white/10 hover:bg-white/20 text-white border-white/30 rounded-xl text-xs font-bold gap-1 cursor-pointer shrink-0"
                  >
                    <X className="w-4 h-4" />
                    إلغاء المؤقت
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Test Action Box */}
          <div className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-500" />
                <h4 className="text-sm font-black text-slate-900 dark:text-white">أدوات اختبار وصول الإشعار</h4>
              </div>
              <span className="text-[10px] text-slate-400 font-medium">اختر طريقة الاختبار</span>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              تأكد من أن جهازك يستقبل التنبيه والصوت بنجاح سواء وأنت تستخدم المنصة أو والتطبيق مغلق تماماً:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {/* Test Button 1: Immediate */}
              <Button
                onClick={onTestPush}
                disabled={loading || isTesting || countdown !== null}
                className="h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs gap-2 shadow-md shadow-indigo-600/15 transition-all hover:scale-[1.02] active:scale-98 cursor-pointer"
              >
                {isTesting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                إرسال إشعار فوري (تجربة الآن)
              </Button>

              {/* Test Button 2: 10s Delay */}
              <Button
                onClick={() => onDelayedPush && onDelayedPush(10)}
                disabled={loading || isTesting || countdown !== null}
                variant="outline"
                className="h-12 rounded-2xl border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-xs gap-2 transition-all hover:scale-[1.02] active:scale-98 cursor-pointer"
              >
                <Clock className="w-4 h-4 text-amber-500" />
                إرسال بعد 10 ثوانٍ (لقفل التطبيق)
              </Button>
            </div>
          </div>

          {/* Tips for closed app testing */}
          <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100/80 dark:border-indigo-900/30 text-xs text-slate-600 dark:text-slate-400 space-y-2">
            <div className="flex items-center gap-2 font-bold text-indigo-700 dark:text-indigo-400">
              <Bell className="w-4 h-4" />
              <span>نصائح مهمة لاختبار وصول الإشعار والتطبيق مغلق:</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-500 dark:text-slate-400 pr-1 leading-relaxed">
              <li>
                <strong>على هواتف أندرويد:</strong> اضغط على زر "إرسال بعد 10 ثوانٍ"، ثم اخرج من المتصفح واقفل شاشة الهاتف فوراً؛ ستسمع رنة الإشعار على الشاشة المقفولة.
              </li>
              <li>
                <strong>على هواتف آيفون (iOS):</strong> يلزم أولاً إضافة التطبيق للشاشة الرئيسية (Share ← Add to Home Screen) وفتحه من هناك.
              </li>
              <li>
                <strong>على الكمبيوتر (Windows/Mac):</strong> سيظهر الإشعار في مركز الإشعارات الجانبي للنظام حتى لو كانت صفحة الموقع مغلقة.
              </li>
            </ul>

            {/* Direct SQL Trigger Option */}
            {sqlSnippet && (
              <div className="pt-2 border-t border-indigo-100 dark:border-indigo-900/40 mt-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-slate-500">
                    أو أرسل لنفسك من لوحة Supabase SQL مباشرة وأنت غير فاتح للتطبيق:
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleCopySql}
                    className="h-7 px-2.5 rounded-lg text-[10px] font-bold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-100/50 gap-1"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" />
                        تم النسخ
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        نسخ كود SQL
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── State: granted + not subscribed ─────────────────────────────────────
  if (permission === 'granted' && !isSubscribed) {
    return (
      <Card className="border border-amber-200/80 dark:border-amber-900/40 rounded-[36px] bg-amber-50/30 dark:bg-amber-950/10">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <CardTitle className="text-base font-black text-slate-900 dark:text-white">إشعارات الجوال</CardTitle>
              <p className="text-xs text-slate-500 dark:text-slate-400">إذن الإشعارات ممنوح لكن الجهاز غير مسجل حالياً</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 font-bold">
              ⚠ يجب إعادة التسجيل
            </Badge>
          </div>
          <Button
            size="sm"
            onClick={handleSubscribe}
            disabled={loading}
            className="w-full sm:w-auto h-11 px-6 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs gap-2 cursor-pointer"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
            تفعيل وتسجيل الجهاز
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ── State: denied ────────────────────────────────────────────────────────
  if (permission === 'denied') {
    const browser = detectBrowser();
    const instructions = UNBLOCK_INSTRUCTIONS[browser];

    return (
      <Card className="border border-rose-200 dark:border-rose-900/40 rounded-[36px] bg-rose-50/20 dark:bg-rose-950/10">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <CardTitle className="text-base font-black text-slate-900 dark:text-white">إشعارات الجوال محظورة</CardTitle>
              <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">تم حظر إذن الإشعارات من إعدادات المتصفح</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-2">
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-rose-100 dark:border-rose-900/30 text-xs text-slate-600 dark:text-slate-400 leading-relaxed" dir="rtl">
            <p className="font-bold text-slate-800 dark:text-slate-200 mb-1">خطوات فك الحظر:</p>
            {instructions}
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── State: default (permission not yet requested) ────────────────────────
  return (
    <Card className="border border-slate-200/80 dark:border-slate-800 rounded-[36px] bg-white dark:bg-slate-900">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Bell className="w-6 h-6" />
          </div>
          <div>
            <CardTitle className="text-base font-black text-slate-900 dark:text-white">إشعارات الجوال والنظام</CardTitle>
            <p className="text-xs text-slate-500 dark:text-slate-400">احصل على إشعارات فورية عن الدرجات، الغياب، والرسائل</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-slate-500 border-slate-300 font-bold">
            ○ الإشعارات غير مفعّلة
          </Badge>
        </div>
        <Button
          size="sm"
          onClick={handleSubscribe}
          disabled={loading}
          className="w-full sm:w-auto h-11 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs gap-2 cursor-pointer"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
          تفعيل الإشعارات الآن
        </Button>
      </CardContent>
    </Card>
  );
}

export default NotificationSettingsCard;
