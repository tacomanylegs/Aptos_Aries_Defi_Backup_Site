import { useState, useEffect, useCallback } from "react";

// SHA-256 hash of the correct password (never store plaintext)
const PASS_HASH =
  "284d9a101beeb8fbf979d029b25fa49f859739904bfc3a918ecba1c00001b0af";

const LS_KEY = "site_auth";

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export default function PasswordGate({
  onAuth,
}: {
  onAuth: () => void;
}) {
  const [pwd, setPwd] = useState("");
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(true);

  // On mount: check localStorage token
  useEffect(() => {
    const token = localStorage.getItem(LS_KEY);
    if (token === PASS_HASH) {
      onAuth();
    }
    setChecking(false);
  }, [onAuth]);

  const verify = useCallback(async () => {
    setError(false);
    const hash = await sha256(pwd);
    if (hash === PASS_HASH) {
      localStorage.setItem(LS_KEY, PASS_HASH);
      onAuth();
    } else {
      setError(true);
    }
  }, [pwd, onAuth]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") verify();
  };

  if (checking) return null;

  return (
    <div className="password-gate">
      <div className="password-card">
        <div className="password-icon">🔒</div>
        <h2>存取受限</h2>
        <p>請輸入密碼以進入此網站</p>

        <div className="password-input-group">
          <input
            className="form-input password-input"
            type="password"
            placeholder="請輸入密碼"
            value={pwd}
            onChange={(e) => {
              setPwd(e.target.value);
              setError(false);
            }}
            onKeyDown={handleKeyDown}
            autoFocus
          />
          <button className="btn btn-primary" onClick={verify}>
            確認
          </button>
        </div>

        {error && (
          <div className="password-error">⚠️ 密碼錯誤，請重新輸入</div>
        )}
      </div>
    </div>
  );
}
