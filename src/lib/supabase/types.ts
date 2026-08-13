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
        ]
      }
      courses: {
        Row: {
          created_at: string
          dance_style_id: string | null
          id: string
          level: string | null
          name: string
          room_id: string
          video_set_id: string | null
        }
        Insert: {
          created_at?: string
          dance_style_id?: string | null
          id?: string
          level?: string | null
          name: string
          room_id: string
          video_set_id?: string | null
        }
        Update: {
          created_at?: string
          dance_style_id?: string | null
          id?: string
          level?: string | null
          name?: string
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
      profiles: {
        Row: {
          birthdate: string | null
          created_at: string
          full_name: string | null
          gender: string | null
          id: string
          phone: string | null
          role: string
        }
        Insert: {
          birthdate?: string | null
          created_at?: string
          full_name?: string | null
          gender?: string | null
          id: string
          phone?: string | null
          role?: string
        }
        Update: {
          birthdate?: string | null
          created_at?: string
          full_name?: string | null
          gender?: string | null
          id?: string
          phone?: string | null
          role?: string
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
      subscriptions: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          status: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          status?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          id: string
          position: number
          title: string
          video_set_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          position?: number
          title: string
          video_set_id: string
        }
        Update: {
          created_at?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_role: { Args: never; Returns: string }
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
