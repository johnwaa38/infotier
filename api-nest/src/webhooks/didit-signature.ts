import { createHmac, timingSafeEqual } from 'crypto';

export type DiditSignatureHeaders = {
  signatureV2?: string;
  signatureRaw?: string;
  signatureSimple?: string;
  timestamp?: string;
};

export function verifyDiditWebhook(
  raw: Buffer | undefined,
  headers: DiditSignatureHeaders,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): Record<string, any> {
  if (!raw || !headers.timestamp || !fresh(headers.timestamp, nowSeconds)) {
    throw new Error('Invalid webhook timestamp');
  }

  // Try the raw-byte signature before parsing attacker-controlled JSON.
  const rawValid = Boolean(headers.signatureRaw && matches(
    headers.signatureRaw,
    createHmac('sha256', secret).update(raw).digest('hex'),
  ));

  let body: Record<string, any>;
  try {
    body = JSON.parse(raw.toString('utf8'));
  } catch {
    throw new Error('Invalid JSON body');
  }

  // V2 and simple signatures require fields from the parsed payload. Parsing is
  // not trust: the payload is returned only after a signature matches.
  const v2Valid = Boolean(headers.signatureV2 && matches(
    headers.signatureV2,
    createHmac('sha256', secret).update(JSON.stringify(sortKeys(body)), 'utf8').digest('hex'),
  ));
  const simplePayload = [headers.timestamp, body.session_id ?? '', body.status ?? '', body.webhook_type ?? ''].join(':');
  const simpleValid = Boolean(headers.signatureSimple && matches(
    headers.signatureSimple,
    createHmac('sha256', secret).update(simplePayload).digest('hex'),
  ));

  if (!rawValid && !v2Valid && !simpleValid) throw new Error('Invalid webhook signature');
  return body;
}

function fresh(timestamp: string, nowSeconds: number) {
  const value = Number(timestamp);
  return Number.isFinite(value) && Math.abs(nowSeconds - value) <= 300;
}

function matches(signature: string, expected: string) {
  const supplied = Buffer.from(signature.trim().toLowerCase(), 'utf8');
  const calculated = Buffer.from(expected, 'utf8');
  return supplied.length === calculated.length && timingSafeEqual(supplied, calculated);
}

export function sortKeys(value: any): any {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((out, key) => ({ ...out, [key]: sortKeys(value[key]) }), {});
  }
  return value;
}
