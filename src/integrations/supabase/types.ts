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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      cases: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          analysis: Json | null
          bates_formatted: string
          bates_number: number
          bates_prefix: string
          created_at: string
          drive_file_id: string | null
          drive_file_path: string | null
          duration_seconds: number | null
          error_message: string | null
          file_size: number | null
          file_type: string
          file_url: string | null
          id: string
          import_job_id: string | null
          media_type: string | null
          mime_type: string
          name: string
          ocr_page_count: number | null
          ocr_processed_at: string | null
          ocr_text: string | null
          project_id: string
          status: string
          storage_path: string
          transcription_processed_at: string | null
          transcription_text: string | null
          updated_at: string
        }
        Insert: {
          analysis?: Json | null
          bates_formatted: string
          bates_number: number
          bates_prefix: string
          created_at?: string
          drive_file_id?: string | null
          drive_file_path?: string | null
          duration_seconds?: number | null
          error_message?: string | null
          file_size?: number | null
          file_type: string
          file_url?: string | null
          id?: string
          import_job_id?: string | null
          media_type?: string | null
          mime_type: string
          name: string
          ocr_page_count?: number | null
          ocr_processed_at?: string | null
          ocr_text?: string | null
          project_id: string
          status?: string
          storage_path: string
          transcription_processed_at?: string | null
          transcription_text?: string | null
          updated_at?: string
        }
        Update: {
          analysis?: Json | null
          bates_formatted?: string
          bates_number?: number
          bates_prefix?: string
          created_at?: string
          drive_file_id?: string | null
          drive_file_path?: string | null
          duration_seconds?: number | null
          error_message?: string | null
          file_size?: number | null
          file_type?: string
          file_url?: string | null
          id?: string
          import_job_id?: string | null
          media_type?: string | null
          mime_type?: string
          name?: string
          ocr_page_count?: number | null
          ocr_processed_at?: string | null
          ocr_text?: string | null
          project_id?: string
          status?: string
          storage_path?: string
          transcription_processed_at?: string | null
          transcription_text?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_import_job_id_fkey"
            columns: ["import_job_id"]
            isOneToOne: false
            referencedRelation: "import_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      import_jobs: {
        Row: {
          case_id: string
          completed_at: string | null
          created_at: string
          error_message: string | null
          failed_file_details: Json | null
          failed_files: number | null
          id: string
          processed_files: number | null
          source_folder_id: string | null
          source_folder_name: string | null
          source_folder_path: string | null
          source_type: string
          started_at: string | null
          status: string
          successful_files: number | null
          total_files: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          case_id: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          failed_file_details?: Json | null
          failed_files?: number | null
          id?: string
          processed_files?: number | null
          source_folder_id?: string | null
          source_folder_name?: string | null
          source_folder_path?: string | null
          source_type?: string
          started_at?: string | null
          status?: string
          successful_files?: number | null
          total_files?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          case_id?: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          failed_file_details?: Json | null
          failed_files?: number | null
          id?: string
          processed_files?: number | null
          source_folder_id?: string | null
          source_folder_name?: string | null
          source_folder_path?: string | null
          source_type?: string
          started_at?: string | null
          status?: string
          successful_files?: number | null
          total_files?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_jobs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          bates_counter: number
          bates_prefix: string
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          bates_counter?: number
          bates_prefix?: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          bates_counter?: number
          bates_prefix?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      video_rooms: {
        Row: {
          case_id: string
          created_at: string
          daily_room_name: string
          description: string | null
          enable_recording: boolean
          ended_at: string | null
          expires_at: string
          id: string
          is_private: boolean | null
          knocking_enabled: boolean | null
          max_participants: number | null
          participants_log: Json | null
          recording_started_at: string | null
          recording_status: string | null
          recording_url: string | null
          require_authentication: boolean | null
          room_name: string
          room_url: string
          status: string
          title: string
          transcription_processed_at: string | null
          transcription_status: string | null
          transcription_text: string | null
          transcription_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          case_id: string
          created_at?: string
          daily_room_name: string
          description?: string | null
          enable_recording?: boolean
          ended_at?: string | null
          expires_at: string
          id?: string
          is_private?: boolean | null
          knocking_enabled?: boolean | null
          max_participants?: number | null
          participants_log?: Json | null
          recording_started_at?: string | null
          recording_status?: string | null
          recording_url?: string | null
          require_authentication?: boolean | null
          room_name: string
          room_url: string
          status?: string
          title: string
          transcription_processed_at?: string | null
          transcription_status?: string | null
          transcription_text?: string | null
          transcription_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          case_id?: string
          created_at?: string
          daily_room_name?: string
          description?: string | null
          enable_recording?: boolean
          ended_at?: string | null
          expires_at?: string
          id?: string
          is_private?: boolean | null
          knocking_enabled?: boolean | null
          max_participants?: number | null
          participants_log?: Json | null
          recording_started_at?: string | null
          recording_status?: string | null
          recording_url?: string | null
          require_authentication?: boolean | null
          room_name?: string
          room_url?: string
          status?: string
          title?: string
          transcription_processed_at?: string | null
          transcription_status?: string | null
          transcription_text?: string | null
          transcription_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      media_files_pending_transcription: {
        Row: {
          created_at: string | null
          file_type: string | null
          id: string | null
          media_type: string | null
          name: string | null
          storage_path: string | null
        }
        Insert: {
          created_at?: string | null
          file_type?: string | null
          id?: string | null
          media_type?: string | null
          name?: string | null
          storage_path?: string | null
        }
        Update: {
          created_at?: string | null
          file_type?: string | null
          id?: string | null
          media_type?: string | null
          name?: string | null
          storage_path?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      case_status:
        | "active"
        | "discovery"
        | "pending"
        | "review"
        | "closed"
        | "archived"
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
    Enums: {
      case_status: [
        "active",
        "discovery",
        "pending",
        "review",
        "closed",
        "archived",
      ],
    },
  },
} as const
