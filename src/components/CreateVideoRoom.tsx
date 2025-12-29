import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Video, AlertCircle, Shield, Clock, Users } from 'lucide-react';
import { toast } from 'sonner';

interface CreateVideoRoomProps {
  caseId: string;
  onRoomCreated?: (roomData: {
    roomId: string;
    roomName: string;
    roomUrl: string;
  }) => void;
}

export function CreateVideoRoom({ caseId, onRoomCreated }: CreateVideoRoomProps) {
  const [roomTitle, setRoomTitle] = useState('');
  const [description, setDescription] = useState('');
  const [enableRecording, setEnableRecording] = useState(true);
  const [maxParticipants, setMaxParticipants] = useState(10);
  const [expiresInHours, setExpiresInHours] = useState(4);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateRoom = async () => {
    if (!roomTitle.trim()) {
      toast.error('Please enter a room title');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      // Room creation will be handled by the VideoRoom component
      // This component just collects the preferences
      if (onRoomCreated) {
        onRoomCreated({
          roomId: '', // Will be filled by VideoRoom
          roomName: roomTitle,
          roomUrl: '',
        });
      }

      toast.success('Creating video room...');
    } catch (err) {
      console.error('Error creating room:', err);
      setError(err instanceof Error ? err.message : 'Failed to create room');
      toast.error('Failed to create video room');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Video className="h-5 w-5 text-accent" />
          Create Secure Video Room
        </CardTitle>
        <CardDescription>
          Set up an encrypted video conference for your case team
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Security Notice */}
        <Alert>
          <Shield className="h-4 w-4 text-green-600" />
          <AlertDescription>
            All video rooms are end-to-end encrypted and require authentication.
            Only users with access to this case can join.
          </AlertDescription>
        </Alert>

        {/* Room Title */}
        <div className="space-y-2">
          <Label htmlFor="room-title">Room Title *</Label>
          <Input
            id="room-title"
            placeholder="e.g., Smith v. Acme - Strategy Session"
            value={roomTitle}
            onChange={(e) => setRoomTitle(e.target.value)}
          />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="description">Description (Optional)</Label>
          <Textarea
            id="description"
            placeholder="Add notes about the purpose of this meeting..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </div>

        {/* Recording Toggle */}
        <div className="flex items-center justify-between space-x-2 p-4 border rounded-lg">
          <div className="space-y-1">
            <Label htmlFor="enable-recording" className="font-medium">
              Enable Recording & Transcription
            </Label>
            <p className="text-sm text-muted-foreground">
              Automatically record and transcribe this session for case records
            </p>
          </div>
          <Switch
            id="enable-recording"
            checked={enableRecording}
            onCheckedChange={setEnableRecording}
          />
        </div>

        {enableRecording && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Recording will be stored securely and automatically transcribed.
              All participants will be notified when recording starts.
            </AlertDescription>
          </Alert>
        )}

        {/* Advanced Settings */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium">Advanced Settings</h4>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="max-participants" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Max Participants
              </Label>
              <Input
                id="max-participants"
                type="number"
                min="2"
                max="50"
                value={maxParticipants}
                onChange={(e) => setMaxParticipants(parseInt(e.target.value) || 10)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expires-in" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Expires In (hours)
              </Label>
              <Input
                id="expires-in"
                type="number"
                min="1"
                max="24"
                value={expiresInHours}
                onChange={(e) => setExpiresInHours(parseInt(e.target.value) || 4)}
              />
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Create Button */}
        <Button
          onClick={handleCreateRoom}
          disabled={isCreating || !roomTitle.trim()}
          className="w-full gap-2"
          size="lg"
        >
          <Video className="h-5 w-5" />
          {isCreating ? 'Creating Room...' : 'Create Video Room'}
        </Button>

        {/* Privacy Notice */}
        <p className="text-xs text-muted-foreground text-center">
          By creating a room, you agree that this session is for professional legal use only.
          All recordings and transcripts are subject to attorney-client privilege.
        </p>
      </CardContent>
    </Card>
  );
}
