import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createSupabaseRepository, projectRecord, sourcePermission } from './service.mjs';
import { parseProviderDataLineage } from './contracts.mjs';
import { importJournalKeyring } from '../../supabase/functions/_shared/account-journal-handler.mjs';

/** Owner-operated review only. No provider/source is guessed from a filename,
 * file format, device label, EXPLICIT field marker or transport platform. */
export async function registerReviewedSource({ repository, token, review, allowedFormats = [], apply = false }) {
  const expected = ['version','documentId','revision','lineage','evidenceReference','reviewedAt','confirmed','analysisEligible'];
  if (!review || Object.keys(review).length !== expected.length || expected.some(key => !Object.hasOwn(review,key))
    || review.version !== 'COACHING_SOURCE_REVIEW_V1' || review.confirmed !== true || review.analysisEligible !== true
    || !Number.isSafeInteger(review.revision) || review.revision < 1
    || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u.test(review.documentId ?? '')
    || !/^[A-Za-z0-9._:/-]{12,200}$/u.test(review.evidenceReference ?? '')
    || !Number.isFinite(Date.parse(review.reviewedAt)) || Date.parse(review.reviewedAt)>Date.now()
    || !parseProviderDataLineage(review.lineage)) throw new Error('SOURCE_REVIEW_INVALID');
  const auth = await repository.authenticate(token);
  const source = await repository.call(auth,{action:'intakeSource',documentId:review.documentId,revision:review.revision});
  const document = await repository.decode(auth,source);
  const projected = projectRecord({...source,lineage:review.lineage,confirmed:true,analysisEligible:true},document,allowedFormats);
  if (sourcePermission(projected.lineage,[],Date.now(),projected.requiredFields)==='SOURCE_REVIEW_REQUIRED') throw new Error('SOURCE_REVIEW_INVALID');
  if (!apply) return {validated:true,applied:false};
  const registered = await repository.call(auth,{action:'registerSource',documentId:review.documentId,revision:review.revision,
    date:projected.date,lineage:review.lineage,evidenceReference:review.evidenceReference,reviewedAt:review.reviewedAt,confirmed:true,analysisEligible:true});
  if (registered?.registered!==true || registered.revision!==review.revision) throw new Error('SOURCE_REGISTRATION_FAILED');
  return {validated:true,applied:true};
}

if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  try {
    const args=process.argv.slice(2);
    if (!args[0] || args.length>2 || (args[1] && args[1]!=='--apply')) throw new Error('INVALID_ARGUMENTS');
    const raw=await readFile(args[0]); if(raw.byteLength>16000)throw new Error('INVALID_REVIEW');
    const repository=createSupabaseRepository({url:process.env.SUPABASE_URL,publishableKey:process.env.SUPABASE_ANON_KEY,
      attestation:JSON.parse(process.env.TRAINORACLE_COACHING_INTAKE_ATTESTATION_JSON),
      keyring:await importJournalKeyring(process.env.TRAINORACLE_JOURNAL_KEYRING_JSON)});
    const result=await registerReviewedSource({repository,token:process.env.TRAINORACLE_COACHING_SUBJECT_TOKEN,
      review:JSON.parse(raw.toString('utf8')),apply:args[1]==='--apply',
      allowedFormats:(process.env.TRAINORACLE_COACHING_FILE_FORMATS??'').split(',').filter(s=>['tcx','csv','json','gpx'].includes(s))});
    process.stdout.write(result.applied?'SOURCE_REGISTERED\n':'SOURCE_REVIEW_VALID_DRY_RUN\n');
  } catch { process.stderr.write('SOURCE_REVIEW_FAILED\n');process.exitCode=1; }
}
