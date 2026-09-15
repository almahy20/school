export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      schools: {
        Row: {
          id: string
          name: string
          slug: string
          status: string
          plan: string | null
          subscription_plan: string | null
          subscription_end_date: string | null
          logo_url: string | null
          settings: Json | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          name: string
          slug: string
          status?: string
          plan?: string | null
          subscription_plan?: string | null
          subscription_end_date?: string | null
          logo_url?: string | null
          settings?: Json | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          status?: string
          plan?: string | null
          subscription_plan?: string | null
          subscription_end_date?: string | null
          logo_url?: string | null
          settings?: Json | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          full_name: string
          email: string | null
          phone: string | null
          school_id: string | null
          notification_prefs: Json | null
          created_at: string | null
          updated_at: string | null
          last_seen: string | null
          role: string | null
          is_active: boolean | null
        }
        Insert: {
          id: string
          full_name: string
          email?: string | null
          phone?: string | null
          school_id?: string | null
          notification_prefs?: Json | null
          created_at?: string | null
          updated_at?: string | null
          last_seen?: string | null
          role?: string | null
          is_active?: boolean | null
        }
        Update: {
          id?: string
          full_name?: string
          email?: string | null
          phone?: string | null
          school_id?: string | null
          notification_prefs?: Json | null
          created_at?: string | null
          updated_at?: string | null
          last_seen?: string | null
          role?: string | null
          is_active?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: 'profiles_school_id_fkey'
            columns: ['school_id']
            isOneToOne: false
            referencedRelation: 'schools'
            referencedColumns: ['id']
          }
        ]
      }
      user_roles: {
        Row: {
          id: string
          user_id: string | null
          role: string
          school_id: string | null
          is_super_admin: boolean | null
          approval_status: string
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id?: string | null
          role: string
          school_id?: string | null
          is_super_admin?: boolean | null
          approval_status?: string
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string | null
          role?: string
          school_id?: string | null
          is_super_admin?: boolean | null
          approval_status?: string
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'user_roles_school_id_fkey'
            columns: ['school_id']
            isOneToOne: false
            referencedRelation: 'schools'
            referencedColumns: ['id']
          }
        ]
      }
      curriculums: {
        Row: {
          id: string
          school_id: string
          name: string
          status: string
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          school_id: string
          name: string
          status?: string
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          school_id?: string
          name?: string
          status?: string
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'curriculums_school_id_fkey'
            columns: ['school_id']
            isOneToOne: false
            referencedRelation: 'schools'
            referencedColumns: ['id']
          }
        ]
      }
      curriculum_subjects: {
        Row: {
          id: string
          curriculum_id: string
          subject_name: string
          description: string | null
          content: string | null
          term: string | null
          created_at: string | null
          updated_at: string | null
          school_id: string | null
        }
        Insert: {
          id?: string
          curriculum_id: string
          subject_name: string
          description?: string | null
          content?: string | null
          term?: string | null
          created_at?: string | null
          updated_at?: string | null
          school_id?: string | null
        }
        Update: {
          id?: string
          curriculum_id?: string
          subject_name?: string
          description?: string | null
          content?: string | null
          term?: string | null
          created_at?: string | null
          updated_at?: string | null
          school_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'curriculum_subjects_curriculum_id_fkey'
            columns: ['curriculum_id']
            isOneToOne: false
            referencedRelation: 'curriculums'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'curriculum_subjects_school_id_fkey'
            columns: ['school_id']
            isOneToOne: false
            referencedRelation: 'schools'
            referencedColumns: ['id']
          }
        ]
      }
      classes: {
        Row: {
          id: string
          school_id: string
          name: string
          grade_level: string | null
          teacher_id: string | null
          curriculum_id: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          school_id: string
          name: string
          grade_level?: string | null
          teacher_id?: string | null
          curriculum_id?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          school_id?: string
          name?: string
          grade_level?: string | null
          teacher_id?: string | null
          curriculum_id?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'classes_school_id_fkey'
            columns: ['school_id']
            isOneToOne: false
            referencedRelation: 'schools'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'classes_curriculum_id_fkey'
            columns: ['curriculum_id']
            isOneToOne: false
            referencedRelation: 'curriculums'
            referencedColumns: ['id']
          }
        ]
      }
      exam_templates: {
        Row: {
          id: string
          school_id: string
          class_id: string | null
          title: string
          subject: string
          term: string
          score_type: string
          expected_results: Json | null
          created_at: string | null
          updated_at: string | null
          exam_type: string | null
          max_score: number | null
          weight: number | null
          teacher_id: string | null
        }
        Insert: {
          id?: string
          school_id: string
          class_id?: string | null
          title: string
          subject: string
          term: string
          score_type?: string
          expected_results?: Json | null
          created_at?: string | null
          updated_at?: string | null
          exam_type?: string | null
          max_score?: number | null
          weight?: number | null
          teacher_id?: string | null
        }
        Update: {
          id?: string
          school_id?: string
          class_id?: string | null
          title?: string
          subject?: string
          term?: string
          score_type?: string
          expected_results?: Json | null
          created_at?: string | null
          updated_at?: string | null
          exam_type?: string | null
          max_score?: number | null
          weight?: number | null
          teacher_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'exam_templates_school_id_fkey'
            columns: ['school_id']
            isOneToOne: false
            referencedRelation: 'schools'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'exam_templates_class_id_fkey'
            columns: ['class_id']
            isOneToOne: false
            referencedRelation: 'classes'
            referencedColumns: ['id']
          }
        ]
      }
      students: {
        Row: {
          id: string
          school_id: string
          class_id: string | null
          name: string
          parent_phone: string | null
          monthly_fee: number | null
          address: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          school_id: string
          class_id?: string | null
          name: string
          parent_phone?: string | null
          monthly_fee?: number | null
          address?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          school_id?: string
          class_id?: string | null
          name?: string
          parent_phone?: string | null
          monthly_fee?: number | null
          address?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'students_school_id_fkey'
            columns: ['school_id']
            isOneToOne: false
            referencedRelation: 'schools'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'students_class_id_fkey'
            columns: ['class_id']
            isOneToOne: false
            referencedRelation: 'classes'
            referencedColumns: ['id']
          }
        ]
      }
      attendance: {
        Row: {
          id: string
          school_id: string
          student_id: string
          class_id: string | null
          teacher_id: string | null
          date: string
          status: string
          notes: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          school_id: string
          student_id: string
          class_id?: string | null
          teacher_id?: string | null
          date?: string
          status: string
          notes?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          school_id?: string
          student_id?: string
          class_id?: string | null
          teacher_id?: string | null
          date?: string
          status?: string
          notes?: string | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'attendance_school_id_fkey'
            columns: ['school_id']
            isOneToOne: false
            referencedRelation: 'schools'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'attendance_student_id_fkey'
            columns: ['student_id']
            isOneToOne: false
            referencedRelation: 'students'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'attendance_class_id_fkey'
            columns: ['class_id']
            isOneToOne: false
            referencedRelation: 'classes'
            referencedColumns: ['id']
          }
        ]
      }
      grades: {
        Row: {
          id: string
          school_id: string
          student_id: string
          exam_template_id: string | null
          subject: string
          score: string
          max_score: number | null
          term: string | null
          date: string | null
          created_at: string | null
          teacher_id: string | null
          notes: string | null
        }
        Insert: {
          id?: string
          school_id: string
          student_id: string
          exam_template_id?: string | null
          subject: string
          score: string
          max_score?: number | null
          term?: string | null
          date?: string | null
          created_at?: string | null
          teacher_id?: string | null
          notes?: string | null
        }
        Update: {
          id?: string
          school_id?: string
          student_id?: string
          exam_template_id?: string | null
          subject?: string
          score?: string
          max_score?: number | null
          term?: string | null
          date?: string | null
          created_at?: string | null
          teacher_id?: string | null
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'grades_school_id_fkey'
            columns: ['school_id']
            isOneToOne: false
            referencedRelation: 'schools'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'grades_student_id_fkey'
            columns: ['student_id']
            isOneToOne: false
            referencedRelation: 'students'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'grades_exam_template_id_fkey'
            columns: ['exam_template_id']
            isOneToOne: false
            referencedRelation: 'exam_templates'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'grades_teacher_id_fkey'
            columns: ['teacher_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      complaints: {
        Row: {
          id: string
          school_id: string
          user_id: string
          student_id: string | null
          content: string
          status: string | null
          admin_response: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          school_id: string
          user_id: string
          student_id?: string | null
          content: string
          status?: string | null
          admin_response?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          school_id?: string
          user_id?: string
          student_id?: string | null
          content?: string
          status?: string | null
          admin_response?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'complaints_school_id_fkey'
            columns: ['school_id']
            isOneToOne: false
            referencedRelation: 'schools'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'complaints_student_id_fkey'
            columns: ['student_id']
            isOneToOne: false
            referencedRelation: 'students'
            referencedColumns: ['id']
          }
        ]
      }
      messages: {
        Row: {
          id: string
          school_id: string
          sender_id: string
          receiver_id: string
          student_id: string | null
          content: string
          is_read: boolean | null
          created_at: string | null
        }
        Insert: {
          id?: string
          school_id: string
          sender_id: string
          receiver_id: string
          student_id?: string | null
          content: string
          is_read?: boolean | null
          created_at?: string | null
        }
        Update: {
          id?: string
          school_id?: string
          sender_id?: string
          receiver_id?: string
          student_id?: string | null
          content?: string
          is_read?: boolean | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'messages_school_id_fkey'
            columns: ['school_id']
            isOneToOne: false
            referencedRelation: 'schools'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'messages_student_id_fkey'
            columns: ['student_id']
            isOneToOne: false
            referencedRelation: 'students'
            referencedColumns: ['id']
          }
        ]
      }
      notifications: {
        Row: {
          id: string
          school_id: string | null
          user_id: string
          title: string
          message: string
          type: string | null
          is_read: boolean | null
          link: string | null
          created_at: string | null
          metadata: Json | null
          content: string | null
        }
        Insert: {
          id?: string
          school_id?: string | null
          user_id: string
          title: string
          message: string
          type?: string | null
          is_read?: boolean | null
          link?: string | null
          created_at?: string | null
          metadata?: Json | null
          content?: string | null
        }
        Update: {
          id?: string
          school_id?: string | null
          user_id?: string
          title?: string
          message?: string
          type?: string | null
          is_read?: boolean | null
          link?: string | null
          created_at?: string | null
          metadata?: Json | null
          content?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'notifications_school_id_fkey'
            columns: ['school_id']
            isOneToOne: false
            referencedRelation: 'schools'
            referencedColumns: ['id']
          }
        ]
      }
      notification_delivery_logs: {
        Row: {
          id: string
          notification_id: string | null
          sent_count: number
          total_subscriptions: number
          has_active_subscription: boolean
          no_device_registered: boolean
          temporary_outage: boolean
          delivered_at: string
          raw_response: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          notification_id?: string | null
          sent_count?: number
          total_subscriptions?: number
          has_active_subscription?: boolean
          no_device_registered?: boolean
          temporary_outage?: boolean
          delivered_at?: string
          raw_response?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          notification_id?: string | null
          sent_count?: number
          total_subscriptions?: number
          has_active_subscription?: boolean
          no_device_registered?: boolean
          temporary_outage?: boolean
          delivered_at?: string
          raw_response?: Json | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'notification_delivery_logs_notification_id_fkey'
            columns: ['notification_id']
            isOneToOne: false
            referencedRelation: 'notifications'
            referencedColumns: ['id']
          }
        ]
      }
      push_delivery_log: {
        Row: {
          id: string
          notification_id: string | null
          user_id: string | null
          queued_at: string | null
          error_message: string | null
          pg_net_request_id: number | null
          target_user_id: string | null
          sent_count: number
          total_subscriptions: number
          has_active_subscription: boolean
          no_device_registered: boolean
          temporary_outage: boolean
          raw_response: Json | null
        }
        Insert: {
          id?: string
          notification_id?: string | null
          user_id?: string | null
          queued_at?: string | null
          error_message?: string | null
          pg_net_request_id?: number | null
          target_user_id?: string | null
          sent_count?: number
          total_subscriptions?: number
          has_active_subscription?: boolean
          no_device_registered?: boolean
          temporary_outage?: boolean
          raw_response?: Json | null
        }
        Update: {
          id?: string
          notification_id?: string | null
          user_id?: string | null
          queued_at?: string | null
          error_message?: string | null
          pg_net_request_id?: number | null
          target_user_id?: string | null
          sent_count?: number
          total_subscriptions?: number
          has_active_subscription?: boolean
          no_device_registered?: boolean
          temporary_outage?: boolean
          raw_response?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: 'push_delivery_log_notification_id_fkey'
            columns: ['notification_id']
            isOneToOne: false
            referencedRelation: 'notifications'
            referencedColumns: ['id']
          }
        ]
      }
      push_trigger_errors: {
        Row: {
          id: string
          notification_id: string | null
          user_id: string | null
          error_code: string
          error_message: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          notification_id?: string | null
          user_id?: string | null
          error_code?: string
          error_message?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          notification_id?: string | null
          user_id?: string | null
          error_code?: string
          error_message?: string | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'push_trigger_errors_notification_id_fkey'
            columns: ['notification_id']
            isOneToOne: false
            referencedRelation: 'notifications'
            referencedColumns: ['id']
          }
        ]
      }
      push_subscriptions: {
        Row: {
          id: string
          user_id: string
          school_id: string | null
          subscription: Json
          user_agent: string | null
          failure_count: number
          last_failure_at: string | null
          last_failure_reason: string | null
          created_at: string | null
          updated_at: string | null
          endpoint: string | null
        }
        Insert: {
          id?: string
          user_id: string
          school_id?: string | null
          subscription: Json
          user_agent?: string | null
          failure_count?: number
          last_failure_at?: string | null
          last_failure_reason?: string | null
          created_at?: string | null
          updated_at?: string | null
          endpoint?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          school_id?: string | null
          subscription?: Json
          user_agent?: string | null
          failure_count?: number
          last_failure_at?: string | null
          last_failure_reason?: string | null
          created_at?: string | null
          updated_at?: string | null
          endpoint?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'push_subscriptions_school_id_fkey'
            columns: ['school_id']
            isOneToOne: false
            referencedRelation: 'schools'
            referencedColumns: ['id']
          }
        ]
      }
      student_parents: {
        Row: {
          id: string
          school_id: string
          student_id: string
          parent_id: string
          created_at: string | null
        }
        Insert: {
          id?: string
          school_id: string
          student_id: string
          parent_id: string
          created_at?: string | null
        }
        Update: {
          id?: string
          school_id?: string
          student_id?: string
          parent_id?: string
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'student_parents_school_id_fkey'
            columns: ['school_id']
            isOneToOne: false
            referencedRelation: 'schools'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'student_parents_student_id_fkey'
            columns: ['student_id']
            isOneToOne: false
            referencedRelation: 'students'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'student_parents_parent_id_fkey'
            columns: ['parent_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      conversations: {
        Row: {
          id: string
          school_id: string
          parent_id: string
          student_id: string | null
          subject: string
          status: string
          priority: string
          last_message_at: string | null
          last_message_preview: string | null
          unread_by_admin: number | null
          unread_by_parent: number | null
          messages_count: number | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          school_id: string
          parent_id: string
          student_id?: string | null
          subject?: string
          status?: string
          priority?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          unread_by_admin?: number | null
          unread_by_parent?: number | null
          messages_count?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          school_id?: string
          parent_id?: string
          student_id?: string | null
          subject?: string
          status?: string
          priority?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          unread_by_admin?: number | null
          unread_by_parent?: number | null
          messages_count?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'conversations_school_id_fkey'
            columns: ['school_id']
            isOneToOne: false
            referencedRelation: 'schools'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'conversations_parent_id_fkey'
            columns: ['parent_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'conversations_student_id_fkey'
            columns: ['student_id']
            isOneToOne: false
            referencedRelation: 'students'
            referencedColumns: ['id']
          }
        ]
      }
      conversation_messages: {
        Row: {
          id: string
          conversation_id: string
          sender_id: string
          sender_role: string | null
          content: string
          is_read: boolean | null
          deleted_by_admin: boolean | null
          deleted_at: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          conversation_id: string
          sender_id: string
          sender_role?: string | null
          content: string
          is_read?: boolean | null
          deleted_by_admin?: boolean | null
          deleted_at?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          conversation_id?: string
          sender_id?: string
          sender_role?: string | null
          content?: string
          is_read?: boolean | null
          deleted_by_admin?: boolean | null
          deleted_at?: string | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'conversation_messages_conversation_id_fkey'
            columns: ['conversation_id']
            isOneToOne: false
            referencedRelation: 'conversations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'conversation_messages_sender_id_fkey'
            columns: ['sender_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      teacher_attendance: {
        Row: {
          id: string
          school_id: string
          teacher_id: string
          date: string
          status: string
          notes: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          school_id: string
          teacher_id: string
          date?: string
          status: string
          notes?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          school_id?: string
          teacher_id?: string
          date?: string
          status?: string
          notes?: string | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'teacher_attendance_school_id_fkey'
            columns: ['school_id']
            isOneToOne: false
            referencedRelation: 'schools'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'teacher_attendance_teacher_id_fkey'
            columns: ['teacher_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      electronic_exams: {
        Row: {
          id: string
          school_id: string
          class_id: string | null
          teacher_id: string | null
          title: string
          subject: string
          duration_minutes: number
          instructions: string | null
          status: string
          created_at: string | null
          updated_at: string | null
          available_from: string | null
          available_until: string | null
          language: string | null
        }
        Insert: {
          id?: string
          school_id: string
          class_id?: string | null
          teacher_id?: string | null
          title: string
          subject: string
          duration_minutes: number
          instructions?: string | null
          status?: string
          created_at?: string | null
          updated_at?: string | null
          available_from?: string | null
          available_until?: string | null
          language?: string | null
        }
        Update: {
          id?: string
          school_id?: string
          class_id?: string | null
          teacher_id?: string | null
          title?: string
          subject?: string
          duration_minutes?: number
          instructions?: string | null
          status?: string
          created_at?: string | null
          updated_at?: string | null
          available_from?: string | null
          available_until?: string | null
          language?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'electronic_exams_school_id_fkey'
            columns: ['school_id']
            isOneToOne: false
            referencedRelation: 'schools'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'electronic_exams_class_id_fkey'
            columns: ['class_id']
            isOneToOne: false
            referencedRelation: 'classes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'electronic_exams_teacher_id_fkey'
            columns: ['teacher_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      exam_questions: {
        Row: {
          id: string
          exam_id: string
          school_id: string
          question_type: string
          question_text: string
          options: Json | null
          correct_answer: string | null
          order_index: number
          created_at: string | null
        }
        Insert: {
          id?: string
          exam_id: string
          school_id: string
          question_type: string
          question_text: string
          options?: Json | null
          correct_answer?: string | null
          order_index?: number
          created_at?: string | null
        }
        Update: {
          id?: string
          exam_id?: string
          school_id?: string
          question_type?: string
          question_text?: string
          options?: Json | null
          correct_answer?: string | null
          order_index?: number
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'exam_questions_school_id_fkey'
            columns: ['school_id']
            isOneToOne: false
            referencedRelation: 'schools'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'exam_questions_exam_id_fkey'
            columns: ['exam_id']
            isOneToOne: false
            referencedRelation: 'electronic_exams'
            referencedColumns: ['id']
          }
        ]
      }
      exam_attempts: {
        Row: {
          id: string
          exam_id: string
          student_id: string
          parent_id: string | null
          answers: Json
          score: number
          total_score: number
          time_spent_seconds: number
          started_at: string | null
          completed_at: string | null
          tab_switches_count: number
        }
        Insert: {
          id?: string
          exam_id: string
          student_id: string
          parent_id?: string | null
          answers?: Json
          score?: number
          total_score?: number
          time_spent_seconds?: number
          started_at?: string | null
          completed_at?: string | null
          tab_switches_count?: number
        }
        Update: {
          id?: string
          exam_id?: string
          student_id?: string
          parent_id?: string | null
          answers?: Json
          score?: number
          total_score?: number
          time_spent_seconds?: number
          started_at?: string | null
          completed_at?: string | null
          tab_switches_count?: number
        }
        Relationships: [
          {
            foreignKeyName: 'exam_attempts_exam_id_fkey'
            columns: ['exam_id']
            isOneToOne: false
            referencedRelation: 'electronic_exams'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'exam_attempts_student_id_fkey'
            columns: ['student_id']
            isOneToOne: false
            referencedRelation: 'students'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'exam_attempts_parent_id_fkey'
            columns: ['parent_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      class_chat_rooms: {
        Row: {
          id: string
          school_id: string
          class_id: string | null
          name: string
          created_at: string | null
        }
        Insert: {
          id?: string
          school_id: string
          class_id?: string | null
          name: string
          created_at?: string | null
        }
        Update: {
          id?: string
          school_id?: string
          class_id?: string | null
          name?: string
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'class_chat_rooms_school_id_fkey'
            columns: ['school_id']
            isOneToOne: false
            referencedRelation: 'schools'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'class_chat_rooms_class_id_fkey'
            columns: ['class_id']
            isOneToOne: false
            referencedRelation: 'classes'
            referencedColumns: ['id']
          }
        ]
      }
      class_chat_messages: {
        Row: {
          id: string
          room_id: string
          sender_id: string | null
          sender_name: string | null
          content: string
          created_at: string | null
        }
        Insert: {
          id?: string
          room_id: string
          sender_id?: string | null
          sender_name?: string | null
          content: string
          created_at?: string | null
        }
        Update: {
          id?: string
          room_id?: string
          sender_id?: string | null
          sender_name?: string | null
          content?: string
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'class_chat_messages_room_id_fkey'
            columns: ['room_id']
            isOneToOne: false
            referencedRelation: 'class_chat_rooms'
            referencedColumns: ['id']
          }
        ]
      }
      fees: {
        Row: {
          id: string
          school_id: string | null
          student_id: string | null
          amount_due: number
          amount_paid: number
          status: string | null
          term: string | null
          created_at: string | null
          description: string | null
        }
        Insert: {
          id?: string
          school_id?: string | null
          student_id?: string | null
          amount_due?: number
          amount_paid?: number
          status?: string | null
          term?: string | null
          created_at?: string | null
          description?: string | null
        }
        Update: {
          id?: string
          school_id?: string | null
          student_id?: string | null
          amount_due?: number
          amount_paid?: number
          status?: string | null
          term?: string | null
          created_at?: string | null
          description?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'fees_school_id_fkey'
            columns: ['school_id']
            isOneToOne: false
            referencedRelation: 'schools'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'fees_student_id_fkey'
            columns: ['student_id']
            isOneToOne: false
            referencedRelation: 'students'
            referencedColumns: ['id']
          }
        ]
      }
      fee_payments: {
        Row: {
          id: string
          fee_id: string | null
          school_id: string | null
          amount: number | null
          payment_date: string | null
          created_at: string | null
          notes: string | null
        }
        Insert: {
          id?: string
          fee_id?: string | null
          school_id?: string | null
          amount?: number | null
          payment_date?: string | null
          created_at?: string | null
          notes?: string | null
        }
        Update: {
          id?: string
          fee_id?: string | null
          school_id?: string | null
          amount?: number | null
          payment_date?: string | null
          created_at?: string | null
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'fee_payments_school_id_fkey'
            columns: ['school_id']
            isOneToOne: false
            referencedRelation: 'schools'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'fee_payments_fee_id_fkey'
            columns: ['fee_id']
            isOneToOne: false
            referencedRelation: 'fees'
            referencedColumns: ['id']
          }
        ]
      }
      audit_logs: {
        Row: {
          id: string
          user_id: string | null
          school_id: string | null
          action: string | null
          entity_type: string | null
          entity_id: string | null
          details: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id?: string | null
          school_id?: string | null
          action?: string | null
          entity_type?: string | null
          entity_id?: string | null
          details?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string | null
          school_id?: string | null
          action?: string | null
          entity_type?: string | null
          entity_id?: string | null
          details?: string | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'audit_logs_school_id_fkey'
            columns: ['school_id']
            isOneToOne: false
            referencedRelation: 'schools'
            referencedColumns: ['id']
          }
        ]
      }
      school_orders: {
        Row: {
          id: string
          school_name: string
          school_slug: string
          admin_name: string
          admin_phone: string
          admin_whatsapp: string | null
          plan: string
          logo_url: string | null
          receipt_url: string | null
          receipt_note: string | null
          status: string
          rejection_note: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          school_name: string
          school_slug: string
          admin_name: string
          admin_phone: string
          admin_whatsapp?: string | null
          plan?: string
          logo_url?: string | null
          receipt_url?: string | null
          receipt_note?: string | null
          status?: string
          rejection_note?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          school_name?: string
          school_slug?: string
          admin_name?: string
          admin_phone?: string
          admin_whatsapp?: string | null
          plan?: string
          logo_url?: string | null
          receipt_url?: string | null
          receipt_note?: string | null
          status?: string
          rejection_note?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: { user_id: string; required_role: string }
        Returns: boolean
      }
      get_user_role: {
        Args: { user_id: string }
        Returns: string
      }
      is_super_admin: {
        Args: { user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: 'admin' | 'teacher' | 'parent' | 'super_admin'
    }
  }
}
