export type Recorrencia = "recorrente" | "eventual"
export type TipoReceita = "recorrente" | "extraordinaria"
export type Status = "pendente" | "pago"
export type TipoPatrimonio = "guardado" | "investido"
export type Moeda = "EUR" | "BRL"

export type Categoria = {
  id: string
  user_id: string
  nome: string
  created_at: string
}

export type Receita = {
  id: string
  user_id: string
  nome: string
  valor: number
  data: string
  recorrente: boolean
  tipo: TipoReceita
  valido_ate: string | null
  created_at: string
}

export type CompromissoFinanceiro = {
  id: string
  user_id: string
  categoria_id: string | null
  nome: string
  valor: number
  vencimento: string
  competencia: string
  recorrencia: Recorrencia
  essencial: boolean
  status: Status
  serie_id: string
  created_at: string
}

export type Cartao = {
  id: string
  user_id: string
  nome: string
  limite: number | null
  dia_fechamento: number
  dia_vencimento: number
  created_at: string
}

export type CompraParcelada = {
  id: string
  cartao_id: string
  descricao: string
  valor_total: number
  quantidade_parcelas: number
  valor_parcela: number
  mes_inicial: string
  created_at: string
}

export type Parcela = {
  id: string
  compra_parcelada_id: string
  numero_parcela: number
  competencia: string
  valor: number
  status: Status
  created_at: string
}

export type Meta = {
  id: string
  user_id: string
  nome: string
  valor_desejado: number
  valor_acumulado: number
  moeda: Moeda
  created_at: string
}

export type Patrimonio = {
  id: string
  user_id: string
  tipo: TipoPatrimonio
  valor: number
  moeda: Moeda
  atualizado_em: string
}

type Table<Row, Insert> = {
  Row: Row
  Insert: Insert
  Update: Partial<Row>
  Relationships: []
}

export type Database = {
  public: {
    Tables: {
      categorias: Table<Categoria, Partial<Categoria> & { nome: string; user_id: string }>
      receitas: Table<Receita, Partial<Receita> & { nome: string; valor: number; data: string; tipo: TipoReceita; user_id: string }>
      compromissos_financeiros: Table<CompromissoFinanceiro, Partial<CompromissoFinanceiro> & { nome: string; valor: number; vencimento: string; competencia: string; recorrencia: Recorrencia; user_id: string }>
      cartoes: Table<Cartao, Partial<Cartao> & { nome: string; dia_fechamento: number; dia_vencimento: number; user_id: string }>
      compras_parceladas: Table<CompraParcelada, Partial<CompraParcelada> & { cartao_id: string; descricao: string; valor_total: number; quantidade_parcelas: number; valor_parcela: number; mes_inicial: string }>
      parcelas: Table<Parcela, Partial<Parcela> & { compra_parcelada_id: string; numero_parcela: number; competencia: string; valor: number }>
      metas: Table<Meta, Partial<Meta> & { nome: string; valor_desejado: number; user_id: string }>
      patrimonio: Table<Patrimonio, Partial<Patrimonio> & { tipo: TipoPatrimonio; valor: number; moeda: Moeda; user_id: string }>
    }
    Views: Record<string, never>
    Functions: Record<string, never>
  }
}
