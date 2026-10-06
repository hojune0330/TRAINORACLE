/** Explicitly keep account access closed on the already-retired shared Pages origin. */
export function publishedModuleNames(indexHtml) {
  const names = [...indexHtml.matchAll(/<script\b[^>]*\bsrc=["'](?:\.\/|\/)?assets\/([A-Za-z0-9_-]+\.js)["'][^>]*>/giu)]
    .map(match => match[1]);
  if (!names.length) throw Error('PUBLISHED_ENTRY_SCRIPT_MISSING');
  return [...new Set(names)];
}

export function holdSharedOriginAccount(configuration) {
  const result = { ...configuration, VITE_ACCOUNT_PUBLIC_ENABLED: 'false', VITE_KILL_ACCOUNT: 'true' };
  for (const feature of ['ACCOUNT_JOURNAL', 'SYNC', 'SHARING', 'PLAN_PROPOSALS', 'PLAN_BACKUP',
    'PUBLIC_PROFILE', 'PRODUCT_ANALYTICS', 'FILE_ANALYSIS_TCX', 'FILE_ANALYSIS_CSV',
    'FILE_ANALYSIS_JSON', 'FILE_ANALYSIS_GPX']) result[`VITE_FEATURE_${feature}`] = 'false';
  for (const provider of ['KAKAO', 'GOOGLE', 'EMAIL', 'PHONE']) result[`VITE_${provider}_AUTH_ENABLED`] = 'false';
  return result;
}

export function canonicalOracleEnabled(configuration, option) {
  if (option && !['--oracle-v2=enabled', '--oracle-v2=disabled'].includes(option)) {
    throw Error('INVALID_ORACLE_ROLLOUT_OPTION');
  }
  const accountOpen = configuration.VITE_ACCOUNT_PUBLIC_ENABLED === 'true'
    && configuration.VITE_KILL_ACCOUNT !== 'true';
  const requested = option === '--oracle-v2=enabled' || (option === undefined && !accountOpen);
  return requested && configuration.VITE_KILL_ORACLE_V2 !== 'true';
}
