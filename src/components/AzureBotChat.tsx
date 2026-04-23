import React, { useMemo } from 'react';
import ReactWebChatRaw from 'botframework-webchat';
import { createDirectLine } from 'botframework-webchat';
import { Bot, AlertTriangle } from 'lucide-react';

const ReactWebChat = ReactWebChatRaw as any;

interface AzureBotChatProps {
  directLineSecret?: string;
  directLineToken?: string;
  userID?: string;
  username?: string;
  botAvatarInitials?: string;
  userAvatarInitials?: string;
}

export function AzureBotChat({
  directLineSecret,
  directLineToken,
  userID = 'user-' + Math.random().toString(36).substr(2, 9),
  username = 'User',
  botAvatarInitials = 'GLM',
  userAvatarInitials = 'ME',
}: AzureBotChatProps) {

  // If no secret/token is configured, show a friendly setup message instead of crashing
  if (!directLineSecret && !directLineToken) {
    return (
      <div className="w-full h-full min-h-[500px] flex flex-col items-center justify-center gap-4 p-8 text-center bg-muted/30">
        <div className="p-4 bg-amber-100 rounded-full">
          <AlertTriangle className="h-8 w-8 text-amber-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-2">AI Assistant Not Configured</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            The Azure Bot Direct Line secret is missing. Add{" "}
            <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">VITE_AZURE_BOT_DIRECT_LINE_SECRET</code>{" "}
            to your <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">.env</code> file and restart the dev server.
          </p>
        </div>
        <div className="mt-2 p-3 bg-muted rounded-lg text-left text-xs font-mono text-muted-foreground w-full max-w-sm">
          VITE_AZURE_BOT_DIRECT_LINE_SECRET=your_key_here
        </div>
      </div>
    );
  }

  const directLine = useMemo(() => {
    try {
      if (directLineToken) {
        return createDirectLine({ token: directLineToken });
      }
      return createDirectLine({ secret: directLineSecret });
    } catch (err) {
      console.error("DirectLine init failed:", err);
      return null;
    }
  }, [directLineSecret, directLineToken]);

  if (!directLine) {
    return (
      <div className="w-full h-full min-h-[500px] flex flex-col items-center justify-center gap-3 p-8 text-center">
        <Bot className="h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Failed to connect to AI Assistant. Check your Direct Line secret and try again.</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-[500px]">
      <ReactWebChat
        directLine={directLine}
        userID={userID}
        username={username}
        botAvatarInitials={botAvatarInitials}
        userAvatarInitials={userAvatarInitials}
        styleOptions={{
          botAvatarBackgroundColor: '#1e40af',
          userAvatarBackgroundColor: '#f59e0b',
          backgroundColor: '#f8fafc',
          sendBoxHeight: 60,
          sendBoxButtonColor: '#f59e0b',
          bubbleBorderRadius: 8,
          bubbleBackground: '#ffffff',
          bubbleFromUserBackground: '#1e40af',
          bubbleFromUserTextColor: '#ffffff',
          bubbleFromUserBorderRadius: 8,
          fontStack: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        } as any}
      />
    </div>
  );
}
