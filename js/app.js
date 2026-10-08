import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth, initializeAuth, inMemoryPersistence, onAuthStateChanged, signInWithEmailAndPassword, signOut,
  sendPasswordResetEmail, createUserWithEmailAndPassword,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc,
  query, where, serverTimestamp, writeBatch,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import {
  MECANICAS, UNIDADES, EMBALAGENS, TAMANHOS, MODELOS, calcular, moeda, num, montar,
  dividirLinhas, humanizar, lerConteudo, validadeTexto,
} from './placa.js';
import { carregar, buscar, porCodigo, SETORES } from './produtos.js';

// ---------------- Configuração ----------------
const firebaseConfig = {
  apiKey: 'AIzaSyA-9aOKmJWjZaZZY1iKyF9vgQbXFc1_-I8',
  authDomain: 'superville-cartazes.firebaseapp.com',
  projectId: 'superville-cartazes',
  storageBucket: 'superville-cartazes.firebasestorage.app',
  messagingSenderId: '462923117145',
  appId: '1:462923117145:web:57d0686e7382839366b748',
};
const ADM = 'viniciussuperville@gmail.com';
const LOJAS_INICIAIS = [
  { id: 'vila-romana', nome: 'Vila Romana', ordem: 1, email: 'superville.coriolano@gmail.com' },
  { id: 'vila-leopoldina', nome: 'Vila Leopoldina', ordem: 2, email: 'superville.leopoldina@gmail.com' },
  { id: 'santo-amaro', nome: 'Santo Amaro', ordem: 3, email: 'superville.stoamaro@gmail.com' },
  { id: 'pio-xi', nome: 'Pio XI', ordem: 4, email: 'superville.pioxi@gmail.com' },
];

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ---------------- Utilidades ----------------
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ms = t => (t && t.toMillis) ? t.toMillis() : (typeof t === 'number' ? t : 0);
const dataHora = t => { const d = new Date(ms(t)); return ms(t) ? d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''; };
const hoje = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const espera = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
let toastT;
function toast(t, erro = false) {
  const el = $('#toast'); el.textContent = t; el.className = 'on' + (erro ? ' erro' : '');
  clearTimeout(toastT); toastT = setTimeout(() => el.className = '', 3500);
}
const carregando = on => $('#carregando').classList.toggle('on', on);
const ERROS = {
  'auth/invalid-credential': 'E-mail ou senha incorretos.', 'auth/wrong-password': 'E-mail ou senha incorretos.',
  'auth/user-not-found': 'E-mail ou senha incorretos.', 'auth/invalid-email': 'E-mail inválido.',
  'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos.', 'auth/weak-password': 'A senha precisa ter no mínimo 6 caracteres.',
  'auth/email-already-in-use': 'Este e-mail já tem login.', 'permission-denied': 'Sem permissão para esta ação.',
};
const msgErro = e => ERROS[e?.code] || e?.message || 'Erro inesperado.';
const fontesProntas = Promise.all(['300', '500', '700', '800', '900'].map(w => document.fonts.load(`${w} 20px Montserrat`))).catch(() => {});

// ---------------- Estado ----------------
let PERFIL = null, LOJAS = [], LOJA = null, OFERTAS = [], LOTES = [];
let editandoId = null, atual = {}, impCtx = null;
const isAdm = () => PERFIL?.perfil === 'adm';
const nomeLoja = id => LOJAS.find(l => l.id === id)?.nome || id || '';

function mostrar(tela) {
  $('#tela-login').hidden = tela !== 'login';
  $('#tela-app').hidden = tela !== 'app';
}

// ---------------- Login ----------------
$('#form-login').addEventListener('submit', async e => {
  e.preventDefault();
  $('#login-msg').textContent = ''; $('#login-msg').className = 'msg';
  carregando(true);
  try { await signInWithEmailAndPassword(auth, $('#login-email').value.trim(), $('#login-senha').value); }
  catch (err) { $('#login-msg').textContent = msgErro(err); }
  finally { carregando(false); }
});
$('#btn-esqueci').addEventListener('click', async () => {
  const email = $('#login-email').value.trim();
  if (!email) { $('#login-msg').textContent = 'Digite seu e-mail acima e clique novamente.'; return; }
  try { await sendPasswordResetEmail(auth, email); $('#login-msg').className = 'msg ok'; $('#login-msg').textContent = 'Enviamos um link para redefinir a senha no seu e-mail.'; }
  catch (err) { $('#login-msg').textContent = msgErro(err); }
});
$('#btn-sair').addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, async user => {
  if (!user) { PERFIL = null; mostrar('login'); return; }
  carregando(true);
  try { await iniciar(user); }
  catch (err) { console.error(err); $('#login-msg').textContent = msgErro(err); await signOut(auth); }
  finally { carregando(false); }
});

async function semear() {
  const ls = await getDocs(collection(db, 'lojas'));
  if (!ls.empty) return;
  const b = writeBatch(db);
  for (const l of LOJAS_INICIAIS) {
    b.set(doc(db, 'lojas', l.id), { nome: l.nome, ordem: l.ordem });
    b.set(doc(db, 'usuarios', l.email), { loja: l.id, perfil: 'loja', ativo: true });
  }
  b.set(doc(db, 'usuarios', ADM), { loja: null, perfil: 'adm', ativo: true });
  await b.commit();
}

async function iniciar(user) {
  const email = user.email.toLowerCase();
  if (email === ADM) await semear();
  const pd = await getDoc(doc(db, 'usuarios', email));
  if (email !== ADM && (!pd.exists() || !pd.data().ativo)) {
    await signOut(auth);
    $('#login-msg').textContent = 'Seu acesso ainda não foi liberado. Fale com o administrador.';
    return;
  }
  PERFIL = email === ADM ? { email, perfil: 'adm', loja: null } : { email, ...pd.data() };
  await carregarLojas();
  LOJA = isAdm() ? (localStorage.getItem('sv-loja') && LOJAS.some(l => l.id === localStorage.getItem('sv-loja')) ? localStorage.getItem('sv-loja') : LOJAS[0]?.id) : PERFIL.loja;
  $('#topo-user').textContent = email;
  $('#btn-aba-adm').hidden = !isAdm();
  $('#sel-loja').hidden = !isAdm();
  atualizarTopoLoja();
  mostrar('app');
  trocarAba('ofertas');
  carregar().catch(() => toast('Não foi possível carregar a base de produtos.', true));
  await carregarDados();
}

async function carregarLojas() {
  LOJAS = (await getDocs(collection(db, 'lojas'))).docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.ordem || 99) - (b.ordem || 99) || a.nome.localeCompare(b.nome));
  const opts = LOJAS.map(l => `<option value="${l.id}">${esc(l.nome)}</option>`).join('');
  $('#sel-loja').innerHTML = opts; $('#nu-loja').innerHTML = opts;
  if (LOJA) $('#sel-loja').value = LOJA;
}
function atualizarTopoLoja() {
  $('#topo-loja').textContent = isAdm() ? 'Administrador · ' + nomeLoja(LOJA) : nomeLoja(LOJA);
  $('#sel-loja').value = LOJA || '';
}
$('#sel-loja').addEventListener('change', async e => {
  LOJA = e.target.value; localStorage.setItem('sv-loja', LOJA); atualizarTopoLoja();
  carregando(true); try { await carregarDados(); } finally { carregando(false); }
});

async function carregarDados() {
  if (!LOJA) { OFERTAS = []; LOTES = []; renderOfertas(); renderLotes(); return; }
  const [of, lo] = await Promise.all([
    getDocs(query(collection(db, 'ofertas'), where('loja', '==', LOJA))),
    getDocs(query(collection(db, 'lotes'), where('loja', '==', LOJA))),
  ]);
  OFERTAS = of.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => ms(b.atualizadoEm) - ms(a.atualizadoEm));
  LOTES = lo.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.numero || 0) - (a.numero || 0));
  renderOfertas(); renderLotes();
}

// ---------------- Abas ----------------
function trocarAba(a) {
  $$('.abas button').forEach(b => b.classList.toggle('ativa', b.dataset.aba === a));
  ['ofertas', 'lotes', 'adm'].forEach(x => $('#aba-' + x).hidden = x !== a);
  if (a === 'adm') renderAdm();
}
$$('.abas button').forEach(b => b.addEventListener('click', () => trocarAba(b.dataset.aba)));

// ---------------- Lista de ofertas ----------------
$('#filtro-mec').innerHTML += Object.entries(MECANICAS).map(([k, v]) => `<option value="${k}">${k} - ${v}</option>`).join('') + '<option value="cb">CASHBACK</option>';
$('#busca-ofertas').addEventListener('input', renderOfertas);
$('#filtro-mec').addEventListener('change', renderOfertas);

function vigencia(o) {
  if (o.enquantoDurar) return { t: 'Enquanto durarem os estoques', c: '' };
  if (!o.dataIni && !o.dataFim) return { t: '-', c: '' };
  const h = hoje(), br = s => s ? s.split('-').reverse().join('/') : '...';
  const t = `${br(o.dataIni)} a ${br(o.dataFim)}`;
  if (o.dataFim && o.dataFim < h) return { t: t + ' (vencida)', c: 'vencida' };
  if (o.dataIni && o.dataIni > h) return { t: t + ' (futura)', c: 'futura' };
  return { t, c: '' };
}
const descOferta = o => (o.linhas || []).filter(Boolean).join(' ');
const dinamica = o => o.modelo === 'cashback' ? 'CASHBACK' : `${o.mecanica} - ${MECANICAS[o.mecanica] || ''}`;
function precoPor(o) {
  const r = calcular(o);
  if (o.modelo === 'cashback') return 'Cashback R$ ' + moeda(num(o.cashback));
  if (o.mecanica === '10') return 'R$ ' + moeda(r.total) + ' emb.';
  if (o.mecanica === '07') return 'Leva brinde';
  return r.promo ? 'R$ ' + moeda(r.promo) : '-';
}

function filtradas() {
  const q = $('#busca-ofertas').value.trim().toUpperCase(), f = $('#filtro-mec').value;
  return OFERTAS.filter(o => {
    if (f && (f === 'cb' ? o.modelo !== 'cashback' : (o.modelo === 'cashback' || o.mecanica !== f))) return false;
    if (!q) return true;
    return (descOferta(o) + ' ' + (o.codigo || '') + ' ' + (o.barras || '') + ' ' + (o.brindeDesc || '')).toUpperCase().includes(q);
  });
}

function renderOfertas() {
  const lista = filtradas();
  $('#tab-ofertas tbody').innerHTML = lista.map(o => {
    const v = vigencia(o);
    return `<tr data-id="${o.id}">
      <td class="chk"><input type="checkbox" class="sel-of" value="${o.id}"></td>
      <td>${esc(o.codigo || '')}<br><small>${esc(o.barras || '')}</small></td>
      <td class="desc-col"><b>${esc(descOferta(o))}</b>${o.mecanica === '07' && o.brindeDesc ? `<small>Leve: ${esc(o.brindeDesc)}</small>` : ''}${o.unidade ? `<small> · ${esc(o.unidade)}</small>` : ''}</td>
      <td><span class="tag ${o.modelo}">${esc(MODELOS[o.modelo]?.nome || '')}</span></td>
      <td>${esc(dinamica(o))}</td>
      <td class="num">R$ ${moeda(num(o.de))}</td>
      <td class="num">${esc(precoPor(o))}</td>
      <td><span class="vig ${v.c}">${esc(v.t)}</span></td>
      <td class="acoes">
        <button class="ico imp" data-acao="imp" title="Imprimir">🖨</button>
        <button class="ico" data-acao="edit" title="Editar">✎</button>
        <button class="ico" data-acao="dup" title="Duplicar">⧉</button>
        <button class="ico del" data-acao="del" title="Excluir">🗑</button>
      </td></tr>`;
  }).join('');
  $('#ofertas-vazio').hidden = lista.length > 0;
  $('#chk-todos').checked = false;
  atualizarSel();
}
function selecionadas() { return $$('.sel-of:checked').map(c => OFERTAS.find(o => o.id === c.value)).filter(Boolean); }
function atualizarSel() {
  const n = selecionadas().length;
  $('#btn-imprimir-sel').disabled = !n;
  $('#btn-imprimir-sel').textContent = n ? `Imprimir selecionados (${n})` : 'Imprimir selecionados';
}
$('#chk-todos').addEventListener('change', e => { $$('.sel-of').forEach(c => c.checked = e.target.checked); atualizarSel(); });
$('#tab-ofertas').addEventListener('change', e => { if (e.target.classList.contains('sel-of')) atualizarSel(); });
$('#tab-ofertas').addEventListener('click', async e => {
  const b = e.target.closest('[data-acao]'); if (!b) return;
  const o = OFERTAS.find(x => x.id === b.closest('tr').dataset.id); if (!o) return;
  const acao = b.dataset.acao;
  if (acao === 'edit') abrirEditor(o, false);
  if (acao === 'dup') abrirEditor(o, true);
  if (acao === 'imp') abrirImpressao({ tipo: 'sel', itens: [o] });
  if (acao === 'del') {
    if (!confirm(`Excluir a oferta "${descOferta(o)}"?`)) return;
    try { await deleteDoc(doc(db, 'ofertas', o.id)); OFERTAS = OFERTAS.filter(x => x.id !== o.id); renderOfertas(); toast('Oferta excluída.'); }
    catch (err) { toast(msgErro(err), true); }
  }
});
$('#btn-imprimir-sel').addEventListener('click', () => abrirImpressao({ tipo: 'sel', itens: selecionadas() }));
$('#btn-branco').addEventListener('click', () => abrirImpressao({ tipo: 'branco' }));
$('#btn-nova').addEventListener('click', () => abrirEditor(null));

// ---------------- Editor ----------------
const opt = (v, t = v) => `<option value="${esc(v)}">${esc(t)}</option>`;
$('#f-mecanica').innerHTML = Object.entries(MECANICAS).map(([k, v]) => opt(k, `${k} - ${v}`)).join('');
$('#f-unidade').innerHTML = UNIDADES.map(u => opt(u, u === '100G' ? '100g (hortifruti)' : u === '100ML' ? '100ml' : u)).join('');
$('#f-emb').innerHTML = EMBALAGENS.map(e => opt(e)).join('');
$('#f-tamanho').innerHTML = Object.entries(TAMANHOS).map(([k, t]) => opt(k, t.nome)).join('');
$('#imp-tamanho').innerHTML = $('#f-tamanho').innerHTML;
$('#f-setor').innerHTML += Object.entries(SETORES).sort((a, b) => a[1].localeCompare(b[1])).map(([k, v]) => opt(k, `${v} (${k})`)).join('');
$$('[data-fechar]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));
$('#form-editor').addEventListener('submit', e => e.preventDefault());
$('#form-imp').addEventListener('submit', e => e.preventDefault());

const CAMPOS = ['f-modelo', 'f-mecanica', 'f-l1', 'f-l2', 'f-l3', 'f-unidade', 'f-conteudo', 'f-de', 'f-por', 'f-qtd', 'f-pague',
  'f-pct', 'f-emb', 'f-cashback', 'f-brinde', 'f-ini', 'f-fim', 'f-tamanho', 'f-estoque', 'f-venc', 'f-semfundo', 'f-vermelho'];
CAMPOS.forEach(id => { const el = $('#' + id); el.addEventListener('input', atualizarEditor); el.addEventListener('change', atualizarEditor); });

const PADRAO = { modelo: 'oferta', mecanica: '02', unidade: 'UNIDADE', qtd: 2, pague: 1, pct: 50, embalagem: 'A CAIXA', tamanho: 'A4', semFundo: true };
const fmtCampo = v => 'R$ ' + moeda(num(v) || 0);
// campos de dinheiro: o encarregado digita só os números e a vírgula entra sozinha (399 → R$ 3,99)
['f-de', 'f-por', 'f-cashback', 'f-kgde', 'f-kgpor'].forEach(id => {
  const el = $('#' + id);
  el.setAttribute('inputmode', 'numeric');
  el.addEventListener('input', () => {
    if (id === 'f-kgde' || id === 'f-kgpor') el.dataset.manual = '1';
    const d = el.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 9);
    el.value = 'R$ ' + moeda((parseInt(d || '0', 10)) / 100);
    el.setSelectionRange(el.value.length, el.value.length);
    atualizarEditor();
  });
  // ao clicar, seleciona o valor: o que for digitado substitui o preço anterior
  el.addEventListener('focus', () => el.select());
});

function preencher(o) {
  atual = { codigo: o.codigo || '', barras: o.barras || '', brindeCod: o.brindeCod || '', descBase: o.descBase || '' };
  $('#f-modelo').value = o.modelo || 'oferta';
  $('#f-mecanica').value = o.mecanica || '02';
  const l = o.linhas || [];
  $('#f-l1').value = l[0] || ''; $('#f-l2').value = l[1] || ''; $('#f-l3').value = l[2] || '';
  $('#f-unidade').value = o.unidade || 'UNIDADE';
  $('#f-conteudo').value = o.conteudo || '';
  $('#f-de').value = fmtCampo(o.de); $('#f-por').value = fmtCampo(o.por); $('#f-cashback').value = fmtCampo(o.cashback);
  $('#f-qtd').value = o.qtd || ''; $('#f-pague').value = o.pague || ''; $('#f-pct').value = o.pct ? String(o.pct).replace('.', ',') : '';
  $('#f-emb').value = o.embalagem || 'A CAIXA';
  $('#f-brinde').value = o.brindeDesc || ''; $('#f-brinde-busca').value = '';
  $('#f-ini').value = o.dataIni || ''; $('#f-fim').value = o.dataFim || '';
  $('#f-tamanho').value = o.tamanho || 'A4';
  $('#f-estoque').checked = !!o.enquantoDurar; $('#f-venc').checked = !!o.proxVenc; $('#f-semfundo').checked = !!o.semFundo; $('#f-vermelho').checked = !!o.precoVermelho;
  $('#f-busca').value = ''; $('#sug-produto').hidden = true;
  // preço do kg: guardado só quando foi alterado à mão
  $('#f-kgde').value = fmtCampo(o.kgDe); $('#f-kgde').dataset.manual = o.kgDe ? '1' : '';
  $('#f-kgpor').value = fmtCampo(o.kgPor); $('#f-kgpor').dataset.manual = o.kgPor ? '1' : '';
  marcarModelo();
  mostrarProduto();
}
function marcarModelo() {
  $$('#modelos button').forEach(b => b.classList.toggle('ativo', b.dataset.modelo === $('#f-modelo').value));
}
$$('#modelos button').forEach(b => b.addEventListener('click', () => {
  $('#f-modelo').value = b.dataset.modelo; marcarModelo(); atualizarEditor();
}));
$('#btn-kg-recalc').addEventListener('click', () => {
  $('#f-kgde').dataset.manual = ''; $('#f-kgpor').dataset.manual = ''; atualizarEditor();
});
const DICAS = {
  '01': 'Preço único, sem "De" e "Por". A placa fica toda branca, com o preço grande.',
  '02': 'Preço normal (De) e preço da promoção (Por). A economia é calculada sozinha.',
  '03': 'Ex.: compre 3 e pague 2. O sistema calcula quanto sai cada unidade.',
  '04': 'Ex.: na compra de 2 unidades, cada uma sai por R$ X.',
  '05': 'Ex.: a partir de 3 unidades, cada uma sai por R$ X.',
  '06': 'Ex.: compre 2 e pague a 2ª com 50% de desconto. O desconto é sempre na última unidade.',
  '07': 'Na compra do produto, por + R$ 0,01 o cliente leva outro produto.',
  '10': 'Mostra o preço da unidade e o total da embalagem (caixa, fardo, pack...).',
  'cb': 'Mostra o preço regular e o valor do cashback que o cliente do Clube recebe.',
};
function mostrarProduto() {
  $('#prod-sel').innerHTML = atual.codigo || atual.barras
    ? `Produto: <b>${esc(atual.codigo)}</b> ${atual.barras ? '· ' + esc(atual.barras) : ''} ${atual.descBase ? '· ' + esc(atual.descBase) : ''}`
    : 'Nenhum produto selecionado (você pode digitar a descrição manualmente).';
}

function lerForm() {
  return {
    modelo: $('#f-modelo').value, mecanica: $('#f-modelo').value === 'cashback' ? '' : $('#f-mecanica').value,
    codigo: atual.codigo || '', barras: atual.barras || '', descBase: atual.descBase || '',
    linhas: [$('#f-l1').value.trim().toUpperCase(), $('#f-l2').value.trim().toUpperCase(), $('#f-l3').value.trim().toUpperCase()],
    unidade: $('#f-unidade').value, conteudo: $('#f-conteudo').value.trim().toUpperCase(),
    de: num($('#f-de').value), por: num($('#f-por').value), cashback: num($('#f-cashback').value),
    qtd: parseInt($('#f-qtd').value) || 0, pague: parseInt($('#f-pague').value) || 0, pct: num($('#f-pct').value),
    embalagem: $('#f-emb').value, brindeCod: atual.brindeCod || '', brindeDesc: $('#f-brinde').value.trim().toUpperCase(),
    dataIni: $('#f-ini').value, dataFim: $('#f-fim').value, enquantoDurar: $('#f-estoque').checked,
    proxVenc: $('#f-venc').checked, tamanho: $('#f-tamanho').value, semFundo: $('#f-semfundo').checked, precoVermelho: $('#f-vermelho').checked,
    kgDe: $('#f-unidade').value === '100G' && $('#f-kgde').dataset.manual ? num($('#f-kgde').value) : 0,
    kgPor: $('#f-unidade').value === '100G' && $('#f-kgpor').dataset.manual ? num($('#f-kgpor').value) : 0,
  };
}

function mostrarCampos(o) {
  const cb = o.modelo === 'cashback', m = o.mecanica;
  const vis = (id, v) => $('#' + id).hidden = !v;
  vis('w-mecanica', !cb);
  vis('w-por', !cb && ['02', '04', '05'].includes(m));
  vis('w-qtd', !cb && ['03', '04', '05', '06', '07', '10'].includes(m));
  vis('w-pague', !cb && m === '03');
  vis('w-pct', !cb && m === '06');
  vis('w-emb', !cb && m === '10');
  vis('w-cashback', cb);
  vis('w-brinde', !cb && m === '07');
  $('#lbl-de').textContent = cb ? 'Preço regular' : ({ '01': 'Preço', '02': 'Preço De', '10': 'Preço da unidade' }[m] || 'Preço regular');
  $('#lbl-por').textContent = m === '02' ? 'Preço Por' : 'Preço promocional (por unidade)';
  $('#lbl-qtd').textContent = { '03': 'Compre', '04': 'Na compra de (unid.)', '05': 'A partir de (unid.)', '06': 'Compre (unid.)', '07': 'Na compra de (unid.)', '10': 'Unidades na embalagem' }[m] || 'Quantidade';
  const temPromo = !cb && ['02', '03', '04', '05', '06'].includes(m);
  vis('w-kg', o.unidade === '100G' && m !== '07' && m !== '10');
  vis('w-kgpor', temPromo);
  $('#lbl-kgde').textContent = temPromo ? 'Preço do kg (De / regular)' : 'Preço do kg';
  $('#mec-dica').textContent = DICAS[cb ? 'cb' : m] || '';
}

let prevT;
function atualizarEditor() {
  const o = lerForm();
  mostrarCampos(o);
  const r = calcular(o);
  // preço do kg automático (100g × 10), a não ser que tenha sido alterado à mão
  if (o.unidade === '100G') {
    if (!$('#f-kgde').dataset.manual) $('#f-kgde').value = fmtCampo(o.de * 10);
    if (!$('#f-kgpor').dataset.manual) $('#f-kgpor').value = fmtCampo((r.promo || 0) * 10);
  }
  const info = [];
  if (o.modelo !== 'cashback') {
    if (['03', '06'].includes(o.mecanica) && r.promo) info.push(`Preço por unidade na promoção: <b>R$ ${moeda(r.promo)}</b> (arredondado para baixo)`);
    if (r.economia) info.push(`Economia por unidade: <b>R$ ${moeda(r.economia)}</b>`);
    if (o.mecanica === '10' && r.total) info.push(`Total da embalagem: <b>R$ ${moeda(r.total)}</b>`);
  }
  if (o.unidade === '100G' && o.de) info.push(`Preço do kg: <b>R$ ${moeda(o.kgDe || o.de * 10)}</b>${r.promo ? ` → <b>R$ ${moeda(o.kgPor || r.promo * 10)}</b>` : ''}`);
  if (r.erro) info.push(`<span style="color:#C62828"><b>Atenção:</b> ${esc(r.erro)}</span>`);
  $('#calc-info').innerHTML = info.join('<br>');
  clearTimeout(prevT);
  prevT = setTimeout(async () => { await fontesProntas; montar($('#preview'), o, { largura: '340px', modo: 'fundo' }); }, 60);
  // a prévia mostra sempre a placa completa; o aviso diz como ela sai na impressão
  $('#prev-modo').className = 'prev-modo ' + (o.semFundo ? 'sem' : 'com');
  $('#prev-modo').innerHTML = o.semFundo
    ? '🖨 Na impressão sai <b>SEM FUNDO</b>: só os textos e preços, para a placa da gráfica.'
    : '🖨 Na impressão sai a <b>placa completa</b>, com fundo colorido.';
}

function abrirEditor(o, duplicar = false) {
  editandoId = o && !duplicar ? o.id : null;
  $('#editor-titulo').textContent = editandoId ? 'Editar placa' : duplicar ? 'Duplicar placa' : 'Nova placa';
  $('#editor-msg').textContent = '';
  $('#f-manter').checked = false;
  preencher(o ? { ...o } : { ...PADRAO });
  if (!$('#dlg-editor').open) $('#dlg-editor').showModal();
  atualizarEditor();
  setTimeout(() => $('#f-busca').focus(), 50);
}

// --- busca de produto ---
function ligarBusca(inputId, boxId, setorId, aoEscolher) {
  const inp = $('#' + inputId), box = $('#' + boxId);
  let lista = [], idx = 0, t;
  const desenhar = () => {
    box.innerHTML = lista.map((p, i) => `<div data-i="${i}" class="${i === idx ? 'sel' : ''}"><b>${esc(p.d)}</b><br><small>Cód. ${esc(p.c)}${p.b ? ' · ' + esc(p.b) : ''} · ${esc(SETORES[p.dep] || p.s || '')}</small></div>`).join('')
      || '<div><small>Nenhum produto encontrado.</small></div>';
    box.hidden = false;
  };
  const procurar = async () => {
    const q = inp.value.trim();
    if (q.length < 2) { box.hidden = true; return; }
    await carregar();
    lista = buscar(q, setorId ? $('#' + setorId).value : ''); idx = 0; desenhar();
  };
  inp.addEventListener('input', () => { clearTimeout(t); t = setTimeout(procurar, 180); });
  inp.addEventListener('keydown', async e => {
    if (e.key === 'ArrowDown' && !box.hidden) { idx = Math.min(idx + 1, lista.length - 1); desenhar(); e.preventDefault(); }
    else if (e.key === 'ArrowUp' && !box.hidden) { idx = Math.max(idx - 1, 0); desenhar(); e.preventDefault(); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      await carregar();
      const exato = porCodigo(inp.value);
      const p = exato || (!box.hidden && lista[idx]);
      if (p) { aoEscolher(p); inp.value = ''; box.hidden = true; }
    } else if (e.key === 'Escape') { box.hidden = true; e.stopPropagation(); e.preventDefault(); }
  });
  box.addEventListener('mousedown', e => {
    const d = e.target.closest('[data-i]'); if (!d) return;
    e.preventDefault(); aoEscolher(lista[+d.dataset.i]); inp.value = ''; box.hidden = true;
  });
  inp.addEventListener('blur', () => setTimeout(() => box.hidden = true, 150));
  if (setorId) $('#' + setorId).addEventListener('change', procurar);
}
// descrições já ajustadas pelas lojas ficam salvas por código de produto (coleção "descricoes")
const DESCS = new Map();
async function descricaoSalva(codigo) {
  if (!codigo) return null;
  if (DESCS.has(codigo)) return DESCS.get(codigo);
  try { const d = await getDoc(doc(db, 'descricoes', codigo)); const v = d.exists() ? d.data() : null; DESCS.set(codigo, v); return v; }
  catch (e) { return null; }
}
async function guardarDescricao(o) {
  if (!o.codigo || !o.linhas.some(Boolean)) return;
  const salva = DESCS.get(o.codigo);
  if (salva && JSON.stringify(salva.linhas) === JSON.stringify(o.linhas) && salva.conteudo === o.conteudo && salva.unidade === o.unidade) return;
  const dados = { linhas: o.linhas, conteudo: o.conteudo, unidade: o.unidade, descBase: o.descBase || '', atualizadoEm: serverTimestamp(), atualizadoPor: PERFIL.email };
  try { await setDoc(doc(db, 'descricoes', o.codigo), dados); DESCS.set(o.codigo, dados); }
  catch (e) { console.warn('Descrição não salva:', e); }
}
ligarBusca('f-busca', 'sug-produto', 'f-setor', async p => {
  atual.codigo = p.c; atual.barras = p.b || ''; atual.descBase = p.d;
  const [a, b, c] = dividirLinhas(p.d);
  $('#f-l1').value = a; $('#f-l2').value = b; $('#f-l3').value = c;
  $('#f-conteudo').value = lerConteudo(p.d);
  mostrarProduto(); atualizarEditor();
  $('#f-de').focus();
  const salva = await descricaoSalva(p.c);
  if (salva && atual.codigo === p.c) {
    const l = salva.linhas || [];
    $('#f-l1').value = l[0] || ''; $('#f-l2').value = l[1] || ''; $('#f-l3').value = l[2] || '';
    if (salva.conteudo !== undefined) $('#f-conteudo').value = salva.conteudo;
    if (salva.unidade) $('#f-unidade').value = salva.unidade;
    $('#prod-sel').innerHTML += ' <b class="tag-salva">✔ Usando a descrição salva deste produto</b>';
    atualizarEditor();
  }
});
ligarBusca('f-brinde-busca', 'sug-brinde', null, p => {
  atual.brindeCod = p.c; $('#f-brinde').value = humanizar(p.d); atualizarEditor();
});

function validar(o) {
  if (!o.linhas.some(Boolean)) return 'Preencha a descrição do produto.';
  if (!o.de) return 'Informe o preço.';
  const r = calcular(o);
  if (o.modelo === 'cashback') { if (!o.cashback) return 'Informe o valor do cashback.'; }
  else {
    if (['02', '04', '05'].includes(o.mecanica) && !o.por) return 'Informe o preço promocional.';
    if (['03', '04', '05', '06', '07', '10'].includes(o.mecanica) && !o.qtd) return 'Informe a quantidade.';
    if (o.mecanica === '03' && !o.pague) return 'Informe o "Pague".';
    if (o.mecanica === '06' && !(o.pct > 0 && o.pct <= 100)) return 'Informe o percentual de desconto (1 a 100).';
    if (o.mecanica === '07' && !o.brindeDesc) return 'Informe o produto que o cliente leva.';
  }
  if (r.erro) return r.erro;
  if (o.dataIni && o.dataFim && o.dataFim < o.dataIni) return 'A data final é anterior à data inicial.';
  return '';
}

async function salvar() {
  const o = lerForm();
  const erro = validar(o);
  if (erro) { $('#editor-msg').textContent = erro; return null; }
  if (!LOJA) { $('#editor-msg').textContent = 'Selecione uma loja.'; return null; }
  carregando(true);
  try {
    const dados = { ...o, loja: LOJA, atualizadoEm: serverTimestamp(), atualizadoPor: PERFIL.email };
    let id = editandoId;
    if (id) await updateDoc(doc(db, 'ofertas', id), dados);
    else { dados.criadoEm = serverTimestamp(); dados.criadoPor = PERFIL.email; id = (await addDoc(collection(db, 'ofertas'), dados)).id; }
    guardarDescricao(o);
    const salvo = { ...dados, id, atualizadoEm: Date.now() };
    OFERTAS = [salvo, ...OFERTAS.filter(x => x.id !== id)];
    renderOfertas();
    toast(editandoId ? 'Oferta atualizada.' : 'Oferta salva.');
    return salvo;
  } catch (err) { $('#editor-msg').textContent = msgErro(err); return null; }
  finally { carregando(false); }
}
function depoisDeSalvar(o) {
  if ($('#f-manter').checked) {
    abrirEditor({ ...PADRAO, modelo: o.modelo, mecanica: o.mecanica, unidade: o.unidade, qtd: o.qtd, pague: o.pague, pct: o.pct,
      embalagem: o.embalagem, dataIni: o.dataIni, dataFim: o.dataFim, enquantoDurar: o.enquantoDurar, tamanho: o.tamanho, semFundo: o.semFundo, precoVermelho: o.precoVermelho });
    $('#f-manter').checked = true;
  } else $('#dlg-editor').close();
}
$('#btn-salvar').addEventListener('click', async () => { const o = await salvar(); if (o) depoisDeSalvar(o); });
$('#btn-salvar-imp').addEventListener('click', async () => {
  const o = await salvar(); if (!o) return;
  depoisDeSalvar(o);
  const modo = o.semFundo ? 'semfundo' : 'fundo';
  await criarLote([o], o.tamanho, modo, '');
  await imprimir([o], o.tamanho, modo);
});

// ---------------- Impressão ----------------
function abrirImpressao(ctx) {
  impCtx = ctx;
  const branco = ctx.tipo === 'branco', lote = ctx.tipo === 'lote';
  $('#w-imp-modelo').hidden = !branco; $('#w-imp-copias').hidden = !branco;
  $('#w-imp-modo').hidden = branco; $('#w-imp-nome').hidden = branco || lote;
  $('#imp-nome').value = '';
  if (branco) {
    $('#imp-titulo').textContent = 'Placas em branco';
    $('#imp-info').textContent = 'Imprime só o fundo da placa, sem textos. Use para mandar para a gráfica ou ter placas prontas para imprimir por cima.';
    $('#imp-copias').value = 4;
  } else {
    const itens = lote ? ctx.lote.itens : ctx.itens;
    $('#imp-titulo').textContent = lote ? `Reimprimir lote ${ctx.lote.numero}` : 'Imprimir placas';
    $('#imp-info').textContent = `${itens.length} placa(s) selecionada(s).`;
    const tams = itens.map(i => i.tamanho || 'A4');
    $('#imp-tamanho').value = lote ? ctx.lote.tamanho : tams.sort((a, b) => tams.filter(x => x === b).length - tams.filter(x => x === a).length)[0];
    $('#imp-modo').value = lote ? ctx.lote.modo : (itens.every(i => i.semFundo) ? 'semfundo' : 'fundo');
  }
  $('#dlg-imp').showModal();
}
$('#btn-imp-ok').addEventListener('click', async () => {
  const tam = $('#imp-tamanho').value;
  $('#dlg-imp').close();
  if (impCtx.tipo === 'branco') {
    const n = Math.max(1, Math.min(200, parseInt($('#imp-copias').value) || 1));
    const base = { modelo: $('#imp-modelo').value, mecanica: '02', linhas: [] };
    return imprimir(Array.from({ length: n }, () => base), tam, 'branco');
  }
  const modo = $('#imp-modo').value;
  if (impCtx.tipo === 'lote') return imprimir(impCtx.lote.itens, tam, modo);
  await criarLote(impCtx.itens, tam, modo, $('#imp-nome').value.trim());
  await imprimir(impCtx.itens, tam, modo);
});

const limpar = o => { const { id, criadoEm, atualizadoEm, ...r } = o; return r; };
async function criarLote(itens, tamanho, modo, nome) {
  try {
    const numero = LOTES.reduce((m, l) => Math.max(m, l.numero || 0), 0) + 1;
    const dados = { loja: LOJA, numero, nome, tamanho, modo, qtd: itens.length, itens: itens.map(limpar), criadoEm: serverTimestamp(), criadoPor: PERFIL.email };
    const ref = await addDoc(collection(db, 'lotes'), dados);
    LOTES.unshift({ ...dados, id: ref.id, criadoEm: Date.now() });
    renderLotes();
  } catch (err) { toast('A placa será impressa, mas o lote não foi registrado: ' + msgErro(err), true); }
}

async function imprimir(itens, tamanho, modo) {
  if (!itens.length) return;
  carregando(true);
  try {
    await fontesProntas;
    const T = TAMANHOS[tamanho] || TAMANHOS.A4;
    $('#estilo-pagina').textContent = `@page { size: ${T.pagina}; margin: 0; }`;
    const area = $('#area-impressao');
    area.innerHTML = '';
    const cls = tamanho === 'A5' ? 'c2a5 paisagem' : tamanho === 'A6' ? 'c2a6' : 'c1';
    for (let i = 0; i < itens.length; i += T.porFolha) {
      const folha = document.createElement('div');
      folha.className = 'folha ' + cls;
      area.appendChild(folha);
      for (const o of itens.slice(i, i + T.porFolha)) {
        const slot = document.createElement('div');
        folha.appendChild(slot);
        montar(slot, o, { largura: T.largura + 'mm', modo });
      }
    }
    await Promise.all([...area.querySelectorAll('img')].map(im => im.complete ? 0 : new Promise(r => { im.onload = im.onerror = r; })));
    await espera();
  } finally { carregando(false); }
  window.print();
}

// ---------------- Lotes ----------------
$('#busca-lotes').addEventListener('input', renderLotes);
function renderLotes() {
  const q = $('#busca-lotes').value.trim().toUpperCase();
  const lista = LOTES.filter(l => !q || (String(l.numero) + ' ' + (l.nome || '') + ' ' + (l.itens || []).map(descOferta).join(' ')).toUpperCase().includes(q));
  $('#tab-lotes tbody').innerHTML = lista.map(l => `<tr data-id="${l.id}">
    <td><b>${l.numero || ''}</b></td>
    <td>${esc(l.nome || '')}<br><small>${esc((l.itens || []).slice(0, 3).map(descOferta).join(' · '))}${(l.itens || []).length > 3 ? ' ...' : ''}</small></td>
    <td class="num">${l.qtd || (l.itens || []).length}</td>
    <td>${esc(l.tamanho || '')}</td>
    <td>${l.modo === 'semfundo' ? 'Sem fundo' : 'Com fundo'}</td>
    <td>${esc(dataHora(l.criadoEm))}</td>
    <td><small>${esc(l.criadoPor || '')}</small></td>
    <td class="acoes"><button class="ico imp" data-acao="imp" title="Reimprimir">🖨</button><button class="ico del" data-acao="del" title="Excluir">🗑</button></td>
  </tr>`).join('');
  $('#lotes-vazio').hidden = lista.length > 0;
}
$('#tab-lotes').addEventListener('click', async e => {
  const b = e.target.closest('[data-acao]'); if (!b) return;
  const l = LOTES.find(x => x.id === b.closest('tr').dataset.id); if (!l) return;
  if (b.dataset.acao === 'imp') abrirImpressao({ tipo: 'lote', lote: l });
  if (b.dataset.acao === 'del') {
    if (!confirm(`Excluir o lote ${l.numero}?`)) return;
    try { await deleteDoc(doc(db, 'lotes', l.id)); LOTES = LOTES.filter(x => x.id !== l.id); renderLotes(); toast('Lote excluído.'); }
    catch (err) { toast(msgErro(err), true); }
  }
});

// ---------------- Administração ----------------
let USUARIOS = [];
async function renderAdm() {
  if (!isAdm()) return;
  $('#adm-lojas').innerHTML = LOJAS.map(l => `<tr><td>${esc(l.nome)}</td><td><small>${esc(l.id)}</small></td></tr>`).join('');
  try {
    USUARIOS = (await getDocs(collection(db, 'usuarios'))).docs.map(d => ({ email: d.id, ...d.data() })).sort((a, b) => a.email.localeCompare(b.email));
  } catch (err) { toast(msgErro(err), true); return; }
  const lojaOpts = sel => LOJAS.map(l => `<option value="${l.id}" ${l.id === sel ? 'selected' : ''}>${esc(l.nome)}</option>`).join('');
  $('#adm-usuarios').innerHTML = USUARIOS.map(u => u.perfil === 'adm'
    ? `<tr><td><b>${esc(u.email)}</b></td><td>Todas</td><td>Administrador</td><td>Sim</td><td class="acoes"></td></tr>`
    : `<tr data-email="${esc(u.email)}">
        <td>${esc(u.email)}</td>
        <td><select class="u-loja">${lojaOpts(u.loja)}</select></td>
        <td>Encarregado</td>
        <td><label class="chk"><input type="checkbox" class="u-ativo" ${u.ativo ? 'checked' : ''}> ${u.ativo ? 'Ativo' : 'Bloqueado'}</label></td>
        <td class="acoes"><button class="btn contorno u-reset" title="Envia um link de troca de senha para o e-mail">Redefinir senha</button></td>
      </tr>`).join('');
}
$('#adm-usuarios').addEventListener('change', async e => {
  const tr = e.target.closest('tr[data-email]'); if (!tr) return;
  const email = tr.dataset.email;
  try {
    if (e.target.classList.contains('u-loja')) { await updateDoc(doc(db, 'usuarios', email), { loja: e.target.value }); toast('Loja do usuário atualizada.'); }
    if (e.target.classList.contains('u-ativo')) { await updateDoc(doc(db, 'usuarios', email), { ativo: e.target.checked }); toast(e.target.checked ? 'Acesso liberado.' : 'Acesso bloqueado.'); renderAdm(); }
  } catch (err) { toast(msgErro(err), true); }
});
$('#adm-usuarios').addEventListener('click', async e => {
  if (!e.target.classList.contains('u-reset')) return;
  const email = e.target.closest('tr').dataset.email;
  if (!confirm(`Enviar link de redefinição de senha para ${email}?`)) return;
  try { await sendPasswordResetEmail(auth, email); toast('Link enviado para ' + email); } catch (err) { toast(msgErro(err), true); }
});
$('#form-loja').addEventListener('submit', async e => {
  e.preventDefault();
  const nome = $('#nova-loja').value.trim(); if (!nome) return;
  const id = nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (LOJAS.some(l => l.id === id)) { toast('Essa loja já existe.', true); return; }
  try {
    await setDoc(doc(db, 'lojas', id), { nome, ordem: LOJAS.length + 1 });
    $('#nova-loja').value = '';
    await carregarLojas(); renderAdm(); toast('Loja adicionada.');
  } catch (err) { toast(msgErro(err), true); }
});
let authSec = null;
$('#form-usuario').addEventListener('submit', async e => {
  e.preventDefault();
  const email = $('#nu-email').value.trim().toLowerCase(), senha = $('#nu-senha').value, loja = $('#nu-loja').value;
  carregando(true);
  try {
    if (!authSec) authSec = initializeAuth(initializeApp(firebaseConfig, 'cadastro'), { persistence: inMemoryPersistence });
    let jaExistia = false;
    try { await createUserWithEmailAndPassword(authSec, email, senha); await signOut(authSec); }
    catch (err) { if (err.code === 'auth/email-already-in-use') jaExistia = true; else throw err; }
    await setDoc(doc(db, 'usuarios', email), { loja, perfil: 'loja', ativo: true });
    $('#form-usuario').reset();
    toast(jaExistia ? 'E-mail já tinha login: vinculado à loja.' : 'Acesso criado e vinculado à loja.');
    renderAdm();
  } catch (err) { toast(msgErro(err), true); }
  finally { carregando(false); }
});

window.addEventListener('afterprint', () => { setTimeout(() => { $('#area-impressao').innerHTML = ''; }, 500); });
