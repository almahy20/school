import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { 
  ArrowRight, School, BookOpen, Award, User, 
  Trash2, Edit2, CalendarCheck
} from 'lucide-react';
import { EditStudentModal } from './StudentsPage';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default function StudentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'curriculum' | 'grades' | 'attendance' | 'info'>('curriculum');
  
  const [student, setStudent] = useState<any>(null);
  const [curriculumSubjects, setCurriculumSubjects] = useState<any[]>([]);
  const [grades, setGrades] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [parentName, setParentName] = useState<string>('لم يتم الربط');
  
  const [classes, setClasses] = useState<any[]>([]);
  const [parents, setParents] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);

  const fetchData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      // Fetch Student with basic class info
      const { data: studentData, error: sErr } = await supabase
        .from('students')
        .select('*, classes:classes!students_class_id_fkey(*)')
        .eq('id', id)
        .single();
      
      if (sErr) throw sErr;

      // Fetch teacher name separately if teacher_id exists
      if (studentData.classes?.teacher_id) {
        const { data: teacherProfile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', studentData.classes.teacher_id)
          .single();
        
        if (teacherProfile) {
          studentData.classes.teacher = { full_name: teacherProfile.full_name };
        }
      }
      
      setStudent(studentData);

      // Fetch Performance Data & Parent Link
      const [{ data: gradesData }, { data: attendanceData }] = await Promise.all([
        supabase.from('grades').select('*').eq('student_id', id).order('created_at', { ascending: false }),
        supabase.from('attendance').select('*').eq('student_id', id).order('date', { ascending: false })
      ]);

      // Separate fetch for parent link to avoid PostgREST relationship issues (400)
      const { data: parentLink } = await supabase
        .from('student_parents')
        .select('parent_id')
        .eq('student_id', id)
        .maybeSingle();

      if (parentLink?.parent_id) {
        const { data: parentProfile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', parentLink.parent_id)
          .single();
        
        if (parentProfile) {
          setParentName(parentProfile.full_name);
        }
      }

      setGrades(gradesData || []);
      setAttendance(attendanceData || []);

      // Fetch Curriculum
      if (studentData.classes?.curriculum_id) {
          const { data: subjectsData } = await supabase.from('curriculum_subjects').select('*').eq('curriculum_id', studentData.classes.curriculum_id);
          setCurriculumSubjects(subjectsData || []);
      }

      if (user?.role === 'admin') {
        const [{ data: classesData }, { data: rolesData }] = await Promise.all([
          supabase.from('classes').select('id, name').eq('school_id', user?.schoolId),
          supabase.from('user_roles').select('user_id').eq('role', 'parent').eq('school_id', user?.schoolId),
        ]);
        
        setClasses(classesData || []);
        
        const parentIds = (rolesData || []).map((r: any) => r.user_id);
        if (parentIds.length > 0) {
          const { data: profilesData } = await supabase
            .from('profiles').select('id, full_name').in('id', parentIds).order('full_name');
          setParents(profilesData || []);
        }
      }
    } catch (error: any) {
      toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
      navigate(user?.role === 'parent' ? '/' : '/students');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id, navigate, toast]);

  const handleDelete = async () => {
    if (!id || !confirm('هل أنت متأكد من حذف هذا الطالب؟')) return;
    const { error } = await supabase.from('students').delete().eq('id', id);
    if (error) { toast({ title: 'خطأ', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'تم الحذف بنجاح' }); navigate('/students');
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex justify-center p-20 text-slate-400">جاري التحميل...</div>
      </AppLayout>
    );
  }

  if (!student) return null;

  return (
    <AppLayout>
      <div className="flex flex-col gap-6 max-w-4xl mx-auto text-right md:pt-4" dir="rtl">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-6 md:p-8 rounded-[32px] border border-slate-100 shadow-sm relative overflow-hidden">
          <div className="flex items-center gap-4 relative z-10">
            <button onClick={() => navigate(user?.role === 'parent' ? '/' : '/students')}
              className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 text-slate-400 hover:text-slate-900 flex items-center justify-center transition-all active:scale-95 shrink-0">
               <ArrowRight className="w-5 h-5" />
            </button>
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-sm shrink-0 font-black text-2xl">
               {student.name.trim()[0]}
            </div>
            <div>
               <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight leading-none mb-2">{student.name}</h1>
               <div className="flex items-center gap-2 flex-wrap">
                 <Badge className="bg-indigo-600/5 text-indigo-600 border-none font-black text-[10px] uppercase px-3 py-1 rounded-full">
                    {student.classes?.name || 'غير مسجل بفصل'}
                 </Badge>
               </div>
            </div>
          </div>
          
          {user?.role === 'admin' && (
            <div className="flex items-center gap-2 relative z-10">
              <Button onClick={() => setShowEdit(true)} variant="outline" className="h-10 rounded-xl border-slate-200 text-slate-900 font-bold text-xs gap-2 shrink-0">
                <Edit2 className="w-4 h-4" /> تعديل
              </Button>
              <Button onClick={handleDelete} variant="ghost" className="h-10 w-10 text-rose-600 hover:bg-rose-50 rounded-xl shrink-0 p-0">
                <Trash2 className="w-4.5 h-4.5" />
              </Button>
            </div>
          )}
        </header>

        {/* Tabs */}
        <div className="flex overflow-x-auto hide-scrollbar gap-2 px-2 pb-2">
          {[
            { id: 'curriculum', label: 'المنهج' },
            { id: 'grades', label: 'نتائج المواد' },
            { id: 'attendance', label: 'الحضور' },
            { id: 'info', label: 'معلومات' }
          ].map(tab => (
             <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "px-6 py-3 rounded-full text-xs font-black transition-all whitespace-nowrap",
                  activeTab === tab.id 
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" 
                    : "bg-white text-slate-500 hover:bg-slate-50 border border-slate-100"
                )}
             >
                {tab.label}
             </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="bg-transparent mt-2">
           {activeTab === 'curriculum' && (
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               {curriculumSubjects.length === 0 ? (
                  <div className="col-span-full p-12 text-center text-slate-400 font-bold bg-white rounded-[32px] border border-dashed border-slate-200">
                     لا يوجد محتوى دراسي مسجل
                  </div>
               ) : (
                  curriculumSubjects.map((sub: any) => (
                    <div key={sub.id} className="p-6 bg-white rounded-[24px] border border-slate-100 shadow-sm flex flex-col gap-3">
                       <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                             <BookOpen className="w-4 h-4" />
                          </div>
                          <h3 className="font-black text-slate-900 text-sm">{sub.subject_name}</h3>
                       </div>
                       <div className="bg-slate-50 rounded-xl p-4 text-xs font-bold text-slate-600 leading-relaxed">
                          {sub.content || 'المطلوب غير محدد'}
                       </div>
                    </div>
                  ))
               )}
             </div>
           )}

           {activeTab === 'grades' && (
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               {grades.length === 0 ? (
                  <div className="col-span-full p-12 text-center text-slate-400 font-bold bg-white rounded-[32px] border border-dashed border-slate-200">
                     لا توجد نتائج مسجلة
                  </div>
               ) : (
                  grades.map((grade: any) => (
                    <div key={grade.id} className="p-5 bg-white rounded-[24px] border border-slate-100 shadow-sm flex items-center justify-between">
                       <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
                             <Award className="w-5 h-5" />
                          </div>
                          <div>
                             <h3 className="font-black text-slate-900 text-sm">{grade.subject}</h3>
                             <p className="text-[10px] font-bold text-slate-400">{grade.term || grade.exam_type}</p>
                          </div>
                       </div>
                       <div className="px-4 py-2 bg-slate-50 rounded-lg text-lg font-black text-indigo-600">
                          {grade.score}
                          {!isNaN(Number(grade.score)) && (
                            <span className="text-[10px] text-slate-300 mx-1">/ {grade.max_score}</span>
                          )}
                       </div>
                    </div>
                  ))
               )}
             </div>
           )}

           {activeTab === 'attendance' && (
             <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
                {attendance.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 font-bold">لا يوجد سجل حضور</div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                     {attendance.map((record: any) => (
                       <div 
                         key={record.id} 
                         title={new Date(record.date).toLocaleDateString('ar-EG')}
                         className={cn(
                           "w-10 h-10 rounded-xl border flex items-center justify-center font-bold text-[10px]",
                           record.status === 'present' 
                             ? "bg-emerald-50 border-emerald-100 text-emerald-600" 
                             : record.status === 'late'
                             ? "bg-amber-50 border-amber-100 text-amber-600"
                             : "bg-rose-50 border-rose-100 text-rose-600"
                         )}
                       >
                         {new Date(record.date).getDate()}
                       </div>
                     ))}
                  </div>
                )}
             </div>
           )}

           {activeTab === 'info' && (
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-6 bg-white rounded-[24px] border border-slate-100 shadow-sm flex items-center gap-4">
                   <div className="w-12 h-12 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center shrink-0">
                      <School className="w-6 h-6" />
                   </div>
                   <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase">الصف</p>
                      <p className="text-sm font-black text-slate-900">{student.classes?.name || 'غير محدد'}</p>
                   </div>
                </div>

                <div className="p-6 bg-white rounded-[24px] border border-slate-100 shadow-sm flex items-center gap-4">
                   <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                      <User className="w-6 h-6" />
                   </div>
                   <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase">اسم المعلم</p>
                      <p className="text-sm font-black text-slate-900">{student.classes?.teacher?.full_name || 'غير محدد'}</p>
                   </div>
                </div>
             </div>
           )}
        </div>
      </div>

      {showEdit && (
        <EditStudentModal 
          student={student} 
          classes={classes} 
          parents={parents}
          user={user}
          onClose={() => setShowEdit(false)} 
          onSuccess={() => { setShowEdit(false); fetchData(); }}
        />
      )}
    </AppLayout>
  );
}
