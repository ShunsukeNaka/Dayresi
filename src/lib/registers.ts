import type { AppData, Register, Role, Store } from '../types'

/** レジが 1 つもないときに自動で作る、代表者のレジの名前（spec-next.md「レジ」） */
export const DEFAULT_REGISTER_NAME = 'マイレジ'

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
