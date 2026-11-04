// Issued Garmin Starter PUSH delivery ranges reviewed 2026-11-04. Kept pure so
// the edge and Node verifier use exactly the same allowlist and IPv4 predicate.
export const GARMIN_DELIVERY_CIDRS=Object.freeze(['204.77.162.0/23','204.77.163.0/24','98.199.124.0/23','185.132.79.0/24','208.65.206.0/23','185.207.94.0/23','198.233.176.0/24']);
function ipNumber(address){const value=address?.replace(/^::ffff:/,'');if(typeof value!=='string'||!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(value))return null;const p=value.split('.').map(Number);if(p.some(n=>n>255))return null;return p.reduce((n,v)=>(n*256+v)>>>0,0);}
export function inCidrs(address,cidrs=GARMIN_DELIVERY_CIDRS){const n=ipNumber(address);if(n===null)return false;return cidrs.some(cidr=>{const [ip,bits]=cidr.split('/');const base=ipNumber(ip),size=Number(bits);if(base===null||!Number.isInteger(size)||size<0||size>32)return false;const mask=size===0?0:(0xffffffff<<(32-size))>>>0;return (n&mask)===(base&mask);});}
