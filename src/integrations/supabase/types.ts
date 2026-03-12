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
