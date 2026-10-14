"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { finishLink, sendCode, verifyCode, type Result } from "./actions";
import s from "./login.module.css";

export function LoginForm() {
  const next = useSearchParams().get("next") ?? "/";
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [result, setResult] = useState<Result | null>(null);
  const [pending, start] = useTransition();
  const codeInput = useRef<HTMLInputElement>(null);

  // Arriving from the email link: Supabase puts the session in the URL fragment, which only the browser can read.
  useEffect(() => {
    const hash = new URLSearchParams(location.hash.slice(1));
    const token = hash.get("access_token"), err = hash.get("error_description");
    if (!token && !err) return;
    history.replaceState(null, "", location.pathname + location.search);
    start(async () => setResult(token ? await finishLink(token, next) : { ok: false, msg: `That link didn't work: ${err}` }));
  }, [next]);

  useEffect(() => { if (step === "code") codeInput.current?.focus(); }, [step]);

  const ask = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const r = await sendCode(email, next);
      setResult(r);
      if (r.ok) setStep("code");
    });
  };
  const check = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => setResult(await verifyCode(email, code, next)));
  };

  return (
    <div className={s.card}>
      {step === "email" ? (
        <form onSubmit={ask} className={s.form}>
          <label htmlFor="email" className={s.label}>Member email</label>
          <input id="email" className={s.input} type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required data-autofocus />
          <div className={s.btns}><button className="btn primary" disabled={pending}>{pending ? "Sending…" : "Send me a code"}</button></div>
        </form>
      ) : (
        <form onSubmit={check} className={s.form}>
          <label htmlFor="code" className={s.label}>Code from the email</label>
          <input id="code" ref={codeInput} className={s.input} inputMode="numeric" autoComplete="one-time-code" maxLength={12} value={code} onChange={(e) => setCode(e.target.value)} required />
          <div className={s.btns}>
            <button className="btn primary" disabled={pending}>{pending ? "Checking…" : "Sign in"}</button>
            <button type="button" className="btn" onClick={() => { setStep("email"); setCode(""); setResult(null); }}>Different email</button>
          </div>
        </form>
      )}
      <p className={result && !result.ok ? `${s.status} ${s.bad}` : s.status} role="status" aria-live="polite">{result?.msg ?? ""}</p>
    </div>
  );
}
