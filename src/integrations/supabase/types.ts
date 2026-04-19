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
      ai_analysis_cache: {
        Row: {
          analysis_type: string
          cache_key: string
          created_at: string
          expires_at: string | null
          id: string
          result: Json
          user_id: string
        }
        Insert: {
          analysis_type: string
          cache_key: string
          created_at?: string
          expires_at?: string | null
          id?: string
          result: Json
          user_id: string
        }
        Update: {
          analysis_type?: string
          cache_key?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          result?: Json
          user_id?: string
        }
        Relationships: []
      }
      api_usage_log: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          metadata: Json | null
          method: string | null
          response_time_ms: number | null
          status_code: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          metadata?: Json | null
          method?: string | null
          response_time_ms?: number | null
          status_code?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          metadata?: Json | null
          method?: string | null
          response_time_ms?: number | null
          status_code?: number | null
          user_id?: string
        }
        Relationships: []
      }
      case_context: {
        Row: {
          case_id: string
          content: Json | null
          context_type: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          case_id: string
          content?: Json | null
          context_type: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          case_id?: string
          content?: Json | null
          context_type?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_context_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      case_events: {
        Row: {
          case_id: string
          created_at: string
          event_data: Json | null
          event_type: string
          id: string
          user_id: string
        }
        Insert: {
          case_id: string
          created_at?: string
          event_data?: Json | null
          event_type: string
          id?: string
          user_id: string
        }
        Update: {
          case_id?: string
          created_at?: string
          event_data?: Json | null
          event_type?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_events_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      case_law_research: {
        Row: {
          case_id: string | null
          created_at: string
          id: string
          jurisdiction: string | null
          query: string
          results: Json | null
          user_id: string
        }
        Insert: {
          case_id?: string | null
          created_at?: string
          id?: string
          jurisdiction?: string | null
          query: string
          results?: Json | null
          user_id: string
        }
        Update: {
          case_id?: string | null
          created_at?: string
          id?: string
          jurisdiction?: string | null
          query?: string
          results?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_law_research_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      case_members: {
        Row: {
          case_id: string
          created_at: string
          id: string
          invited_by: string | null
          invited_email: string | null
          role: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          case_id: string
          created_at?: string
          id?: string
          invited_by?: string | null
          invited_email?: string | null
          role?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          case_id?: string
          created_at?: string
          id?: string
          invited_by?: string | null
          invited_email?: string | null
          role?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_members_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      case_strategies: {
        Row: {
          case_id: string
          content: Json | null
          created_at: string
          id: string
          recommendations: Json | null
          strategy_type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          case_id: string
          content?: Json | null
          created_at?: string
          id?: string
          recommendations?: Json | null
          strategy_type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          case_id?: string
          content?: Json | null
          created_at?: string
          id?: string
          recommendations?: Json | null
          strategy_type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_strategies_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
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
      client_communications: {
        Row: {
          attachments: string[] | null
          billable: boolean | null
          case_id: string
          client_id: string | null
          communication_type: string | null
          content: string
          created_at: string
          direction: string | null
          duration_minutes: number | null
          follow_up_completed: boolean | null
          follow_up_date: string | null
          follow_up_required: boolean | null
          id: string
          subject: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          attachments?: string[] | null
          billable?: boolean | null
          case_id: string
          client_id?: string | null
          communication_type?: string | null
          content: string
          created_at?: string
          direction?: string | null
          duration_minutes?: number | null
          follow_up_completed?: boolean | null
          follow_up_date?: string | null
          follow_up_required?: boolean | null
          id?: string
          subject?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          attachments?: string[] | null
          billable?: boolean | null
          case_id?: string
          client_id?: string | null
          communication_type?: string | null
          content?: string
          created_at?: string
          direction?: string | null
          duration_minutes?: number | null
          follow_up_completed?: boolean | null
          follow_up_date?: string | null
          follow_up_required?: boolean | null
          id?: string
          subject?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_communications_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      client_magic_links: {
        Row: {
          client_user_id: string
          created_at: string
          expires_at: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          client_user_id: string
          created_at?: string
          expires_at: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          client_user_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_magic_links_client_user_id_fkey"
            columns: ["client_user_id"]
            isOneToOne: false
            referencedRelation: "client_portal_users"
            referencedColumns: ["id"]
          },
        ]
      }
      client_password_resets: {
        Row: {
          client_user_id: string
          created_at: string
          expires_at: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          client_user_id: string
          created_at?: string
          expires_at: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          client_user_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_password_resets_client_user_id_fkey"
            columns: ["client_user_id"]
            isOneToOne: false
            referencedRelation: "client_portal_users"
            referencedColumns: ["id"]
          },
        ]
      }
      client_portal_users: {
        Row: {
          attorney_user_id: string
          case_id: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          last_login_at: string | null
          password_hash: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          attorney_user_id: string
          case_id?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          last_login_at?: string | null
          password_hash?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          attorney_user_id?: string
          case_id?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          last_login_at?: string | null
          password_hash?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_portal_users_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      conflict_checks: {
        Row: {
          conflicts_found: number | null
          created_at: string
          id: string
          results: Json | null
          search_name: string
          search_type: string | null
          user_id: string
        }
        Insert: {
          conflicts_found?: number | null
          created_at?: string
          id?: string
          results?: Json | null
          search_name: string
          search_type?: string | null
          user_id: string
        }
        Update: {
          conflicts_found?: number | null
          created_at?: string
          id?: string
          results?: Json | null
          search_name?: string
          search_type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      court_dates: {
        Row: {
          all_day: boolean | null
          case_id: string
          courtroom: string | null
          created_at: string
          description: string | null
          end_time: string | null
          event_date: string
          event_type: string
          id: string
          judge_name: string | null
          location: string | null
          notes: string | null
          outcome: string | null
          reminder_days: number | null
          reminder_sent: boolean | null
          start_time: string | null
          status: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          all_day?: boolean | null
          case_id: string
          courtroom?: string | null
          created_at?: string
          description?: string | null
          end_time?: string | null
          event_date: string
          event_type: string
          id?: string
          judge_name?: string | null
          location?: string | null
          notes?: string | null
          outcome?: string | null
          reminder_days?: number | null
          reminder_sent?: boolean | null
          start_time?: string | null
          status?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          all_day?: boolean | null
          case_id?: string
          courtroom?: string | null
          created_at?: string
          description?: string | null
          end_time?: string | null
          event_date?: string
          event_type?: string
          id?: string
          judge_name?: string | null
          location?: string | null
          notes?: string | null
          outcome?: string | null
          reminder_days?: number | null
          reminder_sent?: boolean | null
          start_time?: string | null
          status?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "court_dates_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      depositions: {
        Row: {
          case_id: string
          court_reporter: string | null
          created_at: string
          deponent_contact: string | null
          deponent_email: string | null
          deponent_name: string
          deponent_type: string | null
          duration_estimate_hours: number | null
          follow_up_items: string[] | null
          id: string
          key_testimony: string[] | null
          location: string | null
          location_type: string | null
          objections_notes: string | null
          scheduled_date: string | null
          scheduled_time: string | null
          status: string | null
          summary: string | null
          transcript_url: string | null
          updated_at: string
          user_id: string
          video_url: string | null
          videographer: string | null
        }
        Insert: {
          case_id: string
          court_reporter?: string | null
          created_at?: string
          deponent_contact?: string | null
          deponent_email?: string | null
          deponent_name: string
          deponent_type?: string | null
          duration_estimate_hours?: number | null
          follow_up_items?: string[] | null
          id?: string
          key_testimony?: string[] | null
          location?: string | null
          location_type?: string | null
          objections_notes?: string | null
          scheduled_date?: string | null
          scheduled_time?: string | null
          status?: string | null
          summary?: string | null
          transcript_url?: string | null
          updated_at?: string
          user_id: string
          video_url?: string | null
          videographer?: string | null
        }
        Update: {
          case_id?: string
          court_reporter?: string | null
          created_at?: string
          deponent_contact?: string | null
          deponent_email?: string | null
          deponent_name?: string
          deponent_type?: string | null
          duration_estimate_hours?: number | null
          follow_up_items?: string[] | null
          id?: string
          key_testimony?: string[] | null
          location?: string | null
          location_type?: string | null
          objections_notes?: string | null
          scheduled_date?: string | null
          scheduled_time?: string | null
          status?: string | null
          summary?: string | null
          transcript_url?: string | null
          updated_at?: string
          user_id?: string
          video_url?: string | null
          videographer?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "depositions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      discovery_requests: {
        Row: {
          case_id: string
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          metadata: Json | null
          objections: string | null
          request_text: string | null
          request_type: string
          requesting_party: string | null
          responding_party: string | null
          response_date: string | null
          response_text: string | null
          served_date: string | null
          status: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          case_id: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          metadata?: Json | null
          objections?: string | null
          request_text?: string | null
          request_type: string
          requesting_party?: string | null
          responding_party?: string | null
          response_date?: string | null
          response_text?: string | null
          served_date?: string | null
          status?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          case_id?: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          metadata?: Json | null
          objections?: string | null
          request_text?: string | null
          request_type?: string
          requesting_party?: string | null
          responding_party?: string | null
          response_date?: string | null
          response_text?: string | null
          served_date?: string | null
          status?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "discovery_requests_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      document_hash_cache: {
        Row: {
          created_at: string
          document_id: string | null
          file_hash: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          document_id?: string | null
          file_hash: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          document_id?: string | null
          file_hash?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_hash_cache_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_versions: {
        Row: {
          change_summary: string | null
          created_at: string
          created_by: string | null
          document_id: string
          file_size: number | null
          file_url: string | null
          id: string
          user_id: string
          version_number: number
        }
        Insert: {
          change_summary?: string | null
          created_at?: string
          created_by?: string | null
          document_id: string
          file_size?: number | null
          file_url?: string | null
          id?: string
          user_id: string
          version_number?: number
        }
        Update: {
          change_summary?: string | null
          created_at?: string
          created_by?: string | null
          document_id?: string
          file_size?: number | null
          file_url?: string | null
          id?: string
          user_id?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_versions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
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
          ocr_page_count: number | null
          ocr_processed_at: string | null
          ocr_text: string | null
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
          ocr_page_count?: number | null
          ocr_processed_at?: string | null
          ocr_text?: string | null
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
          ocr_page_count?: number | null
          ocr_processed_at?: string | null
          ocr_text?: string | null
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
      evidence_analyses: {
        Row: {
          case_id: string
          case_law_support: Json | null
          confidence_score: number | null
          created_at: string
          document_id: string | null
          evidence_description: string
          foundation_suggestions: Json | null
          id: string
          issues: Json | null
          motion_draft: string | null
          overall_admissibility: string | null
          reasoning: string | null
          user_id: string
        }
        Insert: {
          case_id: string
          case_law_support?: Json | null
          confidence_score?: number | null
          created_at?: string
          document_id?: string | null
          evidence_description: string
          foundation_suggestions?: Json | null
          id?: string
          issues?: Json | null
          motion_draft?: string | null
          overall_admissibility?: string | null
          reasoning?: string | null
          user_id: string
        }
        Update: {
          case_id?: string
          case_law_support?: Json | null
          confidence_score?: number | null
          created_at?: string
          document_id?: string | null
          evidence_description?: string
          foundation_suggestions?: Json | null
          id?: string
          issues?: Json | null
          motion_draft?: string | null
          overall_admissibility?: string | null
          reasoning?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evidence_analyses_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_analyses_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      exhibit_list: {
        Row: {
          admitted: boolean | null
          checklist_id: string
          created_at: string
          description: string
          document_id: string | null
          exhibit_number: string
          exhibit_type: string | null
          foundation_witness: string | null
          id: string
          objection_anticipated: boolean | null
          objection_response: string | null
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          admitted?: boolean | null
          checklist_id: string
          created_at?: string
          description: string
          document_id?: string | null
          exhibit_number: string
          exhibit_type?: string | null
          foundation_witness?: string | null
          id?: string
          objection_anticipated?: boolean | null
          objection_response?: string | null
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          admitted?: boolean | null
          checklist_id?: string
          created_at?: string
          description?: string
          document_id?: string | null
          exhibit_number?: string
          exhibit_type?: string | null
          foundation_witness?: string | null
          id?: string
          objection_anticipated?: boolean | null
          objection_response?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exhibit_list_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "trial_prep_checklists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exhibit_list_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      export_jobs: {
        Row: {
          case_id: string | null
          completed_at: string | null
          created_at: string
          error_message: string | null
          export_type: string
          file_url: string | null
          id: string
          options: Json | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          case_id?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          export_type: string
          file_url?: string | null
          id?: string
          options?: Json | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          case_id?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          export_type?: string
          file_url?: string | null
          id?: string
          options?: Json | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "export_jobs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_motions: {
        Row: {
          case_id: string | null
          content: string
          created_at: string
          id: string
          metadata: Json | null
          motion_type: string | null
          status: string | null
          template_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          case_id?: string | null
          content: string
          created_at?: string
          id?: string
          metadata?: Json | null
          motion_type?: string | null
          status?: string | null
          template_id?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          case_id?: string | null
          content?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          motion_type?: string | null
          status?: string | null
          template_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "generated_motions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_motions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "motion_templates"
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
          failed_files: number
          id: string
          processed_files: number
          source_folder_id: string
          source_folder_name: string
          source_folder_path: string
          started_at: string | null
          status: string
          successful_files: number
          total_files: number
          updated_at: string
          user_id: string
        }
        Insert: {
          case_id: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          failed_file_details?: Json | null
          failed_files?: number
          id?: string
          processed_files?: number
          source_folder_id: string
          source_folder_name: string
          source_folder_path: string
          started_at?: string | null
          status?: string
          successful_files?: number
          total_files?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          case_id?: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          failed_file_details?: Json | null
          failed_files?: number
          id?: string
          processed_files?: number
          source_folder_id?: string
          source_folder_name?: string
          source_folder_path?: string
          started_at?: string | null
          status?: string
          successful_files?: number
          total_files?: number
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
      invoices: {
        Row: {
          amount_paid: number | null
          case_id: string
          client_address: string | null
          client_email: string | null
          client_name: string
          created_at: string
          due_date: string | null
          id: string
          invoice_number: string
          issue_date: string
          notes: string | null
          payment_terms: string | null
          status: string | null
          subtotal: number | null
          tax_amount: number | null
          tax_rate: number | null
          total_amount: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_paid?: number | null
          case_id: string
          client_address?: string | null
          client_email?: string | null
          client_name: string
          created_at?: string
          due_date?: string | null
          id?: string
          invoice_number: string
          issue_date?: string
          notes?: string | null
          payment_terms?: string | null
          status?: string | null
          subtotal?: number | null
          tax_amount?: number | null
          tax_rate?: number | null
          total_amount?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_paid?: number | null
          case_id?: string
          client_address?: string | null
          client_email?: string | null
          client_name?: string
          created_at?: string
          due_date?: string | null
          id?: string
          invoice_number?: string
          issue_date?: string
          notes?: string | null
          payment_terms?: string | null
          status?: string | null
          subtotal?: number | null
          tax_amount?: number | null
          tax_rate?: number | null
          total_amount?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      judicial_profiles: {
        Row: {
          court: string | null
          created_at: string
          id: string
          judge_name: string
          jurisdiction: string | null
          profile_data: Json | null
          rulings_summary: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          court?: string | null
          created_at?: string
          id?: string
          judge_name: string
          jurisdiction?: string | null
          profile_data?: Json | null
          rulings_summary?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          court?: string | null
          created_at?: string
          id?: string
          judge_name?: string
          jurisdiction?: string | null
          profile_data?: Json | null
          rulings_summary?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      jury_instructions: {
        Row: {
          argument_notes: string | null
          checklist_id: string
          created_at: string
          id: string
          instruction_number: string | null
          instruction_text: string
          instruction_type: string | null
          opposition_position: string | null
          source: string | null
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          argument_notes?: string | null
          checklist_id: string
          created_at?: string
          id?: string
          instruction_number?: string | null
          instruction_text: string
          instruction_type?: string | null
          opposition_position?: string | null
          source?: string | null
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          argument_notes?: string | null
          checklist_id?: string
          created_at?: string
          id?: string
          instruction_number?: string | null
          instruction_text?: string
          instruction_type?: string | null
          opposition_position?: string | null
          source?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "jury_instructions_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "trial_prep_checklists"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_briefs: {
        Row: {
          brief_type: string | null
          case_id: string | null
          citations: Json | null
          content: string
          created_at: string
          id: string
          status: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          brief_type?: string | null
          case_id?: string | null
          citations?: Json | null
          content: string
          created_at?: string
          id?: string
          status?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          brief_type?: string | null
          case_id?: string | null
          citations?: Json | null
          content?: string
          created_at?: string
          id?: string
          status?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_briefs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      mock_jury_sessions: {
        Row: {
          argument_text: string | null
          case_id: string
          created_at: string
          deliberation: Json | null
          final_verdict: string | null
          id: string
          jury_composition: Json | null
          user_id: string
          verdicts: Json | null
        }
        Insert: {
          argument_text?: string | null
          case_id: string
          created_at?: string
          deliberation?: Json | null
          final_verdict?: string | null
          id?: string
          jury_composition?: Json | null
          user_id: string
          verdicts?: Json | null
        }
        Update: {
          argument_text?: string | null
          case_id?: string
          created_at?: string
          deliberation?: Json | null
          final_verdict?: string | null
          id?: string
          jury_composition?: Json | null
          user_id?: string
          verdicts?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "mock_jury_sessions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      motion_suggestions: {
        Row: {
          case_id: string | null
          created_at: string
          id: string
          metadata: Json | null
          motion_title: string | null
          priority: string | null
          rationale: string | null
          suggestion_type: string | null
          user_id: string
        }
        Insert: {
          case_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          motion_title?: string | null
          priority?: string | null
          rationale?: string | null
          suggestion_type?: string | null
          user_id: string
        }
        Update: {
          case_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          motion_title?: string | null
          priority?: string | null
          rationale?: string | null
          suggestion_type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "motion_suggestions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      motion_templates: {
        Row: {
          created_at: string
          id: string
          is_public: boolean | null
          jurisdiction: string | null
          motion_type: string | null
          name: string
          template_text: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_public?: boolean | null
          jurisdiction?: string | null
          motion_type?: string | null
          name: string
          template_text: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_public?: boolean | null
          jurisdiction?: string | null
          motion_type?: string | null
          name?: string
          template_text?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      motions_in_limine: {
        Row: {
          checklist_id: string
          created_at: string
          description: string | null
          filed_by: string | null
          filing_date: string | null
          hearing_date: string | null
          id: string
          legal_basis: string | null
          motion_title: string
          motion_type: string | null
          ruling_notes: string | null
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          checklist_id: string
          created_at?: string
          description?: string | null
          filed_by?: string | null
          filing_date?: string | null
          hearing_date?: string | null
          id?: string
          legal_basis?: string | null
          motion_title: string
          motion_type?: string | null
          ruling_notes?: string | null
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          checklist_id?: string
          created_at?: string
          description?: string | null
          filed_by?: string | null
          filing_date?: string | null
          hearing_date?: string | null
          id?: string
          legal_basis?: string | null
          motion_title?: string
          motion_type?: string | null
          ruling_notes?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "motions_in_limine_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "trial_prep_checklists"
            referencedColumns: ["id"]
          },
        ]
      }
      ocr_queue: {
        Row: {
          attempts: number | null
          case_id: string | null
          completed_at: string | null
          created_at: string
          document_id: string | null
          error_message: string | null
          id: string
          priority: number | null
          result: Json | null
          started_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number | null
          case_id?: string | null
          completed_at?: string | null
          created_at?: string
          document_id?: string | null
          error_message?: string | null
          id?: string
          priority?: number | null
          result?: Json | null
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number | null
          case_id?: string | null
          completed_at?: string | null
          created_at?: string
          document_id?: string | null
          error_message?: string | null
          id?: string
          priority?: number | null
          result?: Json | null
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ocr_queue_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocr_queue_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          settings: Json | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          settings?: Json | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          settings?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      privilege_log_entries: {
        Row: {
          author: string | null
          case_id: string
          created_at: string
          document_date: string | null
          document_description: string
          document_id: string | null
          id: string
          privilege_basis: string | null
          privilege_type: string | null
          recipients: string | null
          user_id: string
        }
        Insert: {
          author?: string | null
          case_id: string
          created_at?: string
          document_date?: string | null
          document_description: string
          document_id?: string | null
          id?: string
          privilege_basis?: string | null
          privilege_type?: string | null
          recipients?: string | null
          user_id: string
        }
        Update: {
          author?: string | null
          case_id?: string
          created_at?: string
          document_date?: string | null
          document_description?: string
          document_id?: string | null
          id?: string
          privilege_basis?: string | null
          privilege_type?: string | null
          recipients?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "privilege_log_entries_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "privilege_log_entries_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      processing_queue: {
        Row: {
          attempts: number | null
          case_id: string | null
          completed_at: string | null
          created_at: string
          document_id: string | null
          error_message: string | null
          id: string
          job_type: string
          payload: Json | null
          priority: number | null
          result: Json | null
          started_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number | null
          case_id?: string | null
          completed_at?: string | null
          created_at?: string
          document_id?: string | null
          error_message?: string | null
          id?: string
          job_type: string
          payload?: Json | null
          priority?: number | null
          result?: Json | null
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number | null
          case_id?: string | null
          completed_at?: string | null
          created_at?: string
          document_id?: string | null
          error_message?: string | null
          id?: string
          job_type?: string
          payload?: Json | null
          priority?: number | null
          result?: Json | null
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "processing_queue_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processing_queue_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
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
      rate_limit_status: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          request_count: number | null
          updated_at: string
          user_id: string
          window_start: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          request_count?: number | null
          updated_at?: string
          user_id: string
          window_start?: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          request_count?: number | null
          updated_at?: string
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
      research_notes: {
        Row: {
          ai_summary: string | null
          applicable_to_case: boolean | null
          case_citations: string[] | null
          case_id: string | null
          content: string
          created_at: string
          id: string
          jurisdiction: string | null
          key_findings: string[] | null
          research_topic: string | null
          source_urls: string[] | null
          statute_references: string[] | null
          tags: string[] | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_summary?: string | null
          applicable_to_case?: boolean | null
          case_citations?: string[] | null
          case_id?: string | null
          content: string
          created_at?: string
          id?: string
          jurisdiction?: string | null
          key_findings?: string[] | null
          research_topic?: string | null
          source_urls?: string[] | null
          statute_references?: string[] | null
          tags?: string[] | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_summary?: string | null
          applicable_to_case?: boolean | null
          case_citations?: string[] | null
          case_id?: string | null
          content?: string
          created_at?: string
          id?: string
          jurisdiction?: string | null
          key_findings?: string[] | null
          research_topic?: string | null
          source_urls?: string[] | null
          statute_references?: string[] | null
          tags?: string[] | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_notes_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      settlement_analyses: {
        Row: {
          case_id: string
          confidence_score: number | null
          created_at: string
          damages: Json | null
          factors: Json | null
          id: string
          recommendation: string | null
          settlement_range: Json | null
          user_id: string
        }
        Insert: {
          case_id: string
          confidence_score?: number | null
          created_at?: string
          damages?: Json | null
          factors?: Json | null
          id?: string
          recommendation?: string | null
          settlement_range?: Json | null
          user_id: string
        }
        Update: {
          case_id?: string
          confidence_score?: number | null
          created_at?: string
          damages?: Json | null
          factors?: Json | null
          id?: string
          recommendation?: string | null
          settlement_range?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "settlement_analyses_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entries: {
        Row: {
          billable: boolean | null
          case_id: string
          created_at: string
          description: string
          duration_minutes: number
          end_time: string | null
          entry_date: string
          hourly_rate: number | null
          id: string
          invoice_id: string | null
          notes: string | null
          start_time: string | null
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          billable?: boolean | null
          case_id: string
          created_at?: string
          description: string
          duration_minutes?: number
          end_time?: string | null
          entry_date?: string
          hourly_rate?: number | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          start_time?: string | null
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          billable?: boolean | null
          case_id?: string
          created_at?: string
          description?: string
          duration_minutes?: number
          end_time?: string | null
          entry_date?: string
          hourly_rate?: number | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          start_time?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
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
      token_blacklist: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          token_hash: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          token_hash: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          token_hash?: string
        }
        Relationships: []
      }
      transcription_cache: {
        Row: {
          created_at: string
          file_hash: string
          id: string
          metadata: Json | null
          transcription: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_hash: string
          id?: string
          metadata?: Json | null
          transcription: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_hash?: string
          id?: string
          metadata?: Json | null
          transcription?: string
          user_id?: string
        }
        Relationships: []
      }
      trial_prep_checklists: {
        Row: {
          case_id: string
          created_at: string
          id: string
          notes: string | null
          status: string | null
          trial_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          case_id: string
          created_at?: string
          id?: string
          notes?: string | null
          status?: string | null
          trial_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          case_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          status?: string | null
          trial_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trial_prep_checklists_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      trial_session_analytics: {
        Row: {
          created_at: string
          id: string
          metric_data: Json | null
          metric_name: string
          metric_value: number | null
          session_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          metric_data?: Json | null
          metric_name: string
          metric_value?: number | null
          session_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          metric_data?: Json | null
          metric_name?: string
          metric_value?: number | null
          session_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trial_session_analytics_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "trial_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      trial_sessions: {
        Row: {
          audio_url: string | null
          case_id: string | null
          created_at: string
          duration_seconds: number
          feedback: string | null
          id: string
          metrics: Json | null
          mode: string
          phase: string
          score: number | null
          transcript: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          audio_url?: string | null
          case_id?: string | null
          created_at?: string
          duration_seconds?: number
          feedback?: string | null
          id?: string
          metrics?: Json | null
          mode?: string
          phase?: string
          score?: number | null
          transcript?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          audio_url?: string | null
          case_id?: string | null
          created_at?: string
          duration_seconds?: number
          feedback?: string | null
          id?: string
          metrics?: Json | null
          mode?: string
          phase?: string
          score?: number | null
          transcript?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trial_sessions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      trial_simulation_sessions: {
        Row: {
          case_id: string | null
          created_at: string
          id: string
          metadata: Json | null
          outcome: string | null
          scenario: string | null
          score: number | null
          transcript: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          case_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          outcome?: string | null
          scenario?: string | null
          score?: number | null
          transcript?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          case_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          outcome?: string | null
          scenario?: string | null
          score?: number | null
          transcript?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trial_simulation_sessions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      video_room_participants: {
        Row: {
          created_at: string
          id: string
          joined_at: string | null
          left_at: string | null
          participant_email: string | null
          participant_name: string | null
          role: string | null
          user_id: string | null
          video_room_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          joined_at?: string | null
          left_at?: string | null
          participant_email?: string | null
          participant_name?: string | null
          role?: string | null
          user_id?: string | null
          video_room_id: string
        }
        Update: {
          created_at?: string
          id?: string
          joined_at?: string | null
          left_at?: string | null
          participant_email?: string | null
          participant_name?: string | null
          role?: string | null
          user_id?: string | null
          video_room_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_room_participants_video_room_id_fkey"
            columns: ["video_room_id"]
            isOneToOne: false
            referencedRelation: "video_rooms"
            referencedColumns: ["id"]
          },
        ]
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
          recording_url: string | null
          room_name: string
          room_url: string
          status: string
          title: string
          transcription_text: string | null
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
          recording_url?: string | null
          room_name: string
          room_url: string
          status?: string
          title: string
          transcription_text?: string | null
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
          recording_url?: string | null
          room_name?: string
          room_url?: string
          status?: string
          title?: string
          transcription_text?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_rooms_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      witness_prep: {
        Row: {
          anticipated_cross: string | null
          checklist_id: string
          contact_info: string | null
          created_at: string
          id: string
          order_of_appearance: number | null
          prep_date: string | null
          prep_notes: string | null
          prep_status: string | null
          subpoena_served: boolean | null
          testimony_summary: string | null
          updated_at: string
          user_id: string
          witness_name: string
          witness_type: string | null
        }
        Insert: {
          anticipated_cross?: string | null
          checklist_id: string
          contact_info?: string | null
          created_at?: string
          id?: string
          order_of_appearance?: number | null
          prep_date?: string | null
          prep_notes?: string | null
          prep_status?: string | null
          subpoena_served?: boolean | null
          testimony_summary?: string | null
          updated_at?: string
          user_id: string
          witness_name: string
          witness_type?: string | null
        }
        Update: {
          anticipated_cross?: string | null
          checklist_id?: string
          contact_info?: string | null
          created_at?: string
          id?: string
          order_of_appearance?: number | null
          prep_date?: string | null
          prep_notes?: string | null
          prep_status?: string | null
          subpoena_served?: boolean | null
          testimony_summary?: string | null
          updated_at?: string
          user_id?: string
          witness_name?: string
          witness_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "witness_prep_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "trial_prep_checklists"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_case_member: {
        Args: { _case_id: string; _user_id: string }
        Returns: boolean
      }
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
