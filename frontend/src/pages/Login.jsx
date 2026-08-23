import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import Wordmark from '../components/Wordmark';
import { Api } from '../lib/api';
import { setWorkerSession, setAdminSession } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { useToast } from '../lib/toast';

const STEP = { LANGUAGE: 'language', ROLE: 'role', WORKER: 'worker', ADMIN: 'admin' };

export default function Login() {
  const [step, setStep] = useState(STEP.LANGUAGE);
  const { t, lang, setLang, LANGUAGES } = useI18n();
  const navigate = useNavigate();
  const { push } = useToast();

  function pickLanguage(code) {
    setLang(code);
    setStep(STEP.ROLE);
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={{ marginBottom: 24 }}><Wordmark size={20} /></div>

        {step === STEP.LANGUAGE && (
          <LanguageStep t={t} value={lang} languages={LANGUAGES} onPick={pickLanguage} />
        )}

        {step === STEP.ROLE && (
          <RoleStep
            t={t}
            onBack={() => setStep(STEP.LANGUAGE)}
            onPick={(role) => setStep(role === 'worker' ? STEP.WORKER : STEP.ADMIN)}
          />
        )}

        {step === STEP.WORKER && (
          <WorkerAuth
            t={t}
            onBack={() => setStep(STEP.ROLE)}
            onSuccess={() => navigate('/worker/ask')}
            toast={push}
          />
        )}

        {step === STEP.ADMIN && (
          <AdminAuth
            t={t}
            onBack={() => setStep(STEP.ROLE)}
            onSuccess={() => navigate('/admin/pending-workers')}
            toast={push}
          />
        )}
      </div>
    </div>
  );
}

function LanguageStep({ t, value, languages, onPick }) {
  return (
    <div style={{ animation: 'fadeIn var(--sv-transition-base)' }}>
      <p style={styles.heading}>{t('selectLanguage')}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 24 }}>
        {languages.map((l) => (
          <button
            key={l.code}
            className="sv-btn sv-btn--outline sv-btn--full"
            style={{
              justifyContent: 'flex-start',
              padding: '14px 16px',
              fontSize: '14px',
              fontWeight: 600,
              borderRadius: 'var(--sv-radius-md)',
              border: value === l.code ? '2px solid var(--sv-brass)' : '1.5px solid var(--sv-border)',
              background: value === l.code ? 'var(--sv-brass-soft)' : 'transparent',
              color: value === l.code ? 'var(--sv-brass)' : 'var(--sv-ink)',
            }}
            onClick={() => onPick(l.code)}
          >
            {l.native}
          </button>
        ))}
      </div>
    </div>
  );
}

function RoleStep({ t, onBack, onPick }) {
  return (
    <div style={{ animation: 'slideInUp var(--sv-transition-base)' }}>
      <BackButton t={t} onClick={onBack} />
      <p style={styles.heading}>{t('selectRole')}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 24 }}>
        <button
          className="sv-btn sv-btn--outline sv-btn--full"
          style={{ justifyContent: 'flex-start', padding: '16px', textAlign: 'left', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}
          onClick={() => onPick('worker')}
        >
          <span style={{ fontWeight: 600, fontSize: 15 }}>{t('roleWorker')}</span>
          <span style={{ fontSize: 12, color: 'var(--sv-muted)', fontWeight: 400 }}>{t('roleWorkerHint')}</span>
        </button>
        <button
          className="sv-btn sv-btn--outline sv-btn--full"
          style={{ justifyContent: 'flex-start', padding: '16px', textAlign: 'left', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}
          onClick={() => onPick('admin')}
        >
          <span style={{ fontWeight: 600, fontSize: 15 }}>{t('roleAdmin')}</span>
          <span style={{ fontSize: 12, color: 'var(--sv-muted)', fontWeight: 400 }}>{t('roleAdminHint')}</span>
        </button>
      </div>
    </div>
  );
}

function WorkerAuth({ t, onBack, onSuccess, toast }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register' | 'registered'
  const [workerId, setWorkerId] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [busy, setBusy] = useState(false);
  const [issuedId, setIssuedId] = useState('');

  async function handleLogin(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await Api.workerLogin(workerId, password);
      setWorkerSession(res.token, res.name, res.worker_id || workerId);
      toast(`${res.name}`, 'success');
      onSuccess();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await Api.workerRegister(password, name, phone || null, address || null);
      setIssuedId(res.worker_id);
      setWorkerId(res.worker_id);
      setMode('registered');
      toast(t('registerSuccessBody'), 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  if (mode === 'registered') {
    return (
      <div style={{ animation: 'slideInUp var(--sv-transition-base)' }}>
        <p style={styles.heading}>{t('registerSuccessTitle')}</p>
        <p style={{ ...styles.sub, marginTop: 12 }}>{t('registerSuccessBody')}</p>
        <div className="sv-card" style={{ marginTop: 20, padding: 16, background: 'var(--sv-brass-soft)', border: '1px solid var(--sv-brass)' }}>
          <p style={{ fontSize: 12, color: 'var(--sv-muted)', marginBottom: 6 }}>{t('yourWorkerId')}</p>
          <p style={{ fontSize: 22, fontFamily: 'var(--sv-font-mono)', fontWeight: 700, color: 'var(--sv-ink)', letterSpacing: '0.04em' }}>
            {issuedId}
          </p>
          <p style={{ fontSize: 12, color: 'var(--sv-muted)', marginTop: 8 }}>{t('saveWorkerIdHint')}</p>
        </div>
        <button
          className="sv-btn sv-btn--primary sv-btn--full"
          style={{ marginTop: 20, padding: '14px 16px' }}
          onClick={() => setMode('login')}
        >
          {t('backToLogin')}
        </button>
      </div>
    );
  }

  return (
    <div style={{ animation: 'slideInUp var(--sv-transition-base)' }}>
      <BackButton t={t} onClick={onBack} />
      <p style={styles.heading}>{mode === 'login' ? t('workerLoginTab') : t('workerRegisterTab')}</p>
      <form onSubmit={mode === 'login' ? handleLogin : handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 24 }}>
        {mode === 'register' && (
          <>
            <input
              style={styles.input}
              placeholder={t('nameLabel')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <input
              style={styles.input}
              placeholder={t('phoneLabel')}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
            />
            <textarea
              style={{ ...styles.input, minHeight: 72, resize: 'vertical' }}
              placeholder={t('addressLabel')}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={2}
            />
          </>
        )}
        {mode === 'login' && (
          <input
            style={styles.input}
            placeholder={t('workerIdLabel')}
            value={workerId}
            onChange={(e) => setWorkerId(e.target.value)}
            required
          />
        )}
        <input
          style={styles.input}
          placeholder={t('passwordLabel')}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={mode === 'register' ? 4 : undefined}
        />
        <button
          className="sv-btn sv-btn--primary sv-btn--full"
          style={{ padding: '14px 16px', fontSize: '14px', fontWeight: 600, borderRadius: 'var(--sv-radius-md)' }}
          disabled={busy}
          type="submit"
        >
          {busy ? t('loading') : mode === 'login' ? t('loginBtn') : t('registerBtn')}
        </button>
      </form>
      <button
        style={{ ...styles.linkBtn, marginTop: 16 }}
        onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
      >
        {mode === 'login' ? t('workerRegisterTab') : t('backToLogin')}
      </button>
    </div>
  );
}

function AdminAuth({ t, onBack, onSuccess, toast }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await Api.adminLogin(username, password);
      setAdminSession(res.token);
      onSuccess();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ animation: 'slideInUp var(--sv-transition-base)' }}>
      <BackButton t={t} onClick={onBack} />
      <p style={styles.heading}>{t('roleAdmin')}</p>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 24 }}>
        <input
          style={styles.input}
          placeholder={t('adminUsernameLabel')}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <input
          style={styles.input}
          placeholder={t('adminPasswordLabel')}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button
          className="sv-btn sv-btn--primary sv-btn--full"
          style={{ padding: '14px 16px', fontSize: '14px', fontWeight: 600, borderRadius: 'var(--sv-radius-md)' }}
          disabled={busy}
          type="submit"
        >
          {busy ? t('loading') : t('adminLoginBtn')}
        </button>
      </form>
    </div>
  );
}

function BackButton({ t, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{ ...styles.linkBtn, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 12 }}
      title={t('back')}
    >
      <ChevronLeft size={16} strokeWidth={2.5} /> {t('back')}
    </button>
  );
}

const styles = {
  page: {
    minHeight: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 16px',
    background: 'linear-gradient(135deg, var(--sv-bg) 0%, var(--sv-bg-secondary) 100%)',
    position: 'relative',
    overflow: 'hidden',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    background: 'var(--sv-surface)',
    border: '1px solid var(--sv-border)',
    borderRadius: 'var(--sv-radius-xl)',
    padding: '48px 32px',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.08)',
    animation: 'slideInUp var(--sv-transition-slow)',
  },
  heading: {
    fontFamily: 'var(--sv-font-display)',
    fontWeight: 700,
    fontSize: '22px',
    color: 'var(--sv-ink)',
    marginBottom: 8,
    letterSpacing: '-0.02em',
  },
  sub: {
    fontSize: '13px',
    color: 'var(--sv-muted)',
    marginTop: 4,
    lineHeight: 1.5,
  },
  input: {
    border: '1.5px solid var(--sv-border)',
    borderRadius: 'var(--sv-radius-md)',
    padding: '12px 16px',
    fontSize: '14px',
    outline: 'none',
    background: 'var(--sv-bg)',
    color: 'var(--sv-ink)',
    transition: 'all var(--sv-transition-fast)',
    fontFamily: 'var(--sv-font-body)',
    fontWeight: 500,
  },
  linkBtn: {
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--sv-brass)',
    textAlign: 'left',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: '8px 0',
    transition: 'all var(--sv-transition-fast)',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
};