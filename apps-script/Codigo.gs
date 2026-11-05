/**
 * OZZ Pós-venda — planilha central
 * Recebe as visitas do app (PWA) e grava nesta planilha.
 *
 * Como instalar: veja o LEIA-ME.md do repositório (seção "Planilha central").
 * A chave de acesso NÃO fica neste código: ela é gerada pelo menu
 * "OZZ Visitas → Configurar planilha" e guardada nas propriedades do script.
 */

var ABA_VISITAS = "Visitas";
var ABA_INDICACOES = "Indicações";
var NOME_PASTA = "OZZ Visitas – Assinaturas";

var ETAPAS = [
  ["proposta", "Clareza da proposta e da explicação do consultor"],
  ["contrato", "Facilidade para assinar o contrato"],
  ["ativacao", "Prazo até começar a receber os créditos"],
  ["fatura", "Entendimento da fatura da distribuidora e da cobrança OZZ"],
  ["atendimento", "Atendimento quando precisou falar com a OZZ"]
];
var PERFIS = { promotor: "Promotor", neutro: "Neutro", detrator: "Detrator" };

var CAB_VISITAS = ["Data e hora", "Funcionário", "Cliente", "UC / código", "Cidade", "Telefone", "Plano", "Distribuidora", "Consultor da venda",
  "Nota", "Perfil", "Motivo da nota"].concat(ETAPAS.map(function (e) { return e[1]; })).concat([
  "Economia vs. prometido", "Vê a economia na fatura", "Mais valoriza", "Valoriza (outro)", "Sugestão de melhoria", "Autoriza depoimento",
  "Avaliação Google", "Conversou sobre economia", "Tirou dúvidas da fatura", "Confirmou contato", "Anotações",
  "Falta para nota 10", "Problema relatado", "Tratativa", "Próximo passo", "Nº de indicações", "Pode citar o cliente",
  "Brinde", "Brinde combinado", "Brinde status", "Assinado por", "Assinatura", "Status", "Atualizado no app", "Recebido em", "ID"]);

var CAB_INDICACOES = ["Data da visita", "Indicado por (cliente)", "Telefone do cliente", "Funcionário", "Nome indicado", "Telefone indicado",
  "Relação", "Pode citar o cliente", "ID da visita"];

/* ---------------- menu e configuração ---------------- */

function onOpen() {
  SpreadsheetApp.getUi().createMenu("OZZ Visitas")
    .addItem("Configurar planilha", "configurar")
    .addItem("Mostrar código de sincronização", "mostrarChave")
    .addItem("Gerar novo código (bloqueia o antigo)", "novaChave")
    .addToUi();
}

function configurar() {
  var ss = SpreadsheetApp.getActive();
  prepararAba_(ss, ABA_VISITAS, CAB_VISITAS);
  prepararAba_(ss, ABA_INDICACOES, CAB_INDICACOES);
  pasta_();
  if (!chave_()) gerarChave_();
  SpreadsheetApp.getUi().alert("Planilha configurada",
    "Código de sincronização: " + chave_() + "\n\n" +
    "Digite este código em Ajustes, no app de cada iPad.\n\n" +
    "Próximo passo: Implantar → Nova implantação → App da Web (veja o LEIA-ME).",
    SpreadsheetApp.getUi().ButtonSet.OK);
}

function mostrarChave() {
  SpreadsheetApp.getUi().alert("Código de sincronização", chave_() || "Ainda não gerado. Use 'Configurar planilha'.", SpreadsheetApp.getUi().ButtonSet.OK);
}

function novaChave() {
  var ui = SpreadsheetApp.getUi();
  var r = ui.alert("Gerar novo código?", "Os iPads com o código antigo param de enviar até receberem o novo código em Ajustes.", ui.ButtonSet.OK_CANCEL);
  if (r !== ui.Button.OK) return;
  gerarChave_();
  ui.alert("Novo código de sincronização", chave_(), ui.ButtonSet.OK);
}

function prepararAba_(ss, nome, cab) {
  var sh = ss.getSheetByName(nome) || ss.insertSheet(nome);
  var atual = sh.getLastColumn() ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0] : [];
  // acrescenta colunas que faltarem, sem mexer nas existentes
  var faltando = cab.filter(function (c) { return atual.indexOf(c) < 0; });
  if (faltando.length) sh.getRange(1, atual.filter(String).length + 1, 1, faltando.length).setValues([faltando]);
  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, sh.getLastColumn()).setFontWeight("bold").setBackground("#292163").setFontColor("#ffffff");
  return sh;
}

function chave_() { return PropertiesService.getScriptProperties().getProperty("CHAVE") || ""; }

function gerarChave_() {
  var letras = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", partes = [];
  for (var p = 0; p < 3; p++) { var s = ""; for (var i = 0; i < 4; i++) s += letras.charAt(Math.floor(Math.random() * letras.length)); partes.push(s); }
  PropertiesService.getScriptProperties().setProperty("CHAVE", "OZZ-" + partes.join("-"));
}

function pasta_() {
  var props = PropertiesService.getScriptProperties(), id = props.getProperty("PASTA_ID");
  if (id) { try { var f = DriveApp.getFolderById(id); if (!f.isTrashed()) return f; } catch (e) {} }
  var nova = DriveApp.createFolder(NOME_PASTA);
  props.setProperty("PASTA_ID", nova.getId());
  return nova;
}

/* ---------------- recebimento ---------------- */

function doGet() {
  return json_({ ok: true, app: "ozz-posvenda", mensagem: "Planilha central ativa." });
}

function doPost(e) {
  var req;
  try { req = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, erro: "formato" }); }
  if (!req || !chave_() || req.chave !== chave_()) return json_({ ok: false, erro: "chave" });
  if (req.acao === "ping") return json_({ ok: true, planilha: SpreadsheetApp.getActive().getName() });

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return json_({ ok: false, erro: "ocupado" });
  try {
    var ss = SpreadsheetApp.getActive();
    var shV = prepararAba_(ss, ABA_VISITAS, CAB_VISITAS);
    var shI = prepararAba_(ss, ABA_INDICACOES, CAB_INDICACOES);
    if (req.acao === "apagar") {
      var apagadas = (req.ids || []).filter(function (id) { return typeof id === "string" && id; });
      apagadas.forEach(function (id) { apagarAssinatura_(shV, id); apagarLinhas_(shV, "ID", id); apagarLinhas_(shI, "ID da visita", id); });
      return json_({ ok: true, ids: apagadas });
    }
    var ids = [];
    (req.visitas || []).forEach(function (v) {
      if (!v || typeof v.id !== "string" || !v.cliente || !v.respostas) return;
      gravarVisita_(shV, shI, v);
      ids.push(v.id);
    });
    return json_({ ok: true, ids: ids });
  } finally {
    lock.releaseLock();
  }
}

function gravarVisita_(shV, shI, v) {
  var cab = shV.getRange(1, 1, 1, shV.getLastColumn()).getValues()[0];
  var col = function (n) { return cab.indexOf(n) + 1; };
  var linha = acharLinha_(shV, col("ID"), v.id);

  // assinatura: salva a imagem no Drive só uma vez
  var link = "";
  if (linha) {
    var rt = shV.getRange(linha, col("Assinatura")).getRichTextValue();
    link = (rt && rt.getLinkUrl()) || "";
  }
  if (!link && v.assinatura && v.assinatura.imagem) link = salvarAssinatura_(v);

  var r = v.respostas || {}, p = v.pos || {}, b = v.brinde || {}, rel = v.relacionamento || {}, c = v.cliente || {};
  var sim = function (x) { return x ? "Sim" : "Não"; };
  var dados = {
    "Data e hora": data_(v.criadoEm), "Funcionário": v.visitante, "Cliente": c.nome, "UC / código": c.uc, "Cidade": c.cidade,
    "Telefone": c.telefone, "Plano": c.plano, "Distribuidora": c.distribuidora, "Consultor da venda": c.consultor,
    "Nota": typeof r.nps === "number" ? r.nps : "", "Perfil": PERFIS[v.perfil] || "", "Motivo da nota": r.motivo,
    "Economia vs. prometido": r.economia, "Vê a economia na fatura": r.entendeFatura, "Mais valoriza": (r.valoriza || []).join("; "),
    "Valoriza (outro)": r.valorizaOutro, "Sugestão de melhoria": r.melhoria, "Autoriza depoimento": r.depoimento, "Avaliação Google": v.google,
    "Conversou sobre economia": sim(rel.economia), "Tirou dúvidas da fatura": sim(rel.fatura), "Confirmou contato": sim(rel.contato),
    "Anotações": v.anotacoes, "Falta para nota 10": p.faltaPara10, "Problema relatado": p.problema, "Tratativa": v.tratativa,
    "Próximo passo": p.proximoPasso, "Nº de indicações": (p.indicacoes || []).length, "Pode citar o cliente": p.em ? sim(p.autorizaCitar) : "",
    "Brinde": b.item, "Brinde combinado": b.combinado, "Brinde status": b.status, "Assinado por": v.assinatura && v.assinatura.nome,
    "Assinatura": "", "Status": v.status, "Atualizado no app": data_(v.atualizadoEm), "Recebido em": new Date(), "ID": v.id
  };
  ETAPAS.forEach(function (e) { dados[e[1]] = r.etapas && r.etapas[e[0]] != null ? r.etapas[e[0]] : ""; });

  var valores = cab.map(function (h) { return h in dados ? limpar_(dados[h]) : ""; });
  var formatos = cab.map(function (h) { return /^(Data e hora|Atualizado no app|Recebido em)$/.test(h) ? "dd/mm/yyyy hh:mm" : (h === "Nota" || h === "Nº de indicações" || ETAPAS.some(function (e) { return e[1] === h; })) ? "0" : "@"; });

  if (!linha) linha = shV.getLastRow() + 1;
  var faixa = shV.getRange(linha, 1, 1, cab.length);
  faixa.setNumberFormats([formatos]);
  faixa.setValues([valores]);
  if (link) shV.getRange(linha, col("Assinatura")).setRichTextValue(SpreadsheetApp.newRichTextValue().setText("Ver assinatura").setLinkUrl(link).build());

  // indicações: substitui as linhas desta visita
  apagarLinhas_(shI, "ID da visita", v.id);
  var inds = p.indicacoes || [];
  if (inds.length) {
    var cabI = shI.getRange(1, 1, 1, shI.getLastColumn()).getValues()[0];
    var linhas = inds.map(function (i) {
      var d = { "Data da visita": data_(v.criadoEm), "Indicado por (cliente)": c.nome, "Telefone do cliente": c.telefone, "Funcionário": v.visitante,
        "Nome indicado": i.nome, "Telefone indicado": i.telefone, "Relação": i.relacao, "Pode citar o cliente": sim(p.autorizaCitar), "ID da visita": v.id };
      return cabI.map(function (h) { return h in d ? limpar_(d[h]) : ""; });
    });
    var fmtI = cabI.map(function (h) { return h === "Data da visita" ? "dd/mm/yyyy hh:mm" : "@"; });
    var ini = shI.getLastRow() + 1, fx = shI.getRange(ini, 1, linhas.length, cabI.length);
    fx.setNumberFormats(linhas.map(function () { return fmtI; }));
    fx.setValues(linhas);
  }
}

function salvarAssinatura_(v) {
  try {
    var base64 = String(v.assinatura.imagem).split(",")[1];
    if (!base64) return "";
    var nome = "assinatura_" + (v.cliente.nome || "cliente").replace(/[^\wÀ-ÿ ]+/g, "").trim() + "_" + v.id + ".jpg";
    var arq = pasta_().createFile(Utilities.newBlob(Utilities.base64Decode(base64), "image/jpeg", nome));
    return arq.getUrl();
  } catch (e) {
    return "";
  }
}

/* manda para a lixeira do Drive a imagem da assinatura de uma visita apagada */
function apagarAssinatura_(sh, id) {
  try {
    var cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    var linha = acharLinha_(sh, cab.indexOf("ID") + 1, id);
    if (!linha) return;
    var rt = sh.getRange(linha, cab.indexOf("Assinatura") + 1).getRichTextValue();
    var m = String((rt && rt.getLinkUrl()) || "").match(/\/d\/([\w-]+)/);
    if (m) DriveApp.getFileById(m[1]).setTrashed(true);
  } catch (e) {}
}

function acharLinha_(sh, coluna, id) {
  if (!coluna || sh.getLastRow() < 2) return 0;
  var achado = sh.getRange(2, coluna, sh.getLastRow() - 1, 1).createTextFinder(id).matchEntireCell(true).findNext();
  return achado ? achado.getRow() : 0;
}

function apagarLinhas_(sh, nomeColuna, id) {
  if (sh.getLastRow() < 2) return;
  var cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0], coluna = cab.indexOf(nomeColuna) + 1;
  if (!coluna) return;
  var achados = sh.getRange(2, coluna, sh.getLastRow() - 1, 1).createTextFinder(id).matchEntireCell(true).findAll();
  achados.map(function (r) { return r.getRow(); }).sort(function (a, b) { return b - a; }).forEach(function (n) { sh.deleteRow(n); });
}

function data_(iso) { var d = iso ? new Date(iso) : null; return d && !isNaN(d) ? d : ""; }

/* impede que um texto digitado vire fórmula na planilha */
function limpar_(x) {
  if (x === null || x === undefined) return "";
  if (typeof x === "string" && /^[=+\-@]/.test(x)) return "'" + x;
  return x;
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
