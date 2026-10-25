import type { AppData, Register, Role, Store } from '../types'

/** レジが 1 つもないときに自動で作る、代表者のレジの名前（spec-next.md「レジ」） */
export const DEFAULT_REGISTER_NAME = 'マイレジ'

/** 役割の表示（spec-next.md「役割」） */
export const ROLE_LABEL: Record<Role, string> = { owner: '代表者', member: '会計' }

type RegisterInit = Partial<AppData> & {
  name: string
  role?: Role
  myName?: string
  /** 会計する人のレジでは、配られた店の印を使う。省くと新しく振る */
  storeId?: string
}

/** 新しいレジを作る。ID は crypto.randomUUID() で振る */
export function createRegister({ name, role = 'owner', myName = '', storeId, products = [], sales = [] }: RegisterInit): Register {
  return { id: crypto.randomUUID(), storeId: storeId ?? crypto.randomUUID(), name, role, myName, products, sales }
}

/** レジが 1 つだけの、新しい保存データ。MVP の保存データ（商品と会計）を引き継ぐときにも使う */
export function storeWith(data: Partial<AppData> = {}): Store {
  const register = createRegister({ name: DEFAULT_REGISTER_NAME, ...data })
  return { registers: [register], currentId: register.id }
}

/** 今使っているレジ。currentId がどのレジとも合わないときは、最初のレジ */
export function currentRegister(store: Store): Register {
  return store.registers.find((r) => r.id === store.currentId) ?? store.registers[0]
}

/**
 * 今使っているレジを変える。update が同じレジを返したら、同じ保存データを返す（保存し直さない）
 */
export function updateCurrent(store: Store, update: (register: Register) => Register): Store {
  const current = currentRegister(store)
  const next = update(current)
  if (next === current) return store
  return { ...store, registers: store.registers.map((r) => (r === current ? next : r)) }
}

/** 今使うレジを切り替える。ない ID や、もう今のレジなら、同じ保存データを返す */
export function switchRegister(store: Store, id: string): Store {
  if (id === store.currentId || !store.registers.some((r) => r.id === id)) return store
  return { ...store, currentId: id }
}

/** レジを一覧の末尾に足し、そのレジに切り替える */
export function addRegister(store: Store, register: Register): Store {
  return { registers: [...store.registers, register], currentId: register.id }
}

/**
 * レジを削除する。ない ID なら同じ保存データを返す
 * 今のレジを消したら、一覧の最初のレジに切り替える。最後の 1 つを消したら、マイレジを自動で作る（spec-next.md「レジ」）
 */
export function deleteRegister(store: Store, id: string): Store {
  if (!store.registers.some((r) => r.id === id)) return store
  const registers = store.registers.filter((r) => r.id !== id)
  if (registers.length === 0) return storeWith()
  return { registers, currentId: registers.some((r) => r.id === store.currentId) ? store.currentId : registers[0].id }
}
