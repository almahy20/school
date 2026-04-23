-- 20260424000004_create_audit_logs.sql
-- نظام سجل العمليات (Audit Logs) لمراقبة التحركات الحساسة في النظام

-- 1. إنشاء جدول سجل العمليات
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL, -- مثال: 'UPDATE_GRADE', 'DELETE_STUDENT', 'MARK_ATTENDANCE'
    entity_type TEXT NOT NULL, -- مثال: 'grades', 'students', 'attendance'
    entity_id UUID,
    details TEXT,
    old_data JSONB,
    new_data JSONB,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 2. تفعيل الأمن (RLS)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- المشرف العام (Super Admin) يرى كل شيء
CREATE POLICY "Super admins can see all logs"
    ON public.audit_logs
    FOR SELECT
    USING (public.is_super_admin());

-- مدير المدرسة يرى سجلات مدرسته فقط
CREATE POLICY "Admins can see their school logs"
    ON public.audit_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_roles.user_id = auth.uid()
            AND user_roles.role = 'admin'
            AND user_roles.school_id = audit_logs.school_id
        )
    );

-- السماح للمستخدمين الموثقين بإضافة سجلات (عبر الدوال أو التطبيق)
CREATE POLICY "Authenticated users can insert logs"
    ON public.audit_logs
    FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- 3. دالة مساعدة لتسجيل العمليات بسهولة من الـ Frontend أو الـ Database Triggers
CREATE OR REPLACE FUNCTION public.log_action(
    p_action TEXT,
    p_entity_type TEXT,
    p_entity_id UUID DEFAULT NULL,
    p_details TEXT DEFAULT NULL,
    p_old_data JSONB DEFAULT NULL,
    p_new_data JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_log_id UUID;
    v_school_id UUID;
BEGIN
    -- جلب معرف المدرسة للمستخدم الحالي
    SELECT school_id INTO v_school_id FROM public.profiles WHERE id = auth.uid();

    INSERT INTO public.audit_logs (
        school_id,
        user_id,
        action,
        entity_type,
        entity_id,
        details,
        old_data,
        new_data
    )
    VALUES (
        v_school_id,
        auth.uid(),
        p_action,
        p_entity_type,
        p_entity_id,
        p_details,
        p_old_data,
        p_new_data
    )
    RETURNING id INTO v_log_id;

    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. إضافة فهارس لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_audit_logs_school_id ON public.audit_logs(school_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);

-- 5. تحديث الكاش
NOTIFY pgrst, 'reload schema';
