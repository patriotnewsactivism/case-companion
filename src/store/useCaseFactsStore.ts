import { create } from 'zustand';

// Define the structure for a case event
export interface CaseEvent {
  date: string; // YYYY-MM-DD format
  event_title: string;
  description: string;
  source_doc_id: string;
}

// Define the structure for extracted entities from documents
export interface ExtractedEntity {
  id: string;
  text: string;
  type: string; // e.g., "person", "organization", "location", "date"
  documentId: string;
  confidence: number;
}

// Define the structure for extracted facts from documents
export interface ExtractedFact {
  id: string;
  text: string;
  documentId: string;
  confidence: number;
  relatedEntities: string[]; // Array of entity IDs
}

// Define the structure for extracted dates from documents
export interface ExtractedDate {
  id: string;
  date: string; // YYYY-MM-DD format
  text: string; // Original text from the document
  documentId: string;
}

// Define the state structure for all case facts
export interface CaseFactsState {
  // Events stored by case ID
  eventsByCase: Record<string, CaseEvent[]>;
  // Entities stored by case ID
  entitiesByCase: Record<string, ExtractedEntity[]>;
  // Facts stored by case ID
  factsByCase: Record<string, ExtractedFact[]>;
  // Dates stored by case ID
  datesByCase: Record<string, ExtractedDate[]>;

  // Methods to manage events
  addEvents: (caseId: string, events: CaseEvent[]) => void;
  addEvent: (caseId: string, event: CaseEvent) => void;
  clearEvents: (caseId: string) => void;
  getEvents: (caseId: string) => CaseEvent[];

  // Methods to manage entities
  addEntities: (caseId: string, entities: ExtractedEntity[]) => void;
  addEntity: (caseId: string, entity: ExtractedEntity) => void;
  clearEntities: (caseId: string) => void;
  getEntities: (caseId: string) => ExtractedEntity[];

  // Methods to manage facts
  addFacts: (caseId: string, facts: ExtractedFact[]) => void;
  addFact: (caseId: string, fact: ExtractedFact) => void;
  clearFacts: (caseId: string) => void;
  getFacts: (caseId: string) => ExtractedFact[];

  // Methods to manage dates
  addDates: (caseId: string, dates: ExtractedDate[]) => void;
  addDate: (caseId: string, date: ExtractedDate) => void;
  clearDates: (caseId: string) => void;
  getDates: (caseId: string) => ExtractedDate[];

  // Clear all data for a specific case
  clearCaseData: (caseId: string) => void;
}

// Create the Zustand store
export const useCaseFactsStore = create<CaseFactsState>((set, get) => ({
  // Initial state
  eventsByCase: {},
  entitiesByCase: {},
  factsByCase: {},
  datesByCase: {},

  // Event management methods
  addEvents: (caseId, events) => {
    set((state) => ({
      eventsByCase: {
        ...state.eventsByCase,
        [caseId]: [...(state.eventsByCase[caseId] || []), ...events],
      },
    }));
  },

  addEvent: (caseId, event) => {
    set((state) => ({
      eventsByCase: {
        ...state.eventsByCase,
        [caseId]: [...(state.eventsByCase[caseId] || []), event],
      },
    }));
  },

  clearEvents: (caseId) => {
    set((state) => ({
      eventsByCase: {
        ...state.eventsByCase,
        [caseId]: [],
      },
    }));
  },

  getEvents: (caseId) => {
    return get().eventsByCase[caseId] || [];
  },

  // Entity management methods
  addEntities: (caseId, entities) => {
    set((state) => ({
      entitiesByCase: {
        ...state.entitiesByCase,
        [caseId]: [...(state.entitiesByCase[caseId] || []), ...entities],
      },
    }));
  },

  addEntity: (caseId, entity) => {
    set((state) => ({
      entitiesByCase: {
        ...state.entitiesByCase,
        [caseId]: [...(state.entitiesByCase[caseId] || []), entity],
      },
    }));
  },

  clearEntities: (caseId) => {
    set((state) => ({
      entitiesByCase: {
        ...state.entitiesByCase,
        [caseId]: [],
      },
    }));
  },

  getEntities: (caseId) => {
    return get().entitiesByCase[caseId] || [];
  },

  // Fact management methods
  addFacts: (caseId, facts) => {
    set((state) => ({
      factsByCase: {
        ...state.factsByCase,
        [caseId]: [...(state.factsByCase[caseId] || []), ...facts],
      },
    }));
  },

  addFact: (caseId, fact) => {
    set((state) => ({
      factsByCase: {
        ...state.factsByCase,
        [caseId]: [...(state.factsByCase[caseId] || []), fact],
      },
    }));
  },

  clearFacts: (caseId) => {
    set((state) => ({
      factsByCase: {
        ...state.factsByCase,
        [caseId]: [],
      },
    }));
  },

  getFacts: (caseId) => {
    return get().factsByCase[caseId] || [];
  },

  // Date management methods
  addDates: (caseId, dates) => {
    set((state) => ({
      datesByCase: {
        ...state.datesByCase,
        [caseId]: [...(state.datesByCase[caseId] || []), ...dates],
      },
    }));
  },

  addDate: (caseId, date) => {
    set((state) => ({
      datesByCase: {
        ...state.datesByCase,
        [caseId]: [...(state.datesByCase[caseId] || []), date],
      },
    }));
  },

  clearDates: (caseId) => {
    set((state) => ({
      datesByCase: {
        ...state.datesByCase,
        [caseId]: [],
      },
    }));
  },

  getDates: (caseId) => {
    return get().datesByCase[caseId] || [];
  },

  // Clear all data for a specific case
  clearCaseData: (caseId) => {
    set((state) => ({
      eventsByCase: {
        ...state.eventsByCase,
        [caseId]: [],
      },
      entitiesByCase: {
        ...state.entitiesByCase,
        [caseId]: [],
      },
      factsByCase: {
        ...state.factsByCase,
        [caseId]: [],
      },
      datesByCase: {
        ...state.datesByCase,
        [caseId]: [],
      },
    }));
  },
}));