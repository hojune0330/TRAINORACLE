import assert from 'node:assert/strict';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, isAbsolute } from 'node:path';
import { createServer } from 'node:net';
import { randomBytes, randomUUID } from 'node:crypto';

const execute = promisify(execFile);
export const literal = value => value == null ? 'NULL' : `'${String(value).replaceAll("'", "''")}'`;
export const databaseAllowed = name => /^trainoracle_concurrency_test_[a-f0-9]{16}$/.test(name);
export function validateTarget(target) {
  assert.equal(target.host, '127.0.0.1', 'Only numeric IPv4 loopback is allowed');
  assert.ok(Number.isInteger(target.port) && target.port >= 49152 && target.port <= 65535, 'Test port only');
  assert.ok(databaseAllowed(target.database), 'Generated test database allowlist only');
  assert.equal(target.user, 'trainoracle_test_admin');
}

// Deliberately do not inherit PG*, credentials, HOME, APPDATA, PATH or service files.
export function childEnvironment(bin, root) {
  return { SystemRoot: 'C:\\Windows', WINDIR: 'C:\\Windows', ComSpec: 'C:\\Windows\\System32\\cmd.exe',
    PATH: `${bin}${process.platform === 'win32' ? ';C:\\Windows\\System32' : ':/usr/bin:/bin'}`,
    TEMP: root, TMP: root, LC_ALL: 'C', PGPASSFILE: join(root, 'absent.pgpass'),
    PGSERVICEFILE: join(root, 'absent.pg_service.conf'), PGAPPNAME: 'trainoracle-concurrency-test' };
}

export class Session {
  constructor(binary, args, env) {
    this.pending = null;
    this.buffer = '';
    this.closed = false;
    this.child = spawn(binary, args, { env, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    this.exited = new Promise(resolveExit => {
      this.child.on('error', error => { this.fail(error); resolveExit(); });
      this.child.on('exit', code => {
        this.closed = true;
        this.fail(new Error(`psql exited (${code})`));
        resolveExit();
      });
    });
    this.child.stderr.on('data', () => {
      // SQL includes signed synthetic requests; never echo statements on errors.
      // ON_ERROR_STOP makes unexpected SQL errors terminate the session.
    });
    this.child.stdout.setEncoding('utf8');
    this.child.stdout.on('data', chunk => {
      this.buffer += chunk;
      let newline;
      while ((newline = this.buffer.indexOf('\n')) >= 0) {
        const line = this.buffer.slice(0, newline).replace(/\r$/, '');
        this.buffer = this.buffer.slice(newline + 1);
        if (!this.pending) continue;
        if (line === this.pending.marker) {
          const pending = this.pending;
          this.pending = null;
          clearTimeout(pending.timer);
          pending.resolve(pending.lines);
        } else if (line) this.pending.lines.push(line);
      }
    });
  }
  fail(error) {
    if (!this.pending) return;
    clearTimeout(this.pending.timer);
    this.pending.reject(error);
    this.pending = null;
  }
  query(sql) {
    assert.ok(!this.closed, 'Session is closed');
    assert.equal(this.pending, null, 'One in-flight query per independent connection');
    return new Promise((resolveQuery, reject) => {
      const marker = `END_${randomUUID()}`;
      this.pending = { marker, lines: [], resolve: resolveQuery, reject,
        timer: setTimeout(() => { this.fail(new Error('psql query deadline exceeded')); this.child.kill(); }, 20000) };
      this.child.stdin.write(`${sql}\n\\echo ${marker}\n`);
    });
  }
  async value(expression) {
    const lines = await this.query(`select coalesce(to_jsonb((${expression})), 'null'::jsonb)::text;`);
    assert.equal(lines.length, 1, 'Exactly one JSON result expected');
    return JSON.parse(lines[0]);
  }
  async close() {
    if (!this.closed) {
      if (this.pending) this.child.kill();
      else this.child.stdin.end('\\q\n');
    }
    await this.exited;
  }
}

async function unusedPort() {
  for (let attempt = 0; attempt < 30; attempt++) {
    const port = 49152 + randomBytes(2).readUInt16BE() % 16384;
    const server = createServer();
    try {
      await new Promise((res, rej) => { server.once('error', rej); server.listen(port, '127.0.0.1', res); });
      await new Promise(res => server.close(res));
      return port;
    } catch { server.close(); }
  }
  throw new Error('No unused loopback test port');
}

export async function startCluster(binDirectory, report = console.log) {
  assert.ok(isAbsolute(binDirectory), '--pg-bin must be an absolute local binary directory');
  assert.ok(!binDirectory.startsWith('\\\\') && !binDirectory.startsWith('//'), 'UNC binaries are disallowed');
  const bin = await realpath(binDirectory);
  const executable = name => join(bin, `${name}${process.platform === 'win32' ? '.exe' : ''}`);
  const root = await mkdtemp(join(tmpdir(), 'trainoracle-pg-concurrency-'));
  const data = join(root, 'data');
  const env = childEnvironment(bin, root);
  const target = { host: '127.0.0.1', port: await unusedPort(),
    database: `trainoracle_concurrency_test_${randomBytes(8).toString('hex')}`, user: 'trainoracle_test_admin' };
  validateTarget(target);
  const sessions = [];
  let started = false;
  let startAttempted = false;
  const control = args => new Promise((resolveControl, reject) => {
    // Windows postgres can retain inherited pipe handles after pg_ctl exits.
    // Ignore control-process stdio and wait for exit, not inherited-pipe close.
    const child = spawn(executable('pg_ctl'), args, { env, windowsHide: true, stdio: 'ignore' });
    const timer = setTimeout(() => { child.kill(); reject(new Error('pg_ctl deadline exceeded')); }, 40000);
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', code => {
      clearTimeout(timer);
      if (code === 0) resolveControl();
      else reject(Object.assign(new Error(`pg_ctl exited (${code})`), { code }));
    });
  });
  const command = async (name, args) => {
    if (name === 'pg_ctl') return control(args);
    try { return await execute(executable(name), args, { env, windowsHide: true, timeout: 60000, maxBuffer: 4 * 1024 * 1024 }); }
    catch (error) {
      // Provisioning commands have only generated paths/options, never SQL or credentials.
      throw new Error(`${name} failed (${error.code ?? 'unknown'}): ${String(error.stderr ?? '').slice(0, 2000)}; synthetic cluster retained at ${root}`);
    }
  };
  const connect = (database = target.database) => {
    // The sole exception is initial provisioning of our verified NEW cluster.
    assert.ok(database === 'postgres' || databaseAllowed(database));
    const session = new Session(executable('psql'), ['-X', '-w', '-q', '-A', '-t',
      '-v', 'ON_ERROR_STOP=1', '-h', target.host, '-p', String(target.port), '-U', target.user, '-d', database], env);
    sessions.push(session);
    return session;
  };
  const stop = async () => {
    await Promise.all(sessions.map(session => session.close()));
    if (startAttempted) {
      let running = started;
      if (!running) {
        try {
          await control(['-D', data, 'status']);
          running = true;
        } catch (error) { if (error.code !== 3) throw error; }
      }
      if (running) await command('pg_ctl', ['-D', data, '-m', 'fast', '-w', '-t', '30', 'stop']);
      started = false;
      startAttempted = false;
      report(`STOPPED local PostgreSQL; synthetic files retained: ${root}`);
    }
  };
  try {
    report(`Synthetic cluster (no deletion): ${root}`);
    await command('initdb', ['-D', data, '-U', target.user, '-A', 'trust', '--encoding=UTF8', '--locale=C', '--no-instructions', '--no-clean']);
    startAttempted = true;
    await command('pg_ctl', ['-D', data, '-l', join(root, 'server.log'), '-w', '-t', '30',
      '-o', `-h 127.0.0.1 -p ${target.port} -c unix_socket_directories= -c log_statement=none -c log_min_error_statement=panic -c logging_collector=off`, 'start']);
    started = true;
    const admin = connect('postgres');
    const identity = await admin.value(`jsonb_build_object('data',current_setting('data_directory'),
      'host',host(inet_server_addr()),'port',inet_server_port(),'user',current_user,'version',version())`);
    assert.equal(resolve(identity.data).toLowerCase(), resolve(data).toLowerCase(), 'Must own fresh cluster');
    assert.equal(identity.host, target.host);
    assert.equal(identity.port, target.port);
    assert.equal(identity.user, target.user);
    await admin.query(`create database ${target.database};`);
    await admin.close();
    report(`${identity.version}; ${target.host}:${target.port}/${target.database}`);
    return { root, target, connect: () => connect(), stop };
  } catch (error) {
    await stop();
    throw error;
  }
}
