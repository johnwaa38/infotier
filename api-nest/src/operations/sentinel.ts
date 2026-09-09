export type SentinelInput = {
  database: 'connected' | 'unavailable';
  diditConfigured: boolean;
  adminPasswordConfigured: boolean;
  jwtSecretConfigured: boolean;
  ephemeralEvidenceStorage: boolean;
};

export type SentinelIssue = { severity: 'critical' | 'warning'; code: string; message: string };

export function evaluateSentinel(input: SentinelInput) {
  const issues: SentinelIssue[] = [];
  if (input.database !== 'connected') issues.push({ severity: 'critical', code: 'database_unavailable', message: 'Neon database probe failed.' });
  if (!input.diditConfigured) issues.push({ severity: 'critical', code: 'didit_incomplete', message: 'Didit credentials or webhook secret are missing.' });
  if (!input.adminPasswordConfigured) issues.push({ severity: 'critical', code: 'admin_password_missing', message: 'Administrator password is not configured.' });
  if (!input.jwtSecretConfigured) issues.push({ severity: 'critical', code: 'jwt_secret_weak', message: 'JWT secret is missing or shorter than 32 characters.' });
  if (input.ephemeralEvidenceStorage) issues.push({ severity: 'warning', code: 'ephemeral_evidence', message: 'Local evidence storage is ephemeral and suitable only for the demo path.' });
  return {
    state: issues.some(issue => issue.severity === 'critical') ? 'action_required' : issues.length ? 'degraded' : 'healthy',
    mode: 'rule-based',
    issues,
  } as const;
}
