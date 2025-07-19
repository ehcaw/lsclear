// src/components/terminal/terminal.tsx
import React from "react";

interface TerminalComponentProps {
  userId: string;
  apiBaseUrl?: string;
}

const TerminalComponent: React.FC<TerminalComponentProps> = ({
  userId,
  apiBaseUrl = process.env.NEXT_PUBLIC_REACT_APP_API_URL || "",
}) => {
  // Create a URL with the necessary params
  const terminalUrl = `/terminal-page?userId=${encodeURIComponent(userId)}&apiBaseUrl=${encodeURIComponent(apiBaseUrl)}`;

  return (
    <div className="flex flex-col h-full">
      <div className="bg-gray-800 text-white p-2 text-sm">Terminal</div>
      <iframe
        src={terminalUrl}
        className="flex-1 w-full border-none"
        title="Terminal"
        sandbox="allow-same-origin allow-scripts"
      />
    </div>
  );
};

export default TerminalComponent;
