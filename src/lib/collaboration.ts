import { HocuspocusProvider } from "@hocuspocus/provider";
import { TiptapTransformer } from "@hocuspocus/transformer";
import * as Y from "yjs";
import WebSocket from "ws";
import { JSDOM } from "jsdom";
import { tiptapExtensions } from "./tiptap-extensions.js";

const debug = (...args: unknown[]) => {
  if (process.env.DEBUG) console.error(...args);
};

let domSetup = false;
function setupDomEnvironment() {
  if (domSetup) return;
  const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
  global.window = dom.window as any;
  global.document = dom.window.document;
  // @ts-ignore
  global.Element = dom.window.Element;
  // @ts-ignore
  global.WebSocket = WebSocket;
  domSetup = true;
}

export async function updatePageContentRealtime(
  pageId: string,
  tiptapJson: object,
  collabToken: string,
  baseUrl: string,
): Promise<void> {
  setupDomEnvironment();
  debug(`Starting realtime update for page ${pageId}`);
  debug(`Collab token: ${collabToken ? "present" : "missing"}`);

  // 1. Setup Hocuspocus Provider
  const ydoc = new Y.Doc();

  // Construct WebSocket URL
  // Replace protocol
  let wsUrl = baseUrl.replace(/^http/, "ws");

  const urlObj = new URL(wsUrl);
  // Remove /api suffix if present, as the websocket is mounted on root /collab
  if (urlObj.pathname.endsWith("/api") || urlObj.pathname.endsWith("/api/")) {
    urlObj.pathname = urlObj.pathname.replace(/\/api\/?$/, "");
  }

  // Set correct path to /collab
  urlObj.pathname = urlObj.pathname.replace(/\/$/, "") + "/collab";

  wsUrl = urlObj.toString();

  debug(`Connecting to WebSocket: ${wsUrl}`);

  return new Promise<void>((resolve, reject) => {
    let synced = false;
    let settled = false;

    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    };

    // Safety timeout
    const timer = setTimeout(() => {
      if (provider) provider.destroy();
      fail(new Error("Connection timeout to collaboration server"));
    }, 25000);

    const provider = new HocuspocusProvider({
      url: wsUrl,
      name: `page.${pageId}`,
      document: ydoc,
      token: collabToken,
      // @ts-ignore - Required for Node.js environment
      WebSocketPolyfill: WebSocket as any,
      onConnect: () => debug("WS Connect"),
      onDisconnect: () => {
        debug("WS Disconnect");
        if (!synced) {
          provider.destroy();
          fail(new Error("WebSocket disconnected before sync completed"));
        }
      },
      onClose: () => {
        debug("WS Close");
        if (!synced) {
          fail(new Error("WebSocket closed before sync completed"));
        }
      },
      onSynced: () => {
        synced = true;
        debug("Connected and synced!");
        try {
          // Prepare the new content in a separate doc
          const tempDoc = TiptapTransformer.toYdoc(
            tiptapJson,
            "default",
            tiptapExtensions,
          );

          // Clear existing content
          ydoc.transact(() => {
            const fragment = ydoc.getXmlFragment("default");
            if (fragment.length > 0) {
              fragment.delete(0, fragment.length);
            }
          });

          // Apply new content from tempDoc (outside transact to avoid nested transactions)
          const update = Y.encodeStateAsUpdate(tempDoc);
          Y.applyUpdate(ydoc, update);

          debug(
            "Content replaced. Background persistence in progress (server saves after ~10s debounce)...",
          );

          // Clear safety timeout as we are successful
          clearTimeout(timer);
          settled = true;

          // Resolve immediately so the user doesn't have to wait
          resolve();

          // Keep connection open in background for save/sync (Docmost has 10s debounce)
          // The node process will keep running this timeout even after the tool returns
          const bgTimer = setTimeout(() => {
            try {
              debug(`Closing background connection for page ${pageId}`);
              provider.destroy();
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              process.stderr.write(`Warning: failed to close WebSocket: ${msg}\n`);
            }
          }, 15000);
          bgTimer.unref();
        } catch (e) {
          provider.destroy();
          fail(e instanceof Error ? e : new Error(String(e)));
        }
      },
      onAuthenticationFailed: () => {
        provider.destroy();
        fail(new Error("Authentication failed for collaboration connection"));
      },
    });
  });
}
