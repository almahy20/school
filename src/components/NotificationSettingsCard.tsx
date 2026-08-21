import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface NotificationSettingsCardProps {
  permission: NotificationPermission;
  isSubscribed: boolean;
  onSubscribe: () => Promise<boolean>;
  onUnsubscribe: () => Promise<void>;
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
}: NotificationSettingsCardProps) {
  const [loading, setLoading] = React.useState(false);

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

  // ── State: granted + subscribed ──────────────────────────────────────────
  if (permission === 'granted' && isSubscribed) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">إشعارات الجوال</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Badge className="bg-green-500 text-white hover:bg-green-600">
              ✓ الإشعارات مفعّلة
            </Badge>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleUnsubscribe}
            disabled={loading}
          >
            تعطيل
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ── State: granted + not subscribed ─────────────────────────────────────
  if (permission === 'granted' && !isSubscribed) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">إشعارات الجوال</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">⚠ يجب إعادة التسجيل</Badge>
          </div>
          <Button
            size="sm"
            onClick={handleSubscribe}
            disabled={loading}
          >
            تفعيل
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
      <Card>
        <CardHeader>
          <CardTitle className="text-base">إشعارات الجوال</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant="destructive">✗ الإشعارات محظورة من المتصفح</Badge>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed" dir="rtl">
            {instructions}
          </p>
        </CardContent>
      </Card>
    );
  }

  // ── State: default (permission not yet requested) ────────────────────────
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">إشعارات الجوال</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Badge variant="outline">○ الإشعارات غير مفعّلة</Badge>
        </div>
        <Button
          size="sm"
          onClick={handleSubscribe}
          disabled={loading}
        >
          تفعيل الآن
        </Button>
      </CardContent>
    </Card>
  );
}

export default NotificationSettingsCard;
