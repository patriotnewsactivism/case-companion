import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { VideoRoom } from '@/components/VideoRoom';
import { supabase } from '@/integrations/supabase/client';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
    },
    functions: {
      invoke: vi.fn(),
    },
  },
}));

type DailyFrameMock = {
  join: ReturnType<typeof vi.fn>;
  leave: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
  setLocalVideo: ReturnType<typeof vi.fn>;
  setLocalAudio: ReturnType<typeof vi.fn>;
  startScreenShare: ReturnType<typeof vi.fn>;
  stopScreenShare: ReturnType<typeof vi.fn>;
  startRecording: ReturnType<typeof vi.fn>;
  stopRecording: ReturnType<typeof vi.fn>;
  participants: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
};

function createDailyFrameMock(): DailyFrameMock {
  return {
    join: vi.fn().mockResolvedValue(undefined),
    leave: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn().mockResolvedValue(undefined),
    setLocalVideo: vi.fn(),
    setLocalAudio: vi.fn(),
    startScreenShare: vi.fn().mockResolvedValue(undefined),
    stopScreenShare: vi.fn(),
    startRecording: vi.fn().mockResolvedValue(undefined),
    stopRecording: vi.fn().mockResolvedValue(undefined),
    participants: vi.fn().mockReturnValue({}),
    on: vi.fn(),
    off: vi.fn(),
  };
}

describe('VideoRoom', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: {
        session: {
          user: { email: 'tester@example.com' },
        },
      },
    } as never);
  });

  afterEach(() => {
    delete (window as unknown as { DailyIframe?: unknown }).DailyIframe;
  });

  it('creates and joins a room when roomId is not provided', async () => {
    const frame = createDailyFrameMock();
    const createFrame = vi.fn().mockReturnValue(frame);
    (window as unknown as { DailyIframe: unknown }).DailyIframe = { createFrame };

    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: {
        token: 'token-123',
        roomUrl: 'https://daily.example/room',
        enableRecording: true,
      },
      error: null,
    } as never);

    render(<VideoRoom caseId="case-123" roomName="My Room" />);

    await waitFor(() => {
      expect(supabase.functions.invoke).toHaveBeenCalledWith('create-video-room', {
        body: expect.objectContaining({
          name: 'My Room',
          caseId: 'case-123',
        }),
      });
    });

    expect(createFrame).toHaveBeenCalled();
    expect(frame.join).toHaveBeenCalledWith({
      url: 'https://daily.example/room',
      token: 'token-123',
    });
  });

  it('joins an existing room using roomId', async () => {
    const frame = createDailyFrameMock();
    const createFrame = vi.fn().mockReturnValue(frame);
    (window as unknown as { DailyIframe: unknown }).DailyIframe = { createFrame };

    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: {
        token: 'token-join',
        roomUrl: 'https://daily.example/existing-room',
        enableRecording: false,
        isOwner: false,
      },
      error: null,
    } as never);

    render(<VideoRoom caseId="case-123" roomName="Existing Room" roomId="room-abc" />);

    await waitFor(() => {
      expect(supabase.functions.invoke).toHaveBeenCalledWith('join-video-room', {
        body: expect.objectContaining({
          roomId: 'room-abc',
        }),
      });
    });

    expect(createFrame).toHaveBeenCalled();
    expect(frame.join).toHaveBeenCalledWith({
      url: 'https://daily.example/existing-room',
      token: 'token-join',
    });
  });
});
