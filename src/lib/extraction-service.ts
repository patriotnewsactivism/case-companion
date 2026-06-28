import { supabase } from '@/integrations/supabase/client';
import { useCaseStore } from '@/store/useCaseStore';

export const triggerExtractionPipeline = async (documentId: string, caseId: string, rawText: string) => {
  try {
    const { data, error } = await supabase.functions.invoke('evidence-analysis', {
      body: { documentId, text: rawText, caseId }
    });

    if (error) throw new Error(error.message);
    
    // Refresh the global state instantly so the UI components update
    await useCaseStore.getState().fetchEvents(caseId);
    
    return data;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Extraction Pipeline Failure:", message);
    throw err;
  }
};