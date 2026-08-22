import { useEffect, useState } from 'react'
import {
  Activity,
  Apple,
  BatteryCharging,
  Bell,
  Bluetooth,
  ChevronRight,
  CircleUserRound,
  Footprints,
  Gauge,
  Heart,
  House,
  Link2,
  LockKeyhole,
  LogIn,
  Moon,
  Settings2,
  ShieldCheck,
  UserRound,
  Waves,
  X,
} from 'lucide-react'
import { loadHealthDashboard, saveDeviceSettings } from './health-data'
import { getAuthRedirectTo, signInWithProvider, subscribeToNativeAuth } from './native-auth'
import { supabase } from './supabase'
import './HeartRing.css'

const tabs = [
  { name: 'Inicio', icon: House },
  { name: 'Deporte', icon: Activity },
  { name: 'Anillo', icon: Waves },
  { name: 'Perfil', icon: UserRound },
]

const metricLabels = {
  heart_rate: 'Frecuencia cardiaca',
  blood_oxygen: 'Oxígeno en sangre',
  blood_pressure: 'Presión arterial',
}

const emptyDashboard = { ring: null, measurements: [], activity: [], sleep: [], settings: null }

function formatDate(value, includeTime = true) {
  if (!value) return 'Sin registros'
  return new Intl.DateTimeFormat('es-AR', {
    day: 'numeric',
    month: 'short',
    ...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(new Date(value))
}

function latestMetric(measurements, type) {
  return measurements.find((measurement) => measurement.metric_type === type)
}

function valueForMetric(measurement, type) {
  if (!measurement) return { value: '—', unit: '' }
  if (type === 'blood_pressure') {
    return { value: `${measurement.systolic_mmhg ?? '—'}/${measurement.diastolic_mmhg ?? '—'}`, unit: 'mmHg' }
  }
  return { value: measurement.value ?? '—', unit: type === 'heart_rate' ? 'lpm' : '%' }
}

function initials(user) {
  if (!user) return '?'
  const name = user.user_metadata?.full_name || user.email || '?'
  return name.slice(0, 2).toUpperCase()
}

function Chart({ activity }) {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - 6)
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return date
  })
  const byDate = new Map(activity.map((entry) => [entry.recorded_on, Number(entry.steps) || 0]))
  const values = days.map((date) => byDate.get(date.toISOString().slice(0, 10)) || 0)
  const hasData = values.some((value) => value > 0)
  const maximum = Math.max(...values, 1)
  const points = values.map((value, index) => `${index * 16.66 + 1},${92 - (value / maximum) * 72}`).join(' ')

  return (
    <div className="chart-wrap">
      {hasData ? (
        <svg className="steps-chart" viewBox="0 0 102 100" preserveAspectRatio="none" role="img" aria-label="Pasos de los últimos siete días">
          <line x1="0" y1="18" x2="102" y2="18" className="chart-guide" />
          <line x1="0" y1="55" x2="102" y2="55" className="chart-guide" />
          <line x1="0" y1="92" x2="102" y2="92" className="chart-guide" />
          <polyline points={points} className="chart-line" />
        </svg>
      ) : <div className="empty-chart"><Footprints size={22} /><span>Aún no hay datos de pasos.</span></div>}
      <div className="chart-labels">{days.map((date) => <span key={date.toISOString()}>{new Intl.DateTimeFormat('es-AR', { weekday: 'narrow' }).format(date)}</span>)}</div>
    </div>
  )
}

function MetricCard({ icon: Icon, title, type, measurements }) {
  const measurement = latestMetric(measurements, type)
  const { value, unit } = valueForMetric(measurement, type)
  return (
    <article className="metric-card">
      <span className={`metric-icon ${type}`}><Icon size={18} /></span>
      <p>{title}</p>
      <strong>{value}<small>{unit}</small></strong>
      <span className="metric-time">{measurement ? `Actualizado ${formatDate(measurement.measured_at)}` : 'Sin mediciones recibidas'}</span>
    </article>
  )
}

function AuthSheet({ onClose, onAuthenticated }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const redirectTo = getAuthRedirectTo()

  const submit = async (event) => {
    event.preventDefault()
    if (!supabase) {
      setMessage('Configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY para activar el acceso.')
      return
    }
    setBusy(true)
    const result = mode === 'login'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo } })
    setBusy(false)
    if (result.error) {
      setMessage(result.error.message)
      return
    }
    if (result.data.session) {
      onAuthenticated(result.data.session)
      onClose()
      return
    }
    setMessage('Revisa tu correo para confirmar la cuenta antes de vincular el anillo.')
  }

  const signInWith = async (provider) => {
    if (!supabase) {
      setMessage('Configura Supabase para activar este proveedor.')
      return
    }
    setBusy(true)
    const { error } = await signInWithProvider(provider)
    setBusy(false)
    if (error) setMessage(error.message)
  }

  return (
    <div className="auth-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="auth-sheet" role="dialog" aria-modal="true" aria-labelledby="auth-title" onMouseDown={(event) => event.stopPropagation()}>
        <button className="icon-button close-button" type="button" onClick={onClose} aria-label="Cerrar acceso"><X size={19} /></button>
        <span className="auth-mark"><Heart size={20} fill="currentColor" /></span>
        <p className="eyebrow">CUENTA HEART RING</p>
        <h2 id="auth-title">{mode === 'login' ? 'Inicia sesión para vincular' : 'Crea tu cuenta privada'}</h2>
        <p className="auth-copy">Puedes explorar la aplicación sin cuenta. El acceso es necesario para vincular y guardar datos del anillo.</p>
        <div className="auth-switch" role="tablist" aria-label="Tipo de acceso">
          <button className={mode === 'login' ? 'active' : ''} type="button" role="tab" onClick={() => setMode('login')}>Entrar</button>
          <button className={mode === 'register' ? 'active' : ''} type="button" role="tab" onClick={() => setMode('register')}>Crear cuenta</button>
        </div>
        <form onSubmit={submit}>
          <label>Correo electrónico<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="tu@correo.com" required /></label>
          <label>Contraseña<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Mínimo 6 caracteres" minLength="6" required /></label>
          <button className="primary-button auth-submit" type="submit" disabled={busy}>{busy ? 'Conectando...' : mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}</button>
        </form>
        <div className="auth-divider"><span>o continúa con</span></div>
        <div className="oauth-stack">
          <button className="oauth-button" type="button" onClick={() => signInWith('google')} disabled={busy}><span className="google-mark">G</span>Continuar con Google</button>
          <button className="oauth-button apple-button" type="button" onClick={() => signInWith('apple')} disabled={busy}><Apple size={17} />Continuar con Apple</button>
        </div>
        {message && <p className="auth-message" role="status">{message}</p>}
      </section>
    </div>
  )
}

function RingVisual({ paired, pairing }) {
  return <div className={`ring-visual ${paired ? 'is-paired' : ''} ${pairing ? 'is-pairing' : ''}`} aria-hidden="true"><span className="ring-led led-one" /><span className="ring-led led-two" /><span className="ring-led led-three" /><div className="ring-body"><span /></div></div>
}

function HomeView({ session, ring, measurements, activity, sleep, pairing, onPair, openDevice }) {
  const currentActivity = activity.at(-1)
  const latestSleep = sleep[0]
  return <>
    <section className="hero-grid">
      <article className="ring-status-card">
        <div className="status-card-copy">
          <p className="eyebrow">{session ? 'TU DISPOSITIVO' : 'MODO EXPLORACIÓN'}</p>
          <h2>{ring ? 'Anillo vinculado' : session ? 'Vincula tu anillo' : 'Explora Heart Ring'}</h2>
          <p>{ring ? 'Tus próximas mediciones aparecerán automáticamente cuando el anillo sincronice.' : session ? 'Inicia el emparejado Bluetooth para guardar tus mediciones en privado.' : 'Puedes conocer todas las secciones. Inicia sesión solo cuando quieras vincular un dispositivo.'}</p>
          <button className="primary-button" type="button" onClick={onPair} disabled={pairing}><Link2 size={17} />{pairing ? 'Buscando dispositivo...' : ring ? 'Vincular otro anillo' : 'Vincular anillo'}</button>
        </div>
        <RingVisual paired={Boolean(ring)} pairing={pairing} />
      </article>
      <article className="privacy-card"><span className="metric-icon privacy"><ShieldCheck size={19} /></span><p className="eyebrow">DATOS PRIVADOS</p><h2>Solo tuyos.</h2><p>Las lecturas se muestran cuando llegan desde tu anillo y quedan asociadas a tu cuenta.</p><button className="text-button" type="button" onClick={openDevice}>Ver configuración <ChevronRight size={15} /></button></article>
    </section>
    <section className="section-heading"><div><h2>Salud</h2><p>{session ? 'Lecturas recibidas desde tu dispositivo.' : 'Las lecturas aparecerán aquí cuando conectes tu anillo.'}</p></div></section>
    <section className="metrics-grid"><MetricCard icon={Heart} title="Frecuencia cardiaca" type="heart_rate" measurements={measurements} /><MetricCard icon={Waves} title="Oxígeno en sangre" type="blood_oxygen" measurements={measurements} /><MetricCard icon={Gauge} title="Presión arterial" type="blood_pressure" measurements={measurements} /></section>
    <section className="section-heading"><div><h2>Movimiento</h2><p>Actividad acumulada durante el día.</p></div></section>
    <section className="movement-grid">
      <article className="movement-card"><span className="metric-icon activity"><Footprints size={18} /></span><p>Pasos de hoy</p><strong>{currentActivity?.steps ?? '—'}<small> pasos</small></strong><div className="movement-details"><span>{currentActivity?.distance_km ?? '—'} km</span><span>{currentActivity?.calories_kcal ?? '—'} kcal</span></div></article>
      <article className="movement-card"><span className="metric-icon sleep"><Moon size={18} /></span><p>Sueño más reciente</p><strong>{latestSleep?.total_minutes ? `${Math.floor(latestSleep.total_minutes / 60)} h ${latestSleep.total_minutes % 60} m` : '—'}</strong><div className="movement-details"><span>{latestSleep ? formatDate(latestSleep.started_at) : 'Sin sesiones registradas'}</span></div></article>
    </section>
    <section className="section-heading"><div><h2>Pasos de la semana</h2><p>El anillo reinicia el acumulado diario a las 00:00.</p></div></section>
    <article className="chart-card"><div className="chart-summary"><p>Actividad registrada en los últimos 7 días</p><span>{activity.length ? `${activity.length} día${activity.length === 1 ? '' : 's'} con datos` : 'Sin datos'}</span></div><Chart activity={activity} /></article>
  </>
}

function ActivityView({ activity, sleep }) {
  const currentActivity = activity.at(-1)
  const latestSleep = sleep[0]
  return <><section className="page-intro"><span className="metric-icon activity"><Activity size={19} /></span><div><p className="eyebrow">ACTIVIDAD DIARIA</p><h2>Tu movimiento real.</h2></div></section><section className="activity-summary"><div><p>CALORÍAS ACTIVAS</p><strong>{currentActivity?.calories_kcal ?? '—'}<small> kcal</small></strong><span>{currentActivity ? 'Dato recibido desde el anillo.' : 'No hay actividad registrada aún.'}</span></div><div><p>DISTANCIA</p><strong>{currentActivity?.distance_km ?? '—'}<small> km</small></strong><span>{currentActivity ? 'Dato recibido desde el anillo.' : 'No hay actividad registrada aún.'}</span></div><div><p>SUEÑO</p><strong>{latestSleep?.total_minutes ? `${Math.floor(latestSleep.total_minutes / 60)} h` : '—'}</strong><span>{latestSleep ? `Sesión del ${formatDate(latestSleep.sleep_date, false)}` : 'No hay sesiones registradas.'}</span></div></section><section className="section-heading"><div><h2>Historial de pasos</h2><p>Datos reales del anillo durante los últimos 7 días.</p></div></section><article className="chart-card"><Chart activity={activity} /></article></>
}

function SettingRow({ icon: Icon, label, description, checked, onChange, disabled }) {
  return <div className="setting-row"><span className="setting-icon"><Icon size={18} /></span><div><strong>{label}</strong><p>{description}</p></div><button className={`switch ${checked ? 'on' : ''}`} type="button" onClick={onChange} disabled={disabled} aria-label={`Cambiar ${label}`}><i /></button></div>
}

function DeviceView({ session, ring, settings, pairing, onPair, onSettingsChange }) {
  const activeSettings = settings ?? { heart_rate_interval_minutes: 60, blood_oxygen_interval_minutes: 60, manual_measurements: true }
  return <><section className="page-intro"><span className="metric-icon bluetooth"><Bluetooth size={19} /></span><div><p className="eyebrow">DISPOSITIVO</p><h2>Heart Ring</h2></div></section><article className="device-card"><RingVisual paired={Boolean(ring)} pairing={pairing} /><div><p className="connection-label">{ring ? 'VINCULADO A TU CUENTA' : 'SIN VINCULAR'}</p><h3>{ring?.bluetooth_name || 'Tu anillo aún no está conectado'}</h3><p>{ring ? `Vinculado el ${formatDate(ring.paired_at)}` : 'Necesitas una cuenta para iniciar el emparejado Bluetooth.'}</p><button className="primary-button" type="button" onClick={onPair} disabled={pairing}><Link2 size={16} />{pairing ? 'Buscando...' : 'Vincular anillo'}</button></div></article><section className="device-specs"><span><Bluetooth size={17} /><strong>Bluetooth 5.0</strong><small>Emparejamiento inalámbrico</small></span><span><BatteryCharging size={17} /><strong>18 mAh</strong><small>Carga magnética, aprox. 1 h</small></span><span><LockKeyhole size={17} /><strong>7 días</strong><small>Conservación rodante</small></span></section><section className="section-heading"><div><h2>Mediciones</h2><p>{session ? 'Guarda estos ajustes en tu cuenta.' : 'Inicia sesión para modificar los ajustes.'}</p></div></section><section className="settings-list"><SettingRow icon={Heart} label="Frecuencia cardiaca automática" description={`Cada ${activeSettings.heart_rate_interval_minutes} minutos`} checked={activeSettings.heart_rate_interval_minutes === 60} disabled={!session} onChange={() => onSettingsChange({ heart_rate_interval_minutes: activeSettings.heart_rate_interval_minutes === 60 ? null : 60 })} /><SettingRow icon={Waves} label="Oxígeno en sangre automático" description={`Cada ${activeSettings.blood_oxygen_interval_minutes} minutos`} checked={activeSettings.blood_oxygen_interval_minutes === 60} disabled={!session} onChange={() => onSettingsChange({ blood_oxygen_interval_minutes: activeSettings.blood_oxygen_interval_minutes === 60 ? null : 60 })} /><SettingRow icon={Settings2} label="Medición manual" description="Disponible desde la aplicación cuando el anillo esté conectado" checked={activeSettings.manual_measurements} disabled={!session} onChange={() => onSettingsChange({ manual_measurements: !activeSettings.manual_measurements })} /><div className="setting-row"><span className="setting-icon"><Moon size={18} /></span><div><strong>Detección de sueño</strong><p>Ventana diaria de 22:00 a 08:00</p></div></div></section></>
}

function ProfileView({ session, measurements, onOpenAuth, onSignOut }) {
  return <><section className="profile-hero"><span className="profile-avatar">{initials(session?.user)}</span><div><p className="eyebrow">{session ? 'CUENTA CONECTADA' : 'MODO EXPLORACIÓN'}</p><h2>{session?.user?.email || 'Explora sin iniciar sesión'}</h2><p>{session ? 'Tus datos están protegidos por tu cuenta.' : 'Puedes recorrer la aplicación sin crear una cuenta.'}</p></div>{session ? <button className="outline-button" type="button" onClick={onSignOut}>Cerrar sesión</button> : <button className="outline-button" type="button" onClick={onOpenAuth}><LogIn size={16} />Acceder</button>}</section><section className="section-heading"><div><h2>Historial de salud</h2><p>Últimos 7 días conservados.</p></div></section>{measurements.length ? <section className="history-list">{measurements.slice(0, 7).map((measurement) => <article className="history-row" key={measurement.id}><span className="metric-icon heart_rate"><Heart size={17} /></span><div><strong>{metricLabels[measurement.metric_type]}</strong><p>{formatDate(measurement.measured_at)}</p></div><span>{valueForMetric(measurement, measurement.metric_type).value}</span></article>)}</section> : <section className="empty-state"><CircleUserRound size={22} /><strong>No hay historial todavía</strong><p>Las mediciones sincronizadas desde un anillo vinculado aparecerán aquí.</p></section>}</>
}

function App() {
  const [activeTab, setActiveTab] = useState('Inicio')
  const [session, setSession] = useState(null)
  const [dashboard, setDashboard] = useState(emptyDashboard)
  const [pairing, setPairing] = useState(false)
  const [showAuth, setShowAuth] = useState(false)
  const [notice, setNotice] = useState('')

  const reloadDashboard = async (userId) => {
    if (!userId) return
    try {
      const data = await loadHealthDashboard(userId)
      if (data) setDashboard(data)
    } catch (error) {
      setNotice(`No se pudieron cargar tus datos: ${error.message}`)
    }
  }

  useEffect(() => {
    if (!supabase) return undefined
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!nextSession) setDashboard(emptyDashboard)
      setSession(nextSession)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => subscribeToNativeAuth(setSession, (message) => setNotice(`No se pudo completar el acceso: ${message}`)), [])

  useEffect(() => {
    if (!session?.user?.id) return undefined
    let active = true

    loadHealthDashboard(session.user.id)
      .then((data) => {
        if (active && data) setDashboard(data)
      })
      .catch((error) => {
        if (active) setNotice(`No se pudieron cargar tus datos: ${error.message}`)
      })

    return () => { active = false }
  }, [session?.user?.id])

  const handlePair = async () => {
    setNotice('')
    if (!session) {
      setShowAuth(true)
      return
    }
    if (!navigator.bluetooth) {
      setNotice('Este navegador no admite Web Bluetooth. Usa Chrome o la compilación móvil con la integración BLE del anillo.')
      return
    }
    setPairing(true)
    try {
      const device = await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: ['battery_service', 'device_information'] })
      const { error } = await supabase.from('rings').upsert({ user_id: session.user.id, bluetooth_id: device.id, bluetooth_name: device.name || 'Heart Ring', paired_at: new Date().toISOString() }, { onConflict: 'user_id,bluetooth_id' })
      if (error) throw error
      await reloadDashboard(session.user.id)
      setNotice('Anillo vinculado. Las lecturas aparecerán cuando el protocolo del dispositivo las sincronice.')
    } catch (error) {
      if (error.name !== 'NotFoundError') setNotice(`No se pudo vincular el anillo: ${error.message}`)
    } finally {
      setPairing(false)
    }
  }

  const updateSettings = async (changes) => {
    if (!session) { setShowAuth(true); return }
    try {
      await saveDeviceSettings(session.user.id, changes)
      await reloadDashboard(session.user.id)
    } catch (error) {
      setNotice(`No se pudo guardar el ajuste: ${error.message}`)
    }
  }

  const signOut = async () => {
    await supabase?.auth.signOut()
    setDashboard(emptyDashboard)
    setActiveTab('Inicio')
  }

  return <main className="heart-app"><aside className="sidebar"><div className="brand"><span className="brand-symbol"><Heart size={17} fill="currentColor" /></span><span>heart ring</span></div><nav className="side-nav" aria-label="Navegación principal">{tabs.map(({ name, icon: Icon }) => <button className={activeTab === name ? 'active' : ''} key={name} type="button" onClick={() => setActiveTab(name)}><Icon size={18} /><span>{name}</span></button>)}</nav><section className="sidebar-device"><Bluetooth size={16} /><span>{dashboard.ring ? 'Anillo vinculado' : 'Sin anillo vinculado'}</span></section><button className="account-button" type="button" onClick={() => setShowAuth(true)}><span className="avatar">{initials(session?.user)}</span><span>{session?.user?.email || 'Inicia sesión'}</span><ChevronRight size={16} /></button></aside><section className="main-panel"><header className="topbar"><div><p>{new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}</p><h1>{activeTab === 'Inicio' ? 'Tu salud, en contexto.' : activeTab}</h1></div><div className="top-actions"><button className="icon-button" type="button" aria-label="Notificaciones"><Bell size={19} /></button><button className="avatar" type="button" onClick={() => setShowAuth(true)} aria-label="Abrir acceso">{initials(session?.user)}</button></div></header>{notice && <div className="notice" role="status"><span>{notice}</span><button type="button" onClick={() => setNotice('')} aria-label="Cerrar aviso"><X size={15} /></button></div>}{activeTab === 'Inicio' && <HomeView session={session} ring={dashboard.ring} measurements={dashboard.measurements} activity={dashboard.activity} sleep={dashboard.sleep} pairing={pairing} onPair={handlePair} openDevice={() => setActiveTab('Anillo')} />}{activeTab === 'Deporte' && <ActivityView activity={dashboard.activity} sleep={dashboard.sleep} />}{activeTab === 'Anillo' && <DeviceView session={session} ring={dashboard.ring} settings={dashboard.settings} pairing={pairing} onPair={handlePair} onSettingsChange={updateSettings} />}{activeTab === 'Perfil' && <ProfileView session={session} measurements={dashboard.measurements} onOpenAuth={() => setShowAuth(true)} onSignOut={signOut} />}</section><nav className="mobile-nav" aria-label="Navegación móvil">{tabs.map(({ name, icon: Icon }) => <button className={activeTab === name ? 'active' : ''} key={name} type="button" onClick={() => setActiveTab(name)}><Icon size={18} /><span>{name}</span></button>)}</nav>{showAuth && <AuthSheet onClose={() => setShowAuth(false)} onAuthenticated={setSession} />}</main>
}

export default App