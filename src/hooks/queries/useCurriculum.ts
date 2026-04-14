import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Curriculum {
  id: string;
  name: string;
  status: string;
  school_id: string;
  created_at?: string;
}

export interface CurriculumSubject {
  id: string;
  curriculum_id: string;
  subject_name: string;
  content: string | null;
}

export function useCurriculums() {
  const { user } = useAuth();
  const queryKey = ['curriculums', user?.schoolId];
  
  return useQuery({
    queryKey,
    queryFn: async () => {
      if (!user?.schoolId) return [];
      const { data, error } = await supabase
        .from('curriculums')
        .select('*')
        .eq('school_id', user.schoolId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as Curriculum[];
    },
    enabled: !!user?.schoolId,
    staleTime: 2 * 60 * 1000, // ⚡ 2 minutes (was 5m) - المناهج لا تتغير كثيراً
    gcTime: 5 * 60 * 1000, // ⚡ 5 minutes
            refetchOnMount: true,
    placeholderData: keepPreviousData,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(500 * 2 ** attemptIndex, 5000),
  });
}

export function useCurriculumSubjects(curriculumId: string | null) {
  const queryKey = ['curriculum-subjects', curriculumId];
  
  return useQuery({
    queryKey,
    queryFn: async () => {
      if (!curriculumId) return [];
      const { data, error } = await supabase
        .from('curriculum_subjects')
        .select('*')
        .eq('curriculum_id', curriculumId)
        .order('subject_name', { ascending: true });
      if (error) throw error;
      return data as CurriculumSubject[];
    },
    enabled: !!curriculumId,
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
}

export function useUpsertCurriculum() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (curriculum: { id?: string; name: string; status?: string }) => {
      const { data, error } = await supabase
        .from('curriculums')
        .upsert({ ...curriculum, school_id: user?.schoolId as string })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['curriculums', user?.schoolId] });
    },
  });
}

export function useDeleteCurriculum() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('curriculums').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['curriculums', user?.schoolId] });
    },
  });
}

export function useUpsertSubject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (subject: { id?: string; curriculum_id: string; subject_name: string; content?: string | null }) => {
      const { data, error } = await supabase
        .from('curriculum_subjects')
        .upsert(subject)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['curriculum-subjects', data.curriculum_id] });
    },
  });
}

export function useDeleteSubject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, curriculumId }: { id: string, curriculumId: string }) => {
      const { error } = await supabase.from('curriculum_subjects').delete().eq('id', id);
      if (error) throw error;
      return { curriculumId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['curriculum-subjects', data.curriculumId] });
    },
  });
}

export function useAssignCurriculumToClass() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ classId, curriculumId }: { classId: string, curriculumId: string | null }) => {
      const { error } = await supabase
        .from('classes')
        .update({ curriculum_id: curriculumId })
        .eq('id', classId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes', user?.schoolId] });
    },
  });
}
