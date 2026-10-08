// Base de produtos (data/produtos.json) e busca
// Campos: c = código interno, b = código de barras, d = descrição, g = depto/seção/grupo, s = nome do grupo

export const SETORES = {
  '24': 'Padaria (industrializados)', '29': 'Hortifruti', '40': 'Produção própria', '42': 'Diversos / Kits e cestas',
  '56': 'Rotisseria / Flores', '68': 'Sushi', '69': 'Sazonal', '71': 'Insumos de confeitaria', '100': 'Mercearia',
  '101': 'Bebidas', '102': 'Limpeza', '103': 'Perfumaria', '104': 'Frios / Laticínios / Congelados', '107': 'Açougue',
  '108': 'Bazar', '109': 'Têxtil / Diversos', '110': 'Eletro', '112': 'Peixaria', '113': 'Ovos', '114': 'Vinhos',
  '115': 'Granel', '117': 'Embalagens por setor', '119': 'Açougue embalado', '120': 'Cadastro Pio XI',
};

let BASE = null, carregando = null;
const porCod = new Map(), porBar = new Map();
export const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();

export function carregar() {
  if (BASE) return Promise.resolve(BASE);
  if (carregando) return carregando;
  carregando = fetch('data/produtos.json', { cache: 'force-cache' }).then(r => r.json()).then(lista => {
    for (const p of lista) {
      p.n = norm(p.d);
      p.dep = (p.g || '').split('/')[0];
      porCod.set(p.c, p);
      if (p.b) porBar.set(p.b.replace(/^0+/, ''), p);
    }
    BASE = lista;
    return BASE;
  });
  return carregando;
}

// busca exata por código interno (com ou sem dígito) ou código de barras
export function porCodigo(q) {
  if (!BASE) return null;
  q = String(q || '').trim();
  if (!q) return null;
  if (!/^[\d\s.-]+$/.test(q)) return null;
  if (/^\d+-\d$/.test(q)) return porCod.get(q.split('-')[0]) || null;
  const d = q.replace(/\D/g, '');
  if (!d) return null;
  return porBar.get(d.replace(/^0+/, '')) || porCod.get(d) || (d.length > 1 ? porCod.get(d.slice(0, -1)) : null) || null;
}

export function buscar(q, setor = '', limite = 40) {
  if (!BASE) return [];
  q = String(q || '').trim();
  if (!q) return [];
  const res = [];
  const exato = porCodigo(q);
  if (exato && (!setor || exato.dep === setor)) res.push(exato);
  const palavras = norm(q).split(/\s+/).filter(Boolean);
  const soDigitos = /^[\d\s-]+$/.test(q);
  for (const p of BASE) {
    if (res.length >= limite) break;
    if (setor && p.dep !== setor) continue;
    if (p === exato) continue;
    if (soDigitos) {
      const d = q.replace(/\D/g, '');
      if (p.c.startsWith(d) || (p.b && p.b.includes(d))) res.push(p);
    } else if (palavras.every(w => p.n.includes(w))) res.push(p);
  }
  return res;
}
