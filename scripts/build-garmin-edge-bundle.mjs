import {readFile,writeFile,mkdir,realpath} from 'node:fs/promises';
import {resolve,relative,dirname,extname,isAbsolute} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';

const repositoryRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(new URL('../app/package.json',import.meta.url));
const ts=require('typescript');
const digest=value=>createHash('sha256').update(value).digest('hex');
const within=(root,path)=>{const value=relative(root,path);return value&&!value.startsWith('..')&&!isAbsolute(value);};
const externalModules=new Set(['node:buffer','node:crypto','node:http','node:process','node:url']);

/** Source-only upload manifest. No env values, filesystem globbing, node_modules,
 * tests or operational artifacts can enter this graph. Names stay repo-relative
 * so the existing ../ imports work unchanged in the hosted Deno bundler. */
export async function buildGarminEdgeBundle({root=repositoryRoot,entrypoint='supabase/functions/garmin-integration/index.ts'}={}){
  root=await realpath(root);const found=new Map(),external=new Set();
  async function visit(candidate){
    const path=await realpath(candidate);if(!within(root,path))throw new Error('EDGE_BUNDLE_OUTSIDE_REPOSITORY');
    const name=relative(root,path).replaceAll('\\','/');
    if(!/^(?:server\/(?:garmin-integration|garmin-ingress)\/|supabase\/functions\/)/.test(name)
      ||/(?:^|\/)(?:node_modules|tmp|\.git)(?:\/|$)/.test(name)
      ||!['.mjs','.js','.ts'].includes(extname(name))||/\.(?:test|spec)\.[cm]?[jt]s$/.test(name))throw new Error('EDGE_BUNDLE_UNEXPECTED_SOURCE');
    if(found.has(name))return;
    const content=await readFile(path,'utf8');found.set(name,content);
    const source=ts.createSourceFile(name,content,ts.ScriptTarget.Latest,true,extname(name)==='.ts'?ts.ScriptKind.TS:ts.ScriptKind.JS);
    const imports=[];
    function walk(node){
      if((ts.isImportDeclaration(node)||ts.isExportDeclaration(node))&&node.moduleSpecifier){
        if(!ts.isStringLiteralLike(node.moduleSpecifier))throw new Error('EDGE_BUNDLE_NONLITERAL_IMPORT');
        imports.push(node.moduleSpecifier.text);
      }
      if(ts.isCallExpression(node)&&node.expression.kind===ts.SyntaxKind.ImportKeyword){
        if(node.arguments.length!==1||!ts.isStringLiteralLike(node.arguments[0]))throw new Error('EDGE_BUNDLE_NONLITERAL_IMPORT');
        imports.push(node.arguments[0].text);
      }
      ts.forEachChild(node,walk);
    }
    walk(source);
    for(const specifier of imports){
      if(specifier.startsWith('.'))await visit(resolve(dirname(path),specifier));
      else if(externalModules.has(specifier))external.add(specifier);
      else throw new Error('EDGE_BUNDLE_UNPINNED_EXTERNAL_IMPORT');
    }
  }
  await visit(resolve(root,entrypoint));
  const files=[...found].sort(([a],[b])=>a.localeCompare(b,'en')).map(([name,content])=>({name,content}));
  files.push({name:'deno.json',content:JSON.stringify({compilerOptions:{lib:['deno.window','dom','dom.iterable','esnext']}},null,2)+'\n'});
  const payload={project_id:'texspxlpjungyarkvtkc',name:'garmin-integration',entrypoint_path:entrypoint,verify_jwt:true,files};
  const manifest={entrypoint,files:files.map(({name,content})=>({name,bytes:Buffer.byteLength(content),sha256:digest(content)})),external:[...external].sort(),sourceBytes:files.reduce((sum,file)=>sum+Buffer.byteLength(file.content),0)};
  return {payload,manifest};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    if(process.argv.length>3)throw new Error('EDGE_BUNDLE_ARGUMENTS_INVALID');
    const output=resolve(repositoryRoot,process.argv[2]??'tmp/garmin-edge-deploy.json');
    const allowed=resolve(repositoryRoot,'tmp');if(!within(allowed,output)||extname(output)!=='.json')throw new Error('EDGE_BUNDLE_OUTPUT_MUST_BE_TMP_JSON');
    const {payload,manifest}=await buildGarminEdgeBundle();
    await mkdir(dirname(output),{recursive:true});
    const encoded=JSON.stringify(payload);await writeFile(output,encoded);await writeFile(output.replace(/\.json$/,'.manifest.json'),JSON.stringify(manifest,null,2)+'\n');
    process.stdout.write(JSON.stringify({output:relative(repositoryRoot,output).replaceAll('\\','/'),files:payload.files.length,sourceBytes:manifest.sourceBytes,payloadBytes:Buffer.byteLength(encoded),sha256:digest(encoded),external:manifest.external})+'\n');
  }catch(error){process.stderr.write(`${error.message}\n`);process.exitCode=1;}
}
