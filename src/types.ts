export interface Material {
  id: string
  codigo: string
  nombre: string
  cantidad: number
  unidad: string | null
  ubicacion: string | null
  categoria: string | null
  notas: string | null
  registrado_por: string | null
  created_at: string
  updated_at: string
}

export type MaterialInput = Omit<Material, 'id' | 'created_at' | 'updated_at'>

export interface Almacen {
  id: string
  nombre: string
  notas: string | null
  created_at: string
  updated_at: string
}

export type AlmacenInput = Omit<Almacen, 'id' | 'created_at' | 'updated_at'>

export interface Categoria {
  id: string
  nombre: string
  notas: string | null
  created_at: string
  updated_at: string
}

export type CategoriaInput = Omit<Categoria, 'id' | 'created_at' | 'updated_at'>
