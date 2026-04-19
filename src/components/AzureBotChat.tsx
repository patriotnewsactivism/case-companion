import React, { useMemo } from 'react';
import ReactWebChatRaw from 'botframework-webchat';
import { createDirectLine } from 'botframework-webchat';

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
  const directLine = useMemo(() => {
    if (directLineToken) {
      return createDirectLine({ token: directLineToken });
    } else if (directLineSecret) {
      return createDirectLine({ secret: directLineSecret });
    } else {
      throw new Error('Either directLineSecret or directLineToken must be provided');
    }
  }, [directLineSecret, directLineToken]);

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
