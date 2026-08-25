"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSignup = async (event: FormEvent) => {
    event.preventDefault();

    setError("");

    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (trimmedName.length < 2) {
      setError("Please enter your full name.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const apiBaseUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

      const response = await fetch(
        `${apiBaseUrl}/api/auth/signup`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fullName: trimmedName,
            email: trimmedEmail,
            password,
          }),
        }
      );

      let data: { message?: string } = {};

      try {
        data = await response.json();
      } catch {
        data = {};
      }

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to create your account."
        );
      }

      router.push("/login?signup=success");
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Unable to connect to STOREROOM.");
      }
    } finally {
      setLoading(false);
    }
  };

  const togglePassword = () => {
    setShowPassword((current) => !current);
  };

  const toggleConfirmPassword = () => {
    setShowConfirmPassword((current) => !current);
  };

  return (
    <main className="storeroom-login">
      {/* Same STOREROOM background animation as the login page */}
      <div className="login-background">
        <div className="aurora aurora-one" />
        <div className="aurora aurora-two" />
        <div className="aurora aurora-three" />

        <div className="stars">
          {Array.from({ length: 45 }).map((_, index) => (
            <span
              key={index}
              className="star"
              style={{
                left: `${(index * 37) % 100}%`,
                top: `${(index * 61) % 100}%`,
                animationDelay: `${(index % 8) * 0.45}s`,
              }}
            />
          ))}
        </div>
      </div>

      <div className="crystal crystal-one">
        <div className="crystal-face face-one" />
        <div className="crystal-face face-two" />
        <div className="crystal-face face-three" />
      </div>

      <div className="crystal crystal-two">
        <div className="crystal-face face-one" />
        <div className="crystal-face face-two" />
        <div className="crystal-face face-three" />
      </div>

      <div className="crystal crystal-three">
        <div className="crystal-face face-one" />
        <div className="crystal-face face-two" />
        <div className="crystal-face face-three" />
      </div>

      <div className="crystal crystal-four">
        <div className="crystal-face face-one" />
        <div className="crystal-face face-two" />
        <div className="crystal-face face-three" />
      </div>

      <div className="login-wrapper">

        {/* Brand */}
        <div className="login-brand">
          <div className="brand-symbol">
            <div className="brand-core">
              <span />
              <span />
              <span />
            </div>
          </div>

          <div>
            <h1>STOREROOM</h1>
            <p>YOUR PERSONAL CLOUD</p>
          </div>
        </div>

        {/* Signup card */}
        <div className="login-card signup-card">
          <div className="card-glow" />

          <div className="login-card-content">

            <div className="welcome">
              <span className="welcome-line" />
              <span>CREATE ACCOUNT</span>
              <span className="welcome-line" />
            </div>

            <h2>Create your space.</h2>

            <p className="login-description">
              Your files. Your folders. Your private cloud.
            </p>

            <form onSubmit={handleSignup}>

              {/* Full Name */}
              <div className="field">
                <label htmlFor="fullName">
                  FULL NAME
                </label>

                <div className="input-shell">
                  <span className="input-icon">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                    >
                      <circle cx="12" cy="8" r="3.5" />
                      <path d="M5 20c.8-3.2 3.1-5 7-5s6.2 1.8 7 5" />
                    </svg>
                  </span>

                  <input
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={(event) =>
                      setFullName(event.target.value)
                    }
                    placeholder="Enter your full name"
                    autoComplete="name"
                    required
                  />
                </div>
              </div>

              {/* Email */}
              <div className="field">
                <label htmlFor="email">
                  EMAIL ADDRESS
                </label>

                <div className="input-shell">
                  <span className="input-icon">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                    >
                      <rect
                        x="3"
                        y="5"
                        width="18"
                        height="14"
                        rx="2"
                      />
                      <path d="m3 7 9 6 9-6" />
                    </svg>
                  </span>

                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) =>
                      setEmail(event.target.value)
                    }
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div className="field">
                <label htmlFor="password">
                  PASSWORD
                </label>

                <div className="input-shell">
                  <span className="input-icon">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                    >
                      <rect
                        x="4"
                        y="10"
                        width="16"
                        height="11"
                        rx="2"
                      />
                      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                    </svg>
                  </span>

                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) =>
                      setPassword(event.target.value)
                    }
                    placeholder="Enter your password"
                    autoComplete="new-password"
                    required
                  />

                  <button
                    type="button"
                    className="password-toggle"
                    onClick={togglePassword}
                    aria-label={
                      showPassword
                        ? "Hide password"
                        : "Show password"
                    }
                  >
                    {showPassword ? (
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.7"
                      >
                        <path d="M3 3l18 18" />
                        <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                        <path d="M9.9 4.3A10.6 10.6 0 0 1 12 4c5.2 0 9 4 10 8a10.9 10.9 0 0 1-3.1 4.9" />
                        <path d="M6.6 6.6C4.8 7.8 3.5 9.4 2 12c1 4 4.8 8 10 8 1.3 0 2.5-.2 3.6-.7" />
                      </svg>
                    ) : (
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.7"
                      >
                        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="field">
                <label htmlFor="confirmPassword">
                  CONFIRM PASSWORD
                </label>

                <div className="input-shell">
                  <span className="input-icon">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                    >
                      <rect
                        x="4"
                        y="10"
                        width="16"
                        height="11"
                        rx="2"
                      />
                      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                      <path d="m9 15 2 2 4-4" />
                    </svg>
                  </span>

                  <input
                    id="confirmPassword"
                    type={
                      showConfirmPassword
                        ? "text"
                        : "password"
                    }
                    value={confirmPassword}
                    onChange={(event) =>
                      setConfirmPassword(event.target.value)
                    }
                    placeholder="Re-enter your password"
                    autoComplete="new-password"
                    required
                  />

                  <button
                    type="button"
                    className="password-toggle"
                    onClick={toggleConfirmPassword}
                    aria-label={
                      showConfirmPassword
                        ? "Hide password"
                        : "Show password"
                    }
                  >
                    {showConfirmPassword ? (
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.7"
                      >
                        <path d="M3 3l18 18" />
                        <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                        <path d="M9.9 4.3A10.6 10.6 0 0 1 12 4c5.2 0 9 4 10 8a10.9 10.9 0 0 1-3.1 4.9" />
                        <path d="M6.6 6.6C4.8 7.8 3.5 9.4 2 12c1 4 4.8 8 10 8 1.3 0 2.5-.2 3.6-.7" />
                      </svg>
                    ) : (
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.7"
                      >
                        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <div className="login-error">
                  <span className="error-icon">!</span>
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="login-button"
              >
                <span className="button-shine" />

                {loading ? (
                  <>
                    <span className="spinner" />
                    <span>CREATING ACCOUNT...</span>
                  </>
                ) : (
                  <>
                    <span>CREATE ACCOUNT</span>
                    <span className="button-arrow">→</span>
                  </>
                )}
              </button>
            </form>

            <div className="login-link">
              <span>Already have an account?</span>
              <button
                type="button"
                onClick={() => router.push("/login")}
              >
                Sign in
              </button>
            </div>

            <div className="secure-line">
              <span className="secure-dot" />
              <span>SECURE PERSONAL STORAGE</span>
              <span className="secure-line-fill" />
            </div>
          </div>
        </div>

        <div className="login-footer">
          <span>STOREROOM</span>
          <span className="footer-separator">◆</span>
          <span>PRIVATE BY DESIGN</span>
        </div>
      </div>

      <style jsx>{`
        .storeroom-login {
          position: relative;
          min-height: 100vh;
          min-height: 100svh;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 32px 20px;
          background:
            radial-gradient(
              circle at 50% 40%,
              rgba(67, 56, 202, 0.18),
              transparent 32%
            ),
            radial-gradient(
              circle at 20% 20%,
              rgba(14, 165, 233, 0.1),
              transparent 30%
            ),
            #050713;
          color: white;
        }

        .login-background {
          position: absolute;
          inset: 0;
          overflow: hidden;
          pointer-events: none;
        }

        .aurora {
          position: absolute;
          width: 520px;
          height: 520px;
          border-radius: 50%;
          filter: blur(100px);
          opacity: 0.2;
          animation: auroraMove 12s ease-in-out infinite alternate;
        }

        .aurora-one {
          top: -240px;
          left: -140px;
          background: #38bdf8;
        }

        .aurora-two {
          right: -180px;
          bottom: -250px;
          background: #8b5cf6;
          animation-delay: -4s;
        }

        .aurora-three {
          top: 40%;
          left: 42%;
          width: 300px;
          height: 300px;
          background: #6366f1;
          opacity: 0.12;
          animation-delay: -7s;
        }

        .stars {
          position: absolute;
          inset: 0;
        }

        .star {
          position: absolute;
          width: 2px;
          height: 2px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.8);
          box-shadow:
            0 0 8px rgba(255, 255, 255, 0.8);
          animation: twinkle 3s ease-in-out infinite;
        }

        .crystal {
          position: absolute;
          width: 115px;
          height: 145px;
          clip-path: polygon(
            50% 0%,
            86% 17%,
            100% 73%,
            50% 100%,
            0% 73%,
            14% 17%
          );
          opacity: 0.65;
          filter: drop-shadow(
            0 0 30px rgba(129, 140, 248, 0.3)
          );
          animation:
            crystalFloat
            7s
            ease-in-out
            infinite;
        }

        .crystal::before {
          content: "";
          position: absolute;
          inset: 0;
          background:
            linear-gradient(
              135deg,
              rgba(255, 255, 255, 0.5),
              rgba(99, 102, 241, 0.08) 35%,
              rgba(56, 189, 248, 0.18) 70%,
              rgba(255, 255, 255, 0.2)
            );
          backdrop-filter: blur(5px);
        }

        .crystal-face {
          position: absolute;
          inset: 0;
          opacity: 0.55;
        }

        .face-one {
          clip-path: polygon(
            50% 0%,
            50% 100%,
            0% 73%,
            14% 17%
          );
          background:
            linear-gradient(
              135deg,
              rgba(255, 255, 255, 0.45),
              rgba(129, 140, 248, 0.1)
            );
        }

        .face-two {
          clip-path: polygon(
            50% 0%,
            86% 17%,
            100% 73%,
            50% 100%
          );
          background:
            linear-gradient(
              225deg,
              rgba(125, 211, 252, 0.35),
              rgba(99, 102, 241, 0.05)
            );
        }

        .face-three {
          clip-path: polygon(
            14% 17%,
            86% 17%,
            50% 100%
          );
          background:
            rgba(255, 255, 255, 0.14);
        }

        .crystal-one {
          top: 10%;
          left: 9%;
          transform: rotate(-18deg);
        }

        .crystal-two {
          right: 9%;
          top: 14%;
          width: 80px;
          height: 105px;
          transform: rotate(24deg);
          animation-delay: -2s;
        }

        .crystal-three {
          bottom: 8%;
          left: 10%;
          width: 72px;
          height: 95px;
          transform: rotate(25deg);
          animation-delay: -4s;
        }

        .crystal-four {
          right: 8%;
          bottom: 10%;
          transform: rotate(-22deg);
          animation-delay: -5.5s;
        }

        .login-wrapper {
          position: relative;
          z-index: 5;
          width: 100%;
          max-width: 440px;
        }

        .login-brand {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 13px;
          margin-bottom: 25px;
        }

        .brand-symbol {
          position: relative;
          width: 45px;
          height: 45px;
          transform: rotate(45deg);
          border: 1px solid
            rgba(255, 255, 255, 0.55);
          background:
            linear-gradient(
              135deg,
              rgba(255, 255, 255, 0.17),
              rgba(99, 102, 241, 0.1)
            );
          box-shadow:
            inset 0 0 20px
              rgba(255, 255, 255, 0.08),
            0 0 30px
              rgba(99, 102, 241, 0.28);
        }

        .brand-core {
          position: absolute;
          inset: 9px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 3px;
          transform: rotate(-45deg);
        }

        .brand-core span {
          display: block;
          width: 4px;
          height: 19px;
          border-radius: 3px;
          background:
            linear-gradient(
              to bottom,
              #dbeafe,
              #818cf8
            );
          box-shadow:
            0 0 9px
              rgba(125, 211, 252, 0.7);
        }

        .brand-core span:nth-child(1) {
          height: 13px;
        }

        .brand-core span:nth-child(3) {
          height: 16px;
        }

        /* BRIGHTER STOREROOM */
        .login-brand h1 {
          margin: 0;
          font-size: 21px;
          font-weight: 800;
          letter-spacing: 0.14em;
          color: #eef2ff;
          text-shadow:
            0 0 8px
              rgba(129, 140, 248, 0.4),
            0 0 22px
              rgba(99, 102, 241, 0.2);
        }

        .login-brand p {
          margin: 3px 0 0;
          color: rgba(203, 213, 225, 0.65);
          font-size: 8px;
          letter-spacing: 0.28em;
        }

        .login-card {
          position: relative;
          overflow: hidden;
          border: 1px solid
            rgba(255, 255, 255, 0.14);
          border-radius: 28px;
          background:
            linear-gradient(
              145deg,
              rgba(255, 255, 255, 0.095),
              rgba(255, 255, 255, 0.035)
            );
          box-shadow:
            0 30px 100px
              rgba(0, 0, 0, 0.45),
            inset 0 1px 0
              rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(28px);
          -webkit-backdrop-filter: blur(28px);
        }

        .card-glow {
          position: absolute;
          top: -120px;
          left: 50%;
          width: 300px;
          height: 200px;
          transform: translateX(-50%);
          border-radius: 50%;
          background: #6366f1;
          filter: blur(100px);
          opacity: 0.14;
          pointer-events: none;
        }

        .login-card-content {
          position: relative;
          padding: 38px;
        }

        /* SLIGHTLY LARGER WELCOME BACK */
        .welcome {
          display: flex;
          align-items: center;
          gap: 9px;
          color: #c7d2fe;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.22em;
          text-shadow:
            0 0 10px
              rgba(129, 140, 248, 0.25);
        }

        .welcome-line {
          width: 22px;
          height: 1px;
          background:
            linear-gradient(
              to right,
              transparent,
              #818cf8
            );
        }

        .welcome-line:last-child {
          background:
            linear-gradient(
              to left,
              transparent,
              #818cf8
            );
        }

        .login-card h2 {
          margin: 15px 0 7px;
          font-size: 31px;
          line-height: 1.15;
          letter-spacing: -0.035em;
          color: #f8fafc;
        }

        .login-description {
          margin: 0 0 29px;
          color: rgba(203, 213, 225, 0.58);
          font-size: 13px;
          line-height: 1.6;
        }

        form {
          display: flex;
          flex-direction: column;
          gap: 19px;
        }

        .field label {
          display: block;
          margin-bottom: 8px;
          color: rgba(203, 213, 225, 0.65);
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.2em;
        }

        .input-shell {
          position: relative;
          display: flex;
          align-items: center;
          min-height: 53px;
          border: 1px solid
            rgba(148, 163, 184, 0.18);
          border-radius: 14px;
          background:
            rgba(15, 23, 42, 0.36);
          transition:
            border-color 0.25s ease,
            box-shadow 0.25s ease,
            background 0.25s ease;
        }

        .input-shell:focus-within {
          border-color:
            rgba(129, 140, 248, 0.75);
          background:
            rgba(15, 23, 42, 0.52);
          box-shadow:
            0 0 0 4px
              rgba(99, 102, 241, 0.09),
            0 0 25px
              rgba(99, 102, 241, 0.08);
        }

        .input-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 48px;
          color:
            rgba(148, 163, 184, 0.65);
        }

        .input-icon svg {
          width: 17px;
          height: 17px;
        }

        .input-shell input {
          width: 100%;
          min-width: 0;
          height: 51px;
          border: 0;
          outline: 0;
          background: transparent !important;
          color: #f8fafc !important;
          font-size: 13px;
        }

        .input-shell input::placeholder {
          color:
            rgba(148, 163, 184, 0.43);
        }

        .password-toggle {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 45px;
          height: 45px;
          margin-right: 4px;
          border: 0;
          background: transparent;
          color:
            rgba(148, 163, 184, 0.65);
          cursor: pointer;
        }

        .password-toggle:hover {
          color: #c4b5fd;
        }

        .password-toggle svg {
          width: 17px;
          height: 17px;
        }

        .login-error {
          color: #ffd6d6 !important;
          display: flex;
          align-items: center;
          gap: 11px;
          min-height: 48px;
          padding: 12px 15px;
          border:
            1px solid
            rgba(248, 113, 113, 0.62);
          border-radius: 13px;
          background:
            linear-gradient(
              135deg,
              rgba(127, 29, 29, 0.38),
              rgba(69, 10, 10, 0.28)
            );
          color: #ffd6d6 !important;
          font-size: 12px;
          font-weight: 650;
          line-height: 1.5;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.04),
            0 0 18px rgba(239, 68, 68, 0.08);
          animation: errorIn 0.3s ease;
        }

        .login-error .error-message,
        .login-error > span:not(.error-icon) {
          color: #ffd6d6 !important;
        }

        .error-text {
          color: #ffd6d6 !important;
          font-size: 12px;
          font-weight: 650;
        }

        .error-icon {
          display: flex;
          flex-shrink: 0;
          align-items: center;
          justify-content: center;
          width: 23px;
          height: 23px;
          border:
            2px solid
            #ff6b6b;
          border-radius: 50%;
          background: rgba(239, 68, 68, 0.18);
          color: #ff8a8a;
          font-size: 14px;
          line-height: 1;
          font-weight: 800;
          box-shadow:
            0 0 12px rgba(239, 68, 68, 0.28);
        }

        .login-button {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          overflow: hidden;
          width: 100%;
          height: 55px;
          margin-top: 2px;
          border:
            1px solid
            rgba(165, 180, 252, 0.35);
          border-radius: 14px;
          background:
            linear-gradient(
              110deg,
              #4f46e5,
              #6366f1 45%,
              #7c3aed
            );
          color: white;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.16em;
          cursor: pointer;
          box-shadow:
            0 15px 35px
              rgba(79, 70, 229, 0.28),
            inset 0 1px 0
              rgba(255, 255, 255, 0.22);
          transition:
            transform 0.2s ease,
            box-shadow 0.2s ease,
            filter 0.2s ease;
        }

        .login-button:hover:not(:disabled) {
          transform: translateY(-2px);
          filter: brightness(1.08);
          box-shadow:
            0 20px 45px
              rgba(79, 70, 229, 0.4),
            inset 0 1px 0
              rgba(255, 255, 255, 0.25);
        }

        .login-button:active:not(:disabled) {
          transform: translateY(0);
        }

        .login-button:disabled {
          cursor: not-allowed;
          opacity: 0.7;
        }

        .button-shine {
          position: absolute;
          top: 0;
          left: -100%;
          width: 55%;
          height: 100%;
          transform: skewX(-20deg);
          background:
            linear-gradient(
              90deg,
              transparent,
              rgba(255, 255, 255, 0.18),
              transparent
            );
          animation:
            shine
            4s
            ease-in-out
            infinite;
        }

        .button-arrow {
          font-size: 18px;
          font-weight: 400;
          transition:
            transform 0.2s ease;
        }

        .login-button:hover
          .button-arrow {
          transform: translateX(4px);
        }

        .spinner {
          width: 16px;
          height: 16px;
          border:
            2px solid
            rgba(255, 255, 255, 0.3);
          border-top-color: white;
          border-radius: 50%;
          animation:
            spin
            0.7s
            linear
            infinite;
        }

        .signup-prompt {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          margin-top: 18px;
          color: rgba(203, 213, 225, 0.52);
          font-size: 8px;
          font-weight: 700;
          letter-spacing: 0.13em;
        }

        .signup-prompt button {
          padding: 0;
          border: 0;
          background: transparent;
          color: #c4b5fd;
          font: inherit;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 0.13em;
          cursor: pointer;
          text-decoration: none;
          transition: color 0.2s ease, text-shadow 0.2s ease;
        }

        .signup-prompt button:hover {
          color: #e9d5ff;
          text-shadow: 0 0 12px rgba(167, 139, 250, 0.6);
        }

        .secure-line {
          display: flex;
          align-items: center;
          gap: 7px;
          margin-top: 27px;
          color:
            rgba(148, 163, 184, 0.42);
          font-size: 7px;
          font-weight: 700;
          letter-spacing: 0.17em;
        }

        .secure-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #34d399;
          box-shadow:
            0 0 9px
              rgba(52, 211, 153, 0.8);
        }

        .secure-line-fill {
          flex: 1;
          height: 1px;
          background:
            rgba(148, 163, 184, 0.1);
        }

        .login-footer {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 11px;
          margin-top: 22px;
          color:
            rgba(148, 163, 184, 0.35);
          font-size: 7px;
          font-weight: 700;
          letter-spacing: 0.18em;
        }

        .footer-separator {
          color:
            rgba(129, 140, 248, 0.55);
          font-size: 6px;
        }

        @keyframes auroraMove {
          from {
            transform:
              translate3d(-20px, -10px, 0)
              scale(1);
          }

          to {
            transform:
              translate3d(30px, 25px, 0)
              scale(1.12);
          }
        }

        @keyframes twinkle {
          0%,
          100% {
            opacity: 0.15;
            transform: scale(0.7);
          }

          50% {
            opacity: 0.9;
            transform: scale(1.3);
          }
        }

        @keyframes crystalFloat {
          0%,
          100% {
            translate: 0 0;
          }

          50% {
            translate: 0 -18px;
          }
        }

        @keyframes shine {
          0% {
            left: -100%;
          }

          30%,
          100% {
            left: 160%;
          }
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes errorIn {
          from {
            opacity: 0;
            transform: translateY(-5px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (max-width: 640px) {
          .storeroom-login {
            padding: 22px 15px;
          }

          .login-wrapper {
            max-width: 390px;
          }

          .login-card-content {
            padding: 29px 23px;
          }

          .login-card h2 {
            font-size: 27px;
          }

          .crystal {
            opacity: 0.3;
          }

          .crystal-one {
            left: -30px;
          }

          .crystal-two {
            right: -25px;
          }

          .crystal-three {
            left: -20px;
          }

          .crystal-four {
            right: -30px;
          }
        }

        @media (max-height: 700px) {
          .storeroom-login {
            align-items: flex-start;
            overflow-y: auto;
          }

          .login-wrapper {
            margin: 15px 0;
          }

          .login-brand {
            margin-bottom: 15px;
          }

          .login-card-content {
            padding: 25px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          *,
          *::before,
          *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }
      
        /* =========================================================
           SIGNUP-SPECIFIC POLISH
        ========================================================= */

        .signup-card {
          max-width: 100%;
        }

        .signup-card .login-card-content {
          padding-top: 34px;
          padding-bottom: 30px;
        }

        .signup-card form {
          gap: 15px;
        }

        .signup-card .login-description {
          margin-bottom: 23px;
        }

        .login-link {
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          gap: 7px;
          margin-top: 20px;
          color: rgba(203, 213, 225, 0.62);
          font-size: 12px;
          line-height: 1.4;
        }

        .login-link button {
          border: 0;
          padding: 0;
          background: transparent !important;
          color: #d8ccff !important;
          font-size: 12px;
          font-weight: 800;
          text-decoration: underline;
          text-decoration-thickness: 1px;
          text-underline-offset: 3px;
          cursor: pointer;
          transition: color .2s ease, text-shadow .2s ease;
        }

        .login-link button:hover {
          color: #ffffff !important;
          text-shadow: 0 0 14px rgba(129, 140, 248, .65);
        }

        @media (max-width: 640px) {
          .signup-card .login-card-content {
            padding-top: 27px;
            padding-bottom: 25px;
          }

          .signup-card form {
            gap: 14px;
          }

          .login-link {
            margin-top: 18px;
            font-size: 12px;
          }

          .login-link button {
            font-size: 12px;
          }
        }
`}</style>
    </main>
  );
}