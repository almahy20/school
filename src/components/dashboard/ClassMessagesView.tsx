import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useClassStudents, useSendMessage } from '@/hooks/queries';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Search, User, Send, Users, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { QueryStateHandler } from '@/components/QueryStateHandler';

interface ClassMessagesViewProps {
  classId: string;
  className: string;
}

export default function ClassMessagesView({ classId, className }: ClassMessagesViewProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [messageContent, setMessageContent] = useState('');
  const [studentParents, setStudentParents] = useState<any[]>([]);
  const [loadingParents, setLoadingParents] = useState(false);

  // Fetch students for this class
  const { data: studentsData, isLoading, error, refetch } = useClassStudents(classId);
  const students = studentsData || [];

  const sendMessageMutation = useSendMessage();

  // Filter students by search
  const filteredStudents = students.filter((s: any) => 
    (s.name || '').toLowerCase().includes((search || '').toLowerCase())
  );

  // Fetch parents for selected student
  const fetchStudentParents = async (studentId: string) => {
    setLoadingParents(true);
    try {
      // Step 1: Get parent_ids from student_parents
      const { data: parentLinks, error: linksError } = await supabase
        .from('student_parents')
        .select('parent_id')
        .eq('student_id', studentId);

      if (linksError) {
        throw linksError;
      }
      
      // If we found links, get parent profiles
      if (parentLinks && parentLinks.length > 0) {
        const parentIds = parentLinks.map(link => link.parent_id);
        
        // Try fetching from profiles first
        let parentProfiles;
        const { data, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', parentIds);

        if (profilesError) {
          // Profiles query failed, will use fallback below
        }
        
        parentProfiles = data;
        
        // If profiles query returned empty, fetch basic info directly
        if (!parentProfiles || parentProfiles.length === 0) {
          // Fallback: create minimal parent objects with IDs only
          parentProfiles = parentIds.map(id => ({
            id: id,
            full_name: 'ولي الأمر'
          }));
        }
        
        setStudentParents(parentProfiles || []);
      } else {
        // No links found - try to find parent by phone number
        const student = students.find((s: any) => s.id === studentId);
        const parentPhone = student?.parent_phone;
        
        if (parentPhone) {
          // Try to find a parent profile with this phone
          const { data: potentialParents, error: phoneError } = await supabase
            .from('profiles')
            .select('id, full_name, phone')
            .eq('phone', parentPhone)
            .limit(1);
          
          if (phoneError) throw phoneError;
          
          if (potentialParents && potentialParents.length > 0) {
            // Found a parent! Create the link
            const parent = potentialParents[0];
            const { error: insertError } = await supabase
              .from('student_parents')
              .insert({
                student_id: studentId,
                parent_id: parent.id,
                school_id: user?.schoolId
              });
            
            if (!insertError) {
              // Link created successfully
              setStudentParents([parent]);
              toast({
                title: 'تم ربط ولي الأمر',
                description: `تم ربط الطالب بولي الأمر: ${parent.full_name}`,
              });
            } else {
              setStudentParents([parent]);
            }
          } else {
            setStudentParents([]);
          }
        } else {
          setStudentParents([]);
        }
      }
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: 'فشل في جلب بيانات أولياء الأمور',
        variant: 'destructive',
      });
    } finally {
      setLoadingParents(false);
    }
  };

  const handleStudentClick = (student: any) => {
    setSelectedStudent(student);
    fetchStudentParents(student.id);
    setMessageContent('');
  };

  const handleSendMessage = async () => {
    if (!messageContent.trim()) {
      toast({ title: 'خطأ', description: 'يرجى كتابة الرسالة', variant: 'destructive' });
      return;
    }

    if (studentParents.length === 0) {
      toast({ title: 'خطأ', description: 'لا يوجد أولياء أمور مرتبطون بهذا الطالب', variant: 'destructive' });
      return;
    }

    try {
      const parentIds = studentParents.map((parent: any) => parent.id);
      
      await sendMessageMutation.mutateAsync({
        targets: parentIds,
        content: messageContent.trim(),
        senderName: user?.fullName || 'المعلم',
        studentId: selectedStudent.id,
      });

      toast({
        title: 'تم الإرسال',
        description: `تم إرسال الرسالة إلى ${parentIds.length} ولي أمر`,
      });

      setMessageContent('');
      setSelectedStudent(null);
      setStudentParents([]);
    } catch (error: any) {
      toast({
        title: 'خطأ في الإرسال',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  // If student is selected, show message composition
  if (selectedStudent) {
    return (
      <div className="space-y-8">
        {/* Back Button */}
        <button
          onClick={() => {
            setSelectedStudent(null);
            setStudentParents([]);
            setMessageContent('');
          }}
          className="flex items-center gap-3 text-slate-600 hover:text-indigo-600 font-bold transition-colors text-lg"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>العودة لقائمة الطلاب</span>
        </button>

        {/* Student Info Card */}
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-8 rounded-[32px] text-white">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center text-2xl font-black">
              {selectedStudent.name?.charAt(0)}
            </div>
            <div>
              <h3 className="text-2xl font-black">{selectedStudent.name}</h3>
              <p className="text-blue-100 text-sm mt-1">{className}</p>
            </div>
          </div>
        </div>

        {/* Parents Info */}
        {loadingParents ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          </div>
        ) : studentParents.length > 0 ? (
          <div className="bg-white p-6 rounded-[24px] border border-slate-100">
            <h4 className="text-sm font-black text-slate-700 mb-4">أولياء الأمور:</h4>
            <div className="flex flex-wrap gap-3">
              {studentParents.map((parent: any) => (
                <Badge key={parent.id} className="bg-emerald-100 text-emerald-700 px-4 py-2 text-sm">
                  <User className="w-3 h-3 ml-1" />
                  {parent.full_name || 'ولي الأمر'}
                </Badge>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-amber-50 border-2 border-amber-200 p-6 rounded-[24px]">
            <p className="text-sm font-bold text-amber-700 mb-2">لا يوجد أولياء أمور مرتبطون بهذا الطالب</p>
            {selectedStudent.parent_phone ? (
              <p className="text-xs text-amber-600">رقم ولي الأمر مسجل: {selectedStudent.parent_phone}</p>
            ) : (
              <p className="text-xs text-amber-600">يرجى إضافة رقم هاتف ولي الأمر من صفحة تفاصيل الطالب أولاً</p>
            )}
          </div>
        )}

        {/* Message Composition */}
        <div className="bg-white p-8 rounded-[32px] border border-slate-100 space-y-6">
          <div>
            <label className="text-sm font-black text-slate-700 mb-3 block">نص الرسالة</label>
            <Textarea
              placeholder="اكتب رسالتك لولي الأمر هنا..."
              value={messageContent}
              onChange={(e) => setMessageContent(e.target.value)}
              className="min-h-[200px] p-6 rounded-2xl bg-slate-50 border-none text-base font-medium resize-none"
            />
          </div>

          <Button
            onClick={handleSendMessage}
            disabled={sendMessageMutation.isPending || studentParents.length === 0}
            className="w-full h-14 rounded-2xl bg-blue-600 text-white font-black text-lg hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sendMessageMutation.isPending ? (
              'جاري الإرسال...'
            ) : studentParents.length === 0 ? (
              'لا يوجد ولي أمر مرتبط'
            ) : (
              <>
                إرسال الرسالة
                <Send className="w-5 h-5 mr-2 rotate-180" />
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  // Show students list
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-8 rounded-[32px] text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center">
              <Users className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-2xl font-black">رسائل لأولياء الأمور</h2>
              <p className="text-blue-100 text-sm mt-1">{className} - اختر طالباً لإرسال رسالة</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <Input
          placeholder="ابحث عن طالب..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-14 pr-14 pl-6 rounded-2xl bg-white border-slate-200 font-bold text-base"
        />
      </div>

      {/* Students Grid */}
      <QueryStateHandler
        loading={isLoading}
        error={error}
        data={students}
        onRetry={refetch}
        loadingMessage="جاري تحميل الطلاب..."
        emptyMessage="لا يوجد طلاب في هذا الفصل"
        isEmpty={filteredStudents.length === 0}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredStudents.map((student: any) => (
            <button
              key={student.id}
              onClick={() => handleStudentClick(student)}
              className="bg-white p-6 rounded-[24px] border-2 border-slate-100 hover:border-blue-200 hover:bg-blue-50/50 transition-all text-right group"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 font-black text-xl group-hover:bg-blue-600 group-hover:text-white transition-all">
                  {student.name?.charAt(0)}
                </div>
                <div className="flex-1">
                  <h3 className="font-black text-slate-900 text-lg">{student.name}</h3>
                  <p className="text-xs text-slate-500 mt-1">انقر لإرسال رسالة لولي الأمر</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </QueryStateHandler>
    </div>
  );
}
