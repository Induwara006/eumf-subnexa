type Cue = { start: string; end: string; text: string };
function millis(time: string): number {
 const match=time.trim().match(/^(\d+):(\d\d):(\d\d)[.,](\d{1,3})$/);
 if(!match)throw new Error("Invalid subtitle timestamp.");
 return ((Number(match[1])*60+Number(match[2]))*60+Number(match[3]))*1000+Number(match[4].padEnd(3,"0"));
}
function stamp(ms:number):string {
 return `${String(Math.floor(ms/3600000)).padStart(2,"0")}:${String(Math.floor(ms/60000)%60).padStart(2,"0")}:${String(Math.floor(ms/1000)%60).padStart(2,"0")},${String(ms%1000).padStart(3,"0")}`;
}
/** Match timestamps, never cue positions: drafts and credits can shift indices. */
export function bilingualSrt(translations:Cue[], originals:Cue[]):string {
 const byStart=new Map<number, {end:number;text:string}[]>();
 for(const cue of originals){const start=millis(cue.start);const entries=byStart.get(start)||[];entries.push({end:millis(cue.end),text:cue.text});byStart.set(start,entries);}
 return translations.map((cue,i)=>{
  const start=millis(cue.start),end=millis(cue.end);
  let source: {end:number;text:string}|undefined;
  // ASS timestamps have centisecond precision; prefer exact matches.
  for(const offset of [0,...Array.from({length:10},(_,i)=>i+1).flatMap(n=>[-n,n])]){
   source=byStart.get(start+offset)?.find(item=>Math.abs(item.end-end)<=10);if(source)break;
  }
  return `${i+1}\n${stamp(start)} --> ${stamp(end)}\n${cue.text}${source ? "\n"+source.text : ""}`;
 }).join("\n\n")+"\n";
}
