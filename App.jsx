import React, { useEffect, useMemo, useState } from 'react'
import { initializeApp } from 'firebase/app'
import { getDatabase, ref, push, onChildAdded, onValue, remove, serverTimestamp, set } from 'firebase/database'
import { FIREBASE_CONFIG } from './firebaseConfig'

const app = initializeApp(FIREBASE_CONFIG)
const db = getDatabase(app)

const DEFAULT_EMOJIS = ["😍","😊","😂","😮","😕","😢","😒","😠"]

function useQuery() { return new URLSearchParams(window.location.search) }
function randomBetween(min, max) { return Math.random() * (max - min) + min }

function FloatingEmoji({ emoji, onEnd }) {
  useEffect(() => {
    const duration = randomBetween(2500,4200)
    const t = setTimeout(onEnd, duration)
    return () => clearTimeout(t)
  }, [emoji,onEnd])
  return <div className="float" style={{animation:`floatUp 3s ease-out forwards`}}>{emoji}</div>
}

function useRoom(roomId) {
  const [counts, setCounts] = useState({})
  useEffect(() => {
    if (!roomId) return
    const countsRef = ref(db, `rooms/${roomId}/counts`)
    return onValue(countsRef, snap => setCounts(snap.val()||{}))
  }, [roomId])

  const sendReaction = (emoji) => {
    const eventsRef = ref(db, `rooms/${roomId}/events`)
    push(eventsRef, { emoji, ts: serverTimestamp() })
    const countRef = ref(db, `rooms/${roomId}/counts/${emoji}`)
    onValue(countRef, snap => { set(countRef,(snap.val()||0)+1) }, {onlyOnce:true})
  }
  const resetRoom = async () => {
    await remove(ref(db, `rooms/${roomId}/events`))
    await remove(ref(db, `rooms/${roomId}/counts`))
  }
  return { counts, sendReaction, resetRoom }
}

function HostView({ roomId, emojis }) {
  const { counts, resetRoom } = useRoom(roomId)
  const [floaters, setFloaters] = useState([])
  const [guestUrl, setGuestUrl] = useState('')
  useEffect(()=>{ const url=new URL(window.location.href); url.searchParams.set('mode','guest'); setGuestUrl(url.toString()) },[])
  useEffect(()=>{ if(!roomId)return; const eventsRef=ref(db,`rooms/${roomId}/events`); return onChildAdded(eventsRef,snap=>{const ev=snap.val(); if(ev?.emoji){const id=`${snap.key}-${Math.random()}`; setFloaters(arr=>[...arr,{id,emoji:ev.emoji}])}})},[roomId])
  return <div className="container">
    <div className="row"><div className="h1">Sala {roomId}</div>
      <div className="row"><button className="btn secondary" onClick={resetRoom}>Reset</button>
      <a className="btn" href={guestUrl} target="_blank">Link participante</a></div></div>
    <div className="panel"><div className="grid emojis">
      {emojis.map(e=><div key={e}><div className="emoji">{e}</div><div className="count">{counts?.[e]||0}</div></div>)}
    </div><div className="hint">Comparte el link guest. Tap = reacción inmediata.</div></div>
    {floaters.map(f=><FloatingEmoji key={f.id} emoji={f.emoji} onEnd={()=>setFloaters(arr=>arr.filter(x=>x.id!==f.id))}/>)}
  </div>
}

function GuestView({ roomId, emojis }) {
  const { sendReaction } = useRoom(roomId)
  const [cooldown,setCooldown]=useState(false)
  const tap=e=>{if(cooldown)return; sendReaction(e); setCooldown(true); setTimeout(()=>setCooldown(false),250)}
  return <div className="center"><div className="card"><div className="inner">
    <div className="title">Elige tus reacciones</div><div className="subtitle">Sala {roomId}</div>
    <div className="grid">{emojis.map(e=><button key={e} className="btn" onClick={()=>tap(e)} disabled={cooldown}>{e}</button>)}</div>
    <div className="subtitle">Tu toque se envía al instante.</div></div></div></div>
}

export default function App() {
  const q=useQuery(); const mode=q.get('mode')||'host'; const roomId=q.get('room')||'demo'
  const emojis=(()=>{const raw=q.get('emojis'); if(!raw)return DEFAULT_EMOJIS; try{return decodeURIComponent(raw).split(',').map(s=>s.trim()).filter(Boolean).slice(0,8)}catch{return DEFAULT_EMOJIS}})()
  if(mode==='guest')return <GuestView roomId={roomId} emojis={emojis}/>; return <HostView roomId={roomId} emojis={emojis}/>
}
