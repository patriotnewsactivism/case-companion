import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';

export interface CaseEvent {
  id: string;
  case_id: string;
  source_doc_id: string;
  event_date: string;
  event_title: string;
  description: string;
  extracted_entities: string[];
}

interface CaseState {
  events: CaseEvent[];
  isLoading: boolean;
  error: string | null;
  fetchEvents: (caseId: string) => Promise<void>;
  getAggregatedContext: () => string;
}

export const useCaseStore = create<CaseState>((set, get) => ({
  events: [],
  isLoading: false,
  error: null,

  fetchEvents: async (caseId: string) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await (supabase as any)
        .from('case_events')
        .select('*')
        .eq('case_id', caseId)
        .order('event_date', { ascending: true });

      if (error) throw error;
      set({ events: data as CaseEvent[], isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  getAggregatedContext: () => {
    const { events } = get();
    if (!events.length) return "No timeline events established yet.";
    return events.map(e => `[${e.event_date}] ${e.event_title}: ${e.description}`).join("\n");
  }
}));