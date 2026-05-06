'use client';
import { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import styles from './login.module.css';

export default function LoginPage() {
  const { user, login, register, registrationOpen, loading } = useAuth();
  const router = useRouter();
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace('/chat');
    if (!loading && registrationOpen) setIsRegister(true);
  }, [user, loading, registrationOpen, router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (isRegister) {
        await register(username, password);
      } else {
        await login(username, password);
      }
      router.replace('/chat');
    } catch (err) {
      const apiErr = err as { error?: string };
      setError(apiErr.error ?? 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className={styles.container}><div className={styles.loading}>Loading...</div></div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>✦</span>
          <h1 className={styles.logoText}>GeminiRelay</h1>
        </div>
        <p className={styles.subtitle}>
          {isRegister ? 'Create the first account to get started' : 'Sign in to your account'}
        </p>
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label}>Username</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className={styles.input}
              autoComplete="username"
              required
              autoFocus
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className={styles.input}
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              required
              minLength={isRegister ? 8 : undefined}
            />
            {isRegister && <p className={styles.hint}>Minimum 8 characters</p>}
          </div>
          {error && <div className={styles.error}>{error}</div>}
          <button type="submit" disabled={submitting} className={styles.button}>
            {submitting ? 'Please wait...' : isRegister ? 'Create Account' : 'Sign In'}
          </button>
        </form>
        {!registrationOpen && (
          <p className={styles.footer}>
            {isRegister ? (
              <>Already have an account? <button onClick={() => setIsRegister(false)} className={styles.link}>Sign in</button></>
            ) : null}
          </p>
        )}
      </div>
    </div>
  );
}
