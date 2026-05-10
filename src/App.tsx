import { useState, useCallback, useEffect, useRef } from "react";
import { useAgent } from "agents/react";
import { useAgentChat } from "agents/ai-react";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import Canvas from "./components/Canvas";
import ChatPanel from "./components/chat/ChatPanel";
import "./App.css";
import { tools } from "./tools";
import { isToolUIPart } from "ai";
import {
  CaptureUpdateAction,
  convertToExcalidrawElements,
  newElementWith,
} from "@excalidraw/excalidraw";

const sessionId = crypto.randomUUID();
const TOOL_NAMES = Object.keys(tools).map((n) => `tool-${n}`);

export default function App() {
  const [excalidrawAPI, setExcalidrawAPI] =
    useState<ExcalidrawImperativeAPI | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  const appliedToolCalls = useRef<Set<string>>(new Set());

  const handleApiReady = useCallback((api: ExcalidrawImperativeAPI) => {
    setExcalidrawAPI(api);
  }, []);

  const agent = useAgent({ agent: "design-agent", name: sessionId });
  const { messages, sendMessage, status } = useAgentChat({ agent });

  useEffect(() => {
    if (!excalidrawAPI) return;

    for (const message of messages) {
      if (message.role !== "assistant") continue;

      for (const part of message.parts ?? []) {
        if (!TOOL_NAMES.includes(part.type)) continue;

        if (isToolUIPart(part)) {
          if (part.state !== "output-available") continue;
          if (appliedToolCalls.current.has(part.toolCallId)) continue;

          if (part.type === "tool-generateDiagram") {
            appliedToolCalls.current.add(part.toolCallId);

            const output = part.output as { elements?: unknown };
            const skeletonElements = output?.elements;

            if (
              Array.isArray(skeletonElements) &&
              skeletonElements.length > 0
            ) {
              // The agent returns simplified element shapes. Excalidraw needs
              // full element data (seed, versionNonce, etc.) which this helper
              // fills in from a skeleton. Pass `regenerateIds: false` so the
              // ids the agent picked survive — otherwise the canvas ends up
              // with random uuids and any later modifyDiagram call (which uses
              // the agent's chosen ids) silently misses every element.
              const elements = convertToExcalidrawElements(
                skeletonElements as any,
                { regenerateIds: false },
              );
              excalidrawAPI.updateScene({ elements });
              excalidrawAPI.scrollToContent(elements, { fitToContent: true });
            }
          } else if (part.type === "tool-modifyDiagram") {
            appliedToolCalls.current.add(part.toolCallId);
            const output = part.output as {
              elementId?: string;
              updates?: Record<string, unknown>;
            };

            if (output?.elementId && output.updates) {
              // Use Excalidraw's `newElementWith` helper to merge updates into
              // the matching element. It bumps version + versionNonce + the
              // updated timestamp the way the reconciler expects.
              // CaptureUpdateAction.IMMEDIATELY forces the change into the
              // scene store right away instead of deferring to a future tick.
              const current = excalidrawAPI.getSceneElements();
              const next = current.map((el) =>
                el.id === output.elementId
                  ? newElementWith(el, output.updates as never)
                  : el,
              );
              excalidrawAPI.updateScene({
                elements: next,
                captureUpdate: CaptureUpdateAction.IMMEDIATELY,
              });
            }
          }
        }
      }
    }
  }, [messages, excalidrawAPI]);

  return (
    <div className={`app ${theme}`}>
      <div className="canvas-container">
        <Canvas onApiReady={handleApiReady} onThemeChange={setTheme} />
      </div>
      <ChatPanel {...{ messages, sendMessage, status }} />
    </div>
  );
}
