import * as Y from "yjs";
import {
  ref,
  push,
  get,
  onChildAdded,
} from "firebase/database";
import { database } from "./firebase";

const FIREBASE_ORIGIN = "firebase-remote";
const LOCAL_ORIGIN = "local-editor";

/**
 * Connects a Yjs text document to Firebase Realtime Database.
 * Every Yjs update is stored as an immutable record. Yjs merges concurrent
 * updates, so simultaneous typing does not use last-write-wins replacement.
 */
export function connectRoom(roomId, onReady, onError) {
  const doc = new Y.Doc();
  const text = doc.getText("content");
  const updatesRef = ref(database, `rooms/${roomId}/updates`);

  let disposed = false;
  let readyNotified = false;

  function applyEncodedUpdate(encoded) {
    if (typeof encoded !== "string") return;
    const bytes = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));
    Y.applyUpdate(doc, bytes, FIREBASE_ORIGIN);
  }

  const unsubscribe = onChildAdded(
    updatesRef,
    (snapshot) => {
      if (disposed) return;
      try {
        applyEncodedUpdate(snapshot.val());
      } catch (error) {
        onError?.(new Error("A saved update could not be loaded."));
        console.error(error);
      }
    },
    (error) => onError?.(error)
  );

  const publishUpdate = (update, origin) => {
    if (disposed || origin === FIREBASE_ORIGIN) return;

    // Convert the binary Yjs update to Base64 for safe storage in RTDB.
    let binary = "";
    for (let i = 0; i < update.length; i += 1) {
      binary += String.fromCharCode(update[i]);
    }
    const encoded = btoa(binary);

    push(updatesRef, encoded).catch((error) => {
      console.error("Could not save collaborative update:", error);
      onError?.(new Error("Your latest change could not be saved. Check your connection."));
    });
  };

  doc.on("update", publishUpdate);

  // Firebase's child_added listener delivers existing updates as well as new ones.
  // The editor can safely become available immediately; incoming saved updates
  // are merged into the Yjs document as they arrive.
  // Read the existing update log once. The child_added listener is already
  // active, so updates created during this initial read are also received.
  // Applying an update twice is safe because Yjs updates are idempotent.
  get(updatesRef)
    .then((snapshot) => {
      if (disposed) return;
      if (snapshot.exists()) {
        snapshot.forEach((child) => {
          try {
            applyEncodedUpdate(child.val());
          } catch (error) {
            console.error("Could not apply a saved update:", error);
          }
        });
      }
      if (!readyNotified) {
        readyNotified = true;
        onReady?.({ doc, text });
      }
    })
    .catch((error) => {
      if (!disposed) onError?.(new Error("Could not load this workspace. Check your Firebase setup and connection."));
    });

  return {
    doc,
    text,
    localOrigin: LOCAL_ORIGIN,
    destroy() {
      disposed = true;
      unsubscribe();
      doc.off("update", publishUpdate);
      doc.destroy();
    },
  };
}

export { Y, LOCAL_ORIGIN };
