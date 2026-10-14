import { Suspense } from "react";
import { LoginForm } from "./LoginForm";
import s from "./login.module.css";

export const metadata = { title: "Members only · The Cinematheque" };

/* The counter: the only screen open to everyone once the database is connected. */
export default function LoginPage() {
  return (
    <div className={s.desk}>
      <div className="osd-label">The counter</div>
      <h1 className={s.h1}>Members only</h1>
      <p className={s.lead}>Give your member email. A code comes back by email: type it here with the remote, or tap the link in the email on your phone or laptop.</p>
      <Suspense fallback={null}><LoginForm /></Suspense>
    </div>
  );
}
