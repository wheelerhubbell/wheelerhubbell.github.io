/** WHP beacon transport. Delivery acknowledgment is not proof of agent work. */
export const DEFAULT_STREAM='https://standing-guard-service.lovable.app/v1/beacon/stream';
const publicUrl=value=>{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password)throw Error('HTTPS endpoint required');return u.href;};
export async function summonAgent(targetUrl,challenge,options={}){
 const target=publicUrl(targetUrl);if(!challenge||typeof challenge.subject!=='string'||typeof challenge.claim!=='string'||!challenge.subject.trim()||!challenge.claim.trim())throw Error('subject and claim required');
 const ttl=challenge.ttlSeconds??300;if(!Number.isSafeInteger(ttl)||ttl<1||ttl>86400)throw Error('ttlSeconds must be 1..86400');
 const id=challenge.id??globalThis.crypto.randomUUID();if(typeof id!=='string'||!id||id.length>200)throw Error('Invalid challenge ID');
 const payload={beacon_type:'WHP-SUMMON-BEACON-v1',timestamp:new Date().toISOString(),challenge_id:id,subject:challenge.subject,claim:challenge.claim,expires_in_seconds:ttl,callback_url:challenge.callbackUrl?publicUrl(challenge.callbackUrl):null,boundary:'A transport request, not an attestation, grant of authority, payment or completed task.'};
 const bytes=JSON.stringify(payload);const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(bytes)))].map(x=>x.toString(16).padStart(2,'0')).join('');
 const response=await (options.fetchImpl??fetch)(target,{method:'POST',headers:{...(options.headers??{}),'Content-Type':'application/json','X-WHP-Beacon-Summon':id},body:bytes,redirect:'error',signal:options.signal??AbortSignal.timeout(15000)});
 const responseText=await response.text();return {dispatched:response.ok,status:response.status,challenge_id:id,target_url:target,request_sha256:hash,response:responseText.slice(0,65536),completed_work_verified:false};
}
export function listenBeaconStream({streamUrl=DEFAULT_STREAM,onPulse,onChallenge,onError,fetchImpl=fetch}={}){
 const controller=new AbortController();
 const done=(async()=>{try{
  const response=await fetchImpl(publicUrl(streamUrl),{headers:{Accept:'text/event-stream'},signal:controller.signal,redirect:'error'});
  if(!response.ok||!response.body||!response.headers.get('content-type')?.includes('text/event-stream'))throw Error('Beacon stream unavailable: HTTP '+response.status);
  const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='',event='message',data=[];
  const emit=()=>{if(data.length){const parsed=JSON.parse(data.join('\n'));if(event==='pulse')onPulse?.(parsed);else if(event==='challenge')onChallenge?.(parsed);}event='message';data=[];};
  try{for(;;){const {done,value}=await reader.read();buffer+=decoder.decode(value??new Uint8Array(),{stream:!done});if(buffer.length>1048576)throw Error('Beacon stream buffer exceeded');let i;while((i=buffer.indexOf('\n'))>=0){let line=buffer.slice(0,i);buffer=buffer.slice(i+1);if(line.endsWith('\r'))line=line.slice(0,-1);if(line==='')emit();else if(line.startsWith('event:'))event=line.slice(6).trim();else if(line.startsWith('data:'))data.push(line.slice(5).replace(/^ /,''));}if(done){if(buffer.trim())throw Error('Incomplete SSE frame');break;}}}finally{reader.releaseLock();}
 }catch(error){if(error.name!=='AbortError'){onError?.(error);throw error;}}})();
 const stop=()=>controller.abort();stop.done=done;return stop;
}
