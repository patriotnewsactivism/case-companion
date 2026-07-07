import { describe, expect, it } from 'vitest';

import {
  getGenerateContentCapableGeminiModels,
  getPreferredGeminiCandidates,
  normalizeGeminiModelName,
  rankGeminiModels,
} from '../../supabase/functions/_shared/gemini-model-utils';

describe('gemini model utils', () => {
  it('normalizes model names from list endpoint', () => {
    expect(normalizeGeminiModelName('models/gemini-2.0-flash')).toBe('gemini-2.0-flash');
  });

  it('extracts only generateContent-capable gemini models', () => {
    const models = getGenerateContentCapableGeminiModels({
      models: [
        { name: 'models/gemini-2.0-flash', supportedGenerationMethods: ['generateContent'] },
        { name: 'models/gemini-2.0-pro', supportedGenerationMethods: ['embedContent'] },
        { name: 'models/text-embedding-004', supportedGenerationMethods: ['embedContent'] },
      ],
    });

    expect(models).toEqual(['gemini-2.0-flash']);
  });

  it('ranks preferred configured model first when available', () => {
    const preferred = getPreferredGeminiCandidates('gemini-2.5-pro');
    const ranked = rankGeminiModels(preferred, ['gemini-1.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash']);

    expect(ranked[0]).toBe('gemini-2.5-pro');
    expect(ranked).toContain('gemini-2.0-flash');
    expect(ranked).toContain('gemini-1.5-flash');
  });
});
