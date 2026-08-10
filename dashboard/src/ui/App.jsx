import React, { useEffect, useMemo, useState } from 'react'
import axios from 'axios'

const base = import.meta.env.VITE_API_BASE || 'http://localhost:3000/v1'

export default function App(){
  const [token, setToken] = useState(() => sessionStorage.getItem('infotier_token') || '')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [items, setItems] = useState([])
  const [selected, setSelected] = useState(null)
  const [logs, setLogs] = useState([])
  const api = useMemo(() => axios.create({ baseURL: base, headers: token ? { Authorization: `Bearer ${token}` } : {} }), [token])

  function logout(){ sessionStorage.removeItem('infotier_token'); setToken(''); setItems([]); setSelected(null) }
  async function login(event){
    event.preventDefault(); setError('')
    try {
      const response = await axios.post(`${base}/auth/login`, { password })
      sessionStorage.setItem('infotier_token', response.data.accessToken)
      setToken(response.data.accessToken); setPassword('')
    } catch { setError('Login failed') }
  }
  async function refresh(){
    try { const r = await api.get('/verifications'); setItems(r.data); setError('') }
    catch (e) { if (e.response?.status === 401) logout(); else setError('Could not load verifications') }
  }
  async function openItem(id){
    try {
      const [record, audit] = await Promise.all([api.get(`/verifications/${id}`), api.get(`/verifications/${id}/logs`)])
      setSelected(record.data); setLogs(audit.data)
    } catch { setError('Could not load this verification') }
  }
  async function decide(action){
    if (!selected) return
    try { await api.post(`/verifications/${selected.id}/decision`, { action }); await openItem(selected.id); await refresh() }
    catch { setError('Decision could not be saved') }
  }
  useEffect(()=>{ if (!token) return; refresh(); const t=setInterval(refresh,10000); return ()=>clearInterval(t) },[token])

  if (!token) return <main style={styles.loginPage}>
    <form onSubmit={login} style={styles.card}>
      <h1 style={{marginTop:0}}>Infotier</h1>
      <p>Secure administration</p>
      <label>Administrator password</label>
      <input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required style={styles.input}/>
      <button type="submit" style={styles.primary}>Sign in</button>
      {error && <p role="alert" style={styles.error}>{error}</p>}
    </form>
  </main>

  return <main style={styles.page}>
    <header style={styles.header}><div><h1 style={{margin:0}}>Infotier</h1><small>Verification administration</small></div><button onClick={logout}>Sign out</button></header>
    {error && <p role="alert" style={styles.error}>{error}</p>}
    <div style={styles.grid}>
      <section style={styles.card}>
        <h2>Verifications</h2>
        {items.length === 0 ? <p>No verification records yet.</p> : <table style={{width:'100%', borderCollapse:'collapse'}}>
          <thead><tr><th style={styles.th}>ID</th><th style={styles.th}>Status</th><th style={styles.th}>Score</th><th style={styles.th}>Created</th></tr></thead>
          <tbody>{items.map(r => <tr key={r.id} onClick={()=>openItem(r.id)} style={{cursor:'pointer'}}>
            <td style={styles.td}>{r.id.slice(0,12)}…</td><td style={styles.td}>{r.status}</td><td style={styles.td}>{r.score?.toFixed?.(2) ?? '-'}</td><td style={styles.td}>{new Date(r.createdAt).toLocaleString()}</td>
          </tr>)}</tbody>
        </table>}
      </section>
      <section style={styles.card}>
        {!selected ? <p>Select a verification.</p> : <>
          <div style={{display:'flex', gap:8}}><button onClick={()=>decide('approved')} style={styles.primary}>Approve</button><button onClick={()=>decide('rejected')}>Reject</button></div>
          <pre style={styles.pre}>{JSON.stringify(selected,null,2)}</pre>
          <h3>Audit log</h3><ul>{logs.map(l => <li key={l.id}>{new Date(l.createdAt).toLocaleString()} — {l.action} by {l.actor}</li>)}</ul>
        </>}
      </section>
    </div>
  </main>
}

const styles = {
  loginPage:{minHeight:'100vh',display:'grid',placeItems:'center',background:'#0b1020',fontFamily:'system-ui',color:'#e8eefc'},
  page:{minHeight:'100vh',padding:24,background:'#f4f6fa',fontFamily:'system-ui',color:'#172033'},
  header:{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20},
  grid:{display:'grid',gridTemplateColumns:'minmax(0,1.2fr) minmax(0,1fr)',gap:20},
  card:{background:'#fff',color:'#172033',padding:24,borderRadius:12,boxShadow:'0 8px 30px #0001',minWidth:300},
  input:{display:'block',boxSizing:'border-box',width:'100%',padding:10,margin:'8px 0 14px',border:'1px solid #b9c2d0',borderRadius:6},
  primary:{background:'#2356d8',color:'#fff',border:0,borderRadius:6,padding:'10px 16px'},
  error:{background:'#ffe5e5',color:'#8b1111',padding:10,borderRadius:6},
  th:{textAlign:'left',borderBottom:'2px solid #dbe1ea',padding:8}, td:{borderBottom:'1px solid #e4e8ef',padding:8},
  pre:{whiteSpace:'pre-wrap',overflowWrap:'anywhere',background:'#111827',color:'#d1fae5',padding:12,borderRadius:8}
}
