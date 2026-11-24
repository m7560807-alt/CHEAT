import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { onValue, ref } from "firebase/database";
import { database, ensureAnonymousUser, firebaseConfigured } from "./firebase";
import { connectRoom, LOCAL_ORIGIN } from "./collaboration";

function Home() {
  const [roomId, setRoomId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function joinRoom(event) {
    event.preventDefault();
    const cleanId = roomId.trim();
    if (!cleanId) {
      setError("Enter a workspace ID.");
      return;
    }
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(cleanId)) {
      setError("Use 1–64 letters, numbers, hyphens or underscores.");
      return;
    }
    if (!firebaseConfigured) {
      setError("Firebase setup is required. Follow the README to configure the app.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      await ensureAnonymousUser();
      navigate(`/room/${encodeURIComponent(cleanId)}`);
    } catch (err) {
      setError(err.message || "Could not join the workspace.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="home">
      <form className="join-form" onSubmit={joinRoom}>
        <h1>CHEAT</h1>
        <p className="tagline">A shared space to write.</p>
        <input
          autoFocus
          value={roomId}
          onChange={(event) => setRoomId(event.target.value)}
          placeholder="Enter workspace ID"
          aria-label="Workspace ID"
          maxLength={64}
          autoComplete="off"
          spellCheck="false"
        />
        <button type="submit" disabled={busy}>
          {busy ? "Joining..." : "Join"}
        </button>
        {error && <p className="error" role="alert">{error}</p>}
      </form>
    </main>
  );
}

function Workspace() {
  const { roomId } = useParams();
  const editorRef = useRef(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const connectionRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    let textObserver;
    let editor;
    let localInputHandler;

    async function start() {
      try {
        if (!firebaseConfigured) {
          throw new Error("Firebase is not configured. Follow the README setup instructions.");
        }
        await ensureAnonymousUser();
        if (cancelled) return;

        const connection = connectRoom(
          roomId,
          ({ text }) => {
            if (cancelled || !editorRef.current || editor) return;
            editor = editorRef.current;
            localInputHandler = () => {
              const current = text.toString();
              const next = editor.value;
              if (current === next) return;

              // Apply only the changed range, rather than replacing the full
              // document. Yjs can then merge concurrent edits from other users.
              let prefix = 0;
              while (
                prefix < current.length &&
                prefix < next.length &&
                current[prefix] === next[prefix]
              ) prefix += 1;

              let suffix = 0;
              while (
                suffix < current.length - prefix &&
                suffix < next.length - prefix &&
                current[current.length - 1 - suffix] === next[next.length - 1 - suffix]
              ) suffix += 1;

              connection.doc.transact(() => {
                const deleteCount = current.length - prefix - suffix;
                if (deleteCount > 0) text.delete(prefix, deleteCount);
                const inserted = next.slice(prefix, next.length - suffix);
                if (inserted) text.insert(prefix, inserted);
              }, LOCAL_ORIGIN);
            };

            const updateEditorFromSharedText = (event) => {
              if (event.transaction.origin === LOCAL_ORIGIN) return;
              const oldValue = editor.value;
              const nextValue = text.toString();
              if (oldValue === nextValue) return;

              const start = editor.selectionStart;
              const end = editor.selectionEnd;
              let prefix = 0;
              while (
                prefix < oldValue.length &&
                prefix < nextValue.length &&
                oldValue[prefix] === nextValue[prefix]
              ) prefix += 1;
              let suffix = 0;
              while (
                suffix < oldValue.length - prefix &&
                suffix < nextValue.length - prefix &&
                oldValue[oldValue.length - 1 - suffix] === nextValue[nextValue.length - 1 - suffix]
              ) suffix += 1;

              const removed = oldValue.length - prefix - suffix;
              const added = nextValue.length - prefix - suffix;
              const adjust = (position) => {
                if (position <= prefix) return position;
                if (position >= oldValue.length - suffix) return position + added - removed;
                return prefix + added;
              };

              editor.value = nextValue;
              editor.setSelectionRange(
                Math.max(0, Math.min(nextValue.length, adjust(start))),
                Math.max(0, Math.min(nextValue.length, adjust(end)))
              );
            };

            editor.addEventListener("input", localInputHandler);
            textObserver = updateEditorFromSharedText;
            text.observe(textObserver);
            editor.value = text.toString();
            setLoading(false);
          },
          (err) => {
            if (!cancelled) setError(err.message || "Could not connect to this workspace.");
          }
        );
        connectionRef.current = connection;
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Could not open this workspace.");
          setLoading(false);
        }
      }
    }

    start();

    return () => {
      cancelled = true;
      if (editor && localInputHandler) {
        editor.removeEventListener("input", localInputHandler);
      }
      if (textObserver) {
        try { connectionRef.current?.text?.unobserve(textObserver); } catch {}
      }
      connectionRef.current?.destroy();
      connectionRef.current = null;
    };
  }, [roomId]);

  return (
    <main className="workspace">
      {loading && !error && <div className="loading">Opening notepad…</div>}
      {error ? (
        <div className="workspace-error">
          <p>{error}</p>
          <a href="/">Back to CHEAT</a>
        </div>
      ) : (
        <textarea
          ref={editorRef}
          className="notepad"
          aria-label="Shared notepad"
          placeholder=""
          spellCheck="false"
          autoCapitalize="off"
          autoCorrect="off"
          disabled={loading}
        />
      )}
    </main>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/room/:roomId" element={<Workspace />} />
      <Route path="*" element={<Home />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
