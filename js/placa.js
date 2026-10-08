// =============================================================
//  Motor de placas SuperVille: cálculos, textos e renderização
// =============================================================

export const MODELOS = {
  oferta:   { nome: 'Oferta',            hdr: 'assets/hdr-oferta.png' },
  clube:    { nome: 'Clube Fidelidade',  hdr: 'assets/hdr-clube.png' },
  cashback: { nome: 'Cashback',          hdr: 'assets/hdr-cashback.png' },
};

export const MECANICAS = {
  '01': 'À VISTA',
  '02': 'DE POR',
  '03': 'COMPRE E PAGUE',
  '04': 'NA COMPRA DE X UNIDS.',
  '05': 'A PARTIR DE X UNIDS.',
  '06': 'PERCENTUAL DESCONTO UNIDADE',
  '07': 'LEVE GRÁTIS',
  '10': 'OFERTA PACK',
};

export const UNIDADES = ['CADA', 'UNIDADE', 'PACK', 'BANDEJA', 'FARDO', 'CAIXA', 'KG', 'LITRO',
  'METRO', 'DISPLAY', 'MAÇO', '100G', '100ML'];

export const EMBALAGENS = ['O PACK', 'A BANDEJA', 'O FARDO', 'A CAIXA', 'O DISPLAY'];

export const TAMANHOS = {
  A4: { nome: 'A4 (1 por folha)', largura: 210, porFolha: 1, pagina: 'A4 portrait', cols: 1 },
  A5: { nome: 'A5 (2 por folha)', largura: 148.5, porFolha: 2, pagina: 'A4 landscape', cols: 2 },
  A6: { nome: 'A6 (4 por folha)', largura: 105, porFolha: 4, pagina: 'A4 portrait', cols: 2 },
};

// ---------- números ----------
const n = v => {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return v;
  return parseFloat(String(v).replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')) || 0;
};
export const num = n;
const piso2 = v => Math.floor(v * 100 + 1e-6) / 100;
const red2 = v => Math.round(v * 100 + 1e-9) / 100;
export const moeda = v => red2(v).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const dataBR = s => s ? s.split('-').reverse().join('/') : '';

// ---------- conteúdo da embalagem (para preço de referência) ----------
export function lerConteudo(texto) {
  const t = ' ' + String(texto || '').toUpperCase().replace(/\s+/g, ' ') + ' ';
  let m = t.match(/C\/\s*(\d+)\s*(UN|UNID|UNIDS|UNIDADES)\b/);
  if (m) return `C/${m[1]}UN`;
  m = t.match(/(\d+(?:[.,]\d+)?)\s*(KG|KILO|G|GR|GRS|L|LT|LTS|ML)\b/);
  if (m) return `${m[1]}${m[2]}`.replace('.', ',');
  return '';
}

function referencia(conteudo, unidade) {
  // devolve {rotulo, fator} onde precoRef = preco * fator
  const u = (unidade || '').toUpperCase();
  if (u === '100G') return { rotulo: 'Preço Ref. Kg', fator: 10 };
  if (u === 'KG' || u === 'LITRO' || u === '100ML' || u === 'METRO') return null;
  const c = String(conteudo || '').toUpperCase().replace(/\s/g, '');
  let m = c.match(/^C\/(\d+)UN$/);
  if (m && +m[1] > 1) return { rotulo: 'Preço ref. 1 unidade', fator: 1 / +m[1] };
  m = c.match(/^(\d+(?:,\d+)?)(KG|KILO|G|GR|GRS|L|LT|LTS|ML)$/);
  if (!m) return null;
  const q = parseFloat(m[1].replace(',', '.'));
  if (!q) return null;
  const tipo = m[2];
  if (tipo === 'KG' || tipo === 'KILO') return q === 1 ? null : { rotulo: 'Preço Ref. 1 kg', fator: 1 / q };
  if (['G', 'GR', 'GRS'].includes(tipo)) return q === 1000 ? null : { rotulo: 'Preço Ref. 1 kg', fator: 1000 / q };
  if (['L', 'LT', 'LTS'].includes(tipo)) return q === 1 ? null : { rotulo: 'Preço Ref. 1 litro', fator: 1 / q };
  if (tipo === 'ML') return q === 1000 ? null : { rotulo: 'Preço Ref. 1 litro', fator: 1000 / q };
  return null;
}
const refTexto = (r, preco) => r && preco > 0 ? `${r.rotulo}: R$ ${moeda(preco * r.fator)}` : '';
const e100 = o => (o.unidade || '').toUpperCase() === '100G';
// no hortifruti (100g) o preço do kg vira um destaque; nos demais, linha de referência
// o preço do kg pode ter sido alterado à mão no cadastro (kgDe / kgPor)
const kgHTML = (o, preco, manual) => e100(o) && (manual > 0 || preco > 0)
  ? `<div class="kg conteudo"><span>PREÇO DO KG</span> <b>R$ ${moeda(manual > 0 ? manual : preco * 10)}</b></div>` : '';
const refOuKg = (o, ref, preco) => e100(o) ? '' : refTexto(ref, preco);

const unTexto = u => {
  u = (u || 'UNIDADE').toUpperCase();
  return u === 'UNIDADE' ? 'UNI' : u;
};

// ---------- cálculos por mecânica ----------
export function calcular(o) {
  const de = n(o.de), por = n(o.por), qtd = Math.max(1, parseInt(o.qtd) || 1),
        pague = Math.max(1, parseInt(o.pague) || 1), pct = n(o.pct), cb = n(o.cashback);
  const r = { regular: de, promo: null, economia: null, total: null, erro: '' };
  switch (o.modelo === 'cashback' ? 'cb' : o.mecanica) {
    case '01': r.promo = null; break;
    case '02': r.promo = por; if (por >= de && de) r.erro = 'O preço "Por" deve ser menor que o "De".'; break;
    case '03':
      if (pague >= qtd) r.erro = 'O "Pague" deve ser menor que o "Compre".';
      r.promo = piso2(de * pague / qtd); break;
    case '04': case '05':
      r.promo = por; if (por >= de && de) r.erro = 'O preço promocional deve ser menor que o regular.'; break;
    case '06':
      if (qtd < 2) r.erro = 'O desconto vale a partir de 2 unidades.';
      r.promo = piso2((de * (qtd - 1) + de * (1 - pct / 100)) / qtd); break;
    case '07': r.promo = null; break;
    case '10': r.total = red2(de * qtd); break;
    case 'cb': r.promo = null; break;
  }
  if (r.promo !== null && de > 0 && r.promo > 0 && r.promo < de) r.economia = red2(de - r.promo);
  return r;
}

export function validadeTexto(o) {
  if (o.enquantoDurar) return 'Oferta válida enquanto durarem os estoques';
  if (o.dataIni && o.dataFim) return `Oferta válida de ${dataBR(o.dataIni)} a ${dataBR(o.dataFim)}`;
  if (o.dataFim) return `Oferta válida até ${dataBR(o.dataFim)}`;
  return '';
}

// ---------- descrição humanizada ----------
const ABREV = [
  [/\bCHOC\b\.?/g, 'CHOCOLATE'], [/\bBCO\b/g, 'BRANCO'], [/\bTRAD\b\.?/g, 'TRADICIONAL'],
  [/\bINTEG\b\.?/g, 'INTEGRAL'], [/\bREFRIG\b\.?/g, 'REFRIGERANTE'], [/\bREF\b\.?/g, 'REFRIGERANTE'],
  [/\bCERV\b\.?/g, 'CERVEJA'], [/\bQJ\b\.?/g, 'QUEIJO'], [/\bBISC\b\.?/g, 'BISCOITO'],
  [/\bACUCAR\b/g, 'AÇÚCAR'], [/\bACUC\b\.?/g, 'AÇÚCAR'], [/\bCAFE\b/g, 'CAFÉ'], [/\bLIMAO\b/g, 'LIMÃO'],
  [/\bPAO\b/g, 'PÃO'], [/\bFEIJAO\b/g, 'FEIJÃO'], [/\bLIQ\b\.?/g, 'LÍQUIDO'], [/\bLIQUIDO\b/g, 'LÍQUIDO'],
  [/\bDET\b\.?/g, 'DETERGENTE'], [/\bAMAC\b\.?/g, 'AMACIANTE'], [/\bDESOD\b\.?/g, 'DESODORANTE'],
  [/\bSAB\b\.?/g, 'SABONETE'], [/\bSHAMP\b\.?/g, 'SHAMPOO'], [/\bCOND\b\.?/g, 'CONDICIONADOR'],
  [/\bPCT\b\.?/g, 'PACOTE'], [/\bGAS\b/g, 'GÁS'], [/\bS[./]\s?GLUTEN\b/g, 'SEM GLÚTEN'], [/\bGLUTEN\b/g, 'GLÚTEN'],
  [/\bS[./]\s?LACTOSE\b/g, 'SEM LACTOSE'], [/\bZ[./]\s?ACUCAR\b/g, 'ZERO AÇÚCAR'], [/\bS[./]\s?ACUCAR\b/g, 'SEM AÇÚCAR'],
  [/\bS\/\s?OSSO\b/g, 'SEM OSSO'], [/\bC\/\s?OSSO\b/g, 'COM OSSO'], [/\bTEMP\b\.?/g, 'TEMPERADO'],
  [/\bAGUA\b/g, 'ÁGUA'], [/(^|\s)ÁGUA MIN\b\.?/g, '$1ÁGUA MINERAL'], [/\bMACA\b/g, 'MAÇÃ'],
  [/\bMAMAO\b/g, 'MAMÃO'], [/\bMELAO\b/g, 'MELÃO'], [/\bLIMPADOR\b/g, 'LIMPADOR'], [/\bPROT\b\.?/g, 'PROTEÍNA'],
  [/\bAVELA\b/g, 'AVELÃ'], [/\bPESSEGO\b/g, 'PÊSSEGO'], [/\bMARACUJA\b/g, 'MARACUJÁ'], [/\bACAI\b/g, 'AÇAÍ'],
  [/\bCAMARAO\b/g, 'CAMARÃO'], [/\bSALMAO\b/g, 'SALMÃO'], [/\bLINGUICA\b/g, 'LINGUIÇA'], [/\bFILE\b/g, 'FILÉ'],
  [/\bPURE\b/g, 'PURÊ'], [/\bGRAOS\b/g, 'GRÃOS'], [/\bGRAO\b/g, 'GRÃO'], [/\bFRANCES\b/g, 'FRANCÊS'],
  [/\bSUCO\b/g, 'SUCO'], [/\bVEG\b\.?/g, 'VEGETAL'], [/\bNAT\b\.?/g, 'NATURAL'], [/\bORIG\b\.?/g, 'ORIGINAL'], [/\bS\.FREE\b/g, 'SUGAR FREE'], [/\bLT\b/g, 'LATA'], [/\bTACA\b/g, 'TAÇA'], [/\bTACAS\b/g, 'TAÇAS'], [/\bS\/GLUT\b/g, 'SEM GLÚTEN'], [/\bTP\b/g, 'TETRA PAK'],
];
export function humanizar(desc) {
  let d = ' ' + String(desc || '').toUpperCase().replace(/\s+/g, ' ').trim() + ' ';
  for (const [re, s] of ABREV) d = d.replace(re, s);
  d = d.replace(/\bS\/\s?/g, 'SEM ').replace(/\bC\/(?!\s?\d)\s?/g, 'COM ');
  d = d.replace(/(\d)\s*(ML|L|G|KG|GR)\b/g, '$1$2');
  return d.replace(/\s+/g, ' ').trim();
}
// divide em até 3 linhas: tipo / marca / complemento
export function dividirLinhas(desc) {
  let h = humanizar(desc);
  // conteúdo (250G, 1,5L, C/2UN...) vai para o fim da descrição
  const re = /\s(\d+(?:[.,]\d+)?(?:KG|G|GR|ML|L|LT|M)|C\/\d+\s?UN)\b/;
  const m = (' ' + h).match(re);
  if (m) h = ((' ' + h).replace(m[0], '') + ' ' + m[1]).trim();
  const w = h.split(' ').filter(Boolean);
  if (w.length <= 1) return [w[0] || '', '', ''];
  if (w.length === 2) return [w[0], w[1], ''];
  return [w[0], w[1], w.slice(2).join(' ')];
}

// ---------- HTML ----------
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function precoHTML(valor, unidade, extra = '') {
  const [i, c] = moeda(valor || 0).split(',');
  return `<div class="preco ${extra}"><span class="rs">R$</span><span class="int">${i}</span>` +
    `<span class="dir"><span class="cent">,${c}</span><span class="un ${unidade === '100G' ? 'b' : ''}">${esc(unTexto(unidade))}</span></span></div>`;
}

function descHTML(o) {
  const ls = (o.linhas || []).map(s => String(s || '').trim()).filter(Boolean);
  const cada = e100(o) ? `<div class="ln cada">A CADA 100G</div>` : '';
  return `<div class="desc conteudo"><div class="fit">${ls.map(l => `<div class="ln">${esc(l.toUpperCase())}</div>`).join('')}${cada}</div></div>`;
}

// código de barras/interno não aparece mais na placa (decisão: placa limpa, igual às artes do Canva)
function barrasHTML(o) {
  return '';
  return `<div class="cod conteudo">${o.barras ? `<svg class="bc" data-code="${esc(o.barras)}"></svg>` : ''}` +
    `<div class="codtxt">${esc(o.codigo || '')}</div></div>`;
}

const tituloCor = o => o.modelo === 'clube'
  ? `<div class="titulo t2 conteudo">OFERTA EXCLUSIVA<br>CLUBE DE FIDELIDADE</div>`
  : `<div class="titulo t1 conteudo">PROMOÇÃO</div>`;

function rodape(linhas, cls = '') {
  const ls = linhas.filter(Boolean);
  return ls.length ? `<div class="rodape conteudo ${cls}">${ls.map(l => `<div>${l}</div>`).join('')}</div>` : '';
}

function seloTexto(o, r) {
  const q = Math.max(1, parseInt(o.qtd) || 1), p = Math.max(1, parseInt(o.pague) || 1);
  switch (o.mecanica) {
    case '03': return `<span class="sm">COMPRE</span>&nbsp;<b>${q}</b><br><span class="sm">PAGUE</span>&nbsp;<b>${p}</b>`;
    case '04': return `<span class="sm">NA COMPRA DE</span><br><b>${q}</b> <span class="sm">${q > 1 ? 'UNIDADES' : 'UNIDADE'}</span>`;
    case '05': return `<span class="sm">A PARTIR DE</span><br><b>${q}</b> <span class="sm">${q > 1 ? 'UNIDADES' : 'UNIDADE'}</span>`;
    case '06': return `<span class="xs">COMPRE ${q} E PAGUE A ${q}ª COM</span><br><b>${String(n(o.pct)).replace('.', ',')}%</b> <span class="sm">DE<br>DESCONTO</span>`;
    case '07': return `<span class="sm">NA COMPRA DE</span><br><b>${q}</b> <span class="sm">${q > 1 ? 'UNIDADES' : 'UNIDADE'}</span>`;
  }
  return '';
}

export function htmlPlaca(o, modo = 'fundo') {
  const m = MODELOS[o.modelo] ? o.modelo : 'oferta';
  const r = calcular(o);
  const ref = referencia(o.conteudo, o.unidade);
  const val = validadeTexto(o);
  const venc = o.proxVenc ? '<b>PRODUTO PRÓXIMO DO VENCIMENTO</b>' : '';
  const un = (o.unidade || 'UNIDADE').toUpperCase();
  const mec = m === 'cashback' ? 'cb' : (o.mecanica || '02');
  let branca = '', cor = '', layout = '';

  if (mec === 'cb') {
    layout = 'l-cb';
    branca = barrasHTML(o) + descHTML(o) +
      `<div class="linha conteudo"><div class="rot"><span class="lt">Preço<br>regular</span></div>${precoHTML(r.regular, un)}</div>` +
      kgHTML(o, r.regular, n(o.kgDe)) + rodape([refOuKg(o, ref, r.regular)], 'ref');
    cor = `<div class="titulo t2 conteudo">CLUBE FIDELIDADE<br>CASHBACK EXCLUSIVO DE:</div>` +
      `<div class="linha conteudo"><div class="rot cb"><span class="sb">Valor do<br>cashback</span></div>${precoHTML(n(o.cashback), un, 'big')}</div>` +
      rodape([val, 'O cashback EXPIRA em 30 dias após a data da compra', venc], 'centro bold');
  } else if (mec === '01') {
    layout = 'l-avista';
    branca = barrasHTML(o) + descHTML(o) +
      (m === 'clube' ? `<div class="clubetag conteudo">OFERTA EXCLUSIVA CLUBE DE FIDELIDADE</div>` : '') +
      `<div class="linha grande conteudo">${precoHTML(r.regular, un)}</div>` +
      kgHTML(o, r.regular, n(o.kgDe)) + rodape([refOuKg(o, ref, r.regular), val, venc]);
  } else if (mec === '02') {
    layout = 'l-depor';
    branca = barrasHTML(o) + descHTML(o) +
      `<div class="linha conteudo"><div class="rot"><span class="bd">De:</span><span class="lt">Preço<br>regular</span></div>${precoHTML(r.regular, un)}</div>` +
      kgHTML(o, r.regular, n(o.kgDe)) + rodape([refOuKg(o, ref, r.regular)], 'ref');
    cor = tituloCor(o) +
      `<div class="linha conteudo"><div class="rot"><span class="bd">Por:</span><span class="lt">Preço com<br>desconto</span></div>${precoHTML(r.promo, un, 'big')}</div>` +
      kgHTML(o, r.promo, n(o.kgPor)) + rodape([refOuKg(o, ref, r.promo), r.economia ? `Nessa promoção você economiza: R$ ${moeda(r.economia)}` : '', val, venc]);
  } else if (['03', '04', '05', '06'].includes(mec)) {
    layout = 'l-selo';
    branca = barrasHTML(o) + descHTML(o) +
      `<div class="linha conteudo"><div class="rot"><span class="lt">Preço<br>regular</span></div>${precoHTML(r.regular, un, 'med')}<div class="selo">${seloTexto(o, r)}</div></div>` +
      rodape([refTexto(ref, r.regular)], 'ref');
    cor = tituloCor(o) +
      `<div class="chamada conteudo">Nessa promoção a unidade sai por:</div>` +
      `<div class="linha conteudo">${precoHTML(r.promo, un, 'big')}</div>` +
      rodape([refTexto(ref, r.promo), r.economia ? `Nessa promoção você economiza: R$ ${moeda(r.economia)} por unidade` : '', val, venc]);
  } else if (mec === '07') {
    layout = 'l-leve';
    const bl = (o.brindeDesc || '').toUpperCase();
    branca = barrasHTML(o) + descHTML(o) +
      `<div class="linha conteudo"><div class="rot"><span class="lt">Preço<br>regular</span></div>${precoHTML(r.regular, un, 'med')}<div class="selo">${seloTexto(o, r)}</div></div>` +
      rodape([refTexto(ref, r.regular)], 'ref');
    cor = tituloCor(o) +
      `<div class="leve conteudo"><span class="mais">+ R$ 0,01</span> <span class="lv">LEVE:</span></div>` +
      `<div class="brinde conteudo"><div class="fit"><div class="ln">${esc(bl)}</div></div></div>` +
      rodape([val, venc]);
  } else if (mec === '10') {
    layout = 'l-pack';
    const emb = (o.embalagem || 'A CAIXA').toUpperCase();
    const q = Math.max(1, parseInt(o.qtd) || 1);
    branca = barrasHTML(o) + descHTML(o) +
      `<div class="linha conteudo"><div class="rot"><span class="lt">Preço da<br>unidade</span></div>${precoHTML(r.regular, un)}</div>` +
      rodape([refTexto(ref, r.regular)], 'ref');
    cor = tituloCor(o) +
      `<div class="chamada conteudo">${esc(emb)} C/ ${q} UNIDS. SAI POR:</div>` +
      `<div class="linha conteudo">${precoHTML(r.total, emb.replace(/^(O|A) /, ''), 'big')}</div>` +
      rodape([val, venc]);
  }

  return `<div class="placa m-${m} ${layout} modo-${modo}${e100(o) ? ' u100' : ''}${o.precoVermelho !== false ? ' preco-vermelho' : ''}">` +
    `<img class="hdr" src="${MODELOS[m].hdr}" alt="">` +
    `<div class="corpo"><div class="cx-branca">${branca}</div>` +
    (cor ? `<div class="cx-cor">${cor}${m === 'clube' ? '<img class="mini" src="assets/soumais-mini.png" alt="">' : ''}</div>` : '') +
    `</div></div>`;
}

// ---------- ajuste automático de tamanho de fonte ----------
function cabe(el, box, soLargura) {
  if (el.scrollWidth > el.clientWidth + 1) return false;
  if (soLargura) return true;
  box = box || el;
  // tolerância para acentos (Ã, Ç) que passam um pouco da altura da linha
  const tol = Math.max(3, parseFloat(getComputedStyle(el).fontSize) * 0.12);
  return box.scrollHeight <= box.clientHeight + tol && el.scrollHeight <= el.clientHeight + tol;
}
// el = elemento cuja fonte muda; box = caixa de layout que não pode transbordar
function encolher(el, max, min, passo = 0.05, box, soLargura = false) {
  let s = max; el.style.fontSize = s + 'em';
  while (s > min && !cabe(el, box, soLargura)) { s = Math.round((s - passo) * 1000) / 1000; el.style.fontSize = s + 'em'; }
}

export function ajustar(placa) {
  placa.querySelectorAll('.desc').forEach(d => {
    const u100 = placa.classList.contains('u100'), av = placa.classList.contains('l-avista');
    const max = av ? (u100 ? 10 : 8) : (u100 ? 7.4 : 6.2);
    encolher(d.querySelector('.fit'), max, 2.2, 0.1, d);
  });
  placa.querySelectorAll('.brinde').forEach(d => encolher(d.querySelector('.fit'), 6.4, 2.2, 0.1, d));
  placa.querySelectorAll('.kg').forEach(t => encolher(t, placa.classList.contains('l-avista') ? 4.6 : 4, 2.4, 0.05, null, true));
  const dp = placa.classList.contains('l-depor');
  placa.querySelectorAll('.titulo').forEach(t => encolher(t, t.classList.contains('t1') ? (dp ? 9.6 : 11) : (dp ? 6 : 6.6), 3, 0.1, null, true));
  placa.querySelectorAll('.rodape').forEach(t => encolher(t, t.classList.contains('bold') ? 3.1 : (dp && t.closest('.cx-cor') ? 2.5 : (placa.classList.contains('m-clube') && t.closest('.cx-cor') ? 2.6 : 2.9)), 1.6, 0.05));
  placa.querySelectorAll('.chamada').forEach(t => encolher(t, 4, 2, 0.05, null, true));
  // a linha de preço por último: ocupa o espaço que sobrou
  // De/Por e cashback: 3 colunas — rótulo (De:/Por:) à esquerda, preço centralizado e unidade à direita.
  // Rótulo e unidade têm tamanho e posição fixos (escala inversa), só o preço muda de tamanho, e os dois
  // preços usam a mesma escala para ficarem proporcionais.
  const colunas = placa.classList.contains('l-depor') || placa.classList.contains('l-cb');
  const linhas = [...placa.querySelectorAll('.linha')];
  const escalas = linhas.map(l => {
    const rot = colunas && l.querySelector('.rot');
    let ucol = colunas && l.querySelector('.ucol');
    if (colunas && !ucol) {
      ucol = document.createElement('div'); ucol.className = 'ucol';
      const un = l.querySelector('.preco .un'); if (un) ucol.appendChild(un);
      l.appendChild(ucol);
    }
    const aplica = v => {
      l.style.fontSize = v + 'em';
      if (rot) rot.style.fontSize = (1 / v) + 'em';
      if (ucol) ucol.style.fontSize = (1 / v) + 'em';
    };
    // mede pelos retângulos dos filhos (a fonte grande tem área interna maior que a linha visível)
    const ok = () => {
      const H = l.clientHeight, W = l.clientWidth;
      let alt = 0;
      for (const c of l.children) alt = Math.max(alt, c.getBoundingClientRect().height);
      return alt <= H + 1 && l.scrollWidth <= W + 1;
    };
    let s = 1; aplica(1);
    while (s > 0.3 && !ok()) { s = Math.round((s - 0.02) * 1000) / 1000; aplica(s); }
    l._aplica = aplica;
    return s;
  });
  // o preço de cima (De / regular) nunca fica proporcionalmente maior que o de baixo (Por / cashback),
  // mas o de baixo não diminui por causa do de cima
  if (colunas && linhas.length > 1) {
    const ult = escalas.length - 1;
    linhas.forEach((l, i) => { if (i < ult) l._aplica(Math.min(escalas[i], escalas[ult])); });
  }
  placa.querySelectorAll('svg.bc').forEach(svg => {
    if (svg.dataset.ok || !window.JsBarcode) return;
    const code = svg.dataset.code;
    const ean = /^\d{13}$/.test(code) && eanOk(code);
    try {
      window.JsBarcode(svg, code, { format: ean ? 'EAN13' : 'CODE128', displayValue: false, margin: 0, height: 40, width: 1.4 });
      svg.removeAttribute('width'); svg.removeAttribute('height');
      svg.dataset.ok = 1;
    } catch (e) { svg.remove(); }
  });
}
function eanOk(c) {
  const d = c.split('').map(Number); const s = d.slice(0, 12).reduce((a, x, i) => a + x * (i % 2 ? 3 : 1), 0);
  return (10 - s % 10) % 10 === d[12];
}

// cria a placa num container, com largura em mm ou px
export function montar(container, o, { largura = '210mm', modo = 'fundo' } = {}) {
  container.innerHTML = htmlPlaca(o, modo);
  const el = container.firstElementChild;
  el.style.setProperty('--w', largura);
  ajustar(el);
  return el;
}
