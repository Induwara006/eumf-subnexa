import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { isIP } from "node:net";

export function publicIPv4(ip: string) {
  if (isIP(ip) !== 4) return false;
  const [a,b,c] = ip.split('.').map(Number);
  return !(a===0 || a===10 || a===127 || a>=224 || (a===169&&b===254) ||
    (a===172&&b>=16&&b<=31) || (a===192&&b===168) || (a===100&&b>=64&&b<=127) ||
    (a===192&&b===0) || (a===192&&b===2) || (a===198&&(b===18||b===19)) ||
    (a===198&&b===51&&c===100) || (a===203&&b===0&&c===113));
}
export function posterURL(value: string) {
  if (value.length > 2048) throw new Error('Image link is too long.');
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('Enter a valid HTTPS image link.'); }
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') ||
      url.hostname === 'localhost' || url.hostname.endsWith('.localhost') || url.hostname.endsWith('.local') ||
      (isIP(url.hostname.replace(/^\[|\]$/g,'')) && !publicIPv4(url.hostname))) {
    throw new Error('Use a public HTTPS image link.');
  }
  return url;
}
export async function fetchPoster(value: string, hops = 0, deadline = Date.now()+12000): Promise<Buffer> {
  if (hops > 3 || Date.now() >= deadline) throw new Error('Image link timed out or redirected too many times.');
  const url = posterURL(value);
  // Resolve once and pin the actual connection to this public IPv4 address.
  const remaining = Math.max(1,deadline-Date.now());
  let timer: ReturnType<typeof setTimeout> | undefined;
  const addresses = await Promise.race([
    lookup(url.hostname,{all:true,family:4}),
    new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('Image host lookup timed out.')),remaining);})
  ]).finally(()=>clearTimeout(timer));
  if (!addresses.length || addresses.some(a=>!publicIPv4(a.address))) throw new Error('Image host is not a public address.');
  const address = addresses[0].address;
  return new Promise<Buffer>((resolve,reject)=>{
    let finished=false;
    const fail=(error: Error)=>{if(!finished){finished=true;reject(error);}};
    const req=request(url, {method:'GET',family:4, agent:false,
      lookup: (_hostname, _options, callback)=>callback(null,address,4),
      headers:{Accept:'image/jpeg,image/png,image/webp','User-Agent':'SubNexa-Poster-Importer/1.0'}
    }, response=>{
      const status=response.statusCode || 500;
      if ([301,302,303,307,308].includes(status)) {
        response.resume();
        clearTimeout(timeout);
        if (!response.headers.location) return fail(new Error('Invalid image redirect.'));
        let next: string;
        try { next = new URL(response.headers.location,url).href; } catch { return fail(new Error('Invalid image redirect.')); }
        finished=true;
        fetchPoster(next,hops+1,deadline).then(resolve,reject);
        return;
      }
      if(status!==200){response.resume();return fail(new Error('Image link could not be downloaded. Use a direct image URL.'));}
      if(Number(response.headers['content-length']||0)>2097152){response.destroy();return fail(new Error('Poster is larger than 2 MB.'));}
      const chunks: Buffer[]=[];let size=0;
      response.on('data',(chunk:Buffer)=>{size+=chunk.length;if(size>2097152){response.destroy();fail(new Error('Poster is larger than 2 MB.'));}else chunks.push(chunk);});
      response.on('aborted',()=>fail(new Error('Image download interrupted.')));
      response.on('error',()=>fail(new Error('Image download interrupted.')));
      response.on('end',()=>{if(!finished){finished=true;resolve(Buffer.concat(chunks));}});
    });
    const timeout=setTimeout(()=>req.destroy(new Error('Image download timed out.')),Math.max(1,deadline-Date.now()));
    req.on('error',()=>fail(new Error('Image download failed or timed out.')));
    req.on('close',()=>clearTimeout(timeout));
    req.end();
  });
}
