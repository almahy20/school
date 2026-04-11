import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  BarChart3
} from 'lucide-react';
import { formatBytes, formatDate } from '@/lib/date-utils';

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
    
    // Parse "90 days" -> 90
    return parseInt(policy.retention_period.split(' ')[0]);
  };

  const getTotalSize = () => {
    if (!dbSize) return 0;
    return dbSize.reduce((total, table) => {
      // Parse size string like "730 MB" to bytes
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
    if (bytes >= 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    } else if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    } else if (bytes >= 1024) {
      return `${(bytes / 1024).toFixed(2)} KB`;
    }
    return `${bytes} B`;
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">إدارة احتفاظ البيانات</h1>
          <p className="text-slate-500 mt-1">
            التحكم في مدة الاحتفاظ بالبيانات وتنظيف قاعدة البيانات
          </p>
        </div>
        <Button
          onClick={handleCleanup}
          disabled={isCleaning}
          className="gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${isCleaning ? 'animate-spin' : ''}`} />
          {isCleaning ? 'جاري التنظيف...' : 'تشغيل التنظيف الآن'}
        </Button>
      </div>

      {/* Database Size Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="w-5 h-5" />
            حجم قاعدة البيانات
          </CardTitle>
          <CardDescription>
            تحليل استخدام المساحة حسب الجدول
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sizeLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : dbSize && dbSize.length > 0 ? (
            <div className="space-y-4">
              {/* Total Size */}
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-4 rounded-lg border border-indigo-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600">الحجم الإجمالي</p>
                    <p className="text-3xl font-bold text-indigo-600">
                      {formatSize(getTotalSize())}
                    </p>
                  </div>
                  <Database className="w-12 h-12 text-indigo-300" />
                </div>
              </div>

              {/* Table Sizes */}
              <div className="grid gap-3">
                {dbSize.map((table) => (
                  <div 
                    key={table.table_name}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                        <Database className="w-5 h-5 text-indigo-600" />
                      </div>
                      <div>
                        <p className="font-medium capitalize">{table.table_name}</p>
                        <p className="text-sm text-slate-500">
                          {table.row_count.toLocaleString()} سجل
                        </p>
                      </div>
                    </div>
                    <div className="text-left">
                      <p className="font-semibold">{table.size}</p>
                      {table.oldest_record && (
                        <p className="text-xs text-slate-400">
                          من {formatDate(table.oldest_record)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-center text-slate-500 py-8">لا توجد بيانات</p>
          )}
        </CardContent>
      </Card>

      {/* Cleanup Estimate */}
      {estimate && Object.keys(estimate).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="w-5 h-5" />
              تقدير البيانات القابلة للحذف
            </CardTitle>
            <CardDescription>
              عدد السجلات التي سيتم حذفها عند تشغيل التنظيف
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {Object.entries(estimate).map(([table, count]) => (
                <div 
                  key={table}
                  className="flex items-center justify-between p-3 rounded-lg border bg-amber-50 border-amber-200"
                >
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                    <span className="font-medium capitalize">{table}</span>
                  </div>
                  <Badge variant="secondary">
                    {count.toLocaleString()} سجل
                  </Badge>
                </div>
              ))}
              <div className="p-3 rounded-lg bg-green-50 border border-green-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <span className="font-semibold text-green-700">المساحة المتوقعة للتوفير</span>
                  </div>
                  <span className="text-green-600 font-bold">
                    ~{Math.round(Object.values(estimate).reduce((a, b) => a + b, 0) * 0.001)} MB
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Retention Policies */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            سياسات الاحتفاظ بالبيانات
          </CardTitle>
          <CardDescription>
            تحديد مدة الاحتفاظ بكل نوع من البيانات
          </CardDescription>
        </CardHeader>
        <CardContent>
          {policiesLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : policies && policies.length > 0 ? (
            <div className="space-y-4">
              {policies.map((policy) => {
                const days = getRetentionPolicy(policy.table_name);
                
                return (
                  <div 
                    key={policy.id}
                    className="flex items-center justify-between p-4 rounded-lg border hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg bg-indigo-100 flex items-center justify-center">
                        <BarChart3 className="w-6 h-6 text-indigo-600" />
                      </div>
                      <div>
                        <p className="font-semibold capitalize">{policy.table_name}</p>
                        <p className="text-sm text-slate-500">{policy.description}</p>
                        {days ? (
                          <p className="text-sm text-indigo-600 font-medium mt-1">
                            {days} يوم
                          </p>
                        ) : (
                          <p className="text-sm text-green-600 font-medium mt-1">
                            محفوظ دائماً
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={policy.enabled}
                          onCheckedChange={(checked) => 
                            handleTogglePolicy(policy.table_name, checked)
                          }
                        />
                        <span className="text-sm text-slate-600">
                          {policy.enabled ? 'مفعّل' : 'معطّل'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-center text-slate-500 py-8">لا توجد سياسات</p>
          )}
        </CardContent>
      </Card>

      {/* Warning */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="font-semibold text-amber-800 mb-1">⚠️ تنبيه مهم</h3>
          <p className="text-sm text-amber-700">
            حذف البيانات نهائي ولا يمكن التراجع عنه. تأكد من عمل نسخة احتياطية قبل تشغيل التنظيف.
            البيانات المهمة مثل الدرجات والمدفوعات محفوظة دائماً ولا تُحذف.
          </p>
        </div>
      </div>
    </div>
  );
}
