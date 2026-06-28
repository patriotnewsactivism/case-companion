// Mock AI responses — used as fallback when /api/ is unavailable

export function mockChatResponse(messages: any[]): any {
  const lastMsg = messages[messages.length - 1]?.content || '';
  const response = `Based on the case documents available, here's my analysis:\n\n**Key Findings:**\n\n1. The evidence shows significant inconsistencies in the official report, particularly regarding the timeline of events.\n\n2. The 12-minute gap in body camera footage [BC-001] during the critical period raises serious questions about the chain of custody and credibility of the arresting officer's account.\n\n3. The Internal Affairs complaint [IA-001] filed two weeks before the arrest establishes a potential motive for retaliatory action.\n\n**Strategic Recommendation:**\n\nFocus on the intersection of the IA complaint timeline and the body cam gap. The defense theory of fabricated evidence gains substantial support when these two facts are presented together. Consider filing a motion to suppress based on the chain of custody issues.\n\n*Note: This is a demo response. In production with real AI connected, responses will be more detailed and cite specific passages from your documents.*\n\n---\n*This response is for educational purposes and does not constitute legal advice.*`;
  
  return {
    id: 'mock-' + Date.now(),
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content: response },
        finish_reason: 'stop',
      },
    ],
    _documentCount: 4,
  };
}

export function mockTrialSimulationResponse(body: any): any {
  return {
    id: 'sim-' + Date.now(),
    characterResponse: "Officer, can you describe what you saw when you approached the vehicle?",
    coaching: "Good opening. Keep your questions open-ended to avoid leading the witness.",
    objection: null,
    hints: ["Ask about the body cam gap", "Question chain of custody"],
    phase: body.phase || 'direct',
  };
}
