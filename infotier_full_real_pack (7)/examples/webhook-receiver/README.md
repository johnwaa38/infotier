# Sample Webhook Receiver

Verifies `X-Infotier-Signature` (HMAC SHA256 over JSON body).

Run:
```
cd examples/webhook-receiver
npm install
WEBHOOK_SECRET=please-change-this-to-a-long-random-string npm start
```
