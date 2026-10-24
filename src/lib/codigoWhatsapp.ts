// Código que liga um número de WhatsApp a uma conta: gerado no app (Configurações) e
// mandado para o bot. Sem 0/O, 1/I/L para não confundir ao digitar.
export const ALFABETO_CODIGO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
export const TAMANHO_CODIGO = 6
export const VALIDADE_CODIGO_MINUTOS = 10

export function gerarCodigo(): string {
  const bytes = crypto.getRandomValues(new Uint32Array(TAMANHO_CODIGO))
  return Array.from(bytes, (b) => ALFABETO_CODIGO[b % ALFABETO_CODIGO.length]).join("")
}

/** O código contido na mensagem (ignora espaços, hífens e maiúsculas/minúsculas), ou null. */
export function lerCodigo(texto: string): string | null {
  const limpo = texto.toUpperCase().replace(/[\s-]/g, "")
  if (limpo.length !== TAMANHO_CODIGO) return null
  return [...limpo].every((c) => ALFABETO_CODIGO.includes(c)) ? limpo : null
}
