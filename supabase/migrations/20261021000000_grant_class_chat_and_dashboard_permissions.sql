-- ==============================================================================
-- Grant missing permissions for class_chat_rooms, class_chat_messages & RPC functions
-- ==============================================================================

-- 1. Table permissions for class chat
GRANT ALL ON TABLE public.class_chat_rooms TO authenticated, service_role;
GRANT ALL ON TABLE public.class_chat_messages TO authenticated, service_role;

-- Make sure sequences (if any) are also granted
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;

-- 2. Ensure RLS is enabled and policies are permissive for members of the school
ALTER TABLE public.class_chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "class_chat_rooms_school_access" ON public.class_chat_rooms;
CREATE POLICY "class_chat_rooms_school_access" ON public.class_chat_rooms
  FOR ALL TO authenticated
  USING (get_auth_is_super_admin() OR school_id = get_auth_school_id())
  WITH CHECK (get_auth_is_super_admin() OR school_id = get_auth_school_id());

DROP POLICY IF EXISTS "class_chat_messages_access" ON public.class_chat_messages;
CREATE POLICY "class_chat_messages_access" ON public.class_chat_messages
  FOR ALL TO authenticated
  USING (
    get_auth_is_super_admin() 
    OR EXISTS (
      SELECT 1 FROM public.class_chat_rooms r 
      WHERE r.id = room_id AND r.school_id = get_auth_school_id()
    )
  )
  WITH CHECK (
    get_auth_is_super_admin() 
    OR (
      sender_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.class_chat_rooms r 
        WHERE r.id = room_id AND r.school_id = get_auth_school_id()
      )
    )
  );

-- 3. Execute permissions on dashboard & stats RPC functions
DO $$
BEGIN
  -- get_dashboard_stats
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_dashboard_stats') THEN
    GRANT EXECUTE ON FUNCTION public.get_dashboard_stats(uuid, boolean) TO authenticated, service_role;
  END IF;

  -- get_admin_dashboard_activities
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_admin_dashboard_activities') THEN
    GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_activities(uuid, uuid) TO authenticated, service_role;
  END IF;

  -- get_fees_summary
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_fees_summary') THEN
    GRANT EXECUTE ON FUNCTION public.get_fees_summary(uuid) TO authenticated, service_role;
  END IF;
END $$;
