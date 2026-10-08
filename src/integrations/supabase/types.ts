export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      attendance: {
        Row: {
          class_id: string | null
          created_at: string | null
          date: string
          id: string
          notes: string | null
          school_id: string
          status: string
          student_id: string
          teacher_id: string | null
        }
        Insert: {
          class_id?: string | null
          created_at?: string | null
          date?: string
          id?: string
          notes?: string | null
          school_id: string
          status: string
          student_id: string
          teacher_id?: string | null
        }
        Update: {
          class_id?: string | null
          created_at?: string | null
          date?: string
          id?: string
          notes?: string | null
          school_id?: string
          status?: string
          student_id?: string
          teacher_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          details: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          school_id: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          school_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          school_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      class_chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          room_id: string
          sender_id: string
          sender_name: string | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          room_id: string
          sender_id: string
          sender_name?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          room_id?: string
          sender_id?: string
          sender_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "class_chat_messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "class_chat_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      class_chat_rooms: {
        Row: {
          class_id: string
          created_at: string
          id: string
          name: string
          school_id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          id?: string
          name: string
          school_id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
          name?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_chat_rooms_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_chat_rooms_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          created_at: string | null
          curriculum_id: string | null
          grade_level: string | null
          id: string
          name: string
          school_id: string
          teacher_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          curriculum_id?: string | null
          grade_level?: string | null
          id?: string
          name: string
          school_id: string
          teacher_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          curriculum_id?: string | null
          grade_level?: string | null
          id?: string
          name?: string
          school_id?: string
          teacher_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "classes_curriculum_id_fkey"
            columns: ["curriculum_id"]
            isOneToOne: false
            referencedRelation: "curriculums"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string | null
          deleted_at: string | null
          deleted_by_admin: boolean | null
          id: string
          is_read: boolean | null
          sender_id: string
          sender_role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string | null
          deleted_at?: string | null
          deleted_by_admin?: boolean | null
          id?: string
          is_read?: boolean | null
          sender_id: string
          sender_role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string | null
          deleted_at?: string | null
          deleted_by_admin?: boolean | null
          id?: string
          is_read?: boolean | null
          sender_id?: string
          sender_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string | null
          id: string
          last_message_at: string | null
          last_message_preview: string | null
          messages_count: number | null
          parent_id: string
          priority: string
          school_id: string
          status: string
          student_id: string | null
          subject: string
          unread_by_admin: number | null
          unread_by_parent: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          messages_count?: number | null
          parent_id: string
          priority?: string
          school_id: string
          status?: string
          student_id?: string | null
          subject?: string
          unread_by_admin?: number | null
          unread_by_parent?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          messages_count?: number | null
          parent_id?: string
          priority?: string
          school_id?: string
          status?: string
          student_id?: string | null
          subject?: string
          unread_by_admin?: number | null
          unread_by_parent?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      curriculum_subjects: {
        Row: {
          content: string | null
          created_at: string | null
          curriculum_id: string
          description: string | null
          id: string
          school_id: string | null
          subject_name: string
          term: string | null
          updated_at: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          curriculum_id: string
          description?: string | null
          id?: string
          school_id?: string | null
          subject_name: string
          term?: string | null
          updated_at?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          curriculum_id?: string
          description?: string | null
          id?: string
          school_id?: string | null
          subject_name?: string
          term?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "curriculum_subjects_curriculum_id_fkey"
            columns: ["curriculum_id"]
            isOneToOne: false
            referencedRelation: "curriculums"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curriculum_subjects_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      curriculums: {
        Row: {
          created_at: string | null
          id: string
          name: string
          school_id: string
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          school_id: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          school_id?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "curriculums_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      data_retention_policies: {
        Row: {
          created_at: string | null
          description: string | null
          enabled: boolean | null
          id: string
          retention_period: string | null
          table_name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          enabled?: boolean | null
          id?: string
          retention_period?: string | null
          table_name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          enabled?: boolean | null
          id?: string
          retention_period?: string | null
          table_name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      electronic_exams: {
        Row: {
          available_from: string | null
          available_until: string | null
          class_id: string
          created_at: string
          duration_minutes: number
          id: string
          instructions: string | null
          language: string | null
          school_id: string
          status: string
          subject: string
          teacher_id: string
          title: string
          updated_at: string
        }
        Insert: {
          available_from?: string | null
          available_until?: string | null
          class_id: string
          created_at?: string
          duration_minutes: number
          id?: string
          instructions?: string | null
          language?: string | null
          school_id: string
          status?: string
          subject: string
          teacher_id: string
          title: string
          updated_at?: string
        }
        Update: {
          available_from?: string | null
          available_until?: string | null
          class_id?: string
          created_at?: string
          duration_minutes?: number
          id?: string
          instructions?: string | null
          language?: string | null
          school_id?: string
          status?: string
          subject?: string
          teacher_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "electronic_exams_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "electronic_exams_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "electronic_exams_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_attempts: {
        Row: {
          answers: Json
          completed_at: string | null
          exam_id: string
          id: string
          parent_id: string
          score: number
          started_at: string
          student_id: string
          tab_switches_count: number
          time_spent_seconds: number
          total_score: number
        }
        Insert: {
          answers?: Json
          completed_at?: string | null
          exam_id: string
          id?: string
          parent_id: string
          score?: number
          started_at?: string
          student_id: string
          tab_switches_count?: number
          time_spent_seconds?: number
          total_score?: number
        }
        Update: {
          answers?: Json
          completed_at?: string | null
          exam_id?: string
          id?: string
          parent_id?: string
          score?: number
          started_at?: string
          student_id?: string
          tab_switches_count?: number
          time_spent_seconds?: number
          total_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "exam_attempts_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "electronic_exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_attempts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_questions: {
        Row: {
          correct_answer: string
          created_at: string
          exam_id: string
          id: string
          options: Json | null
          order_index: number
          question_text: string
          question_type: string
          school_id: string
        }
        Insert: {
          correct_answer: string
          created_at?: string
          exam_id: string
          id?: string
          options?: Json | null
          order_index?: number
          question_text: string
          question_type: string
          school_id: string
        }
        Update: {
          correct_answer?: string
          created_at?: string
          exam_id?: string
          id?: string
          options?: Json | null
          order_index?: number
          question_text?: string
          question_type?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_questions_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "electronic_exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_questions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_templates: {
        Row: {
          class_id: string | null
          created_at: string | null
          exam_type: string | null
          expected_results: Json | null
          id: string
          max_score: number | null
          school_id: string
          score_type: string
          subject: string
          teacher_id: string | null
          term: string
          title: string
          updated_at: string | null
          weight: number | null
        }
        Insert: {
          class_id?: string | null
          created_at?: string | null
          exam_type?: string | null
          expected_results?: Json | null
          id?: string
          max_score?: number | null
          school_id: string
          score_type?: string
          subject: string
          teacher_id?: string | null
          term: string
          title: string
          updated_at?: string | null
          weight?: number | null
        }
        Update: {
          class_id?: string | null
          created_at?: string | null
          exam_type?: string | null
          expected_results?: Json | null
          id?: string
          max_score?: number | null
          school_id?: string
          score_type?: string
          subject?: string
          teacher_id?: string | null
          term?: string
          title?: string
          updated_at?: string | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "exam_templates_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_templates_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_payments: {
        Row: {
          amount: number
          created_at: string | null
          fee_id: string | null
          id: string
          notes: string | null
          payment_date: string | null
          school_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          fee_id?: string | null
          id?: string
          notes?: string | null
          payment_date?: string | null
          school_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          fee_id?: string | null
          id?: string
          notes?: string | null
          payment_date?: string | null
          school_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fee_payments_fee_id_fkey"
            columns: ["fee_id"]
            isOneToOne: false
            referencedRelation: "fees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_payments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      fees: {
        Row: {
          amount_due: number
          amount_paid: number
          created_at: string | null
          description: string | null
          id: string
          school_id: string | null
          status: string | null
          student_id: string | null
          term: string | null
        }
        Insert: {
          amount_due?: number
          amount_paid?: number
          created_at?: string | null
          description?: string | null
          id?: string
          school_id?: string | null
          status?: string | null
          student_id?: string | null
          term?: string | null
        }
        Update: {
          amount_due?: number
          amount_paid?: number
          created_at?: string | null
          description?: string | null
          id?: string
          school_id?: string | null
          status?: string | null
          student_id?: string | null
          term?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fees_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fees_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      grades: {
        Row: {
          created_at: string | null
          date: string | null
          exam_template_id: string | null
          id: string
          max_score: number | null
          notes: string | null
          school_id: string
          score: string
          student_id: string
          subject: string
          teacher_id: string | null
          term: string | null
        }
        Insert: {
          created_at?: string | null
          date?: string | null
          exam_template_id?: string | null
          id?: string
          max_score?: number | null
          notes?: string | null
          school_id: string
          score: string
          student_id: string
          subject: string
          teacher_id?: string | null
          term?: string | null
        }
        Update: {
          created_at?: string | null
          date?: string | null
          exam_template_id?: string | null
          id?: string
          max_score?: number | null
          notes?: string | null
          school_id?: string
          score?: string
          student_id?: string
          subject?: string
          teacher_id?: string | null
          term?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "grades_exam_template_id_fkey"
            columns: ["exam_template_id"]
            isOneToOne: false
            referencedRelation: "exam_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grades_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grades_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grades_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          created_at: string | null
          id: string
          is_read: boolean | null
          receiver_id: string
          school_id: string
          sender_id: string
          student_id: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          receiver_id: string
          school_id: string
          sender_id: string
          student_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          receiver_id?: string
          school_id?: string
          sender_id?: string
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_delivery_logs: {
        Row: {
          created_at: string
          delivered_at: string
          has_active_subscription: boolean
          id: string
          no_device_registered: boolean
          notification_id: string | null
          raw_response: Json | null
          sent_count: number
          temporary_outage: boolean
          total_subscriptions: number
        }
        Insert: {
          created_at?: string
          delivered_at?: string
          has_active_subscription?: boolean
          id?: string
          no_device_registered?: boolean
          notification_id?: string | null
          raw_response?: Json | null
          sent_count?: number
          temporary_outage?: boolean
          total_subscriptions?: number
        }
        Update: {
          created_at?: string
          delivered_at?: string
          has_active_subscription?: boolean
          id?: string
          no_device_registered?: boolean
          notification_id?: string | null
          raw_response?: Json | null
          sent_count?: number
          temporary_outage?: boolean
          total_subscriptions?: number
        }
        Relationships: [
          {
            foreignKeyName: "notification_delivery_logs_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          content: string | null
          created_at: string | null
          id: string
          is_read: boolean | null
          link: string | null
          message: string
          metadata: Json | null
          school_id: string | null
          title: string
          type: string | null
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          message: string
          metadata?: Json | null
          school_id?: string | null
          title: string
          type?: string | null
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          message?: string
          metadata?: Json | null
          school_id?: string | null
          title?: string
          type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          full_name: string
          id: string
          is_active: boolean | null
          last_seen: string | null
          notification_prefs: Json | null
          phone: string | null
          role: string | null
          school_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          full_name: string
          id: string
          is_active?: boolean | null
          last_seen?: string | null
          notification_prefs?: Json | null
          phone?: string | null
          role?: string | null
          school_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean | null
          last_seen?: string | null
          notification_prefs?: Json | null
          phone?: string | null
          role?: string | null
          school_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      push_delivery_log: {
        Row: {
          error_message: string | null
          has_active_subscription: boolean
          id: string
          no_device_registered: boolean
          notification_id: string | null
          pg_net_request_id: number | null
          queued_at: string
          raw_response: Json | null
          sent_count: number
          target_user_id: string | null
          temporary_outage: boolean
          total_subscriptions: number
          user_id: string | null
        }
        Insert: {
          error_message?: string | null
          has_active_subscription?: boolean
          id?: string
          no_device_registered?: boolean
          notification_id?: string | null
          pg_net_request_id?: number | null
          queued_at?: string
          raw_response?: Json | null
          sent_count?: number
          target_user_id?: string | null
          temporary_outage?: boolean
          total_subscriptions?: number
          user_id?: string | null
        }
        Update: {
          error_message?: string | null
          has_active_subscription?: boolean
          id?: string
          no_device_registered?: boolean
          notification_id?: string | null
          pg_net_request_id?: number | null
          queued_at?: string
          raw_response?: Json | null
          sent_count?: number
          target_user_id?: string | null
          temporary_outage?: boolean
          total_subscriptions?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "push_delivery_log_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          created_at: string | null
          endpoint: string | null
          failure_count: number
          id: string
          last_failure_at: string | null
          last_failure_code: number | null
          last_failure_reason: string | null
          school_id: string | null
          subscription: Json
          updated_at: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          endpoint?: string | null
          failure_count?: number
          id?: string
          last_failure_at?: string | null
          last_failure_code?: number | null
          last_failure_reason?: string | null
          school_id?: string | null
          subscription: Json
          updated_at?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          endpoint?: string | null
          failure_count?: number
          id?: string
          last_failure_at?: string | null
          last_failure_code?: number | null
          last_failure_reason?: string | null
          school_id?: string | null
          subscription?: Json
          updated_at?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      push_trigger_errors: {
        Row: {
          created_at: string
          error_code: string
          error_message: string | null
          id: string
          notification_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          error_code?: string
          error_message?: string | null
          id?: string
          notification_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          error_code?: string
          error_message?: string | null
          id?: string
          notification_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "push_trigger_errors_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      school_orders: {
        Row: {
          admin_name: string
          admin_phone: string
          admin_whatsapp: string | null
          created_at: string
          id: string
          logo_url: string | null
          plan: string
          receipt_note: string | null
          receipt_url: string | null
          rejection_note: string | null
          school_name: string
          school_slug: string
          status: string
          updated_at: string
        }
        Insert: {
          admin_name: string
          admin_phone: string
          admin_whatsapp?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          plan?: string
          receipt_note?: string | null
          receipt_url?: string | null
          rejection_note?: string | null
          school_name: string
          school_slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          admin_name?: string
          admin_phone?: string
          admin_whatsapp?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          plan?: string
          receipt_note?: string | null
          receipt_url?: string | null
          rejection_note?: string | null
          school_name?: string
          school_slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      schools: {
        Row: {
          created_at: string | null
          id: string
          logo_url: string | null
          name: string
          plan: string | null
          settings: Json | null
          slug: string
          status: string
          subscription_end_date: string | null
          subscription_plan: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          logo_url?: string | null
          name: string
          plan?: string | null
          settings?: Json | null
          slug: string
          status?: string
          subscription_end_date?: string | null
          subscription_plan?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          plan?: string | null
          settings?: Json | null
          slug?: string
          status?: string
          subscription_end_date?: string | null
          subscription_plan?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      student_parents: {
        Row: {
          created_at: string | null
          id: string
          parent_id: string
          school_id: string
          student_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          parent_id: string
          school_id: string
          student_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          parent_id?: string
          school_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_parents_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_parents_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_parents_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          address: string | null
          class_id: string | null
          created_at: string | null
          id: string
          monthly_fee: number | null
          name: string
          parent_phone: string | null
          school_id: string
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          class_id?: string | null
          created_at?: string | null
          id?: string
          monthly_fee?: number | null
          name: string
          parent_phone?: string | null
          school_id: string
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          class_id?: string | null
          created_at?: string | null
          id?: string
          monthly_fee?: number | null
          name?: string
          parent_phone?: string | null
          school_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "students_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_attendance: {
        Row: {
          created_at: string | null
          date: string
          id: string
          notes: string | null
          school_id: string
          status: string
          teacher_id: string
        }
        Insert: {
          created_at?: string | null
          date?: string
          id?: string
          notes?: string | null
          school_id: string
          status: string
          teacher_id: string
        }
        Update: {
          created_at?: string | null
          date?: string
          id?: string
          notes?: string | null
          school_id?: string
          status?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_attendance_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_attendance_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          approval_status: string
          created_at: string | null
          id: string
          is_super_admin: boolean | null
          role: string
          school_id: string | null
          user_id: string | null
        }
        Insert: {
          approval_status?: string
          created_at?: string | null
          id?: string
          is_super_admin?: boolean | null
          role: string
          school_id?: string | null
          user_id?: string | null
        }
        Update: {
          approval_status?: string
          created_at?: string | null
          id?: string
          is_super_admin?: boolean | null
          role?: string
          school_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      database_size_info: {
        Row: {
          newest_record: string | null
          oldest_record: string | null
          row_count: number | null
          size: string | null
          table_name: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      claim_school_admin: {
        Args: { new_school_id: string }
        Returns: undefined
      }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      get_admin_dashboard_activities: {
        Args: { p_caller_id?: string; p_school_id: string }
        Returns: Json
      }
      get_auth_is_super_admin: { Args: never; Returns: boolean }
      get_auth_role: { Args: never; Returns: string }
      get_auth_school_id: { Args: never; Returns: string }
      get_child_full_details: {
        Args: { p_school_id?: string; p_student_id: string }
        Returns: Json
      }
      get_class_curriculum_status: {
        Args: { p_class_id: string }
        Returns: {
          content: string
          progress: number
          subject_name: string
        }[]
      }
      get_complete_user_data: { Args: { p_user_id: string }; Returns: Json }
      get_dashboard_stats: {
        Args: { p_is_super_admin: boolean; p_school_id: string }
        Returns: Json
      }
      get_database_row_counts: {
        Args: never
        Returns: {
          row_count: number
          size_estimate: string
          table_name: string
        }[]
      }
      get_fees_summary: {
        Args: { p_class_id?: string; p_school_id: string; p_term?: string }
        Returns: {
          total_due: number
          total_paid: number
        }[]
      }
      get_my_role: { Args: never; Returns: string }
      get_my_school_id: { Args: never; Returns: string }
      get_parent_dashboard_summary: {
        Args: { p_parent_id: string; p_school_id?: string }
        Returns: Json
      }
      get_parent_student_ids: {
        Args: { _parent_id: string }
        Returns: string[]
      }
      get_school_id_by_slug: { Args: { p_slug: string }; Returns: string }
      get_teacher_class_ids: {
        Args: { _teacher_id: string }
        Returns: string[]
      }
      get_teacher_dashboard_stats: {
        Args: { p_school_id: string; p_teacher_id: string }
        Returns: Json
      }
      get_unread_notification_counts: {
        Args: { p_user_id: string }
        Returns: Json
      }
      get_user_role: { Args: { _user_id: string }; Returns: string }
      get_vault_secret: { Args: { p_secret_name: string }; Returns: string }
      has_role: { Args: { _role: string; _user_id: string }; Returns: boolean }
      is_school_admin: { Args: { target_school_id: string }; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      log_action: {
        Args: {
          p_action: string
          p_details?: string
          p_entity_id?: string
          p_entity_type?: string
        }
        Returns: undefined
      }
      normalize_arabic_name: { Args: { p_name: string }; Returns: string }
      normalize_phone: { Args: { phone: string }; Returns: string }
      phones_match: { Args: { p1: string; p2: string }; Returns: boolean }
      recalculate_exam_scores: { Args: { p_exam_id: string }; Returns: Json }
      submit_exam_attempt: {
        Args: {
          p_answers: Json
          p_exam_id: string
          p_parent_id: string
          p_student_id: string
          p_tab_switches_count?: number
          p_time_spent_seconds: number
        }
        Returns: Json
      }
      text_eq_uuid: {
        Args: { p_text: string; p_uuid: string }
        Returns: boolean
      }
      text_ne_uuid: {
        Args: { p_text: string; p_uuid: string }
        Returns: boolean
      }
      trigger_data_cleanup: { Args: never; Returns: Json }
      uuid_eq_text: {
        Args: { p_text: string; p_uuid: string }
        Returns: boolean
      }
      uuid_ne_text: {
        Args: { p_text: string; p_uuid: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "teacher" | "parent" | "super_admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "teacher", "parent", "super_admin"],
    },
  },
} as const
