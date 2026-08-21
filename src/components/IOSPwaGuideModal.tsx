import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface IOSPwaGuideModalProps {
  open: boolean;
  onClose: () => void;
}

export function IOSPwaGuideModal({ open, onClose }: IOSPwaGuideModalProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-sm" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right text-lg font-bold">
            إضافة للشاشة الرئيسية
          </DialogTitle>
          <DialogDescription className="text-right text-sm text-muted-foreground">
            لتفعيل الإشعارات على iPhone/iPad، يجب إضافة التطبيق للشاشة الرئيسية أولاً
          </DialogDescription>
        </DialogHeader>

        <ol className="space-y-3 text-sm text-right" dir="rtl">
          <li className="flex items-start gap-2">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
              ١
            </span>
            <span>
              اضغط على زر المشاركة في Safari (أيقونة المربع مع السهم للأعلى ↑)
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
              ٢
            </span>
            <span>
              اختر "إضافة إلى الشاشة الرئيسية" (Add to Home Screen)
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
              ٣
            </span>
            <span>
              أعد فتح التطبيق من أيقونته على الشاشة الرئيسية
            </span>
          </li>
        </ol>

        <DialogFooter className="sm:justify-start">
          <Button onClick={onClose} className="w-full">
            فهمت
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default IOSPwaGuideModal;
