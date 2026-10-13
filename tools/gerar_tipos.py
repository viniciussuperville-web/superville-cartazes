# Gera js/tipos.js a partir da base data/produtos.json
#  - TIPOS: "o que é o produto" (abreviação da base -> texto da placa). Lista curada à mão.
#  - MARCAS: marcas com mais de uma palavra (TIO JOAO, 3 CORACOES, DEL VALLE...), detectadas na base.
# Uso: python3 tools/gerar_tipos.py
import json, re, collections, os

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# prefixo da descrição na base -> primeira linha da placa
TIPOS = {
  # compostos (testados primeiro, do mais longo para o mais curto)
  'AGUA MIN': 'ÁGUA MINERAL', 'AGUA MINERAL': 'ÁGUA MINERAL', 'AGUA COCO': 'ÁGUA DE COCO', 'AGUA DE COCO': 'ÁGUA DE COCO',
  'AGUA TONICA': 'ÁGUA TÔNICA', 'AGUA SANIT': 'ÁGUA SANITÁRIA',
  'SAB LIQ': 'SABONETE LÍQUIDO', 'SAB INF': 'SABONETE INFANTIL', 'SABAO PO': 'SABÃO EM PÓ', 'SABAO LIQ': 'SABÃO LÍQUIDO',
  'SABAO PEDRA': 'SABÃO EM PEDRA', 'SABAO PASTA': 'SABÃO EM PASTA', 'SABAO BARRA': 'SABÃO EM BARRA',
  'CAPSULA CAFE': 'CÁPSULA DE CAFÉ', 'CAPSULA CHA': 'CÁPSULA DE CHÁ', 'CAPS': 'CÁPSULA DE CAFÉ', 'CAPSULA': 'CÁPSULA',
  'MIST BOLO': 'MISTURA PARA BOLO', 'MIST P/BOLO': 'MISTURA PARA BOLO', 'MIST PAO': 'MISTURA PARA PÃO',
  'MOLHO TOM': 'MOLHO DE TOMATE', 'MOLHO SALADA': 'MOLHO PARA SALADA', 'MOLHO SOJA': 'MOLHO DE SOJA',
  'MOLHO SHOYU': 'MOLHO SHOYU', 'MOLHO PIM': 'MOLHO DE PIMENTA', 'MOLHO INGLES': 'MOLHO INGLÊS',
  'EXTRATO TOM': 'EXTRATO DE TOMATE', 'TOMATE PELADO': 'TOMATE PELADO',
  'GUARDANAPO PAP': 'GUARDANAPO DE PAPEL', 'PAPEL HIG': 'PAPEL HIGIÊNICO', 'PAPEL TOALHA': 'PAPEL TOALHA',
  'MAC INST': 'MACARRÃO INSTANTÂNEO', 'MAC ESPEC': 'MACARRÃO', 'MAC ESP': 'MACARRÃO', 'MAC GD': 'MACARRÃO',
  'LEITE PO': 'LEITE EM PÓ', 'LEITE COND': 'LEITE CONDENSADO', 'LEITE COCO': 'LEITE DE COCO', 'LEITE FERM': 'LEITE FERMENTADO',
  'CREME LEITE': 'CREME DE LEITE', 'CREME DE LEITE': 'CREME DE LEITE', 'CREME PENT': 'CREME DE PENTEAR',
  'CREME PENTEAR': 'CREME DE PENTEAR', 'CREME TRAT': 'CREME DE TRATAMENTO', 'CREME AVELA': 'CREME DE AVELÃ',
  'CREME RICOTA': 'CREME DE RICOTA', 'CREAM CHEESE': 'CREAM CHEESE', 'DOCE LEITE': 'DOCE DE LEITE',
  'ESC DENTAL': 'ESCOVA DENTAL', 'CD': 'CREME DENTAL', 'FIO DENTAL': 'FIO DENTAL',
  'POLPA FRUTA': 'POLPA DE FRUTA', 'BISC RECH': 'BISCOITO RECHEADO', 'BISC WAFER': 'BISCOITO WAFER',
  'TIRA MANCHAS': 'TIRA MANCHAS', 'FARINHA TRIGO': 'FARINHA DE TRIGO', 'FARINHA MAND': 'FARINHA DE MANDIOCA',
  'LAVA ROUPA': 'LAVA ROUPAS', 'LAVA ROUPAS': 'LAVA ROUPAS', 'LAVA LOUCA': 'LAVA LOUÇAS', 'LAVA LOUCAS': 'LAVA LOUÇAS',
  'PAO QJ': 'PÃO DE QUEIJO', 'PAO DE QUEIJO': 'PÃO DE QUEIJO', 'PAO DE FORMA': 'PÃO DE FORMA', 'PAO DE MEL': 'PÃO DE MEL',
  'PAO DE ALHO': 'PÃO DE ALHO', 'PAO DE HAMBURGUER': 'PÃO DE HAMBÚRGUER', 'PAO DE HOT': 'PÃO DE HOT DOG',
  'LIMP CASA': 'LIMPADOR', 'LIMP PERF': 'LIMPADOR PERFUMADO', 'LIMP VIDROS': 'LIMPA VIDROS',
  'BEB LACT': 'BEBIDA LÁCTEA', 'BEB LACTEA': 'BEBIDA LÁCTEA', 'BEB LAC': 'BEBIDA LÁCTEA', 'BEB MISTA': 'BEBIDA MISTA',
  'BEB MIST': 'BEBIDA MISTA', 'BEB A BASE SOJA': 'BEBIDA DE SOJA', 'BEB NOT': 'BEBIDA VEGETAL', 'BEB': 'BEBIDA',
  'DET LIQ': 'DETERGENTE', 'DET': 'DETERGENTE', 'BATATA DOCE': 'BATATA DOCE', 'BATATA CHIPS': 'BATATA CHIPS',
  'MILHO VERDE': 'MILHO VERDE', 'PRATO SOBREMESA': 'PRATO DE SOBREMESA', 'PRATO RASO': 'PRATO RASO',
  'PEITO FRANGO': 'PEITO DE FRANGO', 'FILE PEITO': 'FILÉ DE PEITO', 'FILE TILAPIA': 'FILÉ DE TILÁPIA',
  'FILE MIGNON': 'FILÉ MIGNON', 'FILET MIGNON': 'FILÉ MIGNON', 'CONTRA FILE': 'CONTRAFILÉ', 'CARNE SECA': 'CARNE SECA',
  'PASTA AMEND': 'PASTA DE AMENDOIM', 'LUSTRA MOVEL': 'LUSTRA MÓVEIS', 'PIPOCA MICRO': 'PIPOCA DE MICRO-ONDAS',
  'BARRA PROT': 'BARRA DE PROTEÍNA', 'BARRA PROT.': 'BARRA DE PROTEÍNA', 'BARRA CEREAL': 'BARRA DE CEREAL',
  'ALIM SOJA': 'ALIMENTO DE SOJA', 'CASTANHA CAJU': 'CASTANHA DE CAJU', 'CASTANHA PARA': 'CASTANHA DO PARÁ',
  'SNACK ARROZ': 'SNACK DE ARROZ', 'VINHO TINTO': 'VINHO TINTO', 'VINHO BRANCO': 'VINHO BRANCO', 'VINHO ROSE': 'VINHO ROSÉ',
  'ALFACE CRESPA': 'ALFACE CRESPA', 'ALFACE AMERICANA': 'ALFACE AMERICANA', 'ALFACE LISA': 'ALFACE LISA',
  'ALFACE ROMANA': 'ALFACE ROMANA', 'TOMATE GRAPE': 'TOMATE GRAPE', 'TOMATE ITALIANO': 'TOMATE ITALIANO',
  'CHOC RECH': 'CHOCOLATE RECHEADO', 'MASC TRAT': 'MÁSCARA DE TRATAMENTO', 'SACO LIXO': 'SACO PARA LIXO',
  'SACO PAO': 'SACO PARA PÃO', 'COUVE FLOR': 'COUVE-FLOR', 'REPOLHO VERDE': 'REPOLHO VERDE', 'ALHO DESCASCADO': 'ALHO DESCASCADO',
  'ABOBRINHA ITALIANA': 'ABOBRINHA ITALIANA', 'QJ RALADO': 'QUEIJO RALADO', 'COCO RALADO': 'COCO RALADO',
  'AZ VERDE': 'AZEITONA VERDE', 'AZ VERDES': 'AZEITONA VERDE', 'AZ PRETA': 'AZEITONA PRETA', 'PRE TREINO': 'PRÉ-TREINO',
  'COPO DESC': 'COPO DESCARTÁVEL', 'ESPETO CHURRA': 'ESPETO DE CHURRASCO', 'PE DE MOLEQUE': 'PÉ DE MOLEQUE',
  'MACA GALA': 'MAÇÃ GALA', 'MACA FUJI': 'MAÇÃ FUJI', 'DESINF PINHO': 'DESINFETANTE', 'EVITA MOFO': 'EVITA MOFO',
  'TIC TAC': 'BALA', 'MINI LANCHE': 'MINI LANCHE', 'OLEO COCO': 'ÓLEO DE COCO', 'MOLHO DE TOMATE': 'MOLHO DE TOMATE',
  'AZEITE OLIVA': 'AZEITE DE OLIVA', 'AZEITE EXTRA VIRGEM': 'AZEITE EXTRA VIRGEM', 'LINGUICA TOSCANA': 'LINGUIÇA TOSCANA',
  'LING TOSCANA': 'LINGUIÇA TOSCANA', 'LING CALABRESA': 'LINGUIÇA CALABRESA', 'CAFE SOLUVEL': 'CAFÉ SOLÚVEL',
  'CAFE CAPSULA': 'CÁPSULA DE CAFÉ', 'SUCO NATURAL': 'SUCO NATURAL', 'SUCO INTEGRAL': 'SUCO INTEGRAL',
  # palavra única
  'IOG': 'IOGURTE', 'BISC': 'BISCOITO', 'CHOC': 'CHOCOLATE', 'QJ': 'QUEIJO', 'MAC': 'MACARRÃO', 'TEMP': 'TEMPERO',
  'CERV': 'CERVEJA', 'PAO': 'PÃO', 'SAB': 'SABONETE', 'CAFE': 'CAFÉ', 'CHA': 'CHÁ', 'LIMP': 'LIMPADOR', 'LING': 'LINGUIÇA',
  'DES': 'DESODORANTE', 'DESOD': 'DESODORANTE', 'AGUA': 'ÁGUA', 'ESPUM': 'ESPUMANTE', 'SORV': 'SORVETE',
  'REFRIG': 'REFRIGERANTE', 'REFR': 'REFRESCO', 'SH': 'SHAMPOO', 'FILE': 'FILÉ', 'AMAC': 'AMACIANTE', 'SABAO': 'SABÃO',
  'MIST': 'MISTURA', 'SALG': 'SALGADINHO', 'DESINF': 'DESINFETANTE', 'AZ': 'AZEITONA', 'REQ': 'REQUEIJÃO',
  'COND': 'CONDICIONADOR', 'HAMB': 'HAMBÚRGUER', 'PANET': 'PANETONE', 'CACHACA': 'CACHAÇA', 'RACAO': 'RAÇÃO',
  'FEIJAO': 'FEIJÃO', 'ABS': 'ABSORVENTE', 'INSET': 'INSETICIDA', 'ADOC': 'ADOÇANTE', 'ENERG': 'ENERGÉTICO',
  'ENERGET': 'ENERGÉTICO', 'ACHOC': 'ACHOCOLATADO', 'MARG': 'MARGARINA', 'OLEO': 'ÓLEO', 'PATE': 'PATÊ',
  'CAMARAO': 'CAMARÃO', 'ACUCAR': 'AÇÚCAR', 'PIMENTAO': 'PIMENTÃO', 'MACA': 'MAÇÃ', 'LIMAO': 'LIMÃO',
  'MAMAO': 'MAMÃO', 'MELAO': 'MELÃO', 'PESSEGO': 'PÊSSEGO', 'MARACUJA': 'MARACUJÁ', 'SALMAO': 'SALMÃO',
  'CHIC.': 'CHICLETE', 'CHIC': 'CHICLETE', 'CHAMP': 'CHAMPANHE', 'BOMBOM': 'BOMBOM', 'CONFEITO': 'CONFEITO',
  'GELEIA': 'GELEIA', 'CHAMPIGNON': 'CHAMPIGNON', 'GRANOLA': 'GRANOLA', 'PALETA': 'PALETA', 'SAND': 'SANDÁLIA',
  'ENERG.': 'ENERGÉTICO', 'MANTEIGA': 'MANTEIGA', 'SALSICHA': 'SALSICHA', 'LINGUICA': 'LINGUIÇA',
  'PURE': 'PURÊ', 'GRAO': 'GRÃO', 'CORACAO': 'CORAÇÃO', 'SUCO': 'SUCO', 'VINHO': 'VINHO', 'ACAI': 'AÇAÍ',
}

# marcas que a detecção automática não pega (começam com número ou aparecem às vezes abreviadas)
EXTRAS = {'3 CORACOES', 'KIT KAT', 'COCA COLA', 'DEL VALLE', 'JOHNNIE WALKER', 'LA MOLISANA', 'LA PASTINA', 'CASILLERO DEL DIABLO',
          'CONCHA Y TORO', 'SANTA HELENA', 'SANTA CAROLINA', 'DR OETKER', 'DR. OETKER', 'MR MUSCULO', 'RED BULL', 'CLUB SOCIAL',
          'BIS XTRA', 'SONHO DE VALSA', 'OURO BRANCO', 'LEITE MOCA', 'MOCA', 'TIO JOAO', 'ANA MARIA', 'MAIS VITA', 'BOA SAFRA',
          'CASA SUICA', 'LA SERENISSIMA', 'BAUDUCCO', 'QUALY', 'FORNO DE MINAS', 'SADIA', 'SEARA', 'AURORA', 'DEL MONTE',
          'JACK DANIELS', 'CHIVAS REGAL', 'BLACK & WHITE', 'WHITE HORSE', 'STELLA ARTOIS', 'BUDWEISER', 'PEPSI BLACK', 'H2OH',
          'CAFE DO PONTO', 'CAFE PELE', '3 CORACOES', 'MELITTA', 'ITALAC', 'SAO BRAZ', 'VILLA PIVA', 'SAO JOSE'}
SIZE = re.compile(r'^(\d+([.,]\d+)?(KG|G|GR|GRS|ML|L|LT|M|UN|UNID|CM|MM|W|V|X)?|C/\d+.*|\d+X\d+.*|\d[\d.,]*[A-Z]{0,4})$')
PEQ = {'DE', 'DO', 'DA', 'DOS', 'DAS', 'DEL', 'LA', 'E', 'A', 'O', 'NA', 'NO', 'C/', 'P/', 'EM', 'COM', 'SEM', 'DI', 'DU'}
CONECT = {'LA', 'LE', 'DEL', 'EL', 'LOS', 'LAS', 'SAN', 'SANTA', 'SAO', 'ST', 'DON', 'DONA',
          'TIO', 'TIA', 'DR', 'DR.', 'MR', 'MR.', 'CASA', 'VILLA', 'BOM', 'BELLA', 'MONTE', 'CANTINA', 'QUINTA', 'Q.DO',
          'MAE', 'VO', 'VOVO', 'SITIO', 'MUNDO', 'TERRA', 'IL', 'I', 'DI', 'B.DI', 'MC', 'MAT.', 'BIO', 'GRAN', 'CHATEAU'}
PAISES = re.compile(r'^(CHIL|ARG|PORT|ITAL|ESP|BR|FRANC|FRAN|FR|URUG|AFR|AUST|AUS|NZ|USA|ALEM|ALE)\.?')


def tokens(d):
    return re.sub(r'\s+', ' ', d.upper()).strip().split(' ')


def tipo(t):
    k = 1
    for n in (4, 3, 2, 1):
        if len(t) > n and ' '.join(t[:n]) in TIPOS:
            k = n; break
    # "SUCO DE LARANJA", "FILE DE PEITO": o complemento com DE/DO/DA faz parte do tipo
    if k == 1 and len(t) > k + 1 and t[k] in ('DE', 'DO', 'DA', 'P/', 'EM') and not SIZE.match(t[k + 1]):
        k += 2
    return k


def main():
    P = json.load(open(os.path.join(RAIZ, 'data/produtos.json')))
    ini = collections.Counter(); par = collections.Counter(); tri = collections.Counter()
    for p in P:
        t = tokens(p['d'])
        if t and t[0] == 'VINHO' and len(t) > 1 and t[1] == 'W':
            t = t[:1] + t[2:]
        k = tipo(t)
        b = t[k:]
        if b and PAISES.match(b[0]) and t[0] in ('VINHO', 'ESPUM', 'AZEITE', 'CHAMP'):
            r = PAISES.sub('', b[0]).lstrip('.')
            b = ([r] if r else []) + b[1:]
        if not b or SIZE.match(b[0]):
            continue
        ini[b[0]] += 1
        if len(b) > 1 and not SIZE.match(b[1]):
            par[(b[0], b[1])] += 1
            if len(b) > 2 and not SIZE.match(b[2]):
                tri[(b[0], b[1], b[2])] += 1
    marcas = set()
    for (a, b), c in par.items():
        if (a in PEQ and a not in CONECT) or b in PEQ or b in TIPOS:
            continue
        if a in CONECT and len(b) > 1:
            marcas.add(f'{a} {b}')
        elif c >= 3 and c / ini[a] >= 0.75 and len(a) > 1:
            marcas.add(f'{a} {b}')
    for (a, b, c3), c in tri.items():
        if (a in PEQ and a not in CONECT) or c3 in PEQ:
            continue
        if b in PEQ and a not in PEQ and c >= 2 and c / ini[a] >= 0.5:
            marcas.add(f'{a} {b} {c3}')
        elif f'{a} {b}' in marcas and c >= 3 and c / par[(a, b)] >= 0.8 and (b in CONECT or len(b) <= 2):
            marcas.add(f'{a} {b} {c3}')
    marcas |= EXTRAS
    ordenado = dict(sorted(TIPOS.items(), key=lambda kv: -len(kv[0].split())))
    with open(os.path.join(RAIZ, 'js/tipos.js'), 'w') as f:
        f.write('// Gerado por tools/gerar_tipos.py — não editar à mão\n')
        f.write('// TIPOS: início da descrição da base -> 1ª linha da placa (o que é o produto)\n')
        f.write('export const TIPOS = ' + json.dumps(ordenado, ensure_ascii=False) + ';\n')
        f.write('// MARCAS com mais de uma palavra (2ª linha da placa)\n')
        f.write('export const MARCAS = new Set(' + json.dumps(sorted(marcas), ensure_ascii=False) + ');\n')
    print(len(marcas), 'marcas compostas')


if __name__ == '__main__':
    main()
