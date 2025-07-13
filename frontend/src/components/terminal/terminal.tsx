import React, { useEffect, useMemo, useRef } from "react";
import { useXTerm } from "react-xtermjs";
import { FitAddon } from "@xterm/addon-fit";

const TerminalComponent: React.FC = (userId: string) => {
  const options = useMemo(
    () => ({
      cursorBlink: true,
      fontFamily: "monospace",
    }),
    [],
  );

  const { instance, ref } = useXTerm({ options });
  const fitAddon = useRef<FitAddon>(new FitAddon()).current;

  useEffect(() => {
    if (!instance || !ref.current) return;

    instance.loadAddon(fitAddon);
    fitAddon.fit();

    const ws = new WebSocket(`ws://localhost:8000/ws/${userId}`);
    ws.binaryType = "arraybuffer";

    ws.onopen = () => {
      instance.writeln("\r\n*** Connected to server ***");
    };
    ws.onmessage = (evt) => {
      const data =
        typeof evt.data === "string"
          ? evt.data
          : new TextDecoder().decode(evt.data);
      instance.write(data);
    };
    ws.onclose = () => {
      instance.writeln("\r\n*** Disconnected ***");
    };

    instance.onData((data) => ws.send(data));

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
    });
    resizeObserver.observe(ref.current);

    return () => {
      resizeObserver.disconnect();
      ws.close();
    };
  }, [instance, fitAddon, ref, options]);

  return (
    <div
      ref={ref}
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: "#1e1e1e",
      }}
    />
  );
};

export default TerminalComponent;
