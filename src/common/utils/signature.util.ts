import * as crypto from 'crypto';

const SECRET_KEY = 'key-@@@@)))()((9))-xxxx&&&%%%%%';

interface SignatureResult {
  signature: string;
  timestamp: number;
}

export const generateSignature = (
  params: Record<string, string>,
  content: string,
): SignatureResult => {
  const required = ['timestamp', 'requestId', 'user_id'];
  for (const key of required) {
    if (!params[key]) {
      throw new Error(`Missing required parameter: ${key}`);
    }
  }

  const requestTime = parseInt(params['timestamp'], 10);
  if (isNaN(requestTime)) {
    throw new Error('Invalid timestamp');
  }

  // Calculate signature expire time (5-minute window)
  const signatureExpire = Math.floor(requestTime / (5 * 60 * 1000));

  // Level 1 signature
  const plaintext1 = signatureExpire.toString();
  const signature1 = hmacSHA256(SECRET_KEY, plaintext1);

  // Level 2 signature
  const contentB64 = Buffer.from(content).toString('base64');

  const keys = Object.keys(params).sort();
  const paramsStr = keys.map((k) => `${k},${params[k]}`).join(',');

  const plaintext2 = `${paramsStr}|${contentB64}|${requestTime}`;
  const signature2 = hmacSHA256(signature1, plaintext2);

  return {
    signature: signature2,
    timestamp: requestTime,
  };
};

const hmacSHA256 = (key: string, message: string): string => {
  return crypto
    .createHmac('sha256', Buffer.from(key))
    .update(message)
    .digest('hex');
};
