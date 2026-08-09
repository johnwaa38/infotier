import React, { useEffect, useState } from 'react'
import axios from 'axios'

export default function App(){
  const [items, setItems] = useState([])
  const [selected, setSelected] = useState(null)
  const [logs, setLogs] = useState([])
  const base = import.meta.env.VITE_API_BASE || 'http://localhost:3000/v1'
  async function refresh(){ const r = await axios.get(`${base}/verifications`); setItems(r.data) }
  async function openItem(id){ const r = await axios.get(`${base}/verifications/${id}`); setSelected(r.data); const lr = await axios.get(`${base}/verifications/${id}/logs`); setLogs(lr.data) }
  useEffect(()=>{ refresh(); const t=setInterval(refresh,4000); return ()=>clearInterval(t) },[])
  return (<div style={{ padding:20, fontFamily:'ui-sans-serif, system-ui' }}>
    <h1>Infotier — Verifications</h1>
    <p>Auto-refreshing every 4s</p>
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
      <div>
        <table border="1" cellPadding="6" width="100%">
          <thead><tr><th>ID</th><th>Status</th><th>Score</th><th>Created</th></tr></thead>
          <tbody>
            {items.map(r => (<tr key={r.id} style={{cursor:'pointer'}} onClick={()=>openItem(r.id)}>
              <td>{r.id.slice(0,12)}…</td><td>{r.status}</td><td>{r.score?.toFixed?.(2) ?? '-'}</td><td>{new Date(r.createdAt).toLocaleString()}</td>
            </tr>))}
          </tbody>
        </table>
      </div>
      <div>
        {!selected ? <em>Select a row</em> : (<>
          <div style={{ display:'flex', gap:8, marginBottom:10 }}>
            <button onClick={async ()=>{ await axios.post(`${base}/verifications/${selected.id}/decision`, { action:'approved' }); openItem(selected.id) }}>Approve</button>
            <button onClick={async ()=>{ await axios.post(`${base}/verifications/${selected.id}/decision`, { action:'rejected' }); openItem(selected.id) }}>Reject</button>
          </div>
          <pre style={{ whiteSpace:'pre-wrap', background:'#111', color:'#0f0', padding:12, borderRadius:8 }}>{JSON.stringify(selected,null,2)}</pre>
          <h3>Audit Logs</h3>
          <ul>{logs.map(l => (<li key={l.id}>{new Date(l.createdAt).toLocaleString()} — {l.action} by {l.actor}</li>))}</ul>
        </>)}
      </div>
    </div>
  </div>)
}
