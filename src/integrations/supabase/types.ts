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
          case_theory: string | null
          case_type: string
          client_name: string
          created_at: string
          id: string
          key_issues: string[] | null
          name: string
          next_deadline: string | null
          notes: string | null
          representation: Database["public"]["Enums"]["representation_type"]
          status: Database["public"]["Enums"]["case_status"]
          updated_at: string
          user_id: string
          winning_factors: string[] | null
        }
        Insert: {
          case_theory?: string | null
          case_type: string
          client_name: string
          created_at?: string
          id?: string
          key_issues?: string[] | null
          name: string
          next_deadline?: string | null
          notes?: string | null
          representation?: Database["public"]["Enums"]["representation_type"]
          status?: Database["public"]["Enums"]["case_status"]
          updated_at?: string
          user_id: string
          winning_factors?: string[] | null
        }
        Update: {
          case_theory?: string | null
          case_type?: string
          client_name?: string
          created_at?: string
          id?: string
          key_issues?: string[] | null
          name?: string
          next_deadline?: string | null
          notes?: string | null
          representation?: Database["public"]["Enums"]["representation_type"]
          status?: Database["public"]["Enums"]["case_status"]
          updated_at?: string
          user_id?: string
          winning_factors?: string[] | null
        }
        Relationships: []
      }
      documents: {
        Row: {
          action_items: string[] | null
          adverse_findings: string[] | null
          ai_analyzed: boolean | null
          bates_number: string | null
          case_id: string
          created_at: string
          favorable_findings: string[] | null
          file_size: number | null
          file_type: string | null
          file_url: string | null
          id: string
          key_facts: string[] | null
          name: string
          summary: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          action_items?: string[] | null
          adverse_findings?: string[] | null
          ai_analyzed?: boolean | null
          bates_number?: string | null
          case_id: string
          created_at?: string
          favorable_findings?: string[] | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          key_facts?: string[] | null
          name: string
          summary?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          action_items?: string[] | null
          adverse_findings?: string[] | null
          ai_analyzed?: boolean | null
          bates_number?: string | null
          case_id?: string
          created_at?: string
          favorable_findings?: string[] | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          key_facts?: string[] | null
          name?: string
          summary?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          firm_name: string | null
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          firm_name?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          firm_name?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      timeline_events: {
        Row: {
          case_id: string
          created_at: string
          description: string | null
          event_date: string
          event_type: string | null
          id: string
          importance: string | null
          linked_document_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          case_id: string
          created_at?: string
          description?: string | null
          event_date: string
          event_type?: string | null
          id?: string
          importance?: string | null
          linked_document_id?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          case_id?: string
          created_at?: string
          description?: string | null
          event_date?: string
          event_type?: string | null
          id?: string
          importance?: string | null
          linked_document_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "timeline_events_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timeline_events_linked_document_id_fkey"
            columns: ["linked_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
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
      representation_type:
        | "plaintiff"
        | "defendant"
        | "executor"
        | "petitioner"
        | "respondent"
        | "other"
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
      representation_type: [
        "plaintiff",
        "defendant",
        "executor",
        "petitioner",
        "respondent",
        "other",
      ],
    },
  },
} as const
