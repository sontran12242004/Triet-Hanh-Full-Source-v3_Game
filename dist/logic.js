(function(root){
const MAP_COUNT=6,NPCS_PER_MAP=3,QUESTIONS_PER_NPC=5,TOTAL_NPCS=18,TOTAL_QUESTIONS=90,RULES_VERSION=2;
const key=(m,n,q)=>`${m}:${n}:${q}`;
const required=(m,mode)=>Array.from({length:NPCS_PER_MAP},(_,n)=>Array.from({length:QUESTIONS_PER_NPC},(_,q)=>key(m,n,q))).flat();
const complete=(m,mode,answers)=>required(m,mode).every(k=>answers.includes(k));
const accessible=(m,mode,answers)=>m===0||Array.from({length:m},(_,i)=>i).every(i=>complete(i,mode,answers));
const npcQuestions=(m,n,mode)=>[0,1,2,3,4];
const npcComplete=(m,n,mode,answers)=>{const qs=npcQuestions(m,n,mode);return qs.length>0&&qs.every(q=>answers.includes(key(m,n,q)));};
const validKey=k=>/^([0-5]):([0-2]):([0-4])$/.test(k);
const cleanAnswers=(xs,mode)=>[...new Set((Array.isArray(xs)?xs:[]).filter(k=>typeof k==='string'&&validKey(k)))];
root.PhiloLogic={MAP_COUNT,NPCS_PER_MAP,QUESTIONS_PER_NPC,TOTAL_NPCS,TOTAL_QUESTIONS,RULES_VERSION,key,required,complete,accessible,npcQuestions,npcComplete,cleanAnswers};
})(typeof window==='undefined'?globalThis:window);
