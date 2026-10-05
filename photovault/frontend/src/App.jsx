import { useEffect, useState } from "react";
import { signUp, confirmSignUp, signIn, signOut, getToken, getEmail } from "./auth";
import { uploadImage, listImages } from "./api";

function AuthForm({ onDone }) {
  const [mode, setMode] = useState("login"); // login | signup | confirm
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setMsg("");
    try {
      if (mode === "signup") { await signUp(email, password); setMode("confirm"); setMsg("We emailed you a 6-digit code."); }
      else if (mode === "confirm") { await confirmSignUp(email, code); setMode("login"); setMsg("Email confirmed. Log in to continue."); }
      else { await signIn(email, password); onDone(); }
    } catch (err) { setMsg(err.message || "Something went wrong"); }
  };

  return (
    <main className="auth">
      <div className="auth-intro">
        <span className="lens" aria-hidden="true" />
        <h1>Your photos, sorted by what's in them.</h1>
        <p>Upload an image and PhotoVault labels it for you, so you can find it by searching "horse" instead of scrolling.</p>
      </div>
      <form className="auth-form" onSubmit={submit}>
        <h2>{mode === "login" ? "Log in" : mode === "signup" ? "Create your account" : "Confirm your email"}</h2>
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        {mode !== "confirm" && (
          <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        )}
        {mode === "confirm" && <input placeholder="6-digit code" value={code} onChange={(e) => setCode(e.target.value)} required />}
        <button className="primary" type="submit">
          {mode === "login" ? "Log in" : mode === "signup" ? "Create account" : "Confirm email"}
        </button>
        {msg && <p className="msg" role="status">{msg}</p>}
        <p className="switch">
          {mode === "login"
            ? <>New here? <button type="button" className="link" onClick={() => setMode("signup")}>Create an account</button></>
            : <>Already registered? <button type="button" className="link" onClick={() => setMode("login")}>Log in</button></>}
        </p>
      </form>
    </main>
  );
}

function Gallery({ onLogout }) {
  const [images, setImages] = useState(null); // null = loading
  const [query, setQuery] = useState("");
  const [active, setActive] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(null);
  const [email, setEmail] = useState("");

  const load = async (t = "") => {
    const tag = t.trim().toLowerCase();
    try { setImages(await listImages(tag)); setActive(tag); setQuery(tag); }
    catch (e) { setStatus(e.message); setImages((prev) => prev ?? []); }
  };

  useEffect(() => { load(""); getEmail().then(setEmail); }, []);
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && setSelected(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onFile = async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setStatus("Uploading…");
    try {
      await uploadImage(file);
      setStatus("Tagging your photo…");
      const before = (await listImages("")).length;
      for (let i = 0; i < 8; i++) { // poll up to ~24s for the new image
        await new Promise((r) => setTimeout(r, 3000));
        if ((await listImages("")).length > before) break;
      }
      await load("");
      setStatus("");
    } catch (err) { setStatus(err.message); }
    setBusy(false);
  };

  const UploadInput = <input type="file" accept="image/jpeg,image/png,image/webp" onChange={onFile} hidden />;

  return (
    <div className="app">
      <header className="bar">
        <div className="brand"><span className="lens" aria-hidden="true" />PhotoVault</div>
        <form className="search" onSubmit={(e) => { e.preventDefault(); load(query); }}>
          <input placeholder="Search by tag, like horse or laptop" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search by tag" />
        </form>
        <label className={"primary upload" + (busy ? " disabled" : "")}>
          {busy ? "Working…" : "Upload photo"}
          {UploadInput}
        </label>
        {email && (
          <div className="account" title={email}>
            <span className="avatar">{email[0].toUpperCase()}</span>
            <span className="email">{email}</span>
          </div>
        )}
        <button className="ghost" onClick={onLogout}>Log out</button>
      </header>

      <main className="content">
        <div className="head">
          <h2>{active ? <>Tagged “{active}”</> : "Your photos"}</h2>
          {images && images.length > 0 && <span className="count">{images.length}</span>}
          {active && <button className="link" onClick={() => load("")}>Show all</button>}
        </div>
        {status && <p className="status" role="status">{status}</p>}

        {images === null && <p className="status">Loading your photos…</p>}

        {images && images.length === 0 && (
          active ? (
            <p className="empty">No photos are tagged “{active}”. <button className="link" onClick={() => load("")}>Show all photos</button></p>
          ) : (
            <label className="dropzone">
              <strong>Add your first photo</strong>
              <span>JPG, PNG or WebP. Tags appear within a few seconds.</span>
              {UploadInput}
            </label>
          )
        )}

        <div className="masonry">
          {(images || []).map((img) => (
            <figure className="tile" key={img.imageId}>
              <button className="open" onClick={() => setSelected(img)} aria-label="Open photo">
                <img src={img.thumbUrl} alt={img.tags.slice(0, 3).join(", ")} loading="lazy" />
              </button>
              <figcaption>
                {img.tags.slice(0, 4).map((t) => (
                  <button key={t} className="chip" onClick={() => load(t)}>{t}</button>
                ))}
                {img.tags.length > 4 && (
                  <button className="chip more" onClick={() => setSelected(img)}>+{img.tags.length - 4} more</button>
                )}
              </figcaption>
            </figure>
          ))}
        </div>
      </main>

      {selected && (
        <div className="lightbox" onClick={() => setSelected(null)}>
          <figure onClick={(e) => e.stopPropagation()}>
            <img src={selected.imageUrl} alt={selected.tags.slice(0, 3).join(", ")} />
            <figcaption>
              {selected.tags.map((t) => (
                <button key={t} className="chip" onClick={() => { setSelected(null); load(t); }}>{t}</button>
              ))}
            </figcaption>
          </figure>
          <button className="close" onClick={() => setSelected(null)} aria-label="Close">×</button>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState(null);
  useEffect(() => { getToken().then((t) => setLoggedIn(!!t)); }, []);
  if (loggedIn === null) return null;
  return loggedIn
    ? <Gallery onLogout={() => { signOut(); setLoggedIn(false); }} />
    : <AuthForm onDone={() => setLoggedIn(true)} />;
}
