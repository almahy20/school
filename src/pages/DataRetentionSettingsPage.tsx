import { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { 
  useRetentionPolicies, 
  useUpdateRetentionPolicy,
  useTriggerCleanup,
  useDatabaseSizeInfo,
  useCleanupEstimate
} from '@/hooks/queries';
import { 
  Trash2, 
  RefreshCw, 
  HardDrive, 
  Database, 
  TrendingDown, 
  Clock,
  AlertTriangle,
  CheckCircle2,
  BarChart3,
  ShieldCheck
} from 'lucide-react';
import { formatBytes, formatDate } from '@/lib/date-utils';
import PageHeader from '@/components/layout/PageHeader';

export default function DataRetentionSettingsPage() {
  const { toast } = useToast();
  const [isCleaning, setIsCleaning] = useState(false);

  // Queries
  const { data: policies, isLoading: policiesLoading } = useRetentionPolicies();
  const { data: dbSize, isLoading: sizeLoading } = useDatabaseSizeInfo();
  const { data: estimate, isLoading: estimateLoading } = useCleanupEstimate();

  // Mutations
  const updatePolicy = useUpdateRetentionPolicy();
  const triggerCleanup = useTriggerCleanup();

  const handleCleanup = async () => {
    setIsCleaning(true);
    try {
      const result = await triggerCleanup.mutateAsync();
      toast({
        title: '✅ تم التنظيف بنجاح',
        description: `تم حذف ${result.total_deleted.toLocaleString()} سجل من ${result.tables_cleaned} جدول`,
      });
    } catch (error: any) {
      toast({
        title: '❌ خطأ',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsCleaning(false);
    }
  };

  const handleTogglePolicy = async (tableName: string, enabled: boolean) => {
    try {
      await updatePolicy.mutateAsync({
        tableName,
        retentionDays: getRetentionPolicy(tableName),
        enabled
      });

      toast({
        title: '✅ تم التحديث',
        description: `تم ${enabled ? 'تفعيل' : 'تعطيل'} سياسة الاحتفاظ لـ ${tableName}`,
      });
    } catch (error: any) {
      toast({
        title: '❌ خطأ',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const getRetentionPolicy = (tableName: string): number | null => {
    const policy = policies?.find(p => p.table_name === tableName);
    if (!policy || !policy.retention_period) return null;
    return parseInt(policy.retention_period.split(' ')[0]);
  };

  const getTotalSize = () => {
    if (!dbSize) return 0;
    return dbSize.reduce((total, table) => {
      const match = table.size.match(/(\d+\.?\d*)\s*(KB|MB|GB)/i);
      if (!match) return total;
      const value = parseFloat(match[1]);
      const unit = match[2].toUpperCase();
      switch (unit) {
        case 'KB': return total + (value * 1024);
        case 'MB': return total + (value * 1024 * 1024);
        case 'GB': return total + (value * 1024 * 1024 * 1024);
        default: return total;
      }
    }, 0);
  };

  const formatSize = (bytes: number) => {
    if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${bytes} B`;
  };

  return (
    <AppLayout>
      <div className="flex flex-col gap-6 md:gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-[1200px] mx-auto text-right pb-10 px-4 md:px-0">
        
        <PageHeader
          icon={Database}
          title="إدارة احتفاظ البيانات"
          subtitle="التحكم في مدة الاحتفاظ بالبيانات وتنظيف قاعدة البيانات بأمان"
          action={
            <Button
              onClick={handleCleanup}
              disabled={isCleaning}
              className="h-12 px-8 rounded-2xl bg-slate-900 text-white font-black text-sm gap-2 hover:bg-indigo-600 transition-all shadow-xl"
            >
              <RefreshCw className={`w-4 h-4 ${isCleaning ? 'animate-spin' : ''}`} />
              {isCleaning ? 'جاري التنظيف...' : 'تشغيل التنظيف'}
            </Button>
          }
        />

        {/* Database Size Overview */}
        <div className="premium-card p-8 space-y-6">
          <div className="flex items-center gap-4 border-b border-slate-50 pb-6">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-sm">
              <HardDrive className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900">حجم قاعدة البيانات</h2>
              <p className="text-xs font-black text-slate-300 uppercase tracking-widest">تحليل استخدام المساحة حسب الجدول</p>
            </div>
          </div>

          {sizeLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin text-indigo-300" />
            </div>
          ) : dbSize && dbSize.length > 0 ? (
            <div className="space-y-4">
              {/* Total Size Banner */}
              <div className="bg-gradient-to-l from-indigo-600 to-indigo-700 p-6 rounded-[32px] flex items-center justify-between text-white shadow-2xl shadow-indigo-200">
                <div>
                  <p className="text-indigo-200 text-xs font-black uppercase tracking-widest mb-1">الحجم الإجمالي للقاعدة</p>
                  <p className="text-4xl font-black">{formatSize(getTotalSize())}</p>
                </div>
                <Database className="w-16 h-16 text-indigo-300/50" />
              </div>

              {/* Table Sizes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {dbSize.map((table) => (
                  <div 
                    key={table.table_name}
                    className="flex items-center justify-between p-5 rounded-2xl bg-slate-50 border border-slate-100 hover:bg-white hover:shadow-sm transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                        <Database className="w-5 h-5 text-indigo-600" />
                      </div>
                      <div>
                        <p className="font-black text-slate-900 capitalize">{table.table_name}</p>
                        <p className="text-xs text-slate-400 font-bold">{table.row_count.toLocaleString()} سجل</p>
                      </div>
                    </div>
                    <div className="text-left">
                      <p className="font-black text-slate-900">{table.size}</p>
                      {table.oldest_record && (
                        <p className="text-xs text-slate-300 font-bold">من {formatDate(table.oldest_record)}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="py-16 text-center">
              <div className="w-16 h-16 rounded-3xl bg-slate-50 flex items-center justify-center text-slate-200 mx-auto mb-4">
                <Database className="w-8 h-8" />
              </div>
              <p className="text-slate-400 font-bold">لا توجد بيانات للعرض</p>
            </div>
          )}
        </div>

        {/* Cleanup Estimate */}
        {estimate && Object.keys(estimate).length > 0 && (
          <div className="premium-card p-8 space-y-6">
            <div className="flex items-center gap-4 border-b border-slate-50 pb-6">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600 shadow-sm">
                <TrendingDown className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-900">تقدير البيانات القابلة للحذف</h2>
                <p className="text-xs font-black text-slate-300 uppercase tracking-widest">عدد السجلات التي سيتم حذفها عند التنظيف</p>
              </div>
            </div>

            <div className="space-y-3">
              {Object.entries(estimate).map(([table, count]) => (
                <div 
                  key={table}
                  className="flex items-center justify-between p-4 rounded-2xl bg-amber-50 border border-amber-100"
                >
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                    <span className="font-black text-slate-900 capitalize">{table}</span>
                  </div>
                  <Badge className="bg-amber-100 text-amber-700 border-none font-black text-xs px-4 py-1.5 rounded-xl">
                    {count.toLocaleString()} سجل
                  </Badge>
                </div>
              ))}
              {/* Expected saving */}
              <div className="flex items-center justify-between p-4 rounded-2xl bg-emerald-50 border border-emerald-100">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span className="font-black text-emerald-800">المساحة المتوقعة للتوفير</span>
                </div>
                <span className="font-black text-emerald-600 text-lg">
                  ~{Math.round(Object.values(estimate).reduce((a, b) => a + b, 0) * 0.001)} MB
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Retention Policies */}
        <div className="premium-card p-8 space-y-6">
          <div className="flex items-center gap-4 border-b border-slate-50 pb-6">
            <div className="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center text-white shadow-sm">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900">سياسات الاحتفاظ بالبيانات</h2>
              <p className="text-xs font-black text-slate-300 uppercase tracking-widest">تحديد مدة الاحتفاظ بكل نوع من البيانات</p>
            </div>
          </div>

          {policiesLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin text-indigo-300" />
            </div>
          ) : policies && policies.length > 0 ? (
            <div className="space-y-3">
              {policies.map((policy) => {
                const days = getRetentionPolicy(policy.table_name);
                return (
                  <div 
                    key={policy.id}
                    className="flex items-center justify-between p-5 rounded-2xl bg-slate-50 border border-slate-100 hover:bg-white hover:shadow-sm transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-11 h-11 rounded-xl bg-indigo-100 flex items-center justify-center">
                        <BarChart3 className="w-5 h-5 text-indigo-600" />
                      </div>
                      <div>
                        <p className="font-black text-slate-900 capitalize">{policy.table_name}</p>
                        <p className="text-xs text-slate-400 font-bold">{policy.description}</p>
                        {days ? (
                          <p className="text-xs text-indigo-600 font-black mt-0.5">{days} يوم</p>
                        ) : (
                          <p className="text-xs text-emerald-600 font-black mt-0.5">محفوظ دائماً</p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-black text-slate-400 uppercase tracking-widest">
                        {policy.enabled ? 'مفعّل' : 'معطّل'}
                      </span>
                      <Switch
                        checked={policy.enabled}
                        onCheckedChange={(checked) => handleTogglePolicy(policy.table_name, checked)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-center text-slate-400 font-bold py-12">لا توجد سياسات مُعرَّفة</p>
          )}
        </div>

        {/* Warning Banner */}
        <div className="flex items-start gap-5 p-6 rounded-[32px] bg-amber-50 border border-amber-100">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-black text-amber-900 mb-1">تنبيه مهم قبل التنظيف</h3>
            <p className="text-sm text-amber-700 font-medium leading-relaxed">
              حذف البيانات نهائي ولا يمكن التراجع عنه. تأكد من عمل نسخة احتياطية قبل تشغيل التنظيف.
              البيانات المهمة مثل الدرجات والمدفوعات محفوظة دائماً ولا تُحذف.
            </p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
