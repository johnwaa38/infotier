import express from 'express'
import bodyParser from 'body-parser'
import crypto from 'crypto'

const app = express()
app.use(bodyParser.json({ type: '*/*' }))

const SECRET = process.env.WEBHOOK_SECRET || 'please-change-this-to-a-long-random-string'

function safeTimingEqual(a, b){
  const bufA = Buffer.from(a || '', 'utf8')
  const bufB = Buffer.from(b || '', 'utf8')
  const len = Math.max(bufA.length, bufB.length)
  const padA = Buffer.concat([bufA, Buffer.alloc(Math.max(0, len - bufA.length))])
  const padB = Buffer.concat([bufB, Buffer.alloc(Math.max(0, len - bufB.length))])
  return crypto.timingSafeEqual(padA, padB)
}

app.post('/webhook', (req, res) => {
  const signature = req.get('X-Infotier-Signature') || ''
  const body = JSON.stringify(req.body || {})
  const expected = 'sha256=' + crypto.createHmac('sha256', SECRET).update(body).digest('hex')
  const ok = safeTimingEqual(signature, expected)
  if(!ok){ return res.status(401).json({ ok:false, error:'invalid_signature' }) }
  console.log('Webhook OK:', req.body)
  res.json({ ok:true })
})

const port = process.env.PORT || 4000
app.listen(port, () => console.log(`Receiver on http://localhost:${port}/webhook`))
