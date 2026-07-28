export type EstadoMaterial = 'Disponible' | 'En uso' | 'Prestado' | 'Dañado' | 'En reparación' | 'Agotado'

export interface Material {
  id: string
  codigo: string
  nombre: string
  cantidad: number
  unidad: string | null
  ubicacion: string | null
  categoria: string | null
  pasillo: string | null
  estante: string | null
  nivel: string | null
  proveedor: string | null
  estado: EstadoMaterial
  notas: string | null
  registrado_por: string | null
  almacen_id: string | null
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

export type TipoMovimiento = 'entrada' | 'salida' | 'transferencia' | 'ajuste'

export interface Movimiento {
  id: string
  material_id: string
  tipo: TipoMovimiento
  cantidad: number
  destino: string | null
  almacen_origen_id: string | null
  almacen_destino_id: string | null
  usuario_id: string | null
  responsable: string
  observaciones: string | null
  created_at: string
}

// usuario_id lo fija el trigger "preparar_movimiento" a partir de la
// sesión — el frontend nunca lo manda.
export type MovimientoInput = Omit<Movimiento, 'id' | 'usuario_id'>

export interface Perfil {
  id: string
  nombre: string | null
  telefono: string | null
  email: string | null
  created_at: string
}
