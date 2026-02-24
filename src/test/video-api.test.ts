import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createVideoRoom, joinVideoRoom } from '@/lib/api';
import { supabase } from '@/integrations/supabase/client';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}));

describe('video api helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends required caseId when creating room', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: {
        roomId: 'room-1',
        roomUrl: 'https://daily.example/room',
        roomName: 'case-room',
        token: 'token-1',
      },
      error: null,
    } as never);

    await createVideoRoom('War Room', 'case-123');

    expect(supabase.functions.invoke).toHaveBeenCalledWith('create-video-room', {
      body: expect.objectContaining({
        name: 'War Room',
        caseId: 'case-123',
      }),
    });
  });

  it('joins room using secure roomId payload', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: {
        roomId: 'room-1',
        roomUrl: 'https://daily.example/room',
        roomName: 'case-room',
        token: 'token-1',
      },
      error: null,
    } as never);

    await joinVideoRoom('room-1', 'attorney@example.com');

    expect(supabase.functions.invoke).toHaveBeenCalledWith('join-video-room', {
      body: {
        roomId: 'room-1',
        userName: 'attorney@example.com',
      },
    });
  });
});
