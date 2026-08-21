import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

interface AndroidBatteryGuideSheetProps {
  open: boolean;
  onDismiss: (permanent: boolean) => void;
}

interface OemPath {
  brand: string;
  steps: string;
}

const oemPaths: OemPath[] = [
  {
    brand: "Samsung",
    steps:
      "الإعدادات ← العناية بالجهاز ← البطارية ← التطبيقات التي لا تنام أبداً ← أضف التطبيق",
  },
  {
    brand: "Xiaomi / MIUI",
    steps:
      "الإعدادات ← التطبيقات ← إدارة التطبيقات ← [اسم التطبيق] ← توفير البطارية ← بلا قيود",
  },
  {
    brand: "Huawei / EMUI",
    steps:
      "الإعدادات ← البطارية ← تشغيل التطبيق ← الإدارة اليدوية",
  },
  {
    brand: "عام (Android)",
    steps:
      "الإعدادات ← التطبيقات ← [اسم التطبيق] ← البطارية ← غير مقيّد",
  },
];

export function AndroidBatteryGuideSheet({
  open,
  onDismiss,
}: AndroidBatteryGuideSheetProps) {
  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onDismiss(false)}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl" dir="rtl">
        <SheetHeader className="text-right mb-4">
          <SheetTitle className="text-lg font-bold">
            تحسين استقبال الإشعارات
          </SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">
            بعض أجهزة Android تحتاج إعداداً إضافياً لضمان وصول الإشعارات حتى
            في وضع الخلفية
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 mb-6">
          {oemPaths.map(({ brand, steps }) => (
            <div
              key={brand}
              className="rounded-lg border bg-muted/40 p-3 text-right"
            >
              <p className="font-semibold text-sm mb-1">{brand}</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {steps}
              </p>
            </div>
          ))}
        </div>

        <SheetFooter className="flex flex-col gap-2 sm:flex-col">
          <Button className="w-full" onClick={() => onDismiss(false)}>
            فهمت، شكراً
          </Button>
          <Button
            variant="ghost"
            className="w-full text-muted-foreground"
            onClick={() => onDismiss(true)}
          >
            لا تسألني مجدداً
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export default AndroidBatteryGuideSheet;
