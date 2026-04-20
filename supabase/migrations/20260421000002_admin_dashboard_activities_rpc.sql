-- ═══════════════════════════════════════════════════
-- ADMIN DASHBOARD ACTIVITIES RPC
-- ═══════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_admin_dashboard_activities(p_school_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- ✅ Security Check: Ensure the caller is an admin of this school
  IF NOT EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() AND role = 'admin' AND school_id = p_school_id
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  RETURN (
    SELECT jsonb_agg(row_to_json(combined))
    FROM (
      -- 1. Recent Complaints
      SELECT * FROM (
        SELECT 
          id, 
          'complaint' as type,
          'شكوى جديدة' as title,
          CASE WHEN length(content) > 60 THEN substring(content from 1 for 60) || '...' ELSE content END as description,
          created_at as date,
          status
        FROM complaints
        WHERE school_id = p_school_id
        ORDER BY created_at DESC
        LIMIT 5
      ) c
      
      UNION ALL
      
      -- 2. Pending Registrations
      SELECT * FROM (
        SELECT 
          ur.id,
          'registration' as type,
          'طلب انضمام جديد' as title,
          'المستخدم: ' || COALESCE(p.full_name, 'غير معروف') as description,
          ur.created_at as date,
          ur.approval_status as status
        FROM user_roles ur
        LEFT JOIN profiles p ON p.id = ur.user_id
        WHERE ur.school_id = p_school_id 
          AND ur.approval_status = 'pending'
        ORDER BY ur.created_at DESC
        LIMIT 5
      ) r
      
      UNION ALL
      
      -- 3. Recent Payments
      SELECT * FROM (
        SELECT 
          fp.id,
          'payment' as type,
          'تم دفع رسوم' as title,
          'المبلغ: ' || fp.amount || ' ج.م للطالب ' || COALESCE(s.name, 'غير معروف') as description,
          fp.payment_date as date,
          'success' as status
        FROM fee_payments fp
        JOIN fees f ON f.id = fp.fee_id
        JOIN students s ON s.id = f.student_id
        WHERE fp.school_id = p_school_id
        ORDER BY fp.payment_date DESC
        LIMIT 5
      ) pay
      
      ORDER BY date DESC
      LIMIT 10
    ) combined
  );
END;
$$;
