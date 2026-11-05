/* OZZ Pós-venda — versão PWA (dados guardados no próprio aparelho) */
(function(){
"use strict";
const VERSAO_APP="1.1.0";

/* Endereço do script da planilha central (Apps Script → Implantar → App da Web → URL).
   Pode ficar público: sem o código de sincronização, digitado em Ajustes, ninguém grava nada. */
const SYNC_URL="";
/* Link de avaliação da OZZ no Google usado quando o aparelho não tiver um link próprio em Ajustes. */
const GOOGLE_PADRAO="";

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

/* ---------- armazenamento local (IndexedDB) ---------- */
const Banco={
  _p:null,
  abrir(){
    if(this._p)return this._p;
    this._p=new Promise((ok,falha)=>{
      if(!("indexedDB" in window))return falha(new Error("sem IndexedDB"));
      const r=indexedDB.open("ozz-posvenda",1);
      r.onupgradeneeded=()=>{const db=r.result;
        if(!db.objectStoreNames.contains("visitas"))db.createObjectStore("visitas",{keyPath:"id"});
        if(!db.objectStoreNames.contains("kv"))db.createObjectStore("kv",{keyPath:"k"});};
      r.onsuccess=()=>ok(r.result);
      r.onerror=()=>falha(r.error);
      r.onblocked=()=>falha(new Error("bloqueado"));
    });
    return this._p;
  },
  async _tx(store,modo,fn){const db=await this.abrir();return new Promise((ok,falha)=>{
    const t=db.transaction(store,modo),s=t.objectStore(store);let res;
    const req=fn(s);if(req)req.onsuccess=()=>{res=req.result};
    t.oncomplete=()=>ok(res);t.onerror=()=>falha(t.error);t.onabort=()=>falha(t.error)})},
  todas(){return this._tx("visitas","readonly",s=>s.getAll())},
  pegar(id){return this._tx("visitas","readonly",s=>s.get(id))},
  gravar(v){return this._tx("visitas","readwrite",s=>s.put(v))},
  gravarVarias(vs){return this._tx("visitas","readwrite",s=>{vs.forEach(v=>s.put(v))})},
  apagarVarias(ids){return this._tx("visitas","readwrite",s=>{ids.forEach(id=>s.delete(id))})},
  async kvGet(k,d){try{const r=await this._tx("kv","readonly",s=>s.get(k));return r?r.v:d}catch(e){return d}},
  kvSet(k,v){return this._tx("kv","readwrite",s=>s.put({k,v}))},
  kvDel(k){return this._tx("kv","readwrite",s=>s.delete(k))}
};

const ETAPAS=[["proposta","Clareza da proposta e da explicação do consultor"],["contrato","Facilidade para assinar o contrato"],["ativacao","Prazo até começar a receber os créditos"],["fatura","Entendimento da fatura da distribuidora e da cobrança OZZ"],["atendimento","Atendimento quando precisou falar com a OZZ"]];
const ECON=["Maior do que o prometido","Igual ao prometido","Menor do que o prometido","Ainda não consegui avaliar"];
const FAT=["Sim, com facilidade","Mais ou menos","Não"];
const VAL=["Economia na conta de luz","Energia limpa e sustentável","Não precisar investir em placas solares","Atendimento da OZZ","Ser uma empresa local, de confiança"];
const STEPS=[["func","Dados"],["cli","Pesquisa"],["sig","Assinatura"],["google","Avaliação"],["pos","Fechamento"]];
const PERFIL={promotor:["Promotor","p"],neutro:["Neutro","n"],detrator:["Detrator","d"]};
const perfilDe=n=>n>=9?"promotor":n>=7?"neutro":"detrator";

let config={googleUrl:"",visitante:"",chave:""}, cache=[], visita=null, filtro="todos";
const linkGoogle=()=>config.googleUrl||GOOGLE_PADRAO;

async function recarregar(){try{cache=await Banco.todas()}catch(e){cache=[];$("#bn-erro").hidden=false}}

/* ---------- navegação ---------- */
function showView(v){
  ["nova","lista","ajustes"].forEach(x=>{$("#view-"+x).hidden=x!==v;$("#tab-"+x).setAttribute("aria-current",x===v)});
  if(v==="lista")recarregar().then(renderLista);
  if(v==="ajustes"){$("#a_google").value=config.googleUrl||"";$("#a_google").placeholder=GOOGLE_PADRAO||"https://g.page/r/...";$("#a_visitante").value=config.visitante||"";$("#a_chave").value=config.chave||"";
    $("#a_msg").hidden=true;$("#d-msg").hidden=true;$("#w-chave").hidden=!SYNC_URL;$("#w-chave-off").hidden=!!SYNC_URL;recarregar().then(renderResumo)}
  window.scrollTo(0,0);
}
$$("nav button").forEach(b=>b.onclick=()=>showView(b.dataset.view));

function showStep(s){
  ["func","cli","sig","google","pos","fim"].forEach(x=>$("#st-"+x).hidden=x!==s);
  const i=STEPS.findIndex(x=>x[0]===s);
  $("#steps").innerHTML=STEPS.map((x,j)=>`<span class="${j===i?"on":j<i||s==="fim"?"done":""}">${j+1}. ${x[1]}</span>`).join("");
  window.scrollTo(0,0);
}

/* ---------- montar questionário ---------- */
$("#q_nps").innerHTML=[...Array(11)].map((_,i)=>`<button type="button" data-v="${i}" class="${i>=9?"p":i>=7?"n":"d"}" aria-pressed="false">${i}</button>`).join("");
$("#q_etapas").innerHTML=ETAPAS.map(([k,t])=>`<div class="scale-row"><span>${t}</span><div class="scale" data-k="${k}" role="group" aria-label="${esc(t)}">${[1,2,3,4,5].map(n=>`<button type="button" data-v="${n}" aria-pressed="false">${n}</button>`).join("")}</div></div>`).join("");
const radios=(el,name,arr)=>{$(el).innerHTML=arr.map((t,i)=>`<label class="opt"><input type="radio" name="${name}" id="${name}_${i}" value="${esc(t)}">${t}</label>`).join("")};
radios("#p_brinde","p_br",["Copo","Cuia","Caneta"]);radios("#q_economia","q_econ",ECON);radios("#q_fatura","q_fat",FAT);radios("#q_depo","q_dep",["Sim","Não"]);
$("#q_valoriza").innerHTML=VAL.map((t,i)=>`<label class="opt"><input type="checkbox" id="q_val_${i}" value="${esc(t)}">${t}</label>`).join("");
$("#p_inds").innerHTML=[1,2,3,4,5].map(i=>`<div class="ref"><b>${i}</b><input type="text" id="i_nome_${i}" placeholder="Nome" aria-label="Nome da indicação ${i}"><input type="tel" id="i_tel_${i}" placeholder="Telefone" aria-label="Telefone da indicação ${i}"><input type="text" id="i_rel_${i}" placeholder="Relação (vizinho, irmão…)" aria-label="Relação da indicação ${i}"></div>`).join("");

const toggleGroup=container=>container.addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;
  container.querySelectorAll("button").forEach(x=>{x.classList.toggle("sel",x===b);x.setAttribute("aria-pressed",x===b)})});
toggleGroup($("#q_nps"));$$(".scale").forEach(s=>toggleGroup(s));
const picked=c=>{const b=c.querySelector("button.sel");return b?Number(b.dataset.v):null};
const radioVal=n=>{const r=document.querySelector(`input[name="${n}"]:checked`);return r?r.value:""};

/* ---------- assinatura ---------- */
const cv=$("#sig"), cx=cv.getContext("2d"); let tracos=0, desenhando=false;
function prepCanvas(){const r=cv.getBoundingClientRect(),d=window.devicePixelRatio||1;
  cv.width=Math.max(1,r.width*d);cv.height=Math.max(1,r.height*d);cx.setTransform(d,0,0,d,0,0);
  cx.lineWidth=2.4;cx.lineCap="round";cx.lineJoin="round";cx.strokeStyle="#1E1A33";tracos=0}
const pos=e=>{const r=cv.getBoundingClientRect();return[e.clientX-r.left,e.clientY-r.top]};
cv.addEventListener("pointerdown",e=>{e.preventDefault();desenhando=true;cv.setPointerCapture(e.pointerId);const[x,y]=pos(e);cx.beginPath();cx.moveTo(x,y);cx.lineTo(x+.1,y+.1);cx.stroke();tracos++});
cv.addEventListener("pointermove",e=>{if(!desenhando)return;e.preventDefault();const[x,y]=pos(e);cx.lineTo(x,y);cx.stroke();tracos++});
["pointerup","pointercancel","pointerleave"].forEach(t=>cv.addEventListener(t,()=>desenhando=false));
cv.addEventListener("touchmove",e=>e.preventDefault(),{passive:false});
function assinaturaJPG(){const o=document.createElement("canvas");o.width=600;o.height=200;const c=o.getContext("2d");
  c.fillStyle="#fff";c.fillRect(0,0,600,200);c.drawImage(cv,0,0,600,200);return o.toDataURL("image/jpeg",.7)}

/* ---------- fluxo ---------- */
function novaVisita(){
  visita=null;
  $("#st-func").reset();$("#st-cli").reset();$("#st-pos").reset();
  $$("#q_nps button,.scale button").forEach(b=>{b.classList.remove("sel");b.setAttribute("aria-pressed","false")});
  $("#c_visitante").value=config.visitante||"";
  $$(".err").forEach(e=>e.hidden=true);
  showStep("func");
}
const erro=(id,msg)=>{const e=$(id);e.textContent=msg;e.hidden=!msg};

$("#st-func").addEventListener("submit",e=>{e.preventDefault();
  if(!$("#c_nome").value.trim()||!$("#c_visitante").value.trim())return erro("#err-func","Preencha o nome do cliente e o nome do funcionário.");
  erro("#err-func","");
  const primeiro=$("#c_nome").value.trim().split(/\s+/)[0];
  $("#cli-ola").textContent=`${primeiro}, como está sua experiência com a Energia por Assinatura?`;
  showStep("cli");
});
$("#bt-cli-voltar").onclick=()=>showStep("func");

$("#st-cli").addEventListener("submit",e=>{e.preventDefault();
  if(picked($("#q_nps"))===null)return erro("#err-cli","Escolha uma nota de 0 a 10 na pergunta 1.");
  if(!$("#q_motivo").value.trim())return erro("#err-cli","Conte o motivo da sua nota na pergunta 2.");
  erro("#err-cli","");
  $("#s_nome").value=$("#c_nome").value.trim();
  $("#s_data").textContent=new Date().toLocaleDateString("pt-BR",{day:"2-digit",month:"long",year:"numeric"})+".";
  showStep("sig");requestAnimationFrame(prepCanvas);
});
$("#bt-sig-voltar").onclick=()=>showStep("cli");
$("#bt-sig-limpar").onclick=prepCanvas;

$("#st-sig").addEventListener("submit",async e=>{e.preventDefault();
  if(!$("#s_nome").value.trim())return erro("#err-sig","Escreva seu nome completo.");
  if(tracos<8)return erro("#err-sig","Faça sua assinatura no quadro.");
  erro("#err-sig","");
  const nps=picked($("#q_nps")), etapas={};
  $$(".scale").forEach(s=>etapas[s.dataset.k]=picked(s));
  const agora=new Date().toISOString();
  visita={
    id:"v_"+Date.now()+"_"+Math.random().toString(36).slice(2,7),
    criadoEm:agora,
    cliente:{nome:$("#c_nome").value.trim(),uc:$("#c_uc").value.trim(),cidade:$("#c_cidade").value.trim(),telefone:$("#c_tel").value.trim(),plano:$("#c_plano").value,distribuidora:$("#c_dist").value,consultor:$("#c_consultor").value.trim()},
    visitante:$("#c_visitante").value.trim(),
    relacionamento:{economia:$("#r_economia").checked,fatura:$("#r_fatura").checked,contato:$("#r_contato").checked},
    anotacoes:$("#c_obs").value.trim(),
    respostas:{nps,motivo:$("#q_motivo").value.trim(),etapas,economia:radioVal("q_econ"),entendeFatura:radioVal("q_fat"),
      valoriza:$$("#q_valoriza input:checked").map(i=>i.value),valorizaOutro:$("#q_valoriza_outro").value.trim(),
      melhoria:$("#q_melhoria").value.trim(),depoimento:radioVal("q_dep")},
    perfil:perfilDe(nps),
    assinatura:{nome:$("#s_nome").value.trim(),imagem:assinaturaJPG(),em:agora},
    google:"",
    pos:null,
    tratativa:perfilDe(nps)==="detrator"?"Aberta":"",
    status:"pesquisa concluída"
  };
  $("#bt-sig-ok").disabled=true;
  const ok=await salvar(visita);
  $("#bt-sig-ok").disabled=false;
  if(!ok)return erro("#err-sig","Não foi possível salvar neste aparelho. Tente de novo.");
  try{await Banco.kvSet("emAndamento",visita.id)}catch(e){}
  montarGoogle();showStep("google");
});

function montarGoogle(){
  const d=visita.perfil==="detrator";
  $("#g-titulo").textContent="Obrigado pela sua resposta!";
  $("#g-texto").textContent=d?"Vamos tratar o que você nos contou. Nossa equipe retorna em até 48 horas. Se quiser, você também pode deixar sua avaliação pública no Google.":"Sua opinião ajuda outras famílias e empresas a conhecerem a OZZ. Se puder, deixe uma avaliação no Google. Leva um minuto.";
  const url=linkGoogle();
  $("#qrcode").innerHTML="";$("#qrcode").hidden=!url;$("#g-semlink").hidden=!!url;$("#g-abrir").hidden=!url;$("#g-dica").hidden=!url;
  if(url){$("#g-abrir").href=url;
    try{const q=qrcode(0,"M");q.addData(url);q.make();$("#qrcode").innerHTML=q.createSvgTag({cellSize:6,margin:0,scalable:true,alt:"QR code para avaliar a OZZ no Google"})}
    catch(e){$("#qrcode").hidden=true}}
}
$("#g-abrir").addEventListener("click",()=>{if(visita){visita.google="abriu o link";salvar(visita)}});
$("#g-pular").onclick=()=>{if(!visita.google)visita.google="não quis agora";irPos()};
$("#g-feito").onclick=()=>{if(!visita.google)visita.google="viu o QR code";irPos()};

function irPos(){
  const p=visita.perfil,[nome,cls]=PERFIL[p];
  $("#pos-chip").innerHTML=`<span class="chip ${cls}">${nome}</span>`;
  const g=$("#pos-guia");g.className="guide "+cls;
  g.innerHTML=p==="promotor"?"<b>Cliente satisfeito.</b> Agradeça e peça indicações. Pergunte quem mais na família, na vizinhança ou no trabalho paga conta de luz alta.":
    p==="neutro"?"<b>Cliente neutro.</b> Pergunte o que falta para ele dar nota 10 e anote. Peça indicações só se a conversa estiver boa.":
    "<b>Cliente insatisfeito.</b> Não peça indicações agora. Ouça o problema, anote com detalhes e diga que a Gestão de Operações retorna em até 48 horas.";
  $("#w-falta").hidden=p!=="neutro";$("#w-problema").hidden=p!=="detrator";$("#w-ind").hidden=p==="detrator";
  showStep("pos");
}

$("#st-pos").addEventListener("submit",async e=>{e.preventDefault();
  const p=visita.perfil;
  if(p==="detrator"&&!$("#p_problema").value.trim())return erro("#err-pos","Descreva o problema relatado pelo cliente.");
  if(!radioVal("p_br"))return erro("#err-pos","Marque o brinde escolhido pelo cliente.");
  erro("#err-pos","");
  const inds=[1,2,3,4,5].map(i=>({nome:$("#i_nome_"+i).value.trim(),telefone:$("#i_tel_"+i).value.trim(),relacao:$("#i_rel_"+i).value.trim()})).filter(x=>x.nome||x.telefone);
  visita.pos={indicacoes:p==="detrator"?[]:inds,autorizaCitar:$("#p_autoriza").checked,faltaPara10:$("#p_falta").value.trim(),problema:$("#p_problema").value.trim(),proximoPasso:$("#p_proximo").value.trim(),em:new Date().toISOString()};
  visita.brinde={item:radioVal("p_br"),combinado:$("#p_brinde_data").value.trim(),status:"A entregar"};
  visita.status="visita finalizada";
  $("#bt-pos-ok").disabled=true;
  const ok=await salvar(visita);
  $("#bt-pos-ok").disabled=false;
  if(!ok)return erro("#err-pos","Não foi possível salvar neste aparelho. Tente de novo.");
  try{await Banco.kvDel("emAndamento")}catch(e){}
  $("#bn-retomar").hidden=true;
  const n=visita.pos.indicacoes.length, base=`${visita.cliente.nome} · ${n} ${n===1?"indicação":"indicações"}`, id=visita.id;
  const fim=t=>{$("#fim-txt").textContent=`${base} · ${t}`};
  fim(!SYNC_URL||!config.chave?"guardada neste aparelho.":navigator.onLine?"enviando para a planilha…":"guardada neste aparelho. Vai para a planilha quando houver internet.");
  showStep("fim");
  if(SYNC_URL&&config.chave){await sincronizar();const v=await Banco.pegar(id).catch(()=>null);
    if(visita===null||visita.id===id)fim(v&&v.sync==="ok"?"enviada para a planilha ✓":"guardada neste aparelho. Vai para a planilha quando houver internet.")}
});
$("#bt-nova").onclick=novaVisita;

/* ---------- salvar ---------- */
async function salvar(v){
  const copia=JSON.parse(JSON.stringify(v));
  copia.atualizadoEm=new Date().toISOString();
  copia.sync="pendente";
  try{await Banco.gravar(copia);const i=cache.findIndex(x=>x.id===copia.id);if(i>=0)cache[i]=copia;else cache.push(copia);agendarSync();return true}
  catch(err){console.error(err);$("#bn-erro").hidden=false;return false}
}

/* ---------- sincronização com a planilha central ---------- */
let sincronizando=false, erroSync="", timerSync=null, ultimaSync="";
const pendentesSync=()=>cache.filter(v=>v.sync==="pendente"||v.sync==="apagar");
function agendarSync(){clearTimeout(timerSync);timerSync=setTimeout(()=>sincronizar(),1500)}
async function enviarPlanilha(corpo){
  let r;
  try{r=await fetch(SYNC_URL,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({...corpo,chave:config.chave}),redirect:"follow",cache:"no-store"})}
  catch(e){const err=new Error("rede");err.codigo="rede";throw err}
  let j;try{j=await r.json()}catch(e){const err=new Error("resposta");err.codigo="resposta";throw err}
  if(!j||!j.ok){const err=new Error(j&&j.erro||"falha");err.codigo=j&&j.erro||"falha";throw err}
  return j;
}
const textoErro=c=>c==="chave"?"O código de sincronização está incorreto. Confira em Ajustes.":
  c==="rede"?"Não foi possível falar com a planilha. Tentaremos de novo.":
  c==="ocupado"?"A planilha estava ocupada. Tentaremos de novo em instantes.":"A planilha não respondeu como esperado. Tentaremos de novo.";
async function sincronizar(){
  if(sincronizando||!SYNC_URL||!config.chave||!navigator.onLine){atualizarStatus();return}
  sincronizando=true;atualizarStatus();
  try{
    await recarregar();
    const apagar=cache.filter(v=>v.sync==="apagar").map(v=>v.id);
    if(apagar.length){const r=await enviarPlanilha({acao:"apagar",ids:apagar});await Banco.apagarVarias(r.ids||apagar)}
    const envios=cache.filter(v=>v.sync==="pendente");
    for(let i=0;i<envios.length;i+=8){
      const lote=envios.slice(i,i+8);
      const r=await enviarPlanilha({acao:"gravar",visitas:lote.map(({sync,sincronizadoEm,...resto})=>resto)});
      const ok=new Set(r.ids||[]),agora=new Date().toISOString(),marcar=[];
      for(const v of lote){if(!ok.has(v.id))continue;const a=await Banco.pegar(v.id);
        if(a&&a.sync==="pendente"&&a.atualizadoEm===v.atualizadoEm)marcar.push({...a,sync:"ok",sincronizadoEm:agora})}
      if(marcar.length)await Banco.gravarVarias(marcar);
    }
    ultimaSync=new Date().toISOString();Banco.kvSet("ultimaSync",ultimaSync).catch(()=>{});erroSync="";
  }catch(e){erroSync=textoErro(e.codigo)}
  sincronizando=false;await recarregar();atualizarStatus();
  if(!$("#view-lista").hidden)renderLista();
  if(!$("#view-ajustes").hidden)renderResumo();
}
const hora=iso=>{try{const d=new Date(iso),h=new Date();return d.toDateString()===h.toDateString()?`hoje às ${d.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}`:d.toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}catch(e){return""}};
function textoStatus(){
  const n=pendentesSync().length, nv=`${n} ${n===1?"visita":"visitas"}`;
  if(!SYNC_URL)return["Visitas registradas <b>neste aparelho</b>. A planilha central ainda não foi ligada.",false];
  if(!config.chave)return["Visitas registradas <b>neste aparelho</b>. Digite o código de sincronização em <b>Ajustes</b> para enviá-las à planilha central.",false];
  if(sincronizando)return["Enviando visitas para a planilha central…",false];
  if(erroSync&&n)return[`${esc(erroSync)} ${nv} aguardando envio.`,true];
  if(n&&!navigator.onLine)return[`${nv} ${n===1?"aguarda":"aguardam"} internet para ir à planilha central.`,false];
  if(n)return[`${nv} aguardando envio para a planilha central.`,true];
  return[`Todas as visitas deste aparelho estão na planilha central${ultimaSync?` · última verificação ${hora(ultimaSync)}`:""}.`,false];
}
function atualizarStatus(){
  const[t,botao]=textoStatus();
  $$(".sync-status").forEach(el=>{el.querySelector(".sync-txt").innerHTML=t;const b=el.querySelector(".sync-bt");if(b){b.hidden=!botao||!navigator.onLine;b.disabled=sincronizando}});
}
$$(".sync-bt").forEach(b=>b.onclick=()=>sincronizar());
window.addEventListener("online",()=>sincronizar());
window.addEventListener("offline",atualizarStatus);
setInterval(()=>{if(pendentesSync().length)sincronizar()},120000);

/* ---------- retomar fechamento interrompido ---------- */
async function verificarRetomada(){
  let id;try{id=await Banco.kvGet("emAndamento",null)}catch(e){return}
  if(!id)return;
  const v=await Banco.pegar(id).catch(()=>null);
  if(!v||v.status==="visita finalizada"){Banco.kvDel("emAndamento").catch(()=>{});return}
  $("#bn-retomar-txt").innerHTML=`<b>A visita de ${esc(v.cliente.nome)} ficou sem fechamento.</b> A pesquisa e a assinatura já estão salvas.`;
  $("#bn-retomar").hidden=false;
  $("#bt-retomar").onclick=()=>{$("#bn-retomar").hidden=true;showView("nova");novaVisita();visita=v;irPos()};
  $("#bt-retomar-nao").onclick=()=>{$("#bn-retomar").hidden=true;Banco.kvDel("emAndamento").catch(()=>{})};
}

/* ---------- lista ---------- */
const ordenadas=()=>[...cache].filter(v=>v.sync!=="apagar"&&v.respostas&&typeof v.respostas.nps==="number").sort((a,b)=>String(b.criadoEm).localeCompare(String(a.criadoEm)));
const dataBR=iso=>{try{return new Date(iso).toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit",year:"2-digit"})}catch(e){return""}};
const filtradas=vs=>vs.filter(v=>filtro==="todos"||(filtro==="aberta"?v.perfil==="detrator"&&v.tratativa!=="Resolvida":v.perfil===filtro));
function renderLista(){
  const vs=ordenadas();
  const t=vs.length,c={promotor:0,neutro:0,detrator:0};vs.forEach(v=>c[v.perfil]++);
  const pct=k=>t?Math.round(c[k]/t*100):0, nps=t?Math.round((c.promotor-c.detrator)/t*100):null;
  const inds=vs.reduce((s,v)=>s+((v.pos&&v.pos.indicacoes)||[]).length,0);
  const goo=vs.filter(v=>v.google==="abriu o link").length;
  const abertas=vs.filter(v=>v.perfil==="detrator"&&v.tratativa!=="Resolvida").length;
  $("#stats").innerHTML=`
    <div class="stat hero"><div class="k">NPS</div><div class="v">${nps===null?"–":(nps>0?"+":"")+nps}</div>
      <div class="bar" aria-hidden="true"><i style="width:${pct("promotor")}%;background:var(--good)"></i><i style="width:${pct("neutro")}%;background:var(--sun)"></i><i style="width:${pct("detrator")}%;background:var(--bad)"></i></div></div>
    <div class="stat"><div class="k">Pesquisas</div><div class="v">${t}</div><div class="muted" style="font-size:13px">${pct("promotor")}% prom. · ${pct("neutro")}% neut. · ${pct("detrator")}% detr.</div></div>
    <div class="stat"><div class="k">Indicações</div><div class="v">${inds}</div><div class="muted" style="font-size:13px">${t?(inds/t).toFixed(1).replace(".",","):"0"} por visita</div></div>
    <div class="stat"><div class="k">Abriram Google</div><div class="v">${goo}</div></div>
    <div class="stat"><div class="k">Tratativas abertas</div><div class="v" style="color:${abertas?"var(--bad)":"inherit"}">${abertas}</div></div>`;
  const lista=filtradas(vs);
  $("#tb").innerHTML=lista.map(v=>{const[pn,pc]=PERFIL[v.perfil]||["",""];
    return `<tr data-id="${esc(v.id)}" tabindex="0"><td>${dataBR(v.criadoEm)}</td><td>${esc(v.cliente.nome)}${v.status!=="visita finalizada"?' <span class="chip pend">sem fechamento</span>':""}${SYNC_URL&&config.chave&&v.sync==="pendente"?' <span class="chip pend">não enviada</span>':""}</td><td>${esc(v.cliente.plano||"–")}</td><td class="num">${v.respostas.nps}</td><td><span class="chip ${pc}">${pn}</span>${v.perfil==="detrator"?` <span class="muted" style="font-size:13px">${esc(v.tratativa||"")}</span>`:""}</td><td class="num">${((v.pos&&v.pos.indicacoes)||[]).length}</td><td>${v.brinde?esc(v.brinde.item)+(v.brinde.status==="Entregue"?" ✓":" · a entregar"):"–"}</td><td>${esc(v.visitante)}</td></tr>`}).join("");
  $("#tb-vazio").hidden=lista.length>0;
  $("#tb-vazio").innerHTML=t?"Nenhuma visita neste filtro.":"Nenhuma visita registrada ainda. As pesquisas aparecem aqui assim que o primeiro cliente assinar em <b>Nova visita</b>.";
  $("#bt-exportar").textContent=`Exportar planilha (${lista.length})`;
  $("#bt-exportar").disabled=!lista.length;
}
$("#filtros").addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;filtro=b.dataset.f;
  $$("#filtros button").forEach(x=>x.setAttribute("aria-pressed",x===b));renderLista()});
const abrirLinha=e=>{const tr=e.target.closest("tr[data-id]");if(tr)abrirDetalhe(tr.dataset.id)};
$("#tb").addEventListener("click",abrirLinha);
$("#tb").addEventListener("keydown",e=>{if(e.key==="Enter")abrirLinha(e)});

function abrirDetalhe(id){
  const v=cache.find(x=>x.id===id);if(!v)return;
  const r=v.respostas,[pn,pc]=PERFIL[v.perfil]||["",""],p=v.pos||{};
  const kv=o=>`<dl class="kv">${o.filter(x=>x[1]!==undefined&&x[1]!==""&&x[1]!==null).map(([k,val])=>`<dt>${k}</dt><dd>${esc(val)}</dd>`).join("")}</dl>`;
  const sim=b=>b?"Sim":"Não";
  $("#d-titulo").textContent=v.cliente.nome;
  $("#d-corpo").innerHTML=`
    <div class="row"><span class="chip ${pc}">${pn} · nota ${r.nps}</span><span class="muted">${new Date(v.criadoEm).toLocaleString("pt-BR")}</span></div>
    ${v.status!=="visita finalizada"?`<div class="sec"><h3>Fechamento pendente</h3><p style="margin:0" class="muted">A pesquisa foi assinada, mas o fechamento (indicações e brinde) não foi feito.</p><div><button class="btn pri sm" id="d-fechar-visita" type="button">Fazer o fechamento agora</button></div></div>`:""}
    ${v.perfil==="detrator"?`<div class="sec"><h3>Tratativa</h3><select id="d-trat">${["Aberta","Em contato","Resolvida"].map(o=>`<option ${o===v.tratativa?"selected":""}>${o}</option>`).join("")}</select><p class="muted" id="d-trat-msg" style="margin:0;font-size:14px" hidden></p></div>`:""}
    ${v.brinde?`<div class="sec"><h3>Brinde: ${esc(v.brinde.item)}</h3>${v.brinde.combinado?`<p style="margin:0">Combinado: ${esc(v.brinde.combinado)}</p>`:""}<select id="d-brinde">${["A entregar","Entregue"].map(o=>`<option ${o===v.brinde.status?"selected":""}>${o}</option>`).join("")}</select><p class="muted" id="d-brinde-msg" style="margin:0;font-size:14px" hidden></p></div>`:""}
    <div class="sec"><h3>Cliente</h3>${kv([["UC / código",v.cliente.uc],["Cidade",v.cliente.cidade],["Telefone",v.cliente.telefone],["Plano",v.cliente.plano],["Distribuidora",v.cliente.distribuidora],["Consultor da venda",v.cliente.consultor],["Funcionário da visita",v.visitante]])}</div>
    <div class="sec"><h3>Respostas</h3>${kv([["Motivo da nota",r.motivo],...ETAPAS.map(([k,t])=>[t,r.etapas&&r.etapas[k]?r.etapas[k]+" de 5":""]),["Economia vs. prometido",r.economia],["Vê a economia na fatura",r.entendeFatura],["Mais valoriza",[...(r.valoriza||[]),r.valorizaOutro].filter(Boolean).join("; ")],["Sugestão de melhoria",r.melhoria],["Autoriza depoimento",r.depoimento],["Avaliação Google",v.google]])}</div>
    <div class="sec"><h3>Fechamento</h3>${kv([["Falta para nota 10",p.faltaPara10],["Problema relatado",p.problema],["Próximo passo",p.proximoPasso],["Pode citar o cliente na indicação",p.em?sim(p.autorizaCitar):""],["Conversou sobre economia",sim(v.relacionamento&&v.relacionamento.economia)],["Tirou dúvidas da fatura",sim(v.relacionamento&&v.relacionamento.fatura)],["Confirmou contato",sim(v.relacionamento&&v.relacionamento.contato)],["Anotações",v.anotacoes]])}
      ${(p.indicacoes||[]).length?`<div class="tbl"><table><thead><tr><th>Indicação</th><th>Telefone</th><th>Relação</th></tr></thead><tbody>${p.indicacoes.map(i=>`<tr style="cursor:auto"><td>${esc(i.nome)}</td><td>${esc(i.telefone)}</td><td>${esc(i.relacao)}</td></tr>`).join("")}</tbody></table></div>`:'<p class="muted" style="margin:0">Sem indicações.</p>'}</div>
    <div class="sec"><h3>Assinatura</h3>${v.assinatura&&v.assinatura.imagem?`<img class="sigimg" src="${esc(v.assinatura.imagem)}" alt="Assinatura de ${esc(v.assinatura.nome)}">`:""}<p style="margin:0">${esc(v.assinatura&&v.assinatura.nome)} · ${v.assinatura?new Date(v.assinatura.em).toLocaleString("pt-BR"):""}</p></div>
    <div class="sec danger"><h3>Apagar visita</h3><p class="muted" style="margin:0;font-size:14px">Use para visitas de teste ou registradas por engano. ${SYNC_URL&&config.chave?"Ela também sai da planilha central. ":""}Não dá para desfazer.</p>
      <div class="row" id="d-apagar-1"><button class="btn ghost sm bad" type="button" id="d-apagar">Apagar esta visita</button></div>
      <div class="row" id="d-apagar-2" hidden><b style="margin-right:auto">Apagar a visita de ${esc(v.cliente.nome)}?</b><button class="btn ghost sm" type="button" id="d-apagar-nao">Cancelar</button><button class="btn sm badfill" type="button" id="d-apagar-sim">Sim, apagar</button></div></div>`;
  $("#d-apagar").onclick=()=>{$("#d-apagar-1").hidden=true;$("#d-apagar-2").hidden=false};
  $("#d-apagar-nao").onclick=()=>{$("#d-apagar-1").hidden=false;$("#d-apagar-2").hidden=true};
  $("#d-apagar-sim").onclick=async()=>{
    try{
      if(v.sincronizadoEm||v.sync==="ok"){const marcada={...v,sync:"apagar"};await Banco.gravar(marcada)}
      else await Banco.apagarVarias([v.id]);
    }catch(e){return}
    if(visita&&visita.id===v.id)visita=null;
    await recarregar();$("#drawer").hidden=true;renderLista();atualizarStatus();agendarSync();
  };
  const fv=$("#d-fechar-visita");
  if(fv)fv.onclick=()=>{$("#drawer").hidden=true;showView("nova");novaVisita();visita=JSON.parse(JSON.stringify(v));irPos()};
  const sel=$("#d-trat");
  if(sel)sel.onchange=async()=>{const m=$("#d-trat-msg");const ok=await salvar({...v,tratativa:sel.value});
    m.textContent=ok?"Tratativa atualizada.":"Não foi possível salvar.";m.hidden=false;renderLista()};
  const sb=$("#d-brinde");
  if(sb)sb.onchange=async()=>{const m=$("#d-brinde-msg");const ok=await salvar({...v,brinde:{...v.brinde,status:sb.value}});
    m.textContent=ok?"Brinde atualizado.":"Não foi possível salvar.";m.hidden=false;renderLista()};
  $("#drawer").hidden=false;$("#d-fechar").focus();
}
$("#d-fechar").onclick=()=>$("#drawer").hidden=true;
$("#drawer").addEventListener("click",e=>{if(e.target.id==="drawer")$("#drawer").hidden=true});
document.addEventListener("keydown",e=>{if(e.key==="Escape")$("#drawer").hidden=true});

/* ---------- exportar planilha (CSV) e backup ---------- */
const hoje=()=>new Date().toISOString().slice(0,10);
async function entregarArquivo(nome,blob){
  const toque=navigator.maxTouchPoints>0;
  if(toque&&navigator.canShare){
    const f=new File([blob],nome,{type:blob.type});
    if(navigator.canShare({files:[f]})){try{await navigator.share({files:[f],title:nome});return}catch(e){if(e&&e.name==="AbortError")return}}
  }
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=nome;document.body.appendChild(a);a.click();
  setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},2000);
}
const celula=x=>{let s=x==null?"":String(x);
  if(/^[=@]/.test(s)||/^[+\-][^\d\s]/.test(s))s="'"+s;   /* evita que o Excel trate texto como fórmula */
  return '"'+s.replace(/"/g,'""')+'"'};
function gerarCSV(vs){
  const cab=["Data","Hora","Funcionário","Cliente","UC / código","Cidade","Telefone","Plano","Distribuidora","Consultor da venda",
    "Nota","Perfil","Motivo da nota",...ETAPAS.map(e=>e[1]),"Economia vs. prometido","Vê a economia na fatura","Mais valoriza","Valoriza (outro)",
    "Sugestão de melhoria","Autoriza depoimento","Avaliação Google","Conversou sobre economia","Tirou dúvidas da fatura","Confirmou contato","Anotações",
    "Falta para nota 10","Problema relatado","Tratativa","Próximo passo","Nº de indicações","Indicações","Pode citar o cliente",
    "Brinde","Brinde combinado","Brinde status","Assinado por","Assinado em","Status","ID"];
  const sim=b=>b?"Sim":"Não";
  const linhas=vs.map(v=>{const r=v.respostas||{},p=v.pos||{},d=new Date(v.criadoEm),b=v.brinde||{},rel=v.relacionamento||{};
    return [d.toLocaleDateString("pt-BR"),d.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}),v.visitante,v.cliente.nome,v.cliente.uc,v.cliente.cidade,v.cliente.telefone,v.cliente.plano,v.cliente.distribuidora,v.cliente.consultor,
      r.nps,(PERFIL[v.perfil]||[""])[0],r.motivo,...ETAPAS.map(([k])=>r.etapas&&r.etapas[k]!=null?r.etapas[k]:""),r.economia,r.entendeFatura,(r.valoriza||[]).join("; "),r.valorizaOutro,
      r.melhoria,r.depoimento,v.google,sim(rel.economia),sim(rel.fatura),sim(rel.contato),v.anotacoes,
      p.faltaPara10,p.problema,v.tratativa,p.proximoPasso,(p.indicacoes||[]).length,(p.indicacoes||[]).map(i=>[i.nome,i.telefone,i.relacao].filter(Boolean).join(" · ")).join(" | "),p.em?sim(p.autorizaCitar):"",
      b.item,b.combinado,b.status,v.assinatura&&v.assinatura.nome,v.assinatura?new Date(v.assinatura.em).toLocaleString("pt-BR"):"",v.status,v.id].map(celula).join(";")});
  return "﻿"+[cab.map(celula).join(";"),...linhas].join("\r\n");
}
async function exportar(vs,sufixo){
  if(!vs.length)return;
  await entregarArquivo(`ozz-visitas-${sufixo?sufixo+"-":""}${hoje()}.csv`,new Blob([gerarCSV(vs)],{type:"text/csv;charset=utf-8"}));
}
$("#bt-exportar").onclick=()=>exportar(filtradas(ordenadas()),filtro==="todos"?"":filtro);
$("#bt-exportar-todas").onclick=async()=>{await recarregar();const vs=ordenadas();if(!vs.length)return msgDados("Ainda não há visitas para exportar.");exportar(vs,"")};

const msgDados=t=>{$("#d-msg").textContent=t;$("#d-msg").hidden=false};
$("#bt-backup").onclick=async()=>{await recarregar();
  const vs=cache.filter(v=>v.sync!=="apagar");
  const dados={app:"ozz-posvenda",versao:VERSAO_APP,geradoEm:new Date().toISOString(),visitas:vs};
  await entregarArquivo(`ozz-backup-${hoje()}.json`,new Blob([JSON.stringify(dados)],{type:"application/json"}));
  msgDados(`Backup gerado com ${vs.length} ${vs.length===1?"visita":"visitas"}.`)};
$("#bt-restaurar").onclick=()=>$("#in-restaurar").click();
$("#in-restaurar").onchange=async e=>{const f=e.target.files[0];e.target.value="";if(!f)return;
  try{const d=JSON.parse(await f.text());const vs=Array.isArray(d)?d:d.visitas;
    if(!Array.isArray(vs))throw new Error("formato");
    await recarregar();const atual=new Map(cache.map(v=>[v.id,v]));let novas=0,atualizadas=0;const gravar=[];
    for(const v of vs){if(!v||!v.id||!v.cliente||!v.respostas)continue;const a=atual.get(v.id);
      if(!a){gravar.push({...v,sync:v.sync||"pendente"});novas++}
      else if(String(v.atualizadoEm||v.criadoEm)>String(a.atualizadoEm||a.criadoEm)){gravar.push({...v,sync:"pendente"});atualizadas++}}
    if(gravar.length)await Banco.gravarVarias(gravar);
    await recarregar();renderResumo();
    msgDados(`Backup restaurado: ${novas} ${novas===1?"visita nova":"visitas novas"}, ${atualizadas} ${atualizadas===1?"atualizada":"atualizadas"}.`)}
  catch(err){msgDados("Este arquivo não parece um backup do app OZZ Pós-venda.")}};

function renderResumo(){
  atualizarStatus();
  const vs=cache.filter(v=>v.sync!=="apagar"),t=vs.length,pend=vs.filter(v=>v.status!=="visita finalizada").length;
  $("#d-resumo").textContent=t?`${t} ${t===1?"visita guardada":"visitas guardadas"} neste aparelho${pend?`, ${pend} sem fechamento`:""}.`:"Nenhuma visita guardada neste aparelho ainda.";
}

/* ---------- ajustes ---------- */
$("#f-ajustes").addEventListener("submit",async e=>{e.preventDefault();
  const url=$("#a_google").value.trim(),m=$("#a_msg");
  if(url&&!/^https:\/\//.test(url)){m.textContent="O link precisa começar com https://";m.hidden=false;return}
  const chaveAntes=config.chave;
  config={googleUrl:url,visitante:$("#a_visitante").value.trim(),chave:$("#a_chave").value.trim().toUpperCase()};
  $("#a_chave").value=config.chave;
  if(!$("#c_visitante").value.trim())$("#c_visitante").value=config.visitante;
  try{await Banco.kvSet("config",config);m.textContent="Ajustes salvos."}catch(err){m.textContent="Não foi possível salvar os ajustes."}
  m.hidden=false;
  if(config.chave!==chaveAntes){erroSync="";atualizarStatus();if(config.chave)sincronizar()}
});
$("#bt-testar").onclick=async()=>{
  const m=$("#a_msg"),k=$("#a_chave").value.trim().toUpperCase();m.hidden=false;
  if(!k){m.textContent="Digite o código de sincronização.";return}
  if(!navigator.onLine){m.textContent="Sem internet agora. Teste quando o aparelho estiver conectado.";return}
  m.textContent="Testando conexão…";
  const salva=config.chave;config.chave=k;
  try{const r=await enviarPlanilha({acao:"ping"});m.textContent=`Conectado à planilha “${r.planilha||"OZZ"}”. Toque em Salvar ajustes para guardar o código.`}
  catch(e){m.textContent=e.codigo==="chave"?"Código incorreto. Confira o código na planilha (menu OZZ Visitas → Mostrar código).":"Não foi possível falar com a planilha agora. Verifique a internet e tente de novo."}
  finally{config.chave=salva}
};

/* ---------- instalação e atualização (PWA) ---------- */
const instalado=window.matchMedia("(display-mode: standalone)").matches||navigator.standalone===true;
async function avisoInstalar(){
  const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
  if(instalado||!ios)return;
  if(await Banco.kvGet("avisoInstalarVisto",false))return;
  $("#bn-instalar").hidden=false;
  $("#bt-instalar-ok").onclick=()=>{$("#bn-instalar").hidden=true;Banco.kvSet("avisoInstalarVisto",true).catch(()=>{})};
}
let pediuAtualizar=false, recarregando=false;
if("serviceWorker" in navigator){
  navigator.serviceWorker.register("sw.js").then(reg=>{
    const avisar=w=>{$("#bn-update").hidden=false;$("#bt-update").onclick=()=>{pediuAtualizar=true;w.postMessage("skipWaiting")}};
    if(reg.waiting&&navigator.serviceWorker.controller)avisar(reg.waiting);
    reg.addEventListener("updatefound",()=>{const w=reg.installing;if(!w)return;
      w.addEventListener("statechange",()=>{if(w.state==="installed"&&navigator.serviceWorker.controller)avisar(w)})});
    document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")reg.update().catch(()=>{})});
  }).catch(err=>console.warn("Service worker não registrado:",err));
  navigator.serviceWorker.addEventListener("controllerchange",()=>{if(!pediuAtualizar||recarregando)return;recarregando=true;location.reload()});
}
if(navigator.storage&&navigator.storage.persist){navigator.storage.persist().catch(()=>{})}

/* ---------- início ---------- */
(async()=>{
  try{await Banco.abrir()}catch(e){$("#bn-erro").hidden=false}
  config={googleUrl:"",visitante:"",chave:"",...(await Banco.kvGet("config",{}))};
  ultimaSync=await Banco.kvGet("ultimaSync","");
  await recarregar();
  atualizarStatus();
  sincronizar();
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")sincronizar()});
  $("#versao").textContent=`OZZ Pós-venda · versão ${VERSAO_APP}${instalado?" · instalado":""}`;
  novaVisita();
  verificarRetomada();
  avisoInstalar();
})();
})();
