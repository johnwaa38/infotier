import React, { useEffect, useMemo, useState } from 'react'
import axios from 'axios'

const base = import.meta.env.VITE_API_BASE || 'http://localhost:3000/v1'

export default function App(){
  const adminMode = new URLSearchParams(location.search).has('admin')
  const customerMode = new URLSearchParams(location.search).has('customer')
  const signupMode = new URLSearchParams(location.search).has('signup')
  const completed = new URLSearchParams(location.search).get('verification') === 'complete'
  const [token, setToken] = useState(() => sessionStorage.getItem('infotier_token') || '')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [items, setItems] = useState([])
  const [selected, setSelected] = useState(null)
  const [logs, setLogs] = useState([])
  const [signupRequests, setSignupRequests] = useState([])
  const [inviteLink, setInviteLink] = useState('')
  const api = useMemo(() => axios.create({ baseURL: base, headers: token ? { Authorization: `Bearer ${token}` } : {} }), [token])

  if (customerMode) return <CustomerPortal/>
  if (signupMode) return <BetaSignup/>
  if (!adminMode) return <PublicVerification completed={completed}/>

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
    try { const [r,s] = await Promise.all([api.get('/verifications'),api.get('/signup-requests')]); setItems(r.data);setSignupRequests(s.data);setError('') }
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
  async function reviewSignup(id,action){
    try{
      const response=await api.post(`/signup-requests/${id}/${action}`)
      if(action==='approve')setInviteLink(response.data.portalInviteUrl)
      await refresh()
    }catch{setError(`Could not ${action} signup request`)}
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
        <h2>Beta signup requests</h2>
        {inviteLink&&<div style={styles.linkBox}><strong>Customer invite ready</strong><a href={inviteLink} target="_blank" rel="noreferrer">{inviteLink}</a><button onClick={()=>navigator.clipboard.writeText(inviteLink)}>Copy invite</button></div>}
        {signupRequests.length===0?<p>No signup requests yet.</p>:signupRequests.map(r=><div key={r.id} style={styles.requestRow}><div><strong>{r.businessName}</strong><br/><span>{r.contactName} — {r.email}</span><br/><small>{r.status}</small></div>{r.status==='pending'&&<div style={{display:'flex',gap:8}}><button style={styles.primary} onClick={()=>reviewSignup(r.id,'approve')}>Approve</button><button onClick={()=>reviewSignup(r.id,'decline')}>Decline</button></div>}</div>)}
      </section>
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

function BetaSignup(){
  const [form,setForm]=useState({businessName:'',contactName:'',email:''})
  const [submitted,setSubmitted]=useState(false)
  const [error,setError]=useState('')
  async function submit(e){
    e.preventDefault();setError('')
    try{await axios.post(`${base}/signup-requests`,form);setSubmitted(true)}
    catch{setError('Could not submit your request. Check each field and try again.')}
  }
  if(submitted)return <main style={styles.loginPage}><section style={styles.card}><h1>Request received</h1><p>Infotier will review your free beta request and provide a secure portal invitation.</p><a href="/">Return home</a></section></main>
  return <main style={styles.loginPage}><form onSubmit={submit} style={styles.card}><h1 style={{marginTop:0}}>Join the Infotier beta</h1><p>Request free early access. No card required.</p><label>Business name</label><input style={styles.input} required maxLength={100} value={form.businessName} onChange={e=>setForm({...form,businessName:e.target.value})}/><label>Your name</label><input style={styles.input} required maxLength={100} value={form.contactName} onChange={e=>setForm({...form,contactName:e.target.value})}/><label>Email</label><input style={styles.input} required type="email" maxLength={254} value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/><button style={styles.primary}>Request access</button>{error&&<p style={styles.error}>{error}</p>}</form></main>
}

function CustomerPortal(){
  const [key,setKey]=useState(()=>sessionStorage.getItem('infotier_customer_key')||'')
  const [portalToken,setPortalToken]=useState(()=>sessionStorage.getItem('infotier_customer_token')||'')
  const [usage,setUsage]=useState(null)
  const [error,setError]=useState('')
  const [creating,setCreating]=useState(false)
  const [verificationUrl,setVerificationUrl]=useState('')
  const authHeaders=()=>portalToken?{Authorization:`Bearer ${portalToken}`}:{'X-API-Key':key}
  async function load(event){
    event?.preventDefault(); setError('')
    try{
      const response=await axios.get(`${base}/customer/usage`,{headers:authHeaders()})
      sessionStorage.setItem('infotier_customer_key',key); setUsage(response.data)
    }catch{setError('That API key is invalid or revoked.');setUsage(null)}
  }
  function logout(){sessionStorage.removeItem('infotier_customer_key');sessionStorage.removeItem('infotier_customer_token');setKey('');setPortalToken('');setUsage(null)}
  async function createVerification(){
    setCreating(true);setError('');setVerificationUrl('')
    try{
      const response=await axios.post(`${base}/sessions`,{
        userReference:`customer-${crypto.randomUUID()}`,
        returnUrl:`${location.origin}/?verification=complete`
      },{headers:authHeaders()})
      setVerificationUrl(response.data.url)
      await load()
    }catch{setError('Could not create a verification link.')}
    finally{setCreating(false)}
  }
  useEffect(()=>{
    const login=new URLSearchParams(location.search).get('login')
    if(login){
      history.replaceState({},'',`${location.pathname}?customer=1`)
      axios.post(`${base}/customer/magic-login`,{token:login}).then(response=>{
        sessionStorage.setItem('infotier_customer_token',response.data.accessToken)
        setPortalToken(response.data.accessToken)
      }).catch(()=>setError('This login link is invalid or expired.'))
    }
  },[])
  useEffect(()=>{if(portalToken||key)load()},[portalToken])
  if(!usage)return <main style={styles.loginPage}><form onSubmit={load} style={styles.card}>
    <h1 style={{marginTop:0}}>Customer portal</h1><p>Enter your Infotier API key.</p>
    <input type="password" value={key} onChange={e=>setKey(e.target.value)} required style={styles.input}/>
    <button style={styles.primary}>View usage</button>{error&&<p style={styles.error}>{error}</p>}
  </form></main>
  const t=usage.totals
  return <main style={styles.page}><header style={styles.header}><div><h1 style={{margin:0}}>{usage.customer.name}</h1><small>Infotier customer portal</small></div><button onClick={logout}>Sign out</button></header>
    <section style={{...styles.card,marginBottom:20}}><h2 style={{marginTop:0}}>Verify someone</h2><p>Create a secure identity-check link and send it to the person being verified.</p><button onClick={createVerification} disabled={creating} style={styles.primary}>{creating?'Creating…':'Create verification link'}</button>
      {verificationUrl&&<div style={styles.linkBox}><strong>Link ready</strong><a href={verificationUrl} target="_blank" rel="noreferrer" style={{overflowWrap:'anywhere'}}>{verificationUrl}</a><button onClick={()=>navigator.clipboard.writeText(verificationUrl)}>Copy link</button></div>}
    </section>
    <div style={styles.metrics}>{[['All',t.all],['This month',t.thisMonth],['Completed',t.completed],['In progress',t.inProgress],['Failed',t.failed]].map(([label,value])=><section style={styles.metric} key={label}><strong>{value}</strong><span>{label}</span></section>)}</div>
    <section style={styles.card}><h2>Recent verifications</h2>{usage.recent.length===0?<p>No usage yet.</p>:<table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr><th style={styles.th}>Reference</th><th style={styles.th}>Status</th><th style={styles.th}>Provider</th><th style={styles.th}>Created</th></tr></thead><tbody>{usage.recent.map(r=><tr key={r.id}><td style={styles.td}>{r.userReference}</td><td style={styles.td}>{r.status}</td><td style={styles.td}>{r.provider||'-'}</td><td style={styles.td}>{new Date(r.createdAt).toLocaleString()}</td></tr>)}</tbody></table>}</section>
  </main>
}

function PublicVerification({completed}){
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  async function begin(e){
    e.preventDefault(); setBusy(true); setError('')
    try{
      const ref = crypto.randomUUID()
      const response = await axios.post(`${base}/sessions/public`,{
        userReference:ref,
        returnUrl:`${location.origin}/?verification=complete`
      })
      if(!response.data?.url) throw new Error('Missing verification URL')
      sessionStorage.setItem('infotier_verification_id',response.data.verificationId)
      location.assign(response.data.url)
    }catch{ setError('Verification could not start. Please try again.'); setBusy(false) }
  }
  return <main style={styles.publicPage}>
    <header style={styles.publicHeader}><strong style={{fontSize:24}}>Infotier</strong><div style={{display:'flex',gap:18}}><a href="/?signup=1" style={styles.adminLink}>Free beta</a><a href="/?customer=1" style={styles.adminLink}>Customer portal</a><a href="/?admin=1" style={styles.adminLink}>Administrator</a></div></header>
    <section style={styles.hero}>
      <div style={styles.eyebrow}>SECURE IDENTITY VERIFICATION</div>
      <h1 style={styles.heroTitle}>{completed?'Verification submitted':'Prove you are you.'}</h1>
      <p style={styles.heroText}>{completed?'Your result is processing. You may safely close this page.':'Verify an identity using government ID, face match, passive liveness, and device-risk checks.'}</p>
      {!completed&&<form onSubmit={begin} style={styles.verifyCard}>
        <button disabled={busy} style={styles.verifyButton}>{busy?'Opening secure check…':'Start free verification →'}</button>
        {error&&<p role="alert" style={styles.error}>{error}</p>}
        <small style={styles.privacy}>Infotier stores the verification result and audit trail—not your ID images. Document capture is securely hosted by Didit.</small>
      </form>}
      <div style={styles.trustRow}><span>✓ Encrypted</span><span>✓ Liveness checked</span><span>✓ No card required</span></div>
    </section>
  </main>
}

const styles = {
  publicPage:{minHeight:'100vh',background:'radial-gradient(circle at 80% 15%,#183d70 0,#07111f 42%,#03070d 100%)',color:'#f6fbff',fontFamily:'Inter,system-ui,sans-serif'},
  publicHeader:{maxWidth:1100,margin:'auto',padding:'24px 28px',display:'flex',justifyContent:'space-between',alignItems:'center'},
  adminLink:{color:'#9fb3c8',textDecoration:'none',fontSize:14},
  hero:{maxWidth:760,margin:'clamp(50px,10vh,120px) auto 0',padding:'0 28px 70px',textAlign:'center'},
  eyebrow:{color:'#53d4ff',fontWeight:800,letterSpacing:2,fontSize:13},
  heroTitle:{fontSize:'clamp(42px,8vw,76px)',lineHeight:1,margin:'20px 0',letterSpacing:-3},
  heroText:{color:'#b8c7d8',fontSize:'clamp(18px,2.3vw,23px)',lineHeight:1.5,maxWidth:680,margin:'0 auto 34px'},
  verifyCard:{background:'#ffffff',color:'#142033',padding:24,borderRadius:18,textAlign:'left',maxWidth:480,margin:'auto',boxShadow:'0 24px 80px #0008'},
  publicInput:{boxSizing:'border-box',width:'100%',fontSize:17,padding:'14px 15px',margin:'9px 0 12px',border:'1px solid #c8d2dd',borderRadius:9},
  verifyButton:{width:'100%',background:'#1677ff',color:'#fff',border:0,borderRadius:9,padding:'15px 18px',fontWeight:800,fontSize:16,cursor:'pointer'},
  privacy:{display:'block',color:'#647387',lineHeight:1.45,marginTop:14},
  trustRow:{display:'flex',justifyContent:'center',gap:22,flexWrap:'wrap',color:'#8fa4bb',fontSize:14,marginTop:28},
  loginPage:{minHeight:'100vh',display:'grid',placeItems:'center',background:'#0b1020',fontFamily:'system-ui',color:'#e8eefc'},
  page:{minHeight:'100vh',padding:24,background:'#f4f6fa',fontFamily:'system-ui',color:'#172033'},
  header:{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20},
  grid:{display:'grid',gridTemplateColumns:'minmax(0,1.2fr) minmax(0,1fr)',gap:20},
  metrics:{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:14,marginBottom:20},
  metric:{background:'#fff',padding:20,borderRadius:12,boxShadow:'0 8px 30px #0001',display:'flex',flexDirection:'column',gap:4},
  card:{background:'#fff',color:'#172033',padding:24,borderRadius:12,boxShadow:'0 8px 30px #0001',minWidth:300},
  input:{display:'block',boxSizing:'border-box',width:'100%',padding:10,margin:'8px 0 14px',border:'1px solid #b9c2d0',borderRadius:6},
  primary:{background:'#2356d8',color:'#fff',border:0,borderRadius:6,padding:'10px 16px'},
  error:{background:'#ffe5e5',color:'#8b1111',padding:10,borderRadius:6},
  linkBox:{display:'grid',gap:10,marginTop:16,padding:14,background:'#eef6ff',border:'1px solid #b9d7ff',borderRadius:8},
  requestRow:{display:'flex',justifyContent:'space-between',gap:16,alignItems:'center',padding:'14px 0',borderBottom:'1px solid #e4e8ef'},
  th:{textAlign:'left',borderBottom:'2px solid #dbe1ea',padding:8}, td:{borderBottom:'1px solid #e4e8ef',padding:8},
  pre:{whiteSpace:'pre-wrap',overflowWrap:'anywhere',background:'#111827',color:'#d1fae5',padding:12,borderRadius:8}
}
