export type VoiceCommandCategory = 'navigation' | 'document' | 'evidence' | 'timeline' | 'action';

export interface VoiceCommand {
  id: string;
  pattern: string;
  handler: (params: Record<string, string>) => void | Promise<void>;
  description: string;
  category: VoiceCommandCategory;
  examples?: string[];
}

export interface ParsedCommand {
  command: VoiceCommand;
  params: Record<string, string>;
}

export interface VoiceCommandRegistry {
  register: (command: VoiceCommand) => void;
  unregister: (id: string) => void;
  parse: (transcript: string) => ParsedCommand | null;
  getAll: () => VoiceCommand[];
  getByCategory: (category: VoiceCommandCategory) => VoiceCommand[];
  clear: () => void;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function patternToRegex(pattern: string): { regex: RegExp; paramNames: string[] } {
  const paramNames: string[] = [];
  
  const regexPattern = pattern
    .replace(/\(([^)]+)\)/g, (_, group) => {
      const options = group.split('|').map((s: string) => escapeRegex(s.trim()));
      return `(?:${options.join('|')})`;
    })
    .replace(/\{(\w+)\}/g, (_, paramName: string) => {
      paramNames.push(paramName);
      return '(.+?)';
    });
  
  return {
    regex: new RegExp(`^${regexPattern}$`, 'i'),
    paramNames,
  };
}

function createCommandRegistry(): VoiceCommandRegistry {
  const commands = new Map<string, VoiceCommand>();
  const compiledPatterns = new Map<string, { regex: RegExp; paramNames: string[] }>();

  return {
    register(command: VoiceCommand): void {
      if (commands.has(command.id)) {
        console.warn(`Voice command "${command.id}" already registered, replacing.`);
      }
      
      commands.set(command.id, command);
      
      const { regex, paramNames } = patternToRegex(command.pattern);
      compiledPatterns.set(command.id, { regex, paramNames });
    },

    unregister(id: string): void {
      commands.delete(id);
      compiledPatterns.delete(id);
    },

    parse(transcript: string): ParsedCommand | null {
      const normalizedTranscript = transcript.toLowerCase().trim();
      
      for (const [id, command] of commands) {
        const compiled = compiledPatterns.get(id);
        if (!compiled) continue;

        const match = normalizedTranscript.match(compiled.regex);
        if (match) {
          const params: Record<string, string> = {};

          compiled.paramNames.forEach((paramName, index) => {
            params[paramName] = match[index + 1]?.trim() || '';
          });
          
          return { command, params };
        }
      }
      
      return null;
    },

    getAll(): VoiceCommand[] {
      return Array.from(commands.values());
    },

    getByCategory(category: VoiceCommandCategory): VoiceCommand[] {
      return Array.from(commands.values()).filter(cmd => cmd.category === category);
    },

    clear(): void {
      commands.clear();
      compiledPatterns.clear();
    },
  };
}

export const globalCommandRegistry = createCommandRegistry();

export function getDefaultCommands(handlers: {
  onSearch?: (query: string) => void;
  onFindDocument?: (name: string) => void;
  onAnalyzeDocument?: () => void;
  onObjection?: (type: string) => void;
  onCheckAdmissible?: () => void;
  onCheckRelevance?: () => void;
  onAddEvent?: (date: string) => void;
  onShowTimeline?: () => void;
  onNavigate?: (section: string) => void;
  onOpenCase?: (name: string) => void;
  onStartTranscription?: () => void;
  onStopTranscription?: () => void;
  onNewVideoCall?: () => void;
  onRunMockJury?: () => void;
} = {}): VoiceCommand[] {
  return [
  {
    id: 'search',
    pattern: 'search for {query}',
    handler: (params) => handlers.onSearch?.(params.query),
    description: 'Search for documents or content',
    category: 'document',
    examples: ['search for contract', 'search for motion to dismiss'],
  },
  {
    id: 'find-doc',
    pattern: 'find document {name}',
    handler: (params) => handlers.onFindDocument?.(params.name),
    description: 'Find a specific document by name',
    category: 'document',
    examples: ['find document exhibit A', 'find document contract'],
  },
  {
    id: 'analyze-doc',
    pattern: 'analyze (this | the) document',
    handler: () => handlers.onAnalyzeDocument?.(),
    description: 'Analyze the current document',
    category: 'document',
    examples: ['analyze this document', 'analyze the document'],
  },
  {
    id: 'objection-hearsay',
    pattern: 'objection hearsay',
    handler: () => handlers.onObjection?.('hearsay'),
    description: 'Register a hearsay objection',
    category: 'evidence',
    examples: ['objection hearsay'],
  },
  {
    id: 'objection-relevance',
    pattern: 'objection relevance',
    handler: () => handlers.onObjection?.('relevance'),
    description: 'Register a relevance objection',
    category: 'evidence',
    examples: ['objection relevance'],
  },
  {
    id: 'objection-leading',
    pattern: 'objection leading',
    handler: () => handlers.onObjection?.('leading'),
    description: 'Register a leading question objection',
    category: 'evidence',
    examples: ['objection leading'],
  },
  {
    id: 'objection-speculative',
    pattern: 'objection speculative',
    handler: () => handlers.onObjection?.('speculative'),
    description: 'Register a speculative objection',
    category: 'evidence',
    examples: ['objection speculative'],
  },
  {
    id: 'check-admissible',
    pattern: 'is (this | it) admissible',
    handler: () => handlers.onCheckAdmissible?.(),
    description: 'Check if evidence is admissible',
    category: 'evidence',
    examples: ['is this admissible', 'is it admissible'],
  },
  {
    id: 'check-relevance',
    pattern: 'check relevance',
    handler: () => handlers.onCheckRelevance?.(),
    description: 'Check the relevance of current evidence',
    category: 'evidence',
    examples: ['check relevance'],
  },
  {
    id: 'add-event',
    pattern: 'add event (on | for) {date}',
    handler: (params) => handlers.onAddEvent?.(params.date),
    description: 'Add a timeline event',
    category: 'timeline',
    examples: ['add event on January 15th', 'add event for tomorrow'],
  },
  {
    id: 'show-timeline',
    pattern: 'show timeline',
    handler: () => handlers.onShowTimeline?.(),
    description: 'Display the case timeline',
    category: 'timeline',
    examples: ['show timeline'],
  },
  {
    id: 'navigate',
    pattern: 'go to {section}',
    handler: (params) => handlers.onNavigate?.(params.section),
    description: 'Navigate to a section',
    category: 'navigation',
    examples: ['go to documents', 'go to evidence', 'go to timeline'],
  },
  {
    id: 'open-case',
    pattern: 'open case {name}',
    handler: (params) => handlers.onOpenCase?.(params.name),
    description: 'Open a specific case',
    category: 'navigation',
    examples: ['open case Smith vs Jones', 'open case Johnson'],
  },
  {
    id: 'start-transcription',
    pattern: 'start transcription',
    handler: () => handlers.onStartTranscription?.(),
    description: 'Start real-time transcription',
    category: 'action',
    examples: ['start transcription'],
  },
  {
    id: 'stop-transcription',
    pattern: 'stop transcription',
    handler: () => handlers.onStopTranscription?.() ?? handlers.onStartTranscription?.(),
    description: 'Stop current transcription',
    category: 'action',
    examples: ['stop transcription'],
  },
  {
    id: 'new-video',
    pattern: '(new | start) video call',
    handler: () => handlers.onNewVideoCall?.(),
    description: 'Start a new video call',
    category: 'action',
    examples: ['new video call', 'start video call'],
  },
  {
    id: 'mock-jury',
    pattern: 'run mock jury',
    handler: () => handlers.onRunMockJury?.(),
    description: 'Run a mock jury simulation',
    category: 'action',
    examples: ['run mock jury'],
  },
  ];
}

export function registerDefaultCommands(handlers?: Parameters<typeof getDefaultCommands>[0]): void {
  const commands = getDefaultCommands(handlers);
  commands.forEach(cmd => globalCommandRegistry.register(cmd));
}

export { createCommandRegistry };
