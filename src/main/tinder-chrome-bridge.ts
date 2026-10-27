import { createServer, type ServerResponse } from "node:http";
import { randomBytes } from "node:crypto";
import { once } from "node:events";

export interface TinderChromeSession {
  apiToken: string;
  deviceId: string;
  mfaRecord: Record<string, unknown> | string | null;
}

export const tinderSessionPresentScript = `(async()=>{try{if(localStorage.getItem('TinderWeb/APIToken'))return true;if(typeof indexedDB.databases!=='function')return true;const info=(await indexedDB.databases()).find(x=>x.name==='keyval-store');if(!info)return false;const db=await new Promise((resolve,reject)=>{const request=indexedDB.open('keyval-store',info.version);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});let record=null;if(db.objectStoreNames.contains('keyval'))record=await new Promise((resolve,reject)=>{const request=db.transaction('keyval','readonly').objectStore('keyval').get('persist::mfa');request.onsuccess=()=>resolve(request.result??null);request.onerror=()=>reject(request.error)});db.close();return record!==null&&record!==undefined}catch{return true}})()`;

export function tinderInstallScript(imported: TinderChromeSession) {
  const payload = JSON.stringify(JSON.stringify(imported));
  return `(async()=>{const incoming=JSON.parse(${payload});let db;let oldDeviceId=null;let tokenWritten=false;let deviceWritten=false;const openDatabase=version=>new Promise((resolve,reject)=>{const request=version?indexedDB.open('keyval-store',version):indexedDB.open('keyval-store');request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('keyval'))request.result.createObjectStore('keyval')};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);request.onblocked=()=>reject(new Error('blocked'))});const readRecord=()=>new Promise((resolve,reject)=>{const transaction=db.transaction('keyval','readonly');const request=transaction.objectStore('keyval').get('persist::mfa');request.onsuccess=()=>resolve(request.result??null);request.onerror=()=>reject(request.error)});const rollback=async()=>{try{if(deviceWritten&&localStorage.getItem('TinderWeb/uuid')===incoming.deviceId){if(oldDeviceId===null)localStorage.removeItem('TinderWeb/uuid');else localStorage.setItem('TinderWeb/uuid',oldDeviceId)}if(tokenWritten&&localStorage.getItem('TinderWeb/APIToken')===incoming.apiToken)localStorage.removeItem('TinderWeb/APIToken');if(incoming.mfaRecord!==null&&db?.objectStoreNames.contains('keyval'))await new Promise(resolve=>{const transaction=db.transaction('keyval','readwrite');const store=transaction.objectStore('keyval');const request=store.get('persist::mfa');request.onsuccess=()=>{const value=request.result;const token=typeof value==='string'?(()=>{try{return JSON.parse(value).authToken}catch{return null}})():value&&typeof value==='object'?value.authToken:null;if(token===incoming.apiToken)store.delete('persist::mfa')};transaction.oncomplete=()=>resolve(undefined);transaction.onerror=()=>resolve(undefined);transaction.onabort=()=>resolve(undefined)})}catch{}};try{if(localStorage.getItem('TinderWeb/APIToken'))return {ok:false,reason:'occupied'};oldDeviceId=localStorage.getItem('TinderWeb/uuid');db=await openDatabase();if(!db.objectStoreNames.contains('keyval')){const version=db.version+1;db.close();db=await openDatabase(version)}if(await readRecord()!==null)return {ok:false,reason:'occupied'};localStorage.setItem('TinderWeb/APIToken',incoming.apiToken);tokenWritten=true;localStorage.setItem('TinderWeb/uuid',incoming.deviceId);deviceWritten=true;if(incoming.mfaRecord!==null)await new Promise((resolve,reject)=>{const transaction=db.transaction('keyval','readwrite');transaction.objectStore('keyval').put(incoming.mfaRecord,'persist::mfa');transaction.oncomplete=()=>resolve(undefined);transaction.onerror=()=>reject(transaction.error);transaction.onabort=()=>reject(transaction.error||new Error('aborted'))});return {ok:true,oldDeviceId}}catch{await rollback();return {ok:false,reason:'write-failed'}}finally{db?.close()}})()`;
}

export function tinderRollbackScript(
  imported: TinderChromeSession,
  oldDeviceId: string | null,
) {
  const payload = JSON.stringify(JSON.stringify(imported));
  const priorDevice = JSON.stringify(oldDeviceId);
  return `(async()=>{const incoming=JSON.parse(${payload});const oldDeviceId=JSON.parse(${priorDevice});let db;try{if(localStorage.getItem('TinderWeb/APIToken')===incoming.apiToken)localStorage.removeItem('TinderWeb/APIToken');if(localStorage.getItem('TinderWeb/uuid')===incoming.deviceId){if(oldDeviceId===null)localStorage.removeItem('TinderWeb/uuid');else localStorage.setItem('TinderWeb/uuid',oldDeviceId)}if(incoming.mfaRecord!==null&&typeof indexedDB.databases==='function'){const info=(await indexedDB.databases()).find(x=>x.name==='keyval-store');if(info){db=await new Promise((resolve,reject)=>{const request=indexedDB.open('keyval-store',info.version);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});if(db.objectStoreNames.contains('keyval'))await new Promise(resolve=>{const transaction=db.transaction('keyval','readwrite');const store=transaction.objectStore('keyval');const request=store.get('persist::mfa');request.onsuccess=()=>{const value=request.result;const token=typeof value==='string'?(()=>{try{return JSON.parse(value).authToken}catch{return null}})():value&&typeof value==='object'?value.authToken:null;if(token===incoming.apiToken)store.delete('persist::mfa')};transaction.oncomplete=()=>resolve(undefined);transaction.onerror=()=>resolve(undefined);transaction.onabort=()=>resolve(undefined)})}}}catch{}finally{db?.close()}})()`;
}

const ALLOWED_ORIGINS = new Set(["https://tinder.com", "https://www.tinder.com"]);
const MAX_BODY_BYTES = 32 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function corsHeaders(origin: string) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Private-Network": "true",
    "Cache-Control": "no-store",
    Vary: "Origin",
    "X-Content-Type-Options": "nosniff",
  };
}

function send(
  response: ServerResponse,
  status: number,
  body: string,
  headers: Record<string, string> = {},
) {
  response.writeHead(status, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...headers,
  });
  response.end(body);
}

function readSession(raw: string): TinderChromeSession | undefined {
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    const apiToken = value.apiToken;
    const deviceId = value.deviceId;
    const mfaRecord = value.mfaRecord;
    if (
      typeof apiToken !== "string" ||
      apiToken.length < 8 ||
      apiToken.length > 8192 ||
      apiToken.trim() !== apiToken ||
      typeof deviceId !== "string" ||
      !UUID_PATTERN.test(deviceId) ||
      (mfaRecord !== null &&
        typeof mfaRecord !== "string" &&
        (typeof mfaRecord !== "object" || Array.isArray(mfaRecord)))
    )
      return;

    const record = mfaRecord as TinderChromeSession["mfaRecord"];
    if (typeof record === "string") {
      if (record.length > 16 * 1024) return;
      try {
        const parsed = JSON.parse(record) as Record<string, unknown>;
        if (
          typeof parsed.authToken !== "string" ||
          parsed.authToken !== apiToken
        )
          return;
      } catch {
        return;
      }
    } else if (record) {
      if (JSON.stringify(record).length > 16 * 1024) return;
      if (
        typeof record.authToken !== "string" ||
        record.authToken !== apiToken
      )
        return;
    }
    return { apiToken, deviceId, mfaRecord: record };
  } catch {
    return;
  }
}

export async function createTinderChromeBridge() {
  const nonce = randomBytes(32).toString("hex");
  let host = "";
  let resolveSession!: (session: TinderChromeSession) => void;
  let rejectSession!: (error: Error) => void;
  let settled = false;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const session = new Promise<TinderChromeSession>((resolve, reject) => {
    resolveSession = resolve;
    rejectSession = reject;
  });
  const close = () => {
    if (timeout) clearTimeout(timeout);
    if (server.listening) server.close();
  };
  const server = createServer((request, response) => {
    const origin = request.headers.origin;
    const path = `/tinder-import/${nonce}`;
    if (request.url !== path || request.headers.host !== host) {
      send(response, 404, "Not found");
      return;
    }
    if (typeof origin !== "string" || !ALLOWED_ORIGINS.has(origin)) {
      send(response, 403, "Origin rejected");
      return;
    }
    if (request.method === "OPTIONS") {
      send(response, 204, "", corsHeaders(origin));
      return;
    }
    if (request.method !== "POST") {
      send(response, 405, "Method not allowed", corsHeaders(origin));
      return;
    }
    const chunks: Buffer[] = [];
    let size = 0;
    let tooLarge = false;
    request.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        tooLarge = true;
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      if (settled || tooLarge) {
        send(response, 413, "Payload rejected", corsHeaders(origin));
        return;
      }
      const imported = readSession(Buffer.concat(chunks).toString("utf8"));
      if (!imported) {
        send(response, 400, "Session data rejected", corsHeaders(origin));
        return;
      }
      settled = true;
      send(response, 200, "Session received", corsHeaders(origin));
      resolveSession(imported);
      close();
    });
  });

  const addressReady = once(server, "listening");
  server.listen(0, "127.0.0.1");
  await addressReady;
  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("tinder-bridge-unavailable");
  }
  host = `127.0.0.1:${address.port}`;
  const endpoint = `http://${host}/tinder-import/${nonce}`;
  timeout = setTimeout(() => {
    if (settled) return;
    settled = true;
    close();
    rejectSession(new Error("tinder-bridge-timeout"));
  }, 180_000);
  timeout.unref?.();

  // This code runs only in the user's Tinder tab in Chrome. It sends only
  // Tinder's auth token, device UUID, and MFA storage record to loopback.
  const script = `(()=>{
    const endpoint=${JSON.stringify(endpoint)};
    void (async()=>{
      let database;
      let token;
      let deviceId;
      let mfaRecord=null;
      try{
        const stores=typeof indexedDB.databases==='function'?await indexedDB.databases():[];
        const info=stores.find(item=>item.name==='keyval-store');
        if(info){
          database=await new Promise((resolve,reject)=>{
            const request=indexedDB.open('keyval-store',info.version);
            request.onsuccess=()=>resolve(request.result);
            request.onerror=()=>reject(request.error);
          });
          try{
            if(database.objectStoreNames.contains('keyval')){
              mfaRecord=await new Promise((resolve,reject)=>{
                const transaction=database.transaction('keyval','readonly');
                const request=transaction.objectStore('keyval').get('persist::mfa');
                request.onsuccess=()=>resolve(request.result??null);
                request.onerror=()=>reject(request.error);
              });
            }
          }finally{
            database.close();
            database=undefined;
          }
        }
        token=typeof mfaRecord==='string'?(()=>{try{return JSON.parse(mfaRecord).authToken}catch{return null}})():mfaRecord&&typeof mfaRecord==='object'?mfaRecord.authToken:null;
        token=typeof token==='string'&&token?token:localStorage.getItem('TinderWeb/APIToken');
        deviceId=localStorage.getItem('TinderWeb/uuid');
        if(!token||!deviceId)throw new Error('session');
        const payload={apiToken:token,deviceId,mfaRecord};
        const response=await fetch(endpoint,{
          method:'POST',mode:'cors',credentials:'omit',cache:'no-store',
          headers:{'Content-Type':'text/plain'},body:JSON.stringify(payload)
        });
        payload.apiToken='';
        payload.deviceId='';
        payload.mfaRecord=null;
        token='';
        deviceId='';
        mfaRecord=null;
        if(!response.ok)throw new Error('transfer');
        alert('Gom đã nhận phiên Tinder. Quay lại Gom để hoàn tất.');
      }catch{
        alert('Gom chưa nhận được phiên Tinder. Hãy kiểm tra Tinder đang đăng nhập trong Chrome rồi thử lại.');
      }finally{
        database?.close();
        token='';
        deviceId='';
        mfaRecord=null;
      }
    })();
  })();`;

  return {
    script,
    session,
    close() {
      if (!settled) {
        settled = true;
        close();
        rejectSession(new Error("tinder-bridge-cancelled"));
      }
    },
  };
}
