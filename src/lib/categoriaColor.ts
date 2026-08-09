/** Cores fixas por nome — mesma categoria sempre com a mesma cor em todo o app. */
const CORES_NOMEADAS: Record<string, string> = {
  "moradia": "#2a78d6",             // azul
  "não essenciais": "#8a8a85",      // cinza
  "recorrentes mensais": "#b39ddb", // roxo claro
  "cartão de crédito": "#e34948",   // vermelho
  "sobra": "#0ca30c",               // verde
}

/** Paleta de reserva para categorias sem cor fixa definida (nova categoria criada pelo usuário). */
const CORES_RESERVA = ["#eda100", "#e87ba4", "#1baf7a", "#4a3aa7", "#199e70"]

function hashEstavel(texto: string): number {
  let hash = 0
  for (let i = 0; i < texto.length; i++) hash = (hash * 31 + texto.charCodeAt(i)) >>> 0
  return hash
}

/** Cor estável para um nome de categoria (ou rótulo sintético como "Sobra"/"Cartão de crédito"). */
export function corPorNome(nome: string): string {
  const chave = nome.trim().toLowerCase()
  if (chave in CORES_NOMEADAS) return CORES_NOMEADAS[chave]
  return CORES_RESERVA[hashEstavel(chave) % CORES_RESERVA.length]
}

const COR_SEM_CATEGORIA = "#b5b3ad"

/** Cor estável de uma categoria pelo nome dela (mesma cor em Compromissos, Categorias e Histórico). */
export function corDaCategoria(categoriaId: string | null, categorias: { id: string; nome: string }[]): string {
  if (categoriaId === null) return COR_SEM_CATEGORIA
  const categoria = categorias.find((c) => c.id === categoriaId)
  if (!categoria) return COR_SEM_CATEGORIA
  return corPorNome(categoria.nome)
}
