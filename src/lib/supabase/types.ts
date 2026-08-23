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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      bookings: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          session_id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          session_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "teacher_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "class_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      class_sessions: {
        Row: {
          course_id: string
          created_at: string
          id: string
          starts_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          starts_at: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_sessions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      coupon_check_attempts: {
        Row: {
          attempted_at: string
          customer_id: string
          id: number
        }
        Insert: {
          attempted_at?: string
          customer_id: string
          id?: number
        }
        Update: {
          attempted_at?: string
          customer_id?: string
          id?: number
        }
        Relationships: [
          {
            foreignKeyName: "coupon_check_attempts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_check_attempts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "teacher_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          active: boolean
          code: string
          created_at: string
          discount_amount: number
          discount_type: string
          expires_at: string | null
          id: string
          max_redemptions: number
          redemption_count: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          discount_amount: number
          discount_type: string
          expires_at?: string | null
          id?: string
          max_redemptions: number
          redemption_count?: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          discount_amount?: number
          discount_type?: string
          expires_at?: string | null
          id?: string
          max_redemptions?: number
          redemption_count?: number
        }
        Relationships: []
      }
      course_attendance: {
        Row: {
          course_id: string
          created_at: string
          customer_id: string
          marked_by: string | null
          occurrence_date: string
          status: string
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          customer_id: string
          marked_by?: string | null
          occurrence_date: string
          status: string
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          customer_id?: string
          marked_by?: string | null
          occurrence_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_attendance_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_attendance_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_attendance_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "teacher_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_attendance_marked_by_fkey"
            columns: ["marked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_attendance_marked_by_fkey"
            columns: ["marked_by"]
            isOneToOne: false
            referencedRelation: "teacher_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      course_bookings: {
        Row: {
          chosen_date: string
          coupon_id: string | null
          course_id: string
          created_at: string
          customer_id: string
          dance_role: string | null
          desired_plan: string | null
          id: string
          note: string | null
          price: number | null
          status: string
          subscription_id: string | null
          type: string
          wants_student_price: boolean | null
        }
        Insert: {
          chosen_date: string
          coupon_id?: string | null
          course_id: string
          created_at?: string
          customer_id: string
          dance_role?: string | null
          desired_plan?: string | null
          id?: string
          note?: string | null
          price?: number | null
          status?: string
          subscription_id?: string | null
          type: string
          wants_student_price?: boolean | null
        }
        Update: {
          chosen_date?: string
          coupon_id?: string | null
          course_id?: string
          created_at?: string
          customer_id?: string
          dance_role?: string | null
          desired_plan?: string | null
          id?: string
          note?: string | null
          price?: number | null
          status?: string
          subscription_id?: string | null
          type?: string
          wants_student_price?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "course_bookings_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_bookings_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "teacher_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_bookings_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      course_entry_dates: {
        Row: {
          course_id: string
          created_at: string
          entry_date: string
          id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          entry_date: string
          id?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          entry_date?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_entry_dates_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_schedule: {
        Row: {
          course_id: string
          created_at: string
          end_time: string
          id: string
          start_time: string
          weekday: number
        }
        Insert: {
          course_id: string
          created_at?: string
          end_time: string
          id?: string
          start_time: string
          weekday: number
        }
        Update: {
          course_id?: string
          created_at?: string
          end_time?: string
          id?: string
          start_time?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "course_schedule_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: true
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_schedule_pauses: {
        Row: {
          created_at: string
          id: string
          notified_at: string | null
          pause_date: string
          schedule_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notified_at?: string | null
          pause_date: string
          schedule_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notified_at?: string | null
          pause_date?: string
          schedule_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_schedule_pauses_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "course_schedule"
            referencedColumns: ["id"]
          },
        ]
      }
      course_session_notes: {
        Row: {
          course_id: string
          note: string
          occurrence_date: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          course_id: string
          note: string
          occurrence_date: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          course_id?: string
          note?: string
          occurrence_date?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_session_notes_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_session_notes_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_session_notes_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "teacher_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      course_teachers: {
        Row: {
          course_id: string
          created_at: string
          teacher_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          teacher_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_teachers_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_teachers_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_teachers_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teacher_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          created_at: string
          dance_style_id: string | null
          id: string
          level: string | null
          max_participants: number | null
          max_role_difference: number | null
          name: string
          prerequisite_note: string | null
          price: number | null
          role_query_enabled: boolean
          room_id: string
          video_set_id: string | null
        }
        Insert: {
          created_at?: string
          dance_style_id?: string | null
          id?: string
          level?: string | null
          max_participants?: number | null
          max_role_difference?: number | null
          name: string
          prerequisite_note?: string | null
          price?: number | null
          role_query_enabled?: boolean
          room_id: string
          video_set_id?: string | null
        }
        Update: {
          created_at?: string
          dance_style_id?: string | null
          id?: string
          level?: string | null
          max_participants?: number | null
          max_role_difference?: number | null
          name?: string
          prerequisite_note?: string | null
          price?: number | null
          role_query_enabled?: boolean
          room_id?: string
          video_set_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "courses_dance_style_id_fkey"
            columns: ["dance_style_id"]
            isOneToOne: false
            referencedRelation: "dance_styles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_video_set_id_fkey"
            columns: ["video_set_id"]
            isOneToOne: false
            referencedRelation: "video_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      dance_styles: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      dropin_pricing: {
        Row: {
          course_price: number | null
          course_student_price: number | null
          flatrate_price: number | null
          flatrate_student_price: number | null
          id: string
          normal_price: number
          student_price: number
          updated_at: string
        }
        Insert: {
          course_price?: number | null
          course_student_price?: number | null
          flatrate_price?: number | null
          flatrate_student_price?: number | null
          id?: string
          normal_price: number
          student_price: number
          updated_at?: string
        }
        Update: {
          course_price?: number | null
          course_student_price?: number | null
          flatrate_price?: number | null
          flatrate_student_price?: number | null
          id?: string
          normal_price?: number
          student_price?: number
          updated_at?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          capacity: number
          created_at: string
          description: string | null
          ends_at: string | null
          id: string
          location: string | null
          name: string
          price_normal: number
          price_student: number
          starts_at: string
          status: string
        }
        Insert: {
          capacity: number
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          location?: string | null
          name: string
          price_normal: number
          price_student: number
          starts_at: string
          status?: string
        }
        Update: {
          capacity?: number
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          location?: string | null
          name?: string
          price_normal?: number
          price_student?: number
          starts_at?: string
          status?: string
        }
        Relationships: []
      }
      invoice_number_counters: {
        Row: {
          last_number: number
          year: number
        }
        Insert: {
          last_number?: number
          year: number
        }
        Update: {
          last_number?: number
          year?: number
        }
        Relationships: []
      }
      invoice_settings: {
        Row: {
          address: string
          bounce_fee_default: number
          company_name: string
          id: string
          uid_number: string
          updated_at: string
          vat_rate: number
        }
        Insert: {
          address?: string
          bounce_fee_default?: number
          company_name?: string
          id?: string
          uid_number?: string
          updated_at?: string
          vat_rate?: number
        }
        Update: {
          address?: string
          bounce_fee_default?: number
          company_name?: string
          id?: string
          uid_number?: string
          updated_at?: string
          vat_rate?: number
        }
        Relationships: []
      }
      invoices: {
        Row: {
          bounce_fee: number
          bounced_at: string | null
          collection_item_id: string | null
          created_at: string
          customer_id: string
          description: string
          gross_amount: number
          id: string
          invoice_date: string
          invoice_number: string
          reminded_at: string | null
          settled_at: string | null
          vat_rate: number
        }
        Insert: {
          bounce_fee?: number
          bounced_at?: string | null
          collection_item_id?: string | null
          created_at?: string
          customer_id: string
          description: string
          gross_amount: number
          id?: string
          invoice_date: string
          invoice_number: string
          reminded_at?: string | null
          settled_at?: string | null
          vat_rate: number
        }
        Update: {
          bounce_fee?: number
          bounced_at?: string | null
          collection_item_id?: string | null
          created_at?: string
          customer_id?: string
          description?: string
          gross_amount?: number
          id?: string
          invoice_date?: string
          invoice_number?: string
          reminded_at?: string | null
          settled_at?: string | null
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_collection_item_id_fkey"
            columns: ["collection_item_id"]
            isOneToOne: false
            referencedRelation: "sepa_collection_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "teacher_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          address: string | null
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          address?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      newsletter_sends: {
        Row: {
          body: string
          course_id: string | null
          id: string
          recipient_count: number
          recipient_group: string
          sent_at: string
          sent_by: string
          subject: string
        }
        Insert: {
          body: string
          course_id?: string | null
          id?: string
          recipient_count: number
          recipient_group: string
          sent_at?: string
          sent_by: string
          subject: string
        }
        Update: {
          body?: string
          course_id?: string | null
          id?: string
          recipient_count?: number
          recipient_group?: string
          sent_at?: string
          sent_by?: string
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "newsletter_sends_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          channel: string
          customer_id: string
          enabled: boolean
          event_group: string
          updated_at: string
        }
        Insert: {
          channel: string
          customer_id: string
          enabled?: boolean
          event_group: string
          updated_at?: string
        }
        Update: {
          channel?: string
          customer_id?: string
          enabled?: boolean
          event_group?: string
          updated_at?: string
        }
        Relationships: []
      }
      notification_queue: {
        Row: {
          created_at: string
          customer_id: string
          dedupe_key: string | null
          email_status: string | null
          error_detail: string | null
          event_type: string
          id: string
          payload: Json
          processed_at: string | null
          push_status: string | null
          status: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          dedupe_key?: string | null
          email_status?: string | null
          error_detail?: string | null
          event_type: string
          id?: string
          payload?: Json
          processed_at?: string | null
          push_status?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          dedupe_key?: string | null
          email_status?: string | null
          error_detail?: string | null
          event_type?: string
          id?: string
          payload?: Json
          processed_at?: string | null
          push_status?: string | null
          status?: string
        }
        Relationships: []
      }
      notification_template_overrides: {
        Row: {
          email_body: string
          email_subject: string
          push_body: string
          push_title: string
          template_key: string
          updated_at: string
        }
        Insert: {
          email_body: string
          email_subject: string
          push_body: string
          push_title: string
          template_key: string
          updated_at?: string
        }
        Update: {
          email_body?: string
          email_subject?: string
          push_body?: string
          push_title?: string
          template_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          birthdate: string | null
          created_at: string
          full_name: string | null
          gender: string | null
          id: string
          phone: string | null
          referral_source: string | null
          role: string
        }
        Insert: {
          birthdate?: string | null
          created_at?: string
          full_name?: string | null
          gender?: string | null
          id: string
          phone?: string | null
          referral_source?: string | null
          role?: string
        }
        Update: {
          birthdate?: string | null
          created_at?: string
          full_name?: string | null
          gender?: string | null
          id?: string
          phone?: string | null
          referral_source?: string | null
          role?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth_key: string
          created_at: string
          customer_id: string
          endpoint: string
          id: string
          p256dh: string
        }
        Insert: {
          auth_key: string
          created_at?: string
          customer_id: string
          endpoint: string
          id?: string
          p256dh: string
        }
        Update: {
          auth_key?: string
          created_at?: string
          customer_id?: string
          endpoint?: string
          id?: string
          p256dh?: string
        }
        Relationships: []
      }
      rooms: {
        Row: {
          created_at: string
          id: string
          location_id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          location_id: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          location_id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "rooms_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      sepa_collection_items: {
        Row: {
          account_holder_name: string
          amount: number
          bounced_at: string | null
          created_at: string
          customer_id: string
          event_ticket_id: string | null
          iban: string
          id: string
          mandate_reference: string
          run_id: string
          subscription_id: string | null
        }
        Insert: {
          account_holder_name: string
          amount: number
          bounced_at?: string | null
          created_at?: string
          customer_id: string
          event_ticket_id?: string | null
          iban: string
          id?: string
          mandate_reference: string
          run_id: string
          subscription_id?: string | null
        }
        Update: {
          account_holder_name?: string
          amount?: number
          bounced_at?: string | null
          created_at?: string
          customer_id?: string
          event_ticket_id?: string | null
          iban?: string
          id?: string
          mandate_reference?: string
          run_id?: string
          subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sepa_collection_items_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sepa_collection_items_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "teacher_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sepa_collection_items_event_ticket_id_fkey"
            columns: ["event_ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sepa_collection_items_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "sepa_collection_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sepa_collection_items_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      sepa_collection_runs: {
        Row: {
          created_at: string
          created_by: string | null
          due_date: string
          id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          due_date: string
          id?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          due_date?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sepa_collection_runs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sepa_collection_runs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "teacher_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      sepa_mandates: {
        Row: {
          account_holder_name: string
          consented_at: string
          created_at: string
          customer_id: string
          iban: string
          id: string
          mandate_reference: string
          revoked_at: string | null
        }
        Insert: {
          account_holder_name: string
          consented_at?: string
          created_at?: string
          customer_id: string
          iban: string
          id?: string
          mandate_reference: string
          revoked_at?: string | null
        }
        Update: {
          account_holder_name?: string
          consented_at?: string
          created_at?: string
          customer_id?: string
          iban?: string
          id?: string
          mandate_reference?: string
          revoked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sepa_mandates_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sepa_mandates_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "teacher_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancelled_at: string | null
          course_id: string | null
          created_at: string
          customer_id: string
          cycle_anchor_date: string
          id: string
          name: string | null
          pending_effective_date: string | null
          pending_status: string | null
          price: number | null
          status: string
        }
        Insert: {
          cancelled_at?: string | null
          course_id?: string | null
          created_at?: string
          customer_id: string
          cycle_anchor_date?: string
          id?: string
          name?: string | null
          pending_effective_date?: string | null
          pending_status?: string | null
          price?: number | null
          status?: string
        }
        Update: {
          cancelled_at?: string | null
          course_id?: string | null
          created_at?: string
          customer_id?: string
          cycle_anchor_date?: string
          id?: string
          name?: string | null
          pending_effective_date?: string | null
          pending_status?: string | null
          price?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "teacher_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          checked_in_at: string | null
          checked_in_by: string | null
          created_at: string
          customer_id: string
          event_id: string
          id: string
          payment_method: string
          price: number
          status: string
          wants_student_price: boolean
        }
        Insert: {
          checked_in_at?: string | null
          checked_in_by?: string | null
          created_at?: string
          customer_id: string
          event_id: string
          id?: string
          payment_method: string
          price: number
          status?: string
          wants_student_price?: boolean
        }
        Update: {
          checked_in_at?: string | null
          checked_in_by?: string | null
          created_at?: string
          customer_id?: string
          event_id?: string
          id?: string
          payment_method?: string
          price?: number
          status?: string
          wants_student_price?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "tickets_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "teacher_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      trial_followups: {
        Row: {
          booking_id: string
          contacted: boolean
          contacted_at: string | null
          created_at: string
          id: string
          note: string | null
          updated_at: string
        }
        Insert: {
          booking_id: string
          contacted?: boolean
          contacted_at?: string | null
          created_at?: string
          id?: string
          note?: string | null
          updated_at?: string
        }
        Update: {
          booking_id?: string
          contacted?: boolean
          contacted_at?: string | null
          created_at?: string
          id?: string
          note?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trial_followups_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "course_bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      video_set_lesson_videos: {
        Row: {
          created_at: string
          id: string
          lesson_id: string
          position: number
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          lesson_id: string
          position?: number
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          lesson_id?: string
          position?: number
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_set_lesson_videos_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "video_set_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      video_set_lessons: {
        Row: {
          created_at: string
          customer_video_url: string | null
          id: string
          position: number
          title: string
          video_set_id: string
        }
        Insert: {
          created_at?: string
          customer_video_url?: string | null
          id?: string
          position?: number
          title: string
          video_set_id: string
        }
        Update: {
          created_at?: string
          customer_video_url?: string | null
          id?: string
          position?: number
          title?: string
          video_set_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_set_lessons_video_set_id_fkey"
            columns: ["video_set_id"]
            isOneToOne: false
            referencedRelation: "video_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      video_sets: {
        Row: {
          created_at: string
          id: string
          level: string | null
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          level?: string | null
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          level?: string | null
          name?: string
        }
        Relationships: []
      }
      waitlist_entries: {
        Row: {
          chosen_date: string
          course_id: string
          created_at: string
          customer_id: string
          dance_role: string | null
          desired_plan: string
          id: string
        }
        Insert: {
          chosen_date: string
          course_id: string
          created_at?: string
          customer_id: string
          dance_role?: string | null
          desired_plan: string
          id?: string
        }
        Update: {
          chosen_date?: string
          course_id?: string
          created_at?: string
          customer_id?: string
          dance_role?: string | null
          desired_plan?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_entries_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_entries_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_entries_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "teacher_directory"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      teacher_directory: {
        Row: {
          full_name: string | null
          id: string | null
        }
        Insert: {
          full_name?: string | null
          id?: string | null
        }
        Update: {
          full_name?: string | null
          id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_list_customer_emails: {
        Args: never
        Returns: {
          email: string
          id: string
        }[]
      }
      cancel_event_ticket: {
        Args: { p_ticket_id: string }
        Returns: {
          checked_in_at: string | null
          checked_in_by: string | null
          created_at: string
          customer_id: string
          event_id: string
          id: string
          payment_method: string
          price: number
          status: string
          wants_student_price: boolean
        }
        SetofOptions: {
          from: "*"
          to: "tickets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      check_coupon_code: {
        Args: { p_code: string }
        Returns: {
          discount_amount: number
          discount_type: string
          rate_limited: boolean
          valid: boolean
        }[]
      }
      checkin_event_ticket: {
        Args: { p_ticket_id: string }
        Returns: {
          checked_in_at: string | null
          checked_in_by: string | null
          created_at: string
          customer_id: string
          event_id: string
          id: string
          payment_method: string
          price: number
          status: string
          wants_student_price: boolean
        }
        SetofOptions: {
          from: "*"
          to: "tickets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_invoices_for_collection_run: {
        Args: { p_run_id: string }
        Returns: undefined
      }
      create_regular_course_booking: {
        Args: {
          p_chosen_date: string
          p_coupon_code?: string
          p_course_id: string
          p_dance_role?: string
          p_desired_plan: string
          p_note: string
          p_prerequisite_confirmed?: boolean
        }
        Returns: {
          chosen_date: string
          coupon_id: string | null
          course_id: string
          created_at: string
          customer_id: string
          dance_role: string | null
          desired_plan: string | null
          id: string
          note: string | null
          price: number | null
          status: string
          subscription_id: string | null
          type: string
          wants_student_price: boolean | null
        }
        SetofOptions: {
          from: "*"
          to: "course_bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_self_service_booking: {
        Args: {
          p_chosen_date: string
          p_course_id: string
          p_prerequisite_confirmed?: boolean
          p_type: string
          p_wants_student_price?: boolean
        }
        Returns: {
          chosen_date: string
          coupon_id: string | null
          course_id: string
          created_at: string
          customer_id: string
          dance_role: string | null
          desired_plan: string | null
          id: string
          note: string | null
          price: number | null
          status: string
          subscription_id: string | null
          type: string
          wants_student_price: boolean | null
        }
        SetofOptions: {
          from: "*"
          to: "course_bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      current_role: { Args: never; Returns: string }
      enqueue_notification: {
        Args: {
          p_customer_id: string
          p_dedupe_key?: string
          p_event_type: string
          p_payload: Json
        }
        Returns: undefined
      }
      get_course_attendance_roster: {
        Args: { p_course_id: string; p_occurrence_date: string }
        Returns: {
          customer_id: string
          full_name: string
          self_checked_in: boolean
          source: string
          status: string
        }[]
      }
      get_course_occupancy: {
        Args: never
        Returns: {
          course_id: string
          occupied_count: number
        }[]
      }
      get_course_session_note: {
        Args: { p_course_id: string; p_occurrence_date: string }
        Returns: string
      }
      get_event_occupancy: {
        Args: never
        Returns: {
          event_id: string
          ticket_count: number
        }[]
      }
      get_my_todays_attendance: {
        Args: never
        Returns: {
          course_id: string
          status: string
        }[]
      }
      is_course_teacher: { Args: { p_course_id: string }; Returns: boolean }
      join_waitlist: {
        Args: {
          p_chosen_date: string
          p_course_id: string
          p_dance_role?: string
          p_desired_plan: string
        }
        Returns: {
          chosen_date: string
          course_id: string
          created_at: string
          customer_id: string
          dance_role: string | null
          desired_plan: string
          id: string
        }
        SetofOptions: {
          from: "*"
          to: "waitlist_entries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      list_attendance_eligible_customers: {
        Args: never
        Returns: {
          customer_id: string
          full_name: string
        }[]
      }
      list_my_waitlist: {
        Args: never
        Returns: {
          chosen_date: string
          course_id: string
          created_at: string
          desired_plan: string
          id: string
          position: number
        }[]
      }
      mark_attendance: {
        Args: {
          p_course_id: string
          p_customer_id: string
          p_occurrence_date: string
          p_status: string
        }
        Returns: undefined
      }
      next_cycle_end: { Args: { p_anchor: string }; Returns: string }
      promote_waitlist_for_course: {
        Args: { p_course_id: string }
        Returns: number
      }
      purchase_event_ticket: {
        Args: {
          p_event_id: string
          p_payment_method: string
          p_wants_student_price: boolean
        }
        Returns: {
          checked_in_at: string | null
          checked_in_by: string | null
          created_at: string
          customer_id: string
          event_id: string
          id: string
          payment_method: string
          price: number
          status: string
          wants_student_price: boolean
        }
        SetofOptions: {
          from: "*"
          to: "tickets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      redeem_coupon_for_booking: {
        Args: { p_booking_id: string }
        Returns: {
          discount_amount: number
          discount_type: string
        }[]
      }
      self_reactivate_subscription: {
        Args: { p_subscription_id: string }
        Returns: {
          cancelled_at: string | null
          course_id: string | null
          created_at: string
          customer_id: string
          cycle_anchor_date: string
          id: string
          name: string | null
          pending_effective_date: string | null
          pending_status: string | null
          price: number | null
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "subscriptions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      self_schedule_subscription_change: {
        Args: { p_new_pending_status: string; p_subscription_id: string }
        Returns: {
          cancelled_at: string | null
          course_id: string | null
          created_at: string
          customer_id: string
          cycle_anchor_date: string
          id: string
          name: string | null
          pending_effective_date: string | null
          pending_status: string | null
          price: number | null
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "subscriptions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      self_switch_subscription_course: {
        Args: { p_new_course_id: string; p_subscription_id: string }
        Returns: {
          cancelled_at: string | null
          course_id: string | null
          created_at: string
          customer_id: string
          cycle_anchor_date: string
          id: string
          name: string | null
          pending_effective_date: string | null
          pending_status: string | null
          price: number | null
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "subscriptions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      self_toggle_attendance: { Args: { p_course_id: string }; Returns: string }
      self_undo_pending_change: {
        Args: { p_subscription_id: string }
        Returns: {
          cancelled_at: string | null
          course_id: string | null
          created_at: string
          customer_id: string
          cycle_anchor_date: string
          id: string
          name: string | null
          pending_effective_date: string | null
          pending_status: string | null
          price: number | null
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "subscriptions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      upsert_session_note: {
        Args: { p_course_id: string; p_note: string; p_occurrence_date: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
